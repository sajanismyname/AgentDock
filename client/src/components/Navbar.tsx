import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Server, Settings, LogOut } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <div
          className="flex items-center space-x-2.5 cursor-pointer select-none"
          onClick={() => onNavigate('/agents')}
        >
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-semibold tracking-tight text-white text-base">
            Agent<span className="text-sky-400">Dock</span>
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-mono">
            MVP
          </span>
        </div>

        {/* Navigation */}
        {user ? (
          <div className="flex items-center space-x-1 sm:space-x-4">
            <nav className="flex items-center space-x-1">
              <button
                onClick={() => onNavigate('/agents')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                  currentPath.startsWith('/agents')
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Server className="w-4 h-4" />
                <span>Agents</span>
              </button>

              <button
                onClick={() => onNavigate('/settings')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                  currentPath === '/settings'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </nav>

            <div className="h-4 w-px bg-slate-800 mx-2 hidden sm:block" />

            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-400 font-mono hidden md:inline truncate max-w-[160px]">
                {user.email}
              </span>
              <button
                onClick={logout}
                title="Log out"
                className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('/login')}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => onNavigate('/register')}
              className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-colors shadow-sm"
            >
              Sign up
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
