import { useState, useEffect } from "react";
import { isLoggedIn, logout, ensureGuestId } from "./api/scores";
import RetroBackground from "./RetroBackground";
import AuthForm from "./AuthForm";
import Tetris from "./Tetris";
import TicTacToe from "./TicTacToe";
import Snake from "./Snake";
import Breakout from "./Breakout";
import SpaceInvaders from "./SpaceInvaders";
import Asteroids from "./Asteroids";

const GAMES = [
  { id: "tetris",        label: "TETRIS",         Component: Tetris },
  { id: "tictactoe",     label: "TIC·TAC·TOE",    Component: TicTacToe },
  { id: "snake",         label: "SNAKE",          Component: Snake },
  { id: "breakout",      label: "BREAKOUT",       Component: Breakout },
  { id: "spaceinvaders", label: "SPACE INVADERS", Component: SpaceInvaders },
  { id: "asteroids",     label: "ASTEROIDS",      Component: Asteroids },
];

function App() {
  const [game, setGame] = useState("tetris");
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    ensureGuestId();
  }, []);

  function handleLogout() {
    logout();
    setLoggedIn(false);
  }

  function handleAuthChange() {
    setLoggedIn(true);
    setShowAuth(false);
  }

  const { Component: GameComponent } = GAMES.find(g => g.id === game);

  return (
    <>
      <RetroBackground />

      <div style={styles.page}>
        {/* Header */}
        <header style={styles.header}>
          <h1 style={styles.logo}>RETRO ARCADE</h1>
          <div style={styles.authBar}>
            {loggedIn ? (
              <>
                <span style={styles.authLabel}>SIGNED IN</span>
                <button style={styles.authBtn} onClick={handleLogout}>SIGN OUT</button>
              </>
            ) : (
              <>
                <span style={styles.authLabel}>GUEST MODE</span>
                <button style={{ ...styles.authBtn, ...styles.authBtnAccent }} onClick={() => setShowAuth(true)}>
                  SIGN IN
                </button>
              </>
            )}
          </div>
        </header>

        {/* Game nav */}
        <nav style={styles.nav}>
          {GAMES.map(g => (
            <button
              key={g.id}
              style={{ ...styles.navBtn, ...(game === g.id ? styles.navBtnActive : {}) }}
              onClick={() => setGame(g.id)}
            >
              {g.label}
            </button>
          ))}
        </nav>

        {/* Game area */}
        <main style={styles.main}>
          <GameComponent loggedIn={loggedIn} />
        </main>

        {/* Guest notice */}
        {!loggedIn && (
          <p style={styles.guestNotice}>
            PLAYING AS GUEST — SCORES SAVED FOR 28 DAYS
          </p>
        )}
      </div>

      {/* Auth modal */}
      {showAuth && (
        <div style={styles.modalBackdrop} onClick={() => setShowAuth(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <button style={styles.closeBtn} onClick={() => setShowAuth(false)}>✕</button>
            <p style={styles.modalTitle}>SIGN IN</p>
            <AuthForm onAuthChange={handleAuthChange} />
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  page: {
    position: "relative",
    zIndex: 1,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingBottom: "3rem",
  },
  header: {
    width: "100%",
    maxWidth: 640,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.5rem 1rem 1rem",
    flexWrap: "wrap",
    gap: "0.8rem",
  },
  logo: {
    fontSize: "1.1rem",
    color: "#ffe600",
    textShadow: "0 0 8px #ffe600, 0 0 22px #ffe600",
    letterSpacing: "0.25em",
    lineHeight: 1.3,
  },
  authBar: { display: "flex", alignItems: "center", gap: "0.8rem" },
  authLabel: { fontSize: "0.65rem", color: "rgba(0,245,255,0.5)", letterSpacing: "0.1em" },
  authBtn: {
    fontSize: "0.65rem",
    padding: "0.4rem 0.9rem",
    background: "transparent",
    color: "rgba(0,245,255,0.7)",
    border: "1px solid rgba(0,245,255,0.35)",
    letterSpacing: "0.1em",
  },
  authBtnAccent: {
    color: "#ff2d78",
    border: "1px solid #ff2d78",
    textShadow: "0 0 6px #ff2d78",
    boxShadow: "0 0 8px rgba(255,45,120,0.25)",
  },
  nav: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: "2rem",
    padding: "0 1rem",
  },
  navBtn: {
    fontSize: "0.65rem",
    padding: "0.5rem 1rem",
    background: "transparent",
    color: "rgba(0,245,255,0.5)",
    border: "1px solid rgba(0,245,255,0.2)",
    letterSpacing: "0.15em",
  },
  navBtnActive: {
    color: "#00f5ff",
    border: "1px solid #00f5ff",
    textShadow: "0 0 6px #00f5ff",
    boxShadow: "0 0 12px rgba(0,245,255,0.25)",
  },
  main: { width: "100%", display: "flex", justifyContent: "center", padding: "0 1rem" },
  guestNotice: {
    marginTop: "2rem",
    fontSize: "0.6rem",
    color: "rgba(0,245,255,0.25)",
    letterSpacing: "0.12em",
    textAlign: "center",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.88)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    position: "relative",
    background: "#0a0014",
    border: "2px solid rgba(0,245,255,0.4)",
    padding: "2rem",
    minWidth: 280,
    boxShadow: "0 0 30px rgba(0,245,255,0.15)",
  },
  closeBtn: {
    position: "absolute",
    top: "0.8rem",
    right: "0.8rem",
    background: "transparent",
    border: "none",
    color: "rgba(0,245,255,0.5)",
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  modalTitle: {
    fontSize: "0.9rem",
    color: "#00f5ff",
    textShadow: "0 0 6px #00f5ff",
    marginBottom: "1.2rem",
    letterSpacing: "0.2em",
    textAlign: "center",
  },
};

export default App;
