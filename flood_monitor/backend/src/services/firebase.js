import admin from 'firebase-admin';

let app;
let initError = null;

function getApp() {
  if (initError) return null;
  if (!app) {
    try {
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        initError = 'Firebase credentials not configured';
        console.warn('[FCM] Firebase not configured - push notifications disabled');
        return null;
      }
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      console.log('[FCM] Firebase initialized successfully');
    } catch (e) {
      initError = e.message;
      console.error('[FCM] Initialization failed:', e.message);
      return null;
    }
  }
  return app;
}

export async function sendPushNotification(fcmToken, title, body) {
  if (!fcmToken) return;

  // 1. Expo Push Token handling (when token starts with ExponentPushToken or ExpoPushToken)
  if (typeof fcmToken === 'string' && (fcmToken.startsWith('ExponentPushToken') || fcmToken.startsWith('ExpoPushToken'))) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: fcmToken,
          title: title || '',
          body: body || '',
          sound: 'default',
          priority: 'high',
          channelId: 'flood-alerts',
          data: { title, body },
        }),
      });
      console.log(`[Expo Push] Push notification dispatched to ${fcmToken.slice(0, 22)}...`);
      return;
    } catch (e) {
      console.warn('[Expo Push] Send error:', e.message);
    }
  }

  // 2. Native FCM Push via Firebase Admin SDK
  try {
    const firebaseApp = getApp();
    if (!firebaseApp) return;
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: {
        title: title || '',
        body: body || '',
        channelId: 'flood-alerts',
        sound: 'default',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'flood-alerts',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
          },
        },
      },
    });
    console.log(`[FCM] Notification sent successfully to token ${fcmToken.slice(0, 12)}...`);
  } catch (e) {
    console.warn('[FCM] Send error:', e.message);
    if (e.code === 'messaging/registration-token-not-registered' || e.message?.includes('NotRegistered')) {
      try {
        const { query } = await import('../config/db.js');
        await query('UPDATE users SET fcm_token = NULL WHERE fcm_token = $1', [fcmToken]);
        console.log(`[FCM] Cleaned up stale unregistered token from DB`);
      } catch (_) {}
    }
    // Fallback attempt to Expo API if token format was mismatched
    if (typeof fcmToken === 'string' && (e.code === 'messaging/invalid-argument' || e.message?.includes('not a valid FCM registration token'))) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: fcmToken, title, body, sound: 'default', priority: 'high', channelId: 'flood-alerts'
          }),
        });
        console.log(`[Push Fallback] Fallback Expo push sent for ${fcmToken.slice(0, 15)}...`);
      } catch (_) {}
    }
  }
}
