import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Radio, Shield, Activity, LogOut, LogIn, UserPlus, MapPin } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, role, userId, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="border-b border-slate-800/80 bg-[#0B1120]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-3 group">
        <div className="p-2 bg-emergency-red/15 border border-emergency-red/30 rounded-lg text-emergency-red group-hover:scale-105 transition-transform">
          <Radio className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight text-white">AEDIRS</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emergency-red/20 text-emergency-red border border-emergency-red/30">
              v2.0 LIVE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Disaster Response Network</p>
        </div>
      </Link>

      {/* Navigation Links */}
      <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <Link
          to="/"
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            isActive('/')
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Public Map & Report
        </Link>

        {(role === 'rescue_team' || role === 'admin') && (
          <Link
            to="/rescue"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              isActive('/rescue')
                ? 'bg-emergency-amber/20 text-emergency-amber border border-emergency-amber/30'
                : 'text-slate-400 hover:text-emergency-amber hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Rescue Dashboard
          </Link>
        )}

        {role === 'admin' && (
          <Link
            to="/admin"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              isActive('/admin')
                ? 'bg-emergency-red/20 text-emergency-red border border-emergency-red/30'
                : 'text-slate-400 hover:text-emergency-red hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin Commander
          </Link>
        )}
      </nav>

      {/* User Controls */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-semibold text-white">ID #{userId}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
                {role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
            <Link
              to="/register"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emergency-red/90 hover:bg-emergency-red rounded-lg flex items-center gap-1.5 shadow-md shadow-emergency-red/20 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
