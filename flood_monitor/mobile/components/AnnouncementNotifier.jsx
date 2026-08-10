import { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Vibration, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getAnnouncements } from '../api/announcements';
import { sendLocalNotification } from '../utils/notifications';
import { Ionicons } from '@expo/vector-icons';

const TYPE_CONFIG = {
  FLOOD_WARNING:    { icon: 'warning',          color: '#f97316', bg: '#431407', label: 'Flood Warning'    },
  EVACUATION_ORDER: { icon: 'alert-circle',     color: '#ef4444', bg: '#450a0a', label: 'Evacuation Order' },
  ALL_CLEAR:        { icon: 'checkmark-circle', color: '#22c55e', bg: '#052e16', label: 'All Clear'         },
  GENERAL:          { icon: 'megaphone',        color: '#3b82f6', bg: '#1e3a5f', label: 'General'           },
};

export function AnnouncementNotifier() {
  const seenIds           = useRef(null);
  const [queue,   setQueue]   = useState([]);
  const [current, setCurrent] = useState(null);

  const { data: announcements = [] } = useQuery({
    queryKey:        ['announcements'],
    queryFn:         getAnnouncements,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!announcements.length) return;
    const currentIds = new Set(announcements.map(a => a.id));
    if (seenIds.current === null) { seenIds.current = currentIds; return; }
    const newOnes = announcements.filter(a => !seenIds.current.has(a.id));
    if (newOnes.length) {
      setQueue(q => [...q, ...newOnes]);
      newOnes.forEach(a => {
        const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.GENERAL;
        sendLocalNotification(a.title, a.message);
      });
    }
    seenIds.current = currentIds;
  }, [announcements]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrent(next);
      setQueue(rest);
    }
  }, [queue, current]);

  useEffect(() => {
    if (current) {
      Vibration.vibrate(500);
    } else {
      Vibration.cancel();
    }
  }, [current]);

  const dismiss = () => {
    Vibration.cancel();
    setCurrent(null);
  };

  if (!current) return null;

  const cfg = TYPE_CONFIG[current.type] || TYPE_CONFIG.GENERAL;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: '#0f172a' }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            <View style={[styles.iconRow, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={40} color={cfg.color} />
            </View>

            <View style={[styles.badge, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
              <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
            </View>

            <Text style={[styles.title, { color: cfg.color }]}>{current.title}</Text>

            <Text style={styles.message}>{current.message}</Text>

            <Text style={styles.author}>
              Issued by: {current.created_by_name || 'MDRRMO Lumban'}
            </Text>

            <Text style={styles.datetime}>
              {new Date(current.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              {'  '}
              {new Date(current.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>

            <TouchableOpacity
              style={[styles.dismissBtn, { backgroundColor: cfg.color }]}
              onPress={dismiss}
              activeOpacity={0.8}>
              <Text style={styles.dismissText}>I Understand</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         24,
  },
  card: {
    width:        '100%',
    maxHeight:    '85%',
    borderRadius: 24,
    padding:      24,
  },
  scrollContent: {
    flexGrow:          1,
    justifyContent:    'center',
    alignItems:        'center',
    gap:               16,
  },
  iconRow: {
    width:          90,
    height:         90,
    borderRadius:   45,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   8,
  },
  badge: {
    borderWidth:       1,
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   6,
  },
  badgeText:   { fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  title:       { fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  message:     { fontSize: 16, color: '#e2e8f0', textAlign: 'center', lineHeight: 24, paddingHorizontal: 10 },
  author:      { fontSize: 13, color: '#94a3b8', marginTop: 10 },
  datetime:    { fontSize: 13, color: '#64748b', marginTop: -12, fontWeight: '500' },
  dismissBtn: {
    width:           '100%',
    paddingVertical: 16,
    borderRadius:    14,
    alignItems:      'center',
    marginTop:       20,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.3,
    shadowRadius:    6,
    elevation:       8,
  },
  dismissText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
});
