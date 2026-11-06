// API client for ShipGuard backend

const TOKEN_KEY = "shipguard_auth_token";
const USER_KEY = "shipguard_auth_user";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const u = localStorage.getItem(USER_KEY);
  try {
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export function storeAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  if (res.status === 401 && !endpoint.includes("/api/auth/login") && !endpoint.includes("/api/auth/signup") && !endpoint.includes("/api/auth/reset-password")) {
    clearAuth();
    window.dispatchEvent(new CustomEvent("shipguard:unauthorized"));
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = { error: { code: "PARSING_ERROR", message: "Failed to parse server response" } };
  }

  if (!res.ok) {
    const errorObj = data.error || {
      code: `HTTP_${res.status}`,
      message: data.detail || res.statusText || "Request failed"
    };
    const error = new Error(errorObj.message || "An unexpected error occurred");
    error.code = errorObj.code;
    error.field = errorObj.field;
    error.status = res.status;
    throw error;
  }

  return data;
}

// Auth
export const authApi = {
  login: (email, password) => apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }),
  signup: (userData) => apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(userData)
  }),
  resetPassword: (email, password) => apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }),
  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
  getMe: () => apiFetch("/api/auth/me")
};

// Couriers
export const couriersApi = {
  list: () => apiFetch("/api/couriers"),
  update: (id, name) => apiFetch(`/api/couriers/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name })
  })
};

// Settings
export const settingsApi = {
  get: () => apiFetch("/api/settings"),
  update: (settings) => apiFetch("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ settings })
  })
};

// Quote
export const quoteApi = {
  getQuote: (params) => apiFetch("/api/quote", {
    method: "POST",
    body: JSON.stringify(params)
  })
};

// Shipments
export const shipmentsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    const qs = query.toString();
    return apiFetch(`/api/shipments${qs ? `?${qs}` : ""}`);
  },
  get: (id) => apiFetch(`/api/shipments/${id}`),
  create: (data) => apiFetch("/api/shipments", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  recordPickup: (id, data) => apiFetch(`/api/shipments/${id}/pickup`, {
    method: "POST",
    body: JSON.stringify(data)
  }),
  supersedePickup: (id, data) => apiFetch(`/api/shipments/${id}/pickup/supersede`, {
    method: "POST",
    body: JSON.stringify(data)
  }),
  recordScan: (id, data) => apiFetch(`/api/shipments/${id}/scan`, {
    method: "POST",
    body: JSON.stringify(data)
  }),
  getTimeline: (id) => apiFetch(`/api/shipments/${id}/timeline`)
};

// Claims
export const claimsApi = {
  list: (status) => apiFetch(`/api/claims${status ? `?status=${status}` : ""}`),
  get: (id) => apiFetch(`/api/claims/${id}`),
  create: (data) => apiFetch("/api/claims", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  decide: (id, decisionData) => apiFetch(`/api/claims/${id}/decision`, {
    method: "POST",
    body: JSON.stringify(decisionData)
  })
};

// Alerts & Scorecard
export const opsApi = {
  getAlerts: () => apiFetch("/api/alerts"),
  triggerScanCheck: () => apiFetch("/api/alerts/run-check", { method: "POST" }),
  getScorecard: (range = "all") => apiFetch(`/api/scorecard?range=${range}`),
  getAuditLogs: (limit = 50) => apiFetch(`/api/audit?limit=${limit}`)
};

// Uploads
export const uploadApi = {
  uploadPhoto: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch("/api/uploads", {
      method: "POST",
      body: formData
    });
  }
};

