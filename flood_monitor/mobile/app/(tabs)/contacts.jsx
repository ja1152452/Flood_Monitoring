import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../store/authStore';
import { getContacts } from '../../api/contacts';
import {
  requestBackup, getActiveBackups, resolveBackup, respondSOS, declineSOS,
} from '../../api/sos';
import { formatDateTime } from '../../utils/floodUtils';
import Toast from 'react-native-toast-message';
import { SirenBanner } from '../../components/SirenBanner';

const CATEGORY_CONFIG = {
  EMERGENCY: {
    label: 'Emergency Hotline',
    iconColor: '#dc2626',
    bgColor: '#fff1f2',
    borderColor: '#fca5a5',
    icon: 'alarm',
  },
  DISASTER: {
    label: 'LDRRMO / MDRRMO Office',
    iconColor: '#dc2626',
    bgColor: '#fff1f2',
    borderColor: '#fca5a5',
    icon: 'shield-checkmark',
  },
  LGU: {
    label: 'LGU (Municipal Hall)',
    iconColor: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    icon: 'business',
  },
  MEDICAL: {
    label: 'Health & Medical (RHU)',
    iconColor: '#15803d',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    icon: 'medical',
  },
  POLICE: {
    label: 'Police Department (Lumban MPS)',
    iconColor: '#1e40af',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    icon: 'shield',
  },
  FIRE: {
    label: 'Fire Department (BFP)',
    iconColor: '#c2410c',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    icon: 'flame',
  },
  UTILITIES: {
    label: 'Public Utilities & Services',
    iconColor: '#b45309',
    bgColor: '#fefce8',
    borderColor: '#fef08a',
    icon: 'flash',
  },
};

const DEFAULT_CONTACTS = [
  { id: '1', name: 'Emergency 911 (National Hotline)', number: '911', category: 'EMERGENCY' },
  { id: '2', name: 'LGU – Lumban', number: '0917-164-2190', category: 'LGU' },
  { id: '3', name: 'RHU Lumban (Rural Health Unit)', number: '0951-246-8199', category: 'MEDICAL' },
  { id: '4', name: 'Lumban MPS (Municipal Police Station)', number: '0998-598-5651, 0963-420-1016', category: 'POLICE' },
  { id: '5', name: 'LDRRMO (Lumban Disaster Risk Reduction and Management Office)', number: '0917-193-8983', category: 'DISASTER' },
  { id: '6', name: 'Bureau of Fire Protection (BFP)', number: '557-0771, 0951-244-9285', category: 'FIRE' },
  { id: '7', name: 'FLECO Emergency Hotline', number: '0951-570-4206, 0933-816-8117', category: 'UTILITIES' },
];

const normalizePhone = (num) => num.replace(/\D/g, '');

const deduplicateContacts = (rawContacts) => {
  const seenNumbers = new Set(['911']);
  const result = [];

  for (const contact of rawContacts) {
    if (!contact || !contact.number) continue;
    const numbers = contact.number.split(/[,|]/).map(n => n.trim()).filter(Boolean);
    const uniqueNumbersForContact = [];

    for (const num of numbers) {
      const normalized = normalizePhone(num);
      const key = normalized || num;
      if (!seenNumbers.has(key)) {
        seenNumbers.add(key);
        uniqueNumbersForContact.push(num);
      }
    }

    if (uniqueNumbersForContact.length > 0) {
      result.push({
        ...contact,
        number: uniqueNumbersForContact.join(', '),
      });
    }
  }

  return result;
};

