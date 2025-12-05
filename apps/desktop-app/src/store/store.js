import { configureStore } from '@reduxjs/toolkit';
import aiChangesReducer from './aiChangesSlice';
import userReducer from './userSlice';

export const store = configureStore({
  reducer: {
    aiChanges: aiChangesReducer,
    user: userReducer,
  },
});
