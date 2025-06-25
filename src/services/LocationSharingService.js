import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    doc,
    query,
    where,
    serverTimestamp,
    onSnapshot,
    deleteDoc
} from 'firebase/firestore';
import { ref, remove, onValue, off, set } from 'firebase/database';
import { db, rtdb } from '../../firebaseConfig';
import * as Location from 'expo-location';
import { getPlaceFromCoordinates } from '../helpers/locationHelpers';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Sabitler - dosyanın başında tanımlanacak
const LIVE_LOCATION_BACKGROUND_TASK = 'live-location-background-task';

/**
 * Anlık ve canlı konum paylaşımlarını dinler
 * @param {string} userId - Kullanıcı kimliği
 * @param {Function} onInstantLocationsUpdate - Anlık konumlar güncellendiğinde çağrılacak callback
 * @param {Function} onLiveLocationsUpdate - Canlı konumlar güncellendiğinde çağrılacak callback
 * @returns {Function} - Dinlemeyi durduracak fonksiyon
 */
export const listenToLocationShares = (userId, onInstantLocationsUpdate, onLiveLocationsUpdate) => {
    if (!userId) return () => {};

    // RTDB dinleyicileri için referansları saklayalım
    const rtdbListeners = [];

    // Anlık konumları dinle - Alınan paylaşımlar
    const instantLocationsRef = collection(db, 'locations', 'instant', 'shares');
    const instantQuery = query(
        instantLocationsRef,
        where('receiverId', '==', userId),
        where('metadata.status', '==', 'active')
    );
    
    // Anlık konumları dinle - Gönderilen paylaşımlar
    const instantSentQuery = query(
        instantLocationsRef,
        where('senderId', '==', userId),
        where('metadata.status', '==', 'active')
    );

    // Canlı konumları dinle - Alınan paylaşımlar
    const liveLocationsRef = collection(db, 'locations', 'live', 'shares');
    const liveQuery = query(
        liveLocationsRef,
        where('receiverId', '==', userId),
        where('metadata.status', '==', 'active')
    );
    
    // Canlı konumları dinle - Gönderilen paylaşımlar
    const liveSentQuery = query(
        liveLocationsRef,
        where('senderId', '==', userId),
        where('metadata.status', '==', 'active')
    );

    // Anlık konumları dinle - Alınan paylaşımlar
    const unsubscribeInstant = onSnapshot(instantQuery, async (snapshot) => {
        try {
            const receivedLocations = await Promise.all(
                snapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    const senderData = await getUserData(data.senderId);
                    
                    return {
                        id: doc.id,
                        type: 'instant',
                        senderId: data.senderId,
                        senderName: senderData?.informations?.name || 'İsimsiz',
                        senderUsername: senderData?.informations?.username || '',
                        senderPhoto: senderData?.profilePicture || null,
                        location: data.location,
                        locationInfo: data.locationInfo,
                        metadata: data.metadata,
                        isReceived: true
                    };
                })
            );
            
            // Gönderilen anlık konumları da dinle
            const unsubscribeInstantSent = onSnapshot(instantSentQuery, async (sentSnapshot) => {
                try {
                    const sentLocations = await Promise.all(
                        sentSnapshot.docs.map(async (doc) => {
                            const data = doc.data();
                            const receiverData = await getUserData(data.receiverId);
                            
                            return {
                                id: doc.id,
                                type: 'instant',
                                receiverId: data.receiverId,
                                userName: receiverData?.informations?.name || 'İsimsiz',
                                userPhoto: receiverData?.profilePicture || null,
                                location: data.location,
                                locationInfo: data.locationInfo,
                                metadata: data.metadata,
                                isSent: true
                            };
                        })
                    );
                    
                    // Tüm anlık konumları birleştir
                    onInstantLocationsUpdate([...receivedLocations, ...sentLocations]);
                } catch (error) {
                    console.error('Gönderilen anlık konumları dinlerken hata:', error);
                    // Sadece alınan konumları göster
                    onInstantLocationsUpdate(receivedLocations);
                }
            });
        } catch (error) {
            console.error('Anlık konumları dinlerken hata:', error);
        }
    });

    // Canlı konumları dinle - Alınan paylaşımlar
    const unsubscribeLive = onSnapshot(liveQuery, async (snapshot) => {
        try {
            const receivedLocations = await Promise.all(
                snapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    const senderData = await getUserData(data.senderId);

                    // RTDB'den canlı konum verilerini dinle
                    const locationRef = ref(rtdb, `locations/${doc.id}`);
                    const listener = onValue(locationRef, (snapshot) => {
                        const locationData = snapshot.val();
                        if (locationData) {
                            onLiveLocationsUpdate(doc.id, {
                                ...data,
                                location: locationData,
                                type: 'live',
                                senderId: data.senderId,
                                senderName: senderData?.informations?.name || 'İsimsiz',
                                senderUsername: senderData?.informations?.username || '',
                                senderPhoto: senderData?.profilePicture || null,
                                isReceived: true
                            });
                        }
                    });

                    rtdbListeners.push({ ref: locationRef, listener });

                    return {
                        id: doc.id,
                        type: 'live',
                        senderId: data.senderId,
                        senderName: senderData?.informations?.name || 'İsimsiz',
                        senderUsername: senderData?.informations?.username || '',
                        senderPhoto: senderData?.profilePicture || null,
                        startTime: data.startTime,
                        endTime: data.endTime,
                        metadata: data.metadata,
                        isReceived: true
                    };
                })
            );
            onLiveLocationsUpdate(null, receivedLocations);
        } catch (error) {
            console.error('Canlı konumları dinlerken hata:', error);
        }
    });

    // Gönderilen canlı konumları dinle
    const unsubscribeLiveSent = onSnapshot(liveSentQuery, async (sentSnapshot) => {
        try {
            const sentLocations = await Promise.all(
                sentSnapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    const receiverData = await getUserData(data.receiverId);

                    // RTDB'den canlı konum verilerini dinle
                    const locationRef = ref(rtdb, `locations/${doc.id}`);
                    const listener = onValue(locationRef, (snapshot) => {
                        const locationData = snapshot.val();
                        if (locationData) {
                            onLiveLocationsUpdate(doc.id, {
                                ...data,
                                location: locationData,
                                type: 'live',
                                receiverId: data.receiverId,
                                userName: receiverData?.informations?.name || 'İsimsiz',
                                userPhoto: receiverData?.profilePicture || null,
                                isSent: true
                            });
                        }
                    });
                    
                    rtdbListeners.push({
                        ref: locationRef,
                        callback: listener
                    });
                    
                    return null; // Burada return değeri önemli değil, onLiveLocationsUpdate callback'i kullanılıyor
                })
            );
        } catch (error) {
            console.error('Gönderilen canlı konumları dinlerken hata:', error);
        }
    });
    
    // Temizleme fonksiyonu
    return () => {
        unsubscribeInstant();
        unsubscribeLive();
        unsubscribeLiveSent();
        
        // RTDB dinleyicilerini temizle
        rtdbListeners.forEach(listener => {
            const { ref, callback } = listener;
            off(ref, 'value', callback);
        });
    };
};

