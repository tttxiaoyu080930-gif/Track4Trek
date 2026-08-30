"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Track4TrekLanguage } from "./language-system";
import type { RouteWeatherState } from "./use-route-weather";
import {
  localizeWeatherAttribution,
  localizeWeatherError,
  monthlyWeather,
  nearestHourlySample,
  type WeatherDailySummary,
  type WeatherHourlySample,
  type WeatherMonthlySummary,
  type WeatherPointForecast,
  type WeatherRoutePoint,
} from "../_lib/weather";

type ProWeatherWorkspaceProps = {
  weather: RouteWeatherState;
  month: number;
  language: Track4TrekLanguage;
  text: (english: string, chinese: string) => string;
};

const MONTHS = [
  ["January", "一月"], ["February", "二月"], ["March", "三月"],
  ["April", "四月"], ["May", "五月"], ["June", "六月"],
  ["July", "七月"], ["August", "八月"], ["September", "九月"],
  ["October", "十月"], ["November", "十一月"], ["December", "十二月"],
] as const;

function number(value: number | null | undefined, language: Track4TrekLanguage, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function integer(value: number | null | undefined, language: Track4TrekLanguage) {
  return number(value, language, 0);
}

function monthName(month: number, language: Track4TrekLanguage) {
  const index = Math.min(Math.max(Math.round(month), 1), 12) - 1;
  return language === "zh" ? MONTHS[index][1] : MONTHS[index][0];
}

function dateLabel(value: string | null | undefined, language: Track4TrekLanguage) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  }).format(date);
}

function providerLocalDate(value: string) {
  const localIso = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
  if (!localIso) return new Date(value);
  return new Date(`${localIso[1]}T${localIso[2]}:${localIso[3] ?? "00"}Z`);
}

function timeLabel(value: string | null | undefined, language: Track4TrekLanguage) {
  if (!value) return "—";
  const date = providerLocalDate(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(date);
}

function timeOnly(value: string | null | undefined, language: Track4TrekLanguage) {
  if (!value) return "—";
  const date = providerLocalDate(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(date);
}

function durationLabel(seconds: number | null | undefined, language: Track4TrekLanguage) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (language === "zh") return hours ? `${hours} 小时 ${remainder} 分钟` : `${remainder} 分钟`;
  return hours ? `${hours} h ${remainder} min` : `${remainder} min`;
}

function codeLabel(code: number | null, text: ProWeatherWorkspaceProps["text"]) {
  if (code == null) return text("No code", "无代码");
  if (code >= 95) return text("Thunderstorm", "雷暴");
  if (code >= 80) return text("Showers", "阵雨");
  if (code >= 60) return text("Rain", "降雨");
  if (code >= 50) return text("Drizzle", "毛毛雨");
  if (code >= 40) return text("Fog", "雾");
  if (code >= 3) return text("Cloudy", "多云");
  return text("Clear", "晴朗");
}

function roleLabel(role: WeatherRoutePoint["role"], text: ProWeatherWorkspaceProps["text"]) {
  const labels: Record<WeatherRoutePoint["role"], [string, string]> = {
    center: ["center", "中心"],
    start: ["start", "起点"],
    quarter: ["quarter", "四分之一点"],
    midpoint: ["midpoint", "中点"],
    "three-quarter": ["three-quarter", "四分之三点"],
    highest: ["highest", "最高点"],
    lowest: ["lowest", "最低点"],
    finish: ["finish", "终点"],
  };
  const [english, chinese] = labels[role] ?? labels.center;
  return text(english, chinese);
}

function sourceLabel(source: string, text: ProWeatherWorkspaceProps["text"]) {
  if (source === "mixed") return text("Open-Meteo + NASA POWER", "Open-Meteo + NASA POWER");
  if (source === "open-meteo") return text("Open-Meteo forecast", "Open-Meteo 预报");
  if (source === "nasa-power") return text("NASA POWER climate", "NASA POWER 气候数据");
  return text("Deterministic fallback", "确定性备用数据");
}

function climateContextLabel(
  data: RouteWeatherState["data"],
  text: ProWeatherWorkspaceProps["text"],
) {
  if (data?.climateContext) {
    return text(
      "NASA POWER 2001–2020 route-centre context",
      "NASA POWER 2001–2020 路线中心背景",
    );
  }
  if (data?.source === "fallback") return text("Illustrative monthly baseline", "示例月度基线");
  return text("Monthly climate context unavailable", "月度气候背景不可用");
}

function dataStatusLabel(
  status: RouteWeatherState["status"],
  text: ProWeatherWorkspaceProps["text"],
) {
  if (status === "ready") return text("Ready", "已就绪");
  if (status === "partial") return text("Partial", "部分数据");
  if (status === "fallback") return text("Fallback", "备用");
  if (status === "loading") return text("Loading", "加载中");
  if (status === "error") return text("Unavailable", "不可用");
  return text("Waiting", "等待中");
}

function statusLabel(status: RouteWeatherState["status"], text: ProWeatherWorkspaceProps["text"]) {
  if (status === "loading") return text("Updating providers", "正在更新服务商");
  if (status === "ready") return text("Live + climate connected", "实时 + 气候已连接");
  if (status === "partial") return text("Partial provider data", "部分服务商数据");
  if (status === "error") return text("Provider unavailable", "服务商不可用");
  if (status === "fallback") return text("Fallback baseline", "备用基线");
  return text("Waiting for route", "等待路线");
}

function DataRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="pro-weather-data-row"><dt>{label}</dt><dd><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</dd></div>;
}

