import { LANES } from "./track.js";

const TRACK_METERS = 250;

export function createDrillState(preset) {
  return {
    id: preset.id,
    name: preset.name,
    zoneSpeeds: { ...preset.zoneSpeeds },
    riders: JSON.parse(JSON.stringify(preset.riders))
  };
}

/**
 * Returns the speed for a rider based on their current height on the track
 * (unless the coach assigned them a custom individual speed).
 */
export function getRiderSpeed(rider, zoneSpeeds) {
  if (rider.useZoneSpeed === false) {
    return rider.speedKmh;
  }
  if (rider.laneOffset <= LANES.RED + 8) {
    return zoneSpeeds.low;
  }
  if (rider.laneOffset <= LANES.BLUE + 10) {
    return zoneSpeeds.mid;
  }
  return zoneSpeeds.high;
}

/**
 * Advances every rider along their exact current lane height without changing their height.
 */
export function stepSimulation(drill, dt, draggingRider = null) {
  for (const rider of drill.riders) {
    if (rider === draggingRider) continue;

    const speedKmh = getRiderSpeed(rider, drill.zoneSpeeds);
    rider.speedKmh = speedKmh;

    const circumferenceFactor = 1 + (Math.max(0, rider.laneOffset) / 140) * 0.11;
    const metersPerSec = (speedKmh * 1000) / 3600;
    const ds = (metersPerSec * dt) / (TRACK_METERS * circumferenceFactor);
    rider.s = (((rider.s + ds) % 1) + 1) % 1;
  }
}
