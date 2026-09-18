import React, { useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

const CitizenReportForm = ({ onReportSubmitted }) => {
  const { userId } = useAuth();

  const [text, setText] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setLocationError('Could not retrieve GPS position. You can enter coordinates manually or mention landmarks in your description.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        text: text.trim(),
        reporter_id: userId ? Number(userId) : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      };

      const response = await client.post('/process_report', payload);
      const incidentData = response.data;

      setResult(incidentData);
      setText('');
      setLatitude('');
      setLongitude('');

      if (onReportSubmitted) {
        onReportSubmitted(incidentData);
      }
    } catch (err) {
      console.error('Failed to submit incident report:', err);
      const detail =
        err.response?.data?.detail || 'Failed to submit report. Please verify connection and try again.';
      setSubmitError(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setResult(null);
    setSubmitError(null);
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'Critical':
        return 'bg-emergency-red/20 text-emergency-red border-emergency-red/40 shadow-emergency-red/10';
      case 'High':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-500/10';
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-yellow-500/10';
      case 'Low':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-500/10';
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl relative overflow-hidden">
      {/* Decorative ambient corner glow */}
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-emergency-red/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-emergency-red/15 border border-emergency-red/30 rounded-xl text-emergency-red">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Citizen Incident Dispatch</h2>
          <p className="text-xs text-slate-400">Automated NLP triage, duplicate linking & priority scoring</p>
        </div>
      </div>

      {/* Error Banner */}
      {submitError && (
        <div className="mb-4 p-3.5 rounded-xl bg-emergency-red/10 border border-emergency-red/30 text-emergency-red text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Confirmation Card */}
      {result && (
        <div className="mb-6 p-5 rounded-xl bg-[#0F172A] border border-slate-700 shadow-xl flex flex-col gap-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-emergency-emerald font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Incident Registered (#{result.id})</span>
            </div>
            <span
              className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full border shadow-sm ${getPriorityStyle(
                result.priority
              )}`}
            >
              {result.priority}
            </span>
          </div>

          {/* Duplicate Notice Banner */}
          {result.status && result.status.startsWith('duplicate_of_') ? (
            <div className="p-3.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-2.5">
              <Copy className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
              <div>
                <p className="font-bold text-blue-300">Verified Duplicate Linked ({result.status})</p>
                <p className="text-[11px] text-blue-200/80 mt-0.5">
                  Responders already have units deployed or scheduled for this incident. Your report confirms field conditions and verified reports.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Unique primary emergency report categorized and routed to field units.</span>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Category</span>
              <span className="text-white font-semibold mt-0.5 block truncate">
                {result.category?.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Severity Score</span>
              <span className="font-mono text-white font-bold mt-0.5 block">
                {result.severity_score} / 100
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Workflow Status</span>
              <span className="font-mono text-emergency-amber font-semibold mt-0.5 block truncate">
                {result.status}
              </span>
            </div>
          </div>

          {/* Coordinates Summary */}
          {result.latitude && result.longitude && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
              <MapPin className="w-3.5 h-3.5 text-emergency-amber shrink-0" />
              <span>Coordinates: {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}</span>
            </div>
          )}

          {/* Reset Action */}
          <button
            onClick={handleResetForm}
            className="w-full py-2 px-3 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Submit Another Incident Report</span>
          </button>
        </div>
      )}

      {/* Main Submission Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Disaster Description <span className="text-emergency-red">*</span>
          </label>
          <textarea
            required
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Building collapsed near Swargate, people injured and trapped under rubble! Road blocked, need fire and medical teams."
            className="w-full px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emergency-red focus:ring-1 focus:ring-emergency-red transition-all resize-none"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Tip: Specify landmarks or cross-streets ("near Swargate", "at Shivaji Nagar") for automated geolocation extraction.
          </p>
        </div>

        {/* Location Inputs */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Coordinates (Optional)
            </label>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isLocating}
              className="text-xs text-emergency-amber hover:text-amber-400 disabled:opacity-50 flex items-center gap-1 transition-colors font-medium"
            >
              <MapPin className={`w-3.5 h-3.5 ${isLocating ? 'animate-bounce' : ''}`} />
              <span>{isLocating ? 'Acquiring GPS...' : 'Detect My Location'}</span>
            </button>
          </div>

          {locationError && (
            <p className="text-[11px] text-emergency-amber mb-2">{locationError}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Latitude (e.g. 18.5204)"
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emergency-red transition-colors"
              />
            </div>
            <div>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Longitude (e.g. 73.8567)"
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emergency-red transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !text.trim()}
          className="w-full py-3 px-4 bg-emergency-red hover:bg-emergency-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-emergency-red/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Emergency Report</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CitizenReportForm;
