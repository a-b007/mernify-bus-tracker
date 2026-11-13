import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ROOM, DELTA_INTERVAL_MS, encodeCoord } from '../utils/constants.js';
import {
  viewportSchema,
  stopSubSchema,
  routeSubSchema,
} from '../models/schemas.js';
import {
  getStateForCells,
  getBusIndex,
  getState,
} from '../services/processor.js';

let ioInstance = null;
let deltaTimer = null;

// Track active subscriber count per stop: Map<stopId, number>
const stopSubscribers = new Map();

/**
 * Initialize Socket.IO server.
 */
export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: env.SOCKET_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance = io;

  // Socket JWT authentication middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        // Optional unauthenticated guest viewer or reject
        // docs state: "JWT in handshake auth field, verified in io.use() middleware"
        // Let's verify if token exists; if missing, allow guest viewer or reject based on requirement
        // To be compliant with strict auth:
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.user = { email: decoded.email, role: decoded.role || 'viewer' };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    // Current subscribed cells for this socket
    const subscribedCells = new Set();
    const subscribedRoutes = new Set();
    const subscribedStops = new Set();

    // If admin, join admin room
    if (socket.user?.role === 'admin') {
      socket.join('role:admin');
    }

    // Viewport subscription: viewport:set
    socket.on('viewport:set', (data) => {
      const parsed = viewportSchema.safeParse(data);
      if (!parsed.success) {
        return socket.emit('error', { message: 'Invalid viewport payload', issues: parsed.error.issues });
      }

      const newCells = new Set(parsed.data.cells);

      // Leave unneeded cells
      for (const cellId of subscribedCells) {
        if (!newCells.has(cellId)) {
          socket.leave(`${ROOM.CELL}${cellId}`);
          subscribedCells.delete(cellId);
        }
      }

      // Join new cells
      for (const cellId of newCells) {
        if (!subscribedCells.has(cellId)) {
          socket.join(`${ROOM.CELL}${cellId}`);
          subscribedCells.add(cellId);
        }
      }

      // Send initial snapshot for newly subscribed cells
      const snapshotBuses = getStateForCells(Array.from(subscribedCells));
      socket.emit('snapshot', {
        cells: Array.from(subscribedCells),
        buses: snapshotBuses,
      });
    });

    // Route subscription: route:sub
    socket.on('route:sub', (data) => {
      const parsed = routeSubSchema.safeParse(data);
      if (!parsed.success) return;

      const { routeId } = parsed.data;
      socket.join(`${ROOM.ROUTE}${routeId}`);
      subscribedRoutes.add(routeId);
    });

    // Route unsubscription: route:unsub
    socket.on('route:unsub', (data) => {
      const parsed = routeSubSchema.safeParse(data);
      if (!parsed.success) return;

      const { routeId } = parsed.data;
      socket.leave(`${ROOM.ROUTE}${routeId}`);
      subscribedRoutes.delete(routeId);
    });

    // Stop subscription: stop:sub
    socket.on('stop:sub', (data) => {
      const parsed = stopSubSchema.safeParse(data);
      if (!parsed.success) return;

      const { stopId } = parsed.data;
      socket.join(`${ROOM.STOP}${stopId}`);
      subscribedStops.add(stopId);

      // Increment subscriber count
      const count = stopSubscribers.get(stopId) || 0;
      stopSubscribers.set(stopId, count + 1);
    });

    // Stop unsubscription: stop:unsub
    socket.on('stop:unsub', (data) => {
      const parsed = stopSubSchema.safeParse(data);
      if (!parsed.success) return;

      const { stopId } = parsed.data;
      socket.leave(`${ROOM.STOP}${stopId}`);
      subscribedStops.delete(stopId);

      // Decrement subscriber count
      const count = stopSubscribers.get(stopId) || 0;
      if (count <= 1) {
        stopSubscribers.delete(stopId);
      } else {
        stopSubscribers.set(stopId, count - 1);
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      for (const stopId of subscribedStops) {
        const count = stopSubscribers.get(stopId) || 0;
        if (count <= 1) {
          stopSubscribers.delete(stopId);
        } else {
          stopSubscribers.set(stopId, count - 1);
        }
      }
      subscribedCells.clear();
      subscribedRoutes.clear();
      subscribedStops.clear();
    });
  });

  // Start delta broadcast loop
  startDeltaBroadcast();

  return io;
}

let batchSeqCounter = 0;

/**
 * Broadcast pos:delta to active cell rooms every 2s.
 */
function startDeltaBroadcast() {
  if (deltaTimer) clearInterval(deltaTimer);

  deltaTimer = setInterval(() => {
    if (!ioInstance) return;

    // Collect all states
    const states = getState();
    if (!states || states.length === 0) return;

    batchSeqCounter++;
    const now = Date.now();

    // Group rows by cellId so we only send deltas to relevant rooms
    const cellRowsMap = new Map();

    for (const s of states) {
      // Only include if updated recently (within last 3 seconds)
      if (s.updatedAt && (now - s.updatedAt) > 3000) continue;

      const idx = getBusIndex(s.busId);
      const row = [
        idx,
        encodeCoord(s.lat),
        encodeCoord(s.lng),
        Math.round(s.speed * 10),
        s.heading,
        s.seq,
      ];

      if (!cellRowsMap.has(s.cellId)) {
        cellRowsMap.set(s.cellId, []);
      }
      cellRowsMap.get(s.cellId).push(row);
    }

    // Emit pos:delta to each active cell room
    for (const [cellId, rows] of cellRowsMap.entries()) {
      if (rows.length > 0) {
        ioInstance.to(`${ROOM.CELL}${cellId}`).emit('pos:delta', {
          batchSeq: batchSeqCounter,
          t: now,
          cellId,
          rows,
        });
      }
    }
  }, DELTA_INTERVAL_MS);
}

/**
 * Broadcast an alert to admins and viewers of the relevant route.
 */
export function broadcastAlert(alert) {
  if (!ioInstance) return;

  // Send to all admins
  ioInstance.to('role:admin').emit('alert:new', alert);

  // Send to route room if routeId exists
  if (alert.routeId) {
    ioInstance.to(`${ROOM.ROUTE}${alert.routeId}`).emit('alert:new', alert);
  }
}

/**
 * Broadcast ETA updates to subscribed stop room.
 */
export function broadcastEta(stopId, items) {
  if (!ioInstance) return;
  ioInstance.to(`${ROOM.STOP}${stopId}`).emit('eta:update', {
    stopId,
    items,
  });
}

/**
 * Get list of stopIds that have at least one active subscriber.
 */
export function getSubscribedStops() {
  return Array.from(stopSubscribers.keys());
}

/**
 * Stop socket loops and cleanup.
 */
export function closeSocket() {
  if (deltaTimer) clearInterval(deltaTimer);
  deltaTimer = null;
  if (ioInstance) {
    ioInstance.close();
    ioInstance = null;
  }
}
