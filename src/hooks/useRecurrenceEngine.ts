import { useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RecurringRequest, ExternalRequest } from '../types';

export function useRecurrenceEngine(runForUserId?: string) {
  const hasRun = useRef(false);

  useEffect(() => {
    // We only want to run this once per session/mount to avoid spamming the DB
    if (hasRun.current) return;
    
    const generateUpcomingRequests = async () => {
      try {
        hasRun.current = true;
        
        // Fetch active recurring requests
        let q = query(collection(db, 'request_templates'), where('active', '==', true));
        if (runForUserId) {
          q = query(collection(db, 'request_templates'), where('active', '==', true), where('userId', '==', runForUserId));
        }

        const templatesSnapshot = await getDocs(q);
        const templates: RecurringRequest[] = [];
        templatesSnapshot.forEach(doc => {
          templates.push({ id: doc.id, ...doc.data() } as RecurringRequest);
        });

        if (templates.length === 0) return;

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
        const existingRequests: ExternalRequest[] = [];
        reqSnapshot.forEach(doc => {
          existingRequests.push({ id: doc.id, ...doc.data() } as ExternalRequest);
        });

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
                console.log(`[RecurrenceEngine] Generating request for template ${template.id} on ${target.dateStr}`);
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
                  status: 'pending',
                  read: false,
                  createdAt: new Date().toISOString(),
                  recurrenceId: template.id
                };

                await addDoc(collection(db, 'external_requests'), newRequest);
                
                // Add to local cache to prevent duplicate in same run
                existingRequests.push(newRequest as any);
              }
            }
          }
        }

      } catch (error) {
        console.error("Error in useRecurrenceEngine:", error);
      }
    };

    generateUpcomingRequests();
  }, [runForUserId]);
}
