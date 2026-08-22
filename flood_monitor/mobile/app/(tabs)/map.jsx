import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { getEvacuationCenters } from '../../api/evacuation';
import { getRiskAreas } from '../../api/risk';
import { FloodRiskMap, EvacuationMap } from '../../components/FloodMap';
import { Ionicons } from '@expo/vector-icons';
import { SirenBanner } from '../../components/SirenBanner';

const TABS = ['Risk Map', 'Evacuation'];

const RISK_CFG = {
  VERY_HIGH: { color: '#dc2626', bg: '#fff1f2', border: '#fca5a5', label: 'Very High Risk' },
  HIGH:      { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'High Risk' },
  MODERATE:  { color: '#d97706', bg: '#fefce8', border: '#fef08a', label: 'Moderate Risk' },
  LOW:       { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Low Risk' },
};

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function openDirections(uLat, uLng, dLat, dLng) {
  const url = Platform.OS === 'ios'
    ? `maps://app?saddr=${uLat},${uLng}&daddr=${dLat},${dLng}`
    : `google.navigation:q=${dLat},${dLng}&mode=d`;
  Linking.canOpenURL(url).then(ok =>
    Linking.openURL(ok ? url : `https://www.google.com/maps/dir/?api=1&origin=${uLat},${uLng}&destination=${dLat},${dLng}&travelmode=driving`)
  );
}

export default function MapScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [userLocation, setUserLocation] = useState(null);

  const { data: centers = [] } = useQuery({ queryKey: ['evacuation'], queryFn: getEvacuationCenters, refetchInterval: 5000 });
  const { data: riskAreas = [] } = useQuery({ queryKey: ['risk-areas'], queryFn: getRiskAreas, refetchInterval: 5000 });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const nearestCenter = userLocation && centers.length > 0
    ? centers.reduce((n, c) => {
      const d = getDistance(userLocation.lat, userLocation.lng, c.lat, c.lng);
      return d < n.dist ? { ...c, dist: d } : n;
    }, { ...centers[0], dist: getDistance(userLocation.lat, userLocation.lng, centers[0].lat, centers[0].lng) })
    : null;

  // Group risk areas by level for legend cards
  const grouped = riskAreas.reduce((acc, a) => {
    if (!acc[a.risk_level]) acc[a.risk_level] = [];
    acc[a.risk_level].push(a);
    return acc;
  }, {});

  const totalCapacity  = centers.reduce((s, c) => s + c.capacity_total, 0);
  const totalOccupied  = centers.reduce((s, c) => s + c.capacity_current, 0);
  const openCentersCnt = centers.filter(c => c.is_open).length;

  return (
    <View style={s.container}>
      {/* 1. Curved Red Header (Images 1 & 2) */}
      <View style={s.redHeader}>
        <View style={s.headerRow}>
          <View style={s.headerTitleBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="water-sharp" size={24} color="#ffffff" />
              <Text style={s.headerTitle}>{activeTab === 0 ? 'Risk Map' : 'Evacuation Map'}</Text>
            </View>
            <Text style={s.headerSub}>Lumban, Laguna – Real-time Monitoring</Text>
          </View>

          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>
      </View>

      {/* 2. Segmented Mode Toggle (Images 1 & 2) */}
      <View style={s.segmentedControlWrap}>
        <View style={s.segmentedControl}>
          <TouchableOpacity
            style={[s.segmentBtn, activeTab === 0 && s.segmentBtnActive]}
            onPress={() => setActiveTab(0)}
            activeOpacity={0.8}>
            <Ionicons name="shield-checkmark" size={16} color={activeTab === 0 ? '#ffffff' : '#475569'} />
            <Text style={[s.segmentText, activeTab === 0 && s.segmentTextActive]}>
              Risk Map
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.segmentBtn, activeTab === 1 && s.segmentBtnActive]}
            onPress={() => setActiveTab(1)}
            activeOpacity={0.8}>
            <Ionicons name="home" size={16} color={activeTab === 1 ? '#ffffff' : '#475569'} />
            <Text style={[s.segmentText, activeTab === 1 && s.segmentTextActive]}>
              Evacuation
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
        <SirenBanner />

        {/* ================= TAB 1: RISK MAP VIEW (Image 1) ================= */}
        {activeTab === 0 && (
          <View style={s.tabContent}>
            {/* Map Canvas Box */}
            <View style={s.mapCard}>
              <View style={s.mapHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="warning" size={16} color="#dc2626" />
                  <Text style={s.mapHeaderTitle}>Flood Risk Zone Map</Text>
                </View>
                <Text style={s.mapHeaderSub}>Tap zone or ⛯ layer for Satellite/Topo</Text>
              </View>
              <FloodRiskMap height={320} areas={riskAreas} userLocation={userLocation} />
            </View>

            {/* Risk Classifications Legend Cards */}
            <Text style={s.sectionLabel}>RISK CLASSIFICATIONS</Text>

            {['VERY_HIGH', 'HIGH', 'MODERATE', 'LOW'].map(level => {
              const cfg = RISK_CFG[level];
              const count = (grouped[level] || []).length;
              if (!count) return null;

              return (
                <View key={level} style={[s.riskClassificationCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                  <View style={[s.riskDot, { backgroundColor: cfg.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.riskClassificationLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    <Text style={s.riskAreasText} numberOfLines={2}>
                      {(grouped[level] || []).map(a => a.name.replace(/\s*\(.*?\)/g, '')).join(' · ')}
                    </Text>
                  </View>

                  <View style={s.riskCountCol}>
                    <View style={[s.countBadgeCircle, { borderColor: cfg.color }]}>
                      <Text style={[s.countBadgeText, { color: cfg.color }]}>{count}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ================= TAB 2: EVACUATION MAP VIEW (Image 2) ================= */}
        {activeTab === 1 && (
          <View style={s.tabContent}>
            {/* Map Canvas Box */}
            <View style={s.mapCard}>
              <View style={s.mapHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="home" size={16} color="#dc2626" />
                  <Text style={s.mapHeaderTitle}>Evacuation Centers</Text>
                </View>
                <Text style={s.mapHeaderSub}>
                  {openCentersCnt} open · Tap ⛯ layer for Satellite/Topo
                </Text>
              </View>
              <EvacuationMap centers={centers} height={280} userLocation={userLocation} />
            </View>

            {/* Nearest Center Red Banner (Image 2) */}
            {nearestCenter && userLocation && (
              <View style={s.nearestRedCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nearestHeaderLabel}>📍 Nearest Center</Text>
                  <Text style={s.nearestCenterName}>{nearestCenter.name}</Text>
                  <Text style={s.nearestCenterSub}>{(nearestCenter.dist / 1000).toFixed(2)} km • {nearestCenter.barangay_name || 'Lumban'}</Text>
                </View>

                <TouchableOpacity
                  style={s.whiteGoBtn}
                  onPress={() => openDirections(userLocation.lat, userLocation.lng, nearestCenter.lat, nearestCenter.lng)}
                  activeOpacity={0.85}>
                  <Ionicons name="navigate" size={14} color="#dc2626" />
                  <Text style={s.whiteGoBtnText}>Go</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 3 Summary Stats Cards for Nearest Evacuation Center */}
            {(() => {
              const target = nearestCenter || centers[0];
              const targetCapacity = target ? target.capacity_total : 0;
              const targetAvailable = target ? Math.max(0, target.capacity_total - target.capacity_current) : 0;
              const targetIsOpenVal = target ? (target.is_open ? '1' : '0') : '0';

              return (
                <View style={s.evacStatsRow}>
                  <View style={s.evacStatCard}>
                    <Ionicons name="home" size={20} color={target?.is_open ? "#16a34a" : "#dc2626"} />
                    <Text style={[s.evacStatValue, { color: target?.is_open ? "#16a34a" : "#dc2626" }]}>
                      {targetIsOpenVal}
                    </Text>
                    <Text style={s.evacStatLabel}>Open</Text>
                  </View>

                  <View style={s.evacStatCard}>
                    <Ionicons name="people" size={20} color="#2563eb" />
                    <Text style={[s.evacStatValue, { color: '#2563eb' }]}>{targetCapacity}</Text>
                    <Text style={s.evacStatLabel}>Capacity</Text>
                  </View>

                  <View style={s.evacStatCard}>
                    <Ionicons name="people" size={20} color="#7e22ce" />
                    <Text style={[s.evacStatValue, { color: '#7e22ce' }]}>{targetAvailable}</Text>
                    <Text style={s.evacStatLabel}>Available</Text>
                  </View>
                </View>
              );
            })()}

            {/* Evacuation Centers List Cards (Image 2) */}
            {centers.map(center => {
              const pct = center.capacity_total > 0
                ? Math.round((center.capacity_current / center.capacity_total) * 100) : 0;

              return (
                <View key={center.id} style={s.centerCard}>
                  <View style={s.centerCardHeader}>
                    <Text style={s.centerCardTitle}>{center.name}</Text>
                    <View style={[
                      s.openBadgePill,
                      center.is_open ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#f1f5f9' },
                    ]}>
                      <Text style={[
                        s.openBadgeText,
                        center.is_open ? { color: '#16a34a' } : { color: '#64748b' },
                      ]}>
                        {center.is_open ? '✓ OPEN' : 'CLOSED'}
                      </Text>
                    </View>
                  </View>

                  <View style={s.centerDetailsCol}>
                    <Text style={s.centerDetailLine}>📍 {center.barangay_name || center.address || 'Lumban'}</Text>
                    <Text style={s.centerDetailLine}>👥 {center.capacity_current}/{center.capacity_total} ({pct}%)</Text>
                    {center.contact_person && <Text style={s.centerDetailLine}>👤 {center.contact_person}</Text>}
                  </View>

                  {/* 2-Column Action Bar */}
                  <View style={s.centerActionBar}>
                    <TouchableOpacity
                      style={s.actionColBtn}
                      onPress={() => center.contact_number && Linking.openURL(`tel:${center.contact_number}`)}
                      activeOpacity={0.7}>
                      <Ionicons name="call" size={16} color="#dc2626" />
                      <Text style={s.actionColText}>Call</Text>
                    </TouchableOpacity>

                    <View style={s.actionColDivider} />

                    <TouchableOpacity
                      style={s.actionColBtn}
                      onPress={() => userLocation && openDirections(userLocation.lat, userLocation.lng, center.lat, center.lng)}
                      activeOpacity={0.7}>
                      <Ionicons name="navigate" size={16} color="#dc2626" />
                      <Text style={s.actionColText}>Directions</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  /* Curved Red Header */
  redHeader: {
    backgroundColor: '#dc2626',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleBox: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  headerSub: { fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ffffff' },
  liveText: { fontSize: 11, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },

  /* Segmented Control Mode Toggle (Images 1 & 2) */
  segmentedControlWrap: { marginTop: -14, marginHorizontal: 20, zIndex: 10 },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
  },
  segmentBtnActive: { backgroundColor: '#dc2626' },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  segmentTextActive: { color: '#ffffff' },

  scroll: { flex: 1, paddingTop: 16 },
  tabContent: { marginHorizontal: 20 },

  /* Map Canvas Box */
  mapCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  mapHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  mapHeaderTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  mapHeaderSub: { fontSize: 11, color: '#94a3b8' },

  /* Risk Classifications Legend Cards (Image 1) */
  sectionLabel: { marginBottom: 10, fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.8 },
  riskClassificationCard: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riskDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  riskClassificationLabel: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  riskAreasText: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  riskCountCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  countBadgeText: { fontSize: 12, fontWeight: '800' },

  /* Evacuation Tab Components (Image 2) */
  nearestRedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#dc2626',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nearestHeaderLabel: { fontSize: 11, color: 'rgba(255, 255, 255, 0.85)', fontWeight: '700', marginBottom: 2 },
  nearestCenterName: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  nearestCenterSub: { fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 },
  whiteGoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  whiteGoBtnText: { color: '#dc2626', fontWeight: '800', fontSize: 13 },

  /* 3 Summary Stats Bar (Image 2) */
  evacStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  evacStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  evacStatValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  evacStatLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600' },

  /* Evacuation Center Cards (Image 2) */
  centerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  centerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  centerCardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', flex: 1, marginRight: 8 },
  openBadgePill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  openBadgeText: { fontSize: 11, fontWeight: '800' },
  centerDetailsCol: { paddingHorizontal: 16, paddingBottom: 14, gap: 4 },
  centerDetailLine: { fontSize: 12, color: '#64748b' },
  centerActionBar: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionColBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  actionColText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },
  actionColDivider: { width: 1, height: 24, backgroundColor: '#f1f5f9' },
});
