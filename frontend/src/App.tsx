import { useState, useEffect } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { apiFetch } from './utils/api';

type ScreenState = 'LANDING' | 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD' | 'SPLASH' | 'DASHBOARD' | 'CHECKING';

function App() {
  // İlk yüklemede URL'de token var mı kontrol et
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  });

  const [currentScreen, setCurrentScreen] = useState<ScreenState>(() => {
    // Eğer token varsa direkt RESET_PASSWORD ekranıyla başla
    const params = new URLSearchParams(window.location.search);
    return params.get('token') ? 'RESET_PASSWORD' : 'CHECKING';
  });

  // Sayfa yüklendiğinde token kontrolü
  useEffect(() => {
    // Sadece başlangıç kontrolünde veya şifre sıfırlama modunda çalış
    if (currentScreen !== 'CHECKING' && currentScreen !== 'RESET_PASSWORD') return;

    if (currentScreen === 'RESET_PASSWORD') {
      // Eğer şifre sıfırlama ekranındaysak, URL'yi temizle (görsel olarak) ama token'ı state'te tut
      window.history.replaceState({}, document.title, "/");
      return;
    }

    const token = localStorage.getItem('token');
    if (token) {
      // Token varsa geçerliliğini kontrol et
      apiFetch('/auth/me')
        .then(res => {
          if (res.ok) {
            setCurrentScreen('DASHBOARD'); // Token geçerli → Dashboard
          } else {
            localStorage.removeItem('token');
            setCurrentScreen('LANDING');
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          setCurrentScreen('LANDING');
        });
    } else {
      setCurrentScreen('LANDING');
    }
  }, [currentScreen]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {currentScreen === 'CHECKING' && (
        <div className="flex items-center justify-center min-h-screen">
          <h2 className="text-2xl font-bold text-[#00f0ff] animate-pulse">Oturum kontrol ediliyor...</h2>
        </div>
      )}

      {currentScreen === 'LANDING' && (
        <LandingPage 
          onLogin={() => setCurrentScreen('LOGIN')} 
          onRegister={() => setCurrentScreen('REGISTER')} 
        />
      )}

      {currentScreen === 'LOGIN' && (
        <Login 
          onLoginSuccess={() => setCurrentScreen('SPLASH')} 
          onSwitchToRegister={() => setCurrentScreen('REGISTER')}
          onSwitchToForgotPassword={() => setCurrentScreen('FORGOT_PASSWORD')}
          onBackToLanding={() => setCurrentScreen('LANDING')}
        />
      )}

      {currentScreen === 'FORGOT_PASSWORD' && (
        <ForgotPassword onBackToLogin={() => setCurrentScreen('LOGIN')} />
      )}

      {currentScreen === 'RESET_PASSWORD' && resetToken && (
        <ResetPassword 
          token={resetToken} 
          onSuccess={() => {
            setResetToken(null);
            setCurrentScreen('LOGIN');
          }}
          onBackToLogin={() => {
            setResetToken(null);
            setCurrentScreen('LOGIN');
          }}
        />
      )}

      {currentScreen === 'REGISTER' && (
        <Register 
          onRegisterSuccess={() => setCurrentScreen('LOGIN')}
          onSwitchToLogin={() => setCurrentScreen('LOGIN')}
          onBackToLanding={() => setCurrentScreen('LANDING')}
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
