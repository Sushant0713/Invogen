import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import builderReducer from './slices/builderSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    builder: builderReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
