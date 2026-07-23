import * as functions from 'firebase-functions/v2';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Nova forma de inicializar na versão mais recente:
if (getApps().length === 0) {
    initializeApp();
}
const db = getFirestore('ai-studio-orkestriaosbrass-d4be16bf-f869-4fdf-95ef-b446bd38bbb5');
const messaging = getMessaging();

export const onRouteEvent = functions.firestore.onDocumentWritten({
  document: 'routes/{routeId}',
  database: 'ai-studio-orkestriaosbrass-d4be16bf-f869-4fdf-95ef-b446bd38bbb5'
}, async (event) => {
  const snapshotBefore = event.data?.before?.data();
  const snapshotAfter = event.data?.after?.data();

  if (!snapshotAfter) return; // Ignore deletions

  const driverBefore = snapshotBefore?.driver;
  const driverAfter = snapshotAfter.driver;
  const statusBefore = snapshotBefore?.status;
  const statusAfter = snapshotAfter.status;

  // Se a rota acabou de ser atribuída a um motorista ou ficou 'pending'
  const isNewlyAssignedToDriver = driverBefore !== driverAfter && driverAfter && driverAfter !== 'Aguardando';
  const isNowPendingForDriver = statusBefore !== 'pending' && statusAfter === 'pending' && driverAfter && driverAfter !== 'Aguardando';

  if (isNewlyAssignedToDriver || isNowPendingForDriver) {
    const driverName = driverAfter;
    
    // Find driver by name to get the FCM token
    const driversRef = db.collection('drivers');
    const snapshot = await driversRef.where('name', '==', driverName).limit(1).get();

    if (snapshot.empty) {
      console.log(`No driver found with name: ${driverName}`);
      return;
    }

    const driverDoc = snapshot.docs[0];
    const fcmToken = driverDoc.data().fcmToken;

    if (!fcmToken) {
      console.log(`Driver ${driverName} does not have an FCM token.`);
      return;
    }

    const message: any = {
      notification: {
        title: 'Nova Rota Atribuída! \uD83D\uDEA8', // Siren emoji
        body: `Rota #${event.params.routeId.slice(0, 8).toUpperCase()} disponível. Abra o app para aceitar!`,
      },
      token: fcmToken,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_importance_channel',
          vibrateTimingsMillis: [200, 100, 200, 100, 200, 100, 200]
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          requireInteraction: true
        }
      }
    };

    try {
      const response = await messaging.send(message);
      console.log('Successfully sent message:', response);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
});

