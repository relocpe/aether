import {
  average,
  clamp,
  contrastRatio,
  ensureContrast,
  hexToRgb,
  hslToRgb,
  hueDistance,
  hueDelta,
  rgbToHex,
  rgbToHsl,
  wrapHue,
  type RGB,
} from "./color";

export type ExtractMode =
  | "normal"
  | "monochromatic"
  | "analogous"
  | "pastel"
  | "material"
  | "colorful"
  | "muted"
  | "bright";

export type PaletteAdjustments = {
  vibrance: number;
  saturation: number;
  contrast: number;
  brightness: number;
  shadows: number;
  highlights: number;
  hue: number;
  temperature: number;
};

export const defaultAdjustments: PaletteAdjustments = {
  vibrance: 0,
  saturation: 0,
  contrast: 0,
  brightness: 0,
  shadows: 0,
  highlights: 0,
  hue: 0,
  temperature: 0,
};

export const MODES: { id: ExtractMode; name: string; hint: string }[] = [
  { id: "normal", name: "Обычный", hint: "Баланс цветов, которые реально есть на фото" },
  { id: "monochromatic", name: "Монохром", hint: "Один ведущий оттенок, разная светлота" },
  { id: "analogous", name: "Аналоговый", hint: "Соседние цвета на круге" },
  { id: "pastel", name: "Пастель", hint: "Мягкие, высветленные тона" },
  { id: "material", name: "Material", hint: "Ровная насыщенность, как в Material" },
  { id: "colorful", name: "Цветной", hint: "Максимум сочности" },
  { id: "muted", name: "Приглушённый", hint: "Сероватые, спокойные цвета" },
  { id: "bright", name: "Яркий", hint: "Светлые и чистые акценты" },
];

export const ANSI_NAMES = [
  "Фон",
  "Красный",
  "Зелёный",
  "Жёлтый",
  "Синий",
  "Пурпурный",
  "Бирюзовый",
  "Текст",
  "Яркий чёрный",
  "Яркий красный",
  "Яркий зелёный",
  "Яркий жёлтый",
  "Яркий синий",
  "Яркий пурпурный",
  "Яркий бирюзовый",
  "Яркий белый",
] as const;

const ROLE_HUES = [0, 6, 132, 46, 226, 318, 188, 0] as const;
const ROLE_KEYS = ["bg", "red", "green", "yellow", "blue", "magenta", "cyan", "fg"] as const;

export type Cluster = { color: RGB; count: number };

function colorDistance(a: RGB, b: RGB) {
  const ha = rgbToHsl(a);
  const hb = rgbToHsl(b);
  const dh = hueDistance(ha.h, hb.h) / 180;
  const ds = ha.s - hb.s;
  const dl = ha.l - hb.l;
  const sat = Math.max(ha.s, hb.s);
  return dh * dh * (0.25 + sat * 2.4) + ds * ds * 0.45 + dl * dl;
}

/**
 * Groups pixels into a coarse histogram, then merges the closest bins.
 * A plain median cut spends every cut on the wallpaper's dominant background
 * and loses the smaller accent colors.
 */
