importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "xavier-pescados",
  appId: "1:153797901527:web:89ef87b33ae4a201f68492",
  apiKey: "AIzaSyAqbggJaMbm1yRS2IOqItmec9fF68C8C4Q",
  authDomain: "xavier-pescados.firebaseapp.com",
  storageBucket: "xavier-pescados.firebasestorage.app",
  messagingSenderId: "153797901527"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Atualização de Rota';
  const notificationOptions = {
    body: payload.notification?.body || 'Uma nova parada foi adicionada à sua rota.',
    icon: '/pwa-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
