// Centralised API communication layer.
// All talking-to-the-backend happens here, including auth: storing the
// token and attaching it to every request.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// --- Token storage ---------------------------------------------------------
// The JWT lives in localStorage. Tradeoff (accepted for this learning
// project): simple, but readable by JS so vulnerable to XSS. A hardened
// app would weigh an httpOnly cookie instead.
const TOKEN_KEY = "auth_token";

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

// Build headers, adding the Authorization token when we have one.
function authHeaders() {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// --- Auth calls ------------------------------------------------------------
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
  setToken(data.access_token);   // store the token on success
  return data;
}

// --- Score calls (now token-aware) -----------------------------------------
export async function submitScore(gameName, rawData) {
  const response = await fetch(`${API_BASE}/scores/${gameName}`, {
    method: "POST",
    headers: authHeaders(),         // ← now carries the token
    body: JSON.stringify(rawData),
  });
  if (response.status === 401) {
    logout();                       // token expired/invalid → log out
    throw new Error("Please sign in to save your score.");
  }
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

/**
 * Request an AI recommendation for the logged-in user.
 * Returns { advice, used_today, daily_limit }.
 * Throws with a clear message on the daily-limit (429) case.
 */
export async function getRecommendation() {
  const response = await fetch(`${API_BASE}/recommendations`, {
    method: "POST",
    headers: authHeaders(),        // carries the auth token
  });

  if (response.status === 429) {
    // Daily cap reached — surface the backend's friendly message.
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Daily recommendation limit reached.");
  }
  if (response.status === 401) {
    logout();
    throw new Error("Please sign in to get advice.");
  }
  if (!response.ok) {
    throw new Error(`Couldn't get advice (${response.status}).`);
  }

  return response.json();   // { advice, used_today, daily_limit }
}