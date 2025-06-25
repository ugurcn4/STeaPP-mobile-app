import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// iOS için bildirim ayarlarını yapılandır
if (Platform.OS === 'ios') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
} else {
    // Android için bildirim ayarlarını yapılandır
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrationPattern: [0, 250, 250, 250],
        }),
    });
}

// Push notification token'ı al ve kaydet
export const registerForPushNotifications = async () => {
    try {
        // Expo GO kontrolü
        if (Constants.appOwnership === 'expo') {
            console.warn('Push Notifications Expo GO\'da tam olarak çalışmaz.');
            return null;
        }

        if (!Device.isDevice) {
            throw new Error('Fiziksel cihaz gereklidir');
        }

        // iOS için ek izinler
        if (Platform.OS === 'ios') {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync({
                    ios: {
                        allowAlert: true,
                        allowBadge: true,
                        allowSound: true,
                        allowAnnouncements: true,
                    },
                });
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                throw new Error('Bildirim izni alınamadı');
            }
        }

        // Android için kanal oluştur
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Varsayılan',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
                sound: 'default',
                enableVibrate: true,
                enableLights: true,
            });
        }

        // Token al
        const token = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig.extra.eas.projectId,
        });

        // Token'ı AsyncStorage'a kaydet
        await AsyncStorage.setItem('pushToken', token.data);

        // Token'ı Firestore'a kaydet
        const deviceId = await AsyncStorage.getItem('deviceId') || Device.deviceName || Date.now().toString();
        await AsyncStorage.setItem('deviceId', deviceId);

        try {
            const { getAuth } = await import('firebase/auth');
            const { doc, setDoc, getFirestore } = await import('firebase/firestore');

            const auth = getAuth();
            const currentUser = auth.currentUser;
            const db = getFirestore();

            if (currentUser) {
                const userRef = doc(db, 'users', currentUser.uid);

                // fcmTokens alanını güncelle
                await setDoc(userRef, {
                    fcmTokens: {
                        [deviceId]: {
                            token: token.data,
                            createdAt: new Date(),
                            platform: Platform.OS,
                            deviceName: Device.deviceName || 'Unknown Device',
                            lastUpdated: new Date()
                        }
                    }
                }, { merge: true });

            }
        } catch (error) {
            console.error('Firestore token kayıt hatası:', error);
        }

        return token.data;
    } catch (error) {
        console.error('Push notification kaydı hatası:', error);
        return null;
    }
};

// Bildirim dinleyicilerini ayarla
export const setupNotificationListeners = (navigation) => {
    const notificationListener = Notifications.addNotificationReceivedListener(
        notification => {
            const { data } = notification.request.content;

            // Bildirim verilerini işle
            switch (data.type) {
                case 'message':
                    break;
                case 'friendRequest':
                    // Redux store'u güncelle veya yerel bildirim göster
                    Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Yeni Arkadaşlık İsteği",
                            body: notification.request.content.body,
                            data: data,
                        },
                        trigger: null,
                    });
                    break;
                case 'activity':
                    break;
                case 'like':
                    // Beğeni bildirimi için yerel bildirim göster
                    Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Yeni Beğeni",
                            body: notification.request.content.body,
                            data: data,
                        },
                        trigger: null,
                    });
                    break;
                case 'comment':
                    // Yorum bildirimi için yerel bildirim göster
                    Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Yeni Yorum",
                            body: notification.request.content.body,
                            data: data,
                        },
                        trigger: null,
                    });
                    break;
                default:
            }
        }
    );

    const responseListener = Notifications.addNotificationResponseReceivedListener(
        response => {
            const { data } = response.notification.request.content;

            // Bildirime tıklandığında ilgili ekrana yönlendir
            switch (data.type) {
                case 'message':
                    navigation?.navigate('DirectMessages', {
                        screen: 'Chat',
                        params: { conversationId: data.conversationId }
                    });
                    break;
                case 'friendRequest':
                    navigation?.navigate('ActivitiesScreen', {
                        screen: 'Notifications'
                    });
                    break;
                case 'activity':
                    navigation?.navigate('ActivityDetails', {
                        activityId: data.activityId
                    });
                    break;
                case 'like':
                case 'comment':
                    // Beğeni ve yorum bildirimleri için ilgili gönderi detayına yönlendir
                    navigation?.navigate('PostDetails', {
                        postId: data.postId
                    });
                    break;
                default:
            }
        }
    );

    return () => {
        Notifications.removeNotificationSubscription(notificationListener);
        Notifications.removeNotificationSubscription(responseListener);
    };
}; 