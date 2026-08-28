"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

const MONTHS = [
  { short: "Jan", name: "January", score: 34 },
  { short: "Feb", name: "February", score: 38 },
  { short: "Mar", name: "March", score: 49 },
  { short: "Apr", name: "April", score: 60 },
  { short: "May", name: "May", score: 72 },
  { short: "Jun", name: "June", score: 85 },
  { short: "Jul", name: "July", score: 92 },
  { short: "Aug", name: "August", score: 90 },
  { short: "Sep", name: "September", score: 78 },
  { short: "Oct", name: "October", score: 54 },
  { short: "Nov", name: "November", score: 39 },
  { short: "Dec", name: "December", score: 32 },
] as const;

const WEATHER_SERIES = {
  heat: [16, 18, 30, 48, 72, 88, 96, 94, 82, 52, 28, 18],
  snow: [78, 70, 42, 12, 2, 0, 0, 0, 2, 8, 38, 68],
  storm: [22, 25, 35, 48, 68, 85, 78, 88, 80, 48, 30, 25],
  precipitation: [28, 34, 48, 62, 78, 92, 82, 88, 74, 46, 31, 25],
  visibility: [82, 78, 68, 58, 44, 34, 48, 40, 52, 76, 86, 84],
  dayTemperature: [8, 10, 14, 18, 22, 25, 28, 27, 24, 19, 14, 10],
  nightTemperature: [1, 2, 6, 10, 15, 19, 22, 21, 18, 12, 6, 2],
  snowfall: [24, 18, 8, 1, 0, 0, 0, 0, 0, 0, 6, 19],
  snowChance: [62, 55, 32, 8, 1, 0, 0, 0, 1, 3, 24, 52],
  stormLevel: [2, 2, 3, 3, 4, 5, 5, 5, 4, 3, 2, 2],
  stormChance: [14, 16, 24, 35, 52, 68, 61, 72, 59, 32, 18, 15],
  rainMillimeters: [48, 55, 82, 118, 165, 228, 190, 215, 152, 84, 52, 42],
  visibilityDistance: [18, 17, 14, 11, 8, 6, 9, 7, 10, 16, 20, 19],
  trailVisibilityChance: [86, 84, 76, 68, 56, 45, 62, 51, 66, 82, 90, 88],
} as const;

function difficultyBand(score: number) {
  if (score >= 80) return "Extreme";
  if (score >= 60) return "High";
  if (score >= 40) return "Moderate";
  return "Lower";
}

function pointColor(score: number) {
  if (score >= 80) return "#ff625e";
  if (score >= 60) return "#ffb04f";
  if (score >= 40) return "#61c9e8";
  return "#62d28b";
}

type WeatherIndexWheelProps = {
  label: string;
  value: number;
  color: string;
  primary: string;
  secondary: string;
};

function WeatherIndexWheel({ label, value, color, primary, secondary }: WeatherIndexWheelProps) {
  const style = {
    "--weather-index-angle": `${value * 2.7}deg`,
    "--weather-index-color": color,
  } as CSSProperties;

  return (
    <div className="weather-index" aria-label={`${label}: ${value} out of 100`}>
      <div className="weather-index-wheel" style={style} aria-hidden="true">
        <div>
          <strong>{value}</strong>
          <span>/100</span>
        </div>
      </div>
      <span>{label}</span>
      <div className="weather-index-detail">
        <strong>{primary}</strong>
        <span>{secondary}</span>
      </div>
    </div>
  );
}

