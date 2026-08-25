import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster } from 'react-hot-toast';
import { useThemeStore } from '../../store/themeStore';

export function Layout({ children }) {
  const { isDark } = useThemeStore();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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

      {/* Sidebar (Responsive Drawer on Mobile, Docked on Desktop) */}
      <Sidebar
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top App Bar */}
        <Header
          onMenuClick={() => setIsMobileDrawerOpen(true)}
          portalTitle="MDRRMO Flood Monitor"
          notificationsPath="/alerts"
        />

        {/* Page Body */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Global Toast Notifications */}
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