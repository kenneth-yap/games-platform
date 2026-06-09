// App — the shell.
//
// WHERE THIS GOES: clients/tetris-client/src/App.jsx
//
// This is now a THIN shell. It owns the app-wide concerns — authentication,
// game selection, and the AI advisor — and renders whichever game is chosen.
// It knows nothing game-specific; each game is a self-contained component
// (Tetris.jsx, TicTacToe.jsx). This mirrors the backend's separation of
// concerns on the frontend.

import { useState } from "react";
import { isLoggedIn, logout, getRecommendation } from "./api/scores";
import AuthForm from "./AuthForm";
import Tetris from "./Tetris";
import TicTacToe from "./TicTacToe";

function App() {
  const [game, setGame] = useState("tetris");
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

  // AI advice state (shell-level: the advisor is cross-game).
  const [advice, setAdvice] = useState(null);
  const [adviceQuota, setAdviceQuota] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  async function handleGetAdvice() {
    setAdviceLoading(true);
    setAdvice(null);
    try {
      const result = await getRecommendation();
      setAdvice(result.advice);
      setAdviceQuota({ used: result.used_today, limit: result.daily_limit });
    } catch (err) {
      setAdvice(err.message);
    } finally {
      setAdviceLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.panel}>

        {/* Game selector */}
        <div style={styles.selector}>
          <button style={styles.smallButton} onClick={() => setGame("tetris")}>
            Tetris
          </button>
          <button style={styles.smallButton} onClick={() => setGame("tictactoe")}>
            Tic-Tac-Toe
          </button>
        </div>

        {/* Auth bar — shell concern, shown for both games */}
        {loggedIn ? (
          <div style={styles.authBar}>
            <span>Logged in</span>{" "}
            <button style={styles.smallButton} onClick={() => { logout(); setLoggedIn(false); }}>
              Log out
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: "1rem" }}>
            <AuthForm onAuthChange={() => setLoggedIn(true)} />
          </div>
        )}

        {/* AI advice — shell concern, cross-game, on request only */}
        {loggedIn && (
          <div style={styles.adviceSection}>
            <button style={styles.smallButton} onClick={handleGetAdvice} disabled={adviceLoading}>
              {adviceLoading ? "Thinking..." : "Get advice"}
            </button>
            {adviceQuota && (
              <p style={styles.quota}>{adviceQuota.used} of {adviceQuota.limit} used today</p>
            )}
            {advice && <p style={styles.advice}>{advice}</p>}
          </div>
        )}

        {/* The chosen game */}
        {game === "tetris" ? <Tetris /> : <TicTacToe />}

      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#0a0c10", color: "#e6e8ec",
    fontFamily: "'Courier New', monospace",
  },
  panel: { textAlign: "center" },
  selector: { display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "1rem" },
  authBar: { fontSize: "0.8rem", marginBottom: "1rem" },
  smallButton: {
    padding: "0.2rem 0.6rem", fontSize: "0.75rem", background: "#2a2f3a",
    color: "#e6e8ec", border: "1px solid #3a3f4a", borderRadius: "3px",
    cursor: "pointer", fontFamily: "inherit",
  },
  adviceSection: { marginBottom: "1rem", maxWidth: "320px", marginLeft: "auto", marginRight: "auto" },
  quota: { fontSize: "0.72rem", color: "#8a8f99", marginTop: "0.4rem" },
  advice: {
    fontSize: "0.82rem", color: "#bfe6c0", marginTop: "0.6rem",
    lineHeight: 1.5, textAlign: "left", whiteSpace: "pre-wrap",
    wordBreak: "break-word", overflowWrap: "break-word",
    background: "#10131a", padding: "0.6rem 0.8rem", borderRadius: "4px",
  },
};

export default App;
