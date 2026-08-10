import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { loadFromStorage } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    loadFromStorage().then((token) => {
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#3b82f6" size="large" />
    </View>
  );
}