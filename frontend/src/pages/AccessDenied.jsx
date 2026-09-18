import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AccessDenied = () => {
  const { role } = useAuth();
  const location = useLocation();
  const requiredRoles = location.state?.requiredRoles || [];

  return (
    <div className="min-h-[calc(100vh-70px)] flex items-center justify-center p-6 bg-[#060913]">
      <div className="w-full max-w-lg bg-[#0B1120] border border-emergency-red/40 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-emergency-red/20 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex p-4 rounded-2xl bg-emergency-red/10 border border-emergency-red/30 text-emergency-red mb-4">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-black text-white tracking-tight">Access Restricted</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
          Your current operational role (<span className="text-emergency-amber font-semibold">{role || 'guest'}</span>) does not have clearance for this dashboard.
        </p>

        {requiredRoles.length > 0 && (
          <div className="mt-4 py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 inline-block">
            Required Clearance: <span className="text-white font-mono">{requiredRoles.join(' or ')}</span>
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Return to Public Portal</span>
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emergency-red hover:bg-emergency-red-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emergency-red/20 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Switch Account</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
