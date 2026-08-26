import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Linking,
  TextInput,
} from 'react-native';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import {
  sendSOS, getMySOS, cancelSOS,
  getPendingSOS, respondSOS, completeSOS,
  getResponderLocations, getResponderLocation,
} from '../../api/sos';
import { getEvacuationCenters, updateEvacuationCenter, getRecommendedCenters } from '../../api/evacuation';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/floodUtils';
import { getFCMToken } from '../../utils/notifications';
import Toast from 'react-native-toast-message';
import { SirenBanner } from '../../components/SirenBanner';
import { ResponderDashboard, BarangayDashboard } from '../../components/dashboards/ResponderDashboard';
import { SOSTrackingMap } from '../../components/FloodMap';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const RESPONDER_ROLES = ['PNP', 'RHU', 'BFP', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'RESCUE'];

const RESCUE_TRACKING_STEPS = [
  { id: 1, key: 'SUBMITTED',          label: '1. Request Submitted',   sub: 'GPS Location Received' },
  { id: 2, key: 'PENDING_DISPATCH',   label: '2. Pending MDRRMO',     sub: 'Awaiting Official Dispatch' },
  { id: 3, key: 'DISPATCHED',         label: '3. Officially Dispatched', sub: 'Units Assigned by Command' },
  { id: 4, key: 'ACCEPTED',           label: '4. Accepted by Team',   sub: 'Responder Confirmed' },
  { id: 5, key: 'EN_ROUTE',           label: '5. En Route',           sub: 'Rescue Unit Moving to Site' },
  { id: 6, key: 'RESCUE_IN_PROGRESS', label: '6. Rescue In Progress', sub: 'Team Active On Scene' },
  { id: 7, key: 'COMPLETED',          label: '7. Rescue Completed',   sub: 'Victim Secured / Safe' },
];

function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateEta(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const distKm = getDistanceKm(lat1, lon1, lat2, lon2);
  const timeMinutes = Math.max(1, Math.round((distKm / 25) * 60));
  return {
    distKm: distKm.toFixed(1),
    timeMinutes,
  };
}

function getActiveStepIndex(sosStatus, assignedResponders = []) {
  if (!sosStatus) return 1;
  if (sosStatus === 'RESOLVED') return 7;
  
  const hasInProg = assignedResponders.some(r => r.responder_duty_status === 'RESCUE_IN_PROGRESS');
  if (hasInProg) return 6;

  const hasEnRoute = assignedResponders.some(r => r.responder_duty_status === 'EN_ROUTE');
  if (hasEnRoute) return 5;

  const hasAccepted = assignedResponders.some(r => r.status === 'ACCEPTED');
  if (hasAccepted) return 4;

  if (sosStatus === 'DISPATCHED') return 3;
  if (sosStatus === 'PENDING') return 2;
  return 1;
}

export default function SOSScreen() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const role = user?.role || 'CITIZEN';

  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <AdminEvacuationView qc={qc} />;
  if (RESPONDER_ROLES.includes(role)) return <ResponderDashboard user={user} />;
  if (role === 'BARANGAY_OFFICIAL') return <BarangayDashboard user={user} />;
  return <CitizenSOSView qc={qc} user={user} />;
}