/**
 * Kullanıcı verilerini getir
 * @param {string} userId - Kullanıcı kimliği
 * @returns {Promise<Object>} - Kullanıcı verileri
 */
const getUserData = async (userId) => {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error('Kullanıcı verileri alınamadı:', error);
        return null;
    }
};

/**
 * Anlık konum paylaşımı
 * @param {string} userId - Paylaşımı yapan kullanıcı ID'si
 * @param {string} receiverId - Paylaşımı alacak kullanıcı ID'si
 * @returns {Promise<string>} - Paylaşım ID'si
 */
export const shareInstantLocation = async (userId, receiverId) => {
    try {
        if (!userId || !receiverId) {
            throw new Error('Kullanıcı bilgileri eksik');
        }

        // Konum izinlerini kontrol et
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Konum izni reddedildi');
        }

        // Mevcut konumu al
        const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest
        });

        if (!currentLocation || !currentLocation.coords) {
            throw new Error('Konum bilgisi alınamadı');
        }

        // Konum bilgilerini al
        const locationInfo = await getPlaceFromCoordinates(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude
        );

        // Kullanıcı bilgilerini al
        const [userDoc, receiverDoc] = await Promise.all([
            getDoc(doc(db, 'users', userId)),
            getDoc(doc(db, 'users', receiverId))
        ]);

        if (!userDoc.exists() || !receiverDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const userData = userDoc.data();
        
        // Yeni konum paylaşımı oluştur
        const locationData = {
            senderId: userId,
            receiverId: receiverId,
            senderName: userData?.informations?.name || 'İsimsiz',
            senderUsername: userData?.informations?.username || '',
            senderPhoto: userData?.profilePicture || null,
            location: {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                accuracy: currentLocation.coords.accuracy,
                altitude: currentLocation.coords.altitude,
                heading: currentLocation.coords.heading,
                speed: currentLocation.coords.speed
            },
            locationInfo: locationInfo,
            metadata: {
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: 'active'
            }
        };

        // Firestore'a kaydet
        const docRef = await addDoc(collection(db, 'locations', 'instant', 'shares'), locationData);
        return docRef.id;

    } catch (error) {
        console.error('Konum paylaşımı hatası:', error);
        throw error;
    }
};

