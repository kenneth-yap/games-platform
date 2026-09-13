import { useEffect, useRef, useReducer } from "react";
import { submitScore, listScores } from "./api/scores";

const W = 500;
const H = 500;
const SHIP_SIZE = 14;
const TURN_SPEED = 0.065; // radians per frame
const THRUST = 0.18;
const FRICTION = 0.985;
const BULLET_SPEED = 7;
const MAX_BULLETS = 5;
const BULLET_TTL = 70; // frames
const INVINCIBLE_FRAMES = 150;

// Asteroid sizes: radius and point value
const SIZES = [
  { r: 42, pts: 20, label: "large" },
  { r: 22, pts: 50, label: "medium" },
  { r: 11, pts: 100, label: "small" },
];

function wrap(v, max) {
  if (v < 0) return v + max;
  if (v > max) return v - max;
  return v;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomEdgePos() {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: Math.random() * W, y: 0 };
  if (edge === 1) return { x: W, y: Math.random() * H };
  if (edge === 2) return { x: Math.random() * W, y: H };
  return { x: 0, y: Math.random() * H };
}

function makeAsteroid(sizeIdx, x, y, speed) {
  const angle = Math.random() * Math.PI * 2;
  const s = speed ?? (0.8 + Math.random() * 0.8);
  return {
    x: x ?? randomEdgePos().x,
    y: y ?? randomEdgePos().y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    sizeIdx,
    r: SIZES[sizeIdx].r,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.03,
    // Pre-generate vertices for consistent polygon shape
    verts: Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      const jitter = 0.7 + Math.random() * 0.6;
      return { cos: Math.cos(a) * jitter, sin: Math.sin(a) * jitter };
    }),
  };
}

function spawnAsteroids(count, level) {
  const speed = 0.8 + (level - 1) * 0.2;
  return Array.from({ length: count }, () => makeAsteroid(0, null, null, speed + Math.random() * 0.5));
}

