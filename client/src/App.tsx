import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AgentsPage } from './pages/AgentsPage';
import { AgentDetailPage } from './pages/AgentDetailPage';
import { RunDetailPage } from './pages/RunDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage, TermsPage } from './pages/LegalPages';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/agents');

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/agents');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-xs">
        Initializing AgentDock...
      </div>
    );
  }

  // Route matching
  const renderRoute = () => {
    // Public legal pages
    if (currentPath === '/privacy') return <PrivacyPage onNavigate={navigate} />;
    if (currentPath === '/terms') return <TermsPage onNavigate={navigate} />;

    // Auth pages
    if (!user) {
      if (currentPath === '/register') return <RegisterPage onNavigate={navigate} />;
      return <LoginPage onNavigate={navigate} />;
    }

    // Authenticated pages
    if (currentPath === '/login' || currentPath === '/register') {
      return <AgentsPage onNavigate={navigate} />;
    }

    if (currentPath === '/settings') {
      return <SettingsPage onNavigate={navigate} />;
    }

    if (currentPath.startsWith('/runs/')) {
      const runId = currentPath.replace('/runs/', '');
      return <RunDetailPage runId={runId} onNavigate={navigate} />;
    }

    if (currentPath.startsWith('/agents/')) {
      const agentId = currentPath.replace('/agents/', '');
      return <AgentDetailPage agentId={agentId} onNavigate={navigate} />;
    }

    return <AgentsPage onNavigate={navigate} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <Navbar currentPath={currentPath} onNavigate={navigate} />

      <main className="flex-1">{renderRoute()}</main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AgentDock — Remote AI Agent Behavioral Testing Platform</span>
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/privacy')} className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => navigate('/terms')} className="hover:text-slate-300 transition-colors">
              Terms of Service
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
