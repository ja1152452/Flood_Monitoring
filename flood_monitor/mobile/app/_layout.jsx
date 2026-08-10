import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { requestNotificationPermission, getFCMToken, registerBackgroundFetch } from '../utils/notifications';
import api from '../api/axios';
import { useResponderLocation } from '../hooks/useResponderLocation';
import { useEmergencyNotifications } from '../hooks/useEmergencyNotifications';
import { useRescueStatusNotifications } from '../hooks/useRescueStatusNotifications';
import { queryClient } from '../utils/queryClient';

function AppInit() {
  const { user, token, loadFromStorage } = useAuthStore();
  useResponderLocation();
  useEmergencyNotifications();
  useRescueStatusNotifications();

  useEffect(() => {
    async function initApp() {
      await loadFromStorage();
      await requestNotificationPermission();
      registerBackgroundFetch();
    }
    initApp();
  }, []);

  // Register FCM push token whenever authenticated user is present
  useEffect(() => {
    if (token && user) {
      getFCMToken().then(fcmToken => {
        if (fcmToken) {
          api.patch('/auth/fcm-token', { fcm_token: fcmToken }).catch(() => {});
        }
      });
    }
  }, [token, user?.id]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <StatusBar style="light" />
        <AppInit />
        <Stack screenOptions={{ headerShown: false }} />
        <Toast topOffset={60} />
      </View>
    </QueryClientProvider>
  );
}