export default function Asteroids({ loggedIn }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const keysRef = useRef({});

  const shipRef = useRef({ x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 });
  const bulletsRef = useRef([]);
  const asteroidsRef = useRef([]);
  const particlesRef = useRef([]);

  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const asteroidsDestroyedRef = useRef(0);
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const startTimeRef = useRef(null);
  const invincibleRef = useRef(0);
  const shootCooldownRef = useRef(0);

  const [ui, setUi] = useReducer((s, a) => ({ ...s, ...a }), {
    phase: "idle", score: 0, lives: 3, level: 1, submitMsg: null, highScores: [],
  });

  const spawnParticles = (x, y, color, count = 8) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color,
      });
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Asteroids
    asteroidsRef.current.forEach(ast => {
      const color = ["#ff8c00", "#ffe600", "#39ff14"][ast.sizeIdx] ?? "#ff8c00";
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ast.verts.forEach((v, i) => {
        const vx = ast.x + v.cos * ast.r * Math.cos(ast.rot) - v.sin * ast.r * Math.sin(ast.rot);
        const vy = ast.y + v.cos * ast.r * Math.sin(ast.rot) + v.sin * ast.r * Math.cos(ast.rot);
        i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Ship (flash when invincible)
    const ship = shipRef.current;
    if (invincibleRef.current === 0 || Math.floor(invincibleRef.current / 5) % 2 === 0) {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      ctx.strokeStyle = "#00f5ff";
      ctx.shadowColor = "#00f5ff";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(SHIP_SIZE, 0);
      ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
      ctx.lineTo(-SHIP_SIZE * 0.4, 0);
      ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
      ctx.closePath();
      ctx.stroke();
      // Thruster flame
      if (keysRef.current["ArrowUp"] || keysRef.current["w"]) {
        ctx.strokeStyle = "#ff8c00";
        ctx.shadowColor = "#ff8c00";
        ctx.beginPath();
        ctx.moveTo(-SHIP_SIZE * 0.4, -SHIP_SIZE * 0.3);
        ctx.lineTo(-SHIP_SIZE * 0.9 - Math.random() * 6, 0);
        ctx.lineTo(-SHIP_SIZE * 0.4, SHIP_SIZE * 0.3);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Bullets
    bulletsRef.current.forEach(b => {
      ctx.fillStyle = "#ffe600";
      ctx.shadowColor = "#ffe600";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = "#00f5ff";
    ctx.font = "8px 'Press Start 2P'";
    ctx.fillText(`LIVES: ${livesRef.current}`, 8, 18);
    ctx.fillStyle = "#ffe600";
    ctx.fillText(`${scoreRef.current}`, W - 80, 18);
  };

  const endGame = () => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const msg = loggedIn ? "SCORE SAVED!" : "GUEST SCORE (28 DAYS)";

    submitScore("asteroids", {
      asteroids_destroyed: asteroidsDestroyedRef.current,
      level: levelRef.current,
      duration_seconds: duration,
    })
      .then(() => {
        setUi({ phase: "over", submitMsg: msg });
        return listScores("asteroids");
      })
      .then(scores => setUi({ highScores: scores.slice(0, 5) }))
      .catch(err => setUi({ phase: "over", submitMsg: err.message }));
  };

  const respawn = () => {
    shipRef.current = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
    invincibleRef.current = INVINCIBLE_FRAMES;
    bulletsRef.current = [];
  };

  const gameLoop = () => {
    if (!runningRef.current) return;

    const ship = shipRef.current;

    // Rotation
    if (keysRef.current["ArrowLeft"] || keysRef.current["a"]) ship.angle -= TURN_SPEED;
    if (keysRef.current["ArrowRight"] || keysRef.current["d"]) ship.angle += TURN_SPEED;

    // Thrust
    if (keysRef.current["ArrowUp"] || keysRef.current["w"]) {
      ship.vx += Math.cos(ship.angle) * THRUST;
      ship.vy += Math.sin(ship.angle) * THRUST;
    }

    // Friction + cap speed
    ship.vx *= FRICTION;
    ship.vy *= FRICTION;
    const spd = Math.hypot(ship.vx, ship.vy);
    if (spd > 8) { ship.vx *= 8 / spd; ship.vy *= 8 / spd; }

    // Move ship (toroidal)
    ship.x = wrap(ship.x + ship.vx, W);
    ship.y = wrap(ship.y + ship.vy, H);

    // Shoot
    if (shootCooldownRef.current > 0) shootCooldownRef.current--;
    if ((keysRef.current[" "] || keysRef.current["Space"]) &&
        shootCooldownRef.current === 0 &&
        bulletsRef.current.length < MAX_BULLETS) {
      bulletsRef.current.push({
        x: ship.x + Math.cos(ship.angle) * SHIP_SIZE,
        y: ship.y + Math.sin(ship.angle) * SHIP_SIZE,
        vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx,
        vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy,
        ttl: BULLET_TTL,
      });
      shootCooldownRef.current = 12;
    }

    // Move bullets
    bulletsRef.current = bulletsRef.current
      .map(b => ({ ...b, x: wrap(b.x + b.vx, W), y: wrap(b.y + b.vy, H), ttl: b.ttl - 1 }))
      .filter(b => b.ttl > 0);

    // Move asteroids
    asteroidsRef.current.forEach(ast => {
      ast.x = wrap(ast.x + ast.vx, W);
      ast.y = wrap(ast.y + ast.vy, H);
      ast.rot += ast.rotSpeed;
    });

    // Particles
    particlesRef.current = particlesRef.current
      .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.04 }))
      .filter(p => p.life > 0);

    // Bullet-asteroid collision
    const newAsteroids = [...asteroidsRef.current];
    let bulletsToRemove = new Set();
    let asteroidsToRemove = new Set();
    let spawned = [];

    bulletsRef.current.forEach((bullet, bi) => {
      newAsteroids.forEach((ast, ai) => {
        if (asteroidsToRemove.has(ai)) return;
        if (dist(bullet, ast) < ast.r) {
          bulletsToRemove.add(bi);
          asteroidsToRemove.add(ai);
          asteroidsDestroyedRef.current += 1;
          const pts = SIZES[ast.sizeIdx].pts * levelRef.current;
          scoreRef.current += pts;
          spawnParticles(ast.x, ast.y, ["#ff8c00","#ffe600","#39ff14"][ast.sizeIdx], 10);

          // Split into two smaller pieces
          if (ast.sizeIdx < 2) {
            const speed = Math.hypot(ast.vx, ast.vy) + 0.5;
            spawned.push(makeAsteroid(ast.sizeIdx + 1, ast.x, ast.y, speed));
            spawned.push(makeAsteroid(ast.sizeIdx + 1, ast.x, ast.y, speed));
          }
        }
      });
    });

    asteroidsRef.current = newAsteroids.filter((_, i) => !asteroidsToRemove.has(i)).concat(spawned);
    bulletsRef.current = bulletsRef.current.filter((_, i) => !bulletsToRemove.has(i));

    if (asteroidsToRemove.size > 0) setUi({ score: scoreRef.current });

    // All asteroids cleared → next level
    if (asteroidsRef.current.length === 0) {
      levelRef.current += 1;
      const count = 3 + levelRef.current;
      asteroidsRef.current = spawnAsteroids(count, levelRef.current);
      setUi({ level: levelRef.current });
    }

    // Ship-asteroid collision
    if (invincibleRef.current > 0) {
      invincibleRef.current--;
    } else {
      for (const ast of asteroidsRef.current) {
        if (dist(ship, ast) < ast.r + SHIP_SIZE * 0.6) {
          spawnParticles(ship.x, ship.y, "#00f5ff", 14);
          livesRef.current -= 1;
          setUi({ lives: livesRef.current });
          if (livesRef.current <= 0) { draw(); endGame(); return; }
          respawn();
          break;
        }
      }
    }

    draw();
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  const startGame = () => {
    shipRef.current = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
    bulletsRef.current = [];
    asteroidsRef.current = spawnAsteroids(4, 1);
    particlesRef.current = [];
    livesRef.current = 3;
    levelRef.current = 1;
    asteroidsDestroyedRef.current = 0;
    scoreRef.current = 0;
    runningRef.current = true;
    invincibleRef.current = INVINCIBLE_FRAMES;
    shootCooldownRef.current = 0;
    startTimeRef.current = Date.now();
    setUi({ phase: "playing", score: 0, lives: 3, level: 1, submitMsg: null, highScores: [] });
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    draw();
    const onKeyDown = (e) => {
      keysRef.current[e.key] = true;
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
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
      <h1 style={styles.title}>ASTEROIDS</h1>
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
              <span style={styles.scoreDetail}>{s.details?.asteroids_destroyed ?? 0} rocks</span>
            </div>
          ))}
        </div>
      )}

      <p style={styles.hint}>ARROWS / WASD to steer · SPACE to fire</p>
    </div>
  );
}

