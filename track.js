export const OVAL_WIDTH = 1400;
export const OVAL_HEIGHT = 800;
export const STRAIGHT_LEN = 540;
export const INNER_RADIUS = 182;
export const TRACK_WIDTH = 162;

// Official UCI line offsets above the Black Datum Line
export const LANES = {
  BLACK: 0,
  RED: 18,
  BLUE: 60,
  MID_HIGH: 98,
  HIGH: 134
};

export function trackToCanvas(s, laneOffset, viewMode = "oval") {
  s = ((s % 1) + 1) % 1;

  if (viewMode === "closeup") {
    const x = OVAL_WIDTH - s * OVAL_WIDTH;
    const baseDatumY = 635;
    const scaleY = 2.75;
    const y = baseDatumY - laneOffset * scaleY;
    return { x, y, angle: Math.PI };
  }

  const cx = OVAL_WIDTH / 2;
  const cy = OVAL_HEIGHT / 2;
  const halfStraight = STRAIGHT_LEN / 2;
  const r = INNER_RADIUS + laneOffset;

  const straightDist = STRAIGHT_LEN;
  const turnDist = Math.PI * r;
  const totalDist = 2 * straightDist + 2 * turnDist;
  let d = s * totalDist;

  if (d < straightDist) {
    return { x: cx - halfStraight + d, y: cy + r, angle: 0 };
  }
  d -= straightDist;

  if (d < turnDist) {
    const theta = Math.PI / 2 - (d / turnDist) * Math.PI;
    return {
      x: cx + halfStraight + Math.cos(theta) * r,
      y: cy + Math.sin(theta) * r,
      angle: theta - Math.PI / 2
    };
  }
  d -= turnDist;

  if (d < straightDist) {
    return { x: cx + halfStraight - d, y: cy - r, angle: Math.PI };
  }
  d -= straightDist;

  const theta = -Math.PI / 2 - (d / turnDist) * Math.PI;
  return {
    x: cx - halfStraight + Math.cos(theta) * r,
    y: cy + Math.sin(theta) * r,
    angle: theta - Math.PI / 2
  };
}

export function canvasToTrack(x, y, viewMode = "oval") {
  if (viewMode === "closeup") {
    const s = Math.max(0, Math.min(1, (OVAL_WIDTH - x) / OVAL_WIDTH));
    const laneOffset = Math.max(-8, Math.min(155, (635 - y) / 2.75));
    return { s, laneOffset };
  }

  const cx = OVAL_WIDTH / 2;
  const cy = OVAL_HEIGHT / 2;
  const halfStraight = STRAIGHT_LEN / 2;

  const clampedX = Math.max(cx - halfStraight, Math.min(cx + halfStraight, x));
  const distFromSpine = Math.hypot(x - clampedX, y - cy);
  const laneOffset = Math.max(-8, Math.min(155, distFromSpine - INNER_RADIUS));

  const r = INNER_RADIUS + laneOffset;
  const straightDist = STRAIGHT_LEN;
  const turnDist = Math.PI * r;
  const totalDist = 2 * straightDist + 2 * turnDist;

  let d = 0;
  if (x >= cx - halfStraight && x <= cx + halfStraight && y >= cy) {
    d = x - (cx - halfStraight);
  } else if (x > cx + halfStraight) {
    const theta = Math.atan2(y - cy, x - (cx + halfStraight));
    const progress = (Math.PI / 2 - theta) / Math.PI;
    d = straightDist + Math.max(0, Math.min(1, progress)) * turnDist;
  } else if (x >= cx - halfStraight && x <= cx + halfStraight && y < cy) {
    d = straightDist + turnDist + (cx + halfStraight - x);
  } else {
    let theta = Math.atan2(y - cy, x - (cx - halfStraight));
    if (theta > 0) theta -= 2 * Math.PI;
    const progress = (-Math.PI / 2 - theta) / Math.PI;
    d = 2 * straightDist + turnDist + Math.max(0, Math.min(1, progress)) * turnDist;
  }

  return { s: ((d / totalDist) % 1 + 1) % 1, laneOffset };
}

