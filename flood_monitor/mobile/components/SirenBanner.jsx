import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { getActiveAlerts } from '../api/alerts';
import { Ionicons } from '@expo/vector-icons';

const SIREN_CONFIG = {
  MONITOR:    { label: 'MONITOR LEVEL',    color: '#ffffff', bg: '#dc2626' },
  ALERT:      { label: 'ALERT LEVEL',      color: '#ffffff', bg: '#dc2626' },
  EVACUATION: { label: 'EVACUATION LEVEL', color: '#ffffff', bg: '#b91c1c' },
  CRITICAL:   { label: 'CRITICAL LEVEL',   color: '#ffffff', bg: '#991b1b' },
};

const SIREN_LEVELS = ['MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL'];

export function SirenBanner() {
  const { sirenMuted, toggleSirenMute } = useAuthStore();

  const { data: alerts = [] } = useQuery({
    queryKey:       ['active-alerts'],
    queryFn:        getActiveAlerts,
    refetchInterval: 1000,
  });

  const activeLevel = alerts[0]?.flood_level;
  const isActive    = SIREN_LEVELS.includes(activeLevel);

  if (!isActive) return null;

  const cfg = SIREN_CONFIG[activeLevel] || SIREN_CONFIG.MONITOR;

  return (
    <View style={[styles.banner, { backgroundColor: cfg.bg }]}>
      <View style={styles.left}>
        <View style={styles.iconBox}>
          <Ionicons name="notifications-circle" size={24} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.level}>
            SIREN ACTIVE – {cfg.label}
          </Text>
          <Text style={styles.sub}>
            {sirenMuted
              ? 'Sound is muted – alerts still dispatched'
              : 'Audio alarm is sounding on all devices'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.muteBtn}
        onPress={toggleSirenMute}
        activeOpacity={0.8}>
        <Ionicons name={sirenMuted ? 'volume-mute-outline' : 'volume-high-outline'} size={14} color="#ffffff" />
        <Text style={styles.muteBtnText}>
          {sirenMuted ? 'Unmute' : 'Mute'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  level: { fontSize: 13, fontWeight: '800', color: '#ffffff', letterSpacing: 0.2 },
  sub: { fontSize: 11, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 },
  muteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'transparent',
  },
  muteBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
});