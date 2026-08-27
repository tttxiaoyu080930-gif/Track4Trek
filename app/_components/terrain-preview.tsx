export function TerrainPreview() {
  return (
    <figure className="terrain-preview">
      <div className="terrain-toolbar">
        <div>
          <span className="toolbar-dot" aria-hidden="true" />
          <p>3D terrain preview</p>
        </div>
        <span>Module placeholder · Phase 3</span>
      </div>

      <div className="terrain-viewport" aria-hidden="true">
        <div className="terrain-grid" />
        <div className="terrain-orbit orbit-one" />
        <div className="terrain-orbit orbit-two" />
        <div className="terrain-mass mass-back" />
        <div className="terrain-mass mass-mid" />
        <div className="terrain-mass mass-front" />
        <div className="mock-route">
          <i className="route-segment segment-one" />
          <i className="route-segment segment-two" />
          <i className="route-segment segment-three" />
          <i className="route-segment segment-four" />
          <span className="route-point route-origin" />
          <span className="route-point route-finish" />
        </div>
        <span className="terrain-label label-start">Start · 38 m</span>
        <span className="terrain-label label-finish">Finish · 934 m</span>
        <div className="terrain-axis">
          <span>N</span>
          <i />
        </div>
        <p className="terrain-watermark">Terrain visualization area</p>
      </div>

      <figcaption>
        <span>Illustrative route</span>
        Interactive terrain and accurate route rendering arrive in Phase 3.
      </figcaption>
    </figure>
  );
}
