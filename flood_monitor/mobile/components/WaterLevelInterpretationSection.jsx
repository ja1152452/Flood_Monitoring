import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MDRRMO_THRESHOLDS = [
  { level: 'NORMAL',     range: '< 3.1 m',      label: 'Normal',     color: '#16a34a' },
  { level: 'MONITOR',    range: '3.1 – 3.9 m',  label: 'Monitor',    color: '#d97706' },
  { level: 'ALERT',      range: '4.0 – 4.9 m',  label: 'Alert',      color: '#ea580c' },
  { level: 'EVACUATION', range: '5.0 – 5.9 m',  label: 'Evacuation', color: '#dc2626' },
  { level: 'CRITICAL',   range: '≥ 6.0 m',      label: 'Critical',   color: '#7c3aed' },
];

export function WaterLevelInterpretationSection({ trendData }) {
  if (!trendData) return null;

  const rawTrend = trendData.trend || 'STABLE';
  const trend = rawTrend === 'FALLING' ? 'RECEDING' : rawTrend;
  const deltaM = trendData.delta_m ?? 0;
  const deltaCm = trendData.delta_cm ?? Math.round(Math.abs(deltaM) * 100);
  const timeIntervalText = trendData.time_interval_text || '10 minutes';
  const rateText = trendData.rate_text || `${(trendData.rate_per_hour || 0).toFixed(2)} m/hr`;
  const currentLevelM = trendData.current_level_m ?? trendData.latest_m ?? 0;
  const floodLevel = trendData.flood_level || 'NORMAL';
  const floodLabel = trendData.flood_level_label || 'Normal Level';

  const trendColor = trend === 'RISING' ? '#dc2626' : trend === 'RECEDING' ? '#16a34a' : '#64748b';
  const trendBg = trend === 'RISING' ? '#fef2f2' : trend === 'RECEDING' ? '#f0fdf4' : '#f8fafc';
  const trendIcon = trend === 'RISING' ? 'trending-up' : trend === 'RECEDING' ? 'trending-down' : 'remove';
  const deltaSign = trend === 'RISING' ? '+' : trend === 'RECEDING' ? '-' : '';
  const actionWord = trend === 'RISING' ? 'Increased' : trend === 'RECEDING' ? 'Decreased' : 'Stable';

  const interpretation = trendData.interpretation || (
    trend === 'RISING'
      ? `Water level increased by ${deltaCm} cm within ${timeIntervalText} and is currently at ${floodLabel} (${currentLevelM.toFixed(2)} m).`
      : trend === 'RECEDING'
      ? `Water level decreased by ${deltaCm} cm within ${timeIntervalText} and is currently at ${floodLabel} (${currentLevelM.toFixed(2)} m).`
      : `Water level remained stable within ${timeIntervalText} and is currently at ${floodLabel} (${currentLevelM.toFixed(2)} m).`
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="analytics" size={16} color="#0284c7" />
          <Text style={styles.cardTitle}>Water-Level Change Interpretation</Text>
        </View>
        <View style={[styles.trendPill, { backgroundColor: trendBg, borderColor: trendColor }]}>
          <Ionicons name={trendIcon} size={12} color={trendColor} />
          <Text style={[styles.trendPillText, { color: trendColor }]}>{trend}</Text>
        </View>
      </View>

      <View style={styles.quoteBox}>
        <Text style={styles.quoteText}>"{interpretation}"</Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCol}>
          <Text style={[styles.metricVal, { color: trendColor }]}>
            {deltaSign}{deltaCm} cm
          </Text>
          <Text style={styles.metricSub}>({deltaSign}{Math.abs(deltaM).toFixed(2)} m)</Text>
          <Text style={styles.metricLabel}>{actionWord}</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCol}>
          <Text style={styles.metricVal}>{timeIntervalText}</Text>
          <Text style={styles.metricLabel}>Time Interval</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCol}>
          <Text style={[styles.metricVal, { color: trendColor }]}>{rateText}</Text>
          <Text style={styles.metricLabel}>Rate of Change</Text>
        </View>
      </View>

      <View style={styles.legendContainer}>
        <Text style={styles.legendHeader}>OFFICIAL MDRRMO CLASSIFICATIONS</Text>
        <View style={styles.legendGrid}>
          {MDRRMO_THRESHOLDS.map(item => {
            const isCurrent = floodLevel === item.level;
            return (
              <View
                key={item.level}
                style={[
                  styles.legendItem,
                  isCurrent && { borderColor: item.color, backgroundColor: `${item.color}15`, borderWidth: 1.5 },
                ]}>
                <Text style={[styles.legendTitle, { color: item.color }]}>{item.label}</Text>
                <Text style={styles.legendRange}>{item.range}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5 },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  trendPillText: { fontSize: 10, fontWeight: '800' },
  quoteBox: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  quoteText: { fontSize: 12, fontWeight: '600', color: '#1e293b', fontStyle: 'italic', lineHeight: 18 },
  metricsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 12 },
  metricCol: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  metricSub: { fontSize: 9, color: '#64748b', marginTop: 1 },
  metricLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  metricDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
  legendContainer: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  legendHeader: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 8 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  legendItem: { width: '18%', backgroundColor: '#f8fafc', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 2, alignItems: 'center' },
  legendTitle: { fontSize: 9, fontWeight: '800' },
  legendRange: { fontSize: 8, color: '#64748b', marginTop: 2 },
});
