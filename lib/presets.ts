export type ImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  vignette: number;
  temperature: number;
};

export const defaultImageAdjustments: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  vignette: 0,
  temperature: 0,
};

export const IMAGE_PRESETS: { id: string; name: string; values: ImageAdjustments }[] = [
  {
    id: "cinematic",
    name: "Кино",
    values: { brightness: 92, contrast: 126, saturation: 86, hue: 0, blur: 0, vignette: 0.55, temperature: -0.2 },
  },
  {
    id: "vintage",
    name: "Винтаж",
    values: { brightness: 106, contrast: 90, saturation: 58, hue: 14, blur: 0, vignette: 0.32, temperature: 0.5 },
  },
  {
    id: "film",
    name: "Плёнка",
    values: { brightness: 98, contrast: 112, saturation: 74, hue: -8, blur: 0.4, vignette: 0.4, temperature: 0.12 },
  },
  {
    id: "dramatic",
    name: "Драма",
    values: { brightness: 84, contrast: 142, saturation: 112, hue: 0, blur: 0, vignette: 0.68, temperature: -0.08 },
  },
  {
    id: "soft",
    name: "Мягкий",
    values: { brightness: 110, contrast: 88, saturation: 82, hue: 0, blur: 1.1, vignette: 0.16, temperature: 0.18 },
  },
  {
    id: "cool",
    name: "Холод",
    values: { brightness: 100, contrast: 108, saturation: 96, hue: 0, blur: 0, vignette: 0.22, temperature: -0.75 },
  },
  {
    id: "warm",
    name: "Тепло",
    values: { brightness: 104, contrast: 106, saturation: 112, hue: 0, blur: 0, vignette: 0.18, temperature: 0.72 },
  },
  {
    id: "noir",
    name: "Нуар",
    values: { brightness: 82, contrast: 146, saturation: 0, hue: 0, blur: 0, vignette: 0.62, temperature: 0 },
  },
  {
    id: "fade",
    name: "Выцветший",
    values: { brightness: 114, contrast: 76, saturation: 62, hue: 0, blur: 0.5, vignette: 0.1, temperature: 0.22 },
  },
  {
    id: "vivid",
    name: "Сочно",
    values: { brightness: 103, contrast: 118, saturation: 150, hue: 0, blur: 0, vignette: 0.14, temperature: 0.08 },
  },
  {
    id: "matte",
    name: "Матовый",
    values: { brightness: 100, contrast: 82, saturation: 72, hue: 0, blur: 0, vignette: 0.2, temperature: 0.05 },
  },
  {
    id: "golden",
    name: "Золотой час",
    values: { brightness: 108, contrast: 114, saturation: 122, hue: 10, blur: 0, vignette: 0.34, temperature: 0.88 },
  },
];

export function cssFilter(adj: ImageAdjustments, extraBlur = 0) {
  const blur = Math.max(0, adj.blur + extraBlur);
  return [
    `brightness(${adj.brightness / 100})`,
    `contrast(${adj.contrast / 100})`,
    `saturate(${adj.saturation / 100})`,
    `hue-rotate(${adj.hue}deg)`,
    blur > 0 ? `blur(${blur}px)` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