/**
 * Canlı konum paylaşımını başlat
 * @param {string} userId - Paylaşımı yapan kullanıcı ID'si
 * @param {string} receiverId - Paylaşımı alacak kullanıcı ID'si
 * @param {number} durationMinutes - Paylaşım süresi (dakika)
 * @returns {Promise<object>} - Paylaşım ID'si ve konum takip bilgileri
 */
export const startLiveLocationSharing = async (userId, receiverId, durationMinutes = 60) => {
    try {
        if (!userId || !receiverId) {
            throw new Error('Kullanıcı bilgileri eksik');
        }

        // Kullanıcı bilgilerini al
        const [userDoc, receiverDoc] = await Promise.all([
            getDoc(doc(db, 'users', userId)),
            getDoc(doc(db, 'users', receiverId))
        ]);

        if (!userDoc.exists() || !receiverDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        // Ön plan konum izinlerini kontrol et
        const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
        if (foreStatus !== 'granted') {
            throw new Error('Konum izni verilmedi');
        }

        // Arka plan konum izinlerini kontrol et
        let backStatus = 'denied';  // Varsayılan olarak izin yok
        const backPermission = await Location.getBackgroundPermissionsAsync();
        
        if (backPermission.status === 'granted') {
            backStatus = 'granted';
        } else {
            // Arka plan izni yoksa iste
            const backPermissionRequest = await Location.requestBackgroundPermissionsAsync();
            if (backPermissionRequest.status === 'granted') {
                backStatus = 'granted';
            } else {
                console.warn('Arka plan konum izni verilmedi. Konum paylaşımı sadece uygulama açıkken çalışacak.');
            }
        }

        // Mevcut konumu al
        const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest
        }).catch(error => {
            console.error('Konum alma hatası:', error);
            throw new Error('Konum alınamadı');
        });

        if (!currentLocation || !currentLocation.coords) {
            throw new Error('Konum bilgisi alınamadı');
        }

        // Konum bilgilerini hazırla
        const locationCoords = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            accuracy: currentLocation.coords.accuracy,
            altitude: currentLocation.coords.altitude,
            heading: currentLocation.coords.heading,
            speed: currentLocation.coords.speed
        };

        // Konum bilgilerini al (şehir, ilçe vs.)
        let locationInfo = {};
        try {
            const response = await Location.reverseGeocodeAsync({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude
            });

            if (response && response.length > 0) {
                locationInfo = {
                    city: response[0].city || response[0].region || 'Bilinmiyor',
                    district: response[0].district || response[0].subregion || 'Bilinmiyor',
                    street: response[0].street || '',
                    country: response[0].country || 'Bilinmiyor'
                };
            }
        } catch (error) {
            console.error('Ters geocoding hatası:', error);
            locationInfo = {
                city: 'Bilinmiyor',
                district: 'Bilinmiyor',
                street: '',
                country: 'Bilinmiyor'
            };
        }

        const userData = userDoc.data();
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        // Firestore'da paylaşım kaydı oluştur
        const locationData = {
            senderId: userId,
            receiverId: receiverId,
            senderName: userData?.informations?.name || 'İsimsiz',
            senderUsername: userData?.informations?.username || '',
            senderPhoto: userData?.profilePicture || null,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: durationMinutes,
            // Konum bilgisini ekle
            location: locationCoords,
            locationInfo: locationInfo,
            metadata: {
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: 'active'
            }
        };

        // Firestore'a kaydet
        const docRef = await addDoc(collection(db, 'locations', 'live', 'shares'), locationData);
        const shareId = docRef.id;

        // RTDB'ye başlangıç konumunu kaydet
        const locationRef = ref(rtdb, `locations/${shareId}`);
        await set(locationRef, {
            ...locationCoords,
            timestamp: Date.now()
        });

        // Konum takip bilgileri
        let trackingInfo = null;
        let backgroundTrackingStarted = false;

        // Arka plan konum takibini başlat (izin varsa)
        if (backStatus === 'granted') {
            backgroundTrackingStarted = await startLiveLocationBackgroundTracking(userId, shareId, endTime);
        }

        // Ön plan konum takibini başlat (arka plan takibi başlamadıysa veya her durumda)
        if (!backgroundTrackingStarted) {
            trackingInfo = await startLiveLocationTracking(userId, shareId);
        }

        return {
            shareId,
            tracking: trackingInfo,
            backgroundTracking: backgroundTrackingStarted
        };

    } catch (error) {
        console.error('Canlı konum paylaşımı başlatma hatası:', error);
        throw error;
    }
};

