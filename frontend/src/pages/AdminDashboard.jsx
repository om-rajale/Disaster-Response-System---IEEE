import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Activity,
  AlertTriangle,
  Copy,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Layers,
  MapPin,
  ExternalLink,
  Flame,
  Clock,
  ArrowRight,
  Eye,
  Check,
  XCircle,
} from 'lucide-react';

const DEFAULT_CENTER = [18.5204, 73.8567]; // Pune command center
const DEFAULT_ZOOM = 12;

const PRIORITY_BADGES = {
  Critical: 'bg-red-500/20 text-red-400 border-red-500/40 shadow-red-500/10',
  High: 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-orange-500/10',
  Medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-yellow-500/10',
  Low: 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-500/10',
};

const STATUS_BADGES = {
  pending: 'bg-slate-800 text-slate-300 border-slate-700',
  in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  dismissed: 'bg-slate-900 text-slate-500 border-slate-800',
};

const AdminDashboard = () => {
  const { role } = useAuth();

  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [mapMode, setMapMode] = useState('pins'); // 'pins' | 'heatmap'

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);
  const heatLayerGroupRef = useRef(null);
  const markersMapRef = useRef(new Map());

  // Fetch full diagnostic dataset from GET /dashboard/admin
  const fetchAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.get('/dashboard/admin');
      setIncidents(response.data || []);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
      setError(err.response?.data?.detail || 'Failed to retrieve administrative telemetry feed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Initialize Integrated Leaflet Map
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

      const heatGroup = L.layerGroup().addTo(map);
      const markersGroup = L.layerGroup().addTo(map);

      heatLayerGroupRef.current = heatGroup;
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
        heatLayerGroupRef.current = null;
        markersMapRef.current.clear();
      }
    };
  }, []);

  // Update Map Layers (Pins & Concentration Heatmap Circles)
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current || !heatLayerGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    heatLayerGroupRef.current.clearLayers();
    markersMapRef.current.clear();

    const validPins = [];
    const locationClusters = new Map(); // key: "lat,lon" -> array of incidents

    incidents.forEach((inc) => {
      const lat = parseFloat(inc.latitude);
      const lon = parseFloat(inc.longitude);

      if (!isNaN(lat) && !isNaN(lon)) {
        validPins.push([lat, lon]);
        const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
        if (!locationClusters.has(key)) {
          locationClusters.set(key, []);
        }
        locationClusters.get(key).push(inc);
      }
    });

    // 1. Draw Incident Pins Layer
    incidents.forEach((inc) => {
      const lat = parseFloat(inc.latitude);
      const lon = parseFloat(inc.longitude);

      if (!isNaN(lat) && !isNaN(lon)) {
        const isDuplicate = inc.status && inc.status.startsWith('duplicate_of_');
        const isSelected = selectedIncidentId === inc.id;

        const pinColor = isDuplicate
          ? '#3B82F6'
          : inc.priority === 'Critical'
          ? '#EF4444'
          : inc.priority === 'High'
          ? '#F97316'
          : inc.priority === 'Medium'
          ? '#EAB308'
          : '#10B981';

        const customIcon = L.divIcon({
          className: 'custom-admin-marker',
          html: `
            <div style="position: relative; width: 20px; height: 20px;">
              ${
                isSelected
                  ? `<div style="position: absolute; top: -6px; left: -6px; width: 32px; height: 32px; border-radius: 50%; border: 2px dashed #ffffff; animation: spin 4s linear infinite;"></div>`
                  : ''
              }
              <div style="
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: ${pinColor};
                border: 2px solid #ffffff;
                box-shadow: 0 0 10px ${pinColor}, 0 2px 4px rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                font-size: 9px;
                font-weight: 800;
                font-family: monospace;
              ">
                ${inc.id}
              </div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -12],
        });

        const marker = L.marker([lat, lon], { icon: customIcon });

        const popupHtml = `
          <div style="font-family: system-ui, sans-serif; color: #0F172A; min-width: 220px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 800; font-family: monospace; color: #475569;">INCIDENT #${inc.id}</span>
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 9999px; background: ${pinColor}; color: #ffffff;">
                ${inc.priority}
              </span>
            </div>
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #0F172A;">${inc.category.replace(/_/g, ' ')}</p>
            <p style="margin: 0 0 6px; font-size: 11px; color: #334155; line-height: 1.3; font-style: italic;">"${inc.text}"</p>
            <div style="font-size: 10px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 4px; display: flex; flex-direction: column; gap: 2px;">
              <div><strong>Status:</strong> ${inc.status}</div>
              <div><strong>Severity:</strong> ${inc.severity_score} / 100</div>
              <div><strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml, { maxWidth: 280 });
        marker.addTo(markersGroupRef.current);
        markersMapRef.current.set(inc.id, marker);
      }
    });

    // 2. Draw Concentration Heatmap Circles Layer
    locationClusters.forEach((clusterIncidents, key) => {
      const [cLat, cLon] = key.split(',').map(Number);
      const count = clusterIncidents.length;
      const maxScore = Math.max(...clusterIncidents.map((i) => i.severity_score || 0));

      const heatColor = maxScore >= 75 ? '#EF4444' : maxScore >= 50 ? '#F97316' : '#EAB308';
      const radius = 250 + count * 120; // Radius scales with incident count

      const heatCircle = L.circle([cLat, cLon], {
        radius,
        color: heatColor,
        fillColor: heatColor,
        fillOpacity: mapMode === 'heatmap' ? 0.45 : 0.18,
        weight: mapMode === 'heatmap' ? 2 : 1,
      });

      heatCircle.bindTooltip(`
        <div style="font-family: sans-serif; font-size: 11px; color: #0f172a; padding: 2px;">
          <strong>Incident Hotspot:</strong> ${count} report(s)<br/>
          <strong>Peak Severity:</strong> ${maxScore.toFixed(1)}/100
        </div>
      `);

      heatCircle.addTo(heatLayerGroupRef.current);
    });

    // Bounds fitting
    if (validPins.length > 0) {
      try {
        if (validPins.length === 1) {
          mapRef.current.setView(validPins[0], 13);
        } else {
          const bounds = L.latLngBounds(validPins);
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      } catch (err) {
        console.warn('Could not fit map bounds:', err);
      }
    } else {
      mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, [incidents, selectedIncidentId, mapMode]);

  // Center on map and focus row
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

  // Status transition mutation: calls PATCH /incidents/{id}/status
  const handleUpdateStatus = async (incidentId, newStatus) => {
    setUpdatingId(incidentId);
    try {
      await client.patch(`/incidents/${incidentId}/status`, { new_status: newStatus });
      await fetchAdminData();
    } catch (err) {
      console.error('Status update failed:', err);
      alert('Error updating status: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  // Metrics computation
  const totalReports = incidents.length;
  const criticalCount = incidents.filter((i) => i.priority === 'Critical').length;
  const duplicatesBlocked = incidents.filter(
    (i) => i.status && i.status.startsWith('duplicate_of_')
  ).length;
  const resolvedCases = incidents.filter((i) => i.status === 'resolved').length;

  // Filtered dataset
  const filteredIncidents = incidents.filter((inc) => {
    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'duplicates') {
      matchesStatus = inc.status && inc.status.startsWith('duplicate_of_');
    } else if (statusFilter !== 'all') {
      matchesStatus = inc.status === statusFilter;
    }

    // Priority filter
    const matchesPriority = priorityFilter === 'all' || inc.priority === priorityFilter;

    // Search query
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      inc.id?.toString().includes(query) ||
      inc.text?.toLowerCase().includes(query) ||
      inc.category?.toLowerCase().includes(query) ||
      inc.status?.toLowerCase().includes(query);

    return matchesStatus && matchesPriority && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col gap-6">
      {/* Admin Title & Sync Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0B1120] border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emergency-red/15 border border-emergency-red/30 rounded-xl text-emergency-red">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">Admin Incident Command Center</h1>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emergency-red/20 text-emergency-red border border-emergency-red/30 tracking-wider">
                Full Authorization
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              End-to-end telemetry: triage pipeline, NLP duplicate cluster graph, and tactical unit routing.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAdminData}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Sync Master Telemetry</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-emergency-red/15 border border-emergency-red/30 text-emergency-red text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Metrics Bar (4 Critical Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Incoming Reports */}
        <div className="p-5 rounded-2xl bg-[#0B1120] border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Incoming Reports</p>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="text-3xl font-black text-white mt-2 font-mono">{totalReports}</h3>
          <p className="text-[11px] text-slate-500 mt-1">All processed citizen dispatches</p>
        </div>

        {/* Metric 2: Critical Incidents Counter */}
        <div className="p-5 rounded-2xl bg-[#0B1120] border border-emergency-red/30 shadow-lg shadow-emergency-red/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emergency-red uppercase tracking-wider">Critical Incidents</p>
            <Flame className="w-4 h-4 text-emergency-red animate-pulse" />
          </div>
          <h3 className="text-3xl font-black text-white mt-2 font-mono">{criticalCount}</h3>
          <p className="text-[11px] text-slate-500 mt-1">Severity floor &gt;= 75% or trapped/injured</p>
        </div>

        {/* Metric 3: Active Duplicates Blocked */}
        <div className="p-5 rounded-2xl bg-[#0B1120] border border-blue-500/30 shadow-lg shadow-blue-500/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Active Duplicates Blocked</p>
            <Copy className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="text-3xl font-black text-white mt-2 font-mono">{duplicatesBlocked}</h3>
          <p className="text-[11px] text-slate-500 mt-1">Semantic similarity threshold &gt;= 0.85</p>
        </div>

        {/* Metric 4: Resolved Cases */}
        <div className="p-5 rounded-2xl bg-[#0B1120] border border-emerald-500/30 shadow-lg shadow-emerald-500/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Resolved Cases</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-3xl font-black text-white mt-2 font-mono">{resolvedCases}</h3>
          <p className="text-[11px] text-slate-500 mt-1">Successfully mitigated incidents</p>
        </div>
      </div>

      {/* Integrated Leaflet Concentration & Cluster Heatmap View */}
      <div className="p-5 rounded-2xl bg-[#0B1120] border border-slate-800 shadow-xl flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-800 rounded-lg text-emergency-red">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Geo-Incident Concentration & Heatmap Analysis</h3>
              <p className="text-[11px] text-slate-400">Tactical spatial distribution with cluster density halos</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setMapMode('pins')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                mapMode === 'pins' ? 'bg-emergency-red text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pin View
            </button>
            <button
              onClick={() => setMapMode('heatmap')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                mapMode === 'heatmap' ? 'bg-emergency-red text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Concentration Heatmap
            </button>
          </div>
        </div>

        <div className="w-full h-[400px] rounded-xl overflow-hidden relative border border-slate-800">
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Critical Hotspots
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" /> High Density
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" /> Linked Duplicates
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Click any row in the table below to center on its incident coordinates
          </span>
        </div>
      </div>

      {/* Filterable Incident Table / Grid Controls */}
      <div className="p-4 rounded-2xl bg-[#0B1120] border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, text, category, or status..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emergency-red transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-medium focus:outline-none focus:border-emergency-red"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="duplicates">Duplicates Only</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-medium focus:outline-none focus:border-emergency-red"
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="text-[11px] text-slate-400 font-mono pl-2">
            Showing {filteredIncidents.length} of {incidents.length}
          </div>
        </div>
      </div>

      {/* Incident Table */}
      <div className="rounded-2xl bg-[#0B1120] border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-4">ID</th>
                <th className="p-4">Priority & Score</th>
                <th className="p-4">Category</th>
                <th className="p-4">Report Details</th>
                <th className="p-4">Status & Duplicate Link</th>
                <th className="p-4 text-right">Commander Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-emergency-red/30 border-t-emergency-red rounded-full animate-spin mb-2" />
                    <p className="text-xs">Loading master incident repository...</p>
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    No records match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => {
                  const isDuplicate = incident.status && incident.status.startsWith('duplicate_of_');
                  const parentId = isDuplicate ? incident.status.replace('duplicate_of_', '') : null;
                  const isSelected = selectedIncidentId === incident.id;

                  return (
                    <tr
                      key={incident.id}
                      onClick={() => handleFocusIncident(incident)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-800/60'
                          : 'hover:bg-slate-900/50'
                      }`}
                    >
                      {/* ID */}
                      <td className="p-4 font-mono font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>#{incident.id}</span>
                          {incident.latitude && incident.longitude && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emergency-amber" title="Geo-tagged" />
                          )}
                        </div>
                      </td>

                      {/* Priority & Severity Score */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-bold uppercase text-[10px] border shadow-sm w-fit ${
                              PRIORITY_BADGES[incident.priority] || PRIORITY_BADGES.Low
                            }`}
                          >
                            {incident.priority}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Score: <strong className="text-white">{incident.severity_score}</strong>/100
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-200">
                          {incident.category?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Report Snippet */}
                      <td className="p-4 max-w-sm">
                        <p className="text-slate-300 line-clamp-2 leading-relaxed" title={incident.text}>
                          "{incident.text}"
                        </p>
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 font-mono">
                          <span>
                            {new Date(incident.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {incident.reporter_id && <span>User #{incident.reporter_id}</span>}
                        </div>
                      </td>

                      {/* Status & Visual Indicators Linking Duplicates */}
                      <td className="p-4 whitespace-nowrap">
                        {isDuplicate ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const parent = incidents.find((i) => i.id === Number(parentId));
                                if (parent) handleFocusIncident(parent);
                              }}
                              className="px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-500/40 text-blue-300 hover:bg-blue-900/60 font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors w-fit"
                              title={`Click to focus parent incident #${parentId}`}
                            >
                              <Copy className="w-3.5 h-3.5 text-blue-400" />
                              <span>Linked to #{parentId}</span>
                            </button>
                            <span className="text-[10px] text-slate-500">Auto-clustered duplicate</span>
                          </div>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold uppercase border ${
                              STATUS_BADGES[incident.status] || STATUS_BADGES.pending
                            }`}
                          >
                            {incident.status?.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>

                      {/* Action Controls */}
                      <td className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Status Toggles */}
                          {incident.status === 'pending' && (
                            <button
                              type="button"
                              disabled={updatingId === incident.id}
                              onClick={() => handleUpdateStatus(incident.id, 'in_progress')}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold transition-colors disabled:opacity-50"
                              title="Assign and dispatch response"
                            >
                              Deploy
                            </button>
                          )}

                          {incident.status !== 'resolved' && (
                            <button
                              type="button"
                              disabled={updatingId === incident.id}
                              onClick={() => handleUpdateStatus(incident.id, 'resolved')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-semibold transition-colors disabled:opacity-50"
                              title="Mark incident as resolved"
                            >
                              Resolve
                            </button>
                          )}

                          {incident.status !== 'dismissed' && (
                            <button
                              type="button"
                              disabled={updatingId === incident.id}
                              onClick={() => handleUpdateStatus(incident.id, 'dismissed')}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
                              title="Dismiss non-actionable incident"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
