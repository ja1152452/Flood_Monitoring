import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
export const BACKGROUND_ALERT_TASK = 'BACKGROUND_ALERT_TASK';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
    priority:        Notifications.AndroidNotificationPriority.MAX,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('flood-alerts', {
    name:                     'Flood Alerts',
    importance:               Notifications.AndroidImportance.MAX,
    vibrationPattern:         [0, 500, 200, 500, 200, 500],
    lightColor:               '#dc2626',
    sound:                    'default',
    enableVibrate:            true,
    showBadge:                true,
    lockscreenVisibility:     Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd:                true,
  });
}

export async function requestNotificationPermission() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (_) {
    return false;
  }
}

export async function getFCMToken() {
  try {
    if (Platform.OS === 'web') return null;
    let { status } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'denied' }));
    if (status !== 'granted') {
      const res = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      status = res?.status;
    }
    if (status !== 'granted') return null;

    // 1. Try native device push token (FCM)
    const tokenObj = await Notifications.getDevicePushTokenAsync().catch(() => null);
    if (tokenObj?.data) return tokenObj.data;

    // 2. Fallback to Expo push token if device token is unavailable
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const expoTokenObj = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined).catch(() => null);
    return expoTokenObj?.data || null;
  } catch (e) {
    console.log('[FCM] Token retrieval warning:', e?.message || e);
    return null;
  }
}

export async function sendLocalNotification(title, body) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound:    true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        android: { channelId: 'flood-alerts' },
      },
      trigger: null,
    });
  } catch (e) {
    console.log('[Notifications] Error:', e.message);
  }
}

export function registerBackgroundFetch() {
  // Background fetch handled by FCM push notifications from backend
}
