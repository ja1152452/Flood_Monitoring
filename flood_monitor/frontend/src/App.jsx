import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { Layout } from './components/layout/Layout';
import { MswdoLayout } from './components/layout/MswdoLayout';
import Login             from './pages/Login';
import Dashboard        from './pages/Dashboard';
import Alerts           from './pages/Alerts';
import Rescue           from './pages/Rescue';
import Evacuation       from './pages/Evacuation';
import Announcements    from './pages/Announcements';
import Analytics        from './pages/Analytics';
import AuditLogs        from './pages/AuditLogs';
import RiskMapPage      from './pages/RiskMap';
import Users            from './pages/Users';
import MswdoDashboard   from './pages/mswdo/MswdoDashboard';
import MswdoEvacuees    from './pages/mswdo/MswdoEvacuees';
import MswdoReports     from './pages/mswdo/MswdoReports';
import MswdoNotifications      from './pages/mswdo/MswdoNotifications';
import MswdoProfile            from './pages/mswdo/MswdoProfile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10000 },
  },
});

function Protected({ children }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function MswdoProtected({ children }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'MSWDO') return <Navigate to="/" replace />;
  return children;
}

function AdminProtected({ children }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role === 'MSWDO') return <Navigate to="/mswdo" replace />;
  return children;
}

export default function App() {
  const { isDark } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* MSWDO routes */}
          <Route path="/mswdo/*" element={
            <MswdoProtected>
              <MswdoLayout>
                <Routes>
                  <Route path="/"              element={<MswdoDashboard />} />
                  <Route path="/evacuees"      element={<MswdoEvacuees />} />
                  <Route path="/reports"       element={<MswdoReports />} />
                  <Route path="/notifications" element={<MswdoNotifications />} />
                  <Route path="/profile"       element={<MswdoProfile />} />
                </Routes>
              </MswdoLayout>
            </MswdoProtected>
          } />

          {/* MDRRMO / Admin routes */}
          <Route path="/*" element={
            <AdminProtected>
              <Layout>
                <Routes>
                  <Route path="/"              element={<Dashboard />} />
                  <Route path="/alerts"        element={<Alerts />} />
                  <Route path="/rescue"        element={<Rescue />} />
                  <Route path="/evacuation"    element={<Evacuation />} />
                  <Route path="/risk-map"      element={<RiskMapPage />} />
                  <Route path="/announcements" element={<Announcements />} />
                  <Route path="/analytics"     element={<Analytics />} />
                  <Route path="/audit"         element={<AuditLogs />} />
                  <Route path="/users"         element={<Users />} />
                  <Route path="/reports"       element={<MswdoReports />} />
                  <Route path="/flood-reports" element={<Navigate to="/analytics" replace />} />
                </Routes>
              </Layout>
            </AdminProtected>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}