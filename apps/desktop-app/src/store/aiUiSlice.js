import { createSlice } from '@reduxjs/toolkit';

// UI state for the shared AI context menu (array view + Monaco)
// WHAT: Stores position, level, source info, and a lightweight decorations trigger
// WHY HERE: Shared between EditorArray and SimpleMonaco views; trigger lets Monaco
//           recompute glyph decorations when tags change via the context menu.
const initialState = {
  visible: false,
  x: 0,
  y: 0,
  level: 0, // 0 = none, 1 = chapter, 2 = section
  source: null, // 'array' or 'monaco' - which view opened the menu
  lineKey: null, // lineIndex (array) or lineNumber (monaco) - identifies the line
  decorationsNonce: 0, // bump this to request a decorations refresh in Monaco
  arrayDecorationsNonce: 0, // bump this to request an array editor refresh
};

const aiUiSlice = createSlice({
  name: 'aiUi',
  initialState,
  reducers: {
    showAiContextMenu(state, action) {
      const { x, y, level, source, lineKey } = action.payload || {};
      state.visible = true;
      state.x = typeof x === 'number' ? x : 0;
      state.y = typeof y === 'number' ? y : 0;
      state.level = typeof level === 'number' ? level : 0;
      state.source = source || null;
      state.lineKey = lineKey ?? null;
    },
    hideAiContextMenu(state) {
      state.visible = false;
      state.x = 0;
      state.y = 0;
      state.level = 0;
      state.source = null;
      state.lineKey = null;
    },
    bumpAiDecorationsNonce(state) {
      state.decorationsNonce += 1;
    },
    bumpArrayDecorationsNonce(state) {
      state.arrayDecorationsNonce += 1;
    },
  },
});

export const { showAiContextMenu, hideAiContextMenu, bumpAiDecorationsNonce, bumpArrayDecorationsNonce } = aiUiSlice.actions;

export const selectAiContextMenu = (state) => state.aiUi || initialState;
export const selectAiDecorationsNonce = (state) => (state.aiUi || initialState).decorationsNonce;
export const selectArrayDecorationsNonce = (state) => (state.aiUi || initialState).arrayDecorationsNonce;

export default aiUiSlice.reducer;
