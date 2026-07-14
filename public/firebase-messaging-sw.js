importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDxhehxMBvx5C8TbfaKr25iaBRzT0B-pf8',
  authDomain: 'orkestria-os-gestao-de-frota.firebaseapp.com',
  projectId: 'orkestria-os-gestao-de-frota',
  storageBucket: 'orkestria-os-gestao-de-frota.firebasestorage.app',
  messagingSenderId: '23796532338',
  appId: '1:23796532338:web:c6dfa3903bc060359eeeeb'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

