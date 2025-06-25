import axios from 'axios';
import Constants from 'expo-constants';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

class NotificationService {
    static async sendPushNotification(expoPushToken, { title, body, data = {} }) {
        try {
            const message = {
                to: expoPushToken,
                sound: 'default',
                title,
                body,
                data,
            };

            const response = await axios.post(EXPO_PUSH_ENDPOINT, message, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
            });

            return response.data;
        } catch (error) {
            console.error('Push notification gönderme hatası:', error);
            throw error;
        }
    }

    static async registerDeviceToken(userId, token) {
        try {
            // TODO: Backend API endpoint'ini ekle
            const response = await axios.post('/api/notifications/register-device', {
                userId,
                token,
            });
            return response.data;
        } catch (error) {
            console.error('Token kayıt hatası:', error);
            throw error;
        }
    }

    static async unregisterDeviceToken(userId, token) {
        try {
            // TODO: Backend API endpoint'ini ekle
            const response = await axios.post('/api/notifications/unregister-device', {
                userId,
                token,
            });
            return response.data;
        } catch (error) {
            console.error('Token silme hatası:', error);
            throw error;
        }
    }

    // Farklı bildirim türleri için yardımcı metodlar
    static async sendFriendRequestNotification(toUserId, fromUser) {
        // TODO: Backend API endpoint'ini ekle
        try {
            const response = await axios.post('/api/notifications/friend-request', {
                toUserId,
                fromUser,
            });
            return response.data;
        } catch (error) {
            console.error('Arkadaşlık isteği bildirimi gönderme hatası:', error);
            throw error;
        }
    }

    static async sendMessageNotification(toUserId, message) {
        // TODO: Backend API endpoint'ini ekle
        try {
            const response = await axios.post('/api/notifications/message', {
                toUserId,
                message,
            });
            return response.data;
        } catch (error) {
            console.error('Mesaj bildirimi gönderme hatası:', error);
            throw error;
        }
    }

    static async sendActivityUpdateNotification(toUserId, activity) {
        // TODO: Backend API endpoint'ini ekle
        try {
            const response = await axios.post('/api/notifications/activity', {
                toUserId,
                activity,
            });
            return response.data;
        } catch (error) {
            console.error('Aktivite bildirimi gönderme hatası:', error);
            throw error;
        }
    }

    static async sendLikeNotification(toUserId, fromUser, postId) {
        // TODO: Backend API endpoint'ini ekle
        try {
            const response = await axios.post('/api/notifications/like', {
                toUserId,
                fromUser,
                postId
            });
            return response.data;
        } catch (error) {
            console.error('Beğeni bildirimi gönderme hatası:', error);
            throw error;
        }
    }

    static async sendCommentNotification(toUserId, fromUser, postId, commentText) {
        // TODO: Backend API endpoint'ini ekle
        try {
            const response = await axios.post('/api/notifications/comment', {
                toUserId,
                fromUser,
                postId,
                commentText
            });
            return response.data;
        } catch (error) {
            console.error('Yorum bildirimi gönderme hatası:', error);
            throw error;
        }
    }
} 