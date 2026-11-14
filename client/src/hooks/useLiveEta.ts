import { useState, useEffect } from 'react';
import { getBusLiveEta, type LiveEtaResult } from '../services/vehicleStore';
import type { Stop } from '../types/transit';

export function useLiveBusEta(
  busId: string | null | undefined,
  stop: Stop | null | undefined,
  fallbackEtaMin: number = 3
): LiveEtaResult {
  const [eta, setEta] = useState<LiveEtaResult>(() => {
    if (busId && stop?.loc?.coordinates) {
      const live = getBusLiveEta(busId, stop.loc.coordinates, stop._id);
      if (live) return live;
    }
    return {
      etaSeconds: fallbackEtaMin * 60,
      etaMinutes: fallbackEtaMin,
      distanceM: Math.round(fallbackEtaMin * 300),
      stopsAway: Math.max(1, Math.round(fallbackEtaMin / 2)),
      speedKmh: 24,
      status: 'scheduled',
    };
  });

  useEffect(() => {
    if (!busId || !stop?.loc?.coordinates) return;

    const tick = () => {
      const live = getBusLiveEta(busId, stop.loc.coordinates, stop._id);
      if (live) {
        setEta(live);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [busId, stop]);

  return eta;
}
