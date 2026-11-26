import { LANES } from "./track.js";

const JERSEYS = ["#0284c7", "#e11d48", "#16a34a", "#d97706", "#7c3aed", "#0d9488"];
const HELMETS = ["#ef4444", "#f8fafc", "#facc15", "#3b82f6", "#10b981", "#f97316"];

export const DRILL_PRESETS = {
  "trains-and-stations": {
    id: "trains-and-stations",
    name: "🚉 Trains & Stations (6 Train + 2 Stations)",
    zoneSpeeds: { low: 45, mid: 34, high: 24 },
    riders: [
      // 6-rider train on the black datum line
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `train-${i}`,
        s: 0.24 - i * 0.024,
        laneOffset: LANES.BLACK,
        jersey: "#0284c7",
        helmet: HELMETS[i % HELMETS.length],
        useZoneSpeed: true,
        speedKmh: 45
      })),
      // Station 1 (3 riders above blue line)
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `st1-${i}`,
        s: 0.34 - i * 0.024,
        laneOffset: LANES.BLUE + 26,
        jersey: "#d97706",
        helmet: "#f8fafc",
        useZoneSpeed: true,
        speedKmh: 24
      })),
      // Station 2 (3 riders above blue line)
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `st2-${i}`,
        s: 0.78 - i * 0.024,
        laneOffset: LANES.BLUE + 26,
        jersey: "#16a34a",
        helmet: "#f8fafc",
        useZoneSpeed: true,
        speedKmh: 24
      }))
    ]
  },
  "six-pairs": {
    id: "six-pairs",
    name: "⚡ 6 Pairs on Black/Red Lines",
    zoneSpeeds: { low: 40, mid: 34, high: 26 },
    riders: Array.from({ length: 6 }, (_, p) => {
      const s = 0.25 - p * 0.026;
      const jersey = JERSEYS[p % JERSEYS.length];
      return [
        { id: `p${p}-in`, s, laneOffset: LANES.BLACK, jersey, helmet: "#f8fafc", useZoneSpeed: true, speedKmh: 40 },
        { id: `p${p}-out`, s, laneOffset: LANES.RED, jersey, helmet: "#facc15", useZoneSpeed: true, speedKmh: 40 }
      ];
    }).flat()
  },
  "seans-game": {
    id: "seans-game",
    name: "🎯 Sean's Game (5 Train + 8 High)",
    zoneSpeeds: { low: 44, mid: 34, high: 25 },
    riders: [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `st-${i}`,
        s: 0.22 - i * 0.024,
        laneOffset: LANES.BLACK,
        jersey: "#0284c7",
        helmet: HELMETS[i % HELMETS.length],
        useZoneSpeed: true,
        speedKmh: 44
      })),
      ...[0.06, 0.18, 0.31, 0.44, 0.57, 0.69, 0.81, 0.92].map((s, i) => ({
        id: `sh-${i}`,
        s,
        laneOffset: LANES.BLUE + 22 + (i % 3) * 20,
        jersey: "#e11d48",
        helmet: "#f8fafc",
        useZoneSpeed: true,
        speedKmh: 25
      }))
    ]
  },
  "find-a-friend": {
    id: "find-a-friend",
    name: "🫂 Find a Friend (10 Above Blue)",
    zoneSpeeds: { low: 44, mid: 34, high: 26 },
    riders: Array.from({ length: 10 }, (_, i) => ({
      id: `faf-${i}`,
      s: (i * 0.095 + 0.04) % 1,
      laneOffset: LANES.BLUE + 20 + (i % 3) * 24,
      jersey: JERSEYS[i % JERSEYS.length],
      helmet: "#f8fafc",
      useZoneSpeed: true,
      speedKmh: 26
    }))
  },
  "keirin": {
    id: "keirin",
    name: "🏍️ Keirin Derny & 4 Sprinters",
    zoneSpeeds: { low: 48, mid: 38, high: 28 },
    riders: [
      { id: "derny", type: "derny", s: 0.25, laneOffset: LANES.RED, useZoneSpeed: true, speedKmh: 48 },
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `k-${i}`,
        s: 0.22 - i * 0.025,
        laneOffset: LANES.RED,
        jersey: "#0284c7",
        helmet: HELMETS[i],
        useZoneSpeed: true,
        speedKmh: 48
      }))
    ]
  }
};
