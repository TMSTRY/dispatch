/**
 * Lightweight confetti burst — no external dependency.
 * Call fireConfetti() to launch a celebration from the bottom-centre.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  width: number;
  height: number;
  tilt: number;
  tiltSpeed: number;
  opacity: number;
}

const COLORS = [
  "#4f8ef7", "#34d399", "#fbbf24", "#f87171",
  "#a78bfa", "#fb923c", "#38bdf8", "#f472b6",
];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export function fireConfetti() {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  const COUNT = 140;
  const cx = canvas.width / 2;

  const particles: Particle[] = Array.from({ length: COUNT }, () => ({
    x: randomBetween(0, canvas.width),
    y: randomBetween(-120, -5),
    vx: randomBetween(-1.5, 1.5),
    vy: randomBetween(1.5, 3.5),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    width: randomBetween(8, 14),
    height: randomBetween(5, 9),
    tilt: randomBetween(-10, 10),
    tiltSpeed: randomBetween(-0.25, 0.25),
    opacity: 1,
  }));

  let frame: number;
  const GRAVITY = 0.06;
  const startTime = performance.now();
  const DURATION = 7000; // ms

  function draw(now: number) {
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = false;
    for (const p of particles) {
      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.tilt += p.tiltSpeed;
      p.opacity = Math.max(0, 1 - elapsed / DURATION);

      if (p.y < canvas.height + 20) alive = true;

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.tilt * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      ctx.restore();
    }

    if (alive && elapsed < DURATION) {
      frame = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }

  frame = requestAnimationFrame(draw);
}