function ContactsView() {
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
  });

  const rawList = contacts && contacts.length > 0 ? contacts : DEFAULT_CONTACTS;
  const uniqueContacts = deduplicateContacts(rawList);

  const grouped = uniqueContacts.reduce((acc, c) => {
    const cat = c.category || 'LGU';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const handleCall = (numberStr, name) => {
    if (!numberStr) return;
    const numbers = numberStr.split(/[,|]/).map(n => n.trim()).filter(Boolean);

    if (numbers.length === 1) {
      Alert.alert(`Call ${name}`, numbers[0], [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Now', onPress: () => Linking.openURL(`tel:${numbers[0]}`) },
      ]);
    } else if (numbers.length > 1) {
      const buttons = numbers.map(num => ({
        text: `Call ${num}`,
        onPress: () => Linking.openURL(`tel:${num}`)
      }));
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(`Call ${name}`, 'Select a number to call', buttons);
    }
  };

  return (
    <View style={s.screen}>
      {/* 1. Curved Red Top Header */}
      <View style={s.redHeader}>
        <Text style={s.redHeaderTitle}>Emergency Contacts</Text>
        <Text style={s.redHeaderSub}>Lumban, Laguna – One-tap direct call</Text>
      </View>

      <ScrollView style={s.bodyScroll} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <SirenBanner />

        <View style={s.mainPadding}>
          {/* Top Emergency Hotline Banner Card */}
          <TouchableOpacity
            style={s.emergencyBannerCard}
            onPress={() => handleCall('911', 'National Emergency 911')}
            activeOpacity={0.85}>
            <View style={s.emergencySirenBox}>
              <Ionicons name="alarm" size={26} color="#dc2626" style={{ textAlign: 'center' }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.emergencyBannerLabel}>National Emergency Hotline</Text>
              <Text style={s.emergencyBannerNum}>911</Text>
            </View>
            <View style={s.emergencyCallPill}>
              <Ionicons name="call" size={14} color="#ffffff" />
              <Text style={s.emergencyCallPillText}>CALL 911</Text>
            </View>
          </TouchableOpacity>

          {/* Categorized Emergency Contacts List */}
          {Object.entries(grouped).map(([category, items]) => {
            if (category === 'EMERGENCY') return null;
            const cfg = CATEGORY_CONFIG[category] || {
              label: category,
              iconColor: '#dc2626',
              bgColor: '#fff1f2',
              borderColor: '#fca5a5',
              icon: 'call',
            };

            return (
              <View key={category} style={s.categorySection}>
                {/* Section Title with Agency Vector Icon Box */}
                <View style={s.categoryHeaderRow}>
                  <View style={[s.categoryHeaderTile, { backgroundColor: cfg.bgColor, borderColor: cfg.borderColor }]}>
                    <Ionicons name={cfg.icon} size={16} color={cfg.iconColor} style={{ textAlign: 'center' }} />
                  </View>
                  <Text style={s.categoryHeaderTitle}>{cfg.label}</Text>
                </View>

                {items.map(contact => (
                  <TouchableOpacity
                    key={contact.id}
                    style={s.contactCardItem}
                    onPress={() => handleCall(contact.number, contact.name)}
                    activeOpacity={0.8}>
                    <View style={[s.contactIconBox, { backgroundColor: cfg.bgColor, borderColor: cfg.borderColor }]}>
                      <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} style={{ textAlign: 'center' }} />
                    </View>

                    <View style={s.contactInfoCol}>
                      <Text style={s.contactNameText}>{contact.name}</Text>
                      <Text style={s.contactNumberText}>{contact.number}</Text>
                    </View>

                    <TouchableOpacity
                      style={s.callRedPillBtn}
                      onPress={() => handleCall(contact.number, contact.name)}
                      activeOpacity={0.85}>
                      <Ionicons name="call" size={13} color="#ffffff" />
                      <Text style={s.callRedPillText}>Call</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}

          <View style={s.footerNoticeCard}>
            <Ionicons name="information-circle-outline" size={18} color="#94a3b8" />
            <Text style={s.footerNoticeText}>
              Tap any contact line to initiate an instant phone call. All hotlines are verified Lumban disaster response lines.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Backup View for Responders ───────────────────────────────────────────────

const ROLE_COLORS = {
  PNP: { bg: '#eff6ff', border: '#bfdbfe', icon: '#1e40af', iconName: 'shield', label: 'PNP (Police)' },
  BFP: { bg: '#fff7ed', border: '#fed7aa', icon: '#ea580c', iconName: 'flame', label: 'BFP (Fire)' },
  COAST_GUARD: { bg: '#e0f2fe', border: '#bae6fd', icon: '#0284c7', iconName: 'boat', label: 'Coast Guard' },
  RHU: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a', iconName: 'medical', label: 'RHU (Health)' },
  MDRRMO: { bg: '#fff1f2', border: '#fca5a5', icon: '#dc2626', iconName: 'shield-checkmark', label: 'MDRRMO Official' },
  MDRRMO_RESPONDER: { bg: '#fff1f2', border: '#fca5a5', icon: '#dc2626', iconName: 'shield-checkmark', label: 'MDRRMO Official' },
  BARANGAY_OFFICIAL: { bg: '#f3e8ff', border: '#e9d5ff', icon: '#9333ea', iconName: 'business', label: 'Brgy. Official' },
  RESCUE: { bg: '#e0f2fe', border: '#bae6fd', icon: '#0284c7', iconName: 'body', label: 'Rescue Team' },
};

function BackupView({ user }) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(null);

  const OTHER_ROLES = ['PNP', 'BFP', 'COAST_GUARD', 'RHU', 'MDRRMO', 'BARANGAY_OFFICIAL', 'RESCUE'].filter(r => r !== user?.role);

  const { data: backups = [] } = useQuery({
    queryKey: ['active-backups'],
    queryFn: getActiveBackups,
    refetchInterval: 8000,
  });

  const requestMutation = useMutation({
    mutationFn: requestBackup,
    onSuccess: (_, vars) => {
      Toast.show({ type: 'success', text1: `🚨 Backup requested from ${vars.target_role}` });
      setSending(null);
      qc.invalidateQueries(['active-backups']);
    },
    onError: () => {
      Toast.show({ type: 'error', text1: 'Failed to send backup request' });
      setSending(null);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: resolveBackup,
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Backup resolved ✓' });
      qc.invalidateQueries(['active-backups']);
    },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to resolve' }),
  });

  const respondMutation = useMutation({
    mutationFn: ({ sosId, statusType }) => {
      if (!sosId) {
        Toast.show({ type: 'error', text1: 'No SOS incident linked' });
        return Promise.resolve();
      }
      return respondSOS(sosId, statusType);
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Backup accepted ✓' });
      qc.invalidateQueries(['active-backups']);
      qc.invalidateQueries(['sos-pending']);
    },
    onError: (err) => Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to accept backup' }),
  });

  const declineMutation = useMutation({
    mutationFn: ({ sosId, reason }) => {
      if (!sosId) {
        Toast.show({ type: 'info', text1: 'Backup request cleared' });
        return Promise.resolve();
      }
      return declineSOS(sosId, reason);
    },
    onSuccess: () => {
      Toast.show({ type: 'info', text1: 'Backup declined' });
      qc.invalidateQueries(['active-backups']);
      qc.invalidateQueries(['sos-pending']);
    },
    onError: (err) => Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to decline' }),
  });

  const handleSend = (targetRole) => {
    Alert.alert(
      `🚨 Request Backup from ${targetRole}`,
      `Your GPS coordinates will be dispatched to active ${targetRole} responders.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          style: 'destructive',
          onPress: async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              Toast.show({ type: 'error', text1: 'Location permission required' });
              return;
            }
            setSending(targetRole);
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            requestMutation.mutate({
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              target_role: targetRole,
              message: `${user?.role} (${user?.full_name}) requests field backup at this position.`,
            });
          },
        },
      ]
    );
  };

  const myBackups = backups.filter(b => b.requester_id === user?.id);
  const othersBackups = backups.filter(b => b.requester_id !== user?.id);

  return (
    <View style={s.screen}>
      <View style={s.redHeader}>
        <Text style={s.redHeaderTitle}>🚨 Field Backup Request</Text>
        <Text style={s.redHeaderSub}>{user?.full_name} · {user?.role}</Text>
      </View>

      <ScrollView style={s.bodyScroll} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <SirenBanner />

        <View style={s.mainPadding}>
          <View style={s.backupCard}>
            <Text style={s.backupCardTitle}>Request Backup From Agency</Text>
            <Text style={s.backupCardSub}>
              Dispatches your real-time location to available responder units
            </Text>

            <View style={s.roleGrid}>
              {OTHER_ROLES.map(role => {
                const cfg = ROLE_COLORS[role] || { bg: '#fff1f2', border: '#fca5a5', icon: '#dc2626', iconName: 'shield' };

                return (
                  <TouchableOpacity
                    key={role}
                    style={[s.roleBtn, { backgroundColor: cfg.bg, borderColor: cfg.border }, sending === role && { opacity: 0.5 }]}
                    onPress={() => handleSend(role)}
                    disabled={!!sending}
                    activeOpacity={0.8}>
                    <View style={[s.roleIconTile, { backgroundColor: '#ffffff' }]}>
                      <Ionicons name={cfg.iconName} size={22} color={cfg.icon} />
                    </View>
                    <Text style={[s.roleLabel, { color: cfg.icon }]}>
                      {cfg.label || (role === 'BARANGAY_OFFICIAL' ? 'Brgy. Official' : role)}
                    </Text>
                    {sending === role && (
                      <Text style={{ fontSize: 10, color: cfg.icon, marginTop: 2 }}>Sending…</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {myBackups.length > 0 && (
            <View style={s.categorySection}>
              <Text style={s.categoryHeaderTitle}>📡 My Active Backup Orders ({myBackups.length})</Text>
              {myBackups.map(b => (
                <View key={b.id} style={s.activeCard}>
                  <View style={s.activeCardRow}>
                    <View style={s.rolePill}>
                      <Text style={s.rolePillText}>{b.target_role}</Text>
                    </View>
                    <Text style={s.activeCardTime}>{formatDateTime(b.created_at)}</Text>
                  </View>
                  <Text style={s.activeCardMsg} numberOfLines={2}>{b.message}</Text>
                  <TouchableOpacity
                    style={s.mapsRow}
                    onPress={() => Linking.openURL(`https://maps.google.com/?q=${b.lat},${b.lng}`)}>
                    <Ionicons name="navigate" size={13} color="#dc2626" />
                    <Text style={s.mapsRowText}>View location in Maps</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.resolveBtn}
                    onPress={() => resolveMutation.mutate(b.id)}>
                    <Ionicons name="checkmark-circle" size={15} color="#dc2626" />
                    <Text style={s.resolveBtnText}>Mark as Resolved</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {othersBackups.length > 0 && (
            <View style={s.categorySection}>
              <Text style={s.categoryHeaderTitle}>📥 Incoming Backup Calls ({othersBackups.length})</Text>
              {othersBackups.map(b => (
                <View key={b.id} style={s.incomingCard}>
                  <View style={s.incomingHeader}>
                    <View style={s.rolePill}>
                      <Text style={s.rolePillText}>{b.requester_role}</Text>
                    </View>
                    <Text style={s.incomingName}>{b.requester_name}</Text>
                  </View>
                  {b.message && <Text style={s.incomingMsg}>{b.message}</Text>}
                  <Text style={s.activeCardTime}>{formatDateTime(b.created_at)}</Text>
                    <View style={{ gap: 6, marginTop: 8 }}>
                      {b.sos_lat && b.sos_lng && (
                        <TouchableOpacity
                          style={[s.mapsBtn, { backgroundColor: '#dc2626' }]}
                          onPress={() => Linking.openURL(`https://maps.google.com/?q=${b.sos_lat},${b.sos_lng}`)}>
                          <Ionicons name="location" size={14} color="#fff" />
                          <Text style={s.mapsBtnText}>📍 Open SOS Incident Location ({b.victim_name || 'Resident'})</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[s.mapsBtn, { backgroundColor: '#0284c7' }]}
                        onPress={() => Linking.openURL(`https://maps.google.com/?q=${b.lat},${b.lng}`)}>
                        <Ionicons name="navigate" size={14} color="#fff" />
                        <Text style={s.mapsBtnText}>🚨 Open Requesting Responder ({b.requester_name})</Text>
                      </TouchableOpacity>

                      {b.status === 'DISPATCHED' && String(b.assigned_responder_id || '') === String(user?.id || '') ? (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          <TouchableOpacity
                            style={[s.mapsBtn, { flex: 1, backgroundColor: '#d97706', justifyContent: 'center' }]}
                            onPress={() => respondMutation.mutate({ sosId: b.sos_id, statusType: 'EN_ROUTE' })}>
                            <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            <Text style={s.mapsBtnText}>✔ Accept Backup Dispatch</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[s.mapsBtn, { backgroundColor: '#dc2626', paddingHorizontal: 16, justifyContent: 'center' }]}
                            onPress={() => declineMutation.mutate({ sosId: b.sos_id, reason: 'Unable to respond to backup request' })}>
                            <Ionicons name="close-circle" size={16} color="#fff" />
                            <Text style={s.mapsBtnText}>✖ Decline</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: '#fef3c7', borderColor: '#fcd34d', borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="time-outline" size={16} color="#d97706" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400e', flex: 1 }}>
                            {b.status === 'ACTIVE'
                              ? '⏳ Awaiting MDRRMO Dispatch Order. MDRRMO will assign backup units.'
                              : `Assigned to ${b.assigned_responder_name || 'another responder unit'}.`}
                          </Text>
                        </View>
                      )}
                    </View>
                </View>
              ))}
            </View>
          )}

          {myBackups.length === 0 && othersBackups.length === 0 && (
            <View style={s.emptyBox}>
              <Ionicons name="radio-outline" size={44} color="#cbd5e1" />
              <Text style={s.emptyTitle}>No Active Field Requests</Text>
              <Text style={s.emptySub}>Select an agency button above to request field backup assistance</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE'];

export default function ContactsOrBackupScreen() {
  const { user } = useAuthStore();
  if (RESPONDER_ROLES.includes(user?.role)) return <BackupView user={user} />;
  return <ContactsView />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },

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
  mainPadding: { paddingHorizontal: 20 },

  /* Top 911 Emergency Card */
  emergencyBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff1f2',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#dc2626',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  emergencySirenBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  emergencyBannerLabel: { fontSize: 12, fontWeight: '800', color: '#dc2626', letterSpacing: 0.3 },
  emergencyBannerNum: { fontSize: 28, fontWeight: '900', color: '#dc2626', marginTop: 1 },
  emergencyCallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emergencyCallPillText: { color: '#ffffff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  /* Categorized Contacts Section */
  categorySection: { marginBottom: 20 },
  categoryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  categoryHeaderTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeaderTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a' },

  contactCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  contactIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfoCol: { flex: 1 },
  contactNameText: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  contactNumberText: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '500' },

  callRedPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  callRedPillText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },

  footerNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  footerNoticeText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 18 },

  /* Backup View Styles */
  backupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  backupCardTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  backupCardSub: { fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 18 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleBtn: { width: '30%', alignItems: 'center', borderWidth: 1.5, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6 },
  roleIconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },

  activeCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1.5, borderColor: '#dc2626', padding: 14, marginBottom: 10 },
  activeCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  activeCardTime: { fontSize: 11, color: '#94a3b8' },
  activeCardMsg: { fontSize: 13, color: '#374151', marginBottom: 10, lineHeight: 18 },
  rolePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#dc2626' },
  rolePillText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  mapsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff1f2', borderRadius: 10, padding: 10, marginBottom: 8 },
  mapsRowText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#dc2626', borderRadius: 12, paddingVertical: 10 },
  resolveBtnText: { fontSize: 13, fontWeight: '800', color: '#dc2626' },

  incomingCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 10 },
  incomingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  incomingName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  incomingMsg: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginBottom: 6, lineHeight: 18 },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 12, marginTop: 4 },
  mapsBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },

  emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 14, marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
