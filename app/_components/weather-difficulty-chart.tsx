"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type {
  RouteWeatherData,
  WeatherIndices,
  WeatherMonthlySummary,
} from "../_lib/weather";
import { localizeWeatherError } from "../_lib/weather";
import type { RoutePreview } from "../_lib/route-data";
import { useLanguage, type Track4TrekLanguage } from "./language-system";
import { THEME_CHANGE_EVENT } from "./theme-system";
import { useRouteWeather } from "./use-route-weather";

type WeatherDifficultyChartProps = { preview: RoutePreview | null };
type WeatherLayer = keyof Pick<WeatherIndices, "difficulty" | "heat" | "snow" | "storm" | "precipitation" | "visibility">;

type MonthLabel = {
  name: string;
  nameZh: string;
  short: string;
  shortZh: string;
};

const MONTHS: readonly MonthLabel[] = [
  { name: "January", nameZh: "一月", short: "Jan", shortZh: "1月" },
  { name: "February", nameZh: "二月", short: "Feb", shortZh: "2月" },
  { name: "March", nameZh: "三月", short: "Mar", shortZh: "3月" },
  { name: "April", nameZh: "四月", short: "Apr", shortZh: "4月" },
  { name: "May", nameZh: "五月", short: "May", shortZh: "5月" },
  { name: "June", nameZh: "六月", short: "Jun", shortZh: "6月" },
  { name: "July", nameZh: "七月", short: "Jul", shortZh: "7月" },
  { name: "August", nameZh: "八月", short: "Aug", shortZh: "8月" },
  { name: "September", nameZh: "九月", short: "Sep", shortZh: "9月" },
  { name: "October", nameZh: "十月", short: "Oct", shortZh: "10月" },
  { name: "November", nameZh: "十一月", short: "Nov", shortZh: "11月" },
  { name: "December", nameZh: "十二月", short: "Dec", shortZh: "12月" },
] as const;

