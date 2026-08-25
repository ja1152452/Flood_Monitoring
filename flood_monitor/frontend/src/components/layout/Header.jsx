import { Menu, Sun, Moon, Bell, ShieldAlert } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import lumbanLogo from '../../assets/lumban lgo.jpg';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';

export function Header({ onMenuClick, portalTitle = "MDRRMO Flood Monitor", notificationsPath = "/alerts" }) {
  const { isDark, toggle } = useThemeStore();
  const { user } = useAuthStore();

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      {/* Left: Hamburger & Brand */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open Navigation Menu"
          className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/40"
        >
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-2.5">
          <img
            src={lumbanLogo}
            alt="Lumban Seal"
            className="w-8 h-8 rounded-lg object-contain shadow-xs border border-red-500/20"
          />
          <div className="leading-tight">
            <div className="text-[10px] font-black tracking-wider text-red-600 dark:text-red-400 uppercase">
              BetterER Lumban
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-[200px]">
              {portalTitle}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Live Status indicator */}
        <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            Live
          </span>
        </div>

        {/* Notifications */}
        <NavLink
          to={notificationsPath}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all relative"
          title="Notifications & Alerts"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
        </NavLink>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle Color Theme"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
        </button>
      </div>
    </header>
  );
}
