import { createContext, createSignal, useContext, type JSX } from "solid-js";

export type TabId = "list" | "add" | "config" | "doctor";

export interface FocusPickerData {
  worktreePath: string;
  focusPaths: string[];
}

interface AppState {
  activeTab: () => TabId;
  setActiveTab: (tab: TabId) => void;
  selectedWorktreeIndex: () => number;
  setSelectedWorktreeIndex: (idx: number) => void;
  selectedWorktreePath: () => string | null;
  setSelectedWorktreePath: (path: string | null) => void;
  showRemove: () => boolean;
  setShowRemove: (v: boolean) => void;
  showCommandPalette: () => boolean;
  setShowCommandPalette: (v: boolean) => void;
  showUpdatePrompt: () => boolean;
  setShowUpdatePrompt: (v: boolean) => void;
  showDetailView: () => boolean;
  setShowDetailView: (v: boolean) => void;
  inputFocused: () => boolean;
  setInputFocused: (v: boolean) => void;
  repoPath: () => string;
  repoPaths: () => string[];
  selectedWorktrees: () => Set<string>;
  toggleWorktreeSelection: (path: string) => void;
  selectAllNonMain: (paths: string[]) => void;
  pruneSelectedWorktrees: (validPaths: string[]) => void;
  clearSelection: () => void;
  showBulkActions: () => boolean;
  setShowBulkActions: (v: boolean) => void;
  focusPickerData: () => FocusPickerData | null;
  setFocusPickerData: (data: FocusPickerData | null) => void;
}

const AppContext = createContext<AppState>();

export function AppProvider(props: {
  children: JSX.Element;
  repoPath: string;
  repoPaths: string[];
}) {
  const [activeTab, setActiveTab] = createSignal<TabId>("list");
  const [selectedWorktreeIndex, setSelectedWorktreeIndex] = createSignal(0);
  const [selectedWorktreePath, setSelectedWorktreePath] = createSignal<string | null>(null);
  const [showRemove, setShowRemove] = createSignal(false);
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = createSignal(false);
  const [showDetailView, setShowDetailView] = createSignal(false);
  const [inputFocused, setInputFocused] = createSignal(false);
  const [selectedWorktrees, setSelectedWorktrees] = createSignal<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = createSignal(false);
  const [focusPickerData, setFocusPickerData] = createSignal<FocusPickerData | null>(null);

  const toggleWorktreeSelection = (path: string) => {
    const next = new Set(selectedWorktrees());
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedWorktrees(next);
  };

  const selectAllNonMain = (paths: string[]) => {
    setSelectedWorktrees(new Set(paths));
  };

  const pruneSelectedWorktrees = (validPaths: string[]) => {
    const valid = new Set(validPaths);
    const current = selectedWorktrees();
    const next = new Set<string>();

    for (const path of current) {
      if (valid.has(path)) {
        next.add(path);
      }
    }

    if (next.size !== current.size) {
      setSelectedWorktrees(next);
    }
  };

  const clearSelection = () => {
    setSelectedWorktrees(new Set<string>());
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedWorktreeIndex,
        setSelectedWorktreeIndex,
        selectedWorktreePath,
        setSelectedWorktreePath,
        showRemove,
        setShowRemove,
        showCommandPalette,
        setShowCommandPalette,
        showUpdatePrompt,
        setShowUpdatePrompt,
        showDetailView,
        setShowDetailView,
        inputFocused,
        setInputFocused,
        repoPath: () => props.repoPath,
        repoPaths: () => props.repoPaths,
        selectedWorktrees,
        toggleWorktreeSelection,
        selectAllNonMain,
        pruneSelectedWorktrees,
        clearSelection,
        showBulkActions,
        setShowBulkActions,
        focusPickerData,
        setFocusPickerData,
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
