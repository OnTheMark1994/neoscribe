import { createSlice } from '@reduxjs/toolkit';

/**
 * userSlice - User identity, authentication, and token state
 * 
 * Purpose: Centralize all user-related state including IDs and token balance.
 * Components read user data from Redux instead of receiving props.
 * 
 * Flow:
 * 1. Auth state is managed by Supabase's onAuthStateChange listener in initializeApp.js
 * 2. When auth state changes, the auth user object is set here via setAuthUser
 * 3. AppInitializer watches for auth changes and triggers user data loading
 * 4. User data (tokens, billing info) is loaded via API and stored in userData
 * 5. All components access user data via userData?.attribute pattern
 * 
 * Note: No auth data is stored in localStorage - only in Redux state (ephemeral)
 */

const initialState = {
  anonId: null,           // Anonymous user ID (for unauthenticated users)
  authUser: null,         // Supabase auth user object from onAuthStateChange listener
  deviceId: null,         // Device ID for token grants (desktop app only)
  userData: null,         // Full user data from API (tokens, billing, preferences, etc.)
  loadingUserData: false, // Loading state for user data API calls
  userDataReloadTrigger: 0, // Counter to trigger reloads (increment to force refresh)
  error: null,            // Error state for user data operations
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    // Sets the anonymous user ID (used for unauthenticated sessions)
    setAnonId(state, action) {
      state.anonId = action.payload || null;
    },
    
    // Sets the auth user object from onAuthStateChange listener in initializeApp.js
    // Auth ID can be accessed from authUser.id (Supabase user object)
    setAuthUser(state, action) {
      state.authUser = action.payload || null;
      // Note: Supabase auth object contains id, email, user_metadata, etc.
      // Use authUser.id for API calls requiring user ID
    },
    
    // Sets device ID for desktop app installations (used for device-specific token grants)
    setDeviceId(state, action) {
      state.deviceId = action.payload || null;
    },
    
    // Sets user data loaded from API (tokens, billing, account info)
    // Called after successful API fetch in AppInitializer useEffect
    setUserData(state, action) {
      state.userData = action.payload || null;
    },
    
    // Controls loading state for user data API calls
    // Set to true when API call starts, false when complete
    setLoadingUserData(state, action) {
      state.loadingUserData = !!action.payload;
    },
    
    // Increments the reload trigger counter to force user data refresh
    // AppInitializer useEffect watches this counter and re-fetches data when it changes
    reloadUserData(state) {
      state.userDataReloadTrigger += 1;
    },
    
    // Sets error state for user data operations
    setUserError(state, action) {
      state.error = action.payload || null;
    },
    
    // Clears all user data (called on logout or auth state cleared)
    clearUserData(state) {
      state.userData = null;
      state.authUser = null;
      // Note: anonId and deviceId are preserved for anonymous sessions
    },
  },
});

export const {
  setAnonId,
  setAuthUser,
  setDeviceId,
  setUserData,
  setLoadingUserData,
  reloadUserData,
  setUserError,
  clearUserData,
} = userSlice.actions;

export default userSlice.reducer;