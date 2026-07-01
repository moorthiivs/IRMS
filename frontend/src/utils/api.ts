export interface OfflineInspection {
  id: string;
  payload: any;
  timestamp: string;
  inspectorName: string;
  partNumber: string;
  operationNumber: string;
  lotNumber: string;
}

const API_BASE = '/api';

export const getAuthToken = () => localStorage.getItem('irms_token');
export const setAuthToken = (token: string) => localStorage.setItem('irms_token', token);
export const removeAuthToken = () => localStorage.removeItem('irms_token');

export const getAuthUser = () => {
  const user = localStorage.getItem('irms_user');
  return user ? JSON.parse(user) : null;
};
export const setAuthUser = (user: any) => localStorage.setItem('irms_user', JSON.stringify(user));
export const removeAuthUser = () => localStorage.removeItem('irms_user');

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeAuthToken();
    removeAuthUser();
    // Redirect if in browser environment and not on login page
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
};

// Queue inspection to localStorage during offline events
export const queueOfflineInspection = (payload: any, partNo: string, opNo: string, lotNo: string) => {
  const queue: OfflineInspection[] = JSON.parse(localStorage.getItem('irms_offline_queue') || '[]');
  const inspector = getAuthUser();

  const newItem: OfflineInspection = {
    id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    payload,
    timestamp: new Date().toISOString(),
    inspectorName: inspector ? inspector.name : 'Unknown',
    partNumber: partNo,
    operationNumber: opNo,
    lotNumber: lotNo,
  };

  queue.push(newItem);
  localStorage.setItem('irms_offline_queue', JSON.stringify(queue));
  return newItem;
};

// Retrieve offline queued inspections
export const getOfflineQueue = (): OfflineInspection[] => {
  return JSON.parse(localStorage.getItem('irms_offline_queue') || '[]');
};

// Clear items from offline queue
export const removeOfflineInspection = (id: string) => {
  const queue: OfflineInspection[] = getOfflineQueue();
  const filtered = queue.filter(item => item.id !== id);
  localStorage.setItem('irms_offline_queue', JSON.stringify(filtered));
};

// Attempt to sync offline queue to server
export const syncOfflineQueue = async (onItemSynced?: (item: OfflineInspection, success: boolean, message: string) => void) => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      await apiFetch('/inspections', {
        method: 'POST',
        body: JSON.stringify(item.payload),
      });
      removeOfflineInspection(item.id);
      if (onItemSynced) {
        onItemSynced(item, true, 'Synced successfully');
      }
    } catch (error: any) {
      console.error('Failed to sync offline item:', item.id, error);
      if (onItemSynced) {
        onItemSynced(item, false, error.message || 'Sync failed');
      }
      break; // Stop syncing remaining if server is unreachable
    }
  }
};
