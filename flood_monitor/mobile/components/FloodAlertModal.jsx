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
  const normLevel = (level || '').toUpperCase();
  const cfg = LEVEL_CONFIG[normLevel] || LEVEL_CONFIG.MONITOR;
  const isManual = alertData?.trigger_type === 'MANUAL';

  const displayTitle = isManual
    ? '🚨 MDRRMO MANUAL EMERGENCY ALARM TRIGGERED'
    : cfg.title;

  const rawPredictive = isManual
    ? 'AN EMERGENCY SIREN ALARM HAS BEEN MANUALLY TRIGGERED BY MDRRMO. ALL CITIZENS AND RESPONDERS PLEASE PROCEED TO DESIGNATED HIGH GROUND OR EVACUATION CENTERS IMMEDIATELY.'
    : (alertData?.predictive_text || (
        level === 'CRITICAL'
          ? 'CRITICAL DANGER: Water level has reached Critical Level. Extreme hazard!'
          : `Water level has reached ${cfg.label}. Please stay tuned for live monitoring updates.`
      ));

  const predictiveText = typeof rawPredictive === 'string'
    ? rawPredictive.replace(/\s*\((?:Forecast\s+)?(?:Reliability|Confidence)[^)]*\)/gi, '').trim()
    : rawPredictive;

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
            <Text style={[styles.badgeText, { color: cfg.color }]}>
              {alertData?.current_water_level_m ? `${alertData.current_water_level_m}m · ` : ''}{cfg.label.toUpperCase()}
            </Text>
          </View>

          <Text style={[styles.title, { color: cfg.color }]}>
            {displayTitle}
          </Text>

          {/* 1. Quick Glance: 1h & 3h Future Estimates */}
          {(alertData?.predicted_level_1h != null || alertData?.predicted_level_3h != null) && (
            <View style={styles.projectionsCard}>
              <View style={styles.projectionItem}>
                <Text style={styles.projectionLabel}>Expected in 1 Hour</Text>
                <Text style={[styles.projectionValue, { color: cfg.color }]}>
                  {alertData.predicted_level_1h ? `${alertData.predicted_level_1h.toFixed(2)}m` : '--'}
                </Text>
              </View>
              <View style={styles.projectionDivider} />
              <View style={styles.projectionItem}>
                <Text style={styles.projectionLabel}>Expected in 3 Hours</Text>
                <Text style={[styles.projectionValue, { color: cfg.color }]}>
                  {alertData.predicted_level_3h ? `${alertData.predicted_level_3h.toFixed(2)}m` : '--'}
                </Text>
              </View>
            </View>
          )}

          {/* 2. Plain English Forecast Advisory */}
          <View style={styles.predictiveBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="sparkles" size={16} color="#38bdf8" />
              <Text style={styles.predictiveHeader}>FLOOD EARLY WARNING ADVISORY</Text>
            </View>
            <Text style={styles.message}>
              {predictiveText}
            </Text>
          </View>

          {/* 3. Plain Safety Instructions */}
          <View style={styles.actionBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="shield-checkmark" size={16} color="#fbbf24" />
              <Text style={styles.actionHeader}>WHAT YOU SHOULD DO NOW:</Text>
            </View>
            <Text style={styles.actionText}>
              {cfg.action}
            </Text>
          </View>

          {/* 4. Evacuation Centers */}
          <View style={[styles.centersBox, { borderColor: cfg.color + '44' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="home" size={16} color={cfg.color} />
              <Text style={[styles.centersTitle, { color: cfg.color }]}>
                Nearest Safe Evacuation Centers:
              </Text>
            </View>
            {centers.length > 0 ? centers.map((c, i) => (
              <View key={i} style={styles.centerItemContainer}>
                <View style={[styles.bullet, { backgroundColor: cfg.color }]} />
                <Text style={styles.centerItem}>
                  {c.name} <Text style={{ color: '#4ade80', fontWeight: '700' }}>({c.available_slots} slots available)</Text>
                </Text>
              </View>
            )) : (
              <Text style={styles.centerItem}>
                Stay tuned for designated evacuation points from your Barangay.
              </Text>
            )}
          </View>

          <Text style={styles.author}>
            Official Advisory · Municipal Disaster Risk Reduction & Management Office
          </Text>

          <TouchableOpacity
            style={[styles.dismissBtn, { backgroundColor: cfg.color }]}
            onPress={onDismiss}
            activeOpacity={0.8}>
            <Text style={styles.dismissText}>I Understand & Will Stay Alert</Text>
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
    paddingHorizontal: 20,
    paddingVertical:   50,
  },
  iconRow: {
    width:           76,
    height:          76,
    borderRadius:    38,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  badge: {
    borderWidth:       1.5,
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   5,
    marginBottom:      10,
  },
  badgeText: {
    fontSize:      12,
    fontWeight:    '900',
    letterSpacing: 0.5,
  },
  title: {
    fontSize:     20,
    fontWeight:   '900',
    textAlign:    'center',
    marginBottom: 14,
    lineHeight:   26,
  },
  projectionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 14,
  },
  projectionItem: {
    flex: 1,
    alignItems: 'center',
  },
  projectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 3,
  },
  projectionValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  projectionDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#334155',
  },
  predictiveBox: {
    backgroundColor: '#1e293b',
    borderColor: '#38bdf844',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    width: '100%',
  },
  predictiveHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  message: {
    fontSize:   13,
    color:      '#f8fafc',
    lineHeight: 20,
    fontWeight: '600',
  },
  actionBox: {
    backgroundColor: '#1e293b',
    borderColor: '#fbbf2444',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    width: '100%',
  },
  actionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 0.5,
  },
  actionText: {
    fontSize: 13,
    color: '#fef3c7',
    fontWeight: '700',
    lineHeight: 19,
  },
  centersBox: {
    backgroundColor: '#1e293b',
    borderWidth:     1,
    borderRadius:    16,
    padding:         16,
    width:           '100%',
    marginBottom:    16,
  },
  centersTitle: {
    fontSize:     12,
    fontWeight:   '800',
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
    marginBottom: 20,
    textAlign:    'center',
  },
  dismissBtn: {
    width:          '100%',
    paddingVertical: 16,
    borderRadius:   14,
    alignItems:     'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.2,
    shadowRadius:   4,
    elevation:      3,
  },
  dismissText: {
    color:         '#ffffff',
    fontSize:      15,
    fontWeight:    '900',
    letterSpacing: 0.5,
  },
});
