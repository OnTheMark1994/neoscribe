import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../../../Global/ReduxSlices/SettingsSlice';
import './ColorPickerRow.css';

function clamp01(n) {
  if (Number.isNaN(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function rgbToHex(r, g, b) {
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
  const clean = (hex || '').replace('#', '').trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function parseColorToRgba(colorString, fallback) {
  const raw = (colorString ?? '').toString().trim();
  if (!raw) return fallback;

  if (raw === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  if (raw.startsWith('#')) {
    const rgb = hexToRgb(raw);
    if (rgb) return { ...rgb, a: 1 };
  }

  const rgbaMatch = raw.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)/i);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: clamp01(Number(rgbaMatch[4])),
    };
  }

  const rgbMatch = raw.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
      a: 1,
    };
  }

  return fallback;
}

function rgbaToCss({ r, g, b, a }) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp01(Number(a))})`;
}

export default function ColorPickerRow({ label, subLabel, settingKey, defaultValue }) {
  const dispatch = useDispatch();
  const storedValue = useSelector(state => state.settingsSlice.settingsObject?.[settingKey]);

  const defaultRgba = useMemo(
    () => parseColorToRgba(defaultValue, { r: 255, g: 255, b: 255, a: 1 }),
    [defaultValue]
  );

  const [rgba, setRgba] = useState(defaultRgba);
  const debounceRef = useRef(null);

  // Keep local UI in sync with Redux value.
  useEffect(() => {
    const next = parseColorToRgba(storedValue, defaultRgba);
    setRgba(next);
  }, [storedValue, defaultRgba]);

  const hexValue = useMemo(() => rgbToHex(rgba.r, rgba.g, rgba.b), [rgba.r, rgba.g, rgba.b]);
  const alphaValue = useMemo(() => clamp01(Number(rgba.a)), [rgba.a]);
  const cssValue = useMemo(() => rgbaToCss({ ...rgba, a: alphaValue }), [rgba, alphaValue]);

  const scheduleDispatch = (nextRgba) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dispatch(updateSetting({ key: settingKey, value: rgbaToCss(nextRgba) }));
    }, 150);
  };

  const onHexChange = (e) => {
    const rgb = hexToRgb(e.target.value);
    if (!rgb) return;
    const next = { ...rgba, ...rgb };
    setRgba(next);
    scheduleDispatch({ ...next, a: alphaValue });
  };

  const onAlphaChange = (e) => {
    const a = clamp01(Number(e.target.value));
    const next = { ...rgba, a };
    setRgba(next);
    scheduleDispatch(next);
  };

  const onReset = () => {
    const next = defaultRgba;
    setRgba(next);
    dispatch(updateSetting({ key: settingKey, value: rgbaToCss(next) }));
  };

  return (
    <div className="settingsRow">
      <div className="settingsRowLabel">
        <div className="settingsRowLabelTitle">{label}</div>
        <div className="settingsRowLabelSub">{subLabel}</div>
      </div>

      <div className="colorPickerContainer">
        <div className="colorPickerPreview" style={{ background: cssValue }} />

        <input
          type="color"
          className="colorPickerInput"
          value={hexValue}
          onChange={onHexChange}
        />

        <input
          type="range"
          className="colorPickerAlpha"
          min="0"
          max="1"
          step="0.01"
          value={alphaValue}
          onChange={onAlphaChange}
          aria-label="Alpha"
        />

        <button
          type="button"
          className="settingsButton colorPickerReset"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
