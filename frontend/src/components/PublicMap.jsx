import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import client from '../api/client';
import { MapPin, RefreshCw, AlertCircle, Layers } from 'lucide-react';

const DEFAULT_CENTER = [18.5204, 73.8567]; // Pune default center
const DEFAULT_ZOOM = 12;

// Priority color mapping
const PRIORITY_COLORS = {
  Critical: {
    hex: '#EF4444',
    name: 'Red',
    bg: 'bg-red-500',
    border: '#B91C1C',
    glow: 'rgba(239, 68, 68, 0.45)',
  },
  High: {
    hex: '#F97316',
    name: 'Orange',
    bg: 'bg-orange-500',
    border: '#C2410C',
    glow: 'rgba(249, 115, 22, 0.45)',
  },
  Medium: {
    hex: '#EAB308',
    name: 'Yellow',
    bg: 'bg-yellow-500',
    border: '#A16207',
    glow: 'rgba(234, 179, 8, 0.45)',
  },
  Low: {
    hex: '#3B82F6',
    name: 'Blue',
    bg: 'bg-blue-500',
    border: '#1D4ED8',
    glow: 'rgba(59, 130, 246, 0.45)',
  },
};

const createMarkerIcon = (priority) => {
  const config = PRIORITY_COLORS[priority] || PRIORITY_COLORS.Low;
  const isHighPriority = priority === 'Critical' || priority === 'High';

  const pulseRing = isHighPriority
    ? `<span style="
        position: absolute;
        top: -6px;
        left: -6px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background-color: ${config.glow};
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        pointer-events: none;
      "></span>`
    : '';

  const html = `
    <div style="position: relative; width: 18px; height: 18px;">
      ${pulseRing}
      <div style="
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: ${config.hex};
        border: 2px solid #ffffff;
        box-shadow: 0 0 10px ${config.glow}, 0 2px 5px rgba(0,0,0,0.5);
      "></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
};

const PublicMap = ({ externalIncidents, onRefreshRequested }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  const [incidents, setIncidents] = useState(externalIncidents || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch active incidents from GET /dashboard/public
  const fetchIncidents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.get('/dashboard/public');
      setIncidents(response.data || []);
      if (onRefreshRequested) {
        onRefreshRequested();
      }
    } catch (err) {
      console.error('Failed to load public incidents map feed:', err);
      setError('Unable to load live incident map data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (externalIncidents) {
      setIncidents(externalIncidents);
    } else {
      fetchIncidents();
    }
  }, [externalIncidents]);

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      // CartoDB Dark Matter tiles or OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapRef.current = map;

      // Invalidate size after initial layout
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, []);

  // Update Markers and dynamically center/fit bounds
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    const validPins = [];

    incidents.forEach((inc) => {
      const lat = parseFloat(inc.latitude);
      const lon = parseFloat(inc.longitude);

      if (!isNaN(lat) && !isNaN(lon)) {
        validPins.push([lat, lon]);

        const priorityConfig = PRIORITY_COLORS[inc.priority] || PRIORITY_COLORS.Low;
        const formattedDate = inc.created_at
          ? new Date(inc.created_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Just now';

        const categoryFormatted = (inc.category || 'Incident')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        const marker = L.marker([lat, lon], {
          icon: createMarkerIcon(inc.priority),
        });

        // Popup with Category, Priority, and submission timestamp
        const popupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; color: #0F172A; min-width: 200px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: 800; color: #64748B; font-family: monospace;">INCIDENT #${inc.id}</span>
              <span style="
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                padding: 2px 8px;
                border-radius: 9999px;
                background-color: ${priorityConfig.hex};
                color: #ffffff;
              ">${inc.priority}</span>
            </div>
            <p style="margin: 0 0 6px; font-weight: 700; font-size: 13px; color: #0F172A; line-height: 1.3;">
              ${categoryFormatted}
            </p>
            <div style="border-top: 1px solid #E2E8F0; padding-top: 6px; font-size: 11px; color: #64748B; display: flex; flex-direction: column; gap: 2px;">
              <div><strong>Reported:</strong> ${formattedDate}</div>
              <div><strong>Location:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 280 });
        marker.addTo(markersGroupRef.current);
      }
    });

    // Dynamically center around active pins
    if (validPins.length > 0) {
      try {
        if (validPins.length === 1) {
          mapRef.current.setView(validPins[0], 14, { animate: true });
        } else {
          const bounds = L.latLngBounds(validPins);
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
        }
      } catch (err) {
        console.warn('Could not fit bounds on map:', err);
      }
    } else {
      mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, [incidents]);

  return (
    <div className="p-5 rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl flex flex-col h-full min-h-[580px]">
      {/* Top Map Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emergency-amber/15 border border-emergency-amber/30 rounded-xl text-emergency-amber">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Active Verified Incidents Map</h3>
            <p className="text-xs text-slate-400">Public Leaflet view (sanitized, excluding duplicate records)</p>
          </div>
        </div>

        <button
          onClick={fetchIncidents}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh Map Pins"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Sync Pins</span>
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-emergency-red/10 border border-emergency-red/30 text-emergency-red text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 w-full rounded-xl overflow-hidden relative border border-slate-800 min-h-[400px]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {isLoading && (
          <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 flex items-center gap-2 z-[400]">
            <span className="w-3.5 h-3.5 border-2 border-emergency-amber/30 border-t-emergency-amber rounded-full animate-spin" />
            <span>Updating map feed...</span>
          </div>
        )}
      </div>

      {/* Map Legend Row */}
      <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-slate-300">
          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Priority Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shadow-sm shadow-red-500/50" />
            <span>Critical</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] shadow-sm shadow-orange-500/50" />
            <span>High</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308] shadow-sm shadow-yellow-500/50" />
            <span>Medium</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] shadow-sm shadow-blue-500/50" />
            <span>Low</span>
          </span>
        </div>

        <div className="text-[11px] text-slate-400 font-medium">
          {incidents.filter((i) => i.latitude && i.longitude).length} active geo-located incidents
        </div>
      </div>
    </div>
  );
};

export default PublicMap;
