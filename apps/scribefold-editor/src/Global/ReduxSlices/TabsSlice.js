import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  tabs: [
    {
      id: 'tab-1',
      title: 'Draft_Chapter_01.md',
      filepath: '/projects/book/Draft_Chapter_01.md',
      modified: false,
    },
    {
      id: 'tab-2',
      title: 'Research_Notes_Long_File_Name.md',
      filepath: '/projects/book/Research_Notes_Long_File_Name.md',
      modified: true,
    },
  ],
  activeTabId: 'tab-1',
};

const tabsSlice = createSlice({
  name: 'tabsSlice',
  initialState,
  reducers: {
    closeTab(state, action) {
      const tabId = action.payload;
      const idx = state.tabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return;

      state.tabs.splice(idx, 1);

      if (state.tabs.length === 0) {
        state.activeTabId = null;
        return;
      }

      if (state.activeTabId === tabId) {
        const newIndex = Math.max(0, idx - 1);
        state.activeTabId = state.tabs[newIndex].id;
      }
    },
    setActiveTabId(state, action) {
      state.activeTabId = action.payload
    },
  },
});

export const { closeTab, setActiveTabId } = tabsSlice.actions;

export default tabsSlice.reducer;
