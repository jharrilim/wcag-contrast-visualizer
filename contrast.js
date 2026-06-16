/**
 * WCAG 2.x color contrast utilities.
 * All RGB values are sRGB in the 0–1 range unless noted.
 */

export function srgbToLinear(channel) {
  if (channel <= 0.04045) {
    return channel / 12.92;
  }
  return ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {number} r - Red 0–1
 * @param {number} g - Green 0–1
 * @param {number} b - Blue 0–1
 * @returns {number} Relative luminance
 */
export function relativeLuminance(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * @param {{ r: number, g: number, b: number }} colorA
 * @param {{ r: number, g: number, b: number }} colorB
 * @returns {number} Contrast ratio (1–21)
 */
export function contrastRatio(colorA, colorB) {
  const l1 = relativeLuminance(colorA.r, colorA.g, colorA.b);
  const l2 = relativeLuminance(colorB.r, colorB.g, colorB.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * @param {string} hex - "#rrggbb"
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return { r, g, b };
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {string} "#rrggbb"
 */
export function rgbToHex(rgb) {
  const toByte = (v) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(rgb.r)}${toByte(rgb.g)}${toByte(rgb.b)}`;
}

/**
 * @param {number} h - Hue 0–360
 * @param {number} s - Saturation 0–1
 * @param {number} l - Lightness 0–1
 * @returns {{ r: number, g: number, b: number }}
 */
export function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) {
    rPrime = c;
    gPrime = x;
  } else if (hue < 120) {
    rPrime = x;
    gPrime = c;
  } else if (hue < 180) {
    gPrime = c;
    bPrime = x;
  } else if (hue < 240) {
    gPrime = x;
    bPrime = c;
  } else if (hue < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return { r: rPrime + m, g: gPrime + m, b: bPrime + m };
}

/**
 * @param {number} theta - Angle in radians
 * @param {number} radius - Normalized radius 0–1 (saturation)
 * @param {number} lightness - Lightness 0–1
 * @returns {{ h: number, s: number, l: number, r: number, g: number, b: number }}
 */
export function wheelColorAt(theta, radius, lightness) {
  const h = (theta / (2 * Math.PI)) * 360;
  const s = radius;
  const rgb = hslToRgb(h, s, lightness);
  return { h, s, l: lightness, ...rgb };
}

/**
 * Map contrast ratio to scene height.
 * @param {number} contrast - 1–21
 * @param {number} scaleFactor
 * @returns {number}
 */
export function contrastToHeight(contrast, scaleFactor = 0.15) {
  return (contrast - 1) * scaleFactor;
}
