interface Piece { x: number; y: number; vx: number; vy: number; w: number; r: number; c: string; l: number }
const COLORS = ['#FFD23F', '#111111', '#FF6B6B', '#4ECDC4', '#7B61FF', '#FFFFFF'];
let pieces: Piece[] = [];

export function confetti(canvas: HTMLCanvasElement, x: number, y: number, n: number) {
  const cx = canvas.getContext('2d');
  if (!cx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const running = pieces.length > 0;
  for (let i = 0; i < n; i++) {
    pieces.push({
      x, y, vx: (Math.random() - 0.5) * (n > 60 ? 18 : 10), vy: -Math.random() * (n > 60 ? 16 : 9) - 3,
      w: Math.random() * 8 + 4, r: Math.random() * 6, c: COLORS[i % COLORS.length], l: 100,
    });
  }
  if (running) return;
  const frame = () => {
    cx.clearRect(0, 0, canvas.width, canvas.height);
    pieces = pieces.filter((p) => p.l > 0);
    for (const p of pieces) {
      p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += 0.2; p.l--;
      cx.save();
      cx.globalAlpha = Math.min(1, p.l / 30);
      cx.translate(p.x, p.y); cx.rotate(p.r);
      cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
      cx.restore();
    }
    if (pieces.length) requestAnimationFrame(frame);
    else cx.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(frame);
}