const LAYERS: readonly { id: WeatherLayer; label: string; labelZh: string; color: string }[] = [
  { id: "difficulty", label: "Difficulty", labelZh: "综合难度", color: "#73c8ec" },
  { id: "heat", label: "Heat", labelZh: "高温", color: "#ff896f" },
  { id: "snow", label: "Snow", labelZh: "降雪", color: "#b4ddff" },
  { id: "storm", label: "Storm", labelZh: "风暴", color: "#c99aff" },
  { id: "precipitation", label: "Rain", labelZh: "降雨", color: "#56c9e7" },
  { id: "visibility", label: "Visibility", labelZh: "能见度", color: "#69d89b" },
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function number(value: number | null | undefined, language: Track4TrekLanguage, decimals = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function monthName(month: number, language: Track4TrekLanguage) {
  const item = MONTHS[clamp(Math.round(month), 1, 12) - 1];
  return language === "zh" ? item.nameZh : item.name;
}

function difficultyBand(score: number, language: Track4TrekLanguage) {
  if (score >= 80) return language === "zh" ? "极端" : "Extreme";
  if (score >= 60) return language === "zh" ? "高" : "High";
  if (score >= 40) return language === "zh" ? "中等" : "Moderate";
  return language === "zh" ? "较低" : "Lower";
}

function demoMonthly(): WeatherMonthlySummary[] {
  // Keep the chart useful before a route is selected. It is labelled
  // illustrative and is replaced by route-specific values immediately.
  return MONTHS.map((_, index) => {
    const seasonal = Math.sin((index / 12) * Math.PI * 2 - 0.6);
    const mean = 18 + seasonal * 7;
    const minimum = mean - 6;
    const maximum = mean + 6;
    const rain = 3.5 + (1 - seasonal) * 2;
    const heat = clamp((maximum - 18) * 4.4 + 20, 0, 100);
    const snow = clamp((1 - minimum) * 5, 0, 100);
    const storm = clamp(35 + (1 - seasonal) * 12, 0, 100);
    const precipitation = clamp(rain * 10 + 12, 0, 100);
    const visibility = clamp(82 - precipitation * 0.35, 0, 100);
    const difficulty = clamp(heat * 0.2 + snow * 0.2 + storm * 0.2 + precipitation * 0.2 + (100 - visibility) * 0.2, 0, 100);
    const indices: WeatherIndices = {
      difficulty, heat, snow, storm, precipitation, visibility,
      wind: 28, uv: 42, cold: clamp((12 - minimum) * 4, 0, 100),
    };
    return {
      month: index + 1,
      meanTemperatureC: mean,
      minimumTemperatureC: minimum,
      maximumTemperatureC: maximum,
      apparentTemperatureC: mean,
      precipitationMmPerDay: rain,
      precipitationDaysPct: 38 + (1 - seasonal) * 18,
      snowfallCm: snow > 2 ? snow / 7 : 0,
      snowDaysPct: snow > 2 ? snow / 3 : 0,
      humidityPct: 65 + (1 - seasonal) * 9,
      cloudCoverPct: 48 + (1 - seasonal) * 14,
      windSpeedKmh: 15,
      windGustKmh: 29,
      indices,
      source: "fallback",
    };
  });
}

const DEMO_MONTHLY = demoMonthly();

function layerValue(month: WeatherMonthlySummary, layer: WeatherLayer) {
  return month.indices[layer];
}

function dateLabel(value: string, language: Track4TrekLanguage) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function weatherCodeLabel(code: number | null, text: (english: string, chinese: string) => string) {
  if (code == null) return text("No code", "无天气代码");
  if (code >= 95) return text("Thunderstorm", "雷暴");
  if (code >= 80) return text("Showers", "阵雨");
  if (code >= 60) return text("Rain", "降雨");
  if (code >= 50) return text("Drizzle", "毛毛雨");
  if (code >= 40) return text("Fog", "雾");
  if (code >= 3) return text("Cloudy", "多云");
  return text("Clear", "晴朗");
}

function sourceLabel(
  source: RouteWeatherData["source"],
  text: (english: string, chinese: string) => string,
) {
  if (source === "mixed") {
    return text("Open-Meteo forecast + NASA POWER climate", "Open-Meteo 预报 + NASA POWER 气候");
  }
  if (source === "open-meteo") return text("Open-Meteo forecast", "Open-Meteo 预报");
  if (source === "nasa-power") return text("NASA POWER climate", "NASA POWER 气候数据");
  return text("Illustrative baseline", "示例基线");
}

function forecastSourceLabel(
  data: RouteWeatherData | null | undefined,
  text: (english: string, chinese: string) => string,
) {
  if (data?.attribution.includes("Weather data by Open-Meteo.com")) {
    return text("Open-Meteo forecast", "Open-Meteo 预报");
  }
  return sourceLabel(data?.source ?? "fallback", text);
}

function unitLabel(
  english: string,
  chinese: string,
  text: (english: string, chinese: string) => string,
) {
  return text(english, chinese);
}

type IndexWheelProps = {
  label: string;
  value: number;
  color: string;
  primary: string;
  secondary: string;
  ariaDetail: string;
};

function IndexWheel({ label, value, color, primary, secondary, ariaDetail }: IndexWheelProps) {
  const safeValue = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const style = {
    "--weather-index-angle": `${safeValue * 2.7}deg`,
    "--weather-index-color": color,
  } as CSSProperties;
  return (
    <div className="weather-index" role="img" aria-label={`${label}: ${Math.round(safeValue)} out of 100. ${ariaDetail}`}>
      <div className="weather-index-wheel" style={style} aria-hidden="true"><div><strong>{Math.round(safeValue)}</strong><span>/100</span></div></div>
      <span>{label}</span>
      <div className="weather-index-detail"><strong>{primary}</strong><span>{secondary}</span></div>
    </div>
  );
}

function statusLabel(weather: ReturnType<typeof useRouteWeather>, text: (english: string, chinese: string) => string) {
  if (weather.status === "loading") return text("Updating route weather", "正在更新路线天气");
  if (weather.status === "ready") {
    if (weather.data?.source === "open-meteo") return text("Live forecast connected", "实时预报已连接");
    if (weather.data?.source === "nasa-power") return text("Climate baseline connected", "气候基线已连接");
    return text("Live forecast + climate connected", "实时预报 + 气候已连接");
  }
  if (weather.status === "partial") return text("Partial provider data", "部分服务商数据");
  if (weather.status === "error") return text("Provider unavailable", "服务商不可用");
  if (weather.status === "fallback") return text("Illustrative baseline", "示例基线");
  return text("Select a route", "请选择路线");
}

export function WeatherDifficultyChart({ preview }: WeatherDifficultyChartProps) {
  const { language, text } = useLanguage();
  const weather = useRouteWeather(preview);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(8);
  const [isDragging, setIsDragging] = useState(false);
  const [activeLayer, setActiveLayer] = useState<WeatherLayer>("difficulty");
  const monthly = useMemo(() => {
    const rows = weather.data?.monthly ?? [];
    return rows.length === 12 ? rows : DEMO_MONTHLY;
  }, [weather.data?.monthly]);
  const selected = monthly[selectedIndex] ?? monthly[0];
  const selectedScore = layerValue(selected, activeLayer);
  const selectedBand = difficultyBand(selected.indices.difficulty, language);
  const activeLayerMeta = LAYERS.find((layer) => layer.id === activeLayer) ?? LAYERS[0];
  const liveDays = weather.data?.daily.slice(0, 8) ?? [];
  const isIllustrative = !weather.data || weather.data.source === "fallback";
  const providerCopy = weather.status === "loading"
    ? text("Baseline while providers load", "服务商加载中，暂用基线")
    : isIllustrative
      ? text("Illustrative baseline", "示例基线")
      : sourceLabel(weather.data?.source ?? "fallback", text);

  const selectedMonthDetails = [
    {
      label: text("Day / night", "白天 / 夜间"),
      value: `${number(selected.maximumTemperatureC, language)}° / ${number(selected.minimumTemperatureC, language)}°C`,
      detail: text("monthly high / low", "月度最高 / 最低"),
    },
    {
      label: text("Feels like", "体感"),
      value: `${number(selected.apparentTemperatureC, language)}°C`,
      detail: text("apparent temperature", "体感温度"),
    },
    {
      label: text("Rain", "降雨"),
      value: selected.precipitationMmPerDay == null
        ? text("Not supplied", "未提供")
        : `${number(selected.precipitationMmPerDay, language, 1)} ${unitLabel("mm/day", "毫米/日", text)}`,
      detail: selected.precipitationDaysPct == null
        ? text("monthly source does not provide wet-day frequency", "月度来源未提供降雨日频率")
        : `${number(selected.precipitationDaysPct, language)}% ${text("wet-day estimate", "降雨日估计")}`,
    },
    {
      label: text("Snow / ice proxy", "降雪 / 结冰代理"),
      value: selected.snowfallCm == null
        ? text("Not supplied", "未提供")
        : `${number(selected.snowfallCm, language, 1)} ${unitLabel("cm", "厘米", text)}`,
      detail: selected.snowDaysPct == null
        ? text("monthly source does not provide snowfall likelihood", "月度来源未提供降雪概率")
        : `${number(selected.snowDaysPct, language)}% ${text("snow-day estimate", "降雪日估计")}`,
    },
    {
      label: text("Wind / gust", "风速 / 阵风"),
      value: `${number(selected.windSpeedKmh, language)} / ${number(selected.windGustKmh, language)} km/h`,
      detail: text("monthly average / maximum", "月度平均 / 最大值"),
    },
    {
      label: text("Visibility proxy", "能见度代理"),
      value: `${Math.round(selected.indices.visibility)}/100`,
      detail: text("monthly atmospheric proxy; physical distance is live-only", "月度大气代理；实际距离仅在实时预报中提供"),
    },
    {
      label: text("Humidity / cloud", "湿度 / 云量"),
      value: `${number(selected.humidityPct, language)}% / ${number(selected.cloudCoverPct, language)}%`,
      detail: text("relative humidity / cover", "相对湿度 / 云量"),
    },
    {
      label: text("Storm proxy", "风暴代理"),
      value: `${Math.round(selected.indices.storm)}/100`,
      detail: text("wind and severe-weather proxy; no probability supplied", "风速与恶劣天气代理；未提供概率"),
    },
  ];

  const weatherIndexes = [
    { label: text("Difficulty", "综合难度"), value: selected.indices.difficulty, color: "#73c8ec", primary: `${Math.round(selected.indices.difficulty)}/100 · ${selectedBand}`, secondary: text("route + weather stress", "路线与天气压力") },
    { label: text("Heat", "高温"), value: selected.indices.heat, color: "#ff896f", primary: `${number(selected.maximumTemperatureC, language)}° / ${number(selected.minimumTemperatureC, language)}°C`, secondary: `${number(selected.humidityPct, language)}% · ${text("day high / night low", "白天最高 / 夜间最低")}` },
    { label: text("Snow / ice proxy", "降雪 / 结冰代理"), value: selected.indices.snow, color: "#b4ddff", primary: selected.snowfallCm == null ? text("Snowfall not supplied", "未提供降雪量") : `${number(selected.snowfallCm, language, 1)} ${unitLabel("cm snowfall", "厘米降雪", text)}`, secondary: selected.snowDaysPct == null ? text("monthly proxy only · likelihood not supplied", "仅为月度代理 · 未提供概率") : `${number(selected.snowDaysPct, language)}% ${text("snow days", "降雪日")}` },
    { label: text("Storm proxy", "风暴代理"), value: selected.indices.storm, color: "#c99aff", primary: selected.windGustKmh == null ? text("Gust not supplied", "未提供阵风") : `${number(selected.windGustKmh, language)} ${unitLabel("km/h gust", "公里/时阵风", text)}`, secondary: text("wind + severe-weather proxy · no probability", "风速与恶劣天气代理 · 无概率") },
    { label: text("Rain", "降雨"), value: selected.indices.precipitation, color: "#56c9e7", primary: selected.precipitationMmPerDay == null ? text("Precipitation not supplied", "未提供降水量") : `${number(selected.precipitationMmPerDay, language, 1)} ${unitLabel("mm/day", "毫米/日", text)}`, secondary: selected.precipitationDaysPct == null ? text("wet-day frequency not supplied", "未提供降雨日频率") : `${number(selected.precipitationDaysPct, language)}% ${text("wet days", "降雨日")}` },
    { label: text("Visibility proxy", "能见度代理"), value: selected.indices.visibility, color: "#69d89b", primary: `${Math.round(selected.indices.visibility)}/100 ${text("clarity proxy", "清晰度代理")}`, secondary: text("physical distance available in live forecast only", "实际距离仅在实时预报中提供") },
  ];

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || monthly.length !== 12) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * density);
    canvas.height = Math.round(bounds.height * density);
    const context = canvas.getContext("2d");
    if (!context) return;
    const isLight = document.documentElement.dataset.track4trekTheme === "light";
    const left = 18;
    const right = bounds.width - 18;
    const top = 18;
    const bottom = bounds.height - 18;
    const plotWidth = right - left;
    const plotHeight = bottom - top;
    const points = monthly.map((entry, index) => ({
      x: left + (index / 11) * plotWidth,
      y: top + ((100 - layerValue(entry, activeLayer)) / 100) * plotHeight,
    }));
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.lineWidth = 1;
    context.strokeStyle = isLight ? "rgba(22,49,68,.16)" : "rgba(207,229,248,.13)";
    for (let step = 0; step <= 4; step += 1) {
      const y = top + (step / 4) * plotHeight;
      context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
    }
    const trace = () => {
      context.beginPath(); context.moveTo(points[0].x, points[0].y);
      for (let index = 0; index < points.length - 1; index += 1) {
        const current = points[index]; const next = points[index + 1]; const controlX = (current.x + next.x) / 2;
        context.bezierCurveTo(controlX, current.y, controlX, next.y, next.x, next.y);
      }
    };
    trace(); context.lineTo(points.at(-1)!.x, bottom); context.lineTo(points[0].x, bottom); context.closePath();
    const fill = context.createLinearGradient(0, top, 0, bottom); fill.addColorStop(0, `${activeLayerMeta.color}55`); fill.addColorStop(1, `${activeLayerMeta.color}05`); context.fillStyle = fill; context.fill();
    trace(); context.strokeStyle = activeLayerMeta.color; context.lineWidth = 3; context.lineCap = "round"; context.lineJoin = "round"; context.stroke();
    points.forEach((point, index) => { if (index === selectedIndex) return; context.beginPath(); context.arc(point.x, point.y, 2.5, 0, Math.PI * 2); context.fillStyle = activeLayerMeta.color; context.fill(); });
    const activePoint = points[selectedIndex];
    context.beginPath(); context.moveTo(activePoint.x, top); context.lineTo(activePoint.x, bottom); context.strokeStyle = isLight ? "rgba(18,45,64,.46)" : "rgba(235,246,255,.5)"; context.lineWidth = 1; context.setLineDash([5, 7]); context.stroke(); context.setLineDash([]);
    context.beginPath(); context.arc(activePoint.x, activePoint.y, 13, 0, Math.PI * 2); context.fillStyle = isLight ? "rgba(247,251,252,.88)" : "rgba(3,12,22,.78)"; context.fill(); context.strokeStyle = isLight ? "rgba(17,43,60,.68)" : "rgba(244,250,255,.7)"; context.lineWidth = 2; context.stroke();
    context.beginPath(); context.arc(activePoint.x, activePoint.y, 5, 0, Math.PI * 2); context.fillStyle = activeLayerMeta.color; context.fill();
  }, [activeLayer, activeLayerMeta.color, monthly, selectedIndex]);

  useEffect(() => {
    drawChart();
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(drawChart);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawChart]);

  useEffect(() => {
    window.addEventListener(THEME_CHANGE_EVENT, drawChart);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, drawChart);
  }, [drawChart]);

  const indexFromPointer = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return selectedIndex;
    const bounds = canvas.getBoundingClientRect();
    const position = clamp(clientX - bounds.left - 18, 0, Math.max(bounds.width - 36, 1));
    return Math.round((position / Math.max(bounds.width - 36, 1)) * 11);
  };
  const selectFromPointer = (clientX: number) => { const index = indexFromPointer(clientX); setSelectedIndex(index); return index; };
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => { event.currentTarget.setPointerCapture(event.pointerId); setIsDragging(true); selectFromPointer(event.clientX); };
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) selectFromPointer(event.clientX); };
  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => { selectFromPointer(event.clientX); setIsDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    let next = selectedIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
    else if (event.key === "PageUp") next += 3;
    else if (event.key === "PageDown") next -= 3;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 11;
    else return;
    event.preventDefault(); setSelectedIndex(clamp(next, 0, 11));
  };

  return (
    <section className="weather-difficulty-section result-story-section section-frame" id="weather" aria-labelledby="weather-difficulty-title">
      <h2 className="weather-overlay-title result-story-title" id="weather-difficulty-title">{text("Weather-adjusted difficulty", "不同月份难度预测")}</h2>
      <p className="visually-hidden" id="weather-chart-help">{text("Drag, tap, or use the arrow keys to select a starting month.", "拖动、点击、或使用方向键选择出发月份。")}</p>
      <div className="weather-chart-shell result-story-panel" data-weather-state={weather.status}>
        <div className="weather-source-row">
          <span className={`weather-source-status is-${weather.status}`} aria-live="polite">{statusLabel(weather, text)}</span>
          <span className="weather-source-copy">{providerCopy}</span>
          <button
            className="weather-refresh"
            type="button"
            onClick={weather.refresh}
            disabled={weather.status === "loading"}
            aria-label={text("Refresh route weather", "刷新路线天气")}
            title={text("Refresh route weather", "刷新路线天气")}
          >
            <span aria-hidden="true">↻</span>
          </button>
          {weather.error ? <span className="weather-source-error">{localizeWeatherError(weather.error, language)}</span> : null}
        </div>
        <div className="weather-chart-readout"><div className="weather-start-month"><span>{text("Starting month", "出发月份")}</span><strong>{monthName(selected.month, language)}</strong></div><div className="weather-score"><strong>{Math.round(selectedScore)}</strong><span>/100 · {activeLayer === "difficulty" ? selectedBand : text(activeLayerMeta.label, activeLayerMeta.labelZh)}</span></div></div>
        <div className="weather-layer-switch" role="group" aria-label={text("Annual weather layer", "年度天气图层")}>{LAYERS.map((layer) => <button key={layer.id} type="button" aria-pressed={activeLayer === layer.id} onClick={() => setActiveLayer(layer.id)}>{text(layer.label, layer.labelZh)}</button>)}</div>
        <div className="weather-plot-grid"><div className="weather-y-axis" aria-hidden="true"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div className="weather-canvas-column"><canvas ref={canvasRef} className={isDragging ? "is-dragging" : undefined} role="slider" tabIndex={0} aria-label={text("Starting month", "出发月份")} aria-valuemin={0} aria-valuemax={11} aria-valuenow={selectedIndex} aria-valuetext={text(`${monthName(selected.month, language)}, ${activeLayerMeta.label} ${Math.round(selectedScore)} of 100`, `${monthName(selected.month, language)}，${activeLayerMeta.labelZh}${Math.round(selectedScore)}/100`)} aria-describedby="weather-chart-help weather-chart-summary" onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={() => setIsDragging(false)}>{text("Select a starting month to view route weather stress.", "选择出发月份，查看路线天气压力。")}</canvas><div className="weather-month-axis" aria-hidden="true">{MONTHS.map((item) => <span key={item.name}>{language === "zh" ? item.shortZh : item.short}</span>)}</div></div></div>
        <div className="weather-index-dashboard" role="group" aria-label={text(`Weather indexes for ${monthName(selected.month, language)}`, `${monthName(selected.month, language)}的天气指标`)}>{weatherIndexes.map((item) => <IndexWheel key={item.label} {...item} ariaDetail={`${item.primary}. ${item.secondary}`} />)}</div>
        <section className="weather-selected-details" aria-labelledby="weather-selected-details-title">
          <div className="weather-selected-details-heading">
            <div>
              <span>{text("Selected month", "所选月份")}</span>
              <strong id="weather-selected-details-title">{monthName(selected.month, language)}</strong>
            </div>
            <span>{text("Route weather snapshot", "路线天气快照")}</span>
          </div>
          <dl>
            {selectedMonthDetails.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd><strong>{item.value}</strong><small>{item.detail}</small></dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="weather-live-strip" role="region" aria-label={text("Live route forecast", "路线实时预报")}><div className="weather-live-strip-heading"><div><span>{text("Next 16 days", "未来 16 天")}</span><strong>{text("Live route forecast", "路线实时预报")}</strong></div><span>{liveDays.length ? `${liveDays.length} / 16 · ${forecastSourceLabel(weather.data, text)}` : text("Unavailable", "暂不可用")}</span></div>{liveDays.length ? <div className="weather-live-days">{liveDays.map((day) => <article key={day.date}><span>{dateLabel(day.date, language)}</span><strong>{Math.round(day.indices.difficulty)}</strong><small>{number(day.minimumTemperatureC, language)}° / {number(day.maximumTemperatureC, language)}°C · {weatherCodeLabel(day.weatherCode, text)} · {number(day.precipitationProbabilityMaxPct, language, 0)}%</small><i style={{ "--weather-day-score": `${day.indices.difficulty}%` } as CSSProperties} aria-hidden="true" /></article>)}</div> : <p>{weather.status === "loading" ? text("Fetching route conditions…", "正在获取路线天气…") : text("The seasonal dashboard remains available while a date forecast is unavailable.", "日期预报不可用时，季节仪表盘仍可使用。")}</p>}</div>
        <p className="weather-chart-disclaimer" id="weather-chart-summary">{text("Monthly values are climate context, not a long-range forecast. NASA POWER's seasonal baseline represents the route centre; storm and atmospheric visibility are transparent proxies. Representative route coordinates are sent to weather providers; the GPX file is not uploaded. Provider coverage is shown above.", "月度数值是气候背景，不是长期预报。NASA POWER 季节基线代表路线中心；风暴和大气能见度是透明代理指标。代表性路线坐标会发送给天气服务商；GPX 文件不会被上传。上方会显示服务商覆盖情况。")}</p>
      </div>
    </section>
  );
}

export type { RouteWeatherData };
