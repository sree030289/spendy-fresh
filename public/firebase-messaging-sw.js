// Import Firebase scripts for Firebase v9+
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDuA_GmvIE68-qJgI8-BFv4A8QU9L9nREQ",
  authDomain: "spendy-97913.firebaseapp.com",
  projectId: "spendy-97913",
  storageBucket: "spendy-97913.appspot.com",
  messagingSenderId: "925485214959",
  appId: "1:925485214959:web:1234567890abcdef123456"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('🔔 [Service Worker] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Spendy Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/assets/notification-icon.png',
    badge: '/assets/notification-icon.png',
    tag: payload.data?.type || 'default',
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [Service Worker] Notification click received:', event);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    // Open the app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});
