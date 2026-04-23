import { useState } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

type ScreenState = 'LOGIN' | 'SPLASH' | 'DASHBOARD';

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('LOGIN');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {currentScreen === 'LOGIN' && (
        <Login onLoginSuccess={() => setCurrentScreen('SPLASH')} />
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

