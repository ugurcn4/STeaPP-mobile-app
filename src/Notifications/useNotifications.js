import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
    updateNotificationSetting,
    setNotificationSettings,
    setLoading,
    setError
} from './slices/notificationSlice';
import { registerForPushNotifications, setupNotificationListeners } from './notificationConfig';
import NotificationService from '../services/notificationService';

const NOTIFICATION_SETTINGS_KEY = '@notification_settings';

export const useNotifications = (navigation) => {
    const dispatch = useDispatch();
    const settings = useSelector(state => state.notifications.settings);
    const loading = useSelector(state => state.notifications.loading);
    const error = useSelector(state => state.notifications.error);
    const [pushToken, setPushToken] = useState(null);

    // Auth state'ini güvenli bir şekilde al
    const auth = useSelector(state => state.auth);
    const user = auth?.user;

    useEffect(() => {
        loadNotificationSettings();
        if (settings?.allNotifications) {
            initializePushNotifications();
        }
        const cleanup = setupNotificationListeners(navigation);
        return cleanup;
    }, [navigation]);

    const initializePushNotifications = async () => {
        try {
            const token = await registerForPushNotifications();
            setPushToken(token);

            // User kontrolünü güvenli bir şekilde yap
            if (token && user?.id) {
                try {
                    await NotificationService.registerDeviceToken(user.id, token);
                } catch (error) {
                    console.warn('Token kaydedilemedi:', error);
                }
            }
        } catch (error) {
            console.error('Push notification başlatma hatası:', error);
            dispatch(setError('Push bildirimleri başlatılamadı'));
        }
    };

    // Bildirim ayarlarını yükle
    const loadNotificationSettings = async () => {
        try {
            dispatch(setLoading(true));

            // Önce AsyncStorage'dan yükle (çevrimdışı çalışma için)
            const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
            let settingsData = savedSettings ? JSON.parse(savedSettings) : null;

            // Eğer kullanıcı girişi yapılmışsa Firestore'dan da kontrol et (en güncel veri)
            if (user?.id) {
                try {
                    const { doc, getDoc, getFirestore } = await import('firebase/firestore');
                    const db = getFirestore();
                    const userRef = doc(db, 'users', user.id);
                    const userDoc = await getDoc(userRef);

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        // Firestore'da kayıtlı bildirim ayarları varsa onları kullan
                        if (userData.notificationSettings) {
                            settingsData = userData.notificationSettings;
                            // Güncel ayarları AsyncStorage'a da kaydet
                            await AsyncStorage.setItem(
                                NOTIFICATION_SETTINGS_KEY,
                                JSON.stringify(settingsData)
                            );
                        }
                        // Eğer Firestore'da ayarlar yoksa ama lokalde varsa, Firestore'a kaydet
                        else if (settingsData) {
                            await updateDoc(userRef, {
                                notificationSettings: settingsData
                            });
                        }
                    }
                } catch (firebaseError) {
                    console.error('Firestore bildirim ayarları yükleme hatası:', firebaseError);
                }
            }

            // Bulunan ayarları Redux store'a kaydet
            if (settingsData) {
                dispatch(setNotificationSettings(settingsData));
            }
        } catch (error) {
            dispatch(setError('Bildirim ayarları yüklenemedi'));
            console.error('Bildirim ayarları yükleme hatası:', error);
        } finally {
            dispatch(setLoading(false));
        }
    };

    // Bildirim ayarlarını kaydet
    const saveNotificationSettings = async (newSettings) => {
        try {
            await AsyncStorage.setItem(
                NOTIFICATION_SETTINGS_KEY,
                JSON.stringify(newSettings)
            );
        } catch (error) {
            console.error('Bildirim ayarları kaydetme hatası:', error);
        }
    };

    // Bildirim ayarını değiştir
    const toggleNotificationSetting = async (key, value) => {
        try {
            if (key === 'allNotifications') {
                if (value) {
                    await initializePushNotifications();
                } else {
                    // User ve token kontrolünü güvenli bir şekilde yap
                    if (pushToken && user?.id) {
                        try {
                            await NotificationService.unregisterDeviceToken(user.id, pushToken);
                        } catch (error) {
                            console.warn('Token silinemedi:', error);
                        }
                    }
                    setPushToken(null);
                }
            }

            // Redux ile yerel ayarları güncelle
            dispatch(updateNotificationSetting({ key, value }));

            // AsyncStorage'a kaydet
            const updatedSettings = {
                ...settings,
                [key]: value
            };
            await saveNotificationSettings(updatedSettings);

            // Firestore'da kullanıcı dokümanını güncelle (eğer giriş yapmış kullanıcı varsa)
            if (user?.id) {
                try {
                    const { doc, updateDoc, getFirestore } = await import('firebase/firestore');
                    const db = getFirestore();
                    const userRef = doc(db, 'users', user.id);

                    // Bildirim ayarlarını Firestore'a kaydet
                    await updateDoc(userRef, {
                        notificationSettings: updatedSettings
                    });
                } catch (firebaseError) {
                    console.error('Firestore bildirim ayarları kaydetme hatası:', firebaseError);
                }
            }
        } catch (error) {
            console.error('Bildirim ayarı değiştirme hatası:', error);
            dispatch(setError('Bildirim ayarı değiştirilemedi'));
        }
    };

    return {
        settings,
        loading,
        error,
        pushToken,
        toggleNotificationSetting,
        loadNotificationSettings
    };
};
