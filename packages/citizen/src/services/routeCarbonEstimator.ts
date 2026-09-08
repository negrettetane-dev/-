export type DriveProfile = 'fuel' | 'ev';

export interface DriveImpactEstimate {
  profile: DriveProfile;
  energy: number;
  energyUnit: 'L' | 'kWh';
  co2Grams: number;
  reductionPercent: number;
  label: string;
  assumptions: string;
  dataSource: 'estimated';
}

const FUEL_LITERS_PER_100_KM = 8;
const EV_KWH_PER_100_KM = 16;
const FUEL_CO2_GRAMS_PER_LITER = 2392;
const EV_CO2_GRAMS_PER_KWH = 550;

function congestionFactor(distanceMeters: number, durationSeconds: number): number {
  const distanceKm = distanceMeters / 1000;
  if (distanceKm <= 0 || durationSeconds <= 0) return 1;
  const averageSpeed = distanceKm / (durationSeconds / 3600);
  return Math.min(1.35, Math.max(1, 1 + Math.max(0, 35 - averageSpeed) / 100));
}

export function estimateDriveImpact(
  distanceMeters: number,
  durationSeconds: number,
  profile: DriveProfile,
  baselineCo2Grams?: number,
): DriveImpactEstimate | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }
  const distanceKm = distanceMeters / 1000;
  const adjustedFactor = congestionFactor(distanceMeters, durationSeconds);
  const energy = distanceKm * (profile === 'ev' ? EV_KWH_PER_100_KM : FUEL_LITERS_PER_100_KM) / 100 * adjustedFactor;
  const co2Grams = energy * (profile === 'ev' ? EV_CO2_GRAMS_PER_KWH : FUEL_CO2_GRAMS_PER_LITER);
  const reductionPercent = baselineCo2Grams && baselineCo2Grams > 0
    ? Math.max(0, Math.round((1 - co2Grams / baselineCo2Grams) * 100))
    : 0;

  return {
    profile,
    energy,
    energyUnit: profile === 'ev' ? 'kWh' : 'L',
    co2Grams,
    reductionPercent,
    label: profile === 'ev' ? `预计耗电约 ${energy.toFixed(1)} kWh` : `预计油耗约 ${energy.toFixed(1)} L`,
    assumptions: profile === 'ev'
      ? '按默认平均电耗 16 kWh/100km，并按路线平均速度作估算'
      : '按默认平均油耗 8 L/100km，并按路线平均速度作估算',
    dataSource: 'estimated',
  };
}

export function pickLowerImpactDrive<T extends { route: { distance: number; duration: number } }>(
  candidates: T[],
  profile: DriveProfile,
): T | null {
  const estimates = candidates
    .map(candidate => ({ candidate, estimate: estimateDriveImpact(candidate.route.distance, candidate.route.duration, profile) }))
    .filter((item): item is { candidate: T; estimate: DriveImpactEstimate } => item.estimate !== null);
  return estimates.sort((a, b) => a.estimate.co2Grams - b.estimate.co2Grams || a.candidate.route.duration - b.candidate.route.duration)[0]?.candidate || null;
}
