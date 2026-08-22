import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, Modal,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { updateProfile, changePassword, uploadAvatar } from '../../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import api from '../../api/axios';
import { API_URL } from '../../api/axios';
import { SirenBanner } from '../../components/SirenBanner';

const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE'];

const LUMBAN_BARANGAYS = [
  'Bagong Silang', 'Balimbingan', 'Balubad', 'Caliraya',
  'Concepcion', 'Lewin', 'Maracta', 'Maytalang I',
  'Maytalang II', 'Primera Parang', 'Primera Pulo', 'Salac',
  'Segunda Parang', 'Segunda Pulo', 'Santo Niño', 'Wawa',
];

export default function ProfileScreen() {
  const { user, setAuth, logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const isResponder = RESPONDER_ROLES.includes(user?.role);

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [selectedBarangay, setSelectedBarangay] = useState(user?.barangay_name || 'Balimbingan (Poblacion)');
  const [showBarangayModal, setShowBarangayModal] = useState(false);

  // Change password state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCfm, setShowCfm] = useState(false);

  const BASE_URL = API_URL.replace('/api/v1', '');
  const avatarUri = user?.avatar_url ? `${BASE_URL}${user.avatar_url}` : null;

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      const fresh = await api.get('/auth/me').then(r => r.data.data);
      const token = (await import('@react-native-async-storage/async-storage')).default;
      const t = await token.getItem('accessToken');
      const rt = await token.getItem('refreshToken');
      await setAuth(fresh, t, rt);
      setIsEditing(false);
      Toast.show({ type: 'success', text1: 'Profile updated successfully ✓' });
    },
    onError: (err) => Toast.show({ type: 'error', text1: err.response?.data?.message || 'Update failed' }),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ cur, nw }) => changePassword(cur, nw),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Password changed successfully ✓' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    },
    onError: (err) => Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to change password' }),
  });

  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async () => {
      const t = await AsyncStorage.getItem('accessToken');
      const rt = await AsyncStorage.getItem('refreshToken');
      const fresh = await api.get('/auth/me').then(r => r.data.data);
      await setAuth(fresh, t, rt);
      Toast.show({ type: 'success', text1: 'Photo updated ✓' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to upload photo' }),
  });

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to upload a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append('avatar', {
      uri: asset.uri,
      name: `avatar.${asset.uri.split('.').pop()}`,
      type: `image/${asset.uri.split('.').pop()}`,
    });
    avatarMutation.mutate(form);
  };

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      Toast.show({ type: 'error', text1: 'Full name is required' }); return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(fullName.trim())) {
      Toast.show({ type: 'error', text1: 'Full name must contain alphabetic letters and valid text symbols only' }); return;
    }
    const payload = { full_name: fullName.trim() };
    if (!isResponder) {
      const trimmedPhone = phone.trim();
      if (trimmedPhone && !/^09\d{9}$/.test(trimmedPhone)) {
        Toast.show({ type: 'error', text1: 'Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)' }); return;
      }
      payload.phone_number = trimmedPhone || null;
      payload.barangay = selectedBarangay;
    }
    profileMutation.mutate(payload);
  };

  const handleChangePassword = () => {
    if (!currentPwd) { Toast.show({ type: 'error', text1: 'Enter current password' }); return; }
    if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[a-z]/.test(newPwd) || !/\d/.test(newPwd)) {
      Toast.show({ type: 'error', text1: 'Password needs 8+ chars, uppercase, lowercase & number' }); return;
    }
    if (newPwd !== confirmPwd) { Toast.show({ type: 'error', text1: 'Passwords do not match' }); return; }
    passwordMutation.mutate({ cur: currentPwd, nw: newPwd });
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        }
      },
    ]);
  };

  const roleLabel = {
    CITIZEN: 'Resident',
    PNP: 'Philippine National Police',
    BFP: 'Bureau of Fire Protection',
    RHU: 'Rural Health Unit',
    MDRRMO: 'MDRRMO',
    MDRRMO_RESPONDER: 'MDRRMO Responder',
    BARANGAY_OFFICIAL: 'Barangay Official',
    RESCUE: 'Rescue Team',
    ADMIN: 'Administrator',
    SUPER_ADMIN: 'Super Administrator',
    MSWDO: 'MSWDO',
  }[user?.role] || user?.role;

  return (
    <View style={s.screen}>
      {/* Curved Red Top Header Container */}
      <View style={s.redHeader}>
        <Text style={s.redHeaderTitle}>My Profile</Text>
        <Text style={s.redHeaderSub}>Manage your account information</Text>
      </View>

      <ScrollView style={s.bodyScroll} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <SirenBanner />

        {/* Avatar & User Header Box */}
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={avatarMutation.isPending} activeOpacity={0.85}>
            <View style={s.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImg} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Ionicons name="person" size={44} color="#dc2626" />
                </View>
              )}
              {/* Perfectly positioned camera badge */}
              <View style={s.avatarBadge}>
                {avatarMutation.isPending
                  ? <ActivityIndicator size={10} color="#fff" />
                  : <Ionicons name="camera" size={14} color="#fff" />}
              </View>
            </View>
          </TouchableOpacity>

          <Text style={s.avatarName}>{user?.full_name || 'Test User'}</Text>
          <View style={s.roleBadgePill}>
            <Text style={s.roleBadgeText}>{roleLabel}</Text>
          </View>
        </View>

        <View style={s.mainPadding}>
          {/* Card 1: PROFILE INFORMATION */}
          <View style={s.cardContainer}>
            <View style={s.cardTitleRow}>
              <View style={s.titleRedIconBox}>
                <Ionicons name="person-outline" size={16} color="#dc2626" style={{ textAlign: 'center' }} />
              </View>
              <Text style={s.cardTitleText}>PROFILE INFORMATION</Text>
            </View>

            {/* FULL NAME */}
            <Text style={s.fieldLabel}>FULL NAME</Text>
            <View style={s.inputGroupRow}>
              <View style={s.inputIconBox}>
                <Ionicons name="person-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
              </View>
              <TextInput
                style={s.textInput}
                value={fullName}
                onChangeText={v => setFullName(v.replace(/[^a-zA-Z\s.'-]/g, ''))}
                editable={isEditing}
                placeholder="Enter full name"
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
              />
            </View>

            {/* PHONE NUMBER */}
            {!isResponder && (
              <>
                <Text style={s.fieldLabel}>PHONE NUMBER</Text>
                <View style={s.inputGroupRow}>
                  <View style={s.inputIconBox}>
                    <Ionicons name="call-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
                  </View>
                  <TextInput
                    style={s.textInput}
                    value={phone}
                    onChangeText={v => setPhone(v.replace(/[^0-9]/g, '').slice(0, 11))}
                    editable={isEditing}
                    placeholder="09171234567"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    maxLength={11}
                  />
                </View>
                <Text style={s.hintSubText}>Format: Exactly 11 digits starting with 09 (e.g. 09171234567)</Text>

                {/* BARANGAY SELECTION */}
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>BARANGAY (LUMBAN)</Text>
                <TouchableOpacity
                  style={[s.inputGroupRow, !isEditing && { backgroundColor: '#f1f5f9' }]}
                  onPress={() => isEditing && setShowBarangayModal(true)}
                  disabled={!isEditing}
                  activeOpacity={0.8}>
                  <View style={s.inputIconBox}>
                    <Ionicons name="location-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
                  </View>
                  <Text style={[s.textInput, { flex: 1, paddingTop: 12, color: selectedBarangay ? '#0f172a' : '#94a3b8' }]}>
                    {selectedBarangay || 'Select Barangay'}
                  </Text>
                  {isEditing && (
                    <Ionicons name="chevron-down-outline" size={18} color="#dc2626" style={{ marginRight: 12 }} />
                  )}
                </TouchableOpacity>
                <Text style={s.hintSubText}>Select your Barangay in Lumban, Laguna</Text>
              </>
            )}

            {/* Toggle Edit Profile Mode */}
            {!isEditing ? (
              <TouchableOpacity
                style={s.editProfileBtn}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.85}>
                <View style={s.btnContentRow}>
                  <Ionicons name="create-outline" size={16} color="#ffffff" />
                  <Text style={s.editProfileBtnText}>Edit Profile</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={s.actionsTwoCol}>
                <TouchableOpacity
                  style={s.cancelOutlinedBtn}
                  onPress={() => {
                    setFullName(user?.full_name || '');
                    setPhone(user?.phone_number || '');
                    setIsEditing(false);
                  }}
                  activeOpacity={0.8}>
                  <Text style={s.cancelOutlinedText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.saveRedBtn, profileMutation.isPending && { opacity: 0.6 }]}
                  onPress={handleSaveProfile}
                  disabled={profileMutation.isPending}
                  activeOpacity={0.85}>
                  {profileMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={s.btnContentRow}>
                      <Ionicons name="save-outline" size={16} color="#ffffff" />
                      <Text style={s.saveRedBtnText}>Save Changes</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Card 2: SECURITY */}
          <View style={s.cardContainer}>
            <View style={s.cardTitleRow}>
              <View style={s.titleRedIconBox}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#dc2626" style={{ textAlign: 'center' }} />
              </View>
              <Text style={s.cardTitleText}>SECURITY</Text>
            </View>

            {/* CURRENT PASSWORD */}
            <Text style={s.fieldLabel}>CURRENT PASSWORD</Text>
            <View style={s.inputGroupRow}>
              <View style={s.inputIconBox}>
                <Ionicons name="lock-closed-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
              </View>
              <TextInput
                style={[s.textInput, { flex: 1 }]}
                value={currentPwd}
                onChangeText={setCurrentPwd}
                placeholder="Enter current password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showCur}
              />
              <TouchableOpacity style={s.eyeToggleBtn} onPress={() => setShowCur(v => !v)}>
                <Ionicons name={showCur ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* NEW PASSWORD */}
            <Text style={s.fieldLabel}>NEW PASSWORD</Text>
            <View style={s.inputGroupRow}>
              <View style={s.inputIconBox}>
                <Ionicons name="lock-closed-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
              </View>
              <TextInput
                style={[s.textInput, { flex: 1 }]}
                value={newPwd}
                onChangeText={setNewPwd}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showNew}
              />
              <TouchableOpacity style={s.eyeToggleBtn} onPress={() => setShowNew(v => !v)}>
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* CONFIRM NEW PASSWORD */}
            <Text style={s.fieldLabel}>CONFIRM NEW PASSWORD</Text>
            <View style={s.inputGroupRow}>
              <View style={s.inputIconBox}>
                <Ionicons name="lock-closed-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
              </View>
              <TextInput
                style={[s.textInput, { flex: 1 }]}
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                placeholder="Re-enter new password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showCfm}
              />
              <TouchableOpacity style={s.eyeToggleBtn} onPress={() => setShowCfm(v => !v)}>
                <Ionicons name={showCfm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {newPwd.length > 0 && (
              <View style={s.pwdRulesBox}>
                {[
                  { ok: newPwd.length >= 8, text: 'At least 8 characters' },
                  { ok: /[A-Z]/.test(newPwd), text: 'One uppercase letter' },
                  { ok: /[a-z]/.test(newPwd), text: 'One lowercase letter' },
                  { ok: /\d/.test(newPwd), text: 'One number' },
                ].map((r, i) => (
                  <Text key={i} style={{ fontSize: 11, color: r.ok ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                    {r.ok ? '✓' : '○'} {r.text}
                  </Text>
                ))}
              </View>
            )}

            {/* Update Password Button */}
            <TouchableOpacity
              style={[s.saveRedBtn, { marginTop: 14 }, passwordMutation.isPending && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={passwordMutation.isPending}
              activeOpacity={0.85}>
              {passwordMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={s.btnContentRow}>
                  <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
                  <Text style={s.saveRedBtnText}>Update Password</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity style={s.logoutOutlinedBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color="#dc2626" />
            <Text style={s.logoutOutlinedText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Barangay Selection Modal */}
      <Modal visible={showBarangayModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Select Barangay (Lumban)</Text>
              <TouchableOpacity onPress={() => setShowBarangayModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {LUMBAN_BARANGAYS.map((bName) => (
                <TouchableOpacity
                  key={bName}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: selectedBarangay === bName ? '#fee2e2' : '#f8fafc',
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={() => {
                    setSelectedBarangay(bName);
                    setShowBarangayModal(false);
                  }}>
                  <Text style={{ fontSize: 15, fontWeight: selectedBarangay === bName ? '800' : '600', color: selectedBarangay === bName ? '#dc2626' : '#334155' }}>
                    {bName}
                  </Text>
                  {selectedBarangay === bName && (
                    <Ionicons name="checkmark-circle" size={20} color="#dc2626" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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

  /* Avatar & Header Box */
  avatarSection: { alignItems: 'center', paddingVertical: 16 },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatarImg: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#ffffff' },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fca5a5',
  },

  /* Camera Badge Positioned Cleanly inside the avatar bounds */
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  avatarName: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  roleBadgePill: {
    backgroundColor: '#fff1f2',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  roleBadgeText: { fontSize: 12, fontWeight: '800', color: '#dc2626' },

  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  titleRedIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleText: { fontSize: 12, fontWeight: '900', color: '#dc2626', letterSpacing: 0.8 },

  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },

  inputGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    height: 50,
    marginBottom: 10,
  },
  inputIconBox: {
    width: 48,
    height: '100%',
    backgroundColor: '#fff1f2',
    borderRightWidth: 1.5,
    borderRightColor: '#fecdd3',
    borderTopLeftRadius: 12.5,
    borderBottomLeftRadius: 12.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  eyeToggleBtn: { width: 48, height: '100%', justifyContent: 'center', alignItems: 'center' },
  hintSubText: { fontSize: 11, color: '#94a3b8', marginBottom: 12, marginTop: -4 },

  /* Edit Profile Button */
  editProfileBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  editProfileBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },

  /* Two Column Action Buttons */
  actionsTwoCol: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelOutlinedBtn: {
    flex: 1,
    borderRadius: 14,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#dc2626',
  },
  cancelOutlinedText: { fontSize: 14, fontWeight: '800', color: '#dc2626' },

  saveRedBtn: {
    flex: 1,
    borderRadius: 14,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnContentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveRedBtnText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },

  pwdRulesBox: { backgroundColor: '#fff1f2', borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: '#fca5a5', marginTop: 4 },

  /* Sign Out Button */
  logoutOutlinedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
    marginBottom: 20,
  },
  logoutOutlinedText: { fontSize: 15, fontWeight: '800', color: '#dc2626' },
});
