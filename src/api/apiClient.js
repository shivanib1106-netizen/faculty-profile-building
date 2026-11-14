/**
 * Centralised HTTP client for the Faculty Profile Builder.
 * All backend communication goes through this module.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 30000;

const TOKEN_KEY = 'fps_auth_token';
const USER_KEY = 'fps_auth_user';

export const API_BASE_URL = BASE_URL;

/**
 * Demo mode is an explicit opt-in build flag. The mock adapter is loaded
 * lazily so its demo dataset is never part of the normal request path.
 */
export const isDemoMode = () => import.meta.env.VITE_USE_MOCK === 'true';
export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/* ------------------------------------------------------------------ Token */

const storageFor = (remember) => (remember ? window.localStorage : window.sessionStorage);

export const getToken = () =>
  window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY);

export const isRememberedSession = () => Boolean(window.localStorage.getItem(TOKEN_KEY));

export const setToken = (token, remember = false) => {
  const target = storageFor(remember);
  const other = storageFor(!remember);
  target.setItem(TOKEN_KEY, token);
  other.removeItem(TOKEN_KEY);
};

export const removeToken = () => {
  window.localStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.sessionStorage.removeItem(USER_KEY);
};

export const getStoredUser = () => {
  const raw = window.localStorage.getItem(USER_KEY) || window.sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setStoredUser = (user, remember = false) => {
  const target = storageFor(remember);
  const other = storageFor(!remember);
  target.setItem(USER_KEY, JSON.stringify(user));
  other.removeItem(USER_KEY);
};

/* ----------------------------------------------------------- Unauthorised */

const UNAUTHORIZED_EVENT = 'fps:unauthorized';

export const notifyUnauthorized = () => {
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
};

export const onUnauthorized = (handler) => {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
};

/* -------------------------------------------------------------- Requests */

const buildHeaders = (body, token) => {
  const headers = { Accept: 'application/json' };
  if (!(body instanceof FormData) && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const friendlyMessage = (status, payload) => {
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (status === 400) return 'The submitted information is invalid. Please review the form.';
  if (status === 403) return 'You are not authorized to perform this action.';
  if (status === 404) return 'The requested record could not be found.';
  if (status === 409) return 'This action conflicts with the current state of the record.';
  if (status === 422) return 'Please correct the highlighted fields and try again.';
  if (status >= 500) return 'The server could not process the request. Please try again later.';
  return 'The request could not be completed. Please try again.';
};

async function parsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  const text = await response.text().catch(() => '');
  return text ? { message: text } : null;
}

export async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', body, responseType, signal, headers: extraHeaders = {} } = options;
  const token = getToken();

  if (isDemoMode()) {
    const { mockRequest } = await import('./mock/mockAdapter');
    return mockRequest({ method, endpoint, body, token, responseType });
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      body: body instanceof FormData || body === undefined ? body : JSON.stringify(body),
      headers: { ...buildHeaders(body, token), ...extraHeaders },
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('The request timed out. Please check your connection and try again.');
    }
    throw new ApiError(
      `Unable to reach the server at ${BASE_URL}. Please confirm the Flask backend is running.`,
      0
    );
  } finally {
    window.clearTimeout(timeout);
  }

  if (response.status === 401) {
    removeToken();
    notifyUnauthorized();
    const payload = await parsePayload(response);
    throw new ApiError(friendlyMessage(401, payload) || 'Your session has expired. Please sign in again.', 401, payload);
  }

  if (responseType === 'blob') {
    if (!response.ok) {
      const payload = await parsePayload(response);
      throw new ApiError(friendlyMessage(response.status, payload), response.status, payload);
    }
    return response.blob();
  }

  if (response.status === 204) return null;

  const payload = await parsePayload(response);

  if (!response.ok) {
    throw new ApiError(friendlyMessage(response.status, payload), response.status, payload);
  }

  return payload;
}

const apiClient = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
  download: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET', responseType: 'blob' }),
};

export const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default apiClient;
