import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  AlertTriangle,
  MapPin,
  Clock,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Package,
  ArrowRight,
  Shield,
  Layers,
  Crosshair,
  Radio,
  Check,
} from 'lucide-react';

const DEFAULT_CENTER = [18.5204, 73.8567]; // Pune default
const DEFAULT_ZOOM = 12;

const PRIORITY_COLORS = {
  Critical: {
    hex: '#EF4444',
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    text: 'text-red-400',
    bar: 'bg-red-500',
    glow: 'rgba(239, 68, 68, 0.45)',
  },
  High: {
    hex: '#F97316',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    bar: 'bg-orange-500',
    glow: 'rgba(249, 115, 22, 0.45)',
  },
  Medium: {
    hex: '#EAB308',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/40',
    text: 'text-yellow-400',
    bar: 'bg-yellow-500',
    glow: 'rgba(234, 179, 8, 0.45)',
  },
  Low: {
    hex: '#3B82F6',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/40',
    text: 'text-blue-400',
    bar: 'bg-blue-500',
    glow: 'rgba(59, 130, 246, 0.45)',
  },
};

const createMarkerIcon = (priority, isSelected = false) => {
  const config = PRIORITY_COLORS[priority] || PRIORITY_COLORS.Low;
  const isUrgent = priority === 'Critical' || priority === 'High';

  const pulseRing = isUrgent
    ? `<span style="
        position: absolute;
        top: -6px;
        left: -6px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: ${config.glow};
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        pointer-events: none;
      "></span>`
    : '';

  const selectionHalo = isSelected
    ? `<div style="
        position: absolute;
        top: -8px;
        left: -8px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px dashed #ffffff;
        animation: spin 3s linear infinite;
        pointer-events: none;
      "></div>`
    : '';

  const html = `
    <div style="position: relative; width: 20px; height: 20px;">
      ${pulseRing}
      ${selectionHalo}
      <div style="
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${config.hex};
        border: 2px solid #ffffff;
        box-shadow: 0 0 12px ${config.glow}, 0 2px 6px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-rescue-marker',
    html,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
};

const parseAiData = (raw) => {
  if (!raw) {
    return {
      tactical_action: 'Standard emergency dispatch protocol applies.',
      recommended_resources: ['General response team'],
    };
  }
  if (typeof raw === 'object') {
    return {
      tactical_action: raw.tactical_action || 'Standard emergency dispatch protocol applies.',
      recommended_resources: Array.isArray(raw.recommended_resources) ? raw.recommended_resources : [],
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      tactical_action: parsed.tactical_action || 'Standard emergency dispatch protocol applies.',
      recommended_resources: Array.isArray(parsed.recommended_resources) ? parsed.recommended_resources : [],
    };
  } catch {
    return {
      tactical_action: raw,
      recommended_resources: ['General response team'],
    };
  }
};

const RescueDashboard = () => {
  const { role } = useAuth();

  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);
  const markersMapRef = useRef(new Map());

  // Fetch active rescue feed from GET /dashboard/rescue
  const fetchRescueData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.get('/dashboard/rescue');
      setIncidents(response.data || []);
    } catch (err) {
      console.error('Failed to load rescue incidents:', err);
      setError(err.response?.data?.detail || 'Failed to retrieve active rescue queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRescueData();
  }, []);

  // Initialize Right Panel Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersGroupRef.current = null;
        markersMapRef.current.clear();
      }
    };
  }, []);

  // Update map pins whenever incidents change
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    markersMapRef.current.clear();

    const validPins = [];

    incidents.forEach((inc) => {
      const lat = parseFloat(inc.latitude);
      const lon = parseFloat(inc.longitude);

      if (!isNaN(lat) && !isNaN(lon)) {
        validPins.push([lat, lon]);

        const isSelected = selectedIncidentId === inc.id;
        const marker = L.marker([lat, lon], {
          icon: createMarkerIcon(inc.priority, isSelected),
        });

        const priorityConfig = PRIORITY_COLORS[inc.priority] || PRIORITY_COLORS.Low;
        const categoryFormatted = (inc.category || 'Incident')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; color: #0F172A; min-width: 220px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 800; font-size: 11px; font-family: monospace; color: #64748B;">TASK #${inc.id}</span>
              <span style="
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                padding: 2px 7px;
                border-radius: 9999px;
                background-color: ${priorityConfig.hex};
                color: #ffffff;
              ">${inc.priority}</span>
            </div>
            <p style="margin: 0 0 6px; font-weight: 700; font-size: 13px; color: #0F172A;">${categoryFormatted}</p>
            <div style="font-size: 11px; color: #475569; border-top: 1px solid #E2E8F0; padding-top: 6px; display: flex; flex-direction: column; gap: 3px;">
              <div><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: 600; color: #D97706;">${inc.status}</span></div>
              <div><strong>Severity:</strong> ${inc.severity_score} / 100</div>
              <div><strong>Coords:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 280 });
        marker.addTo(markersGroupRef.current);
        markersMapRef.current.set(inc.id, marker);
      }
    });

    if (validPins.length > 0) {
      try {
        if (validPins.length === 1) {
          mapRef.current.setView(validPins[0], 14, { animate: true });
        } else {
          const bounds = L.latLngBounds(validPins);
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
        }
      } catch (err) {
        console.warn('Could not fit bounds on rescue map:', err);
      }
    } else {
      mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, [incidents, selectedIncidentId]);

  // Center on map when an incident card is clicked
  const handleFocusIncident = (incident) => {
    setSelectedIncidentId(incident.id);
    const lat = parseFloat(incident.latitude);
    const lon = parseFloat(incident.longitude);

    if (!isNaN(lat) && !isNaN(lon) && mapRef.current) {
      mapRef.current.flyTo([lat, lon], 15, { duration: 1.2 });
      const marker = markersMapRef.current.get(incident.id);
      if (marker) {
        marker.openPopup();
      }
    }
  };

  // Action button: Acknowledge / Mark In Progress or Mark Resolved
  const handleUpdateStatus = async (incidentId, newStatus) => {
    setUpdatingId(incidentId);
    try {
      await client.patch(`/incidents/${incidentId}/status`, { new_status: newStatus });
      await fetchRescueData();
    } catch (err) {
      console.error('Failed to update incident status:', err);
      alert('Failed to update status: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col gap-6">
      {/* Dashboard Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0B1120] border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emergency-amber/15 border border-emergency-amber/30 rounded-xl text-emergency-amber">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">Rescue Team Tactical Operations</h1>
              <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-emergency-amber/20 text-emergency-amber border border-emergency-amber/30">
                {role}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time priority-ranked dispatch queue & Groq LLM tactical briefs for active deployments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-emergency-amber font-bold">{incidents.length}</span> Active Tasks
          </div>
          <button
            onClick={fetchRescueData}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Queue</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-emergency-red/15 border border-emergency-red/30 text-emergency-red text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Split-Screen Layout: Left Panel (Triage Cards) | Right Panel (Leaflet Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Priority-sorted triage cards */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Activity className="w-4 h-4 text-emergency-amber" />
              <span>Ranked Triage Queue ({incidents.length})</span>
            </div>
            <span className="text-[11px] text-slate-500">Sorted by Severity Score (Desc)</span>
          </div>

          {isLoading ? (
            <div className="p-16 rounded-2xl bg-[#0B1120] border border-slate-800 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-emergency-amber/30 border-t-emergency-amber rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Streaming tactical incident queue...</p>
            </div>
          ) : incidents.length === 0 ? (
            <div className="p-16 rounded-2xl bg-[#0B1120] border border-slate-800 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-12 h-12 text-emergency-emerald mb-1" />
              <p className="text-sm font-bold text-white">Queue Clear - No Active Incidents</p>
              <p className="text-xs text-slate-500 max-w-sm">
                All pending emergency reports have been processed or resolved by deployed teams.
              </p>
            </div>
          ) : (
            incidents.map((incident) => {
              const priorityConfig = PRIORITY_COLORS[incident.priority] || PRIORITY_COLORS.Low;
              const ai = parseAiData(incident.ai_recommendation);
              const isSelected = selectedIncidentId === incident.id;
              const hasCoords = !isNaN(parseFloat(incident.latitude)) && !isNaN(parseFloat(incident.longitude));

              return (
                <div
                  key={incident.id}
                  onClick={() => handleFocusIncident(incident)}
                  className={`p-5 rounded-2xl bg-[#0B1120] border transition-all cursor-pointer shadow-xl relative overflow-hidden flex flex-col gap-4 ${
                    isSelected
                      ? 'border-emergency-amber shadow-emergency-amber/10 ring-1 ring-emergency-amber'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-[#0d1424]'
                  }`}
                >
                  {/* Top Row: Category & Priority Badges + Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-extrabold text-white">#{incident.id}</span>
                      <span
                        className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border shadow-sm ${priorityConfig.bg} ${priorityConfig.border} ${priorityConfig.text}`}
                      >
                        {incident.priority}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-medium">
                        {incident.category?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md border ${
                          incident.status === 'in_progress'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-600/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {incident.status.replace(/_/g, ' ')}
                      </span>

                      {hasCoords && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFocusIncident(incident);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Locate on Map"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Severity Score Bar (0 - 100%) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider">Severity Score</span>
                      <span className="font-mono font-bold text-white">{incident.severity_score}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${priorityConfig.bar}`}
                        style={{ width: `${Math.min(Math.max(incident.severity_score, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Raw Report Snippet */}
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <p className="text-xs text-slate-300 italic leading-relaxed font-sans">
                      "{incident.text}"
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(incident.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {hasCoords && (
                        <span className="font-mono text-emergency-amber">
                          GPS: {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tactical Action Summary (Groq LLM Llama 3.3) */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 to-[#0F172A] border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Cpu className="w-4 h-4 text-emergency-red" />
                      <span>Tactical Action Summary (AI Brief)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium">
                      {ai.tactical_action}
                    </p>

                    {/* Recommended Resources Tags */}
                    {ai.recommended_resources && ai.recommended_resources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Units:
                        </span>
                        {ai.recommended_resources.map((res, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700"
                          >
                            {res}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Acknowledge / Mark In Progress / Resolve */}
                  <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleFocusIncident(incident)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <span>Show on Map</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      {incident.status === 'pending' ? (
                        <button
                          type="button"
                          disabled={updatingId === incident.id}
                          onClick={() => handleUpdateStatus(incident.id, 'in_progress')}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-black bg-emergency-amber hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {updatingId === incident.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Acknowledge / Mark In Progress</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingId === incident.id}
                          onClick={() => handleUpdateStatus(incident.id, 'resolved')}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emergency-emerald hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {updatingId === incident.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Mark Resolved</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Panel: Leaflet map showing pins of active pending and in-progress tasks */}
        <div className="lg:col-span-5 sticky top-20">
          <div className="p-4 rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl flex flex-col h-[calc(100vh-140px)] min-h-[540px]">
            {/* Map Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emergency-amber/15 rounded-lg text-emergency-amber">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Tactical Geo-Deployment</h3>
                  <p className="text-[10px] text-slate-400">Live coordinates of pending & in-progress operations</p>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                {incidents.filter((i) => i.latitude && i.longitude).length} Geo-located
              </div>
            </div>

            {/* Leaflet Container */}
            <div className="flex-1 w-full rounded-xl overflow-hidden relative border border-slate-800 min-h-[380px]">
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>

            {/* Map Footer Legend */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Critical
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#F97316]" /> High
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#EAB308]" /> Medium
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Low
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Click a card to fly to pin</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescueDashboard;
