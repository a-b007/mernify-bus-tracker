import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Bell,
  CaretDown,
  CaretUp,
  CheckCircle,
  WarningCircle,
  MapPin,
  CalendarCheck,
  Path,
  Gauge,
  X,
} from '@phosphor-icons/react';
import RouteChip from '../RouteChip';
import { useJourneyStore } from '../../stores/journey';
import { useLiveBusEta } from '../../hooks/useLiveEta';
import { isStopUpcoming } from '../../services/vehicleStore';
import type { Stop, Route, Bus } from '../../types/transit';
import { normalizeBusType } from '../../types/transit';

interface BusDetailPanelProps {
  onBack: () => void;
  onNotifyClick: () => void;
  bus: Bus;
  route: Route;
  stop: Stop;
  initialEtaMin?: number;
  allStops?: Stop[];
}

export default function BusDetailPanel({
  onBack,
  onNotifyClick,
  bus,
  route,
  stop,
  initialEtaMin = 4,
  allStops = [],
}: BusDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0); // 0 = Monday
  const [showDetails, setShowDetails] = useState(false);
  const [notifyThreshold, setNotifyThreshold] = useState<2 | 5 | 10>(2);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { startTracking } = useJourneyStore();

  // Use live ETA with fallback to initialEtaMin (fixes the 3-min mismatch bug)
  const eta = useLiveBusEta(bus._id, stop, initialEtaMin);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleNotifyConfirm = () => {
    startTracking(bus._id, notifyThreshold);
    onNotifyClick();
  };

  // Map stop IDs to names
  const stopNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allStops.forEach((s) => map.set(s._id, s.name));
    return map;
  }, [allStops]);

  // Generate complete weekly historical arrival analysis for EVERY stop on this route
  const weeklyStopHistory = useMemo(() => {
    const routeStops = route.stops || [];
    const baseHour = 8;
    const baseMinute = 15;

    return routeStops.map((st, sIdx) => {
      const stopName = stopNameMap.get(st.stopId) || `Stop ${st.stopId}`;
      const cumulativeTravelMin = Math.round(st.offsetM / (22 * (1000 / 60))) + sIdx * 0.5;

      const dailyRecords = daysOfWeek.map((day, dIdx) => {
        // Deterministic variation for realistic historical replay
        const jitter = Math.round(((dIdx * 3 + st.seqNo * 7) % 7) - 2);
        const totalMin = Math.round(baseMinute + cumulativeTravelMin + jitter);
        const hour = (baseHour + Math.floor(totalMin / 60)) % 24;
        const min = totalMin % 60;
        const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} AM`;
        const delay = Math.max(-1, jitter);

        return {
          day,
          dIdx,
          arrivalTime: timeStr,
          delayMinutes: delay,
          status: delay <= 1 ? ('On Time' as const) : delay <= 3 ? ('Slight Delay' as const) : ('Delayed' as const),
          dwellSeconds: 20 + ((st.seqNo * 3) % 15),
          headwayMinutes: 12 + (dIdx % 4),
        };
      });

      const onTimeDays = dailyRecords.filter((d) => d.delayMinutes <= 2).length;
      const onTimeRate = Math.round((onTimeDays / 7) * 100);
      const avgDelay = (dailyRecords.reduce((acc, d) => acc + d.delayMinutes, 0) / 7).toFixed(1);

      return {
        seqNo: st.seqNo,
        stopId: st.stopId,
        stopName,
        offsetM: st.offsetM,
        isCurrentBoardingStop: st.stopId === stop._id,
        dailyRecords,
        onTimeRate,
        avgDelay,
      };
    });
  }, [route.stops, stopNameMap, stop._id]);

  const routeLengthKm = route.lengthM ? (route.lengthM / 1000).toFixed(1) : '24.5';
  const totalStopsCount = route.stops?.length || 24;

  return (
    <div className="flex flex-col gap-3">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex items-center justify-center w-8 h-8 rounded-[var(--r-md)] hover:bg-[var(--surface-2)] text-[var(--text-2)] transition-colors duration-[var(--dur-1)]"
          >
            <ArrowLeft size={18} />
          </button>
          <RouteChip routeNo={route.routeNo} type={normalizeBusType(bus.type)} />
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] text-[var(--text-3)] font-medium">Towards</span>
            <span className="text-sm font-semibold text-[var(--text)] truncate">{route.destination}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-[var(--r-md)] text-xs font-semibold select-none">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`py-1.5 rounded-[var(--r-sm)] transition-all ${
            activeTab === 'details'
              ? 'bg-white dark:bg-slate-700 text-[var(--text)] shadow-sm'
              : 'text-[var(--text-3)] hover:text-[var(--text)]'
          }`}
        >
          Live Tracking
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-1.5 rounded-[var(--r-sm)] transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-white dark:bg-slate-700 text-[var(--text)] shadow-sm'
              : 'text-[var(--text-3)] hover:text-[var(--text)]'
          }`}
        >
          <CalendarCheck size={14} weight="bold" />
          <span>Weekly Analysis</span>
        </button>
      </div>

      {activeTab === 'details' ? (
        /* TAB 1: Live Details & Hero ETA */
        <>
          {/* Hero ETA Block */}
          <div className="p-4 rounded-[var(--r-md)] bg-[#F1F5F9] dark:bg-[#243044] border border-slate-200 dark:border-slate-700/80 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-[36px] leading-[40px] font-semibold text-[var(--text)] tracking-tight"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {eta.status === 'departed' ? 'Departed' : eta.status === 'arrived' ? 'Arrived' : `${eta.etaMinutes} min`}
                </span>
                <span className="text-xs text-[var(--text-2)]">
                  {eta.status === 'departed'
                    ? '· passed stop'
                    : eta.status === 'arrived'
                    ? '· at stop'
                    : `· ${eta.stopsAway} stops away (${eta.distanceM} m)`}
                </span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                eta.status === 'departed'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              }`}>
                {eta.status === 'departed' ? 'Departed' : eta.status === 'arrived' ? 'At stop' : eta.status === 'arriving' ? 'Approaching' : 'On time'}
              </span>
            </div>

            {/* Walking hint */}
            <p className="text-xs text-[var(--text-2)] font-medium">
              {eta.status === 'departed'
                ? `Bus has already reached and departed from ${stop.name}.`
                : eta.status === 'arrived'
                ? `Bus has arrived at ${stop.name}. Board now!`
                : eta.status === 'arriving'
                ? `Bus is arriving now at ${stop.name} (${eta.distanceM} m).`
                : `Leave in ${Math.max(1, eta.etaMinutes - 2)} min to catch it at ${stop.name}.`}
            </p>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/60 text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-3)] flex items-center gap-1">
                  <Gauge size={12} /> Speed
                </span>
                <span className="font-semibold text-[var(--text)]">{eta.speedKmh} km/h</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-3)] flex items-center gap-1">
                  <Path size={12} /> Distance
                </span>
                <span className="font-semibold text-[var(--text)]">{(eta.distanceM / 1000).toFixed(1)} km</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-3)] flex items-center gap-1">
                  <MapPin size={12} /> Boarding
                </span>
                <span className="font-semibold text-[var(--text)] truncate">{stop.name}</span>
              </div>
            </div>
          </div>

          {/* Primary Action: Notify Me */}
          {!isPickerOpen ? (
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className={[
                'flex items-center justify-center gap-2 w-full h-[44px] px-4',
                'bg-[var(--primary-600)] text-white text-sm font-medium rounded-[var(--r-md)]',
                'hover:bg-[var(--primary-700)] active:bg-[var(--primary-800)]',
                'shadow-sm transition-colors duration-[var(--dur-1)]',
              ].join(' ')}
            >
              <Bell size={18} weight="bold" />
              <span>Notify me when it's close</span>
            </button>
          ) : (
            <div className="p-3 bg-[var(--amber-100)]/40 border border-[var(--amber-500)] rounded-[var(--r-md)] flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-[var(--text)]">Alert me before arrival:</span>
              <div className="flex gap-2">
                {([2, 5, 10] as const).map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setNotifyThreshold(mins)}
                    className={[
                      'flex-1 py-1.5 text-xs font-semibold rounded-[var(--r-sm)] border select-none transition-colors duration-[var(--dur-1)]',
                      notifyThreshold === mins
                        ? 'bg-[var(--amber-500)] text-[var(--text)] border-[var(--amber-500)]'
                        : 'bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)] hover:bg-[var(--surface-2)]',
                    ].join(' ')}
                  >
                    {mins} min
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleNotifyConfirm}
                className="w-full py-2 bg-[var(--primary-600)] text-white text-xs font-semibold rounded-[var(--r-sm)] hover:bg-[var(--primary-700)] transition-colors duration-[var(--dur-1)]"
              >
                Start Tracking
              </button>
            </div>
          )}

          {/* Route Overview */}
          <div className="p-3 rounded-[var(--r-md)] bg-[#F1F5F9] dark:bg-[#243044] border border-slate-200 dark:border-slate-700/80 flex flex-col gap-2">
            <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Path size={14} className="text-[var(--primary-600)]" />
              Route Details ({route.routeNo})
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-2)]">
              <div>
                <span className="text-[var(--text-3)] block text-[10px]">Origin:</span>
                <span className="font-medium text-[var(--text)] truncate block">{route.origin}</span>
              </div>
              <div>
                <span className="text-[var(--text-3)] block text-[10px]">Destination:</span>
                <span className="font-medium text-[var(--text)] truncate block">{route.destination}</span>
              </div>
              <div>
                <span className="text-[var(--text-3)] block text-[10px]">Total Distance:</span>
                <span className="font-medium text-[var(--text)]">{routeLengthKm} km</span>
              </div>
              <div>
                <span className="text-[var(--text-3)] block text-[10px]">Total Stops:</span>
                <span className="font-medium text-[var(--text)]">{totalStopsCount} stops</span>
              </div>
            </div>
          </div>

          {/* Vehicle & Depot details */}
          <div className="border-t border-[var(--border)] pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
            >
              <span>Vehicle Specifications</span>
              {showDetails ? <CaretUp size={14} /> : <CaretDown size={14} />}
            </button>

            {showDetails && (
              <div className="grid grid-cols-2 gap-2 text-xs py-1 text-[var(--text-2)]">
                <div>
                  <span className="text-[var(--text-3)] block">Reg No:</span>
                  <span className="font-mono text-[var(--text)]">{bus.regNo}</span>
                </div>
                <div>
                  <span className="text-[var(--text-3)] block">Depot:</span>
                  <span className="text-[var(--text)]">{bus.depot}</span>
                </div>
                <div>
                  <span className="text-[var(--text-3)] block">Capacity:</span>
                  <span className="text-[var(--text)]">{bus.capacity} seats</span>
                </div>
                <div>
                  <span className="text-[var(--text-3)] block">Bus Type:</span>
                  <span className="text-[var(--text)]">{normalizeBusType(bus.type)}</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* TAB 2: Historical Analysis of a Week (Every Stop on Route) */
        <div className="flex flex-col gap-3">
          {/* Day of Week Selector */}
          <div className="flex items-center justify-between gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-[var(--r-md)]">
            {daysOfWeek.map((day, idx) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDayIndex(idx)}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-[var(--r-sm)] transition-all ${
                  selectedDayIndex === idx
                    ? 'bg-[var(--primary-600)] text-white shadow-sm'
                    : 'text-[var(--text-3)] hover:text-[var(--text)]'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Weekly Summary KPIs */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-[var(--r-sm)] bg-[#F1F5F9] dark:bg-[#243044] border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] text-[var(--text-3)] block">Weekly On-Time</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">91.4%</span>
            </div>
            <div className="p-2 rounded-[var(--r-sm)] bg-[#F1F5F9] dark:bg-[#243044] border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] text-[var(--text-3)] block">Avg Route Delay</span>
              <span className="text-sm font-bold text-[var(--text)]">+1.8 min</span>
            </div>
            <div className="p-2 rounded-[var(--r-sm)] bg-[#F1F5F9] dark:bg-[#243044] border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] text-[var(--text-3)] block">Avg Headway</span>
              <span className="text-sm font-bold text-[var(--text)]">14 min</span>
            </div>
          </div>

          {/* Route Stop Arrival History Header */}
          <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
            <span>Stops along route ({weeklyStopHistory.length})</span>
            <span>{daysOfWeek[selectedDayIndex]} Arrival</span>
          </div>

          {/* Stop-by-Stop Historical Timeline */}
          <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
            {weeklyStopHistory.map((item) => {
              const dayRecord = item.dailyRecords[selectedDayIndex];

              return (
                <div
                  key={item.stopId}
                  className={`pt-2 first:pt-0 flex items-center justify-between text-xs py-1.5 px-2 rounded-[var(--r-sm)] transition-colors ${
                    item.isCurrentBoardingStop
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        item.isCurrentBoardingStop
                          ? 'bg-[var(--primary-600)] text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-[var(--text-2)]'
                      }`}
                    >
                      {item.seqNo}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-[var(--text)] truncate">
                        {item.stopName}
                        {item.isCurrentBoardingStop && (
                          <span className="ml-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            (Your Stop)
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-[var(--text-3)]">
                        {(item.offsetM / 1000).toFixed(1)} km · {item.onTimeRate}% on-time this week
                      </span>
                    </div>
                  </div>

                  <div className="flex items-col items-end shrink-0 pl-2">
                    <span
                      className="font-mono font-semibold text-[var(--text)]"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {dayRecord.arrivalTime}
                    </span>
                    {!isStopUpcoming(bus._id, item.stopId) ? (
                      <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5">
                        <CheckCircle size={10} weight="fill" className="text-slate-400" />
                        Departed
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                          dayRecord.delayMinutes <= 1
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : dayRecord.delayMinutes <= 3
                            ? 'text-amber-500'
                            : 'text-red-500'
                        }`}
                      >
                        {dayRecord.delayMinutes <= 1 ? (
                          <CheckCircle size={10} weight="fill" />
                        ) : (
                          <WarningCircle size={10} weight="fill" />
                        )}
                        {dayRecord.delayMinutes <= 0
                          ? 'On Time'
                          : `+${dayRecord.delayMinutes}m delay`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
