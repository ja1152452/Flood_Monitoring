import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { login } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';

const LOGO = require('../../assets/images/logo.png');
const LUMBAN_LOGO = require('../../assets/images/lumban lgo.jpg');
const APP_BG = require('../../assets/images/lumban-bg.jpg');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleLogin = async () => {
    setErrorMsg('');
    if (!email || !password) {
      const msg = 'Please enter email and password';
      setErrorMsg(msg);
      Toast.show({ type: 'error', text1: 'Login Required', text2: msg });
      return;
    }
    setLoading(true);
    try {
      const data = await login({ email: email.toLowerCase().trim(), password });
      await setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace('/(tabs)');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Network error';
      setErrorMsg(msg);
      Toast.show({ type: 'error', text1: 'Login Failed', text2: msg, visibilityTime: 8000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Full Page Custom Lumban Watermark Background */}
      <Image source={APP_BG} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* 1. Top Header Banner */}
          <View style={styles.topHeaderCard}>
            <View style={styles.topHeaderLeft}>
              <Image source={LUMBAN_LOGO} style={styles.lumbanLogoImg} resizeMode="contain" />
              <View>
                <Text style={styles.headerSubSmall}>BAYAN NG LUMBAN · LALAWIGAN NG LAGUNA</Text>
                <Text style={styles.headerMainTitle}>
                  Better <Text style={{ color: '#dc2626' }}>LUMBAN</Text>
                </Text>
                <Text style={styles.headerTagline}>MDRRMO Flood Monitoring System</Text>
              </View>
            </View>

            {/* Red Curved Accent Block */}
            <View style={styles.redHeaderBlock}>
              <Ionicons name="business" size={16} color="#ffffff" style={{ marginBottom: 2 }} />
              <Text style={styles.redBlockText}>Municipal Disaster Risk</Text>
              <Text style={styles.redBlockText}>Reduction Office</Text>
              <Text style={styles.redBlockSub}>Lumban Laguna</Text>
            </View>
          </View>

          {/* 2. Main Login Card */}
          <View style={styles.loginCard}>
            <View style={styles.cardHeaderBox}>
              {/* App Logo Tile with White Contrast Frame */}
              <View style={styles.appLogoSquare}>
                <Image source={LOGO} style={styles.appLogoImg} resizeMode="contain" />
              </View>

              <Text style={styles.welcomeTitle}>
                Welcome <Text style={{ color: '#dc2626' }}>Back!</Text>
              </Text>
              <Text style={styles.welcomeSub}>Sign in to your MDRRMO account</Text>
            </View>

            {/* Inline Error Alert Box */}
            {errorMsg ? (
              <View style={styles.errorAlertBox}>
                <Ionicons name="warning-outline" size={20} color="#dc2626" />
                <Text style={styles.errorAlertText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Email Field */}
            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <View style={styles.inputIconGroup}>
              <View style={styles.inputIconBox}>
                <Ionicons name="mail-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
              </View>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="mdrrmo@lumban.gov.ph"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Field */}
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.inputIconGroup}>
              <View style={styles.inputIconBox}>
                <Ionicons name="lock-closed-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
              </View>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPwd}
              />
              <TouchableOpacity style={styles.eyeToggleBtn} onPress={() => setShowPwd(v => !v)}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPassBtn} onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotPassText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnContentRow}>
                  <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                  <Text style={styles.signInBtnText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Divider Line */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Create Account Button */}
            <TouchableOpacity
              style={styles.createAccBtn}
              onPress={() => router.push('/(auth)/signup')}
              activeOpacity={0.85}>
              <View style={styles.btnContentRow}>
                <Ionicons name="person-add-outline" size={18} color="#dc2626" />
                <Text style={styles.createAccBtnText}>Create New Account</Text>
                <Ionicons name="arrow-forward" size={18} color="#dc2626" />
              </View>
            </TouchableOpacity>
          </View>

          {/* 3. Footer Line */}
          <View style={styles.footerRow}>
            <Ionicons name="shield-checkmark" size={14} color="#dc2626" />
            <Text style={styles.footerText}>
              Lumban, Laguna  •  Disaster Risk Reduction & Management System
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 30 },

  topHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  topHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  lumbanLogoImg: { width: 44, height: 44 },
  headerSubSmall: { fontSize: 7.5, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
  headerMainTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: 0.3 },
  headerTagline: { fontSize: 8, color: '#64748b', marginTop: 1 },

  redHeaderBlock: {
    backgroundColor: '#dc2626',
    borderTopLeftRadius: 32,
    borderBottomLeftRadius: 32,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 120,
  },
  redBlockText: { fontSize: 7, fontWeight: '800', color: '#ffffff', textAlign: 'center', lineHeight: 9 },
  redBlockSub: { fontSize: 7, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2, textAlign: 'center' },

  loginCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    marginBottom: 16,
  },
  cardHeaderBox: { alignItems: 'center', marginBottom: 18 },

  /* App Logo Frame (Clean White Box with Drop Shadow so Crest Logo stands out sharply) */
  appLogoSquare: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    padding: 6,
  },
  appLogoImg: { width: 52, height: 52 },

  welcomeTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  welcomeSub: { fontSize: 13, color: '#64748b', marginTop: 3 },

  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  
  inputIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    height: 50,
    marginBottom: 14,
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
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
    paddingVertical: 0,
  },
  eyeToggleBtn: { width: 48, height: '100%', justifyContent: 'center', alignItems: 'center' },

  forgotPassBtn: { alignSelf: 'flex-end', marginBottom: 18 },
  forgotPassText: { fontSize: 13, color: '#dc2626', fontWeight: '700' },

  signInBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnContentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signInBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },

  createAccBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#dc2626',
    borderRadius: 16,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAccBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '800' },

  errorAlertBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
    lineHeight: 18,
  },

  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  footerText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
});
