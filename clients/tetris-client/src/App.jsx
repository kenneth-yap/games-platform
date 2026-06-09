// Playable Tetris — complete, with authentication, next-piece preview, and hold.
//
// WHERE THIS GOES: clients/tetris-client/src/App.jsx
//
// Auth: a guest can play freely; saving a score requires login. The login/
// register form shows when logged out; on game-over, logged-in users submit
// their score, guests get a "sign in to save" nudge.
//
// Game features: a 7-bag randomiser feeds a NEXT-piece queue (preview of the
// upcoming 3), and a HOLD slot lets you stash one piece (once per drop).
//
// Controls: arrows move/rotate, down soft-drops, space hard-drops, C holds.

import { useState, useEffect, useCallback, useRef } from "react";
import { isLoggedIn, logout, submitScore, listScores } from "./api/scores";
import AuthForm from "./AuthForm";
import TicTacToe from './TicTacToe';

// --- Game constants --------------------------------------------------------
const COLS = 10;
const ROWS = 20;
const EMPTY = 0;

const SHAPES = {
  I: { cells: [[0, 0], [0, 1], [0, 2], [0, 3]], color: "#5ad1c8" },
  O: { cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: "#e8c547" },
  T: { cells: [[0, 0], [0, 1], [0, 2], [1, 1]], color: "#b86fc9" },
  S: { cells: [[0, 1], [0, 2], [1, 0], [1, 1]], color: "#7bc96f" },
  Z: { cells: [[0, 0], [0, 1], [1, 1], [1, 2]], color: "#e06c6c" },
  J: { cells: [[0, 0], [1, 0], [1, 1], [1, 2]], color: "#6c8ee0" },
  L: { cells: [[0, 2], [1, 0], [1, 1], [1, 2]], color: "#e0a96c" },
};
const SHAPE_KEYS = Object.keys(SHAPES);

function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

