import { useEffect, useRef, useReducer } from "react";
import { submitScore, listScores } from "./api/scores";

const W = 480;
const H = 360;
const PADDLE_W = 80;
const PADDLE_H = 10;
const PADDLE_Y = H - 28;
const BALL_R = 7;
const BRICK_COLS = 8;
const BRICK_ROWS = 5;
const BRICK_W = 52;
const BRICK_H = 18;
const BRICK_GAP_X = 4;
const BRICK_GAP_Y = 5;
const BRICK_OFFSET_X = 20;
const BRICK_OFFSET_Y = 30;
const ROW_COLORS = ["#ff2d78", "#ff8c00", "#ffe600", "#39ff14", "#00f5ff"];
const BASE_SPEED = 3.5;

function makeBricks() {
  return Array.from({ length: BRICK_ROWS }, (_, r) =>
    Array.from({ length: BRICK_COLS }, (_, c) => ({ alive: true, r, c }))
  );
}

function brickRect(brick) {
  return {
    x: BRICK_OFFSET_X + brick.c * (BRICK_W + BRICK_GAP_X),
    y: BRICK_OFFSET_Y + brick.r * (BRICK_H + BRICK_GAP_Y),
    w: BRICK_W,
    h: BRICK_H,
  };
}

export default function Breakout({ loggedIn }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const paddleXRef = useRef(W / 2 - PADDLE_W / 2);
  const ballRef = useRef({ x: W / 2, y: H / 2, vx: BASE_SPEED * 0.7, vy: -BASE_SPEED });
  const bricksRef = useRef(makeBricks());
  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const bricksClearedRef = useRef(0);
  const runningRef = useRef(false);
  const startTimeRef = useRef(null);
  const keysRef = useRef({});

  const [gameState, setGameState] = useReducer(
    (s, a) => ({ ...s, ...a }),
    { phase: "idle", score: 0, lives: 3, level: 1, submitMsg: null, highScores: [] }
  );

  const countAlive = () => bricksRef.current.flat().filter(b => b.alive).length;

  const resetBall = (speedMultiplier) => {
    const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
    const speed = BASE_SPEED + (levelRef.current - 1) * 0.8 * speedMultiplier;
    ballRef.current = {
      x: W / 2,
      y: PADDLE_Y - BALL_R - 2,
      vx: speed * Math.sin(angle),
      vy: -speed * Math.cos(angle),
    };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Bricks
    bricksRef.current.flat().forEach(brick => {
      if (!brick.alive) return;
      const { x, y, w, h } = brickRect(brick);
      const color = ROW_COLORS[brick.r];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0;
      // Highlight line
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x, y, w, 2);
    });

    // Paddle
    const px = paddleXRef.current;
    ctx.fillStyle = "#00f5ff";
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 10;
    ctx.fillRect(px, PADDLE_Y, PADDLE_W, PADDLE_H);
    ctx.shadowBlur = 0;

    // Ball
    const { x, y } = ballRef.current;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe600";
    ctx.shadowColor = "#ffe600";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  const endGame = () => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const msg = loggedIn ? "SCORE SAVED!" : "GUEST SCORE (28 DAYS)";

    submitScore("breakout", {
      bricks_cleared: bricksClearedRef.current,
      level: levelRef.current,
      duration_seconds: duration,
    })
      .then(() => {
        setGameState({ phase: "over", submitMsg: msg });
        return listScores("breakout");
      })
      .then(scores => setGameState({ highScores: scores.slice(0, 5) }))
      .catch(err => setGameState({ phase: "over", submitMsg: err.message }));
  };

  const gameLoop = () => {
    if (!runningRef.current) return;

    // Keyboard paddle movement
    const speed = 5;
    if (keysRef.current["ArrowLeft"] || keysRef.current["a"]) {
      paddleXRef.current = Math.max(0, paddleXRef.current - speed);
    }
    if (keysRef.current["ArrowRight"] || keysRef.current["d"]) {
      paddleXRef.current = Math.min(W - PADDLE_W, paddleXRef.current + speed);
    }

    const ball = ballRef.current;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall collisions
    if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
    if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

    // Ball below screen
    if (ball.y > H + BALL_R) {
      livesRef.current -= 1;
      if (livesRef.current <= 0) {
        draw();
        endGame();
        return;
      }
      setGameState({ lives: livesRef.current });
      resetBall(1);
      rafRef.current = requestAnimationFrame(gameLoop);
      draw();
      return;
    }

    // Paddle collision
    const px = paddleXRef.current;
    if (
      ball.y + BALL_R >= PADDLE_Y &&
      ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
      ball.x >= px &&
      ball.x <= px + PADDLE_W &&
      ball.vy > 0
    ) {
      const hitPos = (ball.x - (px + PADDLE_W / 2)) / (PADDLE_W / 2); // -1 to 1
      const angle = hitPos * 60 * (Math.PI / 180);
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = speed * Math.sin(angle);
      ball.vy = -Math.abs(speed * Math.cos(angle));
    }

    // Brick collisions
    let cleared = false;
    for (const brick of bricksRef.current.flat()) {
      if (!brick.alive) continue;
      const { x, y, w, h } = brickRect(brick);
      const overlapX = ball.x >= x - BALL_R && ball.x <= x + w + BALL_R;
      const overlapY = ball.y >= y - BALL_R && ball.y <= y + h + BALL_R;
      if (!overlapX || !overlapY) continue;

      const fromLeft   = Math.abs(ball.x - (x + w));
      const fromRight  = Math.abs(ball.x - x);
      const fromTop    = Math.abs(ball.y - (y + h));
      const fromBottom = Math.abs(ball.y - y);
      const minDist = Math.min(fromLeft, fromRight, fromTop, fromBottom);

      brick.alive = false;
      bricksClearedRef.current += 1;
      cleared = true;

      if (minDist === fromTop || minDist === fromBottom) ball.vy = -ball.vy;
      else ball.vx = -ball.vx;

      break;
    }

    if (cleared) {
      const score = bricksClearedRef.current * 10 * levelRef.current;
      setGameState({ score });

      if (countAlive() === 0) {
        levelRef.current += 1;
        bricksRef.current = makeBricks();
        setGameState({ level: levelRef.current });
        resetBall(1);
      }
    }

    draw();
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  const startGame = () => {
    bricksRef.current = makeBricks();
    paddleXRef.current = W / 2 - PADDLE_W / 2;
    livesRef.current = 3;
    levelRef.current = 1;
    bricksClearedRef.current = 0;
    runningRef.current = true;
    startTimeRef.current = Date.now();
    resetBall(1);
    setGameState({ phase: "playing", score: 0, lives: 3, level: 1, submitMsg: null, highScores: [] });
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    draw();

    const onMouseMove = (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      paddleXRef.current = Math.max(0, Math.min(W - PADDLE_W, relX - PADDLE_W / 2));
    };
    const onKeyDown = (e) => { keysRef.current[e.key] = true; };
    const onKeyUp = (e) => { delete keysRef.current[e.key]; };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const { phase, score, lives, level, submitMsg, highScores } = gameState;

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>BREAKOUT</h1>
      <div style={styles.hud}>
        <span style={styles.hudItem}>SCORE: {score}</span>
        <span style={styles.hudItem}>LEVEL: {level}</span>
        <span style={styles.hudItem}>
          LIVES: {Array.from({ length: lives }, (_, i) => "♥ ").join("")}
        </span>
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
              <span style={styles.scoreDetail}>lvl {s.details?.level ?? 1}</span>
            </div>
          ))}
        </div>
      )}

      <p style={styles.hint}>MOUSE or ARROW KEYS to move paddle</p>
    </div>
  );
}

