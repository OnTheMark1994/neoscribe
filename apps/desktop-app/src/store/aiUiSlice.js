import { createSlice } from '@reduxjs/toolkit';

// UI state for the shared AI context menu (array view + Monaco)
const initialState = {
  visible: false,
  x: 0,
  y: 0,
  level: 0, // 0 = none, 1 = chapter, 2 = section
};

const aiUiSlice = createSlice({
  name: 'aiUi',
  initialState,
  reducers: {
    showAiContextMenu(state, action) {
      const { x, y, level } = action.payload || {};
      state.visible = true;
      state.x = typeof x === 'number' ? x : 0;
      state.y = typeof y === 'number' ? y : 0;
      state.level = typeof level === 'number' ? level : 0;
    },
    hideAiContextMenu(state) {
      state.visible = false;
      state.x = 0;
      state.y = 0;
      state.level = 0;
    },
  },
});

export const { showAiContextMenu, hideAiContextMenu } = aiUiSlice.actions;

export const selectAiContextMenu = (state) => state.aiUi || initialState;

export default aiUiSlice.reducer;
