import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, Image,
} from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getLatestReading, getRateOfRise } from '../../api/readings';
import { getActiveAlerts } from '../../api/alerts';
import { getWeather } from '../../api/weather';
import { getAnnouncements } from '../../api/announcements';
import { useAuthStore } from '../../store/authStore';
import { getFloodConfig, formatWaterLevel, formatTime, MAX_LEVEL } from '../../utils/floodUtils';
import { SirenBanner } from '../../components/SirenBanner';
import { ResponderDashboard, BarangayDashboard } from '../../components/dashboards/ResponderDashboard';

export default function HomeScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE'];
  const isResponder = RESPONDER_ROLES.includes(user?.role);

  const { data: reading, refetch: r1 } = useQuery({
    queryKey: ['latest-reading'], queryFn: getLatestReading, refetchInterval: 2000,
    enabled: !isResponder,
  });
  const { data: alerts = [], refetch: r2 } = useQuery({
    queryKey: ['active-alerts'], queryFn: getActiveAlerts, refetchInterval: 2000,
    enabled: !isResponder,
  });
  const { data: rate } = useQuery({
    queryKey: ['rate-of-rise'], queryFn: getRateOfRise, refetchInterval: 10000,
    enabled: !isResponder,
  });
  const { data: weather } = useQuery({
    queryKey: ['weather'], queryFn: getWeather, refetchInterval: 60000, retry: 1,
    enabled: !isResponder,
  });
  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'], queryFn: getAnnouncements, refetchInterval: 15000,
    enabled: !isResponder,
  });

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  // Responder dashboards
  if (isResponder) {
    if (user?.role === 'BARANGAY_OFFICIAL') {
      return <BarangayDashboard user={user} onLogout={handleLogout} />;
    }
    return <ResponderDashboard user={user} onLogout={handleLogout} />;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([r1(), r2()]);
    setRefreshing(false);
  };

  const level = reading?.flood_level || 'NORMAL';
  const config = getFloodConfig(level);
  const wl = parseFloat(reading?.water_level_m || 0);
  const rateVal = rate?.rate_per_hour || 0;
  const rateTrend = rate?.trend || 'STABLE';
  const rateColor = rateTrend === 'RISING' ? '#ea580c' : rateTrend === 'FALLING' ? '#16a34a' : '#64748b';
  const rateIcon = rateTrend === 'RISING' ? '↑' : rateTrend === 'FALLING' ? '↓' : '→';
  const activeAnnouncements = announcements.filter(a => a.is_active);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 90 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}>

      {/* 1. Header (Hello, User / Location / Sign Out) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0] || 'Jasy'}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#64748b" />
            <Text style={styles.locationText}>Lumban, Laguna</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/(tabs)/alerts')}>
            <Ionicons name="notifications-outline" size={20} color="#0f172a" />
            <View style={styles.bellBadge} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout} style={styles.signOutBtn} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={14} color="#dc2626" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Siren Active Banner */}
      <SirenBanner />

      {/* 2.5 Simulation / Drill Notice */}
      {reading?.is_simulated && (
        <View style={{
          backgroundColor: '#eff6ff',
          borderColor: '#93c5fd',
          borderWidth: 1.5,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 14,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flask" size={18} color="#2563eb" />
            <View>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#1d4ed8' }}>
                SIMULATION / DRILL MODE
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#3b82f6' }}>
                Real-time test overlay from Command Center ({reading?.water_level_m}m)
              </Text>
            </View>
          </View>
          <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#ffffff' }}>TEST</Text>
          </View>
        </View>
      )}

      {/* 3. Current Flood Status Card */}
      <View style={[styles.statusCard, { borderColor: reading?.is_simulated ? '#93c5fd' : '#e2e8f0' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.statusCardHeading}>CURRENT FLOOD STATUS</Text>
          {reading?.is_simulated && (
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563eb' }}>[SIMULATED]</Text>
          )}
        </View>

        <View style={styles.statusLevelRow}>
          <View style={[styles.statusGaugeCircle, { backgroundColor: '#ffedd5' }]}>
            <Ionicons name="speedometer-outline" size={28} color={config.color || '#ea580c'} />
          </View>
          <View style={styles.statusLabelContainer}>
            <View style={[styles.statusDot, { backgroundColor: config.color || '#ea580c' }]} />
            <Text style={[styles.statusLevelTitle, { color: config.color || '#ea580c' }]}>
              {config.label}
            </Text>
          </View>
        </View>

        {/* 3 Column Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{formatWaterLevel(reading?.water_level_m)}</Text>
            <Text style={styles.metricLabel}>Water Level</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Text style={[styles.metricValue, { color: rateColor }]}>
              {rateIcon} {Math.abs(rateVal).toFixed(2)} m/hr
            </Text>
            <Text style={styles.metricLabel}>Rate of Change</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{formatTime(reading?.captured_at)}</Text>
            <Text style={styles.metricLabel}>Last Update</Text>
          </View>
        </View>
      </View>

      {/* 4. Active Alert Card */}
      {alerts.length > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => router.push('/(tabs)/alerts')}
          activeOpacity={0.85}>
          <View style={styles.alertCardIconBox}>
            <Ionicons name="warning" size={22} color="#dc2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertCardTitle}>
              ALERT ACTIVE – {config.label.toUpperCase()}
            </Text>
            <Text style={styles.alertCardSub}>
              Rescue teams have been notified
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#dc2626" />
        </TouchableOpacity>
      )}

      {/* 5. Quick Actions Grid (2x2) */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.actionsGrid}>
          {/* Send SOS */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/sos')}
            activeOpacity={0.85}>
            <View style={[styles.actionIconBox, { backgroundColor: '#dc2626' }]}>
              <Ionicons name="warning" size={22} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionCardTitle, { color: '#dc2626' }]}>Send SOS</Text>
              <Text style={styles.actionCardSub}>Request rescue</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* Evacuation Map */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/map')}
            activeOpacity={0.85}>
            <View style={[styles.actionIconBox, { backgroundColor: '#2563eb' }]}>
              <Ionicons name="map" size={22} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionCardTitle, { color: '#2563eb' }]}>Evacuation Map</Text>
              <Text style={styles.actionCardSub}>Find safe centers</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* Emergency Call */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/contacts')}
            activeOpacity={0.85}>
            <View style={[styles.actionIconBox, { backgroundColor: '#16a34a' }]}>
              <Ionicons name="call" size={22} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionCardTitle, { color: '#16a34a' }]}>Emergency Call</Text>
              <Text style={styles.actionCardSub}>Hotlines</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* Announcements */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/announcements')}
            activeOpacity={0.85}>
            <View style={[styles.actionIconBox, { backgroundColor: '#ea580c' }]}>
              <Ionicons name="megaphone" size={22} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionCardTitle, { color: '#ea580c' }]}>Announcements</Text>
              <Text style={styles.actionCardSub}>MDRRMO updates</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 6. Weather Card ("Weather – Lumban") */}
      {weather && (
        <View style={styles.weatherCard}>
          <View style={styles.weatherCardHeader}>
            <Ionicons name="partly-sunny-outline" size={18} color="#f59e0b" />
            <Text style={styles.weatherTitle}>Weather – Lumban</Text>
          </View>

          <View style={styles.weatherMainRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
              <Text style={styles.weatherDesc}>{weather.description}</Text>
            </View>
            <Ionicons name="rainy-outline" size={44} color="#0284c7" />
          </View>

          {/* Weather Bottom Metrics */}
          <View style={styles.weatherMetricsRow}>
            <View style={styles.weatherMetricItem}>
              <Ionicons name="water-outline" size={18} color="#2563eb" />
              <Text style={styles.weatherMetricValue}>{weather.humidity}%</Text>
              <Text style={styles.weatherMetricLabel}>Humidity</Text>
            </View>

            <View style={styles.weatherMetricItem}>
              <Ionicons name="rainy-outline" size={18} color="#2563eb" />
              <Text style={styles.weatherMetricValue}>{weather.rain}mm</Text>
              <Text style={styles.weatherMetricLabel}>Rainfall</Text>
            </View>

            <View style={styles.weatherMetricItem}>
              <Ionicons name="speedometer-outline" size={18} color="#2563eb" />
              <Text style={styles.weatherMetricValue}>{weather.wind}kph</Text>
              <Text style={styles.weatherMetricLabel}>Wind Speed</Text>
            </View>
          </View>
        </View>
      )}

      {/* Announcements */}
      {activeAnnouncements.length > 0 && (
        <View style={styles.announcementsSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ionicons name="megaphone-outline" size={16} color="#ea580c" />
            <Text style={styles.sectionTitle}>MDRRMO Advisory</Text>
          </View>
          {activeAnnouncements.slice(0, 2).map(a => (
            <View key={a.id} style={styles.announcementItem}>
              <Text style={styles.announcementTitle}>{a.title}</Text>
              <Text style={styles.announcementMsg} numberOfLines={2}>{a.message}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  signOutText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },

  /* Flood Status Card */
  statusCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statusCardHeading: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 12 },
  statusLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  statusGaugeCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLevelTitle: { fontSize: 24, fontWeight: '800' },

  /* Metrics 3 Columns */
  metricsGrid: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  metricCol: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  metricLabel: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  metricDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },

  /* Active Alert Card */
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#fff1f2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 14,
  },
  alertCardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCardTitle: { fontSize: 13, fontWeight: '800', color: '#991b1b' },
  alertCardSub: { fontSize: 11, color: '#e11d48', marginTop: 2 },

  /* Quick Actions Grid */
  actionsSection: { marginHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  actionCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionCardTitle: { fontSize: 13, fontWeight: '800' },
  actionCardSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  /* Weather Card */
  weatherCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  weatherCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  weatherTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  weatherMainRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  weatherTemp: { fontSize: 34, fontWeight: '800', color: '#0f172a' },
  weatherDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  weatherMetricsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  weatherMetricItem: { alignItems: 'center' },
  weatherMetricValue: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  weatherMetricLabel: { fontSize: 10, color: '#94a3b8', marginTop: 1 },

  /* Announcements */
  announcementsSection: { marginHorizontal: 20, marginBottom: 14 },
  announcementItem: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 8 },
  announcementTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  announcementMsg: { fontSize: 12, color: '#64748b', lineHeight: 18 },
});
