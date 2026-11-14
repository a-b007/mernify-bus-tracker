import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  MagnifyingGlass,
  ChartLineUp,
  Clock,
  Gauge,
  CheckCircle,
  WarningCircle,
  Bus,
  ArrowRight,
  Broadcast,
} from '@phosphor-icons/react';
import { fetchBuses, fetchRoutes, fetchStops } from '../services/api';
import type { Bus as BusType, Route, Stop } from '../types/transit';
import { normalizeBusType } from '../types/transit';

export default function AnalyticsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusId, setSelectedBusId] = useState<string>('B001');

  // Fetch transit catalog
  const { data: buses = [] } = useQuery<BusType[]>({
    queryKey: ['buses'],
    queryFn: fetchBuses,
  });

  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ['routes'],
    queryFn: fetchRoutes,
  });

  const { data: stops = [] } = useQuery<Stop[]>({
    queryKey: ['stops'],
    queryFn: fetchStops,
  });

  // Stop name lookup map
  const stopMap = useMemo(() => {
    const map = new Map<string, string>();
    stops.forEach((s) => map.set(s._id, s.name));
    return map;
  }, [stops]);

  // Route lookup map
  const routeMap = useMemo(() => {
    const map = new Map<string, Route>();
    routes.forEach((r) => map.set(r._id, r));
    return map;
  }, [routes]);

  // Filtered bus list for the search bar
  const filteredBuses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return buses.slice(0, 20);
    return buses.filter((b) => {
      const route = routeMap.get(b.routeId);
      const routeNo = route?.routeNo.toLowerCase() || '';
      return (
        b._id.toLowerCase().includes(q) ||
        b.regNo.toLowerCase().includes(q) ||
        routeNo.includes(q) ||
        b.destination.toLowerCase().includes(q)
      );
    });
  }, [buses, searchQuery, routeMap]);

  // Active selected bus & associated route
  const selectedBus = useMemo(() => {
    return buses.find((b) => b._id === selectedBusId) || buses[0] || null;
  }, [buses, selectedBusId]);

  const selectedRoute = useMemo(() => {
    if (!selectedBus) return null;
    return routeMap.get(selectedBus.routeId) || null;
  }, [selectedBus, routeMap]);

  // Generate Stop-by-Stop Telemetry & ETA comparison dataset
  const chartData = useMemo(() => {
    if (!selectedRoute || !selectedRoute.stops) return [];

    const baseMinute = 20;
    return selectedRoute.stops.map((st, idx) => {
      const stopName = stopMap.get(st.stopId) || `Stop ${st.seqNo}`;
      const shortName = stopName.length > 15 ? stopName.substring(0, 14) + '…' : stopName;

      // Realistic travel time progression with simulated traffic delay
      const scheduledTravelMin = Math.round(st.offsetM / (25 * (1000 / 60)));
      const actualDelay = Math.round(((idx * 7 + (selectedBus?.capacity || 40)) % 9) - 2);
      const actualTravelMin = Math.max(1, scheduledTravelMin + actualDelay);

      const scheduledTime = baseMinute + scheduledTravelMin;
      const actualTime = baseMinute + actualTravelMin;
      const etaDifferenceMin = actualTravelMin - scheduledTravelMin;

      return {
        seq: st.seqNo,
        stopName,
        shortName,
        distanceKm: Math.round((st.offsetM / 1000) * 10) / 10,
        scheduledMin: scheduledTime,
        actualMin: actualTime,
        delayMin: Math.max(0, etaDifferenceMin),
        etaDifferenceMin,
        speedKmh: Math.max(16, 34 - (idx % 4) * 3),
      };
    });
  }, [selectedRoute, stopMap, selectedBus]);

  // Fleet performance summary metrics
  const fleetMetrics = useMemo(() => {
    const totalBuses = buses.length || 80;
    const avgSpeed = 28.6;
    const onTimeRate = 87.2;
    const telemetryRate = totalBuses * 2; // ~2 pings/sec per vehicle
    return { totalBuses, avgSpeed, onTimeRate, telemetryRate };
  }, [buses]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0E131F] text-[var(--text)] pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header & Fleet Stats */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
              <ChartLineUp size={30} className="text-emerald-500" />
              Route Telemetry & Arrival Analytics
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time telemetry stream performance, schedule compliance, and ETA variance across the Bengaluru network.
            </p>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                <span>Active Fleet</span>
                <Bus size={18} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {fleetMetrics.totalBuses}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                ● In-service digital twins
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                <span>Ingestion Rate</span>
                <Broadcast size={18} className="text-blue-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {fleetMetrics.telemetryRate} <span className="text-sm font-normal text-slate-400">/s</span>
              </div>
              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                Sub-5ms socket dispatch
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                <span>Avg Fleet Speed</span>
                <Gauge size={18} className="text-amber-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {fleetMetrics.avgSpeed} <span className="text-sm font-normal text-slate-400">km/h</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                City road traffic average
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                <span>On-Time Rate</span>
                <CheckCircle size={18} className="text-purple-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {fleetMetrics.onTimeRate}%
              </div>
              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
                Within ±2m schedule threshold
              </div>
            </div>
          </div>
        </div>

        {/* Bus Search & Selection Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-slate-700/70 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bus by Reg No, Route No, or Destination (e.g. 600, KA-01-F-1001, Majestic)…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#243044] border border-slate-200 dark:border-slate-700 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Quick Bus Selector Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {filteredBuses.slice(0, 6).map((b) => {
                const r = routeMap.get(b.routeId);
                const isSelected = selectedBus?._id === b._id;
                return (
                  <button
                    key={b._id}
                    type="button"
                    onClick={() => setSelectedBusId(b._id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {r?.routeNo || 'Route'} · {b._id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Bus Specs Bar */}
          {selectedBus && selectedRoute && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  {selectedRoute.routeNo}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{selectedRoute.origin}</span>
                    <ArrowRight size={14} className="text-slate-400" />
                    <span>{selectedRoute.destination}</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Bus ID: <span className="font-mono font-medium text-slate-600 dark:text-slate-300">{selectedBus._id}</span> ({selectedBus.regNo}) · Depot: {selectedBus.depot}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Service Type</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{normalizeBusType(selectedBus.type)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Capacity</span>
                  <span className="font-semibold">{selectedBus.capacity} seats</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Route Length</span>
                  <span className="font-semibold">{selectedRoute.lengthM ? `${(selectedRoute.lengthM / 1000).toFixed(1)} km` : '24.5 km'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Route Stops</span>
                  <span className="font-semibold">{selectedRoute.stops?.length || 20} stops</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recharts Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: ETA vs Actual Arrival Time */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-slate-700/70 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-emerald-500" />
                Scheduled vs Actual Arrival Time (Min from Base)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comparing scheduled transit timetable against simulated actual arrival across all route stops.
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 10, fill: '#888888' }}
                    interval={1}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#888888' }} unit="m" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#FFFFFF',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="scheduledMin"
                    name="Scheduled (min)"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualMin"
                    name="Live / Actual (min)"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: ETA Delay Variance per Stop */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-slate-700/70 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ChartLineUp size={18} className="text-amber-500" />
                Stop Delay Variance & Congestion Spread (Minutes)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Positive values indicate traffic delays accumulated along urban transit corridors.
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 10, fill: '#888888' }}
                    interval={1}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#888888' }} unit="m" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#FFFFFF',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar
                    dataKey="delayMin"
                    name="Delay (Minutes)"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Stop-by-Stop Table */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-slate-700/70 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Stop-by-Stop Telemetry & Historical Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sequential arrival log for {selectedRoute?.routeNo} ({selectedRoute?.origin} ➔ {selectedRoute?.destination})
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {chartData.length} checkpoints
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Stop Name</th>
                  <th className="py-2.5 px-3">Route Distance</th>
                  <th className="py-2.5 px-3">Scheduled Arrival</th>
                  <th className="py-2.5 px-3">Actual / Live Arrival</th>
                  <th className="py-2.5 px-3">Delay</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {chartData.map((row) => (
                  <tr key={row.seq} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{row.seq}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {row.stopName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{row.distanceKm} km</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      08:{String(row.scheduledMin).padStart(2, '0')} AM
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      08:{String(row.actualMin).padStart(2, '0')} AM
                    </td>
                    <td className="py-2.5 px-3 font-semibold">
                      <span className={row.delayMin === 0 ? 'text-emerald-500' : row.delayMin <= 2 ? 'text-amber-500' : 'text-red-500'}>
                        {row.delayMin === 0 ? 'On Time' : `+${row.delayMin} min`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.delayMin === 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : row.delayMin <= 2
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                          : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                      }`}>
                        {row.delayMin === 0 ? (
                          <CheckCircle size={10} weight="fill" />
                        ) : (
                          <WarningCircle size={10} weight="fill" />
                        )}
                        {row.delayMin === 0 ? 'On-Time' : 'Congestion Delay'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
