const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

function drawCoucouMochi(ctx, cx, cy, size, opts = {}) {
  const W = size;
  const R = W * 0.32 * (opts.scale || 1.0);
  const rx = R * 1.15;
  const ry = R * 0.88;

  const yaw = opts.yaw || 0;
  const pitch = opts.pitch || 0;
  const tilt = opts.tilt || 0;
  const roll = opts.roll || 0;
  const sx = opts.sx || 1;
  const sy = opts.sy || 1;
  const open = opts.open !== undefined ? opts.open : 1;
  const eyeShape = opts.eye || 'pill';
  const blush = opts.blush !== undefined ? opts.blush : 0.45;

  ctx.save();
  ctx.translate(cx + (opts.ox || 0) * R, cy + (opts.oy || 0) * R + R * 0.05);
  if (tilt) ctx.rotate(tilt);
  ctx.scale(sx, sy);

  // 1. Superellipsoid path (exponent 2.7) matching BotEngine and Coucou mochiPath
  const pathPoints = [];
  const n = 96;
  const e = 2 / 2.7;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = rx * Math.sign(ca) * Math.pow(Math.abs(ca), e);
    const py = ry * Math.sign(sa) * Math.pow(Math.abs(sa), e);
    pathPoints.push([px, py]);
  }

  function setMochiPath() {
    ctx.beginPath();
    pathPoints.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  // 2. Base Linear Gradient (Mochi Rice Warm Ivory/Porcelain)
  setMochiPath();
  const c0 = opts.topColor || '#FFFAF5';
  const c1 = opts.botColor || '#DAC9BA';
  const g = ctx.createLinearGradient(rx * 0.7, -ry * 0.85, -rx * 0.8, ry * 0.9);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fill();

  // 3. Ambient & Bottom Shading
  setMochiPath();
  const sh = ctx.createRadialGradient(rx * 0.25, -ry * 0.32, R * 0.15, 0, 0, R * 1.25);
  sh.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sh.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  sh.addColorStop(1, 'rgba(40, 20, 10, 0.18)');
  ctx.fillStyle = sh;
  ctx.fill();

  // 4. Soft 3D Specular Highlight
  setMochiPath();
  const hl = ctx.createRadialGradient(rx * 0.32, -ry * 0.44, 0, rx * 0.32, -ry * 0.44, R * 0.45);
  hl.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
  hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hl;
  ctx.fill();

  // 5. Rosy Cheeks (Blush)
  if (blush > 0.01) {
    ctx.save();
    setMochiPath();
    ctx.clip();
    const yo = Math.sin(yaw) * rx * 0.8;
    ctx.fillStyle = `rgba(255, 120, 150, ${blush})`;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sd * rx * 0.62 + yo, ry * 0.18, R * 0.18, R * 0.105, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 6. Eyes (Coucou 3D Spherical Projection & Expressive Shapes)
  const EYE_W = 0.25;
  const EYE_H = 0.27;
  const EYE_SP = 0.37;
  const EYE_P = -0.12;

  ctx.save();
  setMochiPath();
  ctx.clip();
  ctx.fillStyle = '#1A1412';
  ctx.strokeStyle = '#1A1412';

  for (const sd of [-1, 1]) {
    const eyeYaw = sd * EYE_SP + yaw;
    let eyePitch = EYE_P + pitch + roll;
    eyePitch = ((eyePitch + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const cp = Math.cos(eyePitch);
    if (Math.cos(eyeYaw) * cp < 0.04) continue;

    const px = Math.sin(eyeYaw) * cp * rx;
    const py = -Math.sin(eyePitch) * ry;
    const fx = Math.max(0.18, Math.cos(eyeYaw));
    const fy = Math.max(0.18, cp);

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(fx, fy);

    let ew = R * EYE_W;
    let eh = R * EYE_H;

    switch (eyeShape) {
      case 'happy': {
        ctx.lineWidth = ew * 0.52;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, eh * 0.18, ew * 0.85, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
        break;
      }
      case 'wink': {
        if (sd < 0) {
          const hh = Math.max(eh * open, ew * 0.3);
          ctx.beginPath();
          ctx.roundRect(-ew / 2, -hh / 2, ew, hh, Math.min(ew / 2, hh / 2));
          ctx.fill();
        } else {
          ctx.lineWidth = ew * 0.52;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, eh * 0.18, ew * 0.85, Math.PI * 1.12, Math.PI * 1.88);
          ctx.stroke();
        }
        break;
      }
      case 'heart': {
        ctx.fillStyle = '#FF4D6D';
        const s = ew * 1.25;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.38);
        ctx.bezierCurveTo(-s * 1.05, -s * 0.15, -s * 0.5, -s * 0.95, 0, -s * 0.38);
        ctx.bezierCurveTo(s * 0.5, -s * 0.95, s * 1.05, -s * 0.15, 0, s * 0.38);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'star': {
        ctx.fillStyle = '#F7B32B';
        const ro = ew * 1.15, ri = ew * 0.48;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? ri : ro, a = -Math.PI / 2 + (i * Math.PI) / 5;
          const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'dot': {
        ctx.beginPath();
        ctx.arc(0, 0, ew * 0.48, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'closed': {
        ctx.lineWidth = ew * 0.38;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -eh * 0.08, ew * 0.8, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        break;
      }
      case 'spiral': {
        ctx.lineWidth = ew * 0.24;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let a = 0; a < 4.4 * Math.PI; a += 0.2) {
          const r = ew * 0.06 + a * ew * 0.058;
          const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
          if (a === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        break;
      }
      case 'pill':
      default: {
        const hh = Math.max(eh * open, ew * 0.3);
        ctx.beginPath();
        ctx.roundRect(-ew / 2, -hh / 2, ew, hh, Math.min(ew / 2, hh / 2));
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
  ctx.restore();

  // 7. Floating particles
  if (opts.particle === 'heart') {
    ctx.save();
    ctx.translate(rx * 0.45, -ry * 0.95);
    ctx.fillStyle = '#FF4D6D';
    const s = R * 0.24;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.38);
    ctx.bezierCurveTo(-s * 1.05, -s * 0.15, -s * 0.5, -s * 0.95, 0, -s * 0.38);
    ctx.bezierCurveTo(s * 0.5, -s * 0.95, s * 1.05, -s * 0.15, 0, s * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (opts.particle === 'star') {
    ctx.save();
    ctx.translate(rx * 0.5, -ry * 0.9);
    ctx.fillStyle = '#F7B32B';
    const ro = R * 0.22, ri = R * 0.095;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ro, a = -Math.PI / 2 + (i * Math.PI) / 5;
      const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (opts.particle === 'spark') {
    ctx.save();
    ctx.translate(rx * 0.48, -ry * 0.88);
    ctx.fillStyle = '#FFFFFF';
    const ro = R * 0.2, ri = R * 0.05;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? ri : ro, a = (i * Math.PI) / 4;
      const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function buildDirectionsSheet() {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');
  const cellSize = 360;

  // 3x3 Grid: 9 Directions
  // Row 0: Looking UP
  // Row 1: Looking LEVEL
  // Row 2: Looking DOWN
  const grid = [
    // Row 0
    [
      { yaw: -0.42, pitch: 0.38, tilt: -0.06 }, // Top-Left
      { yaw: 0.0,   pitch: 0.42, tilt: 0 },     // Top-Center
      { yaw: 0.42,  pitch: 0.38, tilt: 0.06 }   // Top-Right
    ],
    // Row 1
    [
      { yaw: -0.52, pitch: 0.0,  tilt: -0.04 }, // Center-Left
      { yaw: 0.0,   pitch: 0.0,  tilt: 0 },     // Center (Idle/Front)
      { yaw: 0.52,  pitch: 0.0,  tilt: 0.04 }   // Center-Right
    ],
    // Row 2
    [
      { yaw: -0.42, pitch: -0.38, tilt: 0.05 }, // Bottom-Left
      { yaw: 0.0,   pitch: -0.42, tilt: 0 },    // Bottom-Center
      { yaw: 0.42,  pitch: -0.38, tilt: -0.05 } // Bottom-Right
    ]
  ];

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;
      const opts = grid[r][c];
      drawCoucouMochi(ctx, cx, cy, cellSize, opts);
    }
  }

  const outPath = path.join(__dirname, '../frontend/public/mascots/mochi-directions.webp');
  fs.writeFileSync(outPath, canvas.toBuffer('image/webp'));
  console.log('Saved directions WebP to', outPath);
}

function buildReactionsSheet() {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');
  const cellSize = 360;

  // Exact page-mascot REACTIONS array mapping:
  // 0: 'blink'
  // 1: 'heart'
  // 2: 'sparkle'
  // 3: 'surprised'
  // 4: 'wink'
  // 5: 'bashful'
  // 6: 'sleepy'
  // 7: 'dizzy'
  // 8: 'delighted'
  const reactions = [
    // 0: 'blink' (boop squash with closed eyes)
    { eye: 'closed', oy: 0.1,  sy: 0.85, sx: 1.15, blush: 0.5 },
    // 1: 'heart' (love emote)
    { eye: 'heart',  particle: 'heart', oy: -0.05, blush: 0.7 },
    // 2: 'sparkle' (twinkling star emote)
    { eye: 'star',   particle: 'star',  tilt: -0.1, blush: 0.48 },
    // 3: 'surprised' (pop surprised emote)
    { eye: 'dot',    oy: -0.14, sy: 1.1,  sx: 0.94, blush: 0.4, particle: 'spark' },
    // 4: 'wink' (playful wink with tilt)
    { eye: 'wink',   tilt: 0.14, yaw: 0.18, blush: 0.52 },
    // 5: 'bashful' (sweet shy smile)
    { eye: 'happy',  blush: 0.75, oy: 0.04, tilt: -0.08 },
    // 6: 'sleepy' (sleepy relaxed eyes)
    { eye: 'pill',   open: 0.18, yaw: -0.12, blush: 0.35 },
    // 7: 'dizzy' (spiral eyes dizzy reaction)
    { eye: 'spiral', tilt: 0.2, blush: 0.5 },
    // 8: 'delighted' (joyful beaming smile)
    { eye: 'happy',  oy: -0.08, sy: 1.06, blush: 0.6, particle: 'spark' }
  ];

  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3);
    const c = i % 3;
    const cx = c * cellSize + cellSize / 2;
    const cy = r * cellSize + cellSize / 2;
    drawCoucouMochi(ctx, cx, cy, cellSize, reactions[i]);
  }

  const outPath = path.join(__dirname, '../frontend/public/mascots/mochi-reactions.webp');
  fs.writeFileSync(outPath, canvas.toBuffer('image/webp'));
  console.log('Saved reactions WebP to', outPath);
}

buildDirectionsSheet();
buildReactionsSheet();
console.log('Coucou Mochi sprites successfully generated!');
