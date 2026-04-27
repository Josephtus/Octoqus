import { useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { SplashScreen } from './components/SplashScreen';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { useAuthStore } from './store/authStore';
import { useGroupStore } from './store/groupStore';
import { Home } from './components/Home';
import { GroupList } from './components/GroupList';
import { SocialList } from './components/SocialList';
import { ProfileSettings } from './components/ProfileSettings';
import { ReportForm } from './components/ReportForm';
import { AdminPanel } from './components/admin/AdminPanel';

function App() {
  const { user, loading, fetchUser } = useAuthStore();
  const navigate = useNavigate();

  // Token kontrolü ve kullanıcı bilgisini çekme (Zustand store üzerinden)
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const location = useLocation();

  // Eğer şifre sıfırlama token'ı varsa ve ana sayfadaysak o sayfaya yönlendir
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && location.pathname === '/') {
      navigate(`/reset-password?token=${token}`, { replace: true });
    }
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <h2 className="text-2xl font-bold text-[#00f0ff] animate-pulse uppercase tracking-[0.3em]">Oturum kontrol ediliyor...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          user ? <Navigate to="/dashboard" replace /> : <LandingPage />
        } />
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login onLoginSuccess={() => {
            navigate('/splash');
          }} />
        } />
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" replace /> : <Register onRegisterSuccess={() => navigate('/login')} />
        } />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/splash" element={<SplashScreen onComplete={async () => {
          // Splash bittiğinde kullanıcıyı çek ve Dashboard'a git
          await fetchUser();
          navigate('/dashboard', { replace: true });
        }} />} />

        {/* Private Dashboard Routes */}
        <Route path="/dashboard" element={
          user ? <Dashboard /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Home onSelectGroup={(id, name, role, isApproved, nickname) => {
             // We still use store but routing will handle the view
             useGroupStore.getState().setActiveGroup({ id, name, role, isApproved, nickname });
             navigate('/dashboard/groups');
          }} />} />
          <Route path="groups" element={<GroupList onSelectGroup={(id, name, role, isApproved, nickname) => {
             useGroupStore.getState().setActiveGroup({ id, name, role, isApproved, nickname });
          }} />} />
          <Route path="social" element={<SocialList />} />
          <Route path="profile" element={<ProfileSettings onUpdate={fetchUser} />} />
          <Route path="support" element={<ReportForm />} />
          <Route path="admin" element={user?.role?.toLowerCase() === 'admin' ? <AdminPanel /> : <Navigate to="/dashboard" replace />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
