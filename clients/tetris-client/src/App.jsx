// Playable Tetris — a single-file starting point.
//
// WHERE THIS GOES: clients/tetris-client/src/App.jsx  (replaces the test harness)
//
// It plays a real game and, on game over, submits the score through your
// EXISTING API layer (src/api/scores.js -> submitScore). The game engine and
// the API call are kept separate: gameplay produces a result, then ONE call
// hands it to the backend. That seam is why the engine could be swapped or
// refined without touching anything backend-side.
//
// This is intentionally MINIMAL but complete and playable. Refine it in
// Claude Code (rotation feel, colours, levels, hold/next-piece, mobile
// controls) where the run-see-adjust loop is pleasant.
//
// Controls: arrow keys to move/rotate, down to soft-drop, space to hard-drop.

import { useState, useEffect, useCallback, useRef } from "react";
import { submitScore, listScores } from "./api/scores";

// --- Game constants --------------------------------------------------------
const COLS = 10;
const ROWS = 20;
const EMPTY = 0;

// The seven tetrominoes, each as a list of [row, col] cell offsets, plus a
// colour. Kept simple: rotation is computed mathematically below.
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

// Make an empty grid (ROWS x COLS of zeros).
function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

// Pick a random new piece, spawned near the top-centre.
function randomPiece() {
  const key = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
  return {
    key,
    color: SHAPES[key].color,
    cells: SHAPES[key].cells.map(([r, c]) => [r, c]),
    row: 0,
    col: 3,
  };
}

// Absolute board coordinates of a piece's four cells.
function pieceCells(piece) {
  return piece.cells.map(([r, c]) => [piece.row + r, piece.col + c]);
}

// Rotate a piece 90 degrees clockwise around its local origin.
function rotate(piece) {
  // Standard rotation: (r, c) -> (c, -r), then normalise to non-negative.
  const rotated = piece.cells.map(([r, c]) => [c, -r]);
  const minR = Math.min(...rotated.map(([r]) => r));
  const minC = Math.min(...rotated.map(([, c]) => c));
  return {
    ...piece,
    cells: rotated.map(([r, c]) => [r - minR, c - minC]),
  };
}

// Does this piece collide with walls, floor, or settled blocks?
function collides(piece, grid) {
  return pieceCells(piece).some(([r, c]) => {
    if (c < 0 || c >= COLS || r >= ROWS) return true; // walls / floor
    if (r >= 0 && grid[r][c] !== EMPTY) return true;   // settled blocks
    return false;
  });
}

function App() {
  const [grid, setGrid] = useState(emptyGrid);
  const [piece, setPiece] = useState(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [highScores, setHighScores] = useState([]);
  const [submitMsg, setSubmitMsg] = useState(null);

  // Track elapsed time so we can report duration to the backend.
  const startTimeRef = useRef(null);

  // Lock the current piece into the grid, clear full rows, score, respawn.
  const lockPiece = useCallback((currentPiece, currentGrid) => {
    const newGrid = currentGrid.map((row) => [...row]);
    pieceCells(currentPiece).forEach(([r, c]) => {
      if (r >= 0) newGrid[r][c] = currentPiece.color;
    });

    // Clear any full rows.
    const remaining = newGrid.filter((row) => row.some((cell) => cell === EMPTY));
    const cleared = ROWS - remaining.length;
    while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(EMPTY));

    if (cleared > 0) {
      // Classic-style scoring: more points for more simultaneous lines.
      const points = [0, 100, 300, 500, 800][cleared] * level;
      setScore((s) => s + points);
      setLines((l) => {
        const total = l + cleared;
        setLevel(Math.floor(total / 10) + 1); // level up every 10 lines
        return total;
      });
    }

    const next = randomPiece();
    if (collides(next, remaining)) {
      // New piece can't spawn -> game over.
      setGrid(remaining);
      setGameOver(true);
      setRunning(false);
      return;
    }
    setGrid(remaining);
    setPiece(next);
  }, [level]);

  // Try to move the active piece by (dr, dc). Returns whether it moved.
  const move = useCallback((dr, dc) => {
    if (!running) return false;
    const candidate = { ...piece, row: piece.row + dr, col: piece.col + dc };
    if (!collides(candidate, grid)) {
      setPiece(candidate);
      return true;
    }
    // Downward move that failed = piece has landed.
    if (dr === 1) lockPiece(piece, grid);
    return false;
  }, [piece, grid, running, lockPiece]);

  // Gravity: step the piece down on a timer that speeds up with level.
  useEffect(() => {
    if (!running) return;
    const speed = Math.max(100, 800 - (level - 1) * 70);
    const id = setInterval(() => move(1, 0), speed);
    return () => clearInterval(id);
  }, [running, level, move]);

  // Keyboard controls.
  useEffect(() => {
    function onKey(e) {
      if (!running) return;
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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [piece, grid, running, move, lockPiece]);

  // On game over, submit the score through the existing API layer.
  useEffect(() => {
    if (!gameOver) return;
    const duration = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;
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
      .catch((err) => setSubmitMsg(`Could not submit: ${err.message}`));
  }, [gameOver, lines, level]);

  function startGame() {
    setGrid(emptyGrid());
    setPiece(randomPiece());
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
  if (running || gameOver) {
    pieceCells(piece).forEach(([r, c]) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) display[r][c] = piece.color;
    });
  }

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <h1 style={styles.title}>TETRIS</h1>
        <div style={styles.stats}>
          <span>Score: {score}</span>
          <span>Lines: {lines}</span>
          <span>Level: {level}</span>
        </div>

        <div style={styles.board}>
          {display.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                style={{
                  ...styles.cell,
                  background: cell === EMPTY ? "#10131a" : cell,
                }}
              />
            ))
          )}
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
                <span style={styles.scoreDetail}>
                  {s.details?.lines_cleared ?? 0} lines
                </span>
              </div>
            ))}
          </div>
        )}

        <p style={styles.hint}>
          Arrows to move/rotate · Down to drop · Space to hard-drop
        </p>
      </div>
    </div>
  );
}

// Inline styles kept here for a single-file drop-in. Move to App.css when
// refining in Claude Code.
const styles = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#0a0c10", color: "#e6e8ec",
    fontFamily: "'Courier New', monospace",
  },
  panel: { textAlign: "center" },
  title: { letterSpacing: "0.4em", fontWeight: 700, fontSize: "2rem", marginBottom: "0.5rem" },
  stats: { display: "flex", gap: "1.5rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.9rem" },
  board: {
    display: "grid", gridTemplateColumns: `repeat(${COLS}, 24px)`,
    gridTemplateRows: `repeat(${ROWS}, 24px)`, gap: "1px",
    background: "#1c2029", padding: "4px", borderRadius: "4px", margin: "0 auto",
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