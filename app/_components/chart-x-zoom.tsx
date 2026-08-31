type ChartXZoomProps = {
  id: string;
  label: string;
  zoom: number;
  maximum?: number;
  visibleRange: string;
  onChange: (zoom: number) => void;
};

type ChartXPanProps = {
  id: string;
  label: string;
  position: number;
  disabled: boolean;
  disabledText: string;
  visibleRange: string;
  onChange: (position: number) => void;
};

export function ChartXZoom({
  id,
  label,
  zoom,
  maximum = 8,
  visibleRange,
  onChange,
}: ChartXZoomProps) {
  return (
    <label className="chart-x-zoom" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="range"
        min="1"
        max={maximum}
        step="0.25"
        value={zoom}
        aria-valuetext={`${zoom.toFixed(2)}× · ${visibleRange}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output htmlFor={id}>
        <strong>{zoom.toFixed(2)}×</strong>
        <small>{visibleRange}</small>
      </output>
    </label>
  );
}

export function ChartXPan({
  id,
  label,
  position,
  disabled,
  disabledText,
  visibleRange,
  onChange,
}: ChartXPanProps) {
  const safePosition = Math.min(Math.max(position, 0), 1);
  const valueText = disabled ? disabledText : visibleRange;

  return (
    <label className="chart-x-pan" data-disabled={disabled} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(safePosition * 100)}
        disabled={disabled}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <output htmlFor={id}>{valueText}</output>
    </label>
  );
}