export function WeatherDifficultyChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(9);
  const [committedIndex, setCommittedIndex] = useState(9);
  const [isDragging, setIsDragging] = useState(false);
  const selected = MONTHS[selectedIndex];
  const committed = MONTHS[committedIndex];
  const weatherIndexes = [
    {
      label: "Difficulty",
      value: selected.score,
      color: pointColor(selected.score),
      primary: difficultyBand(selected.score),
      secondary: "combined route stress",
    },
    {
      label: "Heat",
      value: WEATHER_SERIES.heat[selectedIndex],
      color: "#ff6c4f",
      primary: `${WEATHER_SERIES.dayTemperature[selectedIndex]}°C day`,
      secondary: `${WEATHER_SERIES.nightTemperature[selectedIndex]}°C night`,
    },
    {
      label: "Snow",
      value: WEATHER_SERIES.snow[selectedIndex],
      color: "#79c7ff",
      primary: `${WEATHER_SERIES.snowfall[selectedIndex]} cm snowfall`,
      secondary: `${WEATHER_SERIES.snowChance[selectedIndex]}% likelihood`,
    },
    {
      label: "Storm",
      value: WEATHER_SERIES.storm[selectedIndex],
      color: "#b687ff",
      primary: `Level ${WEATHER_SERIES.stormLevel[selectedIndex]} maximum`,
      secondary: `${WEATHER_SERIES.stormChance[selectedIndex]}% likelihood`,
    },
    {
      label: "Rain",
      value: WEATHER_SERIES.precipitation[selectedIndex],
      color: "#45c8e8",
      primary: `${WEATHER_SERIES.rainMillimeters[selectedIndex]} mm`,
      secondary: "monthly estimate",
    },
    {
      label: "Visibility",
      value: WEATHER_SERIES.visibility[selectedIndex],
      color: "#63d58a",
      primary: `${WEATHER_SERIES.visibilityDistance[selectedIndex]} km visible`,
      secondary: `${WEATHER_SERIES.trailVisibilityChance[selectedIndex]}% trail remains visible`,
    },
  ];

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * density);
    canvas.height = Math.round(bounds.height * density);

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    const left = 18;
    const right = bounds.width - 18;
    const top = 18;
    const bottom = bounds.height - 18;
    const plotWidth = right - left;
    const plotHeight = bottom - top;
    const points = MONTHS.map((month, index) => ({
      x: left + (index / (MONTHS.length - 1)) * plotWidth,
      y: top + ((100 - month.score) / 100) * plotHeight,
    }));

    context.lineWidth = 1;
    for (let step = 0; step <= 4; step += 1) {
      const y = top + (step / 4) * plotHeight;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.strokeStyle = "rgba(207, 229, 248, 0.13)";
      context.stroke();
    }

    const traceCurve = () => {
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 0; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        const controlX = (current.x + next.x) / 2;
        context.bezierCurveTo(controlX, current.y, controlX, next.y, next.x, next.y);
      }
    };

    traceCurve();
    context.lineTo(points[points.length - 1].x, bottom);
    context.lineTo(points[0].x, bottom);
    context.closePath();
    const area = context.createLinearGradient(0, top, 0, bottom);
    area.addColorStop(0, "rgba(255, 103, 84, 0.38)");
    area.addColorStop(0.52, "rgba(63, 165, 225, 0.18)");
    area.addColorStop(1, "rgba(39, 127, 185, 0.015)");
    context.fillStyle = area;
    context.fill();

    traceCurve();
    const line = context.createLinearGradient(left, 0, right, 0);
    line.addColorStop(0, "#62d28b");
    line.addColorStop(0.38, "#67c8e8");
    line.addColorStop(0.62, "#ffb04f");
    line.addColorStop(0.82, "#ff625e");
    line.addColorStop(1, "#62d28b");
    context.strokeStyle = line;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();

    points.forEach((point, index) => {
      context.beginPath();
      context.arc(point.x, point.y, index === selectedIndex ? 0 : 3, 0, Math.PI * 2);
      context.fillStyle = pointColor(MONTHS[index].score);
      context.fill();
    });

    const activePoint = points[selectedIndex];
    context.beginPath();
    context.moveTo(activePoint.x, top);
    context.lineTo(activePoint.x, bottom);
    context.strokeStyle = "rgba(235, 246, 255, 0.52)";
    context.lineWidth = 1;
    context.setLineDash([5, 7]);
    context.stroke();
    context.setLineDash([]);

    context.beginPath();
    context.arc(activePoint.x, activePoint.y, 14, 0, Math.PI * 2);
    context.fillStyle = "rgba(3, 12, 22, 0.72)";
    context.fill();
    context.strokeStyle = "rgba(244, 250, 255, 0.72)";
    context.lineWidth = 2;
    context.stroke();

    context.beginPath();
    context.arc(activePoint.x, activePoint.y, 6, 0, Math.PI * 2);
    context.fillStyle = pointColor(selected.score);
    context.fill();
  }, [selected.score, selectedIndex]);

  useEffect(() => {
    drawChart();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(drawChart);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawChart]);

  const indexFromPointer = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return selectedIndex;
    const bounds = canvas.getBoundingClientRect();
    const position = Math.min(Math.max(clientX - bounds.left - 18, 0), Math.max(bounds.width - 36, 1));
    return Math.round((position / Math.max(bounds.width - 36, 1)) * (MONTHS.length - 1));
  };

  const selectFromPointer = (clientX: number) => {
    const index = indexFromPointer(clientX);
    setSelectedIndex(index);
    return index;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    selectFromPointer(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      selectFromPointer(event.clientX);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const index = selectFromPointer(event.clientX);
    setCommittedIndex(index);
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    let nextIndex = selectedIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") nextIndex += 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextIndex -= 1;
    else if (event.key === "PageUp") nextIndex += 3;
    else if (event.key === "PageDown") nextIndex -= 3;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = MONTHS.length - 1;
    else return;

    event.preventDefault();
    const boundedIndex = Math.min(Math.max(nextIndex, 0), MONTHS.length - 1);
    setSelectedIndex(boundedIndex);
    setCommittedIndex(boundedIndex);
  };

  return (
    <section className="weather-difficulty-section section-frame" id="weather" aria-labelledby="weather-difficulty-title">
      <h2 className="weather-overlay-title" id="weather-difficulty-title">
        Weather-adjusted difficulty
      </h2>
      <p className="visually-hidden" id="weather-chart-help">
        Drag, tap, or use the arrow keys to select a starting month.
      </p>

      <div className="weather-chart-shell">
        <div className="weather-chart-readout">
          <div className="weather-start-month">
            <span>Starting month</span>
            <strong>{selected.name}</strong>
          </div>
          <div className="weather-score">
            <strong>{selected.score}</strong>
            <span>/100 · {difficultyBand(selected.score)}</span>
          </div>
        </div>

        <div className="weather-plot-grid">
          <div className="weather-y-axis" aria-hidden="true">
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>

          <div className="weather-canvas-column">
            <canvas
              ref={canvasRef}
              className={isDragging ? "is-dragging" : undefined}
              role="slider"
              tabIndex={0}
              aria-label="Starting month"
              aria-valuemin={0}
              aria-valuemax={MONTHS.length - 1}
              aria-valuenow={selectedIndex}
              aria-valuetext={`${selected.name}, difficulty ${selected.score} of 100, ${difficultyBand(selected.score)}`}
              aria-describedby="weather-chart-help weather-chart-summary"
              onKeyDown={handleKeyDown}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => setIsDragging(false)}
            >
              Select a starting month to view the illustrative weather-adjusted route difficulty.
            </canvas>

            <div className="weather-month-axis" aria-hidden="true">
              {MONTHS.map((month) => <span key={month.name}>{month.short}</span>)}
            </div>
          </div>
        </div>

        <div className="weather-index-dashboard" role="group" aria-label={`Weather indexes for ${selected.name}`}>
          {weatherIndexes.map((weatherIndex) => (
            <WeatherIndexWheel key={weatherIndex.label} {...weatherIndex} />
          ))}
        </div>

        <p className="weather-chart-disclaimer" id="weather-chart-summary">
          Illustrative only · not a forecast.
        </p>

        <p className="visually-hidden" aria-live="polite">
          Selected {committed.name}: difficulty {committed.score} of 100, {difficultyBand(committed.score)}.
        </p>
      </div>
    </section>
  );
}
