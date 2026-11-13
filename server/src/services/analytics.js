/**
 * Analytics query functions — MongoDB native aggregation pipelines.
 *
 * Exported functions:
 *   getArrivalTimeline(db, stopId, from, to, routeId?)
 *   getHeadwayHistogram(db, stopId, from, to, routeId?)
 *   getHourlyStats(db, stopId, dayType?, routeId?)
 *   getOnTimePercentage(db, stopId, routeId?)
 *   getRoutePerformance(db, routeId)
 *
 * All functions accept `db` as the first argument (dependency injection).
 * Proper indexing is utilized:
 *   arrivals: (stopId, ts), UNIQUE (busId, tripId, stopId)
 *   stop_hourly_stats: UNIQUE (stopId, routeId, dayType, hour)
 */

let _defaultDb = null;

/**
 * Set a default database instance if desired.
 * @param {import('mongodb').Db} db
 */
export function setDefaultDb(db) {
  _defaultDb = db;
}

/**
 * Resolve db and arguments whether db was passed or omitted.
 */
function resolveDbAndArgs(firstArg, ...rest) {
  if (firstArg && typeof firstArg === 'object' && typeof firstArg.collection === 'function') {
    return [firstArg, rest];
  }
  if (_defaultDb) {
    return [_defaultDb, [firstArg, ...rest]];
  }
  throw new Error('MongoDB db instance must be passed as first argument or configured with setDefaultDb');
}

/**
 * Raw arrivals in time range for a stop.
 *
 * @param {import('mongodb').Db|string} dbOrStopId
 * @param {string|Date} stopIdOrFrom
 * @param {Date|string} fromOrTo
 * @param {Date|string} [toOrRouteId]
 * @param {string} [maybeRouteId]
 * @returns {Promise<Array>}
 */
export async function getArrivalTimeline(dbOrStopId, stopIdOrFrom, fromOrTo, toOrRouteId, maybeRouteId) {
  const [db, args] = resolveDbAndArgs(dbOrStopId, stopIdOrFrom, fromOrTo, toOrRouteId, maybeRouteId);
  const [stopId, from, to, routeId] = args;

  const match = {
    stopId,
    ts: {
      $gte: new Date(from),
      $lte: new Date(to),
    },
  };

  if (routeId) {
    match.routeId = routeId;
  }

  return db.collection('arrivals')
    .find(match)
    .sort({ ts: 1 })
    .toArray();
}

/**
 * Headway distribution for a stop in a given time window.
 *
 * @param {import('mongodb').Db|string} dbOrStopId
 * @param {string|Date} stopIdOrFrom
 * @param {Date|string} fromOrTo
 * @param {Date|string} [toOrRouteId]
 * @param {string} [maybeRouteId]
 * @returns {Promise<Array>}
 */
export async function getHeadwayHistogram(dbOrStopId, stopIdOrFrom, fromOrTo, toOrRouteId, maybeRouteId) {
  const [db, args] = resolveDbAndArgs(dbOrStopId, stopIdOrFrom, fromOrTo, toOrRouteId, maybeRouteId);
  const [stopId, from, to, routeId] = args;

  const match = {
    stopId,
    ts: {
      $gte: new Date(from),
      $lte: new Date(to),
    },
    headwayS: { $ne: null, $gte: 0 },
  };

  if (routeId) {
    match.routeId = routeId;
  }

  // 1-minute to 30-minute headway boundaries
  const boundaries = [0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 720, 900, 1200, 1500, 1800];

  return db.collection('arrivals').aggregate([
    { $match: match },
    {
      $bucket: {
        groupBy: '$headwayS',
        boundaries,
        default: '1800+',
        output: {
          count: { $sum: 1 },
          avgHeadwayS: { $avg: '$headwayS' },
          minHeadwayS: { $min: '$headwayS' },
          maxHeadwayS: { $max: '$headwayS' },
        },
      },
    },
  ]).toArray();
}

/**
 * Hourly roll-up statistics for a stop.
 *
 * @param {import('mongodb').Db|string} dbOrStopId
 * @param {string} [stopIdOrDayType]
 * @param {string} [dayTypeOrRouteId]
 * @param {string} [maybeRouteId]
 * @returns {Promise<Array>}
 */
