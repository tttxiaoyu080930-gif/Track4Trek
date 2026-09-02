"use client";

import { useEffect, useState } from "react";
import { ElevationProfile } from "../_components/elevation-profile";
import { EnvironmentCycle } from "../_components/environment-cycle";
import { useLanguage } from "../_components/language-system";
import { PostActivityForecast } from "../_components/post-activity-forecast";
import { ProRouteWorkspace } from "../_components/pro-route-workspace";
import { ResultModeSwitch } from "../_components/result-mode-switch";
import {
  RouteDemandMetrics,
  type AnalysisDisplayStatus,
} from "../_components/route-demand-metrics";
import { TrailMap } from "../_components/trail-map";
import { TrailSurfacePanel } from "../_components/trail-surface-panel";
import { WeatherDifficultyChart } from "../_components/weather-difficulty-chart";
import {
  calculateRouteDemand,
  type RouteDemandAnalysis,
} from "../_lib/route-demand";
import {
  readActiveRoutePreview,
  type RoutePreview,
} from "../_lib/route-data";

type StoredAnalysisState = {
  status: AnalysisDisplayStatus;
  analysis: RouteDemandAnalysis | null;
  preview: RoutePreview | null;
};

export default function ResultsPage() {
  const { language, text } = useLanguage();
  const [analysisState, setAnalysisState] = useState<StoredAnalysisState>({
    status: "loading",
    analysis: null,
    preview: null,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const preview = readActiveRoutePreview();
      if (!preview) {
        setAnalysisState({ status: "missing", analysis: null, preview: null });
        return;
      }

      try {
        setAnalysisState({
          status: "ready",
          analysis: calculateRouteDemand(preview),
          preview,
        });
      } catch {
        setAnalysisState({ status: "missing", analysis: null, preview: null });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="site-page results-page" id="main-content">
      <a className="skip-link" href="#terrain-result">
        {text("Skip to trail map", "跳至路线地图")}
      </a>
      <EnvironmentCycle />

      <ResultModeSwitch
        proContent={
          <ProRouteWorkspace
            status={analysisState.status}
            preview={analysisState.preview}
          />
        }
      >
        <TrailMap />

        <ElevationProfile />
        <TrailSurfacePanel
          preview={analysisState.preview}
          analysis={analysisState.analysis}
        />
        <WeatherDifficultyChart
          preview={analysisState.preview}
          analysis={analysisState.analysis}
        />
        <RouteDemandMetrics
          status={analysisState.status}
          analysis={analysisState.analysis}
        />
        <PostActivityForecast
          status={analysisState.status}
          analysis={analysisState.analysis}
        />
      </ResultModeSwitch>

      <div className="result-notes section-frame" id="result-notes">
        <div className="result-notes-copy result-story-panel">
          <p>
            {text(
              "Track4Trek reads the GPX file locally and renders its geographic route with MapLibre GL JS, OpenStreetMap and Mapterhorn terrain. The GPX file is not uploaded, although the map providers receive ordinary tile requests for the area being viewed.",
              "Track4Trek 会在浏览器本地读取 GPX 文件，并使用 MapLibre GL JS、OpenStreetMap 与 Mapterhorn 地形渲染真实地理路线。GPX 文件不会被上传，但地图服务商会收到当前查看区域的普通瓦片请求。",
            )}
          </p>
          <p>
            {text(
              "The ranges are planning suggestions, not medical advice, a fitness test or a safety guarantee. Conditions and trail access can change quickly; always check official forecasts, park notices and local guidance.",
              "这些范围仅供行程规划参考，不构成医疗建议、体能测试或安全保证。天气状况和路线开放情况可能迅速变化；出发前请务必查看官方天气预报、公园公告和当地指引。",
            )}
          </p>
          <p>
            {language === "zh" ? (
              <>
                此处显示的标签参考了 Garmin 公开的
                <a href="https://www8.garmin.com/manuals/webhelp/GUID-3A4F9C4A-8735-46C0-8DA9-65F11400B150/EN-US/GUID-A805A45B-D4A6-468B-A2E4-77325B876F52.html" target="_blank" rel="noreferrer">爬坡评分</a>、
                <a href="https://www8.garmin.com/manuals/webhelp/GUID-EA112C95-8563-4EED-AADF-2AADFBB95646/EN-US/GUID-573861DC-64B1-4120-847F-A944BA683DBA.html" target="_blank" rel="noreferrer">耐力分数</a>、
                <a href="https://www8.garmin.com/manuals/webhelp/GUID-1E5740B3-60A1-4890-B39A-7587060D785A/EN-US/GUID-1FBCCD9E-19E1-4E4C-BD60-1793B5B97EB3.html" target="_blank" rel="noreferrer">最大摄氧量</a>和
                <a href="https://www8.garmin.com/manuals/webhelp/GUID-3A4F9C4A-8735-46C0-8DA9-65F11400B150/EN-US/GUID-3ED97FFE-025E-47EA-9C70-DD86156617BD.html" target="_blank" rel="noreferrer">乳酸阈值</a>范围。所有路线建议均为 Track4Trek 的原创估算；Track4Trek 与 Garmin 无隶属关系，也未获得 Garmin 认可或背书。
              </>
            ) : (
              <>
                Garmin’s public reference ranges for <a href="https://www8.garmin.com/manuals/webhelp/GUID-3A4F9C4A-8735-46C0-8DA9-65F11400B150/EN-US/GUID-A805A45B-D4A6-468B-A2E4-77325B876F52.html" target="_blank" rel="noreferrer">Hill Score</a>, <a href="https://www8.garmin.com/manuals/webhelp/GUID-EA112C95-8563-4EED-AADF-2AADFBB95646/EN-US/GUID-573861DC-64B1-4120-847F-A944BA683DBA.html" target="_blank" rel="noreferrer">Endurance Score</a>, <a href="https://www8.garmin.com/manuals/webhelp/GUID-1E5740B3-60A1-4890-B39A-7587060D785A/EN-US/GUID-1FBCCD9E-19E1-4E4C-BD60-1793B5B97EB3.html" target="_blank" rel="noreferrer">VO₂ Max</a> and <a href="https://www8.garmin.com/manuals/webhelp/GUID-3A4F9C4A-8735-46C0-8DA9-65F11400B150/EN-US/GUID-3ED97FFE-025E-47EA-9C70-DD86156617BD.html" target="_blank" rel="noreferrer">Lactate Threshold</a> inform the labels shown here. All route recommendations are original Track4Trek estimates; Track4Trek is not affiliated with or endorsed by Garmin.
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
