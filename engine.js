import { LANES } from "./track.js";

// 250m Olympic track length in meters
const TRACK_METERS = 250;

export function createDrillState(preset) {
  return {
    id: preset.id,
    name: preset.name,
    ruleMode: preset.ruleMode || "banking-pace",
    speeds: { ...preset.speeds },
    autoBank: true,
    riders: structuredClone(preset.riders),
    whistleState: {
      activePair: 0,
      phase: "steady", // steady | build | sprint | rejoin
      phaseProgress: 0
    }
  };
}

/**
 * Triggered when the coach presses "Blow Whistle" (or W key).
 */
export function triggerWhistle(drill) {
  if (drill.ruleMode !== "six-pairs-whistle") return;

  const ws = drill.whistleState;
  if (ws.phase === "steady") {
    ws.phase = "build";
    ws.phaseProgress = 0;
  } else if (ws.phase === "build") {
    ws.phase = "sprint";
    ws.phaseProgress = 0;
  }
}

/**
 * Advances simulation by `dt` seconds.
 */
export function stepSimulation(drill, dt, draggingRider = null) {
  if (drill.ruleMode === "six-pairs-whistle") {
    stepSixPairsWhistle(drill, dt, draggingRider);
  } else if (drill.ruleMode === "station-catch-peel") {
    stepStationCatchPeel(drill, dt, draggingRider);
  } else {
    stepBankingPace(drill, dt, draggingRider);
  }
}

function advanceRider(rider, speedKmh, dt) {
  // Effective circumference increases ~11% near the top of the banking
  const circumferenceFactor = 1 + (Math.max(0, rider.laneOffset) / 140) * 0.11;
  const metersPerSec = (speedKmh * 1000) / 3600;
  const ds = (metersPerSec * dt) / (TRACK_METERS * circumferenceFactor);
  rider.s = (((rider.s + ds) % 1) + 1) % 1;
}

function stepBankingPace(drill, dt, draggingRider) {
  for (const r of drill.riders) {
    if (r === draggingRider) continue;

    if (drill.autoBank) {
      if (r.laneOffset > LANES.BLUE + 8) {
        r.speedKmh = drill.speeds.station;
      } else {
        r.speedKmh = drill.speeds.pack;
      }
    }
    advanceRider(r, r.speedKmh, dt);
  }
}

function stepStationCatchPeel(drill, dt, draggingRider) {
  const trainRiders = drill.riders.filter((r) => r.role === "train");
  const stationRiders = drill.riders.filter((r) => r.role === "station");

  for (const r of trainRiders) {
    if (r === draggingRider) continue;
    r.laneOffset += (LANES.BLACK - r.laneOffset) * Math.min(1, dt * 4);
    r.speedKmh = drill.speeds.pack;
    advanceRider(r, r.speedKmh, dt);
  }

  const leadTrain = trainRiders[0];
  for (const st of stationRiders) {
    if (st === draggingRider) continue;
    st.speedKmh = drill.speeds.station;
    advanceRider(st, st.speedKmh, dt);

    // If train passes directly underneath a station rider, front rider catches onto train
    if (leadTrain) {
      const dist = ((st.s - leadTrain.s + 1) % 1);
      if (dist > 0.005 && dist < 0.025 && st.laneOffset > LANES.BLUE) {
        st.role = "train";
        trainRiders.unshift(st);
      }
    }
  }
}

