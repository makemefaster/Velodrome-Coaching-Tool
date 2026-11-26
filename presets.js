import { LANES } from "./track.js";

const HELMET_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899"];

export const DRILL_PRESETS = {
  "trains-and-stations": {
    id: "trains-and-stations",
    name: "🚉 Trains & Stations (Drop & Peel)",
    ruleMode: "banking-pace",
    speeds: { pack: 44, build: 46, sprint: 54, station: 28 },
    sequence: [
      { time: 2.0, action: "drop-black", count: 2 },
      { time: 6.0, action: "peel-blue", count: 1 }
    ],
    riders: buildTrainsAndStations()
  },
  "six-pairs-whistle": {
    id: "six-pairs-whistle",
    name: "⚡ 6 Pairs Whistle Build & Sprint",
    ruleMode: "six-pairs-whistle",
    speeds: { pack: 38, build: 43, sprint: 54, station: 26 },
    sequence: [
      { time: 1.5, action: "whistle", count: 2 }
    ],
    riders: buildSixPairs()
  },
  "seans-game": {
    id: "seans-game",
    name: "🎯 Sean's Game (5 Train + 8 High)",
    ruleMode: "banking-pace",
    speeds: { pack: 43, build: 45, sprint: 52, station: 28 },
    sequence: [
      { time: 2.5, action: "drop-black", count: 2 },
      { time: 7.0, action: "peel-blue", count: 2 }
    ],
    riders: buildSeansGame()
  },
  "find-a-friend": {
    id: "find-a-friend",
    name: "🫂 Find a Friend (10 Above Blue)",
    ruleMode: "banking-pace",
    speeds: { pack: 42, build: 44, sprint: 50, station: 30 },
    sequence: [],
    riders: buildFindAFriend()
  },
  "keirin": {
    id: "keirin",
    name: "🏍️ Keirin Derny Pace",
    ruleMode: "banking-pace",
    speeds: { pack: 48, build: 50, sprint: 62, station: 30 },
    sequence: [],
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
  for (let i = 0; i < 6; i++) {
    riders.push({
      id: `train-${i}`,
      role: "train",
      s: 0.22 - i * 0.021,
      laneOffset: LANES.BLACK,
      speedKmh: 44,
      jersey: "#0284c7",
      helmet: HELMET_COLORS[i % HELMET_COLORS.length]
    });
  }
  for (let i = 0; i < 3; i++) {
    riders.push({
      id: `st1-${i}`,
      role: "station",
      s: 0.30 - i * 0.021,
      laneOffset: LANES.BLUE + 24,
      speedKmh: 28,
      jersey: "#f59e0b",
      helmet: "#0f172a"
    });
  }
  for (let i = 0; i < 3; i++) {
    riders.push({
      id: `st2-${i}`,
      role: "station",
      s: 0.74 - i * 0.021,
      laneOffset: LANES.BLUE + 24,
      speedKmh: 28,
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
      s: 0.20 - i * 0.021,
      laneOffset: LANES.BLACK,
      speedKmh: 43,
      jersey: "#0284c7",
      helmet: HELMET_COLORS[i % HELMET_COLORS.length]
    });
  }
  const scatterS = [0.28, 0.35, 0.44, 0.57, 0.69, 0.81, 0.92, 0.05];
  const scatterLane = [76, 98, 84, 118, 78, 112, 88, 102];
  for (let i = 0; i < 8; i++) {
    riders.push({
      id: `sean-high-${i}`,
      role: "station",
      s: scatterS[i],
      laneOffset: scatterLane[i],
      speedKmh: 28,
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
      role: "station",
      s: (i * 0.095 + 0.04) % 1,
      laneOffset: LANES.BLUE + 18 + (i % 3) * 26,
      speedKmh: 30,
      jersey: HELMET_COLORS[i % HELMET_COLORS.length],
      helmet: "#f8fafc"
    });
  }
  return riders;
}

function buildKeirin() {
  const riders = [
    { id: "derny", type: "derny", s: 0.25, laneOffset: LANES.RED, speedKmh: 48 }
  ];
  for (let i = 0; i < 4; i++) {
    riders.push({
      id: `keirin-${i}`,
      role: "train",
      s: 0.222 - i * 0.022,
      laneOffset: LANES.RED,
      speedKmh: 48,
      jersey: "#0284c7",
      helmet: HELMET_COLORS[i]
    });
  }
  return riders;
}
