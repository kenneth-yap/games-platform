import { useEffect, useRef, useReducer } from "react";
import { submitScore, listScores } from "./api/scores";

const W = 480;
const H = 400;

// Alien grid: 5 rows × 11 cols
const COLS = 11;
const ALIEN_ROWS = 5;
const ALIEN_W = 28;
const ALIEN_H = 20;
const ALIEN_GAP_X = 14;
const ALIEN_GAP_Y = 18;
const ALIEN_OFFSET_X = 30;
const ALIEN_OFFSET_Y = 48;

// Points by row (top = most valuable)
const ROW_PTS = [30, 30, 20, 20, 10];
const ROW_COLORS = ["#ff2d78", "#ff8c00", "#ffe600", "#39ff14", "#00f5ff"];

const PLAYER_W = 36;
const PLAYER_H = 14;
const PLAYER_Y = H - 32;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 7;
const ENEMY_BULLET_SPEED = 3;
const MAX_ENEMY_BULLETS = 3;

function makeAliens() {
  const grid = [];
  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid.push({ r, c, alive: true });
    }
  }
  return grid;
}

function alienPos(alien, offsetX, offsetY) {
  return {
    x: ALIEN_OFFSET_X + offsetX + alien.c * (ALIEN_W + ALIEN_GAP_X),
    y: ALIEN_OFFSET_Y + offsetY + alien.r * (ALIEN_H + ALIEN_GAP_Y),
  };
}

