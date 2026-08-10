import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl,
} from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnnouncements } from '../../api/announcements';
import { formatDateTime } from '../../utils/floodUtils';
import { Ionicons } from '@expo/vector-icons';
import { SirenBanner } from '../../components/SirenBanner';

const TYPE_CONFIG = {
  EVACUATION_ORDER: {
    color: '#dc2626',
    bg: '#fff1f2',
    border: '#fca5a5',
    badgeBg: '#ffe4e6',
    badgeText: '#e11d48',
    icon: 'megaphone',
    label: 'Evacuation Order',
  },
  FLOOD_WARNING: {
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    badgeBg: '#ffedd5',
    badgeText: '#ea580c',
    icon: 'warning',
    label: 'Flood Warning',
  },
  ALL_CLEAR: {
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    badgeBg: '#dcfce7',
    badgeText: '#16a34a',
    icon: 'checkmark-circle',
    label: 'All Clear',
  },
  GENERAL: {
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    badgeBg: '#dbeafe',
    badgeText: '#2563eb',
    icon: 'notifications',
    label: 'General Announcement',
  },
};

export default function AnnouncementsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: announcements = [], refetch } = useQuery({
    queryKey: ['announcements'],
    queryFn: getAnnouncements,
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
      <View style={styles.redHeader}>
        <Text style={styles.redHeaderTitle}>Announcements</Text>
        <Text style={styles.redHeaderSub}>Official messages from MDRRMO Lumban</Text>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }>

        <SirenBanner />

        {announcements.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="notifications-off-outline" size={32} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No Announcements</Text>
            <Text style={styles.emptySub}>
              Official MDRRMO announcements will appear here. Pull down to refresh.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {announcements.map(a => {
              const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.GENERAL;

              return (
                <View
                  key={a.id}
                  style={[styles.announcementCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>

                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.iconCol}>
                      {a.type === 'EVACUATION_ORDER' ? (
                        <Text style={{ fontSize: 26 }}>🚨</Text>
                      ) : (
                        <Ionicons name={cfg.icon} size={28} color={cfg.color} />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: cfg.color }]}>
                        {a.title}
                      </Text>

                      <View style={[styles.badgePill, { backgroundColor: cfg.badgeBg }]}>
                        <Text style={[styles.badgeText, { color: cfg.badgeText }]}>
                          {cfg.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Message Body */}
                  <Text style={styles.cardMessage}>{a.message}</Text>

                  {/* Card Footer */}
                  <View style={[styles.cardFooter, { borderTopColor: cfg.border }]}>
                    <View style={styles.footerCol}>
                      <Ionicons name="person-circle" size={16} color={cfg.color} />
                      <Text style={styles.footerText}>
                        {a.created_by_name || 'MDRRMO Officer'}
                      </Text>
                    </View>

                    <View style={styles.footerCol}>
                      <Ionicons name="time-outline" size={14} color={cfg.color} />
                      <Text style={styles.footerText}>
                        {formatDateTime(a.created_at)}
                      </Text>
                    </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },

  /* Curved Red Header */
  redHeader: {
    backgroundColor: '#dc2626',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 50,
    paddingBottom: 22,
    paddingHorizontal: 20,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  redHeaderTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  redHeaderSub: { fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 },

  bodyScroll: { flex: 1, paddingTop: 16 },

  listContainer: { paddingHorizontal: 20, gap: 14 },

  emptyCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  /* Announcement Card Styling */
  announcementCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconCol: { marginTop: 2 },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6, lineHeight: 22 },
  badgePill: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  cardMessage: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 14 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  footerCol: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 11, color: '#475569', fontWeight: '600' },
});