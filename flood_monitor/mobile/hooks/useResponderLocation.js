import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';

const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE'];
const MIN_SEND_INTERVAL_MS = 3000; // throttle: don't send more than once every 3s

export function useResponderLocation() {
  const { user, token } = useAuthStore();
  const subRef     = useRef(null);
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!user?.id || !token || !RESPONDER_ROLES.includes(user.role)) return;

    let active = true;

    const init = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === 'granted'
        ? true
        : (await Location.requestForegroundPermissionsAsync()).status === 'granted';
      if (!granted || !active) return;

      // Acquire fresh, high-precision GPS position immediately as first fix
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (loc && active) {
          // Reject inaccurate initial fixes (e.g. coarse cell tower > 50m error margin)
          if (!loc.coords.accuracy || loc.coords.accuracy <= 50) {
            api.post('/users/location', {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            }).catch(() => {});
            lastSentAt.current = Date.now();
          }
        }
      } catch (_) {}

      // Watch position with highest hardware GPS satellite precision
      const sub = await Location.watchPositionAsync(
        {
          accuracy:            Location.Accuracy.BestForNavigation,
          timeInterval:        2000, // minimum ms between updates from OS
          distanceInterval:    2,    // trigger update if moved 2 meters
        },
        (loc) => {
          if (!active || !loc?.coords) return;
          // Filter out low-quality/noisy fixes (error margin > 40m)
          if (loc.coords.accuracy && loc.coords.accuracy > 40) return;

          const now = Date.now();
          if (now - lastSentAt.current < MIN_SEND_INTERVAL_MS) return; // throttle
          lastSentAt.current = now;
          api.post('/users/location', {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }).catch(() => {});
        }
      );

      if (!active) {
        sub?.remove();
      } else {
        subRef.current = sub;
      }
    };

    init();
    return () => {
      active = false;
      if (subRef.current) {
        subRef.current.remove();
        subRef.current = null;
      }
    };
  }, [user?.id, user?.role, token]);
}
