import { useState, useEffect } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ForgotPassword } from './components/ForgotPassword';
import { Dashboard } from './components/Dashboard';

type ScreenState = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'SPLASH' | 'DASHBOARD' | 'CHECKING';

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('CHECKING');

  // Sayfa yüklendiğinde token kontrolü
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Token varsa geçerliliğini kontrol et
      fetch('http://localhost:8000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) {
            setCurrentScreen('DASHBOARD'); // Token geçerli → Dashboard
          } else {
            localStorage.removeItem('token');
            setCurrentScreen('LOGIN');
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          setCurrentScreen('LOGIN');
        });
    } else {
      setCurrentScreen('LOGIN');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {currentScreen === 'CHECKING' && (
        <div className="flex items-center justify-center min-h-screen">
          <h2 className="text-2xl font-bold text-[#00f0ff] animate-pulse">Oturum kontrol ediliyor...</h2>
        </div>
      )}

      {currentScreen === 'LOGIN' && (
        <Login 
          onLoginSuccess={() => setCurrentScreen('SPLASH')} 
          onSwitchToRegister={() => setCurrentScreen('REGISTER')}
          onSwitchToForgotPassword={() => setCurrentScreen('FORGOT_PASSWORD')}
        />
      )}

      {currentScreen === 'FORGOT_PASSWORD' && (
        <ForgotPassword onBackToLogin={() => setCurrentScreen('LOGIN')} />
      )}

      {currentScreen === 'REGISTER' && (
        <Register 
          onRegisterSuccess={() => setCurrentScreen('LOGIN')}
          onSwitchToLogin={() => setCurrentScreen('LOGIN')}
        />
      )}
      
      {currentScreen === 'SPLASH' && (
        <SplashScreen onComplete={() => setCurrentScreen('DASHBOARD')} />
      )}
      
      {currentScreen === 'DASHBOARD' && (
        <Dashboard />
      )}
    </div>
  );
}

export default App;
