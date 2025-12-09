import { createSlice } from '@reduxjs/toolkit';

/**
 * userSlice - User identity, authentication, and token state
 * 
 * Purpose: Centralize all user-related state including IDs and token balance.
 * Components read user data from Redux instead of receiving props.
 * 
 * Note: availableTokens is calculated when userData changes via setUserData.
 * This ensures a single source of truth for token balance.
 */

const initialState = {
  anonId: null,           // Anonymous user ID
  authId: null,           // Authenticated user ID (Supabase)
  deviceId: null,         // Device ID for token grants (desktop only)
  user: null,             // Full user data from API (userData)
  availableTokens: null,  // Calculated from user data: tokens_monthly + tokens_added
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
    setDeviceId(state, action) {
      state.deviceId = action.payload || null;
    },
    setUser(state, action) {
      state.user = action.payload || null;
      // Calculate availableTokens when user data changes
      if (action.payload) {
        const monthly = action.payload.tokens_monthly ?? action.payload.tokensMonthly ?? 0;
        const added = action.payload.tokens_added ?? action.payload.tokensAdded ?? 0;
        state.availableTokens = monthly + added;
      } else {
        state.availableTokens = null;
      }
    },
    setAvailableTokens(state, action) {
      // Direct set for refresh operations
      state.availableTokens = typeof action.payload === 'number' ? action.payload : null;
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
      state.availableTokens = null;
      state.error = null;
    },
  },
});

export const {
  setAnonId,
  setAuthId,
  setDeviceId,
  setUser,
  setAvailableTokens,
  setUserLoading,
  setUserError,
  clearUser,
} = userSlice.actions;

// Selectors
export const selectAnonId = (state) => state.user.anonId;
export const selectAuthId = (state) => state.user.authId;
export const selectDeviceId = (state) => state.user.deviceId;
export const selectUserData = (state) => state.user.user;
export const selectAvailableTokens = (state) => state.user.availableTokens;

export default userSlice.reducer;