export async function getHourlyStats(dbOrStopId, stopIdOrDayType, dayTypeOrRouteId, maybeRouteId) {
  const [db, args] = resolveDbAndArgs(dbOrStopId, stopIdOrDayType, dayTypeOrRouteId, maybeRouteId);
  const [stopId, dayType, routeId] = args;

  const match = { stopId };
  if (dayType) {
    match.dayType = dayType;
  }
  if (routeId) {
    match.routeId = routeId;
  }

  return db.collection('stop_hourly_stats')
    .find(match)
    .sort({ hour: 1 })
    .toArray();
}

/**
 * On-time percentage for a stop: % of arrivals with |delayS| < 120s.
 *
 * @param {import('mongodb').Db|string} dbOrStopId
 * @param {string} [stopIdOrRouteId]
 * @param {string} [maybeRouteId]
 * @returns {Promise<{total: number, onTime: number, percentage: number}>}
 */
export async function getOnTimePercentage(dbOrStopId, stopIdOrRouteId, maybeRouteId) {
  const [db, args] = resolveDbAndArgs(dbOrStopId, stopIdOrRouteId, maybeRouteId);
  const [stopId, routeId] = args;

  const match = {
    stopId,
    delayS: { $ne: null },
  };
  if (routeId) {
    match.routeId = routeId;
  }

  const result = await db.collection('arrivals').aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        onTime: {
          $sum: {
            $cond: [{ $lt: [{ $abs: '$delayS' }, 120] }, 1, 0],
          },
        },
      },
    },
  ]).toArray();

  if (result.length === 0) {
    return { total: 0, onTime: 0, percentage: 100 };
  }

  const { total, onTime } = result[0];
  const percentage = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 100;

  return {
    total,
    onTime,
    percentage,
  };
}

/**
 * Route-level performance: average delay and headway stats across all stops.
 *
 * @param {import('mongodb').Db|string} dbOrRouteId
 * @param {string} [maybeRouteId]
 * @returns {Promise<{routeId: string, avgDelayS: number, avgHeadwayS: number, minHeadwayS: number, maxHeadwayS: number, totalArrivals: number, onTimePercentage: number}>}
 */
export async function getRoutePerformance(dbOrRouteId, maybeRouteId) {
  const [db, args] = resolveDbAndArgs(dbOrRouteId, maybeRouteId);
  const [routeId] = args;

  const match = {
    routeId,
    delayS: { $ne: null },
  };

  const result = await db.collection('arrivals').aggregate([
    { $match: match },
    {
      $group: {
        _id: '$routeId',
        avgDelayS: { $avg: '$delayS' },
        avgHeadwayS: { $avg: '$headwayS' },
        minHeadwayS: { $min: '$headwayS' },
        maxHeadwayS: { $max: '$headwayS' },
        totalArrivals: { $sum: 1 },
        onTimeCount: {
          $sum: {
            $cond: [{ $lt: [{ $abs: '$delayS' }, 120] }, 1, 0],
          },
        },
      },
    },
  ]).toArray();

  if (result.length === 0) {
    return {
      routeId,
      avgDelayS: 0,
      avgHeadwayS: 0,
      minHeadwayS: 0,
      maxHeadwayS: 0,
      totalArrivals: 0,
      onTimePercentage: 100,
    };
  }

  const r = result[0];
  const onTimePercentage = r.totalArrivals > 0
    ? Math.round((r.onTimeCount / r.totalArrivals) * 10000) / 100
    : 100;

  return {
    routeId,
    avgDelayS: Math.round(r.avgDelayS * 100) / 100,
    avgHeadwayS: Math.round((r.avgHeadwayS || 0) * 100) / 100,
    minHeadwayS: r.minHeadwayS ?? 0,
    maxHeadwayS: r.maxHeadwayS ?? 0,
    totalArrivals: r.totalArrivals,
    onTimePercentage,
  };
}

export default {
  getArrivalTimeline,
  getHeadwayHistogram,
  getHourlyStats,
  getOnTimePercentage,
  getRoutePerformance,
  setDefaultDb,
};
