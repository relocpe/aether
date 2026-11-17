export type LibraryTheme = {
  id: string;
  name: string;
  light: boolean;
  colors: string[];
};

/** Classic 16-color schemes, normal row then bright row. */
export const LIBRARY: LibraryTheme[] = [
  {
    id: "dracula",
    name: "Dracula",
    light: false,
    colors: [
      "#282a36", "#ff5555", "#50fa7b", "#f1fa8c", "#bd93f9", "#ff79c6", "#8be9fd", "#f8f8f2",
      "#6272a4", "#ff6e6e", "#69ff94", "#ffffa5", "#d6acff", "#ff92df", "#a4ffff", "#ffffff",
    ],
  },
  {
    id: "nord",
    name: "Nord",
    light: false,
    colors: [
      "#2e3440", "#bf616a", "#a3be8c", "#ebcb8b", "#81a1c1", "#b48ead", "#88c0d0", "#e5e9f0",
      "#4c566a", "#d08770", "#8fbcbb", "#ebcb8b", "#5e81ac", "#b48ead", "#8fbcbb", "#eceff4",
    ],
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    light: false,
    colors: [
      "#282828", "#cc241d", "#98971a", "#d79921", "#458588", "#b16286", "#689d6a", "#ebdbb2",
      "#928374", "#fb4934", "#b8bb26", "#fabd2f", "#83a598", "#d3869b", "#8ec07c", "#fbf1c7",
    ],
  },
  {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    light: false,
    colors: [
      "#1e1e2e", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#cdd6f4",
      "#585b70", "#eba0ac", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#f5e0dc",
    ],
  },
  {
    id: "latte",
    name: "Catppuccin Latte",
    light: true,
    colors: [
      "#eff1f5", "#d20f39", "#40a02b", "#df8e1d", "#1e66f5", "#ea76cb", "#179299", "#4c4f69",
      "#8c8fa1", "#d20f39", "#40a02b", "#df8e1d", "#1e66f5", "#8839ef", "#179299", "#4c4f69",
    ],
  },
  {
    id: "tokyo",
    name: "Tokyo Night",
    light: false,
    colors: [
      "#1a1b26", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#c0caf5",
      "#414868", "#ff9e64", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#2ac3de", "#c0caf5",
    ],
  },
  {
    id: "rose",
    name: "Rosé Pine",
    light: false,
    colors: [
      "#191724", "#eb6f92", "#31748f", "#f6c177", "#9ccfd8", "#c4a7e7", "#ebbcba", "#e0def4",
      "#6e6a86", "#eb6f92", "#9ccfd8", "#f6c177", "#31748f", "#c4a7e7", "#ebbcba", "#e0def4",
    ],
  },
  {
    id: "solarized",
    name: "Solarized Dark",
    light: false,
    colors: [
      "#002b36", "#dc322f", "#859900", "#b58900", "#268bd2", "#d33682", "#2aa198", "#eee8d5",
      "#073642", "#cb4b16", "#586e75", "#657b83", "#839496", "#6c71c4", "#93a1a1", "#fdf6e3",
    ],
  },
  {
    id: "kanagawa",
    name: "Kanagawa",
    light: false,
    colors: [
      "#1f1f28", "#c34043", "#76946a", "#c0a36e", "#7e9cd8", "#957fb8", "#6a9589", "#dcd7ba",
      "#727169", "#e82424", "#98bb6c", "#e6c384", "#7fb4ca", "#938aa9", "#7aa89f", "#dcd7ba",
    ],
  },
  {
    id: "everforest",
    name: "Everforest",
    light: false,
    colors: [
      "#2d353b", "#e67e80", "#a7c080", "#dbbc7f", "#7fbbb3", "#d699b6", "#83c092", "#d3c6aa",
      "#4f585e", "#e67e80", "#a7c080", "#dbbc7f", "#7fbbb3", "#d699b6", "#83c092", "#e4e1cd",
    ],
  },
  {
    id: "onedark",
    name: "One Dark",
    light: false,
    colors: [
      "#282c34", "#e06c75", "#98c379", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#abb2bf",
      "#5c6370", "#e06c75", "#98c379", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#ffffff",
    ],
  },
  {
    id: "sakura",
    name: "Sakura",
    light: false,
    colors: [
      "#2a1d28", "#e56b8a", "#8fbf7a", "#e6b15c", "#d08bb8", "#c47ad4", "#7ec8c3", "#f4dce6",
      "#6a4d62", "#ff8eab", "#a8d48f", "#ffd27a", "#e7a6ce", "#d9a0e6", "#9ee0db", "#fff5f8",
    ],
  },
];

export function themeById(id: string) {
  return LIBRARY.find((theme) => theme.id === id) ?? LIBRARY[0];
}
