import { createContext, createSignal, useContext, type JSX } from "solid-js";

export type TabId = "list" | "add" | "config" | "doctor";

interface AppState {
  activeTab: () => TabId;
  setActiveTab: (tab: TabId) => void;
  selectedWorktreeIndex: () => number;
  setSelectedWorktreeIndex: (idx: number) => void;
  showRemove: () => boolean;
  setShowRemove: (v: boolean) => void;
  showCommandPalette: () => boolean;
  setShowCommandPalette: (v: boolean) => void;
  repoPath: () => string;
  repoPaths: () => string[];
}

const AppContext = createContext<AppState>();

export function AppProvider(props: {
  children: JSX.Element;
  repoPath: string;
  repoPaths: string[];
}) {
  const [activeTab, setActiveTab] = createSignal<TabId>("list");
  const [selectedWorktreeIndex, setSelectedWorktreeIndex] = createSignal(0);
  const [showRemove, setShowRemove] = createSignal(false);
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedWorktreeIndex,
        setSelectedWorktreeIndex,
        showRemove,
        setShowRemove,
        showCommandPalette,
        setShowCommandPalette,
        repoPath: () => props.repoPath,
        repoPaths: () => props.repoPaths,
      }}
    >
      {props.children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