function scoreBand(value: number, text: ProWeatherWorkspaceProps["text"]) {
  if (value >= 80) return text("Extreme", "极端");
  if (value >= 60) return text("High", "高");
  if (value >= 40) return text("Moderate", "中等");
  if (value >= 20) return text("Low", "较低");
  return text("Minimal", "很低");
}

function WeatherMeter({ label, value, tone, quality = false, text }: {
  label: string;
  value: number;
  tone: string;
  quality?: boolean;
  text: ProWeatherWorkspaceProps["text"];
}) {
  const safeValue = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 100);
  const statusValue = quality ? 100 - safeValue : safeValue;
  return (
    <div
      className="pro-weather-meter"
      style={{ "--weather-meter-value": `${safeValue}%`, "--weather-meter-tone": tone } as CSSProperties}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
      aria-label={text(`${label}: ${Math.round(safeValue)} out of 100`, `${label}：${Math.round(safeValue)}/100`)}
    >
      <div><span>{label}</span><strong>{Math.round(safeValue)}</strong></div>
      <i aria-hidden="true"><b /></i>
      <small>{scoreBand(statusValue, text)}</small>
    </div>
  );
}

function cardinalDirection(degrees: number | null | undefined, text: ProWeatherWorkspaceProps["text"]) {
  if (degrees == null || !Number.isFinite(degrees)) return "—";
  const labels = [
    text("N", "北"), text("NE", "东北"), text("E", "东"), text("SE", "东南"),
    text("S", "南"), text("SW", "西南"), text("W", "西"), text("NW", "西北"),
  ];
  return `${labels[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]} · ${Math.round(degrees)}°`;
}

function coveragePercent<T>(rows: T[], read: (row: T) => unknown) {
  if (!rows.length) return 0;
  const available = rows.reduce((count, row) => {
    const value = read(row);
    return value != null && (typeof value !== "number" || Number.isFinite(value))
      ? count + 1
      : count;
  }, 0);
  return Math.round((available / rows.length) * 100);
}

