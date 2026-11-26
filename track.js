// Logical coordinate constants (250m Olympic Velodrome geometry)
export const OVAL_WIDTH = 1400;
export const OVAL_HEIGHT = 800;
export const STRAIGHT_LEN = 540; // Total straightaway length in px
export const INNER_RADIUS = 175; // Pole line turn radius
export const TRACK_WIDTH = 165;  // Banking width from pole line to fence

// Lane offsets from the black datum line (in pixels up the banking)
// Datum (black) = 0, Sprinter (red) = 16, Stayer (blue) = 56, Fence = 155
export const LANES = {
  APRON: -16,
  BLACK: 0,
  RED: 16,
  BLUE: 56,
  MID_HIGH: 95,
  HIGH: 130
};

/**
 * Converts normalized track progress `s` (0..1 around 250m oval, counter-clockwise)
 * and lateral banking height `laneOffset` (px above black datum line) into (x, y, heading).
 */
export function trackToCanvas(s, laneOffset, viewMode = "oval") {
  s = ((s % 1) + 1) % 1;

  if (viewMode === "closeup") {
    // Home straightaway close-up (moving right-to-left along bottom straight)
    const x = OVAL_WIDTH - s * OVAL_WIDTH;
    const baseDatumY = 580;
    const scaleY = 2.4;
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

  // 1. Home Straight (bottom, left-to-right counter-clockwise)
  if (d < straightDist) {
    const x = cx - halfStraight + d;
    const y = cy + r;
    return { x, y, angle: 0 };
  }
  d -= straightDist;

  // 2. Right Turn (Turns 1 & 2, bottom to top counter-clockwise)
  if (d < turnDist) {
    const theta = Math.PI / 2 - (d / turnDist) * Math.PI;
    const x = cx + halfStraight + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    return { x, y, angle: theta - Math.PI / 2 };
  }
  d -= turnDist;

  // 3. Back Straight (top, right-to-left counter-clockwise)
  if (d < straightDist) {
    const x = cx + halfStraight - d;
    const y = cy - r;
    return { x, y, angle: Math.PI };
  }
  d -= straightDist;

  // 4. Left Turn (Turns 3 & 4, top to bottom counter-clockwise)
  const theta = -Math.PI / 2 - (d / turnDist) * Math.PI;
  const x = cx - halfStraight + Math.cos(theta) * r;
  const y = cy + Math.sin(theta) * r;
  return { x, y, angle: theta - Math.PI / 2 };
}

/**
 * Converts a canvas click/drag point (x, y) back to nearest (s, laneOffset).
 */
export function canvasToTrack(x, y, viewMode = "oval") {
  if (viewMode === "closeup") {
    const s = Math.max(0, Math.min(1, (OVAL_WIDTH - x) / OVAL_WIDTH));
    const laneOffset = Math.max(-22, Math.min(155, (580 - y) / 2.4));
    return { s, laneOffset };
  }

  const cx = OVAL_WIDTH / 2;
  const cy = OVAL_HEIGHT / 2;
  const halfStraight = STRAIGHT_LEN / 2;

  let clampedX = Math.max(cx - halfStraight, Math.min(cx + halfStraight, x));
  const dx = x - clampedX;
  const dy = y - cy;
  const distFromSpine = Math.hypot(dx, dy);
  const laneOffset = Math.max(-22, Math.min(155, distFromSpine - INNER_RADIUS));

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

/**
 * Renders the velodrome surface, official UCI lines, riders, derny, and drawings.
 */
export function renderTrack(ctx, state) {
  ctx.clearRect(0, 0, OVAL_WIDTH, OVAL_HEIGHT);

  if (state.viewMode === "closeup") {
    drawCloseupSurface(ctx);
  } else {
    drawOvalSurface(ctx);
  }

  drawAnnotations(ctx, state.drawings);

  for (const rider of state.riders) {
    const pos = trackToCanvas(rider.s, rider.laneOffset, state.viewMode);
    if (rider.type === "derny") {
      drawDerny(ctx, pos.x, pos.y, pos.angle, rider === state.selectedRider);
    } else {
      drawRider(ctx, pos.x, pos.y, pos.angle, rider, rider === state.selectedRider);
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
  traceStadium(INNER_RADIUS + TRACK_WIDTH + 10);
  ctx.fillStyle = "#334155";
  ctx.fill();

  // Siberian pine wooden boards
  traceStadium(INNER_RADIUS + TRACK_WIDTH);
  ctx.fillStyle = "#e3c397";
  ctx.fill();

  // Subtle wood board grain lines
  ctx.strokeStyle = "rgba(160, 115, 65, 0.25)";
  ctx.lineWidth = 1;
  for (let offset = 10; offset < TRACK_WIDTH; offset += 14) {
    traceStadium(INNER_RADIUS + offset);
    ctx.stroke();
  }

  // Blue Stayer's Line
  traceStadium(INNER_RADIUS + LANES.BLUE);
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Red Sprinter's Line
  traceStadium(INNER_RADIUS + LANES.RED);
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Black Measurement / Datum Line
  traceStadium(INNER_RADIUS + LANES.BLACK);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Côte d'Azur Blue Apron
  traceStadium(INNER_RADIUS - 3);
  ctx.lineWidth = 26;
  ctx.strokeStyle = "#38bdf8";
  ctx.stroke();

  // Green Infield
  traceStadium(INNER_RADIUS - 28);
  ctx.fillStyle = "#14532d";
  ctx.fill();

  // Finish Line & Pursuit Lines
  const finishX = cx + 60;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(finishX, cy + INNER_RADIUS - 2);
  ctx.lineTo(finishX, cy + INNER_RADIUS + TRACK_WIDTH);
  ctx.stroke();

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(finishX, cy + INNER_RADIUS - 2);
  ctx.lineTo(finishX, cy + INNER_RADIUS + TRACK_WIDTH);
  ctx.stroke();
}

function drawCloseupSurface(ctx) {
  // Warm Siberian pine background
  ctx.fillStyle = "#e3c397";
  ctx.fillRect(0, 0, OVAL_WIDTH, OVAL_HEIGHT);

  // Horizontal wood planks
  ctx.strokeStyle = "rgba(160, 115, 65, 0.28)";
  ctx.lineWidth = 1.5;
  for (let y = 20; y < 630; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(OVAL_WIDTH, y);
    ctx.stroke();
  }

  // Blue Stayer's Line
  const blueY = 580 - LANES.BLUE * 2.4;
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, blueY);
  ctx.lineTo(OVAL_WIDTH, blueY);
  ctx.stroke();

  // Red Sprinter's Line
  const redY = 580 - LANES.RED * 2.4;
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, redY);
  ctx.lineTo(OVAL_WIDTH, redY);
  ctx.stroke();

  // Black Datum Line
  const blackY = 580;
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, blackY);
  ctx.lineTo(OVAL_WIDTH, blackY);
  ctx.stroke();

  // Côte d'Azur Blue Apron
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, blackY + 4, OVAL_WIDTH, 70);

  // Infield edge
  ctx.fillStyle = "#14532d";
  ctx.fillRect(0, blackY + 74, OVAL_WIDTH, OVAL_HEIGHT - (blackY + 74));
}

function drawRider(ctx, x, y, angle, rider, isSelected) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Selection halo
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Wheels & Frame
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(16, 0);
  ctx.stroke();

  // Drop handlebars
  ctx.beginPath();
  ctx.moveTo(10, -8);
  ctx.lineTo(10, 8);
  ctx.stroke();

  // Rider Torso / Jersey
  ctx.fillStyle = rider.jersey || "#0284c7";
  ctx.beginPath();
  ctx.ellipse(-2, 0, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Helmet
  ctx.fillStyle = rider.helmet || "#ef4444";
  ctx.beginPath();
  ctx.arc(7, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // Optional label / speed tag
  if (rider.label) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(rider.label, x, y - 16);
  }
}

function drawDerny(ctx, x, y, angle, isSelected) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Motorbike body
  ctx.fillStyle = "#991b1b";
  ctx.beginPath();
  ctx.roundRect(-20, -7, 40, 14, 5);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pacer shoulders & helmet
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.ellipse(2, 0, 9, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(6, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();

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
      // Normal vector pointing away from track center (up the banking)
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

    // Arrowhead
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