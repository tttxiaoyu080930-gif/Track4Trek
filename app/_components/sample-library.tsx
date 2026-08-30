"use client";

import { useEffect, useRef } from "react";
import {
  SAMPLE_ROUTES,
  type SampleRouteDefinition,
} from "../_lib/sample-routes";
import { useLanguage } from "./language-system";

type SampleLibraryProps = {
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSelect: (route: SampleRouteDefinition) => void;
};

export function SampleLibrary({
  open,
  disabled = false,
  onClose,
  onSelect,
}: SampleLibraryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { language, text } = useLanguage();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className="sample-library-dialog"
      id="sample-library-dialog"
      ref={dialogRef}
      aria-labelledby="sample-library-title"
      aria-describedby="sample-library-note"
      onClose={onClose}
    >
      <div className="sample-library-panel">
        <div className="sample-library-topline">
          <div>
            <span>{text("Sample library", "示例路线库")}</span>
            <h2 id="sample-library-title">
              {text("Choose a route.", "选择一条路线。")}
            </h2>
          </div>
          <button
            className="sample-library-close"
            type="button"
            aria-label={text("Close sample library", "关闭示例路线库")}
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>

        <div className="sample-library-list">
          {SAMPLE_ROUTES.map((route, index) => (
            <button
              className="sample-route-option"
              type="button"
              key={route.id}
              disabled={disabled}
              onClick={() => onSelect(route)}
            >
              <span className="sample-route-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="sample-route-name">
                <strong>
                  {language === "zh" ? route.chineseName : route.englishName}
                </strong>
                <small lang={language === "zh" ? "en" : "zh-CN"}>
                  {language === "zh" ? route.englishName : route.chineseName}
                </small>
              </span>
              <span className="sample-route-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>

        <p className="sample-library-note" id="sample-library-note">
          <span aria-hidden="true" />
          {text("More routes coming soon.", "更多路线即将加入。")}
        </p>
      </div>
    </dialog>
  );
}
