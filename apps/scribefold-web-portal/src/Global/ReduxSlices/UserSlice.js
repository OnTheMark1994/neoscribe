import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  authUser: null,
  userData: {},
  userDataLoading: false,
  reloadUserDataTrigger: 0,
};

const userSlice = createSlice({
  name: 'userSlice',
  initialState,
  reducers: {
    setAuthUser(state, action) {
      state.authUser = action.payload ?? null;
    },
    setUserData(state, action) {
      state.userData = action.payload ?? null;
    },
    setUserDataLoading(state, action) {
      state.userDataLoading = Boolean(action.payload);
    },
    triggerReloadUserData(state) {
      state.reloadUserDataTrigger += 1;
    },
  },
});

export const { setAuthUser, setUserData, setUserDataLoading, triggerReloadUserData } = userSlice.actions;

export default userSlice.reducer;
