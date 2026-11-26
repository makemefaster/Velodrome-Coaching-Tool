import { LANES } from "./track.js";

const HELMET_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899"];

export const DRILL_PRESETS = {
  "six-pairs-whistle": {
    id: "six-pairs-whistle",
    name: "⚡ 6 Pairs Whistle Build & Sprint",
    ruleMode: "six-pairs-whistle",
    speeds: { pack: 38, build: 43, sprint: 54, station: 12 },
    riders: buildSixPairs()
  },
  "trains-and-stations": {
    id: "trains-and-stations",
    name: "🚉 Trains & Stations (6 + 3 + 3)",
    ruleMode: "station-catch-peel",
    speeds: { pack: 42, build: 44, sprint: 52, station: 12 },
    riders: buildTrainsAndStations()
  },
  "seans-game": {
    id: "seans-game",
    name: "🎯 Sean's Game (5 Train + 8 High)",
    ruleMode: "banking-pace",
    speeds: { pack: 42, build: 44, sprint: 52, station: 16 },
    riders: buildSeansGame()
  },
  "find-a-friend": {
    id: "find-a-friend",
    name: "🫂 Find a Friend (10 Above Blue)",
    ruleMode: "banking-pace",
    speeds: { pack: 40, build: 42, sprint: 50, station: 20 },
    riders: buildFindAFriend()
  },
  "keirin": {
    id: "keirin",
    name: "🏍️ Keirin Derny Pace",
    ruleMode: "banking-pace",
    speeds: { pack: 45, build: 48, sprint: 62, station: 22 },
    riders: buildKeirin()
  }
};

function buildSixPairs() {
  const riders = [];
  for (let p = 0; p < 6; p++) {
    const s = 0.24 - p * 0.024;
    const color = HELMET_COLORS[p % HELMET_COLORS.length];
    riders.push(
      { id: `p${p}-in`, pairIndex: p, slot: "in", s, laneOffset: LANES.BLACK + 2, speedKmh: 38, jersey: color, helmet: "#f8fafc", label: `P${p + 1}` },
      { id: `p${p}-out`, pairIndex: p, slot: "out", s, laneOffset: LANES.RED + 4, speedKmh: 38, jersey: color, helmet: "#0f172a" }
    );
  }
  return riders;
}

function buildTrainsAndStations() {
  const riders = [];
  // 6-rider train on the black datum line
  for (let i = 0; i < 6; i++) {
    riders.push({
      id: `train-${i}`,
      role: "train",
      s: 0.22 - i * 0.02,
      laneOffset: LANES.BLACK,
      speedKmh: 42,
      jersey: "#0284c7",
      helmet: HELMET_COLORS[i % HELMET_COLORS.length]
    });
  }
  // Station 1 (3 riders above blue line on home straight)
  for (let i = 0; i < 3; i++) {
    riders.push({
      id: `st1-${i}`,
      role: "station",
      s: 0.14 - i * 0.018,
      laneOffset: LANES.BLUE + 26,
      speedKmh: 12,
      jersey: "#f59e0b",
      helmet: "#0f172a"
    });
  }
  // Station 2 (3 riders above blue line on back straight)
  for (let i = 0; i < 3; i++) {
    riders.push({
      id: `st2-${i}`,
      role: "station",
      s: 0.64 - i * 0.018,
      laneOffset: LANES.BLUE + 26,
      speedKmh: 12,
      jersey: "#10b981",
      helmet: "#0f172a"
    });
  }
  return riders;
}

function buildSeansGame() {
  const riders = [];
  for (let i = 0; i < 5; i++) {
    riders.push({
      id: `sean-train-${i}`,
      role: "train",
      s: 0.2 - i * 0.02,
      laneOffset: LANES.BLACK,
      speedKmh: 42,
      jersey: "#0284c7",
      helmet: HELMET_COLORS[i % HELMET_COLORS.length]
    });
  }
  const scatterS = [0.06, 0.18, 0.31, 0.44, 0.57, 0.69, 0.81, 0.92];
  const scatterLane = [72, 110, 84, 122, 76, 115, 90, 105];
  for (let i = 0; i < 8; i++) {
    riders.push({
      id: `sean-high-${i}`,
      role: "high",
      s: scatterS[i],
      laneOffset: scatterLane[i],
      speedKmh: 18,
      jersey: "#e11d48",
      helmet: "#f8fafc"
    });
  }
  return riders;
}

function buildFindAFriend() {
  const riders = [];
  for (let i = 0; i < 10; i++) {
    riders.push({
      id: `faf-${i}`,
      role: "high",
      s: (i * 0.095 + 0.04) % 1,
      laneOffset: LANES.BLUE + 18 + (i % 3) * 28,
      speedKmh: 20,
      jersey: HELMET_COLORS[i % HELMET_COLORS.length],
      helmet: "#f8fafc"
    });
  }
  return riders;
}

function buildKeirin() {
  const riders = [
    { id: "derny", type: "derny", s: 0.25, laneOffset: LANES.RED, speedKmh: 45 }
  ];
  for (let i = 0; i < 4; i++) {
    riders.push({
      id: `keirin-${i}`,
      s: 0.222 - i * 0.022,
      laneOffset: LANES.RED,
      speedKmh: 45,
      jersey: "#0284c7",
      helmet: HELMET_COLORS[i]
    });
  }
  return riders;
}