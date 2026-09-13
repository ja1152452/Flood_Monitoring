import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';

const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE', 'ADMIN', 'SUPER_ADMIN'];
const MIN_SEND_INTERVAL_MS = 2000; // throttle: max once per 2s
const HEARTBEAT_INTERVAL_MS = 10000; // heartbeat: send at least once every 10s even if stationary
const MAX_ACCURACY_METERS = 350; // allow fixes up to 350m for indoor / urban testing

export function useResponderLocation() {
  const { user, token } = useAuthStore();
  const subRef       = useRef(null);
  const lastSentAt   = useRef(0);
  const latestCoords = useRef(null);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    const role = String(user?.role || '').toUpperCase();
    if (!user?.id || !token || !RESPONDER_ROLES.includes(role)) return;

    let active = true;

    const sendCoords = (coords) => {
      if (!active || !coords) return;
      latestCoords.current = coords;
      lastSentAt.current = Date.now();
      api.post('/users/location', {
        lat: coords.latitude,
        lng: coords.longitude,
      }).catch(() => {});
    };

    const fetchAndSendImmediate = async () => {
      try {
        // Fast fix from OS cache
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown?.coords && active) {
          sendCoords(lastKnown.coords);
        }
      } catch (_) {}

      try {
        // Fresh active GPS reading
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (fresh?.coords && active) {
          sendCoords(fresh.coords);
        }
      } catch (_) {}
    };

    const init = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        const granted = status === 'granted'
          ? true
          : (await Location.requestForegroundPermissionsAsync()).status === 'granted';
        if (!granted || !active) return;

        // 1. Initial fast acquisition
        await fetchAndSendImmediate();

        // 2. Continuous real-time GPS watcher
        try {
          const sub = await Location.watchPositionAsync(
            {
              accuracy:         Location.Accuracy.High,
              timeInterval:     2000, // minimum ms between OS GPS updates
              distanceInterval: 1,    // trigger update if moved 1 meter
            },
            (loc) => {
              if (!active || !loc?.coords) return;
              // Discard only excessively coarse fixes (> 350m)
              if (loc.coords.accuracy && loc.coords.accuracy > MAX_ACCURACY_METERS) return;

              const now = Date.now();
              if (now - lastSentAt.current < MIN_SEND_INTERVAL_MS) return; // throttle
              sendCoords(loc.coords);
            }
          );

          if (!active) {
            sub?.remove();
          } else {
            subRef.current = sub;
          }
        } catch (err) {
          console.warn('useResponderLocation watch error:', err);
        }

        // 3. Stationary Heartbeat: ensure location is broadcast even if user doesn't move
        heartbeatRef.current = setInterval(async () => {
          if (!active) return;
          const now = Date.now();
          if (now - lastSentAt.current >= HEARTBEAT_INTERVAL_MS) {
            if (latestCoords.current) {
              sendCoords(latestCoords.current);
            } else {
              await fetchAndSendImmediate();
            }
          }
        }, 5000);

      } catch (err) {
        console.warn('useResponderLocation init error:', err);
      }
    };

    init();

    // 4. AppState listener: immediately re-ping when app returns to foreground
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && active) {
        fetchAndSendImmediate();
      }
    });

    return () => {
      active = false;
      if (subRef.current) {
        subRef.current.remove();
        subRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      appStateSub.remove();
    };
  }, [user?.id, user?.role, token]);
}