import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const getDashboardStats = onCall(async (request) => {
  // if (!request.auth) {
  //   throw new HttpsError('unauthenticated', 'User must be authenticated');
  // }

  const { startDate, endDate, chartDatesStr } = request.data;
  
  if (!startDate || !endDate) {
    throw new HttpsError('invalid-argument', 'Missing startDate or endDate');
  }

  const startObj = new Date(startDate);
  startObj.setHours(0, 0, 0, 0);
  const endObj = new Date(endDate);
  endObj.setHours(23, 59, 59, 999);
  
  const chartDates: Date[] = (chartDatesStr || []).map((d: string) => new Date(d));

  const parseStrDate = (dateStr?: string) => {
    if (!dateStr) return new Date(0);
    if (dateStr.toLowerCase() === 'hoje') return new Date();
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
    }
    return new Date(dateStr + 'T12:00:00');
  };

  // Fetch all collections (Simulating the frontend's heavy lift, but on the server)
  const [logsSnap, routesSnap, driversSnap, reqsSnap] = await Promise.all([
    db.collection('dailyLogs').get(),
    db.collection('routes').get(),
    db.collection('drivers').get(),
    db.collection('external_requests').get()
  ]);

  const dailyLogs = logsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const routes = routesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const drivers = driversSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const externalRequests = reqsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

  // Filter Daily Logs by Period
  const periodLogs = dailyLogs.filter(l => {
    const d = parseStrDate(l.date as string);
    return d >= startObj && d <= endObj;
  });

  const totalKmPeriod = periodLogs.reduce((acc, log: any) => {
    if (log.finalKm && log.finalKm > log.initialKm) {
      return acc + (log.finalKm - log.initialKm);
    }
    return acc;
  }, 0);

  const completedPeriodLogs = periodLogs.filter((l: any) => l.status === 'completed' && l.finalKm && l.finalKm > l.initialKm);
  const totalKmAllTime = completedPeriodLogs.reduce((acc, log: any) => acc + (log.finalKm - log.initialKm), 0);
  
  const uniqueDrivers = new Set(completedPeriodLogs.map((l: any) => l.driverId)).size;
  const uniqueVehicles = new Set(completedPeriodLogs.map((l: any) => l.vehicleId)).size;
  
  const avgKmPerDriver = uniqueDrivers > 0 ? Math.round(totalKmAllTime / uniqueDrivers) : 0;
  const avgKmPerVehicle = uniqueVehicles > 0 ? Math.round(totalKmAllTime / uniqueVehicles) : 0;

  const assignedRequestIds = new Set(
    routes.flatMap((r: any) => r.stopDetails?.map((s: any) => s.externalRequestId).filter(Boolean)) || []
  );

  const allStopsRaw = routes.flatMap((r: any) => {
    if (!r.stopDetails) return [];
    return r.stopDetails.map((stop: any) => ({
      ...stop,
      routeId: r.id,
      routeNumber: r.routeNumber?.toString() || '-',
      driverName: r.driver || 'Sem Motorista',
      routeDate: r.date
    }));
  }) || [];

  const unassignedStops = externalRequests
    .filter((req: any) => req.status === 'pending' && !assignedRequestIds.has(req.id))
    .map((req: any) => ({
      id: req.id,
      address: req.address,
      status: 'pending',
      orderNumber: req.orderNumber || req.osNumber,
      customerName: req.requesterName,
      customerPhone: req.contactPhone,
      observation: req.observations,
      routeId: '-',
      routeNumber: '-',
      driverName: 'Não Atribuído',
      routeDate: req.scheduledDate || (typeof req.createdAt === 'string' ? req.createdAt.split('T')[0] : (req.createdAt && typeof req.createdAt.toDate === 'function' ? req.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0])),
      externalRequestId: req.id
    })) || [];

  const combinedStops = [...allStopsRaw, ...unassignedStops];

  const periodStops = combinedStops.filter((s: any) => {
    const d = parseStrDate(s.routeDate);
    return d >= startObj && d <= endObj;
  });
  
  const totalStops = periodStops.length;
  const completedStops = periodStops.filter(s => s.status === 'completed').length;
  const pendingStops = periodStops.filter(s => s.status === 'pending').length;
  const issueStops = periodStops.filter(s => s.status === 'issue').length;

  const activeDriversCount = drivers.filter((d: any) => d.status === 'active' || d.status === 'on_route').length || 0;
  const activeRoutesCount = routes.filter((r: any) => r.status === 'in_progress').length || 0;
  const slaPercentage = (completedStops + issueStops) > 0 
    ? ((completedStops / (completedStops + issueStops)) * 100).toFixed(1) 
    : '100.0';

  const dynamicDeliveryData = chartDates.map(dateObj => {
    const isoDate = dateObj.toISOString().split('T')[0];
    const localDate = dateObj.toLocaleDateString('pt-BR');
    const stopsOnDate = periodStops.filter(s => s.routeDate === isoDate || s.routeDate === localDate || (s.routeDate && s.routeDate.includes(localDate)) || (s.routeDate?.toLowerCase() === 'hoje' && localDate === new Date().toLocaleDateString('pt-BR')));
    return {
      name: localDate.slice(0, 5), // DD/MM
      success: stopsOnDate.filter(s => s.status === 'completed').length,
      failed: stopsOnDate.filter(s => s.status === 'issue').length
    };
  });

  const dynamicStatusData = [
    { name: 'Entregue', value: completedStops, color: '#10b981' },
    { name: 'Pendente', value: pendingStops, color: '#3b82f6' },
    { name: 'Insucesso', value: issueStops, color: '#ef4444' },
  ].filter(d => d.value > 0);
  
  if (dynamicStatusData.length === 0) {
    dynamicStatusData.push({ name: 'Sem dados no período', value: 1, color: '#e2e8f0' });
  }

  const activeAlerts = periodStops.filter(s => s.status === 'issue').slice(0, 5);

  return {
    totalKmPeriod,
    avgKmPerDriver,
    avgKmPerVehicle,
    totalStops,
    completedStops,
    pendingStops,
    issueStops,
    activeDriversCount,
    activeRoutesCount,
    slaPercentage,
    dynamicDeliveryData,
    dynamicStatusData,
    activeAlerts,
    periodLogs,
    periodStops
  };
});