function MonthlyMatrix({ rows, selectedMonth, language, text }: { rows: WeatherMonthlySummary[]; selectedMonth: number; language: Track4TrekLanguage; text: ProWeatherWorkspaceProps["text"] }) {
  return (
    <div className="pro-weather-table-wrap">
      <table className="pro-weather-table pro-weather-monthly-table" aria-label={text("Twelve-month weather matrix", "十二个月天气矩阵")}>
        <thead><tr>
          <th>{text("Month", "月份")}</th><th>{text("Stress", "压力")}</th><th>{text("Heat", "高温")}</th><th>{text("Cold", "低温")}</th><th>{text("Snow / ice proxy", "降雪 / 结冰代理")}</th><th>{text("Severe weather proxy", "恶劣天气代理")}</th><th>{text("Precip", "降水")}</th><th>{text("Visibility proxy", "能见度代理")}</th><th>{text("Wind", "风")}</th><th>{text("High / low", "高温 / 低温")}</th><th>{text("Precipitation", "降水量")}</th><th>{text("Humidity / cloud", "湿度 / 云量")}</th><th>{text("Wind / gust", "风速 / 阵风")}</th><th>{text("Source", "来源")}</th>
        </tr></thead>
        <tbody>{rows.map((row) => {
          const isSelected = row.month === selectedMonth;
          return <tr key={row.month} className={isSelected ? "is-selected" : undefined}>
            <th scope="row">{monthName(row.month, language)}</th>
            <td><strong className="pro-weather-score" style={{ "--weather-score": `${row.indices.difficulty}%` } as CSSProperties}>{integer(row.indices.difficulty, language)}</strong></td>
            <td>{integer(row.indices.heat, language)}</td><td>{integer(row.indices.cold, language)}</td><td>{integer(row.indices.snow, language)}</td><td>{integer(row.indices.storm, language)}</td><td>{integer(row.indices.precipitation, language)}</td><td>{integer(row.indices.visibility, language)}</td><td>{integer(row.indices.wind, language)}</td>
            <td>{number(row.maximumTemperatureC, language, 0)}° / {number(row.minimumTemperatureC, language, 0)}°C</td>
            <td>{number(row.precipitationMmPerDay, language, 1)} mm/day</td>
            <td>{number(row.humidityPct, language, 0)}% / {number(row.cloudCoverPct, language, 0)}%</td>
            <td>{number(row.windSpeedKmh, language, 0)} / {number(row.windGustKmh, language, 0)} km/h</td>
            <td>{row.source === "nasa-power" ? "NASA POWER" : text("Fallback", "备用")}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function DailyForecastTable({ rows, language, text }: { rows: WeatherDailySummary[]; language: Track4TrekLanguage; text: ProWeatherWorkspaceProps["text"] }) {
  return (
    <div className="pro-weather-table-wrap">
      <table className="pro-weather-table pro-weather-forecast-table" aria-label={text("Route daily forecast", "路线每日预报")}>
        <thead><tr>
          <th>{text("Date", "日期")}</th><th>{text("Stress", "压力")}</th><th>{text("Temperature", "温度")}</th><th>{text("Feels like", "体感")}</th><th>{text("Rain / showers", "降雨 / 阵雨")}</th><th>{text("Snow", "降雪")}</th><th>{text("Wet hours", "降水时长")}</th><th>{text("Wind / gust / direction", "风速 / 阵风 / 风向")}</th><th>{text("Cloud", "云量")}</th><th>{text("Visibility", "能见度")}</th><th>{text("Freeze", "冻结层")}</th><th>{text("UV", "紫外线")}</th><th>{text("Daylight", "日照")}</th><th>{text("Condition", "天气")}</th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.date}>
          <th scope="row">{dateLabel(row.date, language)}</th>
          <td><strong className="pro-weather-score" style={{ "--weather-score": `${row.indices.difficulty}%` } as CSSProperties}>{integer(row.indices.difficulty, language)}</strong></td>
          <td>{number(row.minimumTemperatureC, language, 0)}° / {number(row.maximumTemperatureC, language, 0)}°C</td>
          <td>{number(row.apparentMinimumTemperatureC, language, 0)}° / {number(row.apparentMaximumTemperatureC, language, 0)}°C</td>
          <td>{number(row.precipitationMm, language, 1)} mm · {number(row.precipitationProbabilityMaxPct, language, 0)}% · {number(row.rainMm, language, 1)} / {number(row.showersMm, language, 1)} mm</td>
          <td>{number(row.snowfallCm, language, 1)} cm</td>
          <td>{integer(row.precipitationHours, language)} h</td>
          <td>{number(row.windSpeedMaxKmh, language, 0)} / {number(row.windGustMaxKmh, language, 0)} km/h · {number(row.windDirectionDeg, language, 0)}°</td>
          <td>{integer(row.cloudCoverMaxPct, language)}%</td>
          <td>{row.visibilityMinM == null ? "—" : `${number(row.visibilityMinM / 1000, language, 1)} km`}</td>
          <td>{row.freezingLevelMinM == null ? "—" : `${integer(row.freezingLevelMinM, language)} m`}</td>
          <td>{number(row.uvIndexMax, language, 1)}</td>
          <td>{durationLabel(row.daylightSeconds, language)} · {timeOnly(row.sunrise, language)}–{timeOnly(row.sunset, language)}</td>
          <td>{codeLabel(row.weatherCode, text)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

type HourlyRow = { point: WeatherRoutePoint; sample: WeatherHourlySample };

function HourlyTable({ rows, language, text }: { rows: HourlyRow[]; language: Track4TrekLanguage; text: ProWeatherWorkspaceProps["text"] }) {
  return (
    <div className="pro-weather-table-wrap pro-weather-hourly-wrap">
      <table className="pro-weather-table pro-weather-hourly-table" aria-label={text("Sampled route hourly weather", "路线采样小时天气")}>
        <thead><tr>
          <th>{text("Point", "点位")}</th><th>{text("Time", "时间")}</th><th>{text("Day / night", "昼 / 夜")}</th><th>{text("Temp / feels", "温度 / 体感")}</th><th>{text("Humidity / dew", "湿度 / 露点")}</th><th>{text("Precip / rain / showers", "降水 / 降雨 / 阵雨")}</th><th>{text("Probability", "概率")}</th><th>{text("Snow / depth", "降雪 / 深度")}</th><th>{text("Cloud total", "总云量")}</th><th>{text("Cloud low / mid / high", "低 / 中 / 高云")}</th><th>{text("Wind / direction / gust", "风速 / 风向 / 阵风")}</th><th>{text("Visibility", "能见度")}</th><th>{text("Freeze", "冻结层")}</th><th>{text("Pressure surface / MSL", "地面 / 海平面气压")}</th><th>{text("UV / CAPE", "紫外线 / CAPE")}</th><th>{text("Condition", "天气")}</th>
        </tr></thead>
        <tbody>{rows.map(({ point, sample }, index) => <tr key={`${point.id}-${sample.time}-${index}`}>
          <th scope="row">{roleLabel(point.role, text)}</th>
          <td>{timeLabel(sample.time, language)}</td>
          <td>{sample.isDay == null ? "—" : sample.isDay ? text("Day", "白天") : text("Night", "夜间")}</td>
          <td>{number(sample.temperatureC, language, 1)}° / {number(sample.apparentTemperatureC, language, 1)}°C</td>
          <td>{number(sample.humidityPct, language, 0)}% / {number(sample.dewPointC, language, 1)}°C</td>
          <td>{number(sample.precipitationMm, language, 1)} / {number(sample.rainMm, language, 1)} / {number(sample.showersMm, language, 1)} mm</td>
          <td>{number(sample.precipitationProbabilityPct, language, 0)}%</td>
          <td>{number(sample.snowfallCm, language, 1)} cm · {number(sample.snowDepthM, language, 2)} m</td>
          <td>{number(sample.cloudCoverPct, language, 0)}%</td>
          <td>{number(sample.cloudCoverLowPct, language, 0)} / {number(sample.cloudCoverMidPct, language, 0)} / {number(sample.cloudCoverHighPct, language, 0)}%</td>
          <td>{number(sample.windSpeedKmh, language, 0)} km/h · {number(sample.windDirectionDeg, language, 0)}° · {number(sample.windGustKmh, language, 0)} km/h</td>
          <td>{sample.visibilityM == null ? "—" : `${number(sample.visibilityM / 1000, language, 1)} km`}</td>
          <td>{sample.freezingLevelM == null ? "—" : `${integer(sample.freezingLevelM, language)} m`}</td>
          <td>{number(sample.surfacePressureHpa, language, 0)} / {number(sample.pressureMslHpa, language, 0)} hPa</td>
          <td>{number(sample.uvIndex, language, 1)} / {number(sample.capeJkg, language, 0)} J/kg</td>
          <td>{codeLabel(sample.weatherCode, text)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function PointTable({ forecasts, language, text }: { forecasts: WeatherPointForecast[]; language: Track4TrekLanguage; text: ProWeatherWorkspaceProps["text"] }) {
  return (
    <div className="pro-weather-table-wrap">
      <table className="pro-weather-table pro-weather-point-table" aria-label={text("Weather route sample points", "天气路线采样点")}>
        <thead><tr><th>{text("Role", "角色")}</th><th>{text("Coordinates", "坐标")}</th><th>{text("Elevation", "海拔")}</th><th>{text("Distance", "距离")}</th><th>{text("Hourly rows", "小时行")}</th><th>{text("Daily rows", "日行")}</th><th>{text("Timezone / UTC offset / model", "时区 / UTC 偏移 / 模型")}</th></tr></thead>
        <tbody>{forecasts.map((forecast) => <tr key={forecast.point.id}>
          <th scope="row">{roleLabel(forecast.point.role, text)}</th>
          <td>{forecast.latitude.toFixed(4)}, {forecast.longitude.toFixed(4)}</td>
          <td>{forecast.elevationM == null ? "—" : `${integer(forecast.elevationM, language)} m`}</td>
          <td>{forecast.point.distanceKm == null ? "—" : `${number(forecast.point.distanceKm, language, 2)} km`}</td>
          <td>{forecast.hourly.length}</td><td>{forecast.daily.length}</td>
          <td>{forecast.timezone ?? "—"} · {forecast.utcOffsetSeconds == null ? "—" : `${forecast.utcOffsetSeconds >= 0 ? "+" : "−"}${Math.abs(forecast.utcOffsetSeconds / 3600)} h`} · {forecast.model ?? "—"}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

export function ProWeatherWorkspace({ weather, month, language, text }: ProWeatherWorkspaceProps) {
  const [selectedPointId, setSelectedPointId] = useState("");
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);
  const data = weather.data;
  const monthly = data?.monthly ?? [];
  const selected = data ? monthlyWeather(data, month) : null;
  const forecasts = data?.forecasts ?? [];
  const daily = data?.daily ?? [];
  const selectedForecast = forecasts.find((forecast) => forecast.point.id === selectedPointId) ?? forecasts[0] ?? null;
  const safeHourIndex = selectedForecast
    ? Math.min(Math.max(selectedHourIndex, 0), Math.max(selectedForecast.hourly.length - 1, 0))
    : 0;
  const selectedHour = selectedForecast?.hourly[safeHourIndex] ?? null;
  const selectedDate = selectedHour?.time.slice(0, 10) ?? null;
  const hourlyRows: HourlyRow[] = selectedForecast
    ? selectedForecast.hourly
        .filter((sample) => !selectedDate || sample.time.startsWith(selectedDate))
        .map((sample) => ({ point: selectedForecast.point, sample }))
    : [];
  const center = data?.location;
  const firstForecast = selectedForecast ?? forecasts[0] ?? null;
  const attribution = data?.attribution ?? [];
  const selectedPointSnapshots = selectedHour
    ? forecasts.flatMap((forecast) => {
        const sample = nearestHourlySample(forecast, selectedHour.time);
        return sample ? [{ forecast, sample }] : [];
      })
    : [];
  const selectedMonthMeters = selected
    ? [
        [text("Overall", "综合"), selected.indices.difficulty, "#73c8ec", false],
        [text("Heat", "高温"), selected.indices.heat, "#ff896f", false],
        [text("Cold", "低温"), selected.indices.cold, "#7fc8ff", false],
        [text("Snow / ice proxy", "降雪 / 结冰代理"), selected.indices.snow, "#b4ddff", false],
        [text("Severe weather proxy", "恶劣天气代理"), selected.indices.storm, "#c99aff", false],
        [text("Precipitation", "降水"), selected.indices.precipitation, "#56c9e7", false],
        [text("Visibility proxy", "能见度代理"), selected.indices.visibility, "#69d89b", true],
        [text("Wind", "风"), selected.indices.wind, "#efc46c", false],
      ] as const
    : [];
  const liveMeters = selectedHour
    ? [
        [text("Overall", "综合"), selectedHour.indices.difficulty, "#73c8ec", false],
        [text("Heat", "高温"), selectedHour.indices.heat, "#ff896f", false],
        [text("Cold", "低温"), selectedHour.indices.cold, "#7fc8ff", false],
        [text("Snow", "降雪"), selectedHour.indices.snow, "#b4ddff", false],
        [text("Storm", "风暴"), selectedHour.indices.storm, "#c99aff", false],
        [text("Precipitation", "降水"), selectedHour.indices.precipitation, "#56c9e7", false],
        [text("Visibility", "能见度"), selectedHour.indices.visibility, "#69d89b", true],
        [text("Wind", "风"), selectedHour.indices.wind, "#efc46c", false],
        [text("UV", "紫外线"), selectedHour.indices.uv, "#f2d06f", false],
      ] as const
    : [];
  const coverageRows = useMemo(() => {
    const rows = selectedForecast?.hourly ?? [];
    return [
      [text("Temperature", "温度"), coveragePercent(rows, (row) => row.temperatureC)],
      [text("Precipitation", "降水"), coveragePercent(rows, (row) => row.precipitationMm)],
      [text("Snow", "降雪"), coveragePercent(rows, (row) => row.snowfallCm)],
      [text("Wind", "风"), coveragePercent(rows, (row) => row.windSpeedKmh)],
      [text("Visibility", "能见度"), coveragePercent(rows, (row) => row.visibilityM)],
      [text("Freezing level", "冻结层"), coveragePercent(rows, (row) => row.freezingLevelM)],
      [text("UV", "紫外线"), coveragePercent(rows, (row) => row.uvIndex)],
      [text("CAPE", "CAPE"), coveragePercent(rows, (row) => row.capeJkg)],
    ] as const;
  }, [selectedForecast, text]);

  return (
    <section className="pro-weather-section" id="pro-weather" aria-labelledby="pro-weather-title" data-pro-weather-workspace data-weather-state={weather.status}>
      <div className="pro-section-heading pro-section-heading-row">
        <div><p className="pro-eyebrow">04 / {text("Weather lab", "天气实验室")}</p><h3 id="pro-weather-title">{text("Route weather, fully exposed", "路线天气全量数据")}</h3><p>{text("The Pro view keeps the route sample, seasonal baseline, daily forecast and provider fields visible together. Values stay explicit when a model does not return them.", "专业模式同时展示路线采样、季节基线、每日预报和服务商字段。模型未返回的数值会明确保留为空。")}</p></div>
        <div className={`pro-weather-status is-${weather.status}`} aria-live="polite"><span>{statusLabel(weather.status, text)}</span><small>{data?.location.timezone ?? text("local time", "当地时间")}</small></div>
      </div>

      <div className="pro-weather-summary-grid">
        <section className="pro-weather-summary"><span>{text("Route centre", "路线中心")}</span><strong>{center?.latitude == null || center.longitude == null ? "—" : `${center.latitude.toFixed(4)}, ${center.longitude.toFixed(4)}`}</strong><small>{center?.elevationM == null ? text("Elevation unavailable", "海拔不可用") : `${integer(center.elevationM, language)} m ${text("centre elevation", "中心海拔")}`}</small></section>
        <section className="pro-weather-summary"><span>{text("Selected month", "所选月份")}</span><strong>{monthName(month, language)}</strong><small>{selected ? `${integer(selected.indices.difficulty, language)}/100 ${text("weather stress", "天气压力")}` : text("Waiting for route", "等待路线")}</small></section>
        <section className="pro-weather-summary"><span>{text("Providers", "数据服务商")}</span><strong>{data ? sourceLabel(data.source, text) : "—"}</strong><small>{data ? new Date(data.fetchedAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US") : text("Not fetched", "尚未获取")}</small></section>
        <section className="pro-weather-summary"><span>{text("Sample points", "采样点")}</span><strong>{data?.routePoints.length ?? 0}</strong><small>{text("representative coordinates", "代表性坐标")}</small></section>
        <section className="pro-weather-summary"><span>{text("Forecast days", "预报天数")}</span><strong>{daily.length || "—"}</strong><small>{daily.length ? text("route-wide daily rows", "路线每日汇总") : text("No date forecast", "没有日期预报")}</small></section>
        <section className="pro-weather-summary"><span>{text("Data state", "数据状态")}</span><strong>{dataStatusLabel(data?.status ?? weather.status, text)}</strong><small>{data?.errors.length ? localizeWeatherError(data.errors[0], language) : text("No provider errors", "没有服务商错误")}</small></section>
      </div>

      {data?.errors.length ? (
        <div className="pro-weather-alert" role="status">
          <strong>{text("Partial-data notes", "部分数据说明")}</strong>
          <ul>{data.errors.map((error) => <li key={error}>{localizeWeatherError(error, language)}</li>)}</ul>
        </div>
      ) : null}

      <section className="pro-weather-block pro-weather-month-audit" aria-labelledby="pro-weather-month-audit-title">
        <div className="pro-weather-block-heading">
          <div>
            <p className="pro-eyebrow">A / {text("Selected-month audit", "所选月份审计")}</p>
            <h4 id="pro-weather-month-audit-title">{monthName(month, language)} · {text("climate stress model", "气候压力模型")}</h4>
          </div>
          <span>{climateContextLabel(data, text)}</span>
        </div>
        {selected ? (
          <>
            <div className="pro-weather-meter-grid">
              {selectedMonthMeters.map(([label, value, tone, quality]) => (
                <WeatherMeter key={label} label={label} value={value} tone={tone} quality={quality} text={text} />
              ))}
            </div>
            <dl className="pro-weather-data-grid pro-weather-month-fields">
              <DataRow label={text("Mean / apparent", "平均 / 体感")} value={`${number(selected.meanTemperatureC, language, 1)}° / ${number(selected.apparentTemperatureC, language, 1)}°C`} />
              <DataRow label={text("Low / high", "最低 / 最高")} value={`${number(selected.minimumTemperatureC, language, 1)}° / ${number(selected.maximumTemperatureC, language, 1)}°C`} />
              <DataRow label={text("Precipitation rate", "降水速率")} value={`${number(selected.precipitationMmPerDay, language, 1)} mm/day`} detail={text("climatological daily average, not a probability", "气候日均值，不是概率")} />
              <DataRow label={text("Snow / ice proxy", "降雪 / 结冰代理")} value={selected.snowfallCm == null ? "—" : `${number(selected.snowfallCm, language, 1)} cm`} detail={selected.snowfallCm == null ? text("monthly snowfall is not supplied by NASA POWER", "NASA POWER 未提供月度降雪字段") : text("monthly snowfall proxy", "月度降雪代理")} />
              <DataRow label={text("Humidity / cloud", "湿度 / 云量")} value={`${number(selected.humidityPct, language, 0)}% / ${number(selected.cloudCoverPct, language, 0)}%`} />
              <DataRow label={text("Wind / monthly maximum", "风速 / 月度最大值")} value={`${number(selected.windSpeedKmh, language, 1)} / ${number(selected.windGustKmh, language, 1)} km/h`} />
              <DataRow label={text("UV", "紫外线")} value="—" detail={text("forecast-only field", "仅预报字段")} />
              <DataRow label={text("Source row", "来源行")} value={selected.source === "nasa-power" ? "NASA POWER" : text("Deterministic fallback", "确定性备用数据")} />
            </dl>
          </>
        ) : <p className="pro-inline-note">{text("Monthly values will appear after the route is read.", "读取路线后显示月度数据。")}</p>}
      </section>

      <section className="pro-weather-block pro-weather-live-workbench" aria-labelledby="pro-weather-live-title">
        <div className="pro-weather-block-heading">
          <div>
            <p className="pro-eyebrow">B / {text("Forecast workbench", "预报工作台")}</p>
            <h4 id="pro-weather-live-title">{text("Inspect every sampled route point", "检查每个路线采样点")}</h4>
          </div>
          <button className="pro-weather-refresh" type="button" onClick={weather.refresh} disabled={weather.status === "loading"}>
            {weather.status === "loading" ? text("Updating…", "更新中…") : text("Refresh providers", "刷新服务商")}
          </button>
        </div>
        {selectedForecast && selectedHour ? (
          <>
            <div className="pro-weather-point-switch" role="group" aria-label={text("Forecast route point", "预报路线点位")}>
              {forecasts.map((forecast) => (
                <button
                  key={forecast.point.id}
                  type="button"
                  aria-pressed={forecast.point.id === selectedForecast.point.id}
                  onClick={() => setSelectedPointId(forecast.point.id)}
                >
                  <span>{roleLabel(forecast.point.role, text)}</span>
                  <small>{forecast.point.distanceKm == null ? "—" : `${number(forecast.point.distanceKm, language, 1)} km`} · {forecast.elevationM == null ? "—" : `${integer(forecast.elevationM, language)} m`}</small>
                </button>
              ))}
            </div>

            <label className="pro-weather-time-control" htmlFor="pro-weather-hour">
              <span>{text("Forecast hour", "预报小时")}</span>
              <strong>{timeLabel(selectedHour.time, language)}</strong>
              <input
                id="pro-weather-hour"
                type="range"
                min={0}
                max={Math.max(selectedForecast.hourly.length - 1, 0)}
                step={1}
                value={safeHourIndex}
                aria-valuetext={timeLabel(selectedHour.time, language)}
                onChange={(event) => setSelectedHourIndex(Number(event.target.value))}
              />
              <small><span>{timeLabel(selectedForecast.hourly[0]?.time, language)}</span><span>{timeLabel(selectedForecast.hourly.at(-1)?.time, language)}</span></small>
            </label>

            <div className="pro-weather-meter-grid pro-weather-live-meters">
              {liveMeters.map(([label, value, tone, quality]) => (
                <WeatherMeter key={label} label={label} value={value} tone={tone} quality={quality} text={text} />
              ))}
            </div>

            <dl className="pro-weather-data-grid pro-weather-live-fields">
              <DataRow label={text("Condition", "天气")} value={codeLabel(selectedHour.weatherCode, text)} detail={selectedHour.isDay == null ? undefined : selectedHour.isDay ? text("daylight hour", "白天时段") : text("night hour", "夜间时段")} />
              <DataRow label={text("Temperature / feels", "温度 / 体感")} value={`${number(selectedHour.temperatureC, language, 1)}° / ${number(selectedHour.apparentTemperatureC, language, 1)}°C`} />
              <DataRow label={text("Humidity / dew point", "湿度 / 露点")} value={`${number(selectedHour.humidityPct, language, 0)}% / ${number(selectedHour.dewPointC, language, 1)}°C`} />
              <DataRow label={text("Precipitation / probability", "降水 / 概率")} value={`${number(selectedHour.precipitationMm, language, 1)} mm / ${number(selectedHour.precipitationProbabilityPct, language, 0)}%`} detail={`${number(selectedHour.rainMm, language, 1)} mm ${text("rain", "降雨")} · ${number(selectedHour.showersMm, language, 1)} mm ${text("showers", "阵雨")}`} />
              <DataRow label={text("Snowfall / depth", "降雪 / 积雪深度")} value={`${number(selectedHour.snowfallCm, language, 1)} cm / ${number(selectedHour.snowDepthM, language, 2)} m`} />
              <DataRow label={text("Wind / gust", "风速 / 阵风")} value={`${number(selectedHour.windSpeedKmh, language, 0)} / ${number(selectedHour.windGustKmh, language, 0)} km/h`} detail={cardinalDirection(selectedHour.windDirectionDeg, text)} />
              <DataRow label={text("Visibility", "能见度")} value={selectedHour.visibilityM == null ? "—" : `${number(selectedHour.visibilityM / 1000, language, 1)} km`} />
              <DataRow label={text("Freezing level", "冻结层高度")} value={selectedHour.freezingLevelM == null ? "—" : `${integer(selectedHour.freezingLevelM, language)} m`} detail={selectedHour.freezingLevelM == null || selectedForecast.elevationM == null ? undefined : `${integer(selectedHour.freezingLevelM - selectedForecast.elevationM, language)} m ${text("above sampled ground", "高于采样地面")}`} />
              <DataRow label={text("Cloud low / mid / high", "低 / 中 / 高云")} value={`${number(selectedHour.cloudCoverLowPct, language, 0)} / ${number(selectedHour.cloudCoverMidPct, language, 0)} / ${number(selectedHour.cloudCoverHighPct, language, 0)}%`} detail={`${number(selectedHour.cloudCoverPct, language, 0)}% ${text("total cover", "总云量")}`} />
              <DataRow label={text("Pressure surface / MSL", "地面 / 海平面气压")} value={`${number(selectedHour.surfacePressureHpa, language, 0)} / ${number(selectedHour.pressureMslHpa, language, 0)} hPa`} />
              <DataRow label={text("UV / CAPE", "紫外线 / CAPE")} value={`${number(selectedHour.uvIndex, language, 1)} / ${number(selectedHour.capeJkg, language, 0)} J/kg`} />
              <DataRow label={text("Point / model", "点位 / 模型")} value={`${roleLabel(selectedForecast.point.role, text)} · ${selectedForecast.model ?? "—"}`} detail={`${selectedForecast.latitude.toFixed(4)}, ${selectedForecast.longitude.toFixed(4)} · ${selectedForecast.timezone ?? "—"}`} />
            </dl>

            <div className="pro-weather-route-cross-section">
              <div className="pro-weather-block-heading compact">
                <div><h4>{text("Route cross-section", "路线横截面")}</h4></div>
                <span>{text("nearest matching provider hour at each sample", "每个采样点的最近匹配服务商小时")}</span>
              </div>
              <div className="pro-weather-sample-grid">
                {selectedPointSnapshots.map(({ forecast, sample }) => (
                  <article key={forecast.point.id}>
                    <span>{roleLabel(forecast.point.role, text)}</span>
                    <strong>{number(sample.temperatureC, language, 1)}°C · {integer(sample.indices.difficulty, language)}/100</strong>
                    <small>{number(sample.windGustKmh, language, 0)} km/h {text("gust", "阵风")} · {number(sample.precipitationProbabilityPct, language, 0)}% {text("precip", "降水")}</small>
                  </article>
                ))}
              </div>
            </div>

            <div className="pro-weather-coverage">
              <div className="pro-weather-block-heading compact">
                <div><h4>{text("Field coverage", "字段覆盖率")}</h4></div>
                <span>{selectedForecast.hourly.length} {text("hourly rows", "小时行")}</span>
              </div>
              <div className="pro-weather-coverage-grid">
                {coverageRows.map(([label, value]) => (
                  <div key={label} style={{ "--weather-coverage": `${value}%` } as CSSProperties}>
                    <span>{label}</span><strong>{value}%</strong><i aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="pro-inline-note">{weather.status === "loading" ? text("Fetching the forecast…", "正在获取预报…") : text("No point forecast is available. The monthly climate matrix remains usable below.", "没有可用的点位预报。下方月度气候矩阵仍可使用。")}</p>
        )}
      </section>

      <section className="pro-weather-block" aria-labelledby="pro-weather-points-title"><div className="pro-weather-block-heading"><div><p className="pro-eyebrow">01 / {text("Route sampling", "路线采样")}</p><h4 id="pro-weather-points-title">{text("Representative points sent to the model", "发送给模型的代表性点位")}</h4></div><span>{data?.routePoints.length ?? 0} {text("coordinates", "个坐标")}</span></div>{forecasts.length ? <PointTable forecasts={forecasts} language={language} text={text} /> : data?.routePoints.length ? <div className="pro-weather-point-list">{data.routePoints.map((point) => <span key={point.id}>{roleLabel(point.role, text)} · {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}</span>)}</div> : <p className="pro-inline-note">{text("A saved GPX is needed to sample weather along the route.", "需要已保存的 GPX 才能沿路线采样天气。")}</p>}</section>

      <section className="pro-weather-block" aria-labelledby="pro-weather-monthly-title"><div className="pro-weather-block-heading"><div><p className="pro-eyebrow">02 / {text("Seasonal baseline", "季节基线")}</p><h4 id="pro-weather-monthly-title">{text("Twelve-month matrix", "十二个月矩阵")}</h4></div><span>{text("Climate context", "气候背景")}</span></div>{monthly.length === 12 ? <MonthlyMatrix rows={monthly} selectedMonth={month} language={language} text={text} /> : <p className="pro-inline-note">{text("Monthly values will appear after the route is read.", "读取路线后显示月度数据。")}</p>}</section>

      <section className="pro-weather-block" aria-labelledby="pro-weather-daily-title"><div className="pro-weather-block-heading"><div><p className="pro-eyebrow">03 / {text("Date-specific model", "日期模型")}</p><h4 id="pro-weather-daily-title">{text("Route-wide daily forecast", "路线每日预报")}</h4></div><span>{daily.length ? `${daily.length} ${text("days", "天")}` : "—"}</span></div>{daily.length ? <DailyForecastTable rows={daily} language={language} text={text} /> : <p className="pro-inline-note">{weather.status === "loading" ? text("Fetching the forecast…", "正在获取预报…") : text("No date-specific forecast is available for this route right now.", "当前没有此路线的日期预报。")}</p>}</section>

      <section className="pro-weather-block" aria-labelledby="pro-weather-hourly-title"><div className="pro-weather-block-heading"><div><p className="pro-eyebrow">04 / {text("Hourly fields", "小时字段")}</p><h4 id="pro-weather-hourly-title">{text("Selected point · full forecast day", "所选点位 · 完整预报日")}</h4></div><span>{hourlyRows.length ? `${hourlyRows.length} ${text("rows shown", "行已显示")} · ${selectedDate ?? "—"}` : "—"}</span></div>{hourlyRows.length ? <HourlyTable rows={hourlyRows} language={language} text={text} /> : <p className="pro-inline-note">{text("Hourly provider fields will appear when a live forecast responds.", "实时预报响应后显示小时服务商字段。")}</p>}</section>

      <section className="pro-weather-block pro-weather-atmosphere" aria-labelledby="pro-weather-atmosphere-title"><div className="pro-weather-block-heading"><div><p className="pro-eyebrow">05 / {text("Atmospheric detail", "大气细节")}</p><h4 id="pro-weather-atmosphere-title">{text("First route sample at a glance", "首个路线采样点概览")}</h4></div><span>{firstForecast ? roleLabel(firstForecast.point.role, text) : "—"}</span></div><dl className="pro-weather-data-grid">
        <DataRow label={text("Coordinates", "坐标")} value={firstForecast ? `${firstForecast.latitude.toFixed(5)}, ${firstForecast.longitude.toFixed(5)}` : "—"} />
        <DataRow label={text("Elevation", "海拔")} value={firstForecast?.elevationM == null ? "—" : `${integer(firstForecast.elevationM, language)} m`} />
        <DataRow label={text("Temperature / feels", "温度 / 体感")} value={firstForecast?.hourly[0] ? `${number(firstForecast.hourly[0].temperatureC, language, 1)}° / ${number(firstForecast.hourly[0].apparentTemperatureC, language, 1)}°C` : "—"} />
        <DataRow label={text("Humidity / dew point", "湿度 / 露点")} value={firstForecast?.hourly[0] ? `${number(firstForecast.hourly[0].humidityPct, language, 0)}% / ${number(firstForecast.hourly[0].dewPointC, language, 1)}°C` : "—"} />
        <DataRow label={text("Rain / snow", "降雨 / 降雪")} value={firstForecast?.hourly[0] ? `${number(firstForecast.hourly[0].precipitationMm, language, 1)} mm / ${number(firstForecast.hourly[0].snowfallCm, language, 1)} cm` : "—"} />
        <DataRow label={text("Cloud layers", "云层") } value={firstForecast?.hourly[0] ? `${integer(firstForecast.hourly[0].cloudCoverLowPct, language)} / ${integer(firstForecast.hourly[0].cloudCoverMidPct, language)} / ${integer(firstForecast.hourly[0].cloudCoverHighPct, language)}%` : "—"} detail={text("low / mid / high", "低 / 中 / 高")} />
        <DataRow label={text("Wind / gust", "风速 / 阵风")} value={firstForecast?.hourly[0] ? `${integer(firstForecast.hourly[0].windSpeedKmh, language)} / ${integer(firstForecast.hourly[0].windGustKmh, language)} km/h` : "—"} />
        <DataRow label={text("Visibility", "能见度")} value={firstForecast?.hourly[0]?.visibilityM == null ? "—" : `${number(firstForecast.hourly[0].visibilityM / 1000, language, 1)} km`} detail={text("atmospheric visibility", "大气能见度")} />
        <DataRow label={text("Freezing level", "冻结层高度")} value={firstForecast?.hourly[0]?.freezingLevelM == null ? "—" : `${integer(firstForecast.hourly[0].freezingLevelM, language)} m`} />
        <DataRow label={text("Pressure", "气压")} value={firstForecast?.hourly[0] ? `${integer(firstForecast.hourly[0].surfacePressureHpa ?? firstForecast.hourly[0].pressureMslHpa, language)} hPa` : "—"} />
        <DataRow label={text("UV / CAPE", "紫外线 / CAPE")} value={firstForecast?.hourly[0] ? `${number(firstForecast.hourly[0].uvIndex, language, 1)} / ${integer(firstForecast.hourly[0].capeJkg, language)} J/kg` : "—"} />
        <DataRow label={text("Condition", "天气")} value={firstForecast?.hourly[0] ? codeLabel(firstForecast.hourly[0].weatherCode, text) : "—"} />
        <DataRow label={text("First day light", "首日光照")} value={firstForecast?.daily[0] ? `${timeOnly(firstForecast.daily[0].sunrise, language)}–${timeOnly(firstForecast.daily[0].sunset, language)}` : "—"} detail={firstForecast?.daily[0] ? `${durationLabel(firstForecast.daily[0].daylightSeconds, language)} · ${durationLabel(firstForecast.daily[0].sunshineSeconds, language)} ${text("sunshine", "日照")}` : undefined} />
        <DataRow label={text("Rain hours", "降水时长")} value={firstForecast?.daily[0] ? `${integer(firstForecast.daily[0].precipitationHours, language)} h` : "—"} detail={firstForecast?.daily[0] ? `${number(firstForecast.daily[0].precipitationProbabilityMaxPct, language, 0)}% ${text("maximum probability", "最高概率")}` : undefined} />
      </dl></section>

      <p className="pro-weather-note">{attribution.length ? attribution.map((entry) => localizeWeatherAttribution(entry, language)).join(" · ") : text("Weather data attribution will appear when a provider responds.", "服务商响应后显示天气数据来源。")}{" "}{text("Seasonal values are climate context, not a long-range forecast. Monthly snow/ice, storm and visibility values are transparent planning proxies; check official warnings before travelling.", "季节数值是气候背景，不是长期预报。月度降雪/结冰、风暴和能见度数值是透明的规划代理；出行前请查看官方预警。")}</p>
    </section>
  );
}
