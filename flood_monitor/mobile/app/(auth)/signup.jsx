import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Alert, Linking, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';

const LOGO = require('../../assets/images/logo.png');
const APP_BG = require('../../assets/images/lumban-bg.jpg');

const BARANGAYS = [
  'Bagong Silang', 'Balimbingan', 'Balubad', 'Caliraya',
  'Concepcion', 'Lewin', 'Maracta', 'Maytalang I', 'Maytalang II',
  'Poblacion', 'Primera Parang', 'Primera Pulo', 'Salac',
  'Segunda Parang', 'Segunda Pulo', 'Santo Niño', 'Wawa',
];

const INITIAL_FORM = {
  full_name: '',
  email: '',
  phone_number: '',
  barangay: '',
  password: '',
  confirm: '',
};

const INITIAL_ERRORS = {
  full_name: '',
  email: '',
  phone_number: '',
  barangay: '',
  password: '',
  confirm: '',
};

const Signup = () => {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showBarangay, setShowBarangay] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [touched, setTouched] = useState({});
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(100);
  const [codeExpiry, setCodeExpiry] = useState(120);
  const [pendingAuth, setPendingAuth] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);

  useEffect(() => {
    let interval;
    if (step === 3) {
      interval = setInterval(() => {
        setResendCooldown(c => Math.max(0, c - 1));
        setCodeExpiry(e => Math.max(0, e - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step]);

  const update = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) {
      setErrors(e => ({ ...e, [field]: '' }));
    }
  };

  const touch = (field) => {
    setTouched(t => ({ ...t, [field]: true }));
    validateField(field, form[field]);
  };

  const validateField = useCallback((field, value) => {
    let error = '';

    switch (field) {
      case 'full_name':
        if (!value.trim()) {
          error = 'Full name is required';
        } else if (value.trim().length < 2) {
          error = 'Full name must be at least 2 characters';
        } else if (!/^[a-zA-Z\s.'-]+$/.test(value.trim())) {
          error = 'Full name must contain alphabetic letters and valid text symbols only';
        }
        break;

      case 'email':
        if (!value.trim()) {
          error = 'Email address is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          error = 'Please enter a valid email address';
        }
        break;

      case 'phone_number':
        if (value.trim() && !/^09\d{9}$/.test(value.trim())) {
          error = 'Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)';
        }
        break;

      case 'barangay':
        if (!value) error = 'Please select your barangay';
        break;

      case 'password':
        if (!value) {
          error = 'Password is required';
        } else if (value.length < 8) {
          error = 'Password must be at least 8 characters';
        } else if (!/[A-Z]/.test(value)) {
          error = 'Password must have at least one uppercase letter';
        } else if (!/[a-z]/.test(value)) {
          error = 'Password must have at least one lowercase letter';
        } else if (!/\d/.test(value)) {
          error = 'Password must have at least one number';
        }
        break;

      case 'confirm':
        if (!value) {
          error = 'Please confirm your password';
        } else if (value !== form.password) {
          error = 'Passwords do not match';
        }
        break;
    }

    setErrors(e => ({ ...e, [field]: error }));
    return error;
  }, [form.password]);

  const validateStep1 = () => {
    const fields = ['full_name', 'email', 'barangay'];
    let isValid = true;

    fields.forEach(f => {
      const err = validateField(f, form[f]);
      if (err) isValid = false;
    });

    if (form.phone_number.trim()) {
      const err = validateField('phone_number', form.phone_number);
      if (err) isValid = false;
    }

    setTouched({ full_name: true, email: true, barangay: true, phone_number: true });
    return isValid;
  };

  const validateStep2 = () => {
    const passErr = validateField('password', form.password);
    const confirmErr = validateField('confirm', form.confirm);
    setTouched(t => ({ ...t, password: true, confirm: true }));
    return !passErr && !confirmErr;
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationGranted(true);
      Toast.show({
        type: 'success',
        text1: '📍 Location access granted',
        text2: 'Your location will be used for SOS and evacuation guidance',
      });
    } else {
      Alert.alert(
        'Location Access Required',
        'This app needs your location to:\n\n• Send your GPS coordinates during SOS rescue requests\n• Find the nearest open evacuation center\n• Alert MDRRMO of your exact position\n\nPlease enable location in your phone settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const goNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.toLowerCase().trim(),
        password: form.password,
        barangay: form.barangay,
      };

      if (form.phone_number.trim()) {
        payload.phone_number = form.phone_number.trim();
      }

      const { data } = await api.post('/auth/register', payload);

      if (data.data?.autoVerified) {
        Toast.show({ type: 'success', text1: '✅ Account created!', text2: 'Your account is ready. You can now log in.' });
        router.replace('/(auth)/login');
        return;
      }

      setPendingAuth(data.data);
      setResendCooldown(100);
      setCodeExpiry(120);
      Toast.show({ type: 'success', text1: 'Account created!', text2: 'Check your email for the verification code' });
      setStep(3);

    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors?.length > 0) {
        serverErrors.forEach(e => {
          setErrors(prev => ({ ...prev, [e.field]: e.message }));
        });
        Toast.show({ type: 'error', text1: 'Please fix the errors below' });
      } else {
        const msg = err.response?.data?.message || 'Registration failed. Please try again.';
        Toast.show({ type: 'error', text1: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setOtpError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify-email', {
        otp: otp.trim(),
        email: form.email.toLowerCase().trim(),
      }, {
        headers: pendingAuth?.accessToken ? { Authorization: `Bearer ${pendingAuth.accessToken}` } : {},
      });
      Toast.show({ type: 'success', text1: '✅ Email verified!', text2: 'You can now log in to your account' });
      router.replace('/(auth)/login');
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      await api.post('/auth/resend-otp', {
        email: form.email.toLowerCase().trim(),
      }, {
        headers: pendingAuth?.accessToken ? { Authorization: `Bearer ${pendingAuth.accessToken}` } : {},
      });
      Toast.show({ type: 'success', text1: 'Code resent!', text2: 'Check your email again' });
      setOtp('');
      setOtpError('');
      setResendCooldown(100);
      setCodeExpiry(120);
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to resend code' });
    } finally {
      setResending(false);
    }
  };

  const ErrorText = ({ field }) =>
    errors[field] && touched[field]
      ? <Text style={styles.errorText}>⚠ {errors[field]}</Text>
      : null;

  return (
    <View style={styles.screen}>
      {/* Page Background Image */}
      <Image source={APP_BG} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Top Bar Back Button */}
          <TouchableOpacity style={styles.topBackBtn} onPress={() => step === 2 ? setStep(1) : router.back()}>
            <Ionicons name="arrow-back" size={18} color="#dc2626" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Header Box: Official App Logo Frame instead of water drop */}
          <View style={styles.headerBox}>
            <View style={styles.appLogoSquare}>
              <Image source={LOGO} style={styles.appLogoImg} resizeMode="contain" />
            </View>
            <Text style={styles.mainTitle}>Create Account</Text>
            <Text style={styles.mainSubtitle}>Register as a Lumban resident</Text>
          </View>

          {/* 3-Step Progress Indicator Bar */}
          <View style={styles.stepBarContainer}>
            <View style={styles.stepItemCol}>
              <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumText, step >= 1 && styles.stepNumTextActive]}>1</Text>
              </View>
              <Text style={[styles.stepLabelText, step === 1 && styles.stepLabelActive]}>Personal Info</Text>
            </View>

            <View style={[styles.stepConnectLine, step >= 2 && styles.stepConnectLineActive]} />

            <View style={styles.stepItemCol}>
              <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumText, step >= 2 && styles.stepNumTextActive]}>2</Text>
              </View>
              <Text style={[styles.stepLabelText, step === 2 && styles.stepLabelActive]}>Set Password</Text>
            </View>

            <View style={[styles.stepConnectLine, step >= 3 && styles.stepConnectLineActive]} />

            <View style={styles.stepItemCol}>
              <View style={[styles.stepCircle, step >= 3 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumText, step >= 3 && styles.stepNumTextActive]}>3</Text>
              </View>
              <Text style={[styles.stepLabelText, step === 3 && styles.stepLabelActive]}>Review</Text>
            </View>
          </View>

          {/* ================= STEP 1: PERSONAL INFO ================= */}
          {step === 1 && (
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Personal Information</Text>

              {/* Full Name */}
              <Text style={styles.fieldLabel}>FULL NAME <Text style={styles.reqAsterisk}>*</Text></Text>
              <View style={styles.inputGroupRow}>
                <View style={styles.inputIconBox}>
                  <Ionicons name="person-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
                </View>
                <TextInput
                  style={styles.textInput}
                  value={form.full_name}
                  onChangeText={v => update('full_name', v.replace(/[^a-zA-Z\s.'-]/g, ''))}
                  onBlur={() => touch('full_name')}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                />
              </View>
              <ErrorText field="full_name" />

              {/* Email Address */}
              <Text style={styles.fieldLabel}>EMAIL ADDRESS <Text style={styles.reqAsterisk}>*</Text></Text>
              <View style={styles.inputGroupRow}>
                <View style={styles.inputIconBox}>
                  <Ionicons name="mail-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
                </View>
                <TextInput
                  style={styles.textInput}
                  value={form.email}
                  onChangeText={v => update('email', v)}
                  onBlur={() => touch('email')}
                  placeholder="example@email.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <ErrorText field="email" />

              {/* Phone Number (Optional) */}
              <Text style={styles.fieldLabel}>
                PHONE NUMBER <Text style={styles.optLabel}>(OPTIONAL)</Text>
              </Text>
              <View style={styles.inputGroupRow}>
                <View style={styles.inputIconBox}>
                  <Ionicons name="call-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
                </View>
                <TextInput
                  style={styles.textInput}
                  value={form.phone_number}
                  onChangeText={v => update('phone_number', v.replace(/[^0-9]/g, '').slice(0, 11))}
                  onBlur={() => form.phone_number.trim() && touch('phone_number')}
                  placeholder="09171234567"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  maxLength={11}
                />
              </View>
              <Text style={styles.hintSubText}>Format: Exactly 11 digits starting with 09 (e.g. 09171234567)</Text>
              <ErrorText field="phone_number" />

              {/* Barangay Dropdown */}
              <Text style={styles.fieldLabel}>BARANGAY <Text style={styles.reqAsterisk}>*</Text></Text>
              <View style={styles.inputGroupRow}>
                <View style={styles.inputIconBox}>
                  <Ionicons name="location-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
                </View>
                <TouchableOpacity
                  style={[styles.textInput, styles.pickerSelectBtn]}
                  onPress={() => setShowBarangay(v => !v)}>
                  <Text style={{ color: form.barangay ? '#0f172a' : '#94a3b8', fontSize: 14, fontWeight: '500' }}>
                    {form.barangay || 'Select your barangay'}
                  </Text>
                  <Ionicons name="caret-down-sharp" size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ErrorText field="barangay" />

              {showBarangay && (
                <View style={styles.dropdownContainer}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {BARANGAYS.map(b => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.dropRow, form.barangay === b && styles.dropRowActive]}
                        onPress={() => {
                          update('barangay', b);
                          setTouched(t => ({ ...t, barangay: true }));
                          setShowBarangay(false);
                        }}>
                        <Text style={[styles.dropItemText, form.barangay === b && { color: '#dc2626', fontWeight: '700' }]}>
                          {form.barangay === b ? '✓ ' : ''}{b}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Allow Location Access Box */}
              <TouchableOpacity style={styles.locAccessBox} onPress={requestLocation} activeOpacity={0.85}>
                <View style={styles.locRedPinCircle}>
                  <Ionicons name="location" size={20} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locAccessTitle}>Allow Location Access</Text>
                  <Text style={styles.locAccessSub}>
                    Needed for SOS rescue and finding the nearest evacuation center
                  </Text>
                </View>
                <View style={[styles.allowBtnPill, locationGranted && { backgroundColor: '#16a34a' }]}>
                  <Text style={styles.allowBtnText}>{locationGranted ? '✓ Done' : 'Allow'}</Text>
                </View>
              </TouchableOpacity>

              {!locationGranted && (
                <View style={styles.warningYellowBanner}>
                  <Ionicons name="warning" size={16} color="#d97706" />
                  <Text style={styles.warningBannerText}>
                    Location is required for the SOS rescue feature to work properly.
                  </Text>
                </View>
              )}

              {/* Action Button */}
              <TouchableOpacity style={styles.continueBtn} onPress={goNext} activeOpacity={0.85}>
                <View style={styles.btnRowContent}>
                  <Text style={styles.continueBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 2: SET PASSWORD & SUMMARY ================= */}
          {step === 2 && (
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Set Your Password</Text>

              {/* User Summary Box */}
              <View style={styles.userSummaryBox}>
                <View style={styles.summaryRowItem}>
                  <Ionicons name="person-outline" size={16} color="#dc2626" />
                  <Text style={styles.summaryValText}>{form.full_name || 'Resident Name'}</Text>
                </View>
                <View style={styles.summaryRowItem}>
                  <Ionicons name="mail-outline" size={16} color="#dc2626" />
                  <Text style={styles.summaryValText}>{form.email || 'email@example.com'}</Text>
                </View>
                <View style={styles.summaryRowItem}>
                  <Ionicons name="location-outline" size={16} color="#dc2626" />
                  <Text style={styles.summaryValText}>{form.barangay || 'Lumban'}</Text>
                </View>
                {form.phone_number ? (
                  <View style={styles.summaryRowItem}>
                    <Ionicons name="call-outline" size={16} color="#dc2626" />
                    <Text style={styles.summaryValText}>{form.phone_number}</Text>
                  </View>
                ) : null}
              </View>

              {/* Password */}
              <Text style={styles.fieldLabel}>PASSWORD <Text style={styles.reqAsterisk}>*</Text></Text>
              <View style={styles.inputGroupRow}>
                <View style={styles.inputIconBox}>
                  <Ionicons name="lock-closed-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
                </View>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={form.password}
                  onChangeText={v => update('password', v)}
                  onBlur={() => touch('password')}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPwd}
                />
                <TouchableOpacity style={styles.eyeToggleBtn} onPress={() => setShowPwd(v => !v)}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Password Checklist Box */}
              <View style={styles.pwdRulesBox}>
                {[
                  { rule: form.password.length >= 8, text: 'At least 8 characters' },
                  { rule: /[A-Z]/.test(form.password), text: 'One uppercase letter (A-Z)' },
                  { rule: /[a-z]/.test(form.password), text: 'One lowercase letter (a-z)' },
                  { rule: /\d/.test(form.password), text: 'One number (0-9)' },
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: item.rule ? '#16a34a' : '#dc2626', fontWeight: '800' }}>
                      {item.rule ? '✓' : '○'}
                    </Text>
                    <Text style={[styles.ruleTextLabel, item.rule && { color: '#16a34a', fontWeight: '600' }]}>
                      {item.text}
                    </Text>
                  </View>
                ))}
              </View>
              <ErrorText field="password" />

              {/* Confirm Password */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                CONFIRM PASSWORD <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={styles.inputGroupRow}>
                <View style={styles.inputIconBox}>
                  <Ionicons name="lock-closed-outline" size={18} color="#dc2626" style={{ textAlign: 'center' }} />
                </View>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={form.confirm}
                  onChangeText={v => update('confirm', v)}
                  onBlur={() => touch('confirm')}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showCfm}
                />
                <TouchableOpacity style={styles.eyeToggleBtn} onPress={() => setShowCfm(v => !v)}>
                  <Ionicons name={showCfm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ErrorText field="confirm" />

              {/* Terms Notice Box */}
              <View style={styles.noticeOrangeBanner}>
                <Ionicons name="shield-checkmark" size={20} color="#ea580c" />
                <Text style={styles.noticeBannerText}>
                  By creating an account you agree to allow the system to send you flood alerts and emergency notifications for your safety.
                </Text>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.continueBtn, loading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.btnRowContent}>
                    <Text style={styles.continueBtnText}>Create Account</Text>
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 3: REVIEW / VERIFY ================= */}
          {step === 3 && (
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Verify Your Email</Text>
              <View style={styles.noticeOrangeBanner}>
                <Ionicons name="mail" size={20} color="#ea580c" />
                <Text style={styles.noticeBannerText}>
                  We sent a 6-digit verification code to{' '}
                  <Text style={{ fontWeight: '800' }}>{form.email}</Text>. Please check your inbox.
                </Text>
              </View>

              {/* 2-Minute Expiry Countdown Badge */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: codeExpiry === 0 ? '#fee2e2' : '#f8fafc',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: codeExpiry === 0 ? '#fca5a5' : '#e2e8f0',
                marginVertical: 12,
                gap: 6,
              }}>
                <Ionicons name="time-outline" size={18} color={codeExpiry === 0 ? '#dc2626' : '#ea580c'} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: codeExpiry === 0 ? '#dc2626' : '#475569' }}>
                  {codeExpiry > 0 
                    ? `Code expires in: ${Math.floor(codeExpiry / 60).toString().padStart(2, '0')}:${(codeExpiry % 60).toString().padStart(2, '0')}`
                    : 'Code expired (2 min limit). Please tap Resend.'}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>VERIFICATION CODE <Text style={styles.reqAsterisk}>*</Text></Text>
              <TextInput
                style={[styles.textInput, { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '800', height: 56 }]}
                value={otp}
                onChangeText={v => { setOtp(v.replace(/[^0-9]/g, '').slice(0, 6)); setOtpError(''); }}
                placeholder="000000"
                placeholderTextColor="#cbd5e1"
                keyboardType="number-pad"
                maxLength={6}
              />
              {otpError ? <Text style={styles.errorText}>⚠ {otpError}</Text> : null}

              <TouchableOpacity
                style={[styles.continueBtn, (loading || codeExpiry === 0) && { opacity: 0.6 }]}
                onPress={handleVerifyOtp}
                disabled={loading || codeExpiry === 0}
                activeOpacity={0.85}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.continueBtnText}>Verify Email ✓</Text>
                )}
              </TouchableOpacity>

              {/* Resend Code Button with 100-Second Cooldown */}
              <TouchableOpacity
                style={{ alignItems: 'center', marginTop: 16, opacity: (resending || resendCooldown > 0) ? 0.6 : 1 }}
                onPress={handleResendOtp}
                disabled={resending || resendCooldown > 0}>
                <Text style={{ color: resendCooldown > 0 ? '#64748b' : '#dc2626', fontSize: 14, fontWeight: '700' }}>
                  {resending 
                    ? 'Resending code...' 
                    : resendCooldown > 0 
                      ? `Didn't get code? Resend in ${resendCooldown}s` 
                      : "Didn't receive a code? Resend Code"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Already Have Account */}
          <TouchableOpacity onPress={() => router.back()} style={styles.loginLinkRow}>
            <Text style={styles.loginLinkText}>Already have an account? <Text style={{ color: '#dc2626' }}>Sign In</Text></Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default Signup;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 52, paddingBottom: 40 },

  topBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  backText: { color: '#dc2626', fontSize: 15, fontWeight: '700' },

  /* Header Box */
  headerBox: { alignItems: 'center', marginBottom: 20 },

  /* Official App Logo Tile for Signup Header */
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

  mainTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  mainSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },

  /* 3-Step Progress Indicator Bar */
  stepBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    marginBottom: 24,
  },
  stepItemCol: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: '#dc2626' },
  stepNumText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
  stepNumTextActive: { color: '#ffffff' },
  stepLabelText: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  stepLabelActive: { color: '#dc2626' },
  stepConnectLine: { flex: 1, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: 6, marginBottom: 14 },
  stepConnectLineActive: { backgroundColor: '#dc2626' },

  /* Main Form Card */
  formCard: {
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
    marginBottom: 20,
  },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 18 },

  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.5, marginBottom: 6, marginTop: 6 },
  reqAsterisk: { color: '#dc2626' },
  optLabel: { color: '#94a3b8', fontWeight: '400' },

  inputGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    height: 50,
    marginBottom: 4,
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
  pickerSelectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyeToggleBtn: { width: 48, height: '100%', justifyContent: 'center', alignItems: 'center' },

  hintSubText: { fontSize: 11, color: '#94a3b8', marginBottom: 10, marginTop: 2 },
  errorText: { fontSize: 12, color: '#dc2626', marginBottom: 8, marginTop: 2, fontWeight: '600' },

  dropdownContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    marginBottom: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropRow: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropRowActive: { backgroundColor: '#fff1f2' },
  dropItemText: { fontSize: 14, color: '#475569' },

  /* Allow Location Box */
  locAccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff1f2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 14,
    marginTop: 14,
    marginBottom: 12,
  },
  locRedPinCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locAccessTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  locAccessSub: { fontSize: 11, color: '#64748b', lineHeight: 16, marginTop: 2 },
  allowBtnPill: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  allowBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },

  warningYellowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fefce8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fef08a',
    padding: 12,
    marginBottom: 16,
  },
  warningBannerText: { flex: 1, fontSize: 12, color: '#d97706', lineHeight: 16, fontWeight: '600' },

  continueBtn: {
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
    marginTop: 10,
  },
  btnRowContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  continueBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  userSummaryBox: {
    backgroundColor: '#fff1f2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  summaryRowItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryValText: { fontSize: 13, color: '#0f172a', fontWeight: '700' },

  pwdRulesBox: { backgroundColor: '#fff1f2', borderRadius: 14, padding: 12, gap: 6, borderWidth: 1, borderColor: '#fca5a5', marginBottom: 12 },
  ruleTextLabel: { fontSize: 12, color: '#dc2626', fontWeight: '500' },

  noticeOrangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 12,
    marginVertical: 14,
  },
  noticeBannerText: { flex: 1, fontSize: 12, color: '#ea580c', lineHeight: 16, fontWeight: '600' },

  loginLinkRow: { alignItems: 'center', marginVertical: 16 },
  loginLinkText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
});