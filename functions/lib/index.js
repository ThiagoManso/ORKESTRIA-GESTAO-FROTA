"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRouteEvent = void 0;
const functions = require("firebase-functions/v2");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
// Nova forma de inicializar na versão mais recente:
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
exports.onRouteEvent = functions.firestore.onDocumentWritten({
    document: 'routes/{routeId}',
    database: 'ai-studio-orkestriaosbrass-d4be16bf-f869-4fdf-95ef-b446bd38bbb5'
}, async (event) => {
    var _a, _b, _c, _d;
    const snapshotBefore = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const snapshotAfter = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!snapshotAfter)
        return; // Ignore deletions
    const driverBefore = snapshotBefore === null || snapshotBefore === void 0 ? void 0 : snapshotBefore.driver;
    const driverAfter = snapshotAfter.driver;
    const statusBefore = snapshotBefore === null || snapshotBefore === void 0 ? void 0 : snapshotBefore.status;
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
        const message = {
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
        }
        catch (error) {
            console.error('Error sending message:', error);
        }
    }
});
//# sourceMappingURL=index.js.map