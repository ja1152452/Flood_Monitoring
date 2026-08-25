import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../../assets/logo.png';
import lumbanLogo from '../../assets/lumban lgo.jpg';
import {
  LayoutDashboard, Users, FileText,
  Bell, UserCircle, LogOut, Sun, Moon, X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Header } from './Header';
import { Toaster } from 'react-hot-toast';

const NAV = [
  { to: '/mswdo',               icon: LayoutDashboard, label: 'Dashboard',          end: true },
  { to: '/mswdo/evacuees',      icon: Users,           label: 'Evacuee Management' },
  { to: '/mswdo/reports',       icon: FileText,        label: 'Reports'             },
  { to: '/mswdo/notifications', icon: Bell,            label: 'Notifications'       },
  { to: '/mswdo/profile',       icon: UserCircle,      label: 'Profile Settings'    },
];

export function MswdoLayout({ children }) {
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const handleNavClick = () => {
    setIsMobileDrawerOpen(false);
  };

  const handleSignOut = () => {
    setIsMobileDrawerOpen(false);
    logout();
  };

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row transition-colors duration-200"
      style={{
        color: 'rgb(var(--text-base))',
        backgroundColor: 'rgb(var(--bg-base))',
      }}
    >
      {/* Mobile Backdrop Overlay */}
      {isMobileDrawerOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden animate-fade-in transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 lg:w-64 min-h-screen flex flex-col
          transition-transform duration-300 ease-in-out
          ${isMobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
          lg:static lg:z-auto lg:shadow-none
          ${isDark ? 'bg-slate-900 border-r border-slate-800' : 'bg-white border-r border-slate-200'}
        `}
      >
        {/* Red banner header */}
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
                MSWDO Portal
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <img src={logo} alt="Logo" className="hidden lg:block w-7 h-7 object-contain opacity-90" />
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-label="Close navigation drawer"
              className="lg:hidden p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Assigned Evacuation Center badge */}
        {user?.evacuation_center_name && (
          <div className="m-3 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50">
            <div className="text-[9px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-0.5">
              Assigned Center
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {user.evacuation_center_name}
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
              {user?.full_name || 'MSWDO Officer'}
            </div>
            <div className="text-[11px] truncate text-slate-500 dark:text-slate-400 mt-0.5">
              {user?.email}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400 mt-1">
              MSWDO Admin
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top App Bar */}
        <Header
          onMenuClick={() => setIsMobileDrawerOpen(true)}
          portalTitle="MSWDO Portal"
          notificationsPath="/mswdo/notifications"
        />

        {/* Page Body */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Toaster */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: isDark
            ? {
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#f8fafc',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                backdropFilter: 'blur(12px)',
              }
            : {
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
              },
        }}
      />
    </div>
  );
}
