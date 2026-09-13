// Centralised API communication layer.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// --- Token storage -----------------------------------------------------------
const TOKEN_KEY = "auth_token";
const GUEST_ID_KEY = "guest_id";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return getToken() !== null;
}

export function getGuestId() {
  return localStorage.getItem(GUEST_ID_KEY);
}

export function ensureGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

// Build headers: Bearer token for authenticated users, X-Guest-ID for guests.
function authHeaders() {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["X-Guest-ID"] = ensureGuestId();
  }
  return headers;
}

// --- Auth calls --------------------------------------------------------------
export async function register(username, password) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Register failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Login failed (${response.status}): ${detail}`);
  }
  const data = await response.json();
  setToken(data.access_token);
  return data;
}

// --- Score calls -------------------------------------------------------------
export async function submitScore(gameName, rawData) {
  const response = await fetch(`${API_BASE}/scores/${gameName}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(rawData),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Submit failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function listScores(gameName) {
  const response = await fetch(`${API_BASE}/scores/${gameName}`);
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  return response.json();
}
