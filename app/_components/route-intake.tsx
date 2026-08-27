"use client";

import { DragEvent, FormEvent, useId, useState } from "react";

export function RouteIntake() {
  const inputId = useId();
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setError("GPX files only");
      return;
    }

    setFileName(file.name);
    setError("");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  function beginPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.assign("/analyzing");
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
          <span className="visually-hidden">Choose a GPX route file</span>
        </label>
        <input
          className="visually-hidden"
          id={inputId}
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
      </div>

      <button
        className="sample-route-link"
        type="button"
        onClick={() => {
          setFileName("Lantau_Ridge_sample.gpx");
          setError("");
        }}
      >
        Use sample
      </button>
      <span className="intake-error" role="alert">{error}</span>

      {fileName && (
        <div className="survey-scrim" role="dialog" aria-modal="true" aria-labelledby="trip-setup-title">
          <form className="survey-glass" onSubmit={beginPreview}>
            <div className="survey-topline">
              <div>
                <span>Trip setup</span>
                <h2 id="trip-setup-title">Set the attempt.</h2>
              </div>
              <button
                className="survey-close"
                type="button"
                aria-label="Close trip setup"
                onClick={() => setFileName("")}
              >
                ×
              </button>
            </div>

            <p className="selected-route">{fileName}</p>

            <fieldset className="survey-fieldset compact-fieldset">
              <legend>Activity</legend>
              <div className="choice-row">
                {[
                  ["day-hike", "Hike"],
                  ["trail-run", "Run"],
                  ["backpacking", "Backpack"],
                ].map(([value, label], index) => (
                  <label key={value}>
                    <input type="radio" name="activity" value={value} defaultChecked={index === 0} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="survey-grid compact-grid">
              <label className="survey-control">
                <span>Moving time</span>
                <span className="time-inputs">
                  <input aria-label="Moving time hours" type="number" min="0" max="48" defaultValue="7" />
                  <small>hr</small>
                  <input aria-label="Moving time minutes" type="number" min="0" max="59" defaultValue="0" />
                  <small>min</small>
                </span>
              </label>

              <label className="survey-control">
                <span>Pack</span>
                <select defaultValue="moderate">
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                </select>
              </label>

              <label className="survey-control">
                <span>Date</span>
                <input type="date" defaultValue="2026-10-18" />
              </label>
            </div>

            <button className="primary-action survey-submit" type="submit">
              Begin preview <span aria-hidden="true">↗</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
