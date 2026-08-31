"use client";

import { DragEvent, FormEvent, useId, useState } from "react";
import {
  clampMovingMinutesForPlan,
  maximumMovingMinutesForPlan,
  minimumMovingMinutesForPlan,
  parseGpxRoute,
  saveRoutePreview,
  type RoutePreview,
  type SurveyInput,
  type TripMode,
} from "../_lib/route-data";
import type { SampleRouteDefinition } from "../_lib/sample-routes";
import { useLanguage } from "./language-system";
import { usePageTransition } from "./page-transition";
import { SampleLibrary } from "./sample-library";

type IntakeError =
  | "gpx-only"
  | "read-failed"
  | "invalid-gpx"
  | "too-few-points"
  | "invalid-survey"
  | "sample-failed"
  | "analysis-failed";

function formNumber(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  if (!Number.isFinite(value)) throw new Error(`Invalid survey value: ${name}`);
  return value;
}

export function RouteIntake() {
  const transitionTo = usePageTransition();
  const { language, text } = useLanguage();
  const inputId = useId();
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<IntakeError | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [uploadedText, setUploadedText] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<RoutePreview["source"]["kind"]>("uploaded-gpx");
  const [isSampleLibraryOpen, setIsSampleLibraryOpen] = useState(false);
  const [tripMode, setTripMode] = useState<TripMode>("single-day");
  const [plannedDays, setPlannedDays] = useState("5");
  const [movingHours, setMovingHours] = useState("7");
  const [movingMinutes, setMovingMinutes] = useState("0");

  function clampMovingTime(nextMode: TripMode, nextDays: number) {
    const totalMinutes = (Number(movingHours) || 0) * 60 +
      (Number(movingMinutes) || 0);
    const clamped = clampMovingMinutesForPlan(totalMinutes, nextMode, nextDays);
    setMovingHours(String(Math.floor(clamped / 60)));
    setMovingMinutes(String(clamped % 60));
  }

  function selectTripMode(nextMode: TripMode) {
    setTripMode(nextMode);
    const nextDays = nextMode === "multi-day" ? Number(plannedDays) : 1;
    clampMovingTime(nextMode, nextDays);
  }

  function updatePlannedDays(nextValue: string) {
    setPlannedDays(nextValue);
    if (nextValue !== "" && Number.isFinite(Number(nextValue))) {
      clampMovingTime("multi-day", Number(nextValue));
    }
  }

  async function selectFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setError("gpx-only");
      return;
    }

    try {
      setIsReading(true);
      const text = await file.text();
      setFileName(file.name);
      setUploadedText(text);
      setSourceKind("uploaded-gpx");
      setError(null);
    } catch {
      setError("read-failed");
    } finally {
      setIsReading(false);
    }
  }

  async function selectSampleRoute(route: SampleRouteDefinition) {
    setIsSampleLibraryOpen(false);
    setIsReading(true);
    setFileName("");
    setUploadedText(null);
    setError(null);

    try {
      const response = await fetch(route.assetPath);
      if (!response.ok) throw new Error(`Sample request failed with ${response.status}`);

      const routeText = await response.text();
      setFileName(`${language === "zh" ? route.chineseName : route.englishName}.gpx`);
      setUploadedText(routeText);
      setSourceKind("sample");
    } catch {
      setError("sample-failed");
    } finally {
      setIsReading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void selectFile(event.dataTransfer.files[0]);
  }

  function beginPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    let survey: SurveyInput;

    try {
      const selectedTripMode = String(
        formData.get("tripMode") ?? "single-day",
      ) as TripMode;
      survey = {
        activity: String(formData.get("activity") ?? "day-hike") as SurveyInput["activity"],
        tripMode: selectedTripMode,
        plannedDays: selectedTripMode === "multi-day"
          ? formNumber(formData, "plannedDays")
          : 1,
        sex: String(formData.get("sex") ?? "") as SurveyInput["sex"],
        ageYears: formNumber(formData, "ageYears"),
        bodyWeightKg: formNumber(formData, "bodyWeightKg"),
        heightCm: formNumber(formData, "heightCm"),
        packWeightKg: formNumber(formData, "packWeightKg"),
        movingHours: formNumber(formData, "movingHours"),
        movingMinutes: formNumber(formData, "movingMinutes"),
      };

      if (
        !["day-hike", "trail-run", "backpacking"].includes(survey.activity) ||
        !["single-day", "multi-day"].includes(survey.tripMode) ||
        !Number.isInteger(survey.plannedDays) ||
        survey.plannedDays < 1 ||
        survey.plannedDays > 30 ||
        (survey.tripMode === "single-day" && survey.plannedDays !== 1) ||
        (survey.tripMode === "multi-day" && survey.plannedDays < 2) ||
        !["male", "female"].includes(survey.sex) ||
        !Number.isInteger(survey.ageYears) ||
        survey.ageYears < 13 ||
        survey.ageYears > 100 ||
        survey.bodyWeightKg < 30 ||
        survey.bodyWeightKg > 250 ||
        survey.heightCm < 120 ||
        survey.heightCm > 230 ||
        survey.packWeightKg < 0 ||
        survey.packWeightKg > 60 ||
        !Number.isInteger(survey.movingHours) ||
        survey.movingHours < 0 ||
        survey.movingHours > 480 ||
        !Number.isInteger(survey.movingMinutes) ||
        survey.movingMinutes < 0 ||
        survey.movingMinutes > 59 ||
        survey.movingHours * 60 + survey.movingMinutes <
          minimumMovingMinutesForPlan(survey.tripMode, survey.plannedDays) ||
        survey.movingHours * 60 + survey.movingMinutes >
          maximumMovingMinutesForPlan(survey.tripMode, survey.plannedDays)
      ) {
        throw new Error("Survey values are outside the supported range.");
      }
    } catch {
      setError("invalid-survey");
      return;
    }

    let preview: RoutePreview;
    try {
      preview = parseGpxRoute(fileName, uploadedText ?? "", survey, sourceKind);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "";
      setError(
        message.includes("at least two")
          ? "too-few-points"
          : message.includes("could not be read")
            ? "invalid-gpx"
            : "analysis-failed",
      );
      return;
    }

    saveRoutePreview(preview);
    transitionTo("/analyzing");
  }

  return (
    <div className="minimal-intake" id="route-input">
      <div
        className={`minimal-drop${isDragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <label className="minimal-drop-label" htmlFor={inputId}>
          <span className="drop-symbol" aria-hidden="true">
            <i className="drop-mountain-one" />
            <i className="drop-mountain-two" />
            <b />
            <em />
          </span>
          <span className="visually-hidden">
            {text("Choose a GPX route file", "选择 GPX 路线文件")}
          </span>
        </label>
        <input
          className="visually-hidden"
          id={inputId}
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={(event) => void selectFile(event.target.files?.[0])}
        />
      </div>

      <button
        className="sample-library-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-controls="sample-library-dialog"
        aria-expanded={isSampleLibraryOpen}
        disabled={isReading}
        onClick={() => setIsSampleLibraryOpen(true)}
      >
        <span aria-hidden="true" />
        {text("Sample library", "示例路线库")}
        <small aria-hidden="true">05</small>
      </button>
      <span className="intake-error" role={isReading ? "status" : "alert"} aria-live="polite">
        {isReading
          ? text("Loading route", "正在载入路线")
          : error === "gpx-only"
            ? text("GPX files only", "仅支持 GPX 文件")
            : error === "read-failed"
              ? text("Could not read this file", "无法读取此文件")
              : error === "invalid-gpx"
                ? text("This GPX file could not be read", "无法解析此 GPX 文件")
                : error === "too-few-points"
                  ? text("This file needs at least two route points", "此文件至少需要两个路线点")
                  : error === "invalid-survey"
                    ? text("Check the trip and profile values", "请检查行程与个人资料数值")
                    : error === "sample-failed"
                      ? text("Could not load this sample route", "无法载入此示例路线")
                      : error === "analysis-failed"
                        ? text("This route could not be analysed", "无法分析此路线")
                        : ""}
      </span>

      <SampleLibrary
        open={isSampleLibraryOpen}
        disabled={isReading}
        onClose={() => setIsSampleLibraryOpen(false)}
        onSelect={(route) => void selectSampleRoute(route)}
      />

      {fileName && (
        <div className="survey-scrim" role="dialog" aria-modal="true" aria-labelledby="trip-setup-title">
          <form className="survey-glass" onSubmit={beginPreview}>
            <div className="survey-topline">
              <div>
                <span>{text("Trip setup", "行程设置")}</span>
                <h2 id="trip-setup-title">{text("Set the attempt.", "设定本次行程。")}</h2>
              </div>
              <button
                className="survey-close"
                type="button"
                aria-label={text("Close trip setup", "关闭行程设置")}
                onClick={() => setFileName("")}
              >
                ×
              </button>
            </div>

            <p className="selected-route">{fileName}</p>

            <div className="survey-choice-groups">
              <fieldset className="survey-fieldset compact-fieldset">
                <legend>{text("Activity", "活动类型")}</legend>
                <div className="choice-row">
                  {[
                    ["day-hike", text("Hike", "徒步")],
                    ["trail-run", text("Run", "越野跑")],
                    ["backpacking", text("Backpack", "背包徒步")],
                  ].map(([value, label], index) => (
                    <label key={value}>
                      <input type="radio" name="activity" value={value} defaultChecked={index === 0} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="survey-fieldset compact-fieldset">
                <legend>{text("Gender", "性别")}</legend>
                <div className="choice-row">
                  {[
                    ["male", text("Male", "男")],
                    ["female", text("Female", "女")],
                  ].map(([value, label], index) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="sex"
                        value={value}
                        defaultChecked={index === 0}
                        required
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="survey-schedule-row">
              <fieldset className="survey-fieldset compact-fieldset survey-schedule-fieldset">
                <legend>{text("Trip length", "行程类型")}</legend>
                <div className="choice-row">
                  {[
                    ["single-day", text("Single day", "单日")],
                    ["multi-day", text("Multi-day", "多日")],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="tripMode"
                        value={value}
                        checked={tripMode === value}
                        onChange={() => selectTripMode(value as TripMode)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {tripMode === "multi-day" ? (
                <label className="survey-control survey-days-control">
                  <span>{text("Planned days", "计划天数")}</span>
                  <span className="measurement-input">
                    <input
                      aria-label={text("Number of planned route days", "计划路线天数")}
                      aria-describedby="survey-stage-method"
                      name="plannedDays"
                      type="number"
                      min="2"
                      max="30"
                      step="1"
                      value={plannedDays}
                      onChange={(event) => updatePlannedDays(event.target.value)}
                      required
                    />
                    <small>{text("days", "天")}</small>
                  </span>
                </label>
              ) : null}
              <p id="survey-stage-method">
                {text(
                  "Multi-day routes are balanced into estimated daily stages.",
                  "多日路线会被均衡拆分为估算的每日阶段。",
                )}
              </p>
            </div>

            <div className="survey-grid compact-grid">
              <label className="survey-control survey-time-control">
                <span>{text("Total moving time", "全程移动时间")}</span>
                <span className="time-inputs">
                  <input
                    aria-label={text("Total moving time hours", "全程移动时间（小时）")}
                    name="movingHours"
                    type="number"
                    min="0"
                    max={maximumMovingMinutesForPlan(
                      tripMode,
                      tripMode === "multi-day" ? Number(plannedDays) : 1,
                    ) / 60}
                    value={movingHours}
                    onChange={(event) => setMovingHours(event.target.value)}
                    required
                  />
                  <small>{text("hr", "时")}</small>
                  <input
                    aria-label={text("Moving time minutes", "移动时间（分钟）")}
                    name="movingMinutes"
                    type="number"
                    min="0"
                    max="59"
                    value={movingMinutes}
                    onChange={(event) => setMovingMinutes(event.target.value)}
                    required
                  />
                  <small>{text("min", "分")}</small>
                </span>
              </label>

              <label className="survey-control">
                <span>{text("Pack weight", "背包重量")}</span>
                <span className="measurement-input">
                  <input aria-label={text("Pack weight in kilograms", "背包重量（公斤）")} name="packWeightKg" type="number" min="0" max="60" step="0.1" defaultValue="5" required />
                  <small>{text("kg", "公斤")}</small>
                </span>
              </label>

              <label className="survey-control">
                <span>{text("Age", "年龄")}</span>
                <span className="measurement-input">
                  <input aria-label={text("Age in years", "年龄（岁）")} name="ageYears" type="number" min="13" max="100" step="1" defaultValue="25" required />
                  <small>{text("yr", "岁")}</small>
                </span>
              </label>

              <label className="survey-control">
                <span>{text("Body weight", "体重")}</span>
                <span className="measurement-input">
                  <input aria-label={text("Body weight in kilograms", "体重（公斤）")} name="bodyWeightKg" type="number" min="30" max="250" step="0.1" defaultValue="70" required />
                  <small>{text("kg", "公斤")}</small>
                </span>
              </label>

              <label className="survey-control">
                <span>{text("Height", "身高")}</span>
                <span className="measurement-input">
                  <input aria-label={text("Height in centimeters", "身高（厘米）")} name="heightCm" type="number" min="120" max="230" step="1" defaultValue="170" required />
                  <small>{text("cm", "厘米")}</small>
                </span>
              </label>
            </div>

            <p className="survey-privacy-note">
              {text(
                "Profile values stay in this browser and support the planned route-demand estimates.",
                "个人资料只保存在此浏览器中，用于后续路线需求估算。",
              )}
            </p>

            <button className="primary-action survey-submit" type="submit">
              {text("Begin preview", "开始预览")} <span aria-hidden="true">↗</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
