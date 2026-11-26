import { OVAL_WIDTH, OVAL_HEIGHT, LANES, trackToCanvas, canvasToTrack, renderTrack } from "./track.js";
import { DRILL_PRESETS } from "./presets.js";
import {
  createDrillState,
  commandDropToBlack,
  commandPeelToBlue,
  triggerWhistle,
  stepSimulation,
  getHudTelemetry
} from "./engine.js";

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
  activeDrawing: null
};

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
  state.selectedRider = null;
  syncStudioInputs();
}

presetSelect.addEventListener("change", (e) => loadPreset(e.target.value));
document.getElementById("btn-reset").addEventListener("click", () => loadPreset(presetSelect.value));

// Tab Switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "studio-view") {
      syncStudioInputs();
    }
  });
});

// Play / Pause & Whistle
const btnPlay = document.getElementById("btn-play");
function togglePlay() {
  state.playing = !state.playing;
  btnPlay.textContent = state.playing ? "⏸ Pause" : "▶ Play";
}
btnPlay.addEventListener("click", togglePlay);

document.getElementById("btn-whistle").addEventListener("click", () => {
  if (!state.playing) togglePlay();
  triggerWhistle(state.drill);
});

// Drop to Black & Peel to Blue Controls
const transferCountEl = document.getElementById("transfer-count");
document.getElementById("btn-drop-black").addEventListener("click", () => {
  if (!state.playing) togglePlay();
  commandDropToBlack(state.drill, Number(transferCountEl.value));
});

document.getElementById("btn-peel-blue").addEventListener("click", () => {
  if (!state.playing) togglePlay();
  commandPeelToBlue(state.drill, Number(transferCountEl.value));
});

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.key.toLowerCase() === "w") {
    if (!state.playing) togglePlay();
    triggerWhistle(state.drill);
  }
});

// Tool Buttons
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

// View Toggle
const btnViewMode = document.getElementById("btn-view-mode");
btnViewMode.addEventListener("click", () => {
  state.viewMode = state.viewMode === "oval" ? "closeup" : "oval";
  btnViewMode.textContent = state.viewMode === "oval" ? "View: Full Oval" : "View: Close-Up";
});

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
    let minDist = 28;
    for (const r of state.drill.riders) {
      const pos = trackToCanvas(r.s, r.laneOffset, state.viewMode);
      const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
      if (d < minDist) {
        minDist = d;
        closest = r;
      }
    }
    state.selectedRider = closest;
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
    const trackCoords = canvasToTrack(pt.x, pt.y, state.viewMode);
    state.draggingRider.s = trackCoords.s;
    state.draggingRider.laneOffset = trackCoords.laneOffset;
    state.draggingRider.targetLane = trackCoords.laneOffset;
  } else if (state.activeDrawing) {
    state.activeDrawing.x2 = pt.x;
    state.activeDrawing.y2 = pt.y;
  }
});

window.addEventListener("pointerup", () => {
  state.draggingRider = null;
  state.activeDrawing = null;
});

// Pre-Programmed Sequence List & Studio Sync
function renderSequenceList() {
  const listEl = document.getElementById("sequence-list");
  listEl.innerHTML = "";
  const seq = state.drill.sequence || [];
  if (seq.length === 0) {
    listEl.innerHTML = `<li style="color:#94a3b8;font-weight:400">No programmed moves yet. Add a timed step above.</li>`;
    return;
  }

  seq.sort((a, b) => a.time - b.time);
  seq.forEach((step, idx) => {
    const li = document.createElement("li");
    if (step.fired) li.classList.add("fired");
    const labelMap = {
      "drop-black": `⬇ Drop ${step.count} rider${step.count > 1 ? "s" : ""} to Black`,
      "peel-blue": `⬆ Peel ${step.count} rider${step.count > 1 ? "s" : ""} to Blue`,
      "whistle": `📣 Blow Whistle`
    };
    li.innerHTML = `<span><strong>${step.time.toFixed(1)}s</strong> — ${labelMap[step.action] || step.action}</span>`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.title = "Remove step";
    delBtn.addEventListener("click", () => {
      state.drill.sequence.splice(idx, 1);
      syncStudioInputs();
    });
    li.appendChild(delBtn);
    listEl.appendChild(li);
  });
}

