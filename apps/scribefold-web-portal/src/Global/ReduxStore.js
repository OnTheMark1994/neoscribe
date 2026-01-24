import { configureStore } from '@reduxjs/toolkit';
import userSliceReducer from './ReduxSlices/UserSlice';

const store = configureStore({
  reducer: {
    userSlice: userSliceReducer,
  },
});

export default store;
