import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import themeReducer from './themeSlice';
import notificationReducer from './slices/notificationSlice';
import authReducer from './slices/authSlice';
import languageReducer from './slices/languageSlice';
import { thunk } from 'redux-thunk';

export const store = configureStore({
    reducer: {
        user: userReducer,
        theme: themeReducer,
        notifications: notificationReducer,
        auth: authReducer,
        language: languageReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false })
});

export default store;