import * as functions from 'firebase-functions/v2';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Nova forma de inicializar na versão mais recente:
if (getApps().length === 0) {
    initializeApp();
}
const db = getFirestore();
const messaging = getMessaging();

export const onRouteCreatedOrAssigned = functions.firestore.onDocumentUpdated({
  document: 'routes/{routeId}',
  database: 'ai-studio-orkestriaosbrass-d4be16bf-f869-4fdf-95ef-b446bd38bbb5'
}, async (event) => {
  const snapshotBefore = event.data?.before.data();
  const snapshotAfter = event.data?.after.data();

  if (!snapshotAfter || !snapshotBefore) return;

  const driverBefore = snapshotBefore.driver;
  const driverAfter = snapshotAfter.driver;
  const statusBefore = snapshotBefore.status;
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