function syncStudioInputs() {
  const s = state.drill.speeds;
  document.getElementById("input-pack-speed").value = s.pack;
  document.getElementById("val-pack-speed").textContent = s.pack;
  document.getElementById("input-build-speed").value = s.build;
  document.getElementById("val-build-speed").textContent = s.build;
  document.getElementById("input-sprint-speed").value = s.sprint;
  document.getElementById("val-sprint-speed").textContent = s.sprint;
  document.getElementById("input-station-speed").value = s.station;
  document.getElementById("val-station-speed").textContent = s.station;
  document.getElementById("chk-auto-bank").checked = state.drill.autoBank;
  renderSequenceList();
  document.getElementById("json-editor").value = JSON.stringify(state.drill, null, 2);
}

["pack", "build", "sprint", "station"].forEach((key) => {
  const input = document.getElementById(`input-${key}-speed`);
  const label = document.getElementById(`val-${key}-speed`);
  input.addEventListener("input", () => {
    const val = Number(input.value);
    label.textContent = val;
    state.drill.speeds[key] = val;
    document.getElementById("json-editor").value = JSON.stringify(state.drill, null, 2);
  });
});

document.getElementById("chk-auto-bank").addEventListener("change", (e) => {
  state.drill.autoBank = e.target.checked;
});

document.getElementById("btn-add-step").addEventListener("click", () => {
  const time = Math.max(0, Number(document.getElementById("seq-time").value) || 0);
  const action = document.getElementById("seq-action").value;
  const count = Number(document.getElementById("seq-count").value) || 1;
  state.drill.sequence.push({ time, action, count, fired: false });
  syncStudioInputs();
});

document.getElementById("btn-clear-seq").addEventListener("click", () => {
  state.drill.sequence = [];
  syncStudioInputs();
});

document.getElementById("btn-add-rider").addEventListener("click", () => {
  state.drill.riders.push({
    id: `custom-${Date.now()}`,
    role: "train",
    s: 0.25,
    laneOffset: LANES.BLACK,
    speedKmh: state.drill.speeds.pack,
    jersey: "#ec4899",
    helmet: "#f8fafc"
  });
  syncStudioInputs();
});

document.getElementById("btn-add-derny").addEventListener("click", () => {
  state.drill.riders.push({
    id: `derny-${Date.now()}`,
    type: "derny",
    s: 0.28,
    laneOffset: LANES.RED,
    speedKmh: state.drill.speeds.pack
  });
  syncStudioInputs();
});

document.getElementById("btn-apply-json").addEventListener("click", () => {
  const status = document.getElementById("json-status");
  try {
    const parsed = JSON.parse(document.getElementById("json-editor").value);
    state.drill = parsed;
    renderSequenceList();
    status.textContent = "✓ Drill & sequence applied to Track Display Board.";
    status.style.color = "#10b981";
  } catch (err) {
    status.textContent = `✗ Invalid JSON: ${err.message}`;
    status.style.color = "#ef4444";
  }
});

document.getElementById("btn-download-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.drill, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.drill.id || "velodrome-drill"}.json`;
  a.click();
});

document.getElementById("file-import-json").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById("json-editor").value = reader.result;
    document.getElementById("btn-apply-json").click();
  };
  reader.readAsText(file);
});

// GIF Export (Captures 5 seconds of your programmed sequence & live track motion)
document.getElementById("btn-export-gif").addEventListener("click", async () => {
  const btn = document.getElementById("btn-export-gif");
  if (typeof GIF === "undefined") {
    alert("GIF encoder library is still loading. Try again in a moment.");
    return;
  }

  btn.textContent = "⏳ Recording...";
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

  const offscreen = document.createElement("canvas");
  offscreen.width = 700;
  offscreen.height = 400;
  const offCtx = offscreen.getContext("2d");

  const wasPlaying = state.playing;
  state.playing = false;

  for (let i = 0; i < 50; i++) {
    stepSimulation(state.drill, 0.1, null);
    renderTrack(ctx, state);
    offCtx.drawImage(canvas, 0, 0, 700, 400);
    gif.addFrame(offCtx, { copy: true, delay: 80 });
  }

  gif.on("finished", (blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${state.drill.id || "velodrome-session"}.gif`;
    a.click();
    btn.textContent = "🎬 GIF";
    btn.disabled = false;
    state.playing = wasPlaying;
  });

  gif.render();
});

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.playing) {
    stepSimulation(state.drill, dt, state.draggingRider);
  }

  renderTrack(ctx, state);

  const hud = getHudTelemetry(state.drill);
  document.getElementById("hud-drill-name").textContent = state.drill.name;
  document.getElementById("hud-phase").textContent = hud.phase;
  document.getElementById("hud-gap").textContent = hud.gap;

  requestAnimationFrame(loop);
}

syncStudioInputs();
requestAnimationFrame(loop);
