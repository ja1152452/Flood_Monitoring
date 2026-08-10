import { NavLink } from 'react-router-dom';
import logo from '../../assets/logo.png';
import lumbanLogo from '../../assets/lumban lgo.jpg';
import {
  LayoutDashboard, Users, FileText,
  Bell, UserCircle, LogOut, Sun, Moon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Toaster } from 'react-hot-toast';

const NAV = [
  { to: '/mswdo',              icon: LayoutDashboard, label: 'Dashboard',         end: true },
  { to: '/mswdo/evacuees',     icon: Users,           label: 'Evacuee Management' },
  { to: '/mswdo/reports',      icon: FileText,        label: 'Reports'            },
  { to: '/mswdo/notifications',icon: Bell,            label: 'Notifications'      },
  { to: '/mswdo/profile',      icon: UserCircle,      label: 'Profile Settings'   },
];

export function MswdoLayout({ children }) {
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      color: 'rgb(var(--text-base))',
      backgroundColor: 'rgb(var(--bg-base))',
      transition: 'background-color 0.2s, color 0.2s',
    }}>
      <div style={{ display: 'flex', width: '100%' }}>
        {/* Sidebar */}
        <aside style={isDark ? {
          width: '16rem', minHeight: '100vh',
          background: 'rgb(var(--bg-card))',
          borderRight: '1px solid rgb(var(--border-color))',
          display: 'flex', flexDirection: 'column',
          boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
        } : {
          width: '16rem', minHeight: '100vh',
          background: 'rgb(var(--bg-card-deep))',
          borderRight: '1px solid rgb(var(--border-color))',
          display: 'flex', flexDirection: 'column',
          boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
        }}>
          {/* Red banner — matches login */}
          <div style={{
            background: 'linear-gradient(90deg, #6b0000 0%, #c0392b 40%, #c0392b 60%, #6b0000 100%)',
            borderBottom: '1px solid rgba(255,200,200,0.12)',
            padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'center', gap: '0.625rem',
          }}>
            <img src={lumbanLogo} alt="Lumban" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fecaca', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.2 }}>BetterER Lumban</div>
              <div style={{ color: '#fca5a5', fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.2 }}>MSWDO Portal</div>
            </div>
            <img src={logo} alt="Logo" style={{ width: 30, height: 30, objectFit: 'contain', opacity: 0.9 }} />
          </div>

          {/* Center badge */}
          {user?.evacuation_center_name && (
            <div style={{ margin: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', background: isDark ? 'rgba(30,58,95,0.5)' : 'rgb(var(--bg-base))', border: '1px solid rgba(59,130,246,0.3)' }}>
              <div style={{ fontSize: '9px', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Assigned Center</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgb(var(--text-base))' }}>{user.evacuation_center_name}</div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {NAV.map(({ to, icon: Icon, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive ? 'text-white shadow-sm' : isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'
                  }`
                }
                style={({ isActive }) => isActive
                  ? { background: 'linear-gradient(90deg, #991b1b, #dc2626)', boxShadow: '0 2px 12px rgba(185,28,28,0.4)' }
                  : { color: isDark ? 'rgba(148,163,184,0.9)' : 'rgb(var(--text-muted))' }
                }>
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div style={{ padding: '1rem 0.75rem', borderTop: isDark ? '1px solid rgba(185,28,28,0.18)' : '1px solid rgb(var(--border-color))' }}>
            <button onClick={toggle}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all mb-1"
              style={{ color: isDark ? 'rgba(148,163,184,0.8)' : 'rgb(var(--text-muted))' }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : ''}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>
            <div style={{ padding: '0.625rem 0.75rem', marginBottom: '0.25rem', borderRadius: '0.75rem', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgb(var(--bg-base))', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgb(var(--border-color))' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--text-base))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
              <div style={{ fontSize: '11px', color: 'rgb(var(--text-faint))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{user?.email}</div>
              <div style={{ fontSize: '11px', color: '#f87171', marginTop: 2, fontWeight: 500 }}>MSWDO Admin</div>
            </div>
            <button onClick={logout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all hover:text-red-400"
              style={{ color: isDark ? 'rgba(148,163,184,0.8)' : 'rgb(var(--text-muted))' }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(185,28,28,0.15)' : ''}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: isDark
            ? { background: 'rgba(8,12,28,0.95)', color: '#f1f5f9', border: '1px solid rgba(185,28,28,0.3)', backdropFilter: 'blur(12px)' }
            : { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
        }}
      />
    </div>
  );
}
