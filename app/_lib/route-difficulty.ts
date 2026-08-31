import type { RouteDemandAnalysis } from "./route-demand";
import type { MonthlySurfaceCondition } from "./surface";
import type { WeatherIndices } from "./weather";

export const ROUTE_DIFFICULTY_MODEL_VERSION = "route-difficulty-v0.2" as const;

export type RouteDifficultyBand = "lower" | "moderate" | "high" | "extreme";

export type ComprehensiveRouteDifficulty = {
  modelVersion: typeof ROUTE_DIFFICULTY_MODEL_VERSION;
  status: "estimated" | "weather-only";
  score: number;
  baseScore: number;
  surfaceAdjustment: number;
  weatherAdjustment: number;
  band: RouteDifficultyBand;
  components: {
    endurance: number;
    terrain: number;
    aerobic: number;
    altitude: number;
    carriedLoad: number;
    surface: number;
    weather: number;
  };
  surface: {
    terrainFactor: number;
    mappedCoveragePct: number;
  };
  altitude: {
    meanElevationM: number;
    highestElevationM: number;
    acuteAvailabilityPct: number;
    performanceLossPct: number;
    distanceAbove2500Pct: number;
    distanceAbove3000Pct: number;
    distanceAbove4000Pct: number;
  };
};

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function score(value: number) {
  return Math.round(clamp(value, 0, 100));
}

function ramp(value: number, start: number, end: number) {
  return clamp((value - start) / Math.max(end - start, Number.EPSILON), 0, 1);
}

export function routeDifficultyBand(value: number): RouteDifficultyBand {
  if (value >= 80) return "extreme";
  if (value >= 60) return "high";
  if (value >= 40) return "moderate";
  return "lower";
}

/**
 * Track4Trek planning index. The intrinsic route score is a transparent
 * engineering calibration, not a clinical scale. Mapped surface consumes a
 * bounded share of remaining intrinsic headroom before weather consumes up to
 * half of what remains, so neither can erase the distance, terrain, load and
 * altitude already present in the GPX plan.
 */
export function calculateComprehensiveRouteDifficulty(
  analysis: RouteDemandAnalysis | null,
  weather: WeatherIndices,
  surface: MonthlySurfaceCondition | null = null,
): ComprehensiveRouteDifficulty {
  const weatherScore = score(weather.difficulty);
  const surfaceScore = surface?.source === "openstreetmap"
    ? score(surface.difficultyScore)
    : 0;

  if (!analysis || analysis.status !== "estimated") {
    return {
      modelVersion: ROUTE_DIFFICULTY_MODEL_VERSION,
      status: "weather-only",
      score: weatherScore,
      baseScore: 0,
      surfaceAdjustment: 0,
      weatherAdjustment: weatherScore,
      band: routeDifficultyBand(weatherScore),
      components: {
        endurance: 0,
        terrain: 0,
        aerobic: 0,
        altitude: 0,
        carriedLoad: 0,
        surface: surfaceScore,
        weather: weatherScore,
      },
      surface: {
        terrainFactor: surface?.terrainFactor ?? 1,
        mappedCoveragePct: surface?.mappedCoveragePct ?? 0,
      },
      altitude: {
        meanElevationM: 0,
        highestElevationM: 0,
        acuteAvailabilityPct: 100,
        performanceLossPct: 0,
        distanceAbove2500Pct: 0,
        distanceAbove3000Pct: 0,
        distanceAbove4000Pct: 0,
      },
    };
  }

  const terrain = score(analysis.features.hillSeverity * 100);
  const endurance = score(analysis.features.enduranceSeverity * 100);
  const aerobicCenter = analysis.metrics.vo2Max.center;
  const aerobic = score(ramp(aerobicCenter, 18, 65) * 100);
  const altitude = score(analysis.features.altitudeSeverity * 100);
  const carriedLoad = score(ramp(analysis.features.packRatio, 0, 0.3) * 100);

  const baseWithoutSurface = score(
    endurance * 0.3 +
    terrain * 0.24 +
    aerobic * 0.18 +
    altitude * 0.18 +
    carriedLoad * 0.1,
  );
  const baseScore = score(
    100 * (1 - (1 - baseWithoutSurface / 100) * (1 - 0.16 * surfaceScore / 100)),
  );
  const combined = score(
    100 * (1 - (1 - baseScore / 100) * (1 - 0.5 * weatherScore / 100)),
  );

  return {
    modelVersion: ROUTE_DIFFICULTY_MODEL_VERSION,
    status: "estimated",
    score: combined,
    baseScore,
    surfaceAdjustment: baseScore - baseWithoutSurface,
    weatherAdjustment: combined - baseScore,
    band: routeDifficultyBand(combined),
    components: {
      endurance,
      terrain,
      aerobic,
      altitude,
      carriedLoad,
      surface: surfaceScore,
      weather: weatherScore,
    },
    surface: {
      terrainFactor: surface?.terrainFactor ?? 1,
      mappedCoveragePct: surface?.mappedCoveragePct ?? 0,
    },
    altitude: {
      meanElevationM: analysis.features.meanElevationM,
      highestElevationM: analysis.features.highestElevationM,
      acuteAvailabilityPct: Math.round(
        analysis.features.acuteAltitudeAvailability * 1000,
      ) / 10,
      performanceLossPct: analysis.features.altitudePerformanceLossPct,
      distanceAbove2500Pct: analysis.features.distanceAbove2500Pct,
      distanceAbove3000Pct: analysis.features.distanceAbove3000Pct,
      distanceAbove4000Pct: analysis.features.distanceAbove4000Pct,
    },
  };
}
