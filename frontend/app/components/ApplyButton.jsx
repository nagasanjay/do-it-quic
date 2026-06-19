"use client";

import { useState, useCallback } from "react";

/**
 * ApplyButton — primary action button with loading spinner and success/error flash.
 * Also includes a secondary Reset button.
 *
 * Props:
 *   onApply — async callback to apply current settings
 *   onReset — callback to reset sliders to zero
 *   disabled — whether the buttons should be disabled
 */
export default function ApplyButton({ onApply, onReset, disabled }) {
  const [state, setState] = useState("idle"); // idle | loading | success | error

  const handleApply = useCallback(async () => {
    if (state === "loading") return;

    setState("loading");
    try {
      await onApply();
      setState("success");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }, [onApply, state]);

  const handleReset = useCallback(async () => {
    if (state === "loading") return;
    onReset();
  }, [onReset, state]);

  const getButtonClass = () => {
    let cls = "btn btn--primary";
    if (state === "success") cls += " btn--success";
    if (state === "error") cls += " btn--error";
    return cls;
  };

  const getButtonContent = () => {
    switch (state) {
      case "loading":
        return (
          <>
            <span className="btn__spinner" />
            Applying…
          </>
        );
      case "success":
        return (
          <>
            ✓ Applied
          </>
        );
      case "error":
        return (
          <>
            ✗ Failed
          </>
        );
      default:
        return (
          <>
            ⚡ Apply Configuration
          </>
        );
    }
  };

  return (
    <div className="actions">
      <button
        id="apply-btn"
        className={getButtonClass()}
        onClick={handleApply}
        disabled={disabled || state === "loading"}
      >
        {getButtonContent()}
      </button>
      <button
        id="reset-btn"
        className="btn btn--secondary"
        onClick={handleReset}
        disabled={disabled || state === "loading"}
      >
        ↺ Reset
      </button>
    </div>
  );
}
