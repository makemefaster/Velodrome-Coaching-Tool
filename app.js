import { OVAL_WIDTH, OVAL_HEIGHT, LANES, trackToCanvas, canvasToTrack, renderTrack } from "./track.js";
import { DRILL_PRESETS } from "./presets.js";
import { createDrillState, getRiderSpeed, stepSimulation } from "./engine.js";

const canvas = document.getElementById("track-canvas");
const ctx = canvas.getContext("2d");
canvas.width = OVAL_WIDTH;
canvas.height = OVAL_HEIGHT;

const state = {
  viewMode: "oval",
  tool: "move",
  playing: false,
  drill: createDrillState(DRILL_PRESETS["trains-and-stations"]),
  drawings: [],
  selectedRider: null,
  draggingRider: null,
  activeDrawing: null,
  capturedFrames: [] // Stores coach-captured storyboard frames for GIF export
};

// Populate Presets
const presetSelect = document.getElementById("preset-select");
for (const [key, preset] of Object.entries(DRILL_PRESETS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = preset.name;
  presetSelect.appendChild(opt);
}

function loadPreset(key) {
  if (!DRILL_PRESETS[key]) return;
  state.drill = createDrillState(DRILL_PRESETS[key]);
  state.drawings = [];
  selectRider(null);
  syncZoneInputs();
}

presetSelect.addEventListener("change", (e) => loadPreset(e.target.value));
document.getElementById("btn-reset").addEventListener("click", () => loadPreset(presetSelect.value));

// Add Cyclist / Derny
document.getElementById("btn-add-rider").addEventListener("click", () => {
  const rider = {
    id: `rider-${Date.now()}`,
    s: 0.25,
    laneOffset: LANES.BLACK,
    jersey: "#7c3aed",
    helmet: "#facc15",
    useZoneSpeed: true,
    speedKmh: state.drill.zoneSpeeds.low
  };
  state.drill.riders.push(rider);
  selectRider(rider);
});

document.getElementById("btn-add-derny").addEventListener("click", () => {
  const derny = {
    id: `derny-${Date.now()}`,
    type: "derny",
    s: 0.28,
    laneOffset: LANES.RED,
    useZoneSpeed: true,
    speedKmh: state.drill.zoneSpeeds.low
  };
  state.drill.riders.push(derny);
  selectRider(derny);
});

// Play / Pause
const btnPlay = document.getElementById("btn-play");
function togglePlay() {
  state.playing = !state.playing;
  btnPlay.textContent = state.playing ? "⏸ Pause" : "▶ Play";
}
btnPlay.addEventListener("click", togglePlay);

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
});

// Zone Speed Inputs
function syncZoneInputs() {
  document.getElementById("speed-low").value = state.drill.zoneSpeeds.low;
  document.getElementById("speed-mid").value = state.drill.zoneSpeeds.mid;
  document.getElementById("speed-high").value = state.drill.zoneSpeeds.high;
}

["low", "mid", "high"].forEach((zone) => {
  document.getElementById(`speed-${zone}`).addEventListener("input", (e) => {
    state.drill.zoneSpeeds[zone] = Number(e.target.value) || 25;
    if (state.selectedRider) updateInspector();
  });
});

// Selected Rider Inspector (Jersey, Helmet, Individual Speed)
const inspector = document.getElementById("rider-inspector");
function selectRider(rider) {
  state.selectedRider = rider;
  if (!rider) {
    inspector.classList.add("hidden");
    return;
  }
  inspector.classList.remove("hidden");
  updateInspector();
}

function updateInspector() {
  const r = state.selectedRider;
  if (!r) return;
  const idx = state.drill.riders.indexOf(r) + 1;
  document.getElementById("insp-title").textContent = r.type === "derny" ? "Derny Pacer" : `Cyclist #${idx}`;
  document.getElementById("insp-jersey").value = r.jersey || "#0284c7";
  document.getElementById("insp-helmet").value = r.helmet || "#ef4444";
  const spd = Math.round(getRiderSpeed(r, state.drill.zoneSpeeds));
  document.getElementById("insp-speed").value = spd;
  document.getElementById("insp-speed-val").textContent = spd;
  document.getElementById("insp-lock-zone").textContent = r.useZoneSpeed !== false ? "Zone Speed: ON" : "Custom Speed";
}

document.getElementById("insp-jersey").addEventListener("input", (e) => {
  if (state.selectedRider) state.selectedRider.jersey = e.target.value;
});

document.getElementById("insp-helmet").addEventListener("input", (e) => {
  if (state.selectedRider) state.selectedRider.helmet = e.target.value;
});

document.getElementById("insp-speed").addEventListener("input", (e) => {
  if (!state.selectedRider) return;
  state.selectedRider.useZoneSpeed = false;
  state.selectedRider.speedKmh = Number(e.target.value);
  updateInspector();
});

document.getElementById("insp-lock-zone").addEventListener("click", () => {
  if (!state.selectedRider) return;
  state.selectedRider.useZoneSpeed = state.selectedRider.useZoneSpeed === false;
  updateInspector();
});

document.getElementById("insp-delete").addEventListener("click", () => {
  if (!state.selectedRider) return;
  state.drill.riders = state.drill.riders.filter((r) => r !== state.selectedRider);
  selectRider(null);
});

