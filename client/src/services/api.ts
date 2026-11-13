import type { Stop, Route, Bus, EtaItem } from '../types/transit';

const API_BASE = '/api';

let cachedToken: string | null = null;

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (!cachedToken) {
    cachedToken = localStorage.getItem('bus_token');
  }
  return cachedToken;
}

export function setStoredToken(token: string) {
  cachedToken = token;
  localStorage.setItem('bus_token', token);
}

// Automatically ensure an active session (register anonymous viewer if none)
export async function ensureAuthToken(): Promise<string> {
  const existing = getStoredToken();
  if (existing) return existing;

  try {
    const anonymousEmail = `viewer_${Math.random().toString(36).substring(2, 9)}@bustwin.in`;
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: anonymousEmail, password: 'guest_secure_pass_123' }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        setStoredToken(data.token);
        return data.token;
      }
    }
  } catch (err) {
    console.warn('[API] Auth register fallback to local token:', err);
  }

  // Fallback dev token string if offline/static
  const fallbackToken = 'dev_viewer_token';
  setStoredToken(fallbackToken);
  return fallbackToken;
}

async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await ensureAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

export async function fetchRoutes(): Promise<Route[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/routes`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[API] Failed to fetch routes from server, falling back to static /data/routes.json');
  }

  // Fallback to static public data
  const fallbackRes = await fetch('/data/routes.json');
  if (fallbackRes.ok) {
    return await fallbackRes.json();
  }
  return [];
}

export async function fetchStops(): Promise<Stop[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/stops`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[API] Failed to fetch stops from server, falling back to static /data/stops.json');
  }

  // Fallback to static public data
  const fallbackRes = await fetch('/data/stops.json');
  if (fallbackRes.ok) {
    return await fallbackRes.json();
  }
  return [];
}

export async function fetchBuses(): Promise<Bus[]> {
  try {
    const fallbackRes = await fetch('/data/buses.json');
    if (fallbackRes.ok) {
      return await fallbackRes.json();
    }
  } catch (err) {
    console.warn('[API] Failed to load buses:', err);
  }
  return [];
}

export async function fetchBusDetails(busId: string): Promise<{ registration: Bus; state: any } | null> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/buses/${busId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[API] Failed to fetch bus ${busId}:`, err);
  }
  return null;
}

export async function fetchStopEtas(stopId: string): Promise<EtaItem[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/stops/${stopId}/eta`);
    if (res.ok) {
      const data = await res.json();
      return data.items || [];
    }
  } catch (err) {
    console.warn(`[API] Failed to fetch ETAs for stop ${stopId}:`, err);
  }
  return [];
}
