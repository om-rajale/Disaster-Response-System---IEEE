import React, { useState } from 'react';
import CitizenReportForm from '../components/CitizenReportForm';
import PublicMap from '../components/PublicMap';
import { Radio, Shield, AlertTriangle } from 'lucide-react';

const CitizenPortal = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleReportSubmitted = () => {
    // Increment trigger to notify PublicMap to refresh its pins
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#0B1120] via-[#0F172A] to-[#0B1120] border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emergency-red animate-ping" />
            <h1 className="text-xl font-black text-white tracking-tight">Citizen Emergency Triage & Public Map</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time NLP incident processing, multi-source duplicate detection, and dynamic tactical map.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Radio className="w-3.5 h-3.5 text-emergency-red animate-pulse" />
            <span>OpenStreetMap Telemetry Live</span>
          </div>
        </div>
      </div>

      {/* Main Responsive Grid: Form on Left, Map on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <CitizenReportForm onReportSubmitted={handleReportSubmitted} />
        </div>

        <div className="lg:col-span-7">
          <PublicMap key={refreshTrigger} />
        </div>
      </div>
    </div>
  );
};

export default CitizenPortal;