function stepSixPairsWhistle(drill, dt, draggingRider) {
  const ws = drill.whistleState;
  const activeRiders = drill.riders.filter((r) => r.pairIndex === ws.activePair);
  const packRiders = drill.riders.filter((r) => r.pairIndex !== ws.activePair);

  // Move main pack steadily on the black/red lines
  for (const r of packRiders) {
    if (r === draggingRider) continue;
    const targetLane = r.slot === "in" ? LANES.BLACK + 2 : LANES.RED + 4;
    r.laneOffset += (targetLane - r.laneOffset) * Math.min(1, dt * 5);
    r.speedKmh = drill.speeds.pack;
    advanceRider(r, r.speedKmh, dt);
  }

  // Move active pair according to current whistle phase
  let targetLaneIn = LANES.BLACK + 2;
  let targetLaneOut = LANES.RED + 4;
  let targetSpeed = drill.speeds.pack;

  if (ws.phase === "build") {
    targetLaneIn = LANES.BLUE + 22;
    targetLaneOut = LANES.BLUE + 40;
    targetSpeed = drill.speeds.build;
  } else if (ws.phase === "sprint") {
    targetLaneIn = LANES.BLACK + 2;
    targetLaneOut = LANES.RED + 4;
    targetSpeed = drill.speeds.sprint;
  } else if (ws.phase === "rejoin") {
    targetLaneIn = LANES.BLUE + 28;
    targetLaneOut = LANES.BLUE + 44;
    targetSpeed = Math.max(18, drill.speeds.pack - 14);
  }

  for (const r of activeRiders) {
    if (r === draggingRider) continue;
    const targetLane = r.slot === "in" ? targetLaneIn : targetLaneOut;
    r.laneOffset += (targetLane - r.laneOffset) * Math.min(1, dt * 4);
    r.speedKmh = targetSpeed;

    const prevS = r.s;
    advanceRider(r, r.speedKmh, dt);
    if (r.slot === "in") {
      const deltaS = ((r.s - prevS + 1) % 1);
      ws.phaseProgress += deltaS;
    }
  }

  // Automatic lap transitions
  if (ws.phase === "build" && ws.phaseProgress >= 1.0) {
    // Auto-trigger Whistle 2 after 1 full build lap if coach hasn't clicked manually
    ws.phase = "sprint";
    ws.phaseProgress = 0;
  } else if (ws.phase === "sprint" && ws.phaseProgress >= 1.0) {
    // Swing high after finishing the 1-lap sprint
    ws.phase = "rejoin";
    ws.phaseProgress = 0;
  } else if (ws.phase === "rejoin") {
    // Check when the back of the pack catches up underneath the high pair
    const leadActive = activeRiders[0];
    const tailPack = packRiders.reduce((minR, r) => (r.s < minR.s ? r : minR), packRiders[0]);
    if (leadActive && tailPack) {
      const gap = ((leadActive.s - tailPack.s + 1) % 1);
      if (gap > 0.96 || gap < 0.025) {
        ws.phase = "steady";
        ws.phaseProgress = 0;
        ws.activePair = (ws.activePair + 1) % 6;
      }
    }
  }
}

/**
 * Returns live telemetry strings for the Track Display HUD.
 */
export function getHudTelemetry(drill) {
  if (drill.ruleMode === "six-pairs-whistle") {
    const ws = drill.whistleState;
    const labels = {
      steady: "Steady Pack (38 km/h)",
      build: `Whistle 1: Pair ${ws.activePair + 1} High Build Lap`,
      sprint: `Whistle 2: Pair ${ws.activePair + 1} Full Sprint Lap`,
      rejoin: `Pair ${ws.activePair + 1} Swinging High to Rejoin`
    };
    const active = drill.riders.find((r) => r.pairIndex === ws.activePair && r.slot === "in");
    const nextPair = drill.riders.find((r) => r.pairIndex === (ws.activePair + 1) % 6 && r.slot === "in");
    let gapMeters = 0;
    if (active && nextPair) {
      let diff = active.s - nextPair.s;
      if (diff > 0.5) diff -= 1;
      if (diff < -0.5) diff += 1;
      gapMeters = diff * TRACK_METERS;
    }
    return {
      phase: labels[ws.phase],
      gap: `Gap: ${gapMeters >= 0 ? "+" : ""}${gapMeters.toFixed(1)}m`
    };
  }

  return {
    phase: "Live Banking Physics",
    gap: `${drill.riders.length} Riders`
  };
}