export function medianCut(pixels: RGB[], count = 14): Cluster[] {
  if (pixels.length === 0) return [];
  const bins = new Map<number, { r: number; g: number; b: number; count: number }>();
  for (const pixel of pixels) {
    const key = ((pixel.r >> 3) << 10) | ((pixel.g >> 3) << 5) | (pixel.b >> 3);
    const bin = bins.get(key);
    if (bin) {
      bin.r += pixel.r;
      bin.g += pixel.g;
      bin.b += pixel.b;
      bin.count += 1;
    } else {
      bins.set(key, { r: pixel.r, g: pixel.g, b: pixel.b, count: 1 });
    }
  }
  let clusters: Cluster[] = [...bins.values()]
    .filter((bin) => bin.count >= Math.max(2, pixels.length * 0.003))
    .map((bin) => ({
      color: { r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count },
      count: bin.count,
    }));
  if (clusters.length === 0) {
    return [{ color: average(pixels), count: pixels.length }];
  }
  while (clusters.length > count) {
    let bestI = 0;
    let bestJ = 1;
    let best = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const distance =
          colorDistance(clusters[i].color, clusters[j].color) *
          (1 + Math.log(clusters[i].count + clusters[j].count));
        if (distance < best) {
          best = distance;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const left = clusters[bestI];
    const right = clusters[bestJ];
    const total = left.count + right.count;
    const merged: Cluster = {
      color: {
        r: (left.color.r * left.count + right.color.r * right.count) / total,
        g: (left.color.g * left.count + right.color.g * right.count) / total,
        b: (left.color.b * left.count + right.color.b * right.count) / total,
      },
      count: total,
    };
    const next = clusters.filter((_, index) => index !== bestI && index !== bestJ);
    next.push(merged);
    clusters = next;
  }
  return clusters.sort((a, b) => b.count - a.count);
}

function percentileAverage(pixels: RGB[], start: number, end: number) {
  const sorted = pixels.slice().sort((a, b) => rgbToHsl(a).l - rgbToHsl(b).l);
  const from = Math.floor(sorted.length * start);
  const to = Math.max(from + 1, Math.floor(sorted.length * end));
  return average(sorted.slice(from, to));
}

function primaryHue(clusters: Cluster[]) {
  let best = 220;
  let bestScore = 0;
  for (const cluster of clusters) {
    const hsl = rgbToHsl(cluster.color);
    if (hsl.s < 0.12 || hsl.l < 0.08 || hsl.l > 0.92) continue;
    const mid = 1 - Math.min(1, Math.abs(hsl.l - 0.46) * 2);
    const score = hsl.s * (0.35 + mid) * Math.sqrt(cluster.count);
    if (score > bestScore) {
      bestScore = score;
      best = hsl.h;
    }
  }
  return best;
}

function assignRoles(clusters: Cluster[]) {
  const roles = ["red", "green", "yellow", "blue", "magenta", "cyan"] as const;
  const candidates: { role: (typeof roles)[number]; cluster: Cluster; distance: number }[] = [];
  for (const role of roles) {
    const target = ROLE_HUES[ROLE_KEYS.indexOf(role)];
    for (const cluster of clusters) {
      const hsl = rgbToHsl(cluster.color);
      if (hsl.s < 0.16 || hsl.l < 0.14 || hsl.l > 0.9) continue;
      const distance = hueDistance(hsl.h, target);
      candidates.push({ role, cluster, distance });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || b.cluster.count - a.cluster.count);
  const usedRoles = new Set<string>();
  const usedClusters = new Set<Cluster>();
  const assigned = new Map<string, Cluster>();
  for (const candidate of candidates) {
    if (candidate.distance > 46) break;
    if (usedRoles.has(candidate.role) || usedClusters.has(candidate.cluster)) continue;
    usedRoles.add(candidate.role);
    usedClusters.add(candidate.cluster);
    assigned.set(candidate.role, candidate.cluster);
  }
  return roles.map((role) => {
    const found = assigned.get(role);
    const target = ROLE_HUES[ROLE_KEYS.indexOf(role)];
    if (!found) return { hue: target, sat: 0.58, lig: 0.52, role };
    const hsl = rgbToHsl(found.color);
    return { hue: hsl.h, sat: hsl.s, lig: hsl.l, role };
  });
}

function stylize(
  hue: number,
  sat: number,
  lig: number,
  mode: ExtractMode,
  primary: number,
  role: (typeof ROLE_KEYS)[number],
  light: boolean,
): RGB {
  let h = hue;
  let s = sat;
  let l = lig;

  if (mode === "monochromatic") {
    const shift: Record<string, [number, number]> = {
      red: [-12, 0.4],
      yellow: [14, 0.64],
      green: [6, 0.5],
      cyan: [18, 0.58],
      blue: [-6, 0.46],
      magenta: [-20, 0.54],
    };
    const [dh, rl] = shift[role] ?? [0, 0.5];
    h = primary + dh;
    s = 0.46;
    l = rl;
  } else if (mode === "analogous") {
    h = wrapHue(primary + hueDelta(primary, hue) * 0.34);
    s = clamp(s, 0.38, 0.72);
    l = clamp(l, 0.46, 0.64);
  } else if (mode === "pastel") {
    s = clamp(s * 0.62, 0.28, 0.5);
    l = light ? 0.46 : 0.7;
  } else if (mode === "material") {
    s = 0.58;
    l = light ? 0.42 : 0.54;
  } else if (mode === "colorful") {
    s = clamp(Math.max(s, 0.8), 0.72, 0.96);
    l = light ? 0.42 : 0.54;
  } else if (mode === "muted") {
    s = clamp(s * 0.4, 0.14, 0.34);
    l = light ? 0.4 : 0.52;
  } else if (mode === "bright") {
    s = clamp(Math.max(s, 0.68), 0.6, 0.9);
    l = light ? 0.48 : 0.66;
  } else {
    s = clamp(Math.max(s, 0.4), 0.4, 0.84);
    l = clamp(l, 0.44, 0.66);
  }

  if (light && mode !== "pastel" && mode !== "bright") {
    l = clamp(l * 0.78, 0.32, 0.5);
  }
  if (light && mode === "pastel") l = 0.46;
  if (light && mode === "bright") l = 0.5;

  return hslToRgb({ h, s, l });
}

function anchor(color: RGB, lightness: number, satScale: number) {
  const hsl = rgbToHsl(color);
  return hslToRgb({
    h: hsl.h,
    s: clamp(hsl.s * satScale, 0, 0.28),
    l: lightness,
  });
}

function brightVariant(color: RGB, light: boolean) {
  const hsl = rgbToHsl(color);
  if (light) {
    return hslToRgb({
      h: hsl.h,
      s: clamp(hsl.s + 0.12),
      l: clamp(hsl.l + 0.08, 0.2, 0.58),
    });
  }
  return hslToRgb({
    h: hsl.h,
    s: clamp(hsl.s + 0.1),
    l: clamp(hsl.l + 0.14, 0, 0.82),
  });
}

export function paletteFromClusters(
  clusters: Cluster[],
  pixels: RGB[],
  mode: ExtractMode,
  light: boolean,
): RGB[] {
  const source = pixels.length > 0 ? pixels : clusters.map((c) => c.color);
  const darkSeed = source.length ? percentileAverage(source, 0, 0.18) : { r: 16, g: 16, b: 20 };
  const lightSeed = source.length ? percentileAverage(source, 0.82, 1) : { r: 230, g: 228, b: 222 };
  const primary = primaryHue(clusters);

  const bgLightness: Record<ExtractMode, number> = {
    normal: light ? 0.94 : 0.11,
    monochromatic: light ? 0.95 : 0.12,
    analogous: light ? 0.94 : 0.12,
    pastel: light ? 0.96 : 0.2,
    material: light ? 0.95 : 0.13,
    colorful: light ? 0.95 : 0.09,
    muted: light ? 0.93 : 0.16,
    bright: light ? 0.96 : 0.13,
  };
  const background = anchor(
    light ? lightSeed : darkSeed,
    bgLightness[mode],
    light ? 0.28 : 0.7,
  );
  let foreground = anchor(light ? darkSeed : lightSeed, light ? 0.24 : 0.84, 0.35);
  let brightWhite = anchor(light ? darkSeed : lightSeed, light ? 0.16 : 0.96, 0.15);
  let brightBlack = anchor(darkSeed, light ? 0.42 : 0.34, 0.45);

  foreground = ensureContrast(foreground, background, 7);
  brightWhite = ensureContrast(brightWhite, background, 7);
  brightBlack = ensureContrast(brightBlack, background, 4.5);

  const chromaticSeeds = assignRoles(clusters);
  const chromatic: RGB[] = [];
  for (const seed of chromaticSeeds) {
    let color = stylize(seed.hue, seed.sat, seed.lig, mode, primary, seed.role, light);
    color = ensureContrast(color, background, 3.15);
    chromatic.push(color);
  }

  const bright = chromatic.map((color) => {
    const next = brightVariant(color, light);
    return ensureContrast(next, background, 3);
  });

  return [
    background,
    ...chromatic,
    foreground,
    brightBlack,
    ...bright,
    brightWhite,
  ];
}

export function paletteFromPixels(
  pixels: RGB[],
  mode: ExtractMode,
  light: boolean,
) {
  const clusters = medianCut(pixels, 12);
  return paletteFromClusters(clusters, pixels, mode, light);
}

function shiftHue(h: number, amount: number, target: number) {
  return wrapHue(h + hueDelta(h, target) * amount);
}

export function applyAdjustments(colors: RGB[], adj: PaletteAdjustments, light: boolean) {
  const shifted = colors.map((color, index) => {
    const neutral = index === 0 || index === 7 || index === 8 || index === 15;
    let { h, s, l } = rgbToHsl(color);
    const hueAmount = neutral ? adj.hue * 0.25 : adj.hue;
    h = wrapHue(h + hueAmount);
    if (adj.temperature !== 0 && s > 0.04) {
      const target = adj.temperature > 0 ? 30 : 214;
      const amount = (Math.abs(adj.temperature) / 50) * (neutral ? 0.18 : 0.42);
      h = shiftHue(h, amount, target);
      if (!neutral && adj.temperature > 0) s = clamp(s + 0.04);
    }
    s = clamp(s + adj.saturation / 140);
    const vibrance = adj.vibrance / 50;
    if (!neutral) s = clamp(s + vibrance * (1 - s) * 0.62);
    l = clamp(l + adj.brightness / 120);
    const contrast = adj.contrast / 30;
    l = clamp(0.5 + (l - 0.5) * (1 + contrast * 0.7));
    if (l < 0.5) l = clamp(l + (adj.shadows / 50) * (0.5 - l) * 0.85);
    else l = clamp(l + (adj.highlights / 50) * (l - 0.5) * 0.85);
    let next = hslToRgb({ h, s, l });
    if (light && index === 0) {
      const hsl = rgbToHsl(next);
      if (hsl.l < 0.86) next = hslToRgb({ ...hsl, l: Math.max(hsl.l, 0.9) });
    }
    return next;
  });
  const background = shifted[0] ?? { r: 16, g: 16, b: 20 };
  return shifted.map((color, index) => {
    if (index === 0) return color;
    const min = index === 7 || index === 15 ? 7 : index === 8 ? 4.5 : 3.05;
    if (contrastRatio(color, background) < min) return ensureContrast(color, background, min);
    return color;
  });
}

export function colorsToHex(colors: RGB[]) {
  return colors.map(rgbToHex);
}

export function hexesToColors(hexes: string[]) {
  return hexes.map((hex) => hexToRgb(hex) ?? { r: 0, g: 0, b: 0 });
}

export function withOverrides(colors: RGB[], overrides: (string | null)[]) {
  return colors.map((color, index) => {
    const override = overrides[index];
    if (!override) return color;
    return hexToRgb(override) ?? color;
  });
}
