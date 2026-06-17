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
 * @param {number} h - Hue 0–360
 * @param {number} s - Saturation 0–1
 * @param {number} v - Value 0–1
 * @returns {{ r: number, g: number, b: number }}
 */
export function hsvToRgb(h, s, v) {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;

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
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number} Hue 0–360
 */
export function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  hue *= 60;
  if (hue < 0) {
    hue += 360;
  }
  return hue;
}

/**
 * RGB cosine wheel: channels vary directly with angle, blended toward gray at the center.
 * @param {number} theta - Angle in radians
 * @param {number} radius - Normalized radius 0–1
 * @param {number} brightness - 0–1
 * @returns {{ r: number, g: number, b: number }}
 */
export function rgbWheelToRgb(theta, radius, brightness) {
  const rimR = brightness * (0.5 + 0.5 * Math.cos(theta));
  const rimG = brightness * (0.5 + 0.5 * Math.cos(theta - (2 * Math.PI) / 3));
  const rimB = brightness * (0.5 + 0.5 * Math.cos(theta - (4 * Math.PI) / 3));
  const gray = brightness;

  return {
    r: gray + (rimR - gray) * radius,
    g: gray + (rimG - gray) * radius,
    b: gray + (rimB - gray) * radius,
  };
}

/** @typedef {"hsl" | "hsv" | "rgb"} WheelColorModel */

/**
 * @param {number} theta - Angle in radians
 * @param {number} radius - Normalized radius 0–1 (saturation)
 * @param {number} level - HSL lightness, HSV value, or RGB brightness (0–1)
 * @param {WheelColorModel} model
 * @returns {{ h: number, s: number, model: WheelColorModel, l?: number, v?: number, brightness?: number, r: number, g: number, b: number }}
 */
export function wheelColorAt(theta, radius, level, model = "hsl") {
  const h = (theta / (2 * Math.PI)) * 360;
  const s = radius;

  switch (model) {
    case "hsv": {
      const rgb = hsvToRgb(h, s, level);
      return { h, s, v: level, model, ...rgb };
    }
    case "hsl": {
      const rgb = hslToRgb(h, s, level);
      return { h, s, l: level, model, ...rgb };
    }
    case "rgb": {
      const rgb = rgbWheelToRgb(theta, radius, level);
      return {
        h: rgbToHue(rgb.r, rgb.g, rgb.b),
        s: radius,
        brightness: level,
        model,
        ...rgb,
      };
    }
    default: {
      const unhandledModel = model;
      throw new Error(`Unhandled wheel color model: ${unhandledModel}`);
    }
  }
}

/** @typedef {"fail" | "aa" | "aaa" | "max"} WcagContrastLevel */

const WCAG_AA_LARGE_TEXT = 3;
const WCAG_AA_NORMAL_TEXT = 4.5;
const WCAG_AAA_NORMAL_TEXT = 7;
const WCAG_MAX_CONTRAST = 21;

/**
 * @param {number} contrast
 * @returns {WcagContrastLevel}
 */
export function wcagContrastLevel(contrast) {
  if (contrast >= WCAG_MAX_CONTRAST) {
    return "max";
  }
  if (contrast >= WCAG_AAA_NORMAL_TEXT) {
    return "aaa";
  }
  if (contrast >= WCAG_AA_LARGE_TEXT) {
    return "aa";
  }
  return "fail";
}

/**
 * @param {number} contrast
 * @returns {string}
 */
