import { create } from 'zustand';

interface ActiveGroup {
  id: number;
  name: string;
  role: string | null;
  isApproved: boolean;
}

interface GroupState {
  activeGroup: ActiveGroup | null;
  refreshTrigger: number;
  setActiveGroup: (group: ActiveGroup | null) => void;
  triggerRefresh: () => void;
}

export const useGroupStore = create<GroupState>((set) => ({
  activeGroup: null,
  refreshTrigger: 0,
  setActiveGroup: (group) => set({ activeGroup: group }),
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));
