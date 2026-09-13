import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Switch, Modal, TextInput, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { getPendingSOS, respondSOS, declineSOS, completeSOS, getResponderLocations, requestBackup, updateResponderStatus, getBackupHistory } from '../../api/sos';
import { ResponderMap, BarangaySosMap } from '../FloodMap';
import { getActiveAlerts } from '../../api/alerts';
import { getLatestReading, getRateOfRise } from '../../api/readings';
import { getWeather } from '../../api/weather';
import { formatDateTime, getFloodConfig, formatWaterLevel, MAX_LEVEL } from '../../utils/floodUtils';
import Toast from 'react-native-toast-message';
import { SirenBanner } from '../SirenBanner';

const ROLE_CONFIG = {
  PNP: {
    label: 'Philippine National Police',
    short: 'PNP',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: 'shield',
    duties: [
      'Maintain peace & order in flood zones',
      'Assist in evacuation operations',
      'Traffic control at flood-affected roads',
      'Coordinate with MDRRMO on ground ops',
    ],
  },
  RHU: {
    label: 'Rural Health Unit',
    short: 'RHU',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    icon: 'medkit',
    duties: [
      'Provide medical assistance to evacuees',
      'Monitor health conditions in centers',
      'Coordinate ambulance dispatch',
      'Disease surveillance & prevention',
    ],
  },
  BFP: {
    label: 'Bureau of Fire Protection',
    short: 'BFP',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    icon: 'flame',
    duties: [
      'Water rescue & swift water operations',
      'Search & rescue in flooded structures',
      'Coordinate with coast guard',
      'Fire prevention during flood events',
    ],
  },
  COAST_GUARD: {
    label: 'Philippine Coast Guard (Under BFP)',
    short: 'Coast Guard',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    icon: 'boat',
    duties: [
      'Water search & rescue operations (Maritime / BFP)',
      'Flood evacuation and swift water extraction',
      'Deploy rubber boats & water rescue equipment',
      'Coordinate with BFP and disaster command',
    ],
  },
  RESCUE: {
    label: 'Rescue Team',
    short: 'RESCUE',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    icon: 'boat',
    duties: [
      'Respond to SOS rescue requests',
      'Water rescue operations',
      'Transport victims to evacuation centers',
    ],
  },
  MDRRMO: {
    label: 'MDRRMO Official',
    short: 'MDRRMO',
    color: '#dc2626',
    bg: '#fff1f2',
    border: '#fca5a5',
    icon: 'alert-circle',
    duties: [
      'Disaster risk reduction & field command',
      'Rapid assessment & incident management',
      'Coordinate inter-agency rescue operations',
      'Manage critical evacuation logistics',
    ],
  },
  MDRRMO_RESPONDER: {
    label: 'MDRRMO Official',
    short: 'MDRRMO',
    color: '#dc2626',
    bg: '#fff1f2',
    border: '#fca5a5',
    icon: 'alert-circle',
    duties: [
      'Disaster risk reduction & field command',
      'Rapid assessment & incident management',
      'Coordinate inter-agency rescue operations',
      'Manage critical evacuation logistics',
    ],
  },
};

const AVAILABILITY_LABELS = {
  AVAILABLE: { label: 'Available', bg: '#dcfce7', color: '#16a34a' },
  DISPATCHED: { label: 'Rescuing (Dispatched)', bg: '#fef3c7', color: '#b45309' },
  EN_ROUTE: { label: 'Rescuing (En Route)', bg: '#dbeafe', color: '#1d4ed8' },
  RESCUE_IN_PROGRESS: { label: 'Rescuing (On Scene)', bg: '#f3e8ff', color: '#7e22ce' },
  UNAVAILABLE: { label: 'Unavailable', bg: '#f1f5f9', color: '#64748b' },
  OFF_DUTY: { label: 'Unavailable / Off Duty', bg: '#f1f5f9', color: '#64748b' },
};

