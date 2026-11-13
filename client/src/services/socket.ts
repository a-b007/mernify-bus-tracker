import { io, type Socket } from 'socket.io-client';
import { ensureAuthToken } from './api';
import { applySnapshot, applyDeltaRows } from './vehicleStore';
import type { EtaItem, AlertItem } from '../types/transit';

let socket: Socket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const etaListeners = new Set<(eta: { stopId: string; items: EtaItem[] }) => void>();
const alertListeners = new Set<(alert: AlertItem) => void>();
const connectionStatusListeners = new Set<(connected: boolean) => void>();

export function subscribeEtaUpdates(callback: (eta: { stopId: string; items: EtaItem[] }) => void) {
  etaListeners.add(callback);
  return () => {
    etaListeners.delete(callback);
  };
}

export function subscribeAlerts(callback: (alert: AlertItem) => void) {
  alertListeners.add(callback);
  return () => {
    alertListeners.delete(callback);
  };
}

export function subscribeConnectionStatus(callback: (connected: boolean) => void) {
  connectionStatusListeners.add(callback);
  return () => {
    connectionStatusListeners.delete(callback);
  };
}

export async function connectSocket(): Promise<Socket | null> {
  if (socket && socket.connected) return socket;

  try {
    const token = await ensureAuthToken();

    // Default to port 3001 if in development, or relative origin
    const socketUrl = window.location.port === '5173' ? 'http://localhost:3001' : '/';

    socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      connectionStatusListeners.forEach((cb) => cb(true));
      // Auto-subscribe to central Bengaluru cells on initial connect
      updateSubscribedCells([
        'c_12.96_77.56',
        'c_12.96_77.58',
        'c_12.98_77.56',
        'c_12.98_77.58',
        'c_13.00_77.58',
      ]);
    });

    socket.on('disconnect', () => {
      connectionStatusListeners.forEach((cb) => cb(false));
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connect error:', err.message);
      connectionStatusListeners.forEach((cb) => cb(false));
    });

    socket.on('snapshot', (data: { buses: any[] }) => {
      if (data && data.buses) {
        applySnapshot(data.buses);
      }
    });

    socket.on('pos:delta', (delta: { rows: number[][]; t: number }) => {
      if (delta && delta.rows) {
        applyDeltaRows(delta.rows, delta.t);
      }
    });

    socket.on('eta:update', (data: { stopId: string; items: EtaItem[] }) => {
      etaListeners.forEach((cb) => cb(data));
    });

    socket.on('alert:new', (alert: AlertItem) => {
      alertListeners.forEach((cb) => cb(alert));
    });

    return socket;
  } catch (err) {
    console.warn('[Socket] Failed to initialize socket:', err);
    return null;
  }
}

export function updateSubscribedCells(cells: string[]) {
  if (socket && socket.connected) {
    socket.emit('viewport:set', { cells });
  }
}

export function subscribeToStop(stopId: string) {
  if (socket && socket.connected) {
    socket.emit('stop:sub', { stopId });
  }
}

export function unsubscribeFromStop(stopId: string) {
  if (socket && socket.connected) {
    socket.emit('stop:unsub', { stopId });
  }
}

export function subscribeToRoute(routeId: string) {
  if (socket && socket.connected) {
    socket.emit('route:sub', { routeId });
  }
}

export function unsubscribeFromRoute(routeId: string) {
  if (socket && socket.connected) {
    socket.emit('route:unsub', { routeId });
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
