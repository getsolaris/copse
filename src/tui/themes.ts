import { createSignal } from "solid-js";

export type ThemeName = "opencode" | "tokyo-night" | "dracula" | "nord" | "catppuccin" | "github-dark";

export interface Theme {
  bg: { base: string; surface: string; elevated: string; overlay: string };
  border: { default: string; active: string; subtle: string };
  text: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    selected: string;
  };
  tab: { active: string; activeBg: string; inactive: string; inactiveBg: string };
  select: {
    focusedBg: string;
    focusedFg: string;
    selectedBg: string;
    selectedFg: string;
    normalFg: string;
    descFg: string;
  };
}

const THEMES: Record<ThemeName, Theme> = {
  opencode: {
    bg: { base: "#090909", surface: "#111111", elevated: "#1a1a1a", overlay: "#000000" },
    border: { default: "#2a2a2a", active: "#4fc3f7", subtle: "#1e1e1e" },
    text: {
      primary: "#e8e8e8",
      secondary: "#666666",
      accent: "#4fc3f7",
      success: "#4ade80",
      warning: "#fbbf24",
      error: "#f87171",
      selected: "#ffffff",
    },
    tab: { active: "#4fc3f7", activeBg: "#1a1a1a", inactive: "#555555", inactiveBg: "#000000" },
    select: {
      focusedBg: "#1a2a3a",
      focusedFg: "#4fc3f7",
      selectedBg: "#161616",
      selectedFg: "#e8e8e8",
      normalFg: "#e8e8e8",
      descFg: "#666666",
    },
  },
  "tokyo-night": {
    bg: { base: "#1a1b26", surface: "#1f2335", elevated: "#24283b", overlay: "#0d1117" },
    border: { default: "#3b4261", active: "#7aa2f7", subtle: "#292e42" },
    text: {
      primary: "#c0caf5",
      secondary: "#565f89",
      accent: "#7aa2f7",
      success: "#9ece6a",
      warning: "#e0af68",
      error: "#f7768e",
      selected: "#ffffff",
    },
    tab: { active: "#7aa2f7", activeBg: "#24283b", inactive: "#565f89", inactiveBg: "#1a1b26" },
    select: {
      focusedBg: "#283457",
      focusedFg: "#7aa2f7",
      selectedBg: "#2a2f44",
      selectedFg: "#c0caf5",
      normalFg: "#c0caf5",
      descFg: "#565f89",
    },
  },
  dracula: {
    bg: { base: "#282a36", surface: "#21222c", elevated: "#343746", overlay: "#191a21" },
    border: { default: "#6272a4", active: "#bd93f9", subtle: "#44475a" },
    text: {
      primary: "#f8f8f2",
      secondary: "#6272a4",
      accent: "#bd93f9",
      success: "#50fa7b",
      warning: "#ffb86c",
      error: "#ff5555",
      selected: "#ffffff",
    },
    tab: { active: "#bd93f9", activeBg: "#343746", inactive: "#6272a4", inactiveBg: "#282a36" },
    select: {
      focusedBg: "#44475a",
      focusedFg: "#bd93f9",
      selectedBg: "#383a4a",
      selectedFg: "#f8f8f2",
      normalFg: "#f8f8f2",
      descFg: "#6272a4",
    },
  },
  nord: {
    bg: { base: "#2e3440", surface: "#3b4252", elevated: "#434c5e", overlay: "#242933" },
    border: { default: "#4c566a", active: "#81a1c1", subtle: "#3b4252" },
    text: {
      primary: "#eceff4",
      secondary: "#4c566a",
      accent: "#81a1c1",
      success: "#a3be8c",
      warning: "#ebcb8b",
      error: "#bf616a",
      selected: "#ffffff",
    },
    tab: { active: "#88c0d0", activeBg: "#434c5e", inactive: "#4c566a", inactiveBg: "#2e3440" },
    select: {
      focusedBg: "#3b4252",
      focusedFg: "#88c0d0",
      selectedBg: "#3b4252",
      selectedFg: "#eceff4",
      normalFg: "#eceff4",
      descFg: "#4c566a",
    },
  },
  catppuccin: {
    bg: { base: "#1e1e2e", surface: "#181825", elevated: "#313244", overlay: "#11111b" },
    border: { default: "#45475a", active: "#cba6f7", subtle: "#313244" },
    text: {
      primary: "#cdd6f4",
      secondary: "#585b70",
      accent: "#cba6f7",
      success: "#a6e3a1",
      warning: "#fab387",
      error: "#f38ba8",
      selected: "#ffffff",
    },
    tab: { active: "#cba6f7", activeBg: "#313244", inactive: "#585b70", inactiveBg: "#1e1e2e" },
    select: {
      focusedBg: "#313244",
      focusedFg: "#cba6f7",
      selectedBg: "#313244",
      selectedFg: "#cdd6f4",
      normalFg: "#cdd6f4",
      descFg: "#585b70",
    },
  },
  "github-dark": {
    bg: { base: "#0d1117", surface: "#161b22", elevated: "#21262d", overlay: "#010409" },
    border: { default: "#30363d", active: "#58a6ff", subtle: "#21262d" },
    text: {
      primary: "#e6edf3",
      secondary: "#484f58",
      accent: "#58a6ff",
      success: "#3fb950",
      warning: "#d29922",
      error: "#f85149",
      selected: "#ffffff",
    },
    tab: { active: "#58a6ff", activeBg: "#21262d", inactive: "#484f58", inactiveBg: "#0d1117" },
    select: {
      focusedBg: "#1f2937",
      focusedFg: "#58a6ff",
      selectedBg: "#1f2937",
      selectedFg: "#e6edf3",
      normalFg: "#e6edf3",
      descFg: "#484f58",
    },
  },
};

export const THEME_NAMES: ThemeName[] = [
  "opencode",
  "tokyo-night",
  "dracula",
  "nord",
  "catppuccin",
  "github-dark",
];

export const THEME_LABELS: Record<ThemeName, string> = {
  opencode: "OpenCode",
  "tokyo-night": "Tokyo Night",
  dracula: "Dracula",
  nord: "Nord",
  catppuccin: "Catppuccin Mocha",
  "github-dark": "GitHub Dark",
};

export const [currentThemeName, setCurrentThemeName] = createSignal<ThemeName>("opencode");

// Reactive proxy — accessing theme.bg.base inside SolidJS components will track `currentThemeName`
export const theme: Theme = new Proxy({} as Theme, {
  get(_, section: string) {
    return new Proxy({} as Record<string, string>, {
      get(_, key: string) {
        const t = THEMES[currentThemeName()];
        return (t as unknown as Record<string, Record<string, string>>)[section]?.[key];
      },
    });
  },
});