/**
 * Konum paylaşımını güncelle
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} shareId - Paylaşım ID'si
 * @param {object} location - Konum verisi
 * @returns {Promise<void>}
 */
export const updateLocationShare = async (userId, shareId, location) => {
    try {
        // RTDB'de konum güncelle
        const locationRef = ref(rtdb, `locations/${shareId}`);
        await set(locationRef, {
            ...location,
            timestamp: Date.now()
        });

        // Firestore'da son güncelleme zamanını güncelle
        const shareDoc = doc(db, 'locations/live/shares', shareId);
        await updateDoc(shareDoc, {
            'metadata.updatedAt': serverTimestamp(),
            'location': location
        });

    } catch (error) {
        console.error('Konum güncelleme hatası:', error);
        throw error;
    }
};

/**
 * Canlı konum paylaşımı için konum takibini başlat
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} shareId - Paylaşım ID'si
 * @returns {Promise<object>} - Konum aboneliği ve durdurma fonksiyonu
 */
export const startLiveLocationTracking = async (userId, shareId) => {
    if (!userId || !shareId) {
        throw new Error('Kullanıcı ID veya paylaşım ID eksik');
    }

    try {
        // Önce paylaşımın aktif olup olmadığını kontrol et
        const shareDoc = await getDoc(doc(db, 'locations/live/shares', shareId));
        
        if (!shareDoc.exists()) {
            throw new Error('Paylaşım bulunamadı');
        }
        
        const shareData = shareDoc.data();
        if (shareData.metadata?.status !== 'active' || shareData.senderId !== userId) {
            throw new Error('Paylaşım aktif değil veya size ait değil');
        }

        // Konum izinlerini kontrol et
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Konum izni verilmedi');
        }

        // Konum takibini başlat - iyileştirilmiş ayarlar
        const locationSubscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,  // 5 saniyede bir güncelle
                distanceInterval: 10, // 10 metrede bir güncelle
                // Ön planda daha iyi performans için ek ayarlar
                activityType: Location.ActivityType.Fitness,
                showsBackgroundLocationIndicator: false // Sadece ön planda çalışacağı için false
            },
            async (newLocation) => {
                try {
                    // Paylaşımın hala aktif olup olmadığını kontrol et
                    const currentShareDoc = await getDoc(doc(db, 'locations/live/shares', shareId));
                    if (!currentShareDoc.exists() || currentShareDoc.data().metadata?.status !== 'active') {
                        // Paylaşım artık aktif değil, takibi durdur
                        locationSubscription.remove();
                        return;
                    }

                    // Paylaşım süresini kontrol et
                    const endTime = new Date(currentShareDoc.data().endTime);
                    if (new Date() > endTime) {
                        // Süre dolmuş, paylaşımı durdur
                        await stopLocationSharing(userId, shareId, 'live');
                        locationSubscription.remove();
                        return;
                    }

                    // Konum bilgilerini güncelle
                    const locationData = {
                        latitude: newLocation.coords.latitude,
                        longitude: newLocation.coords.longitude,
                        accuracy: newLocation.coords.accuracy,
                        altitude: newLocation.coords.altitude,
                        heading: newLocation.coords.heading,
                        speed: newLocation.coords.speed
                    };

                    // RTDB ve Firestore'u güncelle
                    await updateLocationShare(userId, shareId, locationData);
                } catch (error) {
                    console.error('Konum güncelleme hatası:', error);
                }
            }
        );

        // Takibi durdurma fonksiyonu
        const stopTracking = async () => {
            try {
                locationSubscription.remove();
            } catch (error) {
                console.error('Konum takibi durdurma hatası:', error);
            }
        };

        return {
            subscription: locationSubscription,
            stop: stopTracking
        };
    } catch (error) {
        console.error('Canlı konum takibi başlatma hatası:', error);
        throw error;
    }
};