export default function SpaceInvaders({ loggedIn }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const keysRef = useRef({});

  // Game state in refs for the RAF loop
  const aliensRef = useRef(makeAliens());
  const alienOffsetXRef = useRef(0);
  const alienOffsetYRef = useRef(0);
  const alienDirRef = useRef(1); // 1 = right, -1 = left
  const alienSpeedRef = useRef(1.0);
  const alienTickRef = useRef(0); // frames between alien steps
  const alienFrameRef = useRef(0);
  const alienAnimRef = useRef(0); // 0 or 1 for sprite toggle

  const playerXRef = useRef(W / 2 - PLAYER_W / 2);
  const playerBulletRef = useRef(null); // {x, y}
  const enemyBulletsRef = useRef([]); // [{x, y}]
  const enemyShootTimerRef = useRef(0);

  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const aliensKilledRef = useRef(0);
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const startTimeRef = useRef(null);
  const invincibleRef = useRef(0); // frames of invincibility after hit

  const [ui, setUi] = useReducer((s, a) => ({ ...s, ...a }), {
    phase: "idle", score: 0, lives: 3, level: 1, submitMsg: null, highScores: [],
  });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Draw aliens
    const aliveAliens = aliensRef.current.filter(a => a.alive);
    aliveAliens.forEach(alien => {
      const { x, y } = alienPos(alien, alienOffsetXRef.current, alienOffsetYRef.current);
      const color = ROW_COLORS[alien.r];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;

      if (alienAnimRef.current === 0) {
        // Sprite A: classic invader shape
        ctx.fillRect(x + 6, y, 16, 4);
        ctx.fillRect(x + 2, y + 4, 24, 4);
        ctx.fillRect(x, y + 8, 8, 4);
        ctx.fillRect(x + 20, y + 8, 8, 4);
        ctx.fillRect(x + 10, y + 8, 8, 4);
        ctx.fillRect(x + 4, y + 12, 6, 4);
        ctx.fillRect(x + 18, y + 12, 6, 4);
      } else {
        // Sprite B: legs down
        ctx.fillRect(x + 6, y, 16, 4);
        ctx.fillRect(x + 2, y + 4, 24, 4);
        ctx.fillRect(x, y + 8, 8, 4);
        ctx.fillRect(x + 20, y + 8, 8, 4);
        ctx.fillRect(x + 10, y + 8, 8, 4);
        ctx.fillRect(x + 2, y + 12, 6, 4);
        ctx.fillRect(x + 20, y + 12, 6, 4);
      }
      ctx.shadowBlur = 0;
    });

    // Draw player (flashing when invincible)
    const px = playerXRef.current;
    if (invincibleRef.current === 0 || Math.floor(invincibleRef.current / 4) % 2 === 0) {
      ctx.fillStyle = "#00f5ff";
      ctx.shadowColor = "#00f5ff";
      ctx.shadowBlur = 8;
      // Cannon barrel
      ctx.fillRect(px + PLAYER_W / 2 - 3, PLAYER_Y - 8, 6, 8);
      // Body
      ctx.fillRect(px, PLAYER_Y, PLAYER_W, PLAYER_H);
      ctx.shadowBlur = 0;
    }

    // Player bullet
    if (playerBulletRef.current) {
      const { x, y } = playerBulletRef.current;
      ctx.fillStyle = "#ffe600";
      ctx.shadowColor = "#ffe600";
      ctx.shadowBlur = 6;
      ctx.fillRect(x - 2, y, 4, 10);
      ctx.shadowBlur = 0;
    }

    // Enemy bullets
    enemyBulletsRef.current.forEach(b => {
      ctx.fillStyle = "#ff2d78";
      ctx.shadowColor = "#ff2d78";
      ctx.shadowBlur = 4;
      ctx.fillRect(b.x - 2, b.y, 4, 8);
      ctx.shadowBlur = 0;
    });

    // Lives bar
    ctx.fillStyle = "#00f5ff";
    ctx.font = "8px 'Press Start 2P'";
    ctx.fillText(`LIVES: ${livesRef.current}`, 8, 16);

    // Score display
    ctx.fillStyle = "#ffe600";
    ctx.fillText(`${scoreRef.current}`, W - 80, 16);
  };

  const endGame = () => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const msg = loggedIn ? "SCORE SAVED!" : "GUEST SCORE (28 DAYS)";

    submitScore("spaceinvaders", {
      aliens_killed: aliensKilledRef.current,
      level: levelRef.current,
      duration_seconds: duration,
    })
      .then(() => {
        setUi({ phase: "over", submitMsg: msg });
        return listScores("spaceinvaders");
      })
      .then(scores => setUi({ highScores: scores.slice(0, 5) }))
      .catch(err => setUi({ phase: "over", submitMsg: err.message }));
  };

  const nextLevel = () => {
    levelRef.current += 1;
    aliensRef.current = makeAliens();
    alienOffsetXRef.current = 0;
    alienOffsetYRef.current = 0;
    alienDirRef.current = 1;
    alienSpeedRef.current = Math.min(3.5, 1.0 + (levelRef.current - 1) * 0.5);
    playerBulletRef.current = null;
    enemyBulletsRef.current = [];
    invincibleRef.current = 0;
    setUi({ level: levelRef.current });
  };

  const gameLoop = () => {
    if (!runningRef.current) return;

    // Player movement
    if (keysRef.current["ArrowLeft"] || keysRef.current["a"]) {
      playerXRef.current = Math.max(0, playerXRef.current - PLAYER_SPEED);
    }
    if (keysRef.current["ArrowRight"] || keysRef.current["d"]) {
      playerXRef.current = Math.min(W - PLAYER_W, playerXRef.current + PLAYER_SPEED);
    }

    // Player bullet movement
    if (playerBulletRef.current) {
      playerBulletRef.current.y -= BULLET_SPEED;
      if (playerBulletRef.current.y < 0) playerBulletRef.current = null;
    }

    // Enemy bullets movement
    enemyBulletsRef.current = enemyBulletsRef.current.filter(b => {
      b.y += ENEMY_BULLET_SPEED;
      return b.y < H;
    });

    // Alien stepping
    alienFrameRef.current++;
    const tickInterval = Math.max(6, Math.floor(50 / aliensRef.current.filter(a => a.alive).length + 1));
    if (alienFrameRef.current >= tickInterval) {
      alienFrameRef.current = 0;
      alienAnimRef.current = 1 - alienAnimRef.current;

      const alive = aliensRef.current.filter(a => a.alive);
      const maxC = Math.max(...alive.map(a => a.c));
      const minC = Math.min(...alive.map(a => a.c));
      const rightEdge = ALIEN_OFFSET_X + alienOffsetXRef.current + maxC * (ALIEN_W + ALIEN_GAP_X) + ALIEN_W;
      const leftEdge  = ALIEN_OFFSET_X + alienOffsetXRef.current + minC * (ALIEN_W + ALIEN_GAP_X);

      const step = alienSpeedRef.current * alienDirRef.current * 6;
      if (rightEdge + step > W - 8 && alienDirRef.current === 1) {
        alienDirRef.current = -1;
        alienOffsetYRef.current += 16;
      } else if (leftEdge + step < 8 && alienDirRef.current === -1) {
        alienDirRef.current = 1;
        alienOffsetYRef.current += 16;
      } else {
        alienOffsetXRef.current += step;
      }
    }

    // Enemy shooting
    enemyShootTimerRef.current++;
    if (enemyShootTimerRef.current > 45 && enemyBulletsRef.current.length < MAX_ENEMY_BULLETS) {
      enemyShootTimerRef.current = 0;
      const alive = aliensRef.current.filter(a => a.alive);
      if (alive.length > 0) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        const { x, y } = alienPos(shooter, alienOffsetXRef.current, alienOffsetYRef.current);
        enemyBulletsRef.current.push({ x: x + ALIEN_W / 2, y: y + ALIEN_H });
      }
    }

    // Bullet-alien collision
    if (playerBulletRef.current) {
      const b = playerBulletRef.current;
      for (const alien of aliensRef.current) {
        if (!alien.alive) continue;
        const { x, y } = alienPos(alien, alienOffsetXRef.current, alienOffsetYRef.current);
        if (b.x >= x && b.x <= x + ALIEN_W && b.y >= y && b.y <= y + ALIEN_H) {
          alien.alive = false;
          playerBulletRef.current = null;
          aliensKilledRef.current += 1;
          scoreRef.current += ROW_PTS[alien.r] * levelRef.current;
          setUi({ score: scoreRef.current });
          break;
        }
      }
    }

    // Enemy bullet hits player
    if (invincibleRef.current > 0) {
      invincibleRef.current--;
    } else {
      const px = playerXRef.current;
      for (let i = enemyBulletsRef.current.length - 1; i >= 0; i--) {
        const b = enemyBulletsRef.current[i];
        if (b.x >= px && b.x <= px + PLAYER_W && b.y >= PLAYER_Y && b.y <= PLAYER_Y + PLAYER_H) {
          enemyBulletsRef.current.splice(i, 1);
          livesRef.current -= 1;
          setUi({ lives: livesRef.current });
          if (livesRef.current <= 0) { draw(); endGame(); return; }
          invincibleRef.current = 90;
          break;
        }
      }
    }

    // Aliens reach bottom
    const maxY = Math.max(...aliensRef.current.filter(a => a.alive).map(a =>
      alienPos(a, alienOffsetXRef.current, alienOffsetYRef.current).y + ALIEN_H
    ));
    if (maxY >= PLAYER_Y) { draw(); endGame(); return; }

    // All aliens cleared
    if (!aliensRef.current.some(a => a.alive)) {
      nextLevel();
    }

    draw();
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  const startGame = () => {
    aliensRef.current = makeAliens();
    alienOffsetXRef.current = 0;
    alienOffsetYRef.current = 0;
    alienDirRef.current = 1;
    alienSpeedRef.current = 1.0;
    alienFrameRef.current = 0;
    alienAnimRef.current = 0;
    playerXRef.current = W / 2 - PLAYER_W / 2;
    playerBulletRef.current = null;
    enemyBulletsRef.current = [];
    enemyShootTimerRef.current = 0;
    livesRef.current = 3;
    levelRef.current = 1;
    aliensKilledRef.current = 0;
    scoreRef.current = 0;
    invincibleRef.current = 0;
    runningRef.current = true;
    startTimeRef.current = Date.now();
    setUi({ phase: "playing", score: 0, lives: 3, level: 1, submitMsg: null, highScores: [] });
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    draw();
    const onKeyDown = (e) => {
      keysRef.current[e.key] = true;
      if (e.key === " " && runningRef.current && !playerBulletRef.current) {
        e.preventDefault();
        const px = playerXRef.current;
        playerBulletRef.current = { x: px + PLAYER_W / 2, y: PLAYER_Y - 8 };
      }
    };
    const onKeyUp = (e) => { delete keysRef.current[e.key]; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const { phase, score, lives, level, submitMsg, highScores } = ui;

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>SPACE INVADERS</h1>
      <div style={styles.hud}>
        <span>SCORE: {score}</span>
        <span>LEVEL: {level}</span>
        <span>{"♥ ".repeat(lives)}</span>
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
          {highScores.map(s => (
            <div key={s.id} style={styles.scoreRow}>
              <span>{s.value}</span>
              <span style={styles.scoreDetail}>{s.details?.aliens_killed ?? 0} aliens</span>
            </div>
          ))}
        </div>
      )}

      <p style={styles.hint}>ARROWS / A·D to move · SPACE to fire</p>
    </div>
  );
}