const styles = {
  wrap: { textAlign: "center", color: "#00f5ff" },
  title: { fontSize: "1.6rem", color: "#ff8c00", textShadow: "0 0 8px #ff8c00, 0 0 20px #ff8c00", marginBottom: "0.8rem", letterSpacing: "0.25em" },
  hud: { display: "flex", gap: "2rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.7rem", color: "#00f5ff" },
  canvasWrap: { position: "relative", display: "inline-block" },
  canvas: { border: "2px solid rgba(255,140,0,0.35)", display: "block", background: "#020008" },
  overlay: {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", background: "rgba(2,0,8,0.85)",
  },
  gameOver: { fontSize: "1.4rem", color: "#ff8c00", textShadow: "0 0 8px #ff8c00", marginBottom: "1rem" },
  msg: { fontSize: "0.72rem", color: "#39ff14", marginBottom: "0.8rem" },
  button: {
    padding: "0.7rem 1.6rem", fontSize: "0.72rem", background: "transparent",
    color: "#ff8c00", border: "2px solid #ff8c00", cursor: "pointer",
    textShadow: "0 0 6px #ff8c00", boxShadow: "0 0 10px rgba(255,140,0,0.3)",
    letterSpacing: "0.15em",
  },
  scores: { marginTop: "1.2rem", fontSize: "0.72rem", textAlign: "left", display: "inline-block", minWidth: "200px" },
  scoresTitle: { color: "#ffe600", marginBottom: "0.4rem", letterSpacing: "0.1em" },
  scoreRow: { display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid rgba(0,245,255,0.15)" },
  scoreDetail: { color: "#8a8f99" },
  hint: { marginTop: "1rem", fontSize: "0.62rem", color: "rgba(0,245,255,0.35)", letterSpacing: "0.1em" },
};
