import { NavLink } from 'react-router-dom';
import logo from '../../assets/logo.png';
import lumbanLogo from '../../assets/lumban lgo.jpg';
import {
  LayoutDashboard, AlertTriangle, Users, MapPin,
  Megaphone, BarChart3, ClipboardList, LogOut,
  Droplets, ShieldAlert, Sun, Moon, FileText, X
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

export function Sidebar({ isOpen = false, onClose }) {
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const handleSignOut = () => {
    if (onClose) onClose();
    logout();
  };

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 w-72 lg:w-64 min-h-screen flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        lg:static lg:z-auto lg:shadow-none
        ${isDark ? 'bg-slate-900 border-r border-slate-800' : 'bg-white border-r border-slate-200'}
      `}
    >
      {/* Red banner header — matches login top bar */}
      <div
        className="px-4 py-3.5 flex items-center justify-between gap-2.5 border-b border-red-900/30"
        style={{
          background: 'linear-gradient(90deg, #6b0000 0%, #c0392b 40%, #c0392b 60%, #6b0000 100%)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={lumbanLogo}
            alt="Lumban"
            className="w-9 h-9 object-contain rounded-lg border border-white/20 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[#fecaca] text-[9px] font-black tracking-widest uppercase leading-tight">
              BetterER Lumban
            </div>
            <div className="text-[#fca5a5] text-[8.5px] font-semibold tracking-wider uppercase truncate leading-tight">
              MDRRMO Flood Monitor
            </div>
          </div>
        </div>

        {/* Close Button on Mobile, App Logo on Desktop */}
        <div className="flex items-center gap-1">
          <img src={logo} alt="Logo" className="hidden lg:block w-7 h-7 object-contain opacity-90" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="lg:hidden p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'hover:bg-slate-100 dark:hover:bg-white/5'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background: 'linear-gradient(90deg, #991b1b, #dc2626)',
                    boxShadow: '0 2px 12px rgba(185,28,28,0.4)',
                    color: '#ffffff',
                  }
                : { color: isDark ? 'rgba(148,163,184,0.9)' : '#334155' }
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Profile Controls */}
      <div
        className={`p-3.5 border-t ${
          isDark ? 'border-red-900/20 bg-slate-900/60' : 'border-slate-200 bg-slate-50/50'
        }`}
      >
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggle}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-bold transition-all mb-2 hover:bg-slate-100 dark:hover:bg-white/5 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          {isDark ? <Sun size={15} className="text-amber-400 shrink-0" /> : <Moon size={15} className="shrink-0" />}
          <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
        </button>

        {/* User Card */}
        <div
          className={`px-3 py-2.5 mb-2 rounded-xl border ${
            isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200 shadow-2xs'
          }`}
        >
          <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
            {user?.full_name || 'Admin User'}
          </div>
          <div className="text-[11px] truncate text-slate-500 dark:text-slate-400 mt-0.5">
            {user?.email}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-extrabold text-red-600 dark:text-red-400 mt-1">
            {user?.role?.replace('_', ' ') || 'MDRRMO'}
          </div>
        </div>

        {/* Sign Out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-bold transition-all text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          <LogOut size={15} className="shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}