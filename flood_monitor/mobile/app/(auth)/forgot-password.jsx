import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { forgotPassword, resetPassword } from '../../api/auth';
import Toast from 'react-native-toast-message';

export default function ForgotPassword() {
  const router = useRouter();

  const [step,     setStep]     = useState(1); // 1=email, 2=otp+newpwd
  const [email,    setEmail]    = useState('');
  const [otp,      setOtp]      = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [showCfm,  setShowCfm]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter your email' });
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email.toLowerCase().trim());
      Toast.show({ type: 'success', text1: 'Reset code sent!', text2: 'Check your email inbox' });
      setStep(2);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to send reset code. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (otp.length !== 6) {
      Toast.show({ type: 'error', text1: 'Enter the 6-digit code' }); return;
    }
    if (password.length < 8) {
      Toast.show({ type: 'error', text1: 'Password must be at least 8 characters' }); return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      Toast.show({ type: 'error', text1: 'Password needs uppercase, lowercase & number' }); return;
    }
    if (password !== confirm) {
      Toast.show({ type: 'error', text1: 'Passwords do not match' }); return;
    }
    setLoading(true);
    try {
      await resetPassword(email.toLowerCase().trim(), otp, password);
      Toast.show({ type: 'success', text1: '✅ Password reset!', text2: 'You can now sign in' });
      router.replace('/(auth)/login');
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.message || 'Invalid or expired code' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="lock-closed" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Enter your email to receive a reset code'
              : `Enter the code sent to ${email}`}
          </Text>
        </View>

        <View style={styles.form}>
          {step === 1 ? (
            <>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.button, loading && { opacity: 0.6 }]}
                onPress={handleSendCode}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Send Reset Code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '700' }]}
                value={otp}
                onChangeText={v => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor="#334155"
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPwd}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd(v => !v)}>
                  <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={styles.passwordRules}>
                {[
                  { rule: password.length >= 8,   text: 'At least 8 characters' },
                  { rule: /[A-Z]/.test(password), text: 'One uppercase letter' },
                  { rule: /[a-z]/.test(password), text: 'One lowercase letter' },
                  { rule: /\d/.test(password),    text: 'One number' },
                ].map((item, i) => (
                  <Text key={i} style={{ fontSize: 12, color: item.rule ? '#22c55e' : '#475569' }}>
                    {item.rule ? '✓' : '○'} {item.text}
                  </Text>
                ))}
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Confirm New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showCfm}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCfm(v => !v)}>
                  <Ionicons name={showCfm ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              {confirm.length > 0 && (
                <Text style={{ fontSize: 12, marginBottom: 8, color: confirm === password ? '#22c55e' : '#ef4444' }}>
                  {confirm === password ? '✓ Passwords match' : '✗ Passwords do not match'}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.button, loading && { opacity: 0.6 }]}
                onPress={handleReset}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Reset Password</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep(1); setOtp(''); }}>
                <Text style={styles.resendText}>Didn't receive a code? Try again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flexGrow: 1, backgroundColor: '#080c18', paddingHorizontal: 24, paddingVertical: 40 },
  backRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backText:     { fontSize: 15, fontWeight: '600', color: '#94a3b8' },
  header:       { alignItems: 'center', marginBottom: 32 },
  iconBox:      { width: 64, height: 64, borderRadius: 18, backgroundColor: '#b91c1c', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:        { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle:     { fontSize: 13, color: '#64748b', marginTop: 6, textAlign: 'center' },
  form:         { backgroundColor: 'rgba(15,23,42,0.92)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  label:        { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:        { backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#fff', marginBottom: 16 },
  passwordRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, marginBottom: 8 },
  eyeBtn:       { paddingHorizontal: 14 },
  passwordRules:{ backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: 10, padding: 12, marginBottom: 8, gap: 4, borderWidth: 1, borderColor: '#1e293b' },
  button:       { backgroundColor: '#b91c1c', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: '#b91c1c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  buttonText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn:    { alignItems: 'center', marginTop: 16 },
  resendText:   { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
});
