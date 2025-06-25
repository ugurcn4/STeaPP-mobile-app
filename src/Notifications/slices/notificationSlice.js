import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    settings: {
        allNotifications: true,
        newFriends: true,
        messages: true,
        activityUpdates: true,
        likeNotifications: true,
        commentNotifications: true,
        emailNotifications: false,
    },
    loading: false,
    error: null
};

const notificationSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        updateNotificationSetting: (state, action) => {
            const { key, value } = action.payload;
            state.settings[key] = value;

            if (key === 'allNotifications' && !value) {
                state.settings.newFriends = false;
                state.settings.messages = false;
                state.settings.activityUpdates = false;
                state.settings.likeNotifications = false;
                state.settings.commentNotifications = false;
                state.settings.emailNotifications = false;
            }
        },
        setNotificationSettings: (state, action) => {
            state.settings = action.payload;
        },
        setLoading: (state, action) => {
            state.loading = action.payload;
        },
        setError: (state, action) => {
            state.error = action.payload;
        }
    }
});

export const {
    updateNotificationSetting,
    setNotificationSettings,
    setLoading,
    setError
} = notificationSlice.actions;

export default notificationSlice.reducer; 