function AdminEvacuationView({ qc }) {
  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn: getEvacuationCenters,
    refetchInterval: 30000,
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => updateEvacuationCenter(id, data),
    onSuccess: () => { Toast.show({ type: 'success', text1: 'Center updated' }); qc.invalidateQueries(['evacuation']); },
    onError: () => Toast.show({ type: 'error', text1: 'Update failed' }),
  });

  const totalCapacity = centers.reduce((s, c) => s + c.capacity_total, 0);
  const totalOccupied = centers.reduce((s, c) => s + c.capacity_current, 0);
  const openCenters = centers.filter(c => c.is_open).length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.redHeader}>
        <Text style={styles.redHeaderTitle}>Evacuation Centers</Text>
        <Text style={styles.redHeaderSub}>MSWDO Management Panel</Text>
      </View>
      <SirenBanner />
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{openCenters}</Text>
          <Text style={styles.statLabel}>Centers Open</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalOccupied}</Text>
          <Text style={styles.statLabel}>Total Occupants</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: totalCapacity - totalOccupied < 50 ? '#ef4444' : '#22c55e' }]}>
            {totalCapacity - totalOccupied}
          </Text>
          <Text style={styles.statLabel}>Available Slots</Text>
        </View>
      </View>

      {centers.map(center => {
        const pct = center.capacity_total > 0
          ? Math.round((center.capacity_current / center.capacity_total) * 100)
          : 0;
        const full = pct >= 100;

        return (
          <View key={center.id} style={[styles.adminCard, { borderColor: center.is_open ? (full ? '#ef4444' : '#16a34a') : '#334155' }]}>
            <View style={styles.adminCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCardName}>{center.name}</Text>
                <Text style={styles.adminCardSub}>📍 {center.barangay_name}</Text>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: center.is_open ? (full ? '#450a0a' : '#064e3b') : '#1f2937',
              }]}>
                <Text style={[styles.statusBadgeText, {
                  color: center.is_open ? (full ? '#fca5a5' : '#34d399') : '#6b7280',
                }]}>
                  {center.is_open ? (full ? 'FULL' : 'OPEN') : 'CLOSED'}
                </Text>
              </View>
            </View>

            <View style={styles.capacityRow}>
              <Text style={styles.capacityLabel}>Capacity</Text>
              <Text style={styles.capacityValue}>
                {center.capacity_current} / {center.capacity_total} ({pct}%)
              </Text>
            </View>

            <View style={styles.barBg}>
              <View style={[styles.barFill, {
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e',
              }]} />
            </View>

            <View style={styles.adminActions}>
              <View style={styles.occupancyInput}>
                <Text style={styles.occupancyLabel}>Occupants:</Text>
                <TextInput
                  style={styles.occupancyField}
                  defaultValue={String(center.capacity_current)}
                  keyboardType="number-pad"
                  onEndEditing={e => {
                    const val = parseInt(e.nativeEvent.text) || 0;
                    if (val !== center.capacity_current) {
                      update.mutate({ id: center.id, data: { capacity_current: val } });
                    }
                  }}
                />
                <Text style={styles.occupancyOf}>/ {center.capacity_total}</Text>
              </View>

              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: center.is_open ? '#7f1d1d' : '#064e3b' }]}
                onPress={() => update.mutate({ id: center.id, data: { is_open: !center.is_open } })}>
                <Text style={styles.toggleBtnText}>
                  {center.is_open ? 'Close' : 'Open'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function CitizenSOSView({ qc, user }) {
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [sending, setSending] = useState(false);
  const [recommended, setRecommended] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const fetchCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
    }
  };

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-sos'],
    queryFn: getMySOS,
    refetchInterval: 5000,
  });

  const activeRequest = myRequests.find(r =>
    ['PENDING', 'ACKNOWLEDGED', 'DISPATCHED', 'RESPONDING'].includes(r.status)
  );

  const { data: responders = [] } = useQuery({
    queryKey: ['responder-locations'],
    queryFn: getResponderLocations,
    refetchInterval: 5000,
    enabled: !!activeRequest,
  });

  const cancelReq = useMutation({
    mutationFn: cancelSOS,
    onSuccess: () => { Toast.show({ type: 'success', text1: 'SOS cancelled' }); qc.invalidateQueries(['my-sos']); },
  });

  const handleSOS = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Enable location services to send SOS.');
      return;
    }
    Alert.alert(
      '🆘 Send SOS Request',
      'This will notify MDRRMO and rescue teams of your exact GPS location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            try {
              try {
                if (typeof getFCMToken === 'function') {
                  getFCMToken().then(tok => {
                    if (tok) api.patch('/auth/fcm-token', { fcm_token: tok }).catch(() => {});
                  }).catch(() => {});
                }
              } catch (_) {}

              await sendSOS({ lat: location.latitude, lng: location.longitude });
              Toast.show({
                type: 'success',
                text1: '🆘 SOS Sent Successfully!',
                text2: 'MDRRMO and rescue teams have been notified of your location.',
              });
              qc.invalidateQueries(['my-sos']);

              getRecommendedCenters(location.latitude, location.longitude)
                .then(centers => {
                  if (centers && Array.isArray(centers)) setRecommended(centers);
                })
                .catch(() => {});
            } catch (e) {
              console.log('SOS submit error:', e);
              let errMsg = e?.response?.data?.message || e?.message || 'Failed to send SOS. Please check connection and try again.';
              if (e?.response?.status === 401) {
                errMsg = 'Session expired. Please sign out and sign back in.';
              }
              Toast.show({ type: 'error', text1: 'SOS Submission Error', text2: errMsg });
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const currentStep = activeRequest
    ? getActiveStepIndex(activeRequest.status, activeRequest.dispatched_responders)
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      {/* 1. Curved Red Header */}
      <View style={styles.redHeader}>
        <Text style={styles.redHeaderTitle}>SOS / Rescue</Text>
        <Text style={styles.redHeaderSub}>Request emergency assistance</Text>
      </View>

      <View style={styles.bodyPadding}>
        <SirenBanner />

        {/* SOS Sent Toast Banner (Image 2) */}
        {activeRequest && recommended.length > 0 && (
          <View style={styles.sosSentToastBanner}>
            <View style={styles.sosSentGreenCircle}>
              <Ionicons name="checkmark-sharp" size={16} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={styles.sosInlineBadge}><Text style={styles.sosInlineText}>SOS</Text></View>
                <Text style={styles.sosSentTitle}>SOS Sent!</Text>
              </View>
              <Text style={styles.sosSentSub}>{recommended.length} evacuation centers available near you</Text>
            </View>
          </View>
        )}

        {/* GPS Location Card (Image 1 & 2) */}
        <View style={styles.locationCard}>
          <View style={styles.locationPinBox}>
            <Ionicons name="location" size={20} color="#dc2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locationLabel}>Your Location</Text>
            <Text style={styles.locationValue}>
              {location
                ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                : 'Getting GPS location...'}
            </Text>
          </View>
          <TouchableOpacity onPress={fetchCurrentLocation} style={styles.targetBtn}>
            <Ionicons name="locate-outline" size={18} color="#dc2626" />
          </TouchableOpacity>
        </View>

        {activeRequest ? (
          /* Image 2: Active SOS Request State */
          <View style={styles.activeSOSCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.sosInlineBadge}><Text style={styles.sosInlineText}>SOS</Text></View>
                <Text style={styles.activeSOSTitle}>Active SOS Request</Text>
              </View>
              <Text style={styles.activeSOSTime}>{formatDateTime(activeRequest.created_at)}</Text>
            </View>

            {/* Status Banners */}
            {activeRequest.status === 'PENDING' && (
              <View style={[styles.statusBanner, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                <Ionicons name="time-outline" size={20} color="#ea580c" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusBannerTitle, { color: '#c2410c' }]}>Awaiting MDRRMO Dispatch</Text>
                  <Text style={styles.statusBannerSub}>Your GPS location has been sent to command center. Waiting for unit assignment.</Text>
                </View>
              </View>
            )}

            {activeRequest.status === 'DISPATCHED' && (
              <View style={[styles.statusBanner, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                <Ionicons name="shield-checkmark" size={20} color="#b45309" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusBannerTitle, { color: '#92400e' }]}>Rescue Team Assigned 🛡️</Text>
                  <Text style={styles.statusBannerSub}>MDRRMO has officially assigned rescue responders to your location.</Text>
                </View>
              </View>
            )}

            {activeRequest.status === 'RESPONDING' && (
              <View style={[styles.statusBanner, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Ionicons name="navigate" size={20} color="#16a34a" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusBannerTitle, { color: '#15803d' }]}>Rescue Team On The Way 🚑</Text>
                  <Text style={styles.statusBannerSub}>Rescue units are currently en route to your exact location!</Text>
                </View>
              </View>
            )}

            {/* Assigned Responders Info Cards */}
            {((activeRequest.dispatched_responders && activeRequest.dispatched_responders.length > 0) || activeRequest.assigned_responder_name) ? (
              <View style={styles.assignedRespondersWrap}>
                <Text style={styles.assignedRespondersTitle}>
                  🛡️ Assigned Rescue Units ({activeRequest.dispatched_responders?.length || 1})
                </Text>

                {(activeRequest.dispatched_responders && activeRequest.dispatched_responders.length > 0
                  ? activeRequest.dispatched_responders
                  : [{
                      id: 'single',
                      full_name: activeRequest.assigned_responder_name,
                      role: activeRequest.assigned_responder_role,
                      phone_number: activeRequest.assigned_responder_phone,
                      last_lat: activeRequest.assigned_responder_lat,
                      last_lng: activeRequest.assigned_responder_lng,
                      responder_status: activeRequest.assigned_responder_status,
                      dispatch_type: 'PRIMARY',
                    }]
                ).map((resp, idx) => {
                  const eta = calculateEta(activeRequest.lat, activeRequest.lng, resp.last_lat, resp.last_lng);
                  const isEnRoute = resp.responder_status === 'EN_ROUTE';
                  const isOnScene = resp.responder_status === 'RESCUE_IN_PROGRESS';

                  return (
                    <View key={resp.id || idx} style={styles.assignedResponderCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View style={[styles.responderAvatar, { backgroundColor: resp.dispatch_type === 'BACKUP' ? '#fef3c7' : '#fee2e2' }]}>
                            <Ionicons name={resp.dispatch_type === 'BACKUP' ? 'shield-half' : 'shield'} size={18} color={resp.dispatch_type === 'BACKUP' ? '#d97706' : '#dc2626'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.responderName}>{resp.full_name}</Text>
                              {resp.dispatch_type === 'BACKUP' && (
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#b45309', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                  BACKUP
                                </Text>
                              )}
                            </View>
                            <Text style={styles.responderRole}>
                              {resp.role || 'Rescue Team'} · Status: <Text style={{ fontWeight: '700', color: isOnScene ? '#16a34a' : (isEnRoute ? '#0284c7' : '#ea580c') }}>
                                {isOnScene ? 'On Scene 📍' : (isEnRoute ? 'On The Way 🚑' : 'Assigned 🛡️')}
                              </Text>
                            </Text>
                          </View>
                        </View>

                        {resp.phone_number && (
                          <TouchableOpacity
                            style={styles.callResponderBtn}
                            onPress={() => Linking.openURL(`tel:${resp.phone_number}`)}
                            activeOpacity={0.85}>
                            <Ionicons name="call" size={13} color="#fff" />
                            <Text style={styles.callResponderText}>Call Unit</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Distance & Live ETA Calculation */}
                      {resp.last_lat && resp.last_lng && eta ? (
                        <View style={styles.etaRow}>
                          <Ionicons name="speedometer-outline" size={14} color="#0284c7" />
                          <Text style={styles.etaText}>
                            Live Distance: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{eta.distKm} km</Text> · Est. Arrival: <Text style={{ fontWeight: '800', color: '#0284c7' }}>~{eta.timeMinutes} mins</Text>
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.etaRow}>
                          <Ionicons name="navigate-outline" size={14} color="#64748b" />
                          <Text style={styles.etaText}>Unit assigned by MDRRMO command. Live GPS location tracking active.</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Live Responder Tracking Box */}
            <View style={styles.trackingMapWrap}>
              <View style={styles.trackingMapHeader}>
                <View style={styles.trackingLiveDot} />
                <Text style={styles.trackingMapTitle}>Live GPS Responder Tracking</Text>
                <Text style={styles.trackingMapCount}>
                  {responders.length > 0 ? `${responders.length} units active` : 'Active'}
                </Text>
              </View>

              <SOSTrackingMap
                sosLocation={activeRequest.lat ? { lat: activeRequest.lat, lng: activeRequest.lng } : null}
                responders={responders}
                assignedResponders={activeRequest.dispatched_responders}
                assignedRescueId={activeRequest.assigned_rescue_id}
                height={220}
              />
            </View>

            {/* Cancel SOS Button (Disabled & Faded once MDRRMO dispatches a responder) */}
            {(() => {
              const isDispatched = ['DISPATCHED', 'RESPONDING', 'EN_ROUTE', 'RESCUE_IN_PROGRESS'].includes(activeRequest.status) || Boolean(activeRequest.assigned_rescue_id || (activeRequest.dispatched_responders && activeRequest.dispatched_responders.length > 0));

              return (
                <View style={{ width: '100%', marginTop: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.cancelBtn,
                      isDispatched && { opacity: 0.45, backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }
                    ]}
                    onPress={() => !isDispatched && cancelReq.mutate(activeRequest.id)}
                    disabled={isDispatched || cancelReq.isPending}
                    activeOpacity={isDispatched ? 1 : 0.8}>
                    <Ionicons name={isDispatched ? "lock-closed-outline" : "close-circle-outline"} size={18} color={isDispatched ? "#64748b" : "#dc2626"} />
                    <Text style={[styles.cancelBtnText, isDispatched && { color: "#64748b" }]}>
                      {isDispatched ? "Cancel Disabled (Rescue Dispatched)" : "Cancel SOS Request"}
                    </Text>
                  </TouchableOpacity>

                  {isDispatched && (
                    <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 6, fontStyle: 'italic', fontWeight: '600' }}>
                      🔒 Cancellation is disabled because MDRRMO has officially dispatched a rescue responder unit to your location.
                    </Text>
                  )}
                </View>
              );
            })()}
          </View>
        ) : (
          /* Image 1: Default SOS Request Button State */
          <View style={styles.sosSection}>
            <Text style={styles.sosInstructions}>
              Press the SOS button to immediately alert MDRRMO and rescue teams with your GPS location.
              Only use in a genuine emergency.
            </Text>

            <TouchableOpacity
              style={[styles.sosCardButton, (!location || sending) && styles.sosButtonDisabled]}
              onPress={handleSOS}
              disabled={!location || sending}
              activeOpacity={0.85}>
              {sending ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={styles.sosWhiteOutlineBox}>
                    <Text style={styles.sosWhiteOutlineText}>SOS</Text>
                  </View>
                  <Text style={styles.sosButtonBigText}>SEND SOS</Text>
                  <Text style={styles.sosButtonSubText}>Tap to request rescue</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* My SOS History Section with Full Rescuer, Timestamp, and Location Details */}
        {myRequests.length > 0 && (
          <View style={styles.historySection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={20} color="#dc2626" />
                <Text style={styles.historyTitle}>My Rescue & SOS History</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>{myRequests.length} Record(s)</Text>
            </View>

            <View style={styles.historyCardContainer}>
              {myRequests.slice(0, 10).map(req => {
                const isCancelled = req.status === 'CANCELLED';
                const isResolved  = req.status === 'RESOLVED';
                const rescuerName = req.assigned_responder_name || (req.dispatched_responders?.[0]?.full_name);
                const rescuerRole = req.assigned_responder_role || (req.dispatched_responders?.[0]?.role) || 'Rescue Unit';
                const rescuerPhone = req.assigned_responder_phone || (req.dispatched_responders?.[0]?.phone_number);
                const isExpanded = expandedHistoryId === req.id;

                return (
                  <TouchableOpacity
                    key={req.id}
                    style={[styles.historyItemCard, isExpanded && { borderColor: '#dc2626', borderWidth: 1.5 }]}
                    onPress={() => setExpandedHistoryId(isExpanded ? null : req.id)}
                    activeOpacity={0.88}>
                    {/* Header Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={[
                        styles.historyStatusBadge,
                        isResolved ? { backgroundColor: '#dcfce7', borderColor: '#86efac' } :
                        isCancelled ? { backgroundColor: '#fee2e2', borderColor: '#fca5a5' } :
                        { backgroundColor: '#fef3c7', borderColor: '#fde047' },
                      ]}>
                        <Ionicons
                          name={isResolved ? 'shield-checkmark' : isCancelled ? 'close-circle' : 'time-sharp'}
                          size={13}
                          color={isResolved ? '#16a34a' : isCancelled ? '#dc2626' : '#d97706'}
                        />
                        <Text style={[
                          styles.historyStatusLabel,
                          { color: isResolved ? '#15803d' : isCancelled ? '#b91c1c' : '#b45309' }
                        ]}>
                          {isResolved ? 'RESCUED & SAFE ✓' : req.status}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.historyTime}>{formatDateTime(req.created_at)}</Text>
                        <Ionicons
                          name={isExpanded ? 'chevron-up-circle' : 'chevron-down-circle'}
                          size={18}
                          color={isExpanded ? '#dc2626' : '#94a3b8'}
                        />
                      </View>
                    </View>

                    {/* Summary Row (Always Visible) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="location" size={15} color="#dc2626" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', flex: 1 }}>
                        Where: <Text style={{ fontWeight: '500', color: '#334155' }}>
                          {req.barangay_name || 'Lumban'}, Laguna
                        </Text>
                      </Text>
                    </View>

                    {/* Expandable Details Body */}
                    {isExpanded && (
                      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                        {/* Coordinates */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Ionicons name="navigate-outline" size={14} color="#64748b" />
                          <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
                            GPS Coordinates: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{req.lat ? `${Number(req.lat).toFixed(4)}, ${Number(req.lng).toFixed(4)}` : 'Not available'}</Text>
                          </Text>
                        </View>

                        {/* Message / Notes if present */}
                        {req.message ? (
                          <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 2 }}>Emergency Note:</Text>
                            <Text style={{ fontSize: 12, color: '#1e293b' }}>{req.message}</Text>
                          </View>
                        ) : null}

                        {/* Who Rescued Them Details Box */}
                        {isResolved && rescuerName ? (
                          <View style={{ backgroundColor: '#f0fdf4', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Ionicons name="shield-checkmark" size={20} color="#16a34a" />
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#15803d' }}>
                                    Rescued By: {rescuerName}
                                  </Text>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534', marginTop: 1 }}>
                                    Role: {rescuerRole}
                                  </Text>
                                  {req.resolved_at && (
                                    <Text style={{ fontSize: 11, color: '#166534', marginTop: 3 }}>
                                      When: Safe & Rescued at {formatDateTime(req.resolved_at)}
                                    </Text>
                                  )}
                                </View>
                              </View>
                              {rescuerPhone && (
                                <TouchableOpacity
                                  style={{ backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                  onPress={() => Linking.openURL(`tel:${rescuerPhone}`)}>
                                  <Ionicons name="call" size={13} color="#fff" />
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Call</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ) : isCancelled ? (
                          <Text style={{ fontSize: 12, fontStyle: 'italic', color: '#94a3b8' }}>
                            Request was cancelled by resident.
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '600' }}>
                            ⏳ Rescue Operation Active · Command Center Monitoring
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  /* Red Header */
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

  bodyPadding: { paddingTop: 16 },

  /* GPS Location Card */
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  locationPinBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  locationValue: { fontSize: 13, color: '#0f172a', fontWeight: '700', marginTop: 2 },
  targetBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Default SOS Button Card (Image 1) */
  sosSection: { marginHorizontal: 20, marginBottom: 24 },
  sosInstructions: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  sosCardButton: {
    backgroundColor: '#dc2626',
    borderRadius: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  sosButtonDisabled: { opacity: 0.5 },
  sosWhiteOutlineBox: {
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  sosWhiteOutlineText: { color: '#ffffff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  sosButtonBigText: { fontSize: 28, fontWeight: '900', color: '#ffffff', letterSpacing: 1.5 },
  sosButtonSubText: { fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', marginTop: 4 },

  /* Active SOS Toast Banner (Image 2) */
  sosSentToastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sosSentGreenCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosSentTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  sosSentSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  /* Active SOS Card (Image 2) */
  activeSOSCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#fff1f2',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    padding: 18,
  },
  activeSOSTitle: { fontSize: 16, fontWeight: '800', color: '#dc2626' },
  activeSOSStatus: { fontSize: 13, color: '#dc2626', marginBottom: 2 },
  activeSOSTime: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  activeSOSInfo: { fontSize: 12, color: '#475569', lineHeight: 18, marginBottom: 14 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  statusBannerTitle: { fontSize: 13, fontWeight: '800' },
  statusBannerSub: { fontSize: 11, color: '#475569', marginTop: 2 },

  assignedRespondersWrap: {
    marginBottom: 12,
  },
  assignedRespondersTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  assignedResponderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 12,
    marginBottom: 12,
  },
  responderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  responderName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  responderRole: { fontSize: 11, color: '#64748b', marginTop: 1 },
  callResponderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  callResponderText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  etaText: { fontSize: 11, color: '#475569' },

  sosInlineBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  sosInlineText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },

  trackingMapWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#ffffff',
    marginBottom: 14,
  },
  trackingMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff1f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fca5a5',
  },
  trackingLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626' },
  trackingMapTitle: { fontSize: 12, fontWeight: '800', color: '#dc2626', flex: 1 },
  trackingMapCount: { fontSize: 11, color: '#dc2626', fontWeight: '700' },
  trackingFooter: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderTopWidth: 1,
    borderTopColor: '#fca5a5',
  },
  trackingFooterText: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic' },

  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  cancelBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },

  /* My SOS History (Image 1) */
  historySection: { marginHorizontal: 20, marginBottom: 24 },
  historyTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  historyCardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  historyItemCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: 12,
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  historyStatusLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  historyRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTime: { fontSize: 12, color: '#64748b' },

  /* Admin/Responder elements */
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: 10, color: '#64748b', marginTop: 4, textAlign: 'center' },
  adminCard: { marginHorizontal: 20, marginBottom: 14, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.5, padding: 18 },
  adminCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  adminCardName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  adminCardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  capacityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  capacityLabel: { fontSize: 12, color: '#64748b' },
  capacityValue: { fontSize: 12, color: '#0f172a', fontWeight: '600' },
  barBg: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  barFill: { height: '100%', borderRadius: 3 },
  adminActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  occupancyInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8 },
  occupancyLabel: { fontSize: 12, color: '#64748b' },
  occupancyField: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  occupancyOf: { fontSize: 12, color: '#64748b' },
  toggleBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  toggleBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});