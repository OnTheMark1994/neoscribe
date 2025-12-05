import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  anonId: null,
  authId: null,
  user: null,
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setAnonId(state, action) {
      state.anonId = action.payload || null;
    },
    setAuthId(state, action) {
      state.authId = action.payload || null;
    },
    setUser(state, action) {
      state.user = action.payload || null;
    },
    setUserLoading(state, action) {
      state.loading = !!action.payload;
    },
    setUserError(state, action) {
      state.error = action.payload || null;
    },
    clearUser(state) {
      state.user = null;
      state.authId = null;
      state.error = null;
    },
  },
});

export const {
  setAnonId,
  setAuthId,
  setUser,
  setUserLoading,
  setUserError,
  clearUser,
} = userSlice.actions;

export default userSlice.reducer;
