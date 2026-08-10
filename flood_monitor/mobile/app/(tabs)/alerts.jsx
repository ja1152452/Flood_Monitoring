import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getActiveAlerts } from '../../api/alerts';
import { getFloodConfig, formatDateTime } from '../../utils/floodUtils';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SirenBanner } from '../../components/SirenBanner';

export default function AlertsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: alerts = [], refetch } = useQuery({
    queryKey: ['active-alerts'],
    queryFn: getActiveAlerts,
    refetchInterval: 15000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      {/* 1. Curved Red Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Flood Alerts</Text>
            <Text style={styles.headerSub}>{alerts.length} active</Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
              <Ionicons name="funnel-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
              <Ionicons name="ellipsis-vertical" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}>

        <SirenBanner />

        {/* 2. Content Card State */}
        {alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            {/* Outer Green Glow Circle */}
            <View style={styles.greenGlowCircle}>
              {/* Green Rounded Checkmark Box */}
              <View style={styles.greenCheckSquare}>
                <Ionicons name="checkmark-sharp" size={28} color="#ffffff" />
              </View>
            </View>

            <Text style={styles.emptyTitle}>No Active Alerts</Text>
            <Text style={styles.emptySub}>River conditions are currently normal</Text>

            {/* Bottom Hill Landscape Decoration */}
            <View style={styles.landscapeDecoration}>
              <View style={styles.hillBase} />
            </View>
          </View>
        ) : (
          alerts.map(alert => {
            const config = getFloodConfig(alert.flood_level);
            return (
              <View key={alert.id} style={[styles.alertCard, { borderColor: config.color }]}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertEmoji}>{config.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertLevel, { color: config.color }]}>
                      {config.label}
                    </Text>
                    <Text style={styles.alertLocation}>{alert.location_name}</Text>
                  </View>
                  {alert.siren_active && (
                    <View style={styles.sirenBadge}>
                      <Ionicons name="volume-high" size={12} color="#dc2626" />
                      <Text style={styles.sirenBadgeText}>SIREN</Text>
                    </View>
                  )}
                </View>
                <View style={styles.alertMeta}>
                  <Text style={styles.alertMetaText}>
                    📍 {alert.barangay_name} · {alert.risk_level} Risk Zone
                  </Text>
                  <Text style={styles.alertMetaText}>
                    🕒 {formatDateTime(alert.triggered_at)}
                  </Text>
                </View>
                <View style={[styles.messageBubble, { backgroundColor: config.bg }]}>
                  <Text style={[styles.messageText, { color: config.color }]}>
                    Water Level Alert: The river water level has reached the {alert.flood_level} threshold. Please remain vigilant and follow MDRRMO advisories.
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },

  /* Curved Red Header */
  header: {
    backgroundColor: '#dc2626',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  headerTitleBox: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  headerSub: { fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', marginTop: 1 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  bodyScroll: { flex: 1, paddingTop: 16 },

  /* No Active Alerts Card */
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingTop: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  greenGlowCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  greenCheckSquare: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 32 },

  landscapeDecoration: {
    width: '120%',
    height: 40,
    backgroundColor: '#f0fdf4',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    marginTop: 10,
  },
  hillBase: { flex: 1 },

  /* Active Alert Cards */
  alertCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  alertEmoji: { fontSize: 26 },
  alertLevel: { fontSize: 17, fontWeight: '800' },
  alertLocation: { fontSize: 12, color: '#64748b', marginTop: 1 },
  sirenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  sirenBadgeText: { fontSize: 10, color: '#dc2626', fontWeight: '800' },
  alertMeta: { gap: 3, marginBottom: 10 },
  alertMetaText: { fontSize: 12, color: '#64748b' },
  messageBubble: { borderRadius: 12, padding: 12 },
  messageText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
});