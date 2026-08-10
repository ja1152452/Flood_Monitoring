import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { forgotPassword, resetPassword } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import logo from '../assets/logo.png';
import lumbanLogo from '../assets/lumban lgo.jpg';
import lumbanBg from '../assets/lumban-bg.jpg';
import toast from 'react-hot-toast';

const EyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);
const EyeOn = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const inputCls = "w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition-all placeholder-slate-500";
const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' };

export default function Login() {
  const [form, setForm]             = useState({ email: '', password: '' });
  const [loading, setLoading]       = useState(false);
  const [showPwd, setShowPwd]       = useState(false);
  const { setAuth }                 = useAuthStore();
  const navigate                    = useNavigate();

  const [fpOpen,    setFpOpen]    = useState(false);
  const [fpStep,    setFpStep]    = useState(1);
  const [fpEmail,   setFpEmail]   = useState('');
  const [fpOtp,     setFpOtp]     = useState('');
  const [fpPwd,     setFpPwd]     = useState('');
  const [fpCfm,     setFpCfm]     = useState('');
  const [fpShowPwd, setFpShowPwd] = useState(false);
  const [fpShowCfm, setFpShowCfm] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(form);
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate(data.user?.role === 'MSWDO' ? '/mswdo' : '/');
    } catch {
      toast.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const openForgot = () => {
    setFpOpen(true); setFpStep(1);
    setFpEmail(''); setFpOtp(''); setFpPwd(''); setFpCfm('');
  };

  const handleSendCode = async () => {
    if (!fpEmail.trim()) { toast.error('Enter your email'); return; }
    setFpLoading(true);
    try {
      await forgotPassword(fpEmail.toLowerCase().trim());
      toast.success('Reset code sent! Check your email.');
      setFpStep(2);
    } catch {
      toast.error('Failed to send reset code. Try again.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleReset = async () => {
    if (fpOtp.length !== 6)  { toast.error('Enter the 6-digit code'); return; }
    if (fpPwd.length < 8)    { toast.error('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(fpPwd) || !/[a-z]/.test(fpPwd) || !/\d/.test(fpPwd))
      { toast.error('Password needs uppercase, lowercase & number'); return; }
    if (fpPwd !== fpCfm)     { toast.error('Passwords do not match'); return; }
    setFpLoading(true);
    try {
      await resetPassword(fpEmail.toLowerCase().trim(), fpOtp, fpPwd);
      toast.success('Password reset! You can now sign in.');
      setFpOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex flex-col"
      style={{
        backgroundImage: `url(${lumbanBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.82) 100%)'
      }} />

      {/* ── Top Red Banner ── */}
      <div className="relative z-10 w-full" style={{
        background: 'linear-gradient(90deg, #6b0000 0%, #c0392b 30%, #c0392b 70%, #6b0000 100%)',
        borderBottom: '2px solid rgba(255,200,200,0.15)',
      }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-8 py-3">
          <div className="flex items-center gap-3">
            <img src={lumbanLogo} alt="Bayan ng Lumban" className="w-12 h-12 object-contain drop-shadow-lg" />
            <div className="leading-tight">
              <p className="text-red-100 text-[10px] font-bold tracking-widest uppercase">Bayan ng Lumban</p>
              <p className="text-red-200 text-[10px] tracking-widest uppercase">Lalawigan ng Laguna</p>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-white font-black tracking-wide leading-none"
              style={{ fontSize: '1.75rem', textShadow: '1px 2px 10px rgba(0,0,0,0.6)' }}>
              Bett<span className="italic">ER</span> LUMBAN
            </h1>
            <p className="text-red-200 text-[10px] tracking-widest uppercase mt-0.5">MDRRMO Flood Monitoring System</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-red-100 text-[10px] font-bold tracking-widest uppercase">Municipal Disaster Risk Reduction</p>
              <p className="text-red-200 text-[10px] tracking-widest uppercase">and Management Office - Lumban Laguna</p>
            </div>
            <img src={logo} alt="Resilient Lumban" className="w-12 h-12 object-contain drop-shadow-lg opacity-90" />
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-5xl flex items-center gap-20">

          {/* Left — branding */}
          <div className="flex-1 hidden lg:flex flex-col gap-5">
            <div>
              <p className="text-red-400 text-xs font-bold tracking-widest uppercase mb-3">Municipality of Lumban, Laguna</p>
              <h2 className="text-white font-black leading-tight"
                style={{ fontSize: '3rem', textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}>
                Flood<br />Monitoring<br />System
              </h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Real-time flood detection and early warning system protecting the residents of Lumban, Laguna.
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {['🔴 Real-time Alerts', '📷 Live Camera', '🗺 Evacuation Maps', '🌧 Weather Data'].map(tag => (
                <span key={tag} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white/90"
                  style={{ background: 'rgba(185,28,28,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right — login card */}
          <div className="w-full max-w-sm flex-shrink-0">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl p-8 space-y-4"
              style={{
                background: 'rgba(8,12,28,0.90)',
                border: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 30px 70px rgba(0,0,0,0.7), 0 0 0 1px rgba(185,28,28,0.2)',
              }}
            >
              {/* Card header */}
              <div className="flex flex-col items-center mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)' }}>
                  <img src={logo} alt="logo" className="w-9 h-9 object-contain" />
                </div>
                <h2 className="text-xl font-bold text-white">Welcome Back</h2>
                <p className="text-slate-500 text-xs mt-1">Sign in to your MDRRMO account</p>
              </div>

              <div>
                <label htmlFor="email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Email Address
                </label>
                <input
                  type="email" id="email" name="email" autoComplete="email" required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={inputCls} style={inputStyle}
                  placeholder="mdrrmo@lumban.gov.ph"
                />
              </div>

              <div>
                <label htmlFor="password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'} id="password" name="password" autoComplete="current-password" required
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className={`${inputCls} pr-11`} style={inputStyle}
                    placeholder="Enter your password"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPwd ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <button type="button" onClick={openForgot}
                    className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors">
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 mt-1"
                style={{
                  background: 'linear-gradient(90deg, #991b1b, #dc2626)',
                  boxShadow: '0 4px 24px rgba(185,28,28,0.55)',
                }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Lumban, Laguna · Disaster Risk Reduction &amp; Management System
            </p>
          </div>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {fpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-8"
            style={{ background: 'rgba(8,12,28,0.97)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 70px rgba(0,0,0,0.8)' }}>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">
                {fpStep === 1 ? 'Forgot Password' : 'Reset Password'}
              </h2>
              <button onClick={() => setFpOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {fpStep === 1 ? (
              <div className="space-y-4">
                <p className="text-slate-400 text-sm">Enter your email to receive a 6-digit reset code.</p>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Email Address</label>
                  <input type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="your@email.com" />
                </div>
                <button onClick={handleSendCode} disabled={fpLoading}
                  className="w-full text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(90deg, #991b1b, #dc2626)' }}>
                  {fpLoading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-400 text-sm">Code sent to <span className="text-white font-medium">{fpEmail}</span></p>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Verification Code</label>
                  <input type="text" value={fpOtp} onChange={e => setFpOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    className="w-full rounded-xl px-4 py-3 text-white text-2xl font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-red-600 transition-all"
                    style={inputStyle} placeholder="000000" maxLength={6} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">New Password</label>
                  <div className="relative">
                    <input type={fpShowPwd ? 'text' : 'password'} value={fpPwd} onChange={e => setFpPwd(e.target.value)}
                      className={`${inputCls} pr-11`} style={inputStyle} placeholder="Min. 8 characters" />
                    <button type="button" onClick={() => setFpShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {fpShowPwd ? <EyeOff /> : <EyeOn />}
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {[
                      { rule: fpPwd.length >= 8,   text: 'At least 8 characters' },
                      { rule: /[A-Z]/.test(fpPwd), text: 'One uppercase letter' },
                      { rule: /[a-z]/.test(fpPwd), text: 'One lowercase letter' },
                      { rule: /\d/.test(fpPwd),    text: 'One number' },
                    ].map((item, i) => (
                      <p key={i} className={`text-xs ${item.rule ? 'text-green-400' : 'text-slate-600'}`}>
                        {item.rule ? '✓' : '○'} {item.text}
                      </p>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input type={fpShowCfm ? 'text' : 'password'} value={fpCfm} onChange={e => setFpCfm(e.target.value)}
                      className={`${inputCls} pr-11`} style={inputStyle} placeholder="Re-enter new password" />
                    <button type="button" onClick={() => setFpShowCfm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {fpShowCfm ? <EyeOff /> : <EyeOn />}
                    </button>
                  </div>
                  {fpCfm.length > 0 && (
                    <p className={`text-xs mt-1 ${fpCfm === fpPwd ? 'text-green-400' : 'text-red-400'}`}>
                      {fpCfm === fpPwd ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                <button onClick={handleReset} disabled={fpLoading}
                  className="w-full text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(90deg, #991b1b, #dc2626)' }}>
                  {fpLoading ? 'Resetting...' : 'Reset Password'}
                </button>

                <button onClick={() => { setFpStep(1); setFpOtp(''); }}
                  className="w-full text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  Didn't receive a code? Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
