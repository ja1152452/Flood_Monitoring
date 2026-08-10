import { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LEVEL_CONFIG = {
  MONITOR: {
    icon: 'information-circle',
    color: '#f59e0b',
    bg: '#451a03',
    label: 'Monitor Level',
    title: '📢 MDRRMO ADVISORY: Monitor Level Reached',
    action: 'Please stay alert, secure essential belongings, and monitor official MDRRMO announcements.'
  },
  ALERT: {
    icon: 'notifications',
    color: '#f97316',
    bg: '#431407',
    label: 'Alert Level',
    title: '⚠️ MDRRMO WARNING: Alert Level Reached',
    action: 'Please prepare emergency kits, secure family members, and be ready to evacuate if instructed.'
  },
  EVACUATION: {
    icon: 'warning',
    color: '#ef4444',
    bg: '#450a0a',
    label: 'Evacuation Level',
    title: '🚨 MDRRMO EMERGENCY: Mandatory Evacuation Level',
    action: 'MANDATORY EVACUATION: Please evacuate immediately to your designated evacuation center.'
  },
  CRITICAL: {
    icon: 'alert-circle',
    color: '#7c3aed',
    bg: '#2e1065',
    label: 'Critical Level',
    title: '🆘 MDRRMO CRITICAL DANGER: Critical Flood Level',
    action: 'CRITICAL DANGER: Evacuate NOW to high ground or designated centers! Call SOS if trapped.'
  },
};

const formatDateTime = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export function FloodAlertModal({ visible, level, alertData, centers = [], onDismiss }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.MONITOR;

  const predictiveText = alertData?.predictive_text || (
    level === 'CRITICAL'
      ? 'CRITICAL DANGER: Water level has reached Critical Level. Extreme hazard!'
      : `Water level has reached ${cfg.label}. Please stay tuned for live monitoring updates.`
  );

  useEffect(() => {
    if (visible) {
      Vibration.vibrate(1000);
    } else {
      Vibration.cancel();
    }
  }, [visible]);

  if (!visible || !level) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <View style={[styles.screen, { backgroundColor: '#0f172a' }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>

          <View style={[styles.iconRow, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={40} color={cfg.color} />
          </View>

          <View style={[styles.badge, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
          </View>

          <Text style={[styles.title, { color: cfg.color }]}>
            {cfg.title}
          </Text>

          <View style={styles.predictiveBox}>
            <Text style={styles.predictiveHeader}>🔮 REAL-TIME PREDICTIVE FORECAST</Text>
            <Text style={styles.message}>
              "{predictiveText}"
            </Text>
            <Text style={styles.actionText}>
              {cfg.action}
            </Text>
          </View>

          <View style={[styles.centersBox, { borderColor: cfg.color + '44' }]}>
            <Text style={[styles.centersTitle, { color: cfg.color }]}>
              Nearest Open Evacuation Centers:
            </Text>
            {centers.length > 0 ? centers.map((c, i) => (
              <View key={i} style={styles.centerItemContainer}>
                <View style={[styles.bullet, { backgroundColor: cfg.color }]} />
                <Text style={styles.centerItem}>
                  {c.name} <Text style={{ color: '#94a3b8' }}>({c.available_slots} slots)</Text>
                </Text>
              </View>
            )) : (
              <Text style={styles.centerItem}>
                No open evacuation centers nearby.
              </Text>
            )}
          </View>

          <Text style={styles.author}>
            Issued by: MDRRMO Lumban · {formatDateTime(alertData?.created_at || new Date())}
          </Text>

          <TouchableOpacity
            style={[styles.dismissBtn, { backgroundColor: cfg.color }]}
            onPress={onDismiss}
            activeOpacity={0.8}>
            <Text style={styles.dismissText}>I Understand</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow:          1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   60,
  },
  iconRow: {
    width:          80,
    height:         80,
    borderRadius:   40,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   20,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       1,
    marginBottom:      14,
  },
  badgeText: {
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: 1,
  },
  title: {
    fontSize:     20,
    fontWeight:   '900',
    textAlign:    'center',
    marginBottom: 14,
    lineHeight:   26,
  },
  predictiveBox: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    width: '100%',
  },
  predictiveHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  message: {
    fontSize:   13,
    color:      '#f1f5f9',
    textAlign:  'center',
    lineHeight: 20,
    fontStyle:  'italic',
    fontWeight: '600',
    marginBottom: 10,
  },
  actionText: {
    fontSize: 12,
    color: '#fbbf24',
    textAlign: 'center',
    fontWeight: '800',
    lineHeight: 18,
  },
  centersBox: {
    backgroundColor: '#1e293b',
    borderWidth:     1,
    borderRadius:    16,
    padding:         16,
    width:           '100%',
    marginBottom:    20,
  },
  centersTitle: {
    fontSize:     13,
    fontWeight:   '700',
    marginBottom: 10,
  },
  centerItemContainer: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  6,
  },
  bullet: {
    width:        6,
    height:       6,
    borderRadius: 3,
    marginRight:  8,
  },
  centerItem: {
    fontSize: 13,
    color:    '#cbd5e1',
  },
  author: {
    fontSize:     11,
    color:        '#64748b',
    marginBottom: 24,
  },
  dismissBtn: {
    width:          '100%',
    paddingVertical: 16,
    borderRadius:   14,
    alignItems:     'center',
  },
  dismissText: {
    color:         '#ffffff',
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: 0.5,
  },
});
