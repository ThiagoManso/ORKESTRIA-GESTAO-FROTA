import { useEffect, useRef } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RecurringRequest, ExternalRequest } from '../types';
import { trackRead, trackWrite, isCircuitBreakerTripped } from '../lib/firebaseQuotaGuard';

const COOLDOWN_KEY_PREFIX = 'orkestria_recurrence_last_run_';
const COOLDOWN_DURATION_MS = 4 * 60 * 60 * 1000; // 4 horas

export function useRecurrenceEngine(runForUserId?: string) {
  const hasRun = useRef(false);

  useEffect(() => {
    // Evita execuções repetidas na mesma sessão ou dentro da janela de cooldown
    if (hasRun.current) return;
    if (isCircuitBreakerTripped()) return;

    const cooldownKey = `${COOLDOWN_KEY_PREFIX}${runForUserId || 'global'}`;
    const lastRunRaw = localStorage.getItem(cooldownKey);
    if (lastRunRaw) {
      const lastRun = parseInt(lastRunRaw, 10);
      if (!isNaN(lastRun) && Date.now() - lastRun < COOLDOWN_DURATION_MS) {
        hasRun.current = true;
        return;
      }
    }

    const generateUpcomingRequests = async () => {
      try {
        hasRun.current = true;

        // Fetch active recurring requests
        let q = query(collection(db, 'request_templates'), where('active', '==', true));
        if (runForUserId) {
          q = query(collection(db, 'request_templates'), where('active', '==', true), where('userId', '==', runForUserId));
        }

        const templatesSnapshot = await getDocs(q);
        trackRead(templatesSnapshot.docs.length || 1);

        const templates: RecurringRequest[] = [];
        templatesSnapshot.forEach(docSnap => {
          templates.push({ id: docSnap.id, ...docSnap.data() } as RecurringRequest);
        });

        if (templates.length === 0) {
          localStorage.setItem(cooldownKey, Date.now().toString());
          return;
        }

        // Determine the target dates (today + next 7 days)
        const targetDates: { dateObj: Date, dateStr: string, dayOfWeek: number, dayOfMonth: number }[] = [];
        for (let i = 0; i <= 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
          targetDates.push({
            dateObj: d,
            dateStr,
            dayOfWeek: d.getDay(),
            dayOfMonth: d.getDate()
          });
        }

        // Fetch recent external requests to avoid duplication
        const minDate = targetDates[0].dateStr;
        let reqQuery = query(collection(db, 'external_requests'), where('scheduledDate', '>=', minDate));
        if (runForUserId) {
          reqQuery = query(collection(db, 'external_requests'), where('userId', '==', runForUserId), where('scheduledDate', '>=', minDate));
        }

        const reqSnapshot = await getDocs(reqQuery);
        trackRead(reqSnapshot.docs.length || 1);

        const existingRequests: ExternalRequest[] = [];
        reqSnapshot.forEach(docSnap => {
          existingRequests.push({ id: docSnap.id, ...docSnap.data() } as ExternalRequest);
        });

        const newRequestsToBatch: any[] = [];

        // Loop through each template and evaluate
        for (const template of templates) {
          for (const target of targetDates) {
            let shouldGenerate = false;

            if (template.frequency === 'daily') {
              shouldGenerate = true;
            } else if (template.frequency === 'weekly' && template.weekDays) {
              if (template.weekDays.includes(target.dayOfWeek)) {
                shouldGenerate = true;
              }
            } else if (template.frequency === 'monthly' && template.monthDay) {
              if (template.monthDay === target.dayOfMonth) {
                shouldGenerate = true;
              }
            }

            if (shouldGenerate) {
              // Check if we already generated for this template and date
              const alreadyExists = existingRequests.some(r =>
                r.recurrenceId === template.id && r.scheduledDate === target.dateStr
              );

              if (!alreadyExists) {
                const newRequest = {
                  type: template.type,
                  address: template.address,
                  observations: template.observations || '',
                  osNumber: template.osNumber || '',
                  orderNumber: template.orderNumber || '',
                  contactPhone: template.contactPhone || '',
                  scheduledDate: target.dateStr,
                  requesterName: template.requesterName,
                  userId: template.userId,
                  ...(template.companyId ? { companyId: template.companyId } : {}),
                  status: 'pending',
                  read: false,
                  createdAt: new Date().toISOString(),
                  recurrenceId: template.id
                };

                newRequestsToBatch.push(newRequest);
                existingRequests.push(newRequest as any);
              }
            }
          }
        }

        // Eficiência em Gravações: Envia todos os novos pedidos gerados em um único Batched Write
        if (newRequestsToBatch.length > 0) {
          const batch = writeBatch(db);
          const extRequestsCol = collection(db, 'external_requests');

          for (const item of newRequestsToBatch) {
            const newDocRef = doc(extRequestsCol);
            batch.set(newDocRef, item);
          }

          await batch.commit();
          trackWrite(newRequestsToBatch.length);
          console.log(`[RecurrenceEngine] Gerados e salvos em lote ${newRequestsToBatch.length} pedidos recorrentes.`);
        }

        localStorage.setItem(cooldownKey, Date.now().toString());
      } catch (error) {
        console.error("Error in useRecurrenceEngine:", error);
      }
    };

    void generateUpcomingRequests();
  }, [runForUserId]);
}
