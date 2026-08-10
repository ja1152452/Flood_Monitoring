import { NavLink } from 'react-router-dom';
import logo from '../../assets/logo.png';
import lumbanLogo from '../../assets/lumban lgo.jpg';
import {
  LayoutDashboard, AlertTriangle, Users, MapPin,
  Megaphone, BarChart3, ClipboardList, LogOut,
  Droplets, ShieldAlert, Sun, Moon, FileText,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

const NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/alerts',        icon: AlertTriangle,   label: 'Alerts'         },
  { to: '/rescue',        icon: Users,            label: 'Rescue Map'    },
  { to: '/evacuation',    icon: MapPin,           label: 'Evacuation'    },
  { to: '/risk-map',      icon: ShieldAlert,      label: 'Risk Map'      },
  { to: '/announcements', icon: Megaphone,        label: 'Announcements' },
  { to: '/analytics',     icon: BarChart3,        label: 'Analytics'     },
  { to: '/audit',         icon: ClipboardList,    label: 'Audit Logs'    },
  { to: '/users',         icon: Users,            label: 'Users'         },
  { to: '/reports',       icon: FileText,         label: 'MSWDO Reports'  },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();

  const sidebarStyle = isDark ? {
    width: '16rem',
    minHeight: '100vh',
    background: 'rgb(var(--bg-card))',
    borderRight: '1px solid rgb(var(--border-color))',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
  } : {
    width: '16rem',
    minHeight: '100vh',
    background: 'rgb(var(--bg-card-deep))',
    borderRight: '1px solid rgb(var(--border-color))',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
  };

  return (
    <aside style={sidebarStyle}>
      {/* Red banner header — matches login top bar */}
      <div style={{
        background: 'linear-gradient(90deg, #6b0000 0%, #c0392b 40%, #c0392b 60%, #6b0000 100%)',
        borderBottom: '1px solid rgba(255,200,200,0.12)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
      }}>
        <img src={lumbanLogo} alt="Lumban" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fecaca', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.2 }}>BetterER Lumban</div>
          <div style={{ color: '#fca5a5', fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.2 }}>MDRRMO Flood Monitor</div>
        </div>
        <img src={logo} alt="Logo" style={{ width: 30, height: 30, objectFit: 'contain', opacity: 0.9 }} />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'hover:bg-white/10'
              }`
            }
            style={({ isActive }) => isActive
              ? { background: 'linear-gradient(90deg, #991b1b, #dc2626)', boxShadow: '0 2px 12px rgba(185,28,28,0.4)', color: '#ffffff' }
              : { color: isDark ? 'rgba(148,163,184,0.9)' : 'rgb(var(--text-muted))' }
            }>
            {({ isActive }) => (
              <>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{
        padding: '1rem 0.75rem',
        borderTop: isDark ? '1px solid rgba(185,28,28,0.18)' : '1px solid rgb(var(--border-color))',
      }}>
        <button onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all mb-1"
          style={{ color: isDark ? 'rgba(148,163,184,0.8)' : 'rgb(var(--text-muted))' }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgb(var(--bg-base))'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <div className="px-3 py-2.5 mb-1 rounded-xl" style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgb(var(--bg-base))',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgb(var(--border-color))',
        }}>
          <div className="text-xs font-semibold truncate" style={{ color: 'rgb(var(--text-base))' }}>{user?.full_name}</div>
          <div className="text-xs truncate mt-0.5" style={{ color: 'rgb(var(--text-faint))' }}>{user?.email}</div>
          <div className="text-xs capitalize mt-0.5 font-medium" style={{ color: '#f87171' }}>{user?.role?.replace('_', ' ')}</div>
        </div>
        <button onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all hover:text-red-400"
          style={{ color: isDark ? 'rgba(148,163,184,0.8)' : 'rgb(var(--text-muted))' }}
          onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(185,28,28,0.15)' : 'rgb(var(--bg-base))'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}