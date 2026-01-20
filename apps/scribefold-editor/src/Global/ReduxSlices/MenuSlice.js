import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  fullscreenActive: false,
};

const menuSlice = createSlice({
  name: 'menuSlice',
  initialState,
  reducers: {
    setFullscreenActive(state, action) {
      state.fullscreenActive = !!action.payload;
    },
    toggleFullscreenActive(state) {
      state.fullscreenActive = !state.fullscreenActive;
    },
  },
});

export const { setFullscreenActive, toggleFullscreenActive } = menuSlice.actions;

export default menuSlice.reducer;
