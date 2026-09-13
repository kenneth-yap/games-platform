// Tetris — extracted into its own self-contained component.
//
// WHERE THIS GOES: clients/tetris-client/src/Tetris.jsx
//
// All Tetris game logic, state, and UI live here. App.jsx is now a thin
// shell (auth + game selection + advice) that simply renders <Tetris />.
// This mirrors the backend's separation of concerns: each game is a
// self-contained module; the shell knows nothing game-specific.
//
// Controls: arrows move/rotate, down soft-drops, space hard-drops, C holds.

import { useState, useEffect, useCallback, useRef } from "react";
import { submitScore, listScores } from "./api/scores";

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

function shuffledBag() {
  const bag = [...SHAPE_KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

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

function Tetris({ loggedIn }) {
  const [grid, setGrid] = useState(emptyGrid);
  const [piece, setPiece] = useState(null);
  const [queue, setQueue] = useState([]);
  const [held, setHeld] = useState(null);
  const [holdUsed, setHoldUsed] = useState(false);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [highScores, setHighScores] = useState([]);
  const [submitMsg, setSubmitMsg] = useState(null);

  const startTimeRef = useRef(null);

  const pullFromQueue = useCallback((currentQueue) => {
    let q = [...currentQueue];
    while (q.length < 7) q = q.concat(shuffledBag());
    const nextKey = q.shift();
    return { nextKey, queue: q };
  }, []);

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

  useEffect(() => {
    if (!running) return;
    const speed = Math.max(100, 800 - (level - 1) * 70);
    const id = setInterval(() => move(1, 0), speed);
    return () => clearInterval(id);
  }, [running, level, move]);

  useEffect(() => {
    function onKey(e) {
      if (!running || !piece) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowLeft") move(0, -1);
      else if (e.key === "ArrowRight") move(0, 1);
      else if (e.key === "ArrowDown") move(1, 0);
      else if (e.key === "ArrowUp") {
        const r = rotate(piece);
        if (!collides(r, grid)) setPiece(r);
      } else if (e.key === " ") {
        let p = piece;
        while (!collides({ ...p, row: p.row + 1 }, grid)) p = { ...p, row: p.row + 1 };
        lockPiece(p, grid);
      } else if (e.key === "Shift") {
        hold();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [piece, grid, running, move, lockPiece, hold]);

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
        setSubmitMsg(loggedIn ? "SCORE SAVED!" : "GUEST SCORE (28 DAYS)");
        return listScores("tetris");
      })
      .then((scores) => setHighScores(scores.slice(0, 5)))
      .catch((err) => setSubmitMsg(err.message));
  }, [gameOver, lines, level, loggedIn]);

  function startGame() {
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

  const display = grid.map((row) => [...row]);
  if ((running || gameOver) && piece) {
    pieceCells(piece).forEach(([r, c]) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) display[r][c] = piece.color;
    });
  }

  return (
    <>
      <h1 style={styles.title}>TETRIS</h1>

      <div style={styles.stats}>
        <span>Score: {score}</span>
        <span>Lines: {lines}</span>
        <span>Level: {level}</span>
      </div>

      <div style={styles.playArea}>
        <div style={styles.sidebar}>
          <h4 style={styles.sideLabel}>Hold</h4>
          <div style={styles.miniBox}>
            <MiniPiece shapeKey={held} />
          </div>
        </div>

        <div style={styles.board}>
          {display.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                style={{ ...styles.cell, background: cell === EMPTY ? "#060010" : cell }}
              />
            ))
          )}
        </div>

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
        Arrows move/rotate · Down soft-drop · Space hard-drop · Shift hold
      </p>
    </>
  );
}

const styles = {
  title: { letterSpacing: "0.4em", fontSize: "1.8rem", marginBottom: "0.8rem", color: "#00f5ff", textShadow: "0 0 8px #00f5ff, 0 0 20px #00f5ff" },
  stats: { display: "flex", gap: "1.5rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.72rem", color: "#00f5ff" },
  playArea: { display: "flex", gap: "1rem", justifyContent: "center", alignItems: "flex-start" },
  sidebar: { display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" },
  sideLabel: { fontSize: "0.6rem", color: "rgba(0,245,255,0.4)", margin: "0 0 0.25rem 0", letterSpacing: "0.1em" },
  miniBox: {
    width: 56, height: 56, display: "flex", alignItems: "center",
    justifyContent: "center", background: "#060010",
    border: "1px solid rgba(0,245,255,0.15)",
  },
  miniEmpty: { width: 12, height: 12 },
  board: {
    display: "grid", gridTemplateColumns: `repeat(${COLS}, 24px)`,
    gridTemplateRows: `repeat(${ROWS}, 24px)`, gap: "1px",
    background: "rgba(0,245,255,0.1)", padding: "4px",
    border: "2px solid rgba(0,245,255,0.3)",
  },
  cell: { width: 24, height: 24 },
  button: {
    marginTop: "1rem", padding: "0.6rem 1.6rem", fontSize: "0.72rem",
    background: "transparent", color: "#00f5ff", border: "2px solid #00f5ff",
    cursor: "pointer", letterSpacing: "0.15em",
    textShadow: "0 0 6px #00f5ff", boxShadow: "0 0 10px rgba(0,245,255,0.3)",
  },
  overlay: { marginTop: "1rem" },
  gameOver: { fontSize: "1.4rem", color: "#ff2d78", textShadow: "0 0 8px #ff2d78" },
  msg: { fontSize: "0.75rem", color: "#39ff14", marginTop: "0.5rem" },
  scores: { marginTop: "1.5rem", fontSize: "0.72rem", textAlign: "left", width: "260px", marginLeft: "auto", marginRight: "auto" },
  scoreRow: { display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid rgba(0,245,255,0.1)" },
  scoreDetail: { color: "rgba(0,245,255,0.4)" },
  hint: { marginTop: "1.5rem", fontSize: "0.6rem", color: "rgba(0,245,255,0.25)", letterSpacing: "0.1em" },
};

export default Tetris;