export function wcagContrastDescription(contrast) {
  if (contrast >= WCAG_MAX_CONTRAST) {
    return "Maximum contrast";
  }
  if (contrast >= WCAG_AAA_NORMAL_TEXT) {
    return "AAA normal text";
  }
  if (contrast >= WCAG_AA_NORMAL_TEXT) {
    return "AA normal text";
  }
  if (contrast >= WCAG_AA_LARGE_TEXT) {
    return "AA large text / UI";
  }
  return "Fails WCAG";
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

/**
 * @param {number} hueA
 * @param {number} hueB
 * @returns {number} Shortest distance on the hue circle in degrees
 */
function hueDistance(hueA, hueB) {
  const delta = Math.abs(hueA - hueB);
  return Math.min(delta, 360 - delta);
}

/**
 * @param {{ contrast: number, h: number }[]} vertexMeta
 * @param {number} radialCount
 * @param {number} angularCount
 * @param {(hue: number) => boolean} hueInRange
 * @returns {number}
 */
function maxContrastIndexInHueRange(
  vertexMeta,
  radialCount,
  angularCount,
  hueInRange,
) {
  let bestIdx = 0;
  let bestContrast = -Infinity;

  for (let rIdx = 0; rIdx < radialCount; rIdx += 1) {
    for (let aIdx = 0; aIdx < angularCount; aIdx += 1) {
      const idx = rIdx * angularCount + aIdx;
      const { contrast, h } = vertexMeta[idx];
      if (hueInRange(h) && contrast > bestContrast) {
        bestContrast = contrast;
        bestIdx = idx;
      }
    }
  }

  return bestIdx;
}

/**
 * @param {{ contrast: number, h: number }[]} vertexMeta
 * @param {number} radialCount
 * @param {number} angularCount
 * @param {number} thirdIndex
 * @param {number} thirdCount
 * @returns {number}
 */
function maxContrastIndexInHueThird(
  vertexMeta,
  radialCount,
  angularCount,
  thirdIndex,
  thirdCount,
) {
  const thirdSize = 360 / thirdCount;
  const startHue = thirdIndex * thirdSize;

  return maxContrastIndexInHueRange(
    vertexMeta,
    radialCount,
    angularCount,
    (hue) => {
      if (thirdIndex === thirdCount - 1) {
        return hue >= startHue;
      }
      return hue >= startHue && hue < startHue + thirdSize;
    },
  );
}

/**
 * @param {{ contrast: number, h: number }[]} vertexMeta
 * @param {number} radialCount
 * @param {number} angularCount
 * @param {number} maxPeaks
 * @returns {number[]}
 */
function fallbackContrastPeaks(
  vertexMeta,
  radialCount,
  angularCount,
  maxPeaks,
) {
  /** @type {number[]} */
  const peaks = [];

  for (let thirdIndex = 0; thirdIndex < maxPeaks; thirdIndex += 1) {
    const idx = maxContrastIndexInHueThird(
      vertexMeta,
      radialCount,
      angularCount,
      thirdIndex,
      maxPeaks,
    );
    if (!peaks.includes(idx)) {
      peaks.push(idx);
    }
  }

  return peaks;
}

/**
 * @param {{ idx: number, contrast: number, h: number }[]} localMaxima
 * @param {{ contrast: number, h: number }[]} vertexMeta
 * @param {number} maxPeaks
 * @param {number} minHueSeparation
 * @returns {number[]}
 */
function selectSeparatedPeaks(
  localMaxima,
  vertexMeta,
  maxPeaks,
  minHueSeparation,
) {
  const sorted = [...localMaxima].sort((a, b) => b.contrast - a.contrast);
  /** @type {number[]} */
  const selected = [];

  for (const candidate of sorted) {
    if (selected.length >= maxPeaks) {
      break;
    }

    const separated = selected.every(
      (peakIdx) =>
        hueDistance(vertexMeta[peakIdx].h, candidate.h) >= minHueSeparation,
    );
    if (separated) {
      selected.push(candidate.idx);
    }
  }

  return selected;
}

/**
 * @param {number[]} selected
 * @param {{ contrast: number, h: number }[]} vertexMeta
 * @param {number} radialCount
 * @param {number} angularCount
 * @param {number} targetCount
 * @param {number} minHueSeparation
 * @returns {number[]}
 */
function supplementPeaksFromFallback(
  selected,
  vertexMeta,
  radialCount,
  angularCount,
  targetCount,
  minHueSeparation,
) {
  const fallback = fallbackContrastPeaks(
    vertexMeta,
    radialCount,
    angularCount,
    targetCount,
  );
  const sortedFallback = fallback
    .map((idx) => ({
      idx,
      contrast: vertexMeta[idx].contrast,
      h: vertexMeta[idx].h,
    }))
    .sort((a, b) => b.contrast - a.contrast);

  const merged = [...selected];

  for (const candidate of sortedFallback) {
    if (merged.length >= targetCount) {
      break;
    }
    if (merged.includes(candidate.idx)) {
      continue;
    }

    const separated = merged.every(
      (peakIdx) =>
        hueDistance(vertexMeta[peakIdx].h, candidate.h) >= minHueSeparation,
    );
    if (separated) {
      merged.push(candidate.idx);
    }
  }

  return merged;
}

const MAX_CONTRAST_PEAKS = 3;
const MIN_PEAK_HUE_SEPARATION = 60;

/**
 * Find up to three dominant local maxima on the contrast surface grid.
 * Returns however many well-separated peaks are found (1–3). Falls back to
 * the brightest point in each hue third only when no interior local maxima
 * are detected.
 *
 * @param {{ contrast: number, h: number }[]} vertexMeta
 * @param {number} radialCount
 * @param {number} angularCount
 * @returns {number[]} Vertex indices for up to three peaks
 */
export function findContrastPeaks(vertexMeta, radialCount, angularCount) {
  /** @type {{ idx: number, contrast: number, h: number }[]} */
  const localMaxima = [];

  for (let rIdx = 1; rIdx < radialCount - 1; rIdx += 1) {
    for (let aIdx = 0; aIdx < angularCount; aIdx += 1) {
      const idx = rIdx * angularCount + aIdx;
      const value = vertexMeta[idx].contrast;
      let isLocalMax = true;

      for (let dr = -1; dr <= 1 && isLocalMax; dr += 1) {
        for (let da = -1; da <= 1; da += 1) {
          if (dr === 0 && da === 0) {
            continue;
          }

          const neighborRadius = rIdx + dr;
          if (neighborRadius < 0 || neighborRadius >= radialCount) {
            isLocalMax = false;
            break;
          }

          const neighborAngle =
            (aIdx + da + angularCount) % angularCount;
          const neighborIdx = neighborRadius * angularCount + neighborAngle;
          if (vertexMeta[neighborIdx].contrast >= value) {
            isLocalMax = false;
            break;
          }
        }
      }

      if (isLocalMax) {
        localMaxima.push({
          idx,
          contrast: value,
          h: vertexMeta[idx].h,
        });
      }
    }
  }

  if (localMaxima.length === 0) {
    return fallbackContrastPeaks(
      vertexMeta,
      radialCount,
      angularCount,
      MAX_CONTRAST_PEAKS,
    );
  }

  const selected = selectSeparatedPeaks(
    localMaxima,
    vertexMeta,
    MAX_CONTRAST_PEAKS,
    MIN_PEAK_HUE_SEPARATION,
  );

  if (selected.length < 2) {
    return supplementPeaksFromFallback(
      selected,
      vertexMeta,
      radialCount,
      angularCount,
      2,
      MIN_PEAK_HUE_SEPARATION,
    );
  }

  return selected;
}
