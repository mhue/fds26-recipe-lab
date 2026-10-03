/**
 * Short firework burst, then paper confetti that keeps falling
 * until a key is pressed or the result screen goes away.
 */

const COLORS = [
  "#1f7a55",
  "#3aaa78",
  "#f2c14e",
  "#f4e27a",
  "#e07a3d",
  "#e85d4c",
  "#1a6f8c",
  "#7ec8d4",
  "#f7f3ea",
  "#c45c86",
];

const SPARK_COLORS = ["#f2c14e", "#fff6d8", "#fff", "#3aaa78", "#e07a3d"];

/** @type {Shape[]} */
const SHAPES = ["paper", "heart", "star", "disk"];

/** @type {{ stop: () => void } | null} */
let active = null;

export function stopCelebration() {
  active?.stop();
}

/** Full-screen overlay. No-op when the user prefers reduced motion. */
export function startWinCelebration() {
  stopCelebration();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const overlay = document.createElement("div");
  overlay.className = "celebrate-overlay";
  overlay.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    overlay.remove();
    return;
  }

  let cssW = window.innerWidth;
  let cssH = window.innerHeight;
  /** @type {Paper[]} */
  const pieces = [];
  /** @type {Spark[]} */
  const sparks = [];
  /** @type {Flash[]} */
  const flashes = [];
  const bursts = [
    { at: 0.08, x: 0.28, y: 0.22, done: false },
    { at: 0.34, x: 0.72, y: 0.18, done: false },
    { at: 0.56, x: 0.5, y: 0.3, done: false },
  ];
  const confettiAt = 0.72;

  resize();
  seedPieces();

  let running = true;
  let raf = 0;
  let last = performance.now();
  const started = last;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedPieces() {
    const count = Math.max(28, Math.min(46, Math.round(cssW / 28)));
    pieces.length = 0;
    for (let i = 0; i < count; i++) pieces.push(makePiece(true));
  }

  /** @param {boolean} above */
  function makePiece(above) {
    const color = COLORS[(Math.random() * COLORS.length) | 0];
    return {
      x: Math.random() * cssW,
      y: above ? -12 - Math.random() * cssH * 0.65 : -12 - Math.random() * 70,
      vx: (Math.random() - 0.5) * 36,
      vy: 78 + Math.random() * 78,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.4,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 2.2 + Math.random() * 3.2,
      w: 14 + Math.random() * 10,
      h: 8 + Math.random() * 6,
      skew: 2.2 + Math.random() * 4,
      shape: SHAPES[(Math.random() * SHAPES.length) | 0],
      phase: Math.random() * Math.PI * 2,
      freq: 0.8 + Math.random() * 1.4,
      color,
      back: darker(color),
    };
  }

  /** @param {number} x @param {number} y */
  function spawnBurst(x, y) {
    flashes.push({ x, y, age: 0, life: 0.42 });
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.25;
      const speed = 80 + Math.random() * 170;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 30,
        life: 0.5 + Math.random() * 0.35,
        age: 0,
        size: 2 + Math.random() * 2.2,
        color: SPARK_COLORS[i % SPARK_COLORS.length],
      });
    }
  }

  function frame(now) {
    if (!running) return;
    if (document.hidden) {
      raf = 0;
      return;
    }
    const dt = Math.min(0.034, (now - last) / 1000);
    last = now;
    const elapsed = (now - started) / 1000;

    for (const burst of bursts) {
      if (!burst.done && elapsed >= burst.at) {
        burst.done = true;
        spawnBurst(burst.x * cssW, burst.y * cssH);
      }
    }

    ctx.clearRect(0, 0, cssW, cssH);

    for (let i = flashes.length - 1; i >= 0; i--) {
      const flash = flashes[i];
      flash.age += dt;
      if (flash.age >= flash.life) {
        flashes.splice(i, 1);
        continue;
      }
      const t = flash.age / flash.life;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, 6 + t * 78, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 236, 186, ${1 - t})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.age += dt;
      if (spark.age >= spark.life) {
        sparks.splice(i, 1);
        continue;
      }
      spark.vy += 260 * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      const fade = 1 - spark.age / spark.life;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = spark.color;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(spark.x, spark.y);
      ctx.lineTo(spark.x - spark.vx * 0.05, spark.y - spark.vy * 0.05);
      ctx.stroke();
      ctx.fillStyle = "#fff8e4";
      ctx.fillRect(spark.x - 1, spark.y - 1, spark.size, spark.size * 0.6);
    }
    ctx.globalAlpha = 1;

    if (elapsed >= confettiAt) {
      const wind = Math.sin(elapsed * 0.55) * 40 + Math.sin(elapsed * 0.17) * 16;
      for (const piece of pieces) {
        const gust = Math.sin(elapsed * piece.freq + piece.phase) * 24;
        piece.vx += (wind + gust - piece.vx) * Math.min(1, dt * 1.5);
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.angle += piece.spin * dt;
        piece.flip += piece.flipSpeed * dt;
        if (piece.y > cssH + 36) {
          piece.y = -20 - Math.random() * 90;
          piece.x = Math.random() * cssW;
        } else if (piece.x < -48) {
          piece.x = cssW + 24;
        } else if (piece.x > cssW + 48) {
          piece.x = -24;
        }
        drawPiece(piece);
      }
    }

    raf = requestAnimationFrame(frame);
  }

  /** @param {Paper} piece */
  function drawPiece(piece) {
    const face = Math.cos(piece.flip);
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.angle);
    ctx.scale(face, 1);
    ctx.fillStyle = face >= 0 ? piece.color : piece.back;
    ctx.beginPath();
    if (piece.shape === "heart") traceHeart(ctx, piece.w * 0.55);
    else if (piece.shape === "star") traceStar(ctx, piece.w * 0.58);
    else if (piece.shape === "disk") ctx.ellipse(0, 0, piece.w * 0.46, piece.w * 0.46, 0, 0, Math.PI * 2);
    else tracePaper(ctx, piece.w, piece.h, piece.skew);
    ctx.fill();
    ctx.restore();
  }

  function onKey(event) {
    event.preventDefault();
    event.stopPropagation();
    stop();
  }

  function onVisibility() {
    if (!running) return;
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    overlay.remove();
    if (active?.stop === stop) active = null;
  }

  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibility);
  raf = requestAnimationFrame(frame);
  active = { stop };
}

