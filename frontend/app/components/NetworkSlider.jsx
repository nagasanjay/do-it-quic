"use client";

import { useMemo } from "react";

/**
 * Returns a severity level based on the percentage of the value relative to its max.
 */
function getSeverity(value, max) {
  const ratio = value / max;
  if (ratio <= 0.01) return "optimal";
  if (ratio < 0.5) return "degraded";
  return "impaired";
}

/**
 * NetworkSlider — a glassmorphic card with an icon, label, current value, and styled range input.
 *
 * Props:
 *   label    — "Packet Loss" or "Latency"
 *   value    — current numeric value
 *   onChange — callback(newValue)
 *   min      — range minimum
 *   max      — range maximum
 *   step     — range step
 *   unit     — display unit string ("%" or "ms")
 *   icon     — emoji icon
 *   variant  — "cyan" or "violet" (controls gradient color)
 */
export default function NetworkSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  icon,
  variant = "cyan",
  id,
}) {
  const severity = useMemo(() => getSeverity(value, max), [value, max]);

  // Calculate the fill percentage for the track gradient
  const fillPercent = ((value - min) / (max - min)) * 100;

  // Build inline gradient for WebKit (Firefox uses ::-moz-range-progress)
  const gradientColors =
    variant === "cyan"
      ? `var(--accent-cyan-dim), var(--accent-cyan)`
      : `var(--accent-violet-dim), var(--accent-violet)`;

  const trackStyle = {
    background: `linear-gradient(90deg, ${gradientColors} ${fillPercent}%, var(--bg-elevated) ${fillPercent}%)`,
  };

  return (
    <div className="glass-card slider-card" id={id}>
      <div className="slider__header">
        <div className="slider__label-group">
          <span className="slider__icon">{icon}</span>
          <span className="slider__label">{label}</span>
        </div>
        <div className="slider__value-display">
          <span className={`slider__value slider__value--${severity}`}>
            {value}
          </span>
          <span className="slider__unit">{unit}</span>
        </div>
      </div>

      <div className="slider__input-wrapper">
        <input
          type="range"
          className={`slider__input slider__input--${variant}`}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={trackStyle}
          aria-label={`${label}: ${value}${unit}`}
        />
        <div className="slider__range-labels">
          <span className="slider__range-label">
            {min}
            {unit}
          </span>
          <span className="slider__range-label">
            {max}
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}
