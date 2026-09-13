import { useEffect, useRef, useReducer } from "react";
import { submitScore, listScores } from "./api/scores";

const COLS = 20;
const ROWS = 20;
const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;
const TICK_MS = 140;

function randomFood(snake) {
  const occupied = new Set(snake.map(([r, c]) => `${r},${c}`));
  let r, c;
  do {
    r = Math.floor(Math.random() * ROWS);
    c = Math.floor(Math.random() * COLS);
  } while (occupied.has(`${r},${c}`));
  return [r, c];
}

function initialSnake() {
  return [[10, 10], [10, 9], [10, 8]];
}

export default function Snake({ loggedIn }) {
  const canvasRef = useRef(null);
  const snakeRef = useRef(initialSnake());
  const dirRef = useRef({ dr: 0, dc: 1 });
  const pendingRef = useRef(null);
  const foodRef = useRef(randomFood(snakeRef.current));
  const runningRef = useRef(false);
  const startTimeRef = useRef(null);
  const intervalRef = useRef(null);
  const [, forceUpdate] = useReducer(n => n + 1, 0);

  const [gameState, setGameState] = useReducer(
    (state, action) => ({ ...state, ...action }),
    { phase: "idle", score: 0, submitMsg: null, highScores: [] }
  );

  const drawBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Faint grid
    ctx.strokeStyle = "rgba(57,255,20,0.08)";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
    }

    // Snake
    const snake = snakeRef.current;
    snake.forEach(([r, c], i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? "#39ff14" : "rgba(57,255,20,0.65)";
      if (isHead) ctx.shadowColor = "#39ff14";
      if (isHead) ctx.shadowBlur = 8;
      ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      ctx.shadowBlur = 0;
    });

    // Food
    const [fr, fc] = foodRef.current;
    ctx.fillStyle = "#ff2d78";
    ctx.shadowColor = "#ff2d78";
    ctx.shadowBlur = 10;
    ctx.fillRect(fc * CELL + 2, fr * CELL + 2, CELL - 4, CELL - 4);
    ctx.shadowBlur = 0;
  };

  const endGame = (snake) => {
    clearInterval(intervalRef.current);
    runningRef.current = false;
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const snake_length = snake.length;
    const msg = loggedIn ? "SCORE SAVED!" : "GUEST SCORE (28 DAYS)";

    submitScore("snake", { snake_length, duration_seconds: duration })
      .then(() => {
        setGameState({ phase: "over", submitMsg: msg });
        return listScores("snake");
      })
      .then(scores => setGameState({ highScores: scores.slice(0, 5) }))
      .catch(err => setGameState({ phase: "over", submitMsg: err.message }));
  };

  const tick = () => {
    if (pendingRef.current) {
      const { dr, dc } = pendingRef.current;
      const cur = dirRef.current;
      if (!(dr === -cur.dr && dc === -cur.dc)) {
        dirRef.current = { dr, dc };
      }
      pendingRef.current = null;
    }

    const snake = snakeRef.current;
    const { dr, dc } = dirRef.current;
    const [hr, hc] = snake[0];
    const nr = hr + dr;
    const nc = hc + dc;

    // Wall collision
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
      endGame(snake); return;
    }
    // Self collision
    if (snake.some(([r, c]) => r === nr && c === nc)) {
      endGame(snake); return;
    }

    const newSnake = [[nr, nc], ...snake];
    const [fr, fc] = foodRef.current;
    const ate = nr === fr && nc === fc;
    if (!ate) newSnake.pop();
    else foodRef.current = randomFood(newSnake);

    snakeRef.current = newSnake;
    setGameState({ score: Math.max(0, newSnake.length - 3) * 100 });
    drawBoard();
  };

  const startGame = () => {
    const snake = initialSnake();
    snakeRef.current = snake;
    dirRef.current = { dr: 0, dc: 1 };
    pendingRef.current = null;
    foodRef.current = randomFood(snake);
    runningRef.current = true;
    startTimeRef.current = Date.now();
    setGameState({ phase: "playing", score: 0, submitMsg: null, highScores: [] });
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, TICK_MS);
    drawBoard();
  };

  useEffect(() => {
    drawBoard();
    const onKey = (e) => {
      if (!runningRef.current) return;
      const map = {
        ArrowUp:    { dr: -1, dc:  0 },
        ArrowDown:  { dr:  1, dc:  0 },
        ArrowLeft:  { dr:  0, dc: -1 },
        ArrowRight: { dr:  0, dc:  1 },
        w: { dr: -1, dc:  0 },
        s: { dr:  1, dc:  0 },
        a: { dr:  0, dc: -1 },
        d: { dr:  0, dc:  1 },
      };
      const next = map[e.key];
      if (next) { e.preventDefault(); pendingRef.current = next; }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearInterval(intervalRef.current);
    };
  }, []);

  // Redraw when loggedIn changes (not during game, just keeps ref current)
  useEffect(() => { drawBoard(); }, [gameState.score]);

  const { phase, score, submitMsg, highScores } = gameState;

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>SNAKE</h1>
      <div style={styles.stats}>
        <span style={styles.stat}>SCORE: {score}</span>
        <span style={styles.stat}>LENGTH: {snakeRef.current.length}</span>
      </div>

      <div style={styles.canvasWrap}>
        <canvas ref={canvasRef} width={W} height={H} style={styles.canvas} />
        {phase !== "playing" && (
          <div style={styles.overlay}>
            {phase === "over" && <p style={styles.gameOver}>GAME OVER</p>}
            {submitMsg && <p style={styles.msg}>{submitMsg}</p>}
            <button style={styles.button} onClick={startGame}>
              {phase === "idle" ? "START" : "PLAY AGAIN"}
            </button>
          </div>
        )}
      </div>

      {highScores.length > 0 && (
        <div style={styles.scores}>
          <p style={styles.scoresTitle}>RECENT</p>
          {highScores.map((s) => (
            <div key={s.id} style={styles.scoreRow}>
              <span>{s.value}</span>
              <span style={styles.scoreDetail}>{s.details?.foods_eaten ?? 0} food</span>
            </div>
          ))}
        </div>
      )}

      <p style={styles.hint}>ARROWS / WASD to move</p>
    </div>
  );
}

const styles = {
  wrap: { textAlign: "center", color: "#00f5ff" },
  title: { fontSize: "1.8rem", color: "#39ff14", textShadow: "0 0 8px #39ff14, 0 0 20px #39ff14", marginBottom: "0.8rem", letterSpacing: "0.3em" },
  stats: { display: "flex", gap: "2rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.8rem" },
  stat: { color: "#00f5ff" },
  canvasWrap: { position: "relative", display: "inline-block" },
  canvas: { border: "2px solid rgba(57,255,20,0.5)", display: "block", background: "#060010" },
  overlay: {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", background: "rgba(6,0,16,0.82)",
  },
  gameOver: { fontSize: "1.4rem", color: "#ff2d78", textShadow: "0 0 8px #ff2d78", marginBottom: "1rem" },
  msg: { fontSize: "0.75rem", color: "#39ff14", marginBottom: "0.8rem" },
  button: {
    padding: "0.7rem 1.6rem", fontSize: "0.75rem", background: "transparent",
    color: "#39ff14", border: "2px solid #39ff14", cursor: "pointer",
    textShadow: "0 0 6px #39ff14", boxShadow: "0 0 10px rgba(57,255,20,0.3)",
    letterSpacing: "0.15em",
  },
  scores: { marginTop: "1.2rem", fontSize: "0.72rem", textAlign: "left", display: "inline-block", minWidth: "200px" },
  scoresTitle: { color: "#ffe600", marginBottom: "0.4rem", letterSpacing: "0.1em" },
  scoreRow: { display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid rgba(0,245,255,0.15)" },
  scoreDetail: { color: "#8a8f99" },
  hint: { marginTop: "1rem", fontSize: "0.65rem", color: "rgba(0,245,255,0.4)", letterSpacing: "0.1em" },
};