const styles = {
  wrap: { textAlign: "center", color: "#00f5ff" },
  title: { fontSize: "1.4rem", color: "#ff2d78", textShadow: "0 0 8px #ff2d78, 0 0 20px #ff2d78", marginBottom: "0.8rem", letterSpacing: "0.2em" },
  hud: { display: "flex", gap: "2rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.7rem", color: "#00f5ff" },
  canvasWrap: { position: "relative", display: "inline-block" },
  canvas: { border: "2px solid rgba(255,45,120,0.4)", display: "block", background: "#060010" },
  overlay: {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", background: "rgba(6,0,16,0.85)",
  },
  gameOver: { fontSize: "1.4rem", color: "#ff2d78", textShadow: "0 0 8px #ff2d78", marginBottom: "1rem" },
  msg: { fontSize: "0.72rem", color: "#39ff14", marginBottom: "0.8rem" },
  button: {
    padding: "0.7rem 1.6rem", fontSize: "0.72rem", background: "transparent",
    color: "#ff2d78", border: "2px solid #ff2d78", cursor: "pointer",
    textShadow: "0 0 6px #ff2d78", boxShadow: "0 0 10px rgba(255,45,120,0.3)",
    letterSpacing: "0.15em",
  },
  scores: { marginTop: "1.2rem", fontSize: "0.72rem", textAlign: "left", display: "inline-block", minWidth: "200px" },
  scoresTitle: { color: "#ffe600", marginBottom: "0.4rem", letterSpacing: "0.1em" },
  scoreRow: { display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid rgba(0,245,255,0.15)" },
  scoreDetail: { color: "#8a8f99" },
  hint: { marginTop: "1rem", fontSize: "0.62rem", color: "rgba(0,245,255,0.35)", letterSpacing: "0.1em" },
};
