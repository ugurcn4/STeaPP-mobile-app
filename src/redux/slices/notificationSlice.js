import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    doc
} from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

// Async thunks
export const fetchNotifications = createAsyncThunk(
    'notifications/fetchNotifications',
    async (userId, { rejectWithValue }) => {
        try {
            if (!userId) {
                throw new Error('Kullanıcı ID\'si bulunamadı');
            }

            const notificationsRef = collection(db, 'notifications');

            const q = query(
                notificationsRef,
                where('recipientId', '==', userId)
            );
            const querySnapshot = await getDocs(q);

            const notifications = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                notifications.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    body: data.body || '',
                    title: data.title || 'Yeni Bildirim',
                    type: data.type || 'message',
                    status: data.status || 'unread'
                });
            });

            // Client-side sıralama
            notifications.sort((a, b) => b.createdAt - a.createdAt);

            return {
                notifications,
                unreadCount: notifications.filter(n => n.status === 'unread').length
            };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const markNotificationAsRead = createAsyncThunk(
    'notifications/markAsRead',
    async (notificationId) => {
        const notificationRef = doc(db, 'notifications', notificationId);
        await updateDoc(notificationRef, {
            status: 'read',
            readAt: new Date()
        });
        return { notificationId };
    }
);

export const updateNotificationSettings = createAsyncThunk(
    'notifications/updateSettings',
    async ({ userId, settings }) => {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            notificationSettings: settings
        });
        return settings;
    }
);

const notificationSlice = createSlice({
    name: 'notifications',
    initialState: {
        notifications: [],
        unreadCount: 0,
        settings: {
            allNotifications: true,
            newFriends: true,
            messages: true,
            activityUpdates: true,
            emailNotifications: true
        },
        fcmToken: null,
        loading: false,
        error: null
    },
    reducers: {
        setNotificationSettings: (state, action) => {
            state.settings = action.payload;
        },
        updateNotificationSetting: (state, action) => {
            const { key, value } = action.payload;
            state.settings[key] = value;
        },
        setFCMToken: (state, action) => {
            state.fcmToken = action.payload;
        },
        addNotification: (state, action) => {
            state.notifications.unshift(action.payload);
            if (action.payload.status === 'unread') {
                state.unreadCount += 1;
            }
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch notifications
            .addCase(fetchNotifications.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchNotifications.fulfilled, (state, action) => {
                state.notifications = action.payload.notifications;
                state.unreadCount = action.payload.unreadCount;
                state.loading = false;
                state.error = null;
            })
            .addCase(fetchNotifications.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Bildirimler yüklenirken bir hata oluştu';
                console.error('Bildirim yükleme hatası:', action.payload);
            })
            // Mark as read
            .addCase(markNotificationAsRead.fulfilled, (state, action) => {
                const notification = state.notifications.find(n => n.id === action.payload.notificationId);
                if (notification && notification.status === 'unread') {
                    notification.status = 'read';
                    notification.readAt = new Date();
                    state.unreadCount -= 1;
                }
            })
            // Update settings
            .addCase(updateNotificationSettings.fulfilled, (state, action) => {
                state.settings = action.payload;
            });
    }
});

export const {
    setNotificationSettings,
    updateNotificationSetting,
    setFCMToken,
    addNotification,
    clearError
} = notificationSlice.actions;

export default notificationSlice.reducer; 