/** @param {CanvasRenderingContext2D} ctx @param {number} w @param {number} h @param {number} skew */
function tracePaper(ctx, w, h, skew) {
  const hw = w / 2;
  const hh = h / 2;
  ctx.moveTo(-hw + skew, -hh);
  ctx.lineTo(hw + skew, -hh);
  ctx.lineTo(hw - skew, hh);
  ctx.lineTo(-hw - skew, hh);
  ctx.closePath();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} s */
function traceHeart(ctx, s) {
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(s * 0.55, s * 0.35, s * 1.15, s * 0.05, s * 0.72, -s * 0.38);
  ctx.bezierCurveTo(s * 0.42, -s * 0.72, s * 0.08, -s * 0.48, 0, -s * 0.12);
  ctx.bezierCurveTo(-s * 0.08, -s * 0.48, -s * 0.42, -s * 0.72, -s * 0.72, -s * 0.38);
  ctx.bezierCurveTo(-s * 1.15, s * 0.05, -s * 0.55, s * 0.35, 0, s * 0.9);
  ctx.closePath();
}

/** Five-point star, point up. @param {CanvasRenderingContext2D} ctx @param {number} r */
function traceStar(ctx, r) {
  const inner = r * 0.4;
  for (let i = 0; i < 5; i++) {
    const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const mid = outer + Math.PI / 5;
    const ox = Math.cos(outer) * r;
    const oy = Math.sin(outer) * r;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(Math.cos(mid) * inner, Math.sin(mid) * inner);
  }
  ctx.closePath();
}

/** @param {string} hex */
function darker(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.7);
  const g = Math.round(((n >> 8) & 255) * 0.7);
  const b = Math.round((n & 255) * 0.7);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * @typedef {object} Paper
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} angle
 * @property {number} spin
 * @property {number} flip
 * @property {number} flipSpeed
 * @property {number} w
 * @property {number} h
 * @property {number} skew
 * @property {Shape} shape
 * @property {number} phase
 * @property {number} freq
 * @property {string} color
 * @property {string} back
 */

/** @typedef {'paper'|'heart'|'star'|'disk'} Shape */

/**
 * @typedef {object} Spark
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} life
 * @property {number} age
 * @property {number} size
 * @property {string} color
 */

/**
 * @typedef {object} Flash
 * @property {number} x
 * @property {number} y
 * @property {number} age
 * @property {number} life
 */
