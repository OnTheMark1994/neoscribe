/*
  
  Stores data related to the user data
  
  actions:
    
    set user data
      sets state for the user data object

    set auth user
      puts the supabase auth user into global state
        we use this to see if they are logged in and to get auth user id from the object

    trigger reload
      triggers user data reload in the initializer component which will call set user data
    

*/

 import { createSlice } from '@reduxjs/toolkit';

 const initialState = {
   authUser: null,            // From the supabase auth listener, contains .id (the authID)
   userData: null,            // Loaded from users table (via our api) based on ids (auth, device, anon)
   userDataLoading: false,    // Flag to show when user data is showing (used for display)
   reloadUserDataTrigger: 0,  // Triggers a user data reload when incremented (via useEffect in the initalizer comonent)
 };

 const userSlice = createSlice({
   name: 'userSlice',
   initialState,
   reducers: {
    // Set from the initalizer supabase auth listener, contains .id (the authID)
     setAuthUser(state, action) {
       state.authUser = action.payload ?? null;
     },
     // Set from inializer, loads from users table (via our api)
     setUserData(state, action) {
       state.userData = action.payload ?? null;
     },
     // Flag to show when user data is showing (used for display)
     setUserDataLoading(state, action) {
       state.userDataLoading = Boolean(action.payload);
     },
    // Triggers a user data reload when incremented (via useEffect in the initalizer comonent)
     triggerReloadUserData(state) {
       state.reloadUserDataTrigger += 1;
     },
   },
 });

 export const { setAuthUser, setUserData, setUserDataLoading, triggerReloadUserData } = userSlice.actions;

 export default userSlice.reducer;
