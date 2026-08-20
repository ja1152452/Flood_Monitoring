import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { requestNotificationPermission, getFCMToken, registerBackgroundFetch } from '../utils/notifications';
import api from '../api/axios';
import { useResponderLocation } from '../hooks/useResponderLocation';
import { useEmergencyNotifications } from '../hooks/useEmergencyNotifications';
import { useRescueStatusNotifications } from '../hooks/useRescueStatusNotifications';
import { queryClient } from '../utils/queryClient';

const toastConfig = {
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#dc2626',
        backgroundColor: '#ffffff',
        height: 'auto',
        minHeight: 64,
        paddingVertical: 10,
        paddingHorizontal: 14,
        width: '92%',
        borderRadius: 14,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 8 }}
      text1Style={{
        fontSize: 14,
        fontWeight: '800',
        color: '#dc2626',
      }}
      text2Style={{
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        lineHeight: 18,
      }}
      text1NumberOfLines={2}
      text2NumberOfLines={0}
    />
  ),
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#16a34a',
        backgroundColor: '#ffffff',
        height: 'auto',
        minHeight: 60,
        paddingVertical: 10,
        paddingHorizontal: 14,
        width: '92%',
        borderRadius: 14,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 8 }}
      text1Style={{
        fontSize: 14,
        fontWeight: '800',
        color: '#15803d',
      }}
      text2Style={{
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        lineHeight: 18,
      }}
      text1NumberOfLines={2}
      text2NumberOfLines={0}
    />
  ),
};

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
        <Toast config={toastConfig} topOffset={60} />
      </View>
    </QueryClientProvider>
  );
}
