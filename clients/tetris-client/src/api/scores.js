// Centralised API communication layer.
// All talking-to-the-backend happens here; components import these
// functions and never call fetch() directly.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/**
 * Submit a raw game score. The backend's contract validates it.
 */
export async function submitScore(gameName, rawData) {
  const response = await fetch(`${API_BASE}/scores/${gameName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rawData),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Submit failed (${response.status}): ${detail}`);
  }
  return response.json();
}

/**
 * Fetch the list of scores for a game, newest first.
 */
export async function listScores(gameName) {
  const response = await fetch(`${API_BASE}/scores/${gameName}`);
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  return response.json();
}