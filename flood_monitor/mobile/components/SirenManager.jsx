import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Vibration, AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getActiveAlerts } from '../api/alerts';
import { useAuthStore } from '../store/authStore';

const SIREN_LEVELS = ['MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL'];

export function SirenManager() {
  const soundRef  = useRef(null);
  const loadedRef = useRef(false);
  const prevState = useRef(null);

  const { sirenMuted } = useAuthStore();

  const { data: alerts = [] } = useQuery({
    queryKey:        ['active-alerts'],
    queryFn:         getActiveAlerts,
    refetchInterval: 3000,
  });

  const activeLevel = alerts[0]?.flood_level;
  const shouldPlay  = SIREN_LEVELS.includes(activeLevel) && !sirenMuted;

  const loadSound = async () => {
    if (loadedRef.current) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:      false,
        playsInSilentModeIOS:    true,
        staysActiveInBackground: true,
        shouldDuckAndroid:       false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/siren.ogg'),
        { isLooping: true, shouldPlay: false, volume: 1.0 }
      );
      soundRef.current  = sound;
      loadedRef.current = true;
    } catch (e) {
      console.log('[SirenManager] Load error:', e.message);
    }
  };

  const startSiren = async () => {
    try {
      await loadSound();
      if (!soundRef.current) return;
      const status = await soundRef.current.getStatusAsync();
      if (!status.isPlaying) await soundRef.current.playAsync();
      Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500], true); // true = repeat
    } catch (e) {
      console.log('[SirenManager] Play error:', e.message);
    }
  };

  const stopSiren = async () => {
    try {
      Vibration.cancel();
      if (!soundRef.current) return;
      const status = await soundRef.current.getStatusAsync();
      if (status.isPlaying) {
        await soundRef.current.stopAsync();
        await soundRef.current.setPositionAsync(0);
      }
    } catch (e) {
      console.log('[SirenManager] Stop error:', e.message);
    }
  };

  useEffect(() => {
    const key = `${shouldPlay}-${activeLevel}`;
    if (key === prevState.current) return;
    prevState.current = key;
    if (shouldPlay) startSiren();
    else           stopSiren();
  }, [shouldPlay, activeLevel]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if ((state === 'background' || state === 'inactive') && !shouldPlay) stopSiren();
    });
    return () => {
      sub.remove();
      stopSiren();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current  = null;
        loadedRef.current = false;
      }
    };
  }, []);

  return null; // Logic only, no UI
}