/**
 * Konum paylaşımını durdur
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} shareId - Paylaşım ID'si
 * @param {string} type - Paylaşım tipi ('instant' veya 'live')
 * @returns {Promise<void>}
 */
export const stopLocationSharing = async (userId, shareId, type) => {
    try {
        const collectionPath = type === 'instant' ? 'locations/instant/shares' : 'locations/live/shares';
        const shareDoc = doc(db, ...collectionPath.split('/'), shareId);
        
        await updateDoc(shareDoc, {
            'metadata.status': 'stopped',
            'metadata.updatedAt': serverTimestamp()
        });

        if (type === 'live') {
            // RTDB'den canlı konum verilerini sil
            const locationRef = ref(rtdb, `locations/${shareId}`);
            await remove(locationRef);
            
            // Arka plan konum takibini durdur
            await stopLiveLocationBackgroundTracking(userId, shareId);
        }

    } catch (error) {
        console.error('Konum paylaşımını durdurma hatası:', error);
        throw error;
    }
};

/**
 * Alınan paylaşımı durdur
 * @param {string} userId - Alıcı kullanıcı ID'si
 * @param {string} shareId - Paylaşım ID'si
 * @param {string} type - Paylaşım tipi ('instant' veya 'live')
 * @returns {Promise<void>}
 */
export const stopReceivedLocationShare = async (userId, shareId, type) => {
    try {
        const collectionPath = type === 'instant' ? 'locations/instant/shares' : 'locations/live/shares';
        const shareDoc = doc(db, ...collectionPath.split('/'), shareId);
        
        await updateDoc(shareDoc, {
            'metadata.status': 'stopped',
            'metadata.updatedAt': serverTimestamp()
        });

    } catch (error) {
        console.error('Alınan paylaşımı durdurma hatası:', error);
        throw error;
    }
};

/**
 * Canlı konum paylaşımı için arka plan konum takibini başlat
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} shareId - Paylaşım ID'si
 * @param {Date} endTime - Paylaşımın bitiş zamanı
 * @returns {Promise<boolean>} - İşlem başarılı mı?
 */
export const startLiveLocationBackgroundTracking = async (userId, shareId, endTime) => {
    try {
        // Önce izinleri kontrol et
        const forePermission = await Location.getForegroundPermissionsAsync();
        if (forePermission.status !== 'granted') {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                throw new Error('Konum izni verilmedi');
            }
        }
        
        // Arka plan izinlerini kontrol et
        const backPermission = await Location.getBackgroundPermissionsAsync();
        if (backPermission.status !== 'granted') {
            const { status } = await Location.requestBackgroundPermissionsAsync();
            if (status !== 'granted') {
                throw new Error('Arka plan konum izni verilmedi');
            }
        }
        
        // Kullanıcı ID ve paylaşım ID'sini kaydet
        await AsyncStorage.setItem('liveLocationUserId', userId);
        await AsyncStorage.setItem('liveLocationShareId', shareId);
        
        // Bitiş zamanını kaydet
        if (endTime) {
            await AsyncStorage.setItem('liveLocationEndTime', endTime.toISOString());
        }
        
        // Arka plan konum takibi için ayarlar
        const locationOptions = {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 5000,  // 5 saniyede bir güncelle
            distanceInterval: 10, // 10 metrede bir güncelle
            foregroundService: {
                notificationTitle: "Canlı Konum Paylaşımı",
                notificationBody: "Konumunuz arka planda paylaşılıyor",
                notificationColor: "#4CAF50"
            },
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            // Android için ek ayarlar
            foregroundService: {
                notificationTitle: "Canlı Konum Paylaşımı",
                notificationBody: "Konumunuz arka planda paylaşılıyor",
                notificationColor: "#4CAF50",
                notificationId: 789, // Benzersiz bildirim ID'si
                enableVibration: false,
                enableWakeLock: true
            }
        };
        
        // Önceki task'ı durdur (varsa)
        try {
            const isTaskDefined = await TaskManager.isTaskDefined(LIVE_LOCATION_BACKGROUND_TASK);
            if (isTaskDefined) {
                const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LIVE_LOCATION_BACKGROUND_TASK);
                if (isTaskRegistered) {
                    await Location.stopLocationUpdatesAsync(LIVE_LOCATION_BACKGROUND_TASK);
                }
            }
        } catch (stopError) {
            console.error(`Önceki task durdurulurken hata: ${stopError.message}`);
            // Hata olsa bile devam et
        }
        
        // Arka plan görevi başlat
        await Location.startLocationUpdatesAsync(LIVE_LOCATION_BACKGROUND_TASK, locationOptions);
        
        return true;
    } catch (error) {
        console.error(`Arka plan canlı konum takibi başlatılamadı: ${error.message}`);
        console.error(error.stack);
        return false;
    }
};

