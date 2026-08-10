import { Sidebar } from './Sidebar';
import { Toaster } from 'react-hot-toast';
import { useThemeStore } from '../../store/themeStore';
export function Layout({ children }) {
  const { isDark } = useThemeStore();

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        color: 'rgb(var(--text-base))',
        backgroundColor: 'rgb(var(--bg-base))',
        transition: 'background-color 0.2s, color 0.2s',
      }}
    >
      <div style={{ display: 'flex', width: '100%' }}>
        <Sidebar />
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