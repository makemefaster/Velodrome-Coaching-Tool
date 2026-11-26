import { LANES } from "./track.js";

const TRACK_METERS = 250;
// Clean 1-bike-length spacing (~5.2 meters = 0.021 of a 250m lap) so riders never overlap
const MIN_BIKE_GAP_S = 0.021;

export function createDrillState(preset) {
  return {
    id: preset.id,
    name: preset.name,
    ruleMode: preset.ruleMode || "banking-pace",
    speeds: { ...preset.speeds },
    autoBank: true,
    elapsedTime: 0,
    lastEventText: "Ready",
    sequence: JSON.parse(JSON.stringify(preset.sequence || [])).map((step) => ({
      ...step,
      fired: false
    })),
    riders: JSON.parse(JSON.stringify(preset.riders)),
    whistleState: {
      activePair: 0,
      phase: "steady",
      phaseProgress: 0
    }
  };
}

/**
 * Commands `count` riders from above the blue line to drop down and join the black paceline cleanly.
 */
export function commandDropToBlack(drill, count = 1) {
  const highRiders = drill.riders.filter(
    (r) => r.type !== "derny" && (r.targetLane ?? r.laneOffset) > LANES.BLUE * 0.65
  );
  if (highRiders.length === 0) return;

  // Pick the `count` riders closest ahead of the main black-line train (or frontmost high riders)
  const trainRiders = drill.riders.filter(
    (r) => r.type !== "derny" && (r.targetLane ?? r.laneOffset) <= LANES.BLUE * 0.65
  );

  if (trainRiders.length > 0) {
    const leadS = trainRiders[0].s;
    highRiders.sort((a, b) => ((a.s - leadS + 1) % 1) - ((b.s - leadS + 1) % 1));
  }

  const chosen = highRiders.slice(0, count);
  for (const r of chosen) {
    r.targetLane = LANES.BLACK;
    r.role = "train";
  }
  drill.lastEventText = `⬇ Dropped ${chosen.length} rider${chosen.length > 1 ? "s" : ""} to Black`;
}

/**
 * Commands `count` front riders on the black paceline to peel up above the blue stayer's line.
 */
export function commandPeelToBlue(drill, count = 1) {
  const lowRiders = drill.riders.filter(
    (r) => r.type !== "derny" && (r.targetLane ?? r.laneOffset) <= LANES.BLUE * 0.65
  );
  if (lowRiders.length === 0) return;

  // Find the front-most riders in the black-line paceline (taking wrap-around 0..1 into account)
  const ordered = sortPacelineOrder(lowRiders);
  const chosen = ordered.slice(0, count);

  chosen.forEach((r, idx) => {
    r.targetLane = LANES.BLUE + 24 + (idx % 2) * 14;
    r.role = "station";
  });
  drill.lastEventText = `⬆ Peeled ${chosen.length} rider${chosen.length > 1 ? "s" : ""} to Blue`;
}

export function triggerWhistle(drill) {
  if (drill.ruleMode !== "six-pairs-whistle") {
    drill.lastEventText = "📣 Whistle Blown";
    return;
  }

  const ws = drill.whistleState;
  if (ws.phase === "steady") {
    ws.phase = "build";
    ws.phaseProgress = 0;
  } else if (ws.phase === "build") {
    ws.phase = "sprint";
    ws.phaseProgress = 0;
  }
}

export function stepSimulation(drill, dt, draggingRider = null) {
  drill.elapsedTime += dt;

  // Execute any pre-programmed sequence moves whose trigger time has arrived
  if (Array.isArray(drill.sequence)) {
    for (const step of drill.sequence) {
      if (!step.fired && drill.elapsedTime >= step.time) {
        step.fired = true;
        if (step.action === "drop-black") {
          commandDropToBlack(drill, step.count || 1);
        } else if (step.action === "peel-blue") {
          commandPeelToBlue(drill, step.count || 1);
        } else if (step.action === "whistle") {
          triggerWhistle(drill);
        }
      }
    }
  }

  if (drill.ruleMode === "six-pairs-whistle") {
    stepSixPairsWhistle(drill, dt, draggingRider);
  } else {
    stepBankingPaceWithCleanSpacing(drill, dt, draggingRider);
  }
}

function advanceRider(rider, speedKmh, dt) {
  const circumferenceFactor = 1 + (Math.max(0, rider.laneOffset) / 140) * 0.11;
  const metersPerSec = (speedKmh * 1000) / 3600;
  const ds = (metersPerSec * dt) / (TRACK_METERS * circumferenceFactor);
  rider.s = (((rider.s + ds) % 1) + 1) % 1;
}

/**
 * Orders riders from front-to-back along the counter-clockwise track (handling 0/1 wrap-around).
 */
function sortPacelineOrder(riders) {
  if (riders.length <= 1) return [...riders];
  const sorted = [...riders].sort((a, b) => b.s - a.s);
  // Find largest gap around the oval; the rider immediately after the largest gap is the true leader
  let maxGap = -1;
  let leaderIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[(i - 1 + sorted.length) % sorted.length];
    const curr = sorted[i];
    const gap = (prev.s - curr.s + 1) % 1;
    if (gap > maxGap) {
      maxGap = gap;
      leaderIdx = i;
    }
  }
  return [...sorted.slice(leaderIdx), ...sorted.slice(0, leaderIdx)];
}

/**
 * Smoothly moves riders toward their target lanes and enforces clean single-file wheel spacing
 * so riders dropping onto the black line slot behind or in front cleanly without overlapping.
 */
function stepBankingPaceWithCleanSpacing(drill, dt, draggingRider) {
  // 1. Smoothly transition lateral lane height & advance along track
  for (const r of drill.riders) {
    if (r === draggingRider) {
      r.targetLane = r.laneOffset;
      continue;
    }

    if (typeof r.targetLane === "number") {
      r.laneOffset += (r.targetLane - r.laneOffset) * Math.min(1, dt * 3.8);
      if (Math.abs(r.targetLane - r.laneOffset) < 0.4) {
        r.laneOffset = r.targetLane;
      }
    }

    if (drill.autoBank) {
      // Blend speed smoothly based on height between black line and blue stayer's line
      const blend = Math.max(0, Math.min(1, r.laneOffset / (LANES.BLUE + 14)));
      r.speedKmh = drill.speeds.pack * (1 - blend) + drill.speeds.station * blend;
    }

    advanceRider(r, r.speedKmh, dt);
  }

  // 2. Enforce clean wheel-to-wheel spacing on the lower paceline (below blue line)
  const lowLaneRiders = drill.riders.filter(
    (r) => r !== draggingRider && r.laneOffset <= LANES.BLUE * 0.65
  );
  enforceLineSpacing(lowLaneRiders);

  // 3. Enforce clean spacing among station riders up above the blue line
  const highLaneRiders = drill.riders.filter(
    (r) => r !== draggingRider && r.laneOffset > LANES.BLUE * 0.65
  );
  enforceLineSpacing(highLaneRiders);
}

function enforceLineSpacing(group) {
  if (group.length <= 1) return;
  const ordered = sortPacelineOrder(group);
  for (let i = 1; i < ordered.length; i++) {
    const ahead = ordered[i - 1];
    const behind = ordered[i];
    const gap = (ahead.s - behind.s + 1) % 1;
    // If rider behind is closer than 1 bike length (or slightly ahead due to lane drop), slot them cleanly behind
    if (gap < MIN_BIKE_GAP_S || gap > 0.92) {
      behind.s = (ahead.s - MIN_BIKE_GAP_S + 1) % 1;
    }
  }
}

function stepSixPairsWhistle(drill, dt, draggingRider) {
  const ws = drill.whistleState;
  const activeRiders = drill.riders.filter((r) => r.pairIndex === ws.activePair);
  const packRiders = drill.riders.filter((r) => r.pairIndex !== ws.activePair);

  for (const r of packRiders) {
    if (r === draggingRider) continue;
    const targetLane = r.slot === "in" ? LANES.BLACK + 2 : LANES.RED + 4;
    r.laneOffset += (targetLane - r.laneOffset) * Math.min(1, dt * 5);
    r.speedKmh = drill.speeds.pack;
    advanceRider(r, r.speedKmh, dt);
  }

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
    targetSpeed = Math.max(25, drill.speeds.pack - 12);
  }

  for (const r of activeRiders) {
    if (r === draggingRider) continue;
    const targetLane = r.slot === "in" ? targetLaneIn : targetLaneOut;
    r.laneOffset += (targetLane - r.laneOffset) * Math.min(1, dt * 4);
    r.speedKmh = targetSpeed;

    const prevS = r.s;
    advanceRider(r, r.speedKmh, dt);
    if (r.slot === "in") {
      const deltaS = (r.s - prevS + 1) % 1;
      ws.phaseProgress += deltaS;
    }
  }

  if (ws.phase === "build" && ws.phaseProgress >= 1.0) {
    ws.phase = "sprint";
    ws.phaseProgress = 0;
  } else if (ws.phase === "sprint" && ws.phaseProgress >= 1.0) {
    ws.phase = "rejoin";
    ws.phaseProgress = 0;
  } else if (ws.phase === "rejoin") {
    const leadActive = activeRiders[0];
    const tailPack = packRiders.reduce((minR, r) => (r.s < minR.s ? r : minR), packRiders[0]);
    if (leadActive && tailPack) {
      const gap = (leadActive.s - tailPack.s + 1) % 1;
      if (gap > 0.96 || gap < 0.025) {
        ws.phase = "steady";
        ws.phaseProgress = 0;
        ws.activePair = (ws.activePair + 1) % 6;
      }
    }
  }
}

export function getHudTelemetry(drill) {
  if (drill.ruleMode === "six-pairs-whistle") {
    const ws = drill.whistleState;
    const labels = {
      steady: `Steady Pack (${drill.speeds.pack} km/h)`,
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
    phase: drill.lastEventText || "Live Banking Physics",
    gap: `${drill.elapsedTime.toFixed(1)}s`
  };
}