/**
 * Canlı konum paylaşımı için arka plan konum takibini durdur
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} shareId - Paylaşım ID'si
 * @returns {Promise<boolean>} - İşlem başarılı mı?
 */
export const stopLiveLocationBackgroundTracking = async (userId, shareId) => {
    try {
        // Task'ın tanımlı olup olmadığını kontrol et
        const isTaskDefined = await TaskManager.isTaskDefined(LIVE_LOCATION_BACKGROUND_TASK);
        if (isTaskDefined) {
            const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LIVE_LOCATION_BACKGROUND_TASK);
            if (isTaskRegistered) {
                await Location.stopLocationUpdatesAsync(LIVE_LOCATION_BACKGROUND_TASK);
            }
        }
        
        // AsyncStorage'dan verileri temizle
        await AsyncStorage.removeItem('liveLocationUserId');
        await AsyncStorage.removeItem('liveLocationShareId');
        await AsyncStorage.removeItem('liveLocationEndTime');
        
        return true;
    } catch (error) {
        console.error(`Arka plan canlı konum takibi durdurulamadı: ${error.message}`);
        return false;
    }
};

// Canlı konum paylaşımı için arka plan görevi
TaskManager.defineTask(LIVE_LOCATION_BACKGROUND_TASK, async ({ data, error }) => {
    if (error) {
        console.error('Arka plan canlı konum hatası:', error);
        return;
    }

    if (!data) {
        console.error('Arka plan konum verisi yok');
        return;
    }

    try {
        const { locations } = data;
        if (!locations || locations.length === 0) {
            console.error('Konum verisi yok');
            return;
        }

        const location = locations[0];
        
        // Kullanıcı ID'si ve aktif paylaşım ID'sini al
        const userId = await AsyncStorage.getItem('liveLocationUserId');
        const shareId = await AsyncStorage.getItem('liveLocationShareId');
        
        if (!userId || !shareId) {
            console.error('Kullanıcı ID veya paylaşım ID bulunamadı');
            return;
        }
        
        // Paylaşımın süresini kontrol et
        const endTimeStr = await AsyncStorage.getItem('liveLocationEndTime');
        if (endTimeStr) {
            const endTime = new Date(endTimeStr);
            const now = new Date();
            
            if (now > endTime) {
                // Süre dolmuş, paylaşımı durdur
                try {
                    await stopLocationSharing(userId, shareId, 'live');
                    await Location.stopLocationUpdatesAsync(LIVE_LOCATION_BACKGROUND_TASK);
                    await AsyncStorage.removeItem('liveLocationUserId');
                    await AsyncStorage.removeItem('liveLocationShareId');
                    await AsyncStorage.removeItem('liveLocationEndTime');
                } catch (error) {
                    console.error('Paylaşım durdurma hatası:', error);
                }
                return;
            }
        }
        
        // Konum bilgilerini güncelle
        const locationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            altitude: location.coords.altitude,
            heading: location.coords.heading,
            speed: location.coords.speed
        };
        
        // RTDB ve Firestore'u güncelle
        await updateLocationShare(userId, shareId, locationData);
        
    } catch (error) {
        console.error('Arka plan canlı konum işlemi hatası:', error);
    }
});