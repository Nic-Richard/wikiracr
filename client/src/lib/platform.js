import { Capacitor, registerPlugin } from '@capacitor/core';

export const NATIVE_APP = Capacitor.isNativePlatform();
export const API_ORIGIN = NATIVE_APP ? 'https://wikiracr.com' : '';
export const NativeAuth = registerPlugin('WikiRacrAuth');
export const NativeApp = registerPlugin('App');
export const NativeBrowser = registerPlugin('Browser');

export function apiUrl(value) {
  return NATIVE_APP && typeof value === 'string' && value.startsWith('/api/') ? API_ORIGIN + value : value;
}

export function appFetch(value, options) {
  const url = apiUrl(value);
  if (NATIVE_APP && typeof url === 'string' && url.startsWith(`${API_ORIGIN}/api/stripe/`)) {
    return Promise.reject(new Error('Manage your subscription on the WikiRacr website.'));
  }
  return fetch(url, options);
}
