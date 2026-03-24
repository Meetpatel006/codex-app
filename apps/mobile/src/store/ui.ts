import { create } from "zustand";

type UiStore = {
  isDiffPanelOpen: boolean;
  openDiffPanel: () => void;
  closeDiffPanel: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  isDiffPanelOpen: false,
  openDiffPanel() {
    set({ isDiffPanelOpen: true });
  },
  closeDiffPanel() {
    set({ isDiffPanelOpen: false });
  },
}));
