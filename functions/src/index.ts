import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const onRouteManifestUpdated = functions.firestore
  .document("route_manifests/{manifestId}")
  .onWrite(async (change, context) => {
    const after = change.after.data();
    const before = change.before.data();

    // If it was deleted, nothing to do
    if (!after) return;

    // Check if new stops were added or if it's a new route manifest entirely
    const isNew = !before;
    let newStopsAdded = false;

    if (before && after) {
      const oldReqs = before.requestIds || [];
      const newReqs = after.requestIds || [];
      if (newReqs.length > oldReqs.length) {
        newStopsAdded = true;
      }
    }

    if (isNew || newStopsAdded) {
      const driverId = after.driverId;
      if (!driverId) return;

      // Find the user with this driverId
      // In this app, driverId might be user.uid directly or mapped. We assume the user doc has fcmToken
      // Let's query users for fcmToken
      try {
        const userDoc = await admin.firestore().collection("users").doc(driverId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const token = userData?.fcmToken;
            if (token) {
                await admin.messaging().send({
                    token: token,
                    notification: {
                        title: "Sua rota foi atualizada",
                        body: "Nova parada adicionada. Siga a nova sequência otimizada."
                    }
                });
            }
        }
      } catch(e) {
         console.error("Error sending push:", e);
      }
    }
  });