function FloodInfoSection({ themeColor }) {
  const { data: reading } = useQuery({
    queryKey: ['latest-reading'], queryFn: getLatestReading, refetchInterval: 1000,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ['active-alerts'], queryFn: getActiveAlerts, refetchInterval: 1000,
  });
  const { data: rate } = useQuery({
    queryKey: ['rate-of-rise'], queryFn: getRateOfRise, refetchInterval: 2000,
  });
  const { data: weather } = useQuery({
    queryKey: ['weather'], queryFn: getWeather, refetchInterval: 60000, retry: 1,
  });

  const config = getFloodConfig(reading?.flood_level || 'NORMAL');
  const rateVal = rate?.rate_per_hour || 0;
  const trend = rate?.trend || 'STABLE';
  const rateColor = trend === 'RISING' ? '#dc2626' : trend === 'FALLING' ? '#16a34a' : '#64748b';
  const rateIcon = trend === 'RISING' ? '↑' : trend === 'FALLING' ? '↓' : '→';

  return (
    <>
      {/* Flood Status Summary Card */}
      <View style={[s.statusCard, { borderColor: config.color }]}>
        <Text style={s.statusLabel}>Current Flood Status</Text>
        <Text style={[s.statusLevel, { color: config.color }]}>{config.emoji}  {config.label}</Text>

        <View style={s.statusRow}>
          <View style={s.statusItem}>
            <Text style={s.statusVal}>{formatWaterLevel(reading?.water_level_m)}</Text>
            <Text style={s.statusSub}>Water Level</Text>
          </View>
          <View style={s.statusDivider} />
          <View style={s.statusItem}>
            <Text style={[s.statusVal, { color: rateColor }]}>{rateIcon} {Math.abs(rateVal).toFixed(2)} m/hr</Text>
            <Text style={s.statusSub}>Rate of Change</Text>
          </View>
          <View style={s.statusDivider} />
          <View style={s.statusItem}>
            <Text style={s.statusVal}>{alerts.length > 0 ? `${alerts.length} Active` : 'None'}</Text>
            <Text style={s.statusSub}>Alerts</Text>
          </View>
        </View>
      </View>

      {/* Weather Info Card */}
      {weather && (
        <View style={s.weatherCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ionicons name="partly-sunny" size={16} color="#ea580c" />
            <Text style={s.cardTitle}>Weather — Lumban</Text>
          </View>
          <View style={s.weatherRow}>
            <Text style={s.weatherTemp}>{weather.temp}°C</Text>
            <Text style={s.weatherDesc}>{weather.description}</Text>
          </View>
          <View style={s.weatherGrid}>
            {[
              { icon: 'water', val: `${weather.humidity}%`, label: 'Humidity' },
              { icon: 'rainy', val: `${weather.rain}mm`, label: 'Rain' },
              { icon: 'speedometer', val: `${weather.wind}kph`, label: 'Wind' },
            ].map(item => (
              <View key={item.label} style={s.weatherItem}>
                <Ionicons name={item.icon} size={18} color={themeColor} style={{ marginBottom: 3 }} />
                <Text style={s.weatherVal}>{item.val}</Text>
                <Text style={s.weatherLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

const BACKUP_AGENCIES = [
  { role: 'RHU', label: 'RHU (Medical / First Aid)', icon: 'medkit', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', desc: 'Emergency medical treatment & triage' },
  { role: 'BFP', label: 'BFP (Fire & Search/Rescue)', icon: 'flame', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', desc: 'Structural rescue, water pumping & extraction' },
  { role: 'COAST_GUARD', label: 'Coast Guard (Water Rescue)', icon: 'boat', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', desc: 'Rubber boats & river extraction units' },
  { role: 'MDRRMO', label: 'MDRRMO (Disaster Command)', icon: 'shield-checkmark', color: '#dc2626', bg: '#fff1f2', border: '#fca5a5', desc: 'Command vehicle, heavy rescue & logistics' },
  { role: 'PNP', label: 'PNP (Police & Security)', icon: 'shield', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', desc: 'Perimeter security, crowd control & road clearing' },
];

function BackupAgencyPickerModal({ visible, sos, onClose, onSelectAgency, isSubmitting }) {
  if (!visible || !sos) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="alert-circle" size={22} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Request Field Backup</Text>
                <Text style={{ fontSize: 11, color: '#64748b' }} numberOfLines={1}>
                  Site: <Text style={{ fontWeight: '700' }}>{sos.barangay_name || 'Incident Site'}</Text> ({sos.victim_name || 'Resident'})
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, color: '#475569', marginBottom: 14 }}>
            Select the specialized agency required to assist with this incident:
          </Text>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 10, paddingBottom: 10 }}>
              {BACKUP_AGENCIES.map(agency => (
                <TouchableOpacity
                  key={agency.role}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: agency.bg,
                    borderColor: agency.border,
                    borderWidth: 1.5,
                    borderRadius: 14,
                    padding: 12,
                    gap: 12,
                  }}
                  disabled={isSubmitting}
                  onPress={() => onSelectAgency(agency.role)}
                  activeOpacity={0.75}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: agency.border }}>
                    <Ionicons name={agency.icon} size={22} color={agency.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: agency.color }}>{agency.label}</Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{agency.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={agency.color} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={{ marginTop: 10, backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            onPress={onClose}
            disabled={isSubmitting}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SOSCard({ sos, currentUser, accentColor, onRespond, onDecline, onComplete, onRequestBackup }) {
  const isMDRRMO = ['ADMIN', 'SUPER_ADMIN', 'MDRRMO'].includes(currentUser?.role);
  const [declineReasonModal, setDeclineReasonModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const myId = String(currentUser?.id || currentUser?._id || currentUser?.user_id || '').toLowerCase().trim();
  const myRole = String(currentUser?.role || '').toUpperCase().trim();
  const rawDispatches = sos.dispatched_responders;
  const dispatchedList = Array.isArray(rawDispatches)
    ? rawDispatches
    : (typeof rawDispatches === 'string' ? JSON.parse(rawDispatches || '[]') : []);

  // 1. Prefer exact match by unique user ID
  let myDispatchInfo = dispatchedList.find(dr => {
    const drId = String(dr.responder_id || dr.user_id || dr.id || '').toLowerCase().trim();
    return Boolean(myId && drId === myId && dr.status !== 'DECLINED');
  });

  // 2. Fallback: unassigned role dispatch (e.g. backup request broadcast to a role)
  if (!myDispatchInfo && myRole) {
    myDispatchInfo = dispatchedList.find(dr => {
      const drId = String(dr.responder_id || dr.user_id || dr.id || '').toLowerCase().trim();
      const drRole = String(dr.role || '').toUpperCase().trim();
      return (!drId || drId === myId) && drRole === myRole && dr.status !== 'DECLINED';
    });
  }
  const myDutyStatus = myDispatchInfo?.responder_duty_status || myDispatchInfo?.status;

  const isPending = sos.status === 'PENDING';
  const isDispatched = sos.status === 'DISPATCHED';
  const isResponding = sos.status === 'RESPONDING';

  // Only assigned responders (primary or backup dispatched) get enabled controls; unassigned responders remain disabled in view-only mode
  const isAssignedToMe = Boolean(
    (myId && String(sos.assigned_rescue_id || '').toLowerCase().trim() === myId && sos.status !== 'RESOLVED' && sos.status !== 'CANCELLED') ||
    myDispatchInfo
  );

  const isMyDispatchResponding = isAssignedToMe && (
    myDispatchInfo
      ? ['ACCEPTED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS'].includes(myDispatchInfo.status) || ['EN_ROUTE', 'RESCUE_IN_PROGRESS'].includes(myDispatchInfo.responder_duty_status)
      : (isResponding && !isPending && !isDispatched)
  );

  const isMyDispatchPending = isAssignedToMe && !isMyDispatchResponding;

  const handleDeclineSubmit = () => {
    setDeclineReasonModal(false);
    onDecline({ sosId: sos.id, reason: declineReason });
    setDeclineReason('');
  };

  const isBackupDispatch = myDispatchInfo?.dispatch_type === 'BACKUP';

  return (
    <View style={[
      s.sosCard,
      { borderColor: isAssignedToMe ? (isBackupDispatch ? '#d97706' : '#ea580c') : '#e2e8f0' },
      isAssignedToMe && { backgroundColor: isBackupDispatch ? '#fffbf0' : '#fffdf5', borderWidth: 2 }
    ]}>
      {isAssignedToMe && (
        <View style={[
          s.assignedBanner,
          { backgroundColor: isBackupDispatch ? '#fef3c7' : '#dbeafe', borderColor: isBackupDispatch ? '#fcd34d' : '#93c5fd' }
        ]}>
          <Ionicons name="shield-checkmark" size={16} color={isBackupDispatch ? '#b45309' : '#1d4ed8'} />
          <Text style={[
            s.assignedBannerText,
            { color: isBackupDispatch ? '#92400e' : '#1e40af' }
          ]}>
            🚨 OFFICIAL {isBackupDispatch ? 'BACKUP DISPATCH' : 'DISPATCH ORDER'} ASSIGNED TO YOU
          </Text>
        </View>
      )}

      <View style={s.sosCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.sosName}>{sos.citizen_name || 'Unknown Resident'}</Text>
          <Text style={s.sosMeta}>📍 {sos.barangay_name} · {formatDateTime(sos.created_at)}</Text>
        </View>
        <View style={[
          s.statusBadge,
          {
            backgroundColor: isPending ? '#fff1f2' : isMyDispatchPending ? '#fff7ed' : '#f0fdf4',
            borderColor: isPending ? '#fca5a5' : isMyDispatchPending ? '#fed7aa' : '#bbf7d0',
          }
        ]}>
          <Text style={[
            s.statusBadgeText,
            { color: isPending ? '#dc2626' : isMyDispatchPending ? '#ea580c' : '#16a34a' }
          ]}>
            {isPending
              ? 'Pending MDRRMO'
              : isMyDispatchPending
              ? 'Dispatched (Action Required)'
              : 'Responding / En Route'}
          </Text>
        </View>
      </View>

      {sos.citizen_phone && (
        <TouchableOpacity
          style={[s.callRow, { backgroundColor: accentColor }]}
          onPress={() => Linking.openURL(`tel:${sos.citizen_phone}`)}
          activeOpacity={0.85}>
          <Ionicons name="call" size={14} color="#fff" />
          <Text style={s.callRowText}>{sos.citizen_phone} — Tap to Call Resident</Text>
        </TouchableOpacity>
      )}

      {sos.message && <Text style={s.sosMessage}>"{sos.message}"</Text>}

      <TouchableOpacity
        style={s.coordsBtn}
        onPress={() => Linking.openURL(`https://maps.google.com/?q=${sos.lat},${sos.lng}`)}
        activeOpacity={0.8}>
        <Ionicons name="location" size={14} color="#2563eb" />
        <Text style={s.coordsBtnText}>{sos.lat?.toFixed(5)}, {sos.lng?.toFixed(5)} — Open Maps</Text>
      </TouchableOpacity>

      {!isAssignedToMe && !isMDRRMO && (
        <View style={s.awaitingNoticeBox}>
          <Ionicons name="eye-outline" size={16} color="#d97706" />
          <Text style={s.awaitingNoticeText}>
            {isPending
              ? 'Awaiting official MDRRMO dispatch. You are in view-only mode.'
              : 'Viewing request in view-only mode as another unit is assigned.'}
          </Text>
        </View>
      )}

      <View style={s.sosActionsGroup}>
        {currentUser?.role === 'BARANGAY_OFFICIAL' ? (
          <View style={s.sosActions}>
            {onRequestBackup && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#d97706', flex: 1 }]}
                onPress={() => onRequestBackup(sos)}
                activeOpacity={0.85}>
                <Text style={s.actionBtnText}>🚨 Request Agency Backup</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : !isAssignedToMe && !isMDRRMO ? (
          <View style={s.sosActions}>
            <TouchableOpacity style={[s.actionBtn, s.disabledBtn]} disabled={true}>
              <Text style={s.disabledBtnText}>Accept (Disabled)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.disabledBtn]} disabled={true}>
              <Text style={s.disabledBtnText}>Decline (Disabled)</Text>
            </TouchableOpacity>
          </View>
        ) : !isMyDispatchResponding ? (
          <View style={{ gap: 8 }}>
            <View style={s.sosActions}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: isBackupDispatch ? '#d97706' : '#16a34a' }]}
                onPress={() => onRespond({ sosId: sos.id, statusType: 'EN_ROUTE' })}
                activeOpacity={0.85}>
                <Text style={s.actionBtnText}>✔ Accept</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#dc2626' }]}
                onPress={() => setDeclineReasonModal(true)}
                activeOpacity={0.85}>
                <Text style={s.actionBtnText}>✖ Decline</Text>
              </TouchableOpacity>
            </View>

            {onRequestBackup && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#d97706' }]}
                onPress={() => onRequestBackup(sos)}
                activeOpacity={0.85}>
                <Text style={s.actionBtnText}>🚨 Request Field Backup</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {myDutyStatus !== 'RESCUE_IN_PROGRESS' && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#7e22ce' }]}
                onPress={() => onRespond({ sosId: sos.id, statusType: 'RESCUE_IN_PROGRESS' })}
                activeOpacity={0.85}>
                <Text style={s.actionBtnText}>📍 On Scene / Rescue In Progress</Text>
              </TouchableOpacity>
            )}

            <View style={s.sosActions}>
              {onRequestBackup && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: '#d97706' }]}
                  onPress={() => onRequestBackup(sos)}
                  activeOpacity={0.85}>
                  <Text style={s.actionBtnText}>🚨 Request Backup</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#16a34a' }]}
                onPress={() => onComplete(sos.id)}
                activeOpacity={0.85}>
                <Text style={s.actionBtnText}>✔ Rescue Completed</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Modal visible={declineReasonModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Decline Dispatch Order</Text>
            <Text style={s.modalSub}>State reason for declining dispatch (MDRRMO will be notified for reassignment):</Text>
            <TextInput
              style={s.reasonInput}
              placeholder="e.g. Vehicle breakdown / Engaged in priority emergency"
              value={declineReason}
              onChangeText={setDeclineReason}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#64748b' }]} onPress={() => setDeclineReasonModal(false)}>
                <Text style={s.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#dc2626' }]} onPress={handleDeclineSubmit}>
                <Text style={s.actionBtnText}>Confirm Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function ResponderDashboard({ user, onLogout }) {
  const qc = useQueryClient();
  const config = ROLE_CONFIG[user?.role] || ROLE_CONFIG.RESCUE;
  const currentDuty = user?.responder_status || 'AVAILABLE';
  const [isOnDuty, setIsOnDuty] = useState(currentDuty !== 'UNAVAILABLE' && currentDuty !== 'OFF_DUTY');
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    let sub = null;
    let active = true;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        const granted = status === 'granted'
          ? true
          : (await Location.requestForegroundPermissionsAsync()).status === 'granted';
        if (!granted || !active) return;

        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last?.coords && active) {
            setUserLocation({ lat: last.coords.latitude, lng: last.coords.longitude });
          }
        } catch (_) {}

        try {
          const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (fresh?.coords && active) {
            setUserLocation({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
          }
        } catch (_) {}

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 1,
          },
          (loc) => {
            if (!active || !loc?.coords) return;
            setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          }
        );
      } catch (_) {}
    })();

    return () => {
      active = false;
      if (sub) sub.remove();
    };
  }, []);

  const { data: all = [] } = useQuery({
    queryKey: ['sos-pending'],
    queryFn: getPendingSOS,
    refetchInterval: 2500,
  });

  const { data: responders = [] } = useQuery({
    queryKey: ['responder-locations'],
    queryFn: getResponderLocations,
    refetchInterval: 2500,
  });

  const statusMutation = useMutation({
    mutationFn: updateResponderStatus,
    onSuccess: (data) => {
      Toast.show({ type: 'success', text1: `Duty Status Updated: ${data.status}` });
      qc.invalidateQueries(['responder-locations']);
    },
  });

  const handleToggleDuty = (val) => {
    setIsOnDuty(val);
    statusMutation.mutate(val ? 'AVAILABLE' : 'OFF_DUTY');
  };

  const respond = useMutation({
    mutationFn: ({ sosId, statusType }) => respondSOS(sosId, statusType),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Status updated & MDRRMO notified' });
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['active-backups']);
      qc.invalidateQueries(['responder-locations']);
    },
    onError: (err) => Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to update' }),
  });

  const decline = useMutation({
    mutationFn: ({ sosId, reason }) => declineSOS(sosId, reason),
    onSuccess: () => {
      Toast.show({ type: 'info', text1: 'Dispatch declined.' });
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['active-backups']);
      qc.invalidateQueries(['responder-locations']);
    },
    onError: (err) => Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to decline' }),
  });

  const complete = useMutation({
    mutationFn: completeSOS,
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Rescue completed! Status: Available Again ✔' });
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['active-backups']);
      qc.invalidateQueries(['responder-locations']);
    },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to complete' }),
  });

  const [backupTargetSOS, setBackupTargetSOS] = useState(null);

  const backupMut = useMutation({
    mutationFn: requestBackup,
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '🚨 Backup request broadcasted to MDRRMO & team!' });
      qc.invalidateQueries(['active-backups']);
      qc.invalidateQueries(['backup-history']);
      setBackupTargetSOS(null);
    },
    onError: (err) => {
      Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to request backup' });
    },
  });

  const handleRequestBackup = (sos) => {
    setBackupTargetSOS(sos);
  };

  const sendBackupRequest = (sos, targetRole) => {
    backupMut.mutate({
      sos_id: sos.id,
      lat: Number(user?.last_lat || sos.lat || 14.3006),
      lng: Number(user?.last_lng || sos.lng || 121.4619),
      message: `Backup (${targetRole}) requested by ${user?.full_name || 'Responder'} for SOS in ${sos.barangay_name || 'Lumban'}`,
      target_role: targetRole,
    });
  };

  const availCfg = AVAILABILITY_LABELS[currentDuty] || AVAILABILITY_LABELS.AVAILABLE;

  const [showBackupModal, setShowBackupModal] = useState(false);

  const { data: backupHistory = [] } = useQuery({
    queryKey: ['backup-history'],
    queryFn: getBackupHistory,
    refetchInterval: 10000,
  });

  return (
    <View style={s.container}>
      {/* 1. Agency Role Curved Top Header (Resident App Inspired) */}
      <View style={[s.redHeader, { backgroundColor: config.color }]}>
        <View style={s.headerRow}>
          <View style={s.roleIconSquare}>
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.redHeaderTitle}>{config.short} Dashboard</Text>
            <Text style={s.redHeaderSub}>{user?.full_name} · {config.label}</Text>
            <View style={[s.dutyPillBadge, { backgroundColor: availCfg.bg }]}>
              <Text style={[s.dutyPillText, { color: availCfg.color }]}>● {availCfg.label}</Text>
            </View>
          </View>

          {/* Duty Switch & Logout Button */}
          <View style={s.headerRightBox}>
            <View style={s.dutySwitchCol}>
              <Text style={s.switchLabel}>{isOnDuty ? 'On Duty' : 'Off Duty'}</Text>
              <Switch
                value={isOnDuty}
                onValueChange={handleToggleDuty}
                trackColor={{ false: 'rgba(255,255,255,0.4)', true: '#86efac' }}
                thumbColor={isOnDuty ? '#16a34a' : '#ffffff'}
              />
            </View>
            <TouchableOpacity style={s.signOutCircleBtn} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={s.bodyScroll} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
        <SirenBanner />

        <View style={s.mainPadding}>
          <FloodInfoSection themeColor={config.color} />

          {/* Agency Active Duties Card */}
          <View style={[s.dutiesCard, { borderColor: config.border, backgroundColor: config.bg }]}>
            <Text style={[s.dutiesTitle, { color: config.color }]}>Active Duties & Protocol</Text>
            {config.duties.map((d, i) => (
              <View key={i} style={s.dutyRow}>
                <View style={[s.dutyDot, { backgroundColor: config.color }]} />
                <Text style={s.dutyText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Live Map Box */}
          <Text style={s.sectionHeaderTitle}>
            📍 Live Tactical Map — Responders & SOS ({responders.length} active units)
          </Text>
          <View style={s.mapWrapper}>
            <ResponderMap responders={responders} sosList={all} height={300} currentUser={user} userLocation={userLocation} />
          </View>

          {/* Active Rescue Requests List & Backup History Button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
            <Text style={[s.sectionHeaderTitle, { marginTop: 0, marginBottom: 0 }]}>🆘 Active Rescue Requests ({all.length})</Text>
            <TouchableOpacity
              style={{ backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={() => setShowBackupModal(true)}>
              <Ionicons name="shield-half-outline" size={14} color="#f59e0b" />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#ffffff' }}>
                Backup History ({backupHistory.length})
              </Text>
            </TouchableOpacity>
          </View>

          {all.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
              <Text style={s.emptyTitle}>No Active Rescue Requests</Text>
              <Text style={s.emptySub}>All clear — no pending requests in Lumban</Text>
            </View>
          ) : (
            [...all].sort((a, b) => {
              const myUserId = String(user?.id || '').toLowerCase().trim();
              const aDispatches = Array.isArray(a.dispatched_responders) ? a.dispatched_responders : [];
              const bDispatches = Array.isArray(b.dispatched_responders) ? b.dispatched_responders : [];
              const aAssigned = String(a.assigned_rescue_id || '').toLowerCase().trim() === myUserId || aDispatches.some(dr => String(dr.responder_id || dr.user_id || dr.id || '').toLowerCase().trim() === myUserId && dr.status !== 'DECLINED');
              const bAssigned = String(b.assigned_rescue_id || '').toLowerCase().trim() === myUserId || bDispatches.some(dr => String(dr.responder_id || dr.user_id || dr.id || '').toLowerCase().trim() === myUserId && dr.status !== 'DECLINED');
              if (aAssigned && !bAssigned) return -1;
              if (!aAssigned && bAssigned) return 1;
              return 0;
            }).map(sos => (
              <SOSCard
                key={sos.id}
                sos={sos}
                currentUser={user}
                accentColor={config.color}
                onRespond={respond.mutate}
                onDecline={decline.mutate}
                onComplete={complete.mutate}
                onRequestBackup={handleRequestBackup}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Agency Picker Modal for Requesting Field Backup */}
      <BackupAgencyPickerModal
        visible={!!backupTargetSOS}
        sos={backupTargetSOS}
        onClose={() => setBackupTargetSOS(null)}
        onSelectAgency={(role) => sendBackupRequest(backupTargetSOS, role)}
        isSubmitting={backupMut.isPending}
      />

      {/* Responder Backup Request History Modal */}
      <Modal visible={showBackupModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-half" size={22} color="#d97706" />
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Responder Backup History</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBackupModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {backupHistory.length === 0 ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Ionicons name="folder-open-outline" size={36} color="#94a3b8" />
                  <Text style={{ fontSize: 14, color: '#64748b', marginTop: 8, fontWeight: '600' }}>No backup request records found</Text>
                </View>
              ) : (
                backupHistory.map(bk => (
                  <View key={bk.id} style={{ backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fde047' }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#b45309' }}>
                          TARGET ROLE: {bk.target_role || 'ANY RESPONDER'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>{formatDateTime(bk.created_at)}</Text>
                    </View>

                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                      Requester: {bk.requester_name} ({bk.requester_role})
                    </Text>
                    {bk.requester_phone && (
                      <Text style={{ fontSize: 12, color: '#475569' }}>Contact: {bk.requester_phone}</Text>
                    )}

                    {bk.assigned_responder_name ? (
                      <View style={{ backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#bbf7d0' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#16a34a' }}>
                          Assigned Backup Unit: {bk.assigned_responder_name} ({bk.assigned_responder_role})
                        </Text>
                        {bk.assigned_responder_phone && (
                          <Text style={{ fontSize: 11, color: '#15803d' }}>Phone: {bk.assigned_responder_phone}</Text>
                        )}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, color: '#ea580c', fontWeight: '700', marginTop: 4 }}>
                        Status: {bk.status || 'ACTIVE'} · Awaiting MDRRMO Backup Assignment
                      </Text>
                    )}

                    {bk.message && (
                      <Text style={{ fontSize: 12, color: '#334155', fontStyle: 'italic', marginTop: 6, backgroundColor: '#ffffff', padding: 8, borderRadius: 6 }}>
                        "{bk.message}"
                      </Text>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <Ionicons name="location" size={13} color="#dc2626" />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#475569' }}>
                        Location: {bk.barangay_name || 'Lumban'} ({Number(bk.lat).toFixed(4)}, {Number(bk.lng).toFixed(4)})
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function BarangayDashboard({ user, onLogout }) {
  const qc = useQueryClient();
  const barangayId = user?.barangay_id;
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    let sub = null;
    let active = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === 'granted'
          ? true
          : (await Location.requestForegroundPermissionsAsync()).status === 'granted';
        if (!granted || !active) return;

        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last?.coords && active) {
            setUserLocation({ lat: last.coords.latitude, lng: last.coords.longitude });
          }
        } catch (_) {}

        try {
          const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (fresh?.coords && active) {
            setUserLocation({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
          }
        } catch (_) {}

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 1,
          },
          (loc) => {
            if (!active || !loc?.coords) return;
            setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          }
        );
      } catch (_) {}
    })();

    return () => {
      active = false;
      if (sub) sub.remove();
    };
  }, []);

  const { data: requests = [] } = useQuery({
    queryKey: ['sos-pending'],
    queryFn: getPendingSOS,
    refetchInterval: 2500,
    enabled: !!barangayId,
  });

  const { data: responders = [] } = useQuery({
    queryKey: ['responder-locations'],
    queryFn: getResponderLocations,
    refetchInterval: 2500,
  });

  const respond = useMutation({
    mutationFn: ({ sosId, statusType }) => respondSOS(sosId, statusType),
    onSuccess: () => { Toast.show({ type: 'success', text1: 'Response confirmed' }); qc.invalidateQueries(['sos-pending']); },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to respond' }),
  });

  const decline = useMutation({
    mutationFn: ({ sosId, reason }) => declineSOS(sosId, reason),
    onSuccess: () => { Toast.show({ type: 'info', text1: 'Dispatch declined' }); qc.invalidateQueries(['sos-pending']); },
  });

  const complete = useMutation({
    mutationFn: completeSOS,
    onSuccess: () => { Toast.show({ type: 'success', text1: 'Rescue completed ✔' }); qc.invalidateQueries(['sos-pending']); },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to complete' }),
  });

  const [backupTargetSOS, setBackupTargetSOS] = useState(null);

  const backupMut = useMutation({
    mutationFn: requestBackup,
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '🚨 Backup request sent to agency & MDRRMO!' });
      qc.invalidateQueries(['active-backups']);
      qc.invalidateQueries(['sos-pending']);
      setBackupTargetSOS(null);
    },
    onError: (err) => {
      Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to request backup' });
    },
  });

  const sendBarangayBackupRequest = (sos, targetRole) => {
    backupMut.mutate({
      sos_id: sos.id,
      lat: Number(user?.last_lat || sos.lat || 14.3006),
      lng: Number(user?.last_lng || sos.lng || 121.4619),
      message: `Backup (${targetRole}) requested by ${user?.full_name || 'Barangay Official'} for SOS in ${sos.barangay_name || 'Lumban'}`,
      target_role: targetRole,
    });
  };

  return (
    <View style={s.container}>
      <View style={[s.redHeader, { backgroundColor: '#7e22ce' }]}>
        <View style={s.headerRow}>
          <View style={s.roleIconSquare}>
            <Ionicons name="people" size={24} color="#7e22ce" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.redHeaderTitle}>Barangay Official</Text>
            <Text style={s.redHeaderSub}>{user?.barangay_name || 'Your Barangay'} · {user?.full_name}</Text>
          </View>
          <TouchableOpacity style={s.signOutCircleBtn} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.bodyScroll} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
        <SirenBanner />

        <View style={s.mainPadding}>
          <FloodInfoSection themeColor="#7e22ce" />

          <View style={s.jurisdictionBanner}>
            <Ionicons name="location" size={18} color="#7e22ce" />
            <Text style={s.jurisdictionText}>
              Jurisdiction View — <Text style={{ fontWeight: '800' }}>{user?.barangay_name}</Text>
            </Text>
          </View>

          <Text style={s.sectionHeaderTitle}>🗺️ Live SOS Map — {user?.barangay_name}</Text>
          <View style={s.mapWrapper}>
            <ResponderMap responders={responders} sosList={requests} height={280} currentUser={user} userLocation={userLocation} />
          </View>

          <Text style={s.sectionHeaderTitle}>🆘 SOS Requests ({requests.length})</Text>

          {!barangayId ? (
            <View style={s.emptyBox}>
              <Ionicons name="warning" size={40} color="#ea580c" />
              <Text style={s.emptyTitle}>No Barangay Assigned</Text>
              <Text style={s.emptySub}>Contact admin to assign your barangay jurisdiction</Text>
            </View>
          ) : requests.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
              <Text style={s.emptyTitle}>No Active SOS</Text>
              <Text style={s.emptySub}>No pending requests in {user?.barangay_name}</Text>
            </View>
          ) : (
            requests.map(sos => (
              <SOSCard
                key={sos.id}
                sos={sos}
                currentUser={user}
                accentColor="#7e22ce"
                onRespond={respond.mutate}
                onDecline={decline.mutate}
                onComplete={complete.mutate}
                onRequestBackup={(item) => setBackupTargetSOS(item)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Agency Picker Modal for Barangay Official */}
      <BackupAgencyPickerModal
        visible={!!backupTargetSOS}
        sos={backupTargetSOS}
        onClose={() => setBackupTargetSOS(null)}
        onSelectAgency={(role) => sendBarangayBackupRequest(backupTargetSOS, role)}
        isSubmitting={backupMut.isPending}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  /* Curved Top Header Container (Resident App Inspired) */
  redHeader: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 50,
    paddingBottom: 22,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  redHeaderTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff' },
  redHeaderSub: { fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 },
  dutyPillBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  dutyPillText: { fontSize: 10, fontWeight: '800' },

  headerRightBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dutySwitchCol: { alignItems: 'center' },
  switchLabel: { fontSize: 9, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '800', marginBottom: 2 },
  signOutCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bodyScroll: { flex: 1, paddingTop: 16 },
  mainPadding: { paddingHorizontal: 20 },

  /* Flood Status Summary Card */
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statusLabel: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  statusLevel: { fontSize: 22, fontWeight: '900', marginBottom: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusItem: { flex: 1, alignItems: 'center' },
  statusVal: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  statusSub: { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  statusDivider: { width: 1, height: 28, backgroundColor: '#f1f5f9' },

  /* Weather Card */
  weatherCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  weatherTemp: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  weatherDesc: { fontSize: 13, color: '#64748b', flex: 1, fontWeight: '600' },
  weatherGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  weatherItem: { alignItems: 'center' },
  weatherVal: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  weatherLabel: { fontSize: 10, color: '#94a3b8', marginTop: 1, fontWeight: '600' },

  /* Duties Card */
  dutiesCard: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 16 },
  dutiesTitle: { fontSize: 14, fontWeight: '900', marginBottom: 10 },
  dutyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  dutyDot: { width: 8, height: 8, borderRadius: 4 },
  dutyText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  sectionHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  mapWrapper: { marginBottom: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },

  jurisdictionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#faf5ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    padding: 14,
    marginBottom: 14,
  },
  jurisdictionText: { fontSize: 13, color: '#7e22ce', flex: 1, fontWeight: '600' },

  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 10, marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center' },

  /* SOS Card */
  sosCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  assignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  assignedBannerText: { color: '#92400e', fontSize: 11, fontWeight: '800' },
  sosCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  sosName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  sosMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },

  callRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12, marginBottom: 10 },
  callRowText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  sosMessage: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginBottom: 10 },
  coordsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', borderRadius: 12, padding: 10, marginBottom: 12 },
  coordsBtnText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },

  awaitingNoticeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7ed', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#fed7aa' },
  awaitingNoticeText: { color: '#ea580c', fontSize: 12, flex: 1, fontStyle: 'italic' },

  sosActionsGroup: { marginTop: 4 },
  sosActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  disabledBtn: { backgroundColor: '#cbd5e1', opacity: 0.5 },
  disabledBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#ffffff', width: '100%', borderRadius: 24, padding: 22, elevation: 10 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  modalSub: { fontSize: 12, color: '#64748b', marginBottom: 14 },
  reasonInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 12, fontSize: 13, color: '#0f172a', minHeight: 80, textAlignVertical: 'top' },
});