// Drawing Tools
document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.tool = btn.dataset.tool;
  });
});

document.getElementById("btn-clear-drawings").addEventListener("click", () => {
  state.drawings = [];
});

// View Mode Toggle
const btnViewMode = document.getElementById("btn-view-mode");
btnViewMode.addEventListener("click", () => {
  state.viewMode = state.viewMode === "oval" ? "closeup" : "oval";
  btnViewMode.textContent = state.viewMode === "oval" ? "View: Full Oval" : "View: Close-Up";
});

// Pointer Dragging & Drawing
function getLogicalPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * OVAL_WIDTH,
    y: ((e.clientY - rect.top) / rect.height) * OVAL_HEIGHT
  };
}

canvas.addEventListener("pointerdown", (e) => {
  const pt = getLogicalPoint(e);

  if (state.tool === "move") {
    let closest = null;
    let minDist = 30;
    for (const r of state.drill.riders) {
      const pos = trackToCanvas(r.s, r.laneOffset, state.viewMode);
      const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
      if (d < minDist) {
        minDist = d;
        closest = r;
      }
    }
    selectRider(closest);
    state.draggingRider = closest;
  } else {
    state.activeDrawing = {
      type: state.tool,
      x1: pt.x,
      y1: pt.y,
      x2: pt.x,
      y2: pt.y,
      color: "#facc15"
    };
    state.drawings.push(state.activeDrawing);
  }
});

canvas.addEventListener("pointermove", (e) => {
  const pt = getLogicalPoint(e);
  if (state.draggingRider) {
    const coords = canvasToTrack(pt.x, pt.y, state.viewMode);
    state.draggingRider.s = coords.s;
    state.draggingRider.laneOffset = coords.laneOffset;
    updateInspector();
  } else if (state.activeDrawing) {
    state.activeDrawing.x2 = pt.x;
    state.activeDrawing.y2 = pt.y;
  }
});

window.addEventListener("pointerup", () => {
  state.draggingRider = null;
  state.activeDrawing = null;
});

// 1. Download Individual PNG Snapshot
document.getElementById("btn-snapshot-png").addEventListener("click", () => {
  const prevSelected = state.selectedRider;
  state.selectedRider = null;
  renderTrack(ctx, state);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `velodrome-snapshot-${Date.now()}.png`;
  a.click();

  state.selectedRider = prevSelected;
});

// 2. Capture Storyboard Frame for GIF
const frameCountEl = document.getElementById("frame-count");
document.getElementById("btn-capture-frame").addEventListener("click", () => {
  const prevSelected = state.selectedRider;
  state.selectedRider = null;
  renderTrack(ctx, state);

  const offscreen = document.createElement("canvas");
  offscreen.width = 700;
  offscreen.height = 400;
  offscreen.getContext("2d").drawImage(canvas, 0, 0, 700, 400);
  state.capturedFrames.push(offscreen);
  frameCountEl.textContent = state.capturedFrames.length;

  state.selectedRider = prevSelected;
});

document.getElementById("btn-clear-frames").addEventListener("click", () => {
  state.capturedFrames = [];
  frameCountEl.textContent = "0";
});

// 3. Export GIF (Uses captured storyboard frames if any exist, or records 4s of live motion)
document.getElementById("btn-export-gif").addEventListener("click", async () => {
  const btn = document.getElementById("btn-export-gif");
  if (typeof GIF === "undefined") {
    alert("GIF library is still loading—please try again in a second.");
    return;
  }

  btn.textContent = "⏳ Building GIF...";
  btn.disabled = true;

  const workerRes = await fetch("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js");
  const workerBlob = new Blob([await workerRes.text()], { type: "application/javascript" });
  const workerUrl = URL.createObjectURL(workerBlob);

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: 700,
    height: 400,
    workerScript: workerUrl
  });

  const prevSelected = state.selectedRider;
  state.selectedRider = null;

  if (state.capturedFrames.length > 0) {
    for (const frameCanvas of state.capturedFrames) {
      gif.addFrame(frameCanvas, { copy: true, delay: 450 });
    }
  } else {
    const wasPlaying = state.playing;
    state.playing = false;
    const offscreen = document.createElement("canvas");
    offscreen.width = 700;
    offscreen.height = 400;
    const offCtx = offscreen.getContext("2d");

    for (let i = 0; i < 40; i++) {
      stepSimulation(state.drill, 0.1, null);
      renderTrack(ctx, state);
      offCtx.drawImage(canvas, 0, 0, 700, 400);
      gif.addFrame(offCtx, { copy: true, delay: 80 });
    }
    state.playing = wasPlaying;
  }

  gif.on("finished", (blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${state.drill.id || "velodrome-drill"}.gif`;
    a.click();
    btn.textContent = "🎬 Export GIF";
    btn.disabled = false;
    state.selectedRider = prevSelected;
  });

  gif.render();
});

// Animation Loop
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.playing) {
    stepSimulation(state.drill, dt, state.draggingRider);
  }

  renderTrack(ctx, state);
  requestAnimationFrame(loop);
}

syncZoneInputs();
requestAnimationFrame(loop);