const styles = {
  wrap: { textAlign: "center", color: "#00f5ff" },
  title: { fontSize: "1.8rem", color: "#ffe600", textShadow: "0 0 8px #ffe600, 0 0 20px #ffe600", marginBottom: "0.8rem", letterSpacing: "0.3em" },
  hud: { display: "flex", gap: "2rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.72rem" },
  hudItem: { color: "#00f5ff" },
  canvasWrap: { position: "relative", display: "inline-block" },
  canvas: { border: "2px solid rgba(0,245,255,0.4)", display: "block", background: "#060010" },
  overlay: {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", background: "rgba(6,0,16,0.82)",
  },
  gameOver: { fontSize: "1.4rem", color: "#ff2d78", textShadow: "0 0 8px #ff2d78", marginBottom: "1rem" },
  msg: { fontSize: "0.75rem", color: "#39ff14", marginBottom: "0.8rem" },
  button: {
    padding: "0.7rem 1.6rem", fontSize: "0.75rem", background: "transparent",
    color: "#ffe600", border: "2px solid #ffe600", cursor: "pointer",
    textShadow: "0 0 6px #ffe600", boxShadow: "0 0 10px rgba(255,230,0,0.3)",
    letterSpacing: "0.15em",
  },
  scores: { marginTop: "1.2rem", fontSize: "0.72rem", textAlign: "left", display: "inline-block", minWidth: "200px" },
  scoresTitle: { color: "#ffe600", marginBottom: "0.4rem", letterSpacing: "0.1em" },
  scoreRow: { display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid rgba(0,245,255,0.15)" },
  scoreDetail: { color: "#8a8f99" },
  hint: { marginTop: "1rem", fontSize: "0.65rem", color: "rgba(0,245,255,0.4)", letterSpacing: "0.1em" },
};