export function renderTrack(ctx, state) {
  ctx.clearRect(0, 0, OVAL_WIDTH, OVAL_HEIGHT);

  if (state.viewMode === "closeup") {
    drawCloseupSurface(ctx);
  } else {
    drawOvalSurface(ctx);
  }

  drawAnnotations(ctx, state.drawings || []);

  const scale = state.viewMode === "closeup" ? 1.35 : 1.12;
  const riders = state.drill ? state.drill.riders : [];
  for (const rider of riders) {
    const pos = trackToCanvas(rider.s, rider.laneOffset, state.viewMode);
    if (rider.type === "derny") {
      drawDerny(ctx, pos.x, pos.y, pos.angle, rider === state.selectedRider, scale);
    } else {
      drawCyclist(ctx, pos.x, pos.y, pos.angle, rider, rider === state.selectedRider, scale);
    }
  }
}

function drawOvalSurface(ctx) {
  const cx = OVAL_WIDTH / 2;
  const cy = OVAL_HEIGHT / 2;
  const halfStraight = STRAIGHT_LEN / 2;

  const traceStadium = (radius) => {
    ctx.beginPath();
    ctx.arc(cx + halfStraight, cy, radius, -Math.PI / 2, Math.PI / 2);
    ctx.arc(cx - halfStraight, cy, radius, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
  };

  // Outer safety wall
  traceStadium(INNER_RADIUS + TRACK_WIDTH + 9);
  ctx.fillStyle = "#334155";
  ctx.fill();

  // Warm Siberian pine wooden boards
  traceStadium(INNER_RADIUS + TRACK_WIDTH);
  ctx.fillStyle = "#e6c89e";
  ctx.fill();

  // Subtle wood plank grain
  ctx.strokeStyle = "rgba(155, 110, 60, 0.22)";
  ctx.lineWidth = 1;
  for (let offset = 12; offset < TRACK_WIDTH; offset += 15) {
    traceStadium(INNER_RADIUS + offset);
    ctx.stroke();
  }

  // 1. Blue Stayer's Line (clear, crisp blue)
  traceStadium(INNER_RADIUS + LANES.BLUE);
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 2. Red Sprinter's Line (clear, crisp red)
  traceStadium(INNER_RADIUS + LANES.RED);
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Subtle, small Côte d'Azur apron tucked inside the black datum line
  traceStadium(INNER_RADIUS - 6.5);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#60a5fa";
  ctx.stroke();

  // 3. Clear Black Datum / Measurement Line
  traceStadium(INNER_RADIUS + LANES.BLACK);
  ctx.strokeStyle = "#090d16";
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // Green Infield
  traceStadium(INNER_RADIUS - 10.5);
  ctx.fillStyle = "#14532d";
  ctx.fill();

  // Finish Line
  const finishX = cx + 60;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(finishX, cy + INNER_RADIUS);
  ctx.lineTo(finishX, cy + INNER_RADIUS + TRACK_WIDTH);
  ctx.stroke();

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(finishX, cy + INNER_RADIUS);
  ctx.lineTo(finishX, cy + INNER_RADIUS + TRACK_WIDTH);
  ctx.stroke();
}

function drawCloseupSurface(ctx) {
  ctx.fillStyle = "#e6c89e";
  ctx.fillRect(0, 0, OVAL_WIDTH, OVAL_HEIGHT);

  ctx.strokeStyle = "rgba(155, 110, 60, 0.25)";
  ctx.lineWidth = 1.5;
  for (let y = 20; y < 635; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(OVAL_WIDTH, y);
    ctx.stroke();
  }

  // Blue Stayer's Line
  const blueY = 635 - LANES.BLUE * 2.75;
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, blueY);
  ctx.lineTo(OVAL_WIDTH, blueY);
  ctx.stroke();

  // Red Sprinter's Line
  const redY = 635 - LANES.RED * 2.75;
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, redY);
  ctx.lineTo(OVAL_WIDTH, redY);
  ctx.stroke();

  // Clear Black Datum Line
  const blackY = 635;
  ctx.strokeStyle = "#090d16";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, blackY);
  ctx.lineTo(OVAL_WIDTH, blackY);
  ctx.stroke();

  // Small, understated Côte d'Azur strip below black datum line
  ctx.fillStyle = "#60a5fa";
  ctx.fillRect(0, blackY + 4, OVAL_WIDTH, 22);

  // Green Infield
  ctx.fillStyle = "#14532d";
  ctx.fillRect(0, blackY + 26, OVAL_WIDTH, OVAL_HEIGHT - (blackY + 26));
}

/**
 * Draws a detailed overhead track cyclist (wheels, drop bars, arms, bib shorts, colored jersey, aero helmet).
 */
function drawCyclist(ctx, x, y, angle, rider, isSelected, scale = 1.12) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Selection ring
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Subtle drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(-1, 3, 21, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Front & Rear Track Wheels (narrow dark tires)
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-21, 0);
  ctx.lineTo(-9, 0);
  ctx.moveTo(11, 0);
  ctx.lineTo(22, 0);
  ctx.stroke();

  // Track Drop Handlebars & Stem
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(13, 0);
  ctx.moveTo(13, -8.5);
  ctx.lineTo(13, 8.5);
  // Drop curves
  ctx.moveTo(13, -8.5);
  ctx.lineTo(9.5, -8.5);
  ctx.moveTo(13, 8.5);
  ctx.lineTo(9.5, 8.5);
  ctx.stroke();

  // Outstretched Arms & Hands gripping drops
  ctx.strokeStyle = "#f1c27d";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(4, -7.5);
  ctx.lineTo(12, -8);
  ctx.moveTo(4, 7.5);
  ctx.lineTo(12, 8);
  ctx.stroke();

  // Black Bib Shorts / Hips (rear half of rider)
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.ellipse(-8, 0, 7.5, 6.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Colored Jersey / Torso & Shoulders
  ctx.fillStyle = rider.jersey || "#0284c7";
  ctx.beginPath();
  ctx.roundRect(-6, -8, 12, 16, 5);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Jersey Center Stripe / Collar Detail
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.stroke();

  // Aero Track Helmet (teardrop shape)
  ctx.fillStyle = rider.helmet || "#ef4444";
  ctx.beginPath();
  ctx.moveTo(12.5, 0);
  ctx.bezierCurveTo(12.5, -5.2, 5, -5.5, 1.5, 0);
  ctx.bezierCurveTo(5, 5.5, 12.5, 5.2, 12.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.restore();
}

function drawDerny(ctx, x, y, angle, isSelected, scale = 1.12) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Front & rear wheels
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.lineTo(24, 0);
  ctx.stroke();

  // Motorbike body & rear roller
  ctx.fillStyle = "#991b1b";
  ctx.beginPath();
  ctx.roundRect(-19, -7, 36, 14, 5);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Rear pacing roller bar
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-23, -7);
  ctx.lineTo(-23, 7);
  ctx.stroke();

  // Pacer jacket & helmet
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.ellipse(2, 0, 9.5, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(6, 0, 5.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawAnnotations(ctx, drawings) {
  for (const d of drawings) {
    ctx.save();
    ctx.strokeStyle = d.color || "#facc15";
    ctx.fillStyle = d.color || "#facc15";
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(d.x1, d.y1);

    let endAngle = Math.atan2(d.y2 - d.y1, d.x2 - d.x1);
    if (d.type === "swing-up" || d.type === "swing-down") {
      const mx = (d.x1 + d.x2) / 2;
      const my = (d.y1 + d.y2) / 2;
      const dx = d.x2 - d.x1;
      const dy = d.y2 - d.y1;
      const len = Math.hypot(dx, dy) || 1;
      const cx = OVAL_WIDTH / 2;
      const cy = OVAL_HEIGHT / 2;
      let nx = -dy / len;
      let ny = dx / len;
      const outwardDot = nx * (mx - cx) + ny * (my - cy);
      if (outwardDot < 0) {
        nx = -nx;
        ny = -ny;
      }
      const dir = d.type === "swing-up" ? 1 : -1;
      const bend = Math.min(90, len * 0.35) * dir;
      const cpx = mx + nx * bend;
      const cpy = my + ny * bend;

      ctx.quadraticCurveTo(cpx, cpy, d.x2, d.y2);
      endAngle = Math.atan2(d.y2 - cpy, d.x2 - cpx);
    } else {
      ctx.lineTo(d.x2, d.y2);
    }
    ctx.stroke();

    const headLen = 13;
    ctx.beginPath();
    ctx.moveTo(d.x2, d.y2);
    ctx.lineTo(d.x2 - headLen * Math.cos(endAngle - Math.PI / 6), d.y2 - headLen * Math.sin(endAngle - Math.PI / 6));
    ctx.lineTo(d.x2 - headLen * Math.cos(endAngle + Math.PI / 6), d.y2 - headLen * Math.sin(endAngle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