// --- The 7-bag randomiser --------------------------------------------------
// Standard Tetris doesn't pick purely at random — it shuffles all 7 pieces
// into a "bag" and deals them out, so you never get long droughts or floods
// of one piece. We refill the bag whenever it runs low. This also gives us a
// reliable QUEUE of upcoming pieces to preview.
function shuffledBag() {
  const bag = [...SHAPE_KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// Make a piece object from a shape key, spawned near the top-centre.
function makePiece(key) {
  return {
    key,
    color: SHAPES[key].color,
    cells: SHAPES[key].cells.map(([r, c]) => [r, c]),
    row: 0,
    col: 3,
  };
}

function pieceCells(piece) {
  return piece.cells.map(([r, c]) => [piece.row + r, piece.col + c]);
}

function rotate(piece) {
  const rotated = piece.cells.map(([r, c]) => [c, -r]);
  const minR = Math.min(...rotated.map(([r]) => r));
  const minC = Math.min(...rotated.map(([, c]) => c));
  return { ...piece, cells: rotated.map(([r, c]) => [r - minR, c - minC]) };
}

function collides(piece, grid) {
  return pieceCells(piece).some(([r, c]) => {
    if (c < 0 || c >= COLS || r >= ROWS) return true;
    if (r >= 0 && grid[r][c] !== EMPTY) return true;
    return false;
  });
}

// Draw a small preview of a shape (for the next-queue and hold box).
function MiniPiece({ shapeKey }) {
  if (!shapeKey) return <div style={styles.miniEmpty} />;
  const { cells, color } = SHAPES[shapeKey];
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const g = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(false));
  cells.forEach(([r, c]) => (g[r][c] = true));
  return (
    <div style={{ display: "inline-block" }}>
      {g.map((row, r) => (
        <div key={r} style={{ display: "flex" }}>
          {row.map((filled, c) => (
            <div
              key={c}
              style={{
                width: 12, height: 12, margin: 0.5, borderRadius: 1,
                background: filled ? color : "transparent",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function App() {

  // Create a button for two games 
  const [game, setGame] = useState("tetris");



  const [grid, setGrid] = useState(emptyGrid);
  const [piece, setPiece] = useState(null);
  // The bag of upcoming piece keys. We keep enough to preview 3 ahead.
  const [queue, setQueue] = useState([]);
  // The held piece key (null if none), and whether hold was used this drop.
  const [held, setHeld] = useState(null);
  const [holdUsed, setHoldUsed] = useState(false);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [highScores, setHighScores] = useState([]);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

  const startTimeRef = useRef(null);

  // Pull the next piece key from the queue, refilling the bag as needed so
  // there are always at least a few upcoming pieces to preview.
  const pullFromQueue = useCallback((currentQueue) => {
    let q = [...currentQueue];
    while (q.length < 7) q = q.concat(shuffledBag());
    const nextKey = q.shift();
    return { nextKey, queue: q };
  }, []);

  // Lock the current piece into the grid, clear full rows, score, spawn next.
  const lockPiece = useCallback((currentPiece, currentGrid) => {
    const newGrid = currentGrid.map((row) => [...row]);
    pieceCells(currentPiece).forEach(([r, c]) => {
      if (r >= 0) newGrid[r][c] = currentPiece.color;
    });

    const remaining = newGrid.filter((row) => row.some((cell) => cell === EMPTY));
    const cleared = ROWS - remaining.length;
    while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(EMPTY));

    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      setScore((s) => s + points);
      setLines((l) => {
        const total = l + cleared;
        setLevel(Math.floor(total / 10) + 1);
        return total;
      });
    }

    // Spawn the next piece from the queue. Hold becomes available again.
    const { nextKey, queue: newQueue } = pullFromQueue(queue);
    const next = makePiece(nextKey);
    setQueue(newQueue);
    setHoldUsed(false);

    if (collides(next, remaining)) {
      setGrid(remaining);
      setGameOver(true);
      setRunning(false);
      return;
    }
    setGrid(remaining);
    setPiece(next);
  }, [level, queue, pullFromQueue]);

  const move = useCallback((dr, dc) => {
    if (!running || !piece) return false;
    const candidate = { ...piece, row: piece.row + dr, col: piece.col + dc };
    if (!collides(candidate, grid)) {
      setPiece(candidate);
      return true;
    }
    if (dr === 1) lockPiece(piece, grid);
    return false;
  }, [piece, grid, running, lockPiece]);

  // HOLD: stash the current piece. If the slot is empty, take the next from
  // the queue; otherwise swap. Allowed only once per drop (holdUsed guard)
  // to prevent infinite stalling.
  const hold = useCallback(() => {
    if (!running || !piece || holdUsed) return;
    if (held === null) {
      const { nextKey, queue: newQueue } = pullFromQueue(queue);
      setHeld(piece.key);
      setQueue(newQueue);
      setPiece(makePiece(nextKey));
    } else {
      const swapKey = held;
      setHeld(piece.key);
      setPiece(makePiece(swapKey));
    }
    setHoldUsed(true);
  }, [running, piece, held, holdUsed, queue, pullFromQueue]);

  // Gravity timer, speeds up with level.
  useEffect(() => {
    if (!running) return;
    const speed = Math.max(100, 800 - (level - 1) * 70);
    const id = setInterval(() => move(1, 0), speed);
    return () => clearInterval(id);
  }, [running, level, move]);

  // Keyboard controls.
  useEffect(() => {
    function onKey(e) {
      if (!running || !piece) return;
      if (e.key === "ArrowLeft") move(0, -1);
      else if (e.key === "ArrowRight") move(0, 1);
      else if (e.key === "ArrowDown") move(1, 0);
      else if (e.key === "ArrowUp") {
        const r = rotate(piece);
        if (!collides(r, grid)) setPiece(r);
      } else if (e.key === " ") {
        e.preventDefault();
        let p = piece;
        while (!collides({ ...p, row: p.row + 1 }, grid)) p = { ...p, row: p.row + 1 };
        lockPiece(p, grid);
      } else if (e.key === "c" || e.key === "C") {
        hold();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [piece, grid, running, move, lockPiece, hold]);

  // On game over: logged-in users submit; guests get nudged.
  useEffect(() => {
    if (!gameOver) return;
    const duration = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;

    if (!loggedIn) {
      setSubmitMsg("Sign in to save your score!");
      return;
    }

    submitScore("tetris", {
      lines_cleared: lines,
      level: level,
      duration_seconds: duration,
    })
      .then(() => {
        setSubmitMsg("Score submitted!");
        return listScores("tetris");
      })
      .then((scores) => setHighScores(scores.slice(0, 5)))
      .catch((err) => setSubmitMsg(err.message));
  }, [gameOver, lines, level, loggedIn]);

  function startGame() {
    // Fresh bag, deal the first piece, reset everything.
    const { nextKey, queue: newQueue } = pullFromQueue([]);
    setGrid(emptyGrid());
    setQueue(newQueue);
    setPiece(makePiece(nextKey));
    setHeld(null);
    setHoldUsed(false);
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setSubmitMsg(null);
    startTimeRef.current = Date.now();
    setRunning(true);
  }

  // Build the display grid (settled blocks + active piece overlaid).
  const display = grid.map((row) => [...row]);
  if ((running || gameOver) && piece) {
    pieceCells(piece).forEach(([r, c]) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) display[r][c] = piece.color;
    });
  }

  return (
    <div style={styles.page}>
      <div style={styles.panel}>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "1rem" }}>
          <button
            style={styles.smallButton}
            onClick={() => setGame("tetris")}
          >
            Tetris
          </button>
          <button
            style={styles.smallButton}
            onClick={() => setGame("tictactoe")}
          >
            Tic-Tac-Toe
          </button>
        </div>

                {/* Auth bar */}
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
        
        {game === "tetris" ? (
          <>
        <h1 style={styles.title}>TETRIS</h1>


        <div style={styles.stats}>
          <span>Score: {score}</span>
          <span>Lines: {lines}</span>
          <span>Level: {level}</span>
        </div>

        {/* Main play area: hold | board | next-queue */}
        <div style={styles.playArea}>
          {/* HOLD box */}
          <div style={styles.sidebar}>
            <h4 style={styles.sideLabel}>Hold</h4>
            <div style={styles.miniBox}>
              <MiniPiece shapeKey={held} />
            </div>
          </div>

          {/* The board */}
          <div style={styles.board}>
            {display.map((row, r) =>
              row.map((cell, c) => (
                <div
                  key={`${r}-${c}`}
                  style={{ ...styles.cell, background: cell === EMPTY ? "#10131a" : cell }}
                />
              ))
            )}
          </div>

          {/* NEXT queue: preview the upcoming 3 */}
          <div style={styles.sidebar}>
            <h4 style={styles.sideLabel}>Next</h4>
            {queue.slice(0, 3).map((key, i) => (
              <div key={i} style={styles.miniBox}>
                <MiniPiece shapeKey={key} />
              </div>
            ))}
          </div>
        </div>

        {!running && !gameOver && (
          <button style={styles.button} onClick={startGame}>Start</button>
        )}
        {gameOver && (
          <div style={styles.overlay}>
            <p style={styles.gameOver}>Game Over</p>
            {submitMsg && <p style={styles.msg}>{submitMsg}</p>}
            <button style={styles.button} onClick={startGame}>Play again</button>
          </div>
        )}

        {highScores.length > 0 && (
          <div style={styles.scores}>
            <h3>Recent scores</h3>
            {highScores.map((s) => (
              <div key={s.id} style={styles.scoreRow}>
                <span>{s.value}</span>
                <span style={styles.scoreDetail}>{s.details?.lines_cleared ?? 0} lines</span>
              </div>
            ))}
          </div>
        )}

        <p style={styles.hint}>
          Arrows move/rotate · Down soft-drop · Space hard-drop · C hold
        </p>
                  </>
          ) : (
            <TicTacToe />
          )} 

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
  title: { letterSpacing: "0.4em", fontWeight: 700, fontSize: "2rem", marginBottom: "0.5rem" },
  authBar: { fontSize: "0.8rem", marginBottom: "1rem" },
  smallButton: {
    padding: "0.2rem 0.6rem", fontSize: "0.75rem", background: "#2a2f3a",
    color: "#e6e8ec", border: "1px solid #3a3f4a", borderRadius: "3px",
    cursor: "pointer", fontFamily: "inherit",
  },
  stats: { display: "flex", gap: "1.5rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.9rem" },
  playArea: { display: "flex", gap: "1rem", justifyContent: "center", alignItems: "flex-start" },
  sidebar: { display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" },
  sideLabel: { fontSize: "0.75rem", color: "#8a8f99", margin: "0 0 0.25rem 0", letterSpacing: "0.1em" },
  miniBox: {
    width: 56, height: 56, display: "flex", alignItems: "center",
    justifyContent: "center", background: "#10131a", borderRadius: "4px",
  },
  miniEmpty: { width: 12, height: 12 },
  board: {
    display: "grid", gridTemplateColumns: `repeat(${COLS}, 24px)`,
    gridTemplateRows: `repeat(${ROWS}, 24px)`, gap: "1px",
    background: "#1c2029", padding: "4px", borderRadius: "4px",
  },
  cell: { width: 24, height: 24, borderRadius: "2px" },
  button: {
    marginTop: "1rem", padding: "0.6rem 1.6rem", fontSize: "1rem",
    background: "#5ad1c8", color: "#0a0c10", border: "none",
    borderRadius: "4px", cursor: "pointer", fontWeight: 700,
    fontFamily: "inherit", letterSpacing: "0.1em",
  },
  overlay: { marginTop: "1rem" },
  gameOver: { fontSize: "1.4rem", color: "#e06c6c", fontWeight: 700 },
  msg: { fontSize: "0.85rem", color: "#7bc96f" },
  scores: { marginTop: "1.5rem", fontSize: "0.85rem", textAlign: "left", width: "260px", marginLeft: "auto", marginRight: "auto" },
  scoreRow: { display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid #1c2029" },
  scoreDetail: { color: "#8a8f99" },
  hint: { marginTop: "1.5rem", fontSize: "0.75rem", color: "#5a5f6a" },
};

export default App;