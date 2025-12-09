// Application constants
// Will be expanded in future phases

export const APP_NAME = 'Ibimina Staff Admin';
export const APP_VERSION = '0.1.0';

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  MANAGER: 'manager',
} as const;

export const PLATFORMS = {
  WEB: 'web',
  MOBILE: 'mobile',
  DESKTOP: 'desktop',
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  OFFLINE_DATA: 'offline_data',
  LAST_SYNC: 'last_sync',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
  },
  STAFF: {
    LIST: '/staff',
    CREATE: '/staff',
    UPDATE: '/staff/:id',
    DELETE: '/staff/:id',
  },
  SACCOS: {
    LIST: '/saccos',
    CREATE: '/saccos',
    UPDATE: '/saccos/:id',
    DELETE: '/saccos/:id',
  },
} as const;
