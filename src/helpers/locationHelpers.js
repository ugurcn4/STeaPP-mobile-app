import axios from 'axios';
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { LocationTypes, ShareStatus } from '../types/locationTypes';
import * as Location from 'expo-location';

export const getPlaceFromCoordinates = async (latitude, longitude) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=tr&key=AIzaSyA_03hHCb_1yHt-TbGPFSRgGSmDoIhIMSk`
        );

        if (response.data.results.length > 0) {
            const addressComponents = response.data.results[0].address_components;


            let city = '';
            let district = '';

            // Şehir için birden fazla seçenek dene
            const cityComponent = addressComponents.find(comp =>
                comp.types.includes('administrative_area_level_1')
            ) || addressComponents.find(comp =>
                comp.types.includes('locality')
            );

            if (cityComponent) {
                city = cityComponent.long_name;
            }

            // İlçe için birden fazla seçenek dene
            const districtComponent = addressComponents.find(comp =>
                comp.types.includes('administrative_area_level_2')
            ) || addressComponents.find(comp =>
                comp.types.includes('sublocality_level_1')
            ) || addressComponents.find(comp =>
                comp.types.includes('sublocality')
            ) || addressComponents.find(comp =>
                comp.types.includes('neighborhood')
            );

            if (districtComponent) {
                district = districtComponent.long_name.replace(' Merkez', '');
            }

            // Eğer ilçe bulunamadıysa ve şehir bulunduysa
            if (!district && city) {
                district = city;
            }

            // Eğer şehir bulunamadıysa ve ilçe bulunduysa
            if (!city && district) {
                city = district;
            }

            const result = {
                city: city || 'Konum Alınamadı',
                district: district || 'Konum Alınamadı'
            };
            return result;
        }
        return { 
            city: 'Konum Alınamadı', 
            district: 'Konum Alınamadı' 
        };
    } catch (error) {
        return {
            city: 'Konum Alınamadı',
            district: 'Konum Alınamadı'
        };
    }
};

// Konum paylaşımı ile ilgili fonksiyonlar
export const shareLocation = async (userId, friendId, location) => {
    try {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        if (!friendDoc.exists()) {
            return { success: false, error: 'Arkadaş bulunamadı' };
        }

        const shareRef = await addDoc(collection(db, 'shares'), {
            userId,
            friendId,
            location,
            type: LocationTypes.INSTANT,
            startTime: serverTimestamp(),
            lastUpdate: serverTimestamp(),
            status: ShareStatus.ACTIVE
        });

        return {
            success: true,
            shareId: shareRef.id,
            message: 'Konum paylaşımı başlatıldı'
        };
    } catch (error) {
        console.error('Konum paylaşım hatası:', error);
        return {
            success: false,
            error: error.message || 'Paylaşım başlatılırken bir hata oluştu'
        };
    }
};

// Aktif paylaşım kontrolü
export const checkActiveShare = async (userId, friendId, type) => {
    try {
        const sharesRef = collection(db, `users/${userId}/shares`);
        const q = query(
            sharesRef,
            where('friendId', '==', friendId),
            where('type', '==', type),
            where('status', '==', 'active')
        );

        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty; // True döndürürse aktif paylaşım var demektir
    } catch (error) {
        console.error('Paylaşım kontrolü hatası:', error);
        return false;
    }
};

// Konum verilerini normalize eden yardımcı fonksiyon
const normalizeLocation = (location) => {
    if (!location) return null;

    // Android'den gelen string değerleri number'a çevir
    const latitude = typeof location.latitude === 'string' ?
        parseFloat(location.latitude) : location.latitude;
    const longitude = typeof location.longitude === 'string' ?
        parseFloat(location.longitude) : location.longitude;

    return {
        latitude: Number(latitude),
        longitude: Number(longitude)
    };
};

// Anlık konum paylaşımı
export const shareInstantLocation = async (userId, friendId, locationInfo, userInfo) => {
    try {
        // 1. Firestore'da paylaşım kaydı oluştur
        const shareRef = await addDoc(collection(db, `users/${userId}/shares`), {
            type: 'instant',
            friendId: friendId,
            status: 'active',
            startTime: serverTimestamp(),
            lastUpdate: serverTimestamp(),
            locationInfo: locationInfo,
            // Konum bilgilerini doğrudan ekle
            latitude: userInfo.location.latitude,
            longitude: userInfo.location.longitude,
            friendName: userInfo.name,
            friendUsername: userInfo.username,
            friendPhoto: userInfo.profilePicture
        });

        // 2. Karşı tarafa paylaşımı ekle
        await addDoc(collection(db, `users/${friendId}/receivedShares`), {
            type: 'instant',
            fromUserId: userId,
            shareId: shareRef.id,
            status: 'active',
            startTime: serverTimestamp(),
            lastUpdate: serverTimestamp(),
            locationInfo: locationInfo,
            // Konum bilgilerini doğrudan ekle
            latitude: userInfo.location.latitude,
            longitude: userInfo.location.longitude,
            senderName: userInfo.senderName,
            senderUsername: userInfo.senderUsername,
            senderPhoto: userInfo.senderPhoto
        });

        return { success: true, shareId: shareRef.id };
    } catch (error) {
        console.error('Anlık konum paylaşım hatası:', error);
        return { success: false, error: error.message };
    }
};

// Canlı konum paylaşımı başlat
export const startLiveLocation = async (userId, friendId) => {
    try {
        // Aktif paylaşım kontrolü
        const hasActiveShare = await checkActiveShare(userId, friendId, 'live');
        if (hasActiveShare) {
            return {
                success: false,
                error: 'Bu arkadaşınızla zaten aktif bir canlı konum paylaşımınız bulunmakta'
            };
        }

        const location = await getCurrentLocation();
        const currentTime = new Date();
        const normalizedLocation = normalizeLocation(location);

        // Paylaşımı oluştur
        const shareRef = await addDoc(collection(db, `users/${userId}/shares`), {
            type: 'live',
            friendId: friendId,
            status: 'active',
            startTime: currentTime,
            lastUpdate: currentTime,
            location: normalizedLocation
        });

        // Karşı tarafa paylaşımı ekle
        await addDoc(collection(db, `users/${friendId}/receivedShares`), {
            type: 'live',
            fromUserId: userId,
            status: 'active',
            startTime: currentTime,
            lastUpdate: currentTime,
            location: normalizedLocation
        });

        // Konum takibi
        const locationSubscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10
            },
            async (newLocation) => {
                try {
                    const updateTime = new Date();
                    const normalizedNewLocation = normalizeLocation({
                        latitude: newLocation.coords.latitude,
                        longitude: newLocation.coords.longitude
                    });

                    await updateDoc(doc(db, `users/${userId}/shares/${shareRef.id}`), {
                        lastUpdate: updateTime,
                        location: normalizedNewLocation
                    });

                    // Karşı taraftaki paylaşımı da güncelle
                    const receivedSharesRef = collection(db, `users/${friendId}/receivedShares`);
                    const q = query(receivedSharesRef,
                        where('fromUserId', '==', userId),
                        where('status', '==', 'active')
                    );
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach(async (doc) => {
                        await updateDoc(doc.ref, {
                            lastUpdate: updateTime,
                            location: normalizedNewLocation
                        });
                    });
                } catch (error) {
                    console.error('Konum güncelleme hatası:', error);
                }
            }
        );

        return {
            success: true,
            shareId: shareRef.id,
            locationSubscription
        };
    } catch (error) {
        console.error('Canlı konum paylaşım hatası:', error);
        return { success: false, error: error.message };
    }
};

// Paylaşımı durdur
export const stopSharing = async (userId, shareId, type) => {
    try {
        const shareRef = doc(db, `users/${userId}/shares/${shareId}`);
        const shareDoc = await getDoc(shareRef);

        if (!shareDoc.exists()) {
            throw new Error('Paylaşım bulunamadı');
        }

        const shareData = shareDoc.data();

        // Paylaşımı güncelle
        await updateDoc(shareRef, {
            status: 'ended',
            lastUpdate: serverTimestamp()
        });

        // Karşı taraftaki paylaşımı da güncelle
        const receivedSharesRef = collection(db, `users/${shareData.friendId}/receivedShares`);
        const q = query(receivedSharesRef,
            where('fromUserId', '==', userId),
            where('status', '==', 'active')
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc) => {
            await updateDoc(doc.ref, {
                status: 'ended',
                lastUpdate: serverTimestamp()
            });
        });

        return { success: true };
    } catch (error) {
        console.error('Paylaşım durdurma hatası:', error);
        return { success: false, error: error.message };
    }
};

// Paylaşımları getir
export const getShares = async (userId) => {
    try {
        const sharesRef = collection(db, `users/${userId}/shares`);
        const q = query(sharesRef, where('status', '==', 'active'));
        const querySnapshot = await getDocs(q);

        const shares = await Promise.all(
            querySnapshot.docs.map(async (docSnapshot) => {
                const shareData = docSnapshot.data();
                const friendDoc = await getDoc(doc(db, 'users', shareData.friendId));
                const friendData = friendDoc.data();

                // Konum bilgisinden şehir ve bölge bilgisini al
                let locationInfo = { city: 'Bilinmeyen Şehir', district: 'Bilinmeyen Bölge' };
                try {
                    if (shareData.location && shareData.location.latitude && shareData.location.longitude) {
                        const placeInfo = await getPlaceFromCoordinates(
                            shareData.location.latitude,
                            shareData.location.longitude
                        );
                        if (placeInfo) {
                            locationInfo = placeInfo;
                        }
                    }
                } catch (error) {
                    console.error('Konum bilgisi alınamadı:', error);
                }

                return {
                    id: docSnapshot.id,
                    type: shareData.type,
                    friendId: shareData.friendId,
                    friendName: friendData?.informations?.name || 'İsimsiz',
                    friendUsername: friendData?.informations?.username,
                    friendPhoto: friendData?.profilePicture,
                    startTime: shareData.startTime,
                    lastUpdate: shareData.lastUpdate,
                    location: shareData.location,
                    locationInfo: locationInfo,
                    status: shareData.status
                };
            })
        );

        return shares;
    } catch (error) {
        console.error('Paylaşımları getirme hatası:', error);
        return [];
    }
};

// Aktif paylaşımları dinle
export const listenToActiveShares = (userId, callback) => {
    const sharesRef = collection(db, `users/${userId}/shares`);
    const q = query(sharesRef, where('status', '==', 'active'));

    return onSnapshot(q, async (querySnapshot) => {
        try {
            const shares = await Promise.all(
                querySnapshot.docs.map(async (docSnapshot) => {
                    const shareData = docSnapshot.data();
                    const friendDoc = await getDoc(doc(db, 'users', shareData.friendId));
                    const friendData = friendDoc.data();

                    return {
                        id: docSnapshot.id,
                        type: shareData.type,
                        friendId: shareData.friendId,
                        friendName: friendData?.informations?.name || 'İsimsiz',
                        startTime: shareData.startTime,
                        lastUpdate: shareData.lastUpdate,
                        location: shareData.location
                    };
                })
            );

            callback(shares);
        } catch (error) {
            console.error('Paylaşımları dinleme hatası:', error);
            callback([]);
        }
    });
};

// Mevcut konumu al
export const getCurrentLocation = async () => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Konum izni reddedildi');
        }

        const location = await Location.getCurrentPositionAsync({});

        // Android için özel kontrol ve dönüşüm
        const latitude = typeof location.coords.latitude === 'string' ?
            parseFloat(location.coords.latitude) : location.coords.latitude;
        const longitude = typeof location.coords.longitude === 'string' ?
            parseFloat(location.coords.longitude) : location.coords.longitude;


        return {
            latitude: Number(latitude),
            longitude: Number(longitude)
        };
    } catch (error) {
        console.error('Konum alma hatası:', error);
        throw error;
    }
};

// Gelen paylaşımları getir
export const getReceivedShares = async (userId) => {
    try {
        const receivedSharesRef = collection(db, `users/${userId}/receivedShares`);
        const q = query(receivedSharesRef, where('status', '==', 'active'));
        const querySnapshot = await getDocs(q);

        const shares = await Promise.all(
            querySnapshot.docs.map(async (docSnapshot) => {
                const shareData = docSnapshot.data();
                const senderDoc = await getDoc(doc(db, 'users', shareData.fromUserId));
                const senderData = senderDoc.data();

                let locationInfo = { city: 'Bilinmeyen Şehir', district: 'Bilinmeyen Bölge' };
                try {
                    if (shareData.location) {
                        const placeInfo = await getPlaceFromCoordinates(
                            shareData.location.latitude,
                            shareData.location.longitude
                        );
                        if (placeInfo) {
                            locationInfo = placeInfo;
                        }
                    }
                } catch (error) {
                    console.error('Konum bilgisi alınamadı:', error);
                }

                // Timestamp'leri Firebase Timestamp'e çevir
                const startTime = shareData.startTime instanceof Date ?
                    new Date(shareData.startTime.getTime()) :
                    shareData.startTime;

                const lastUpdate = shareData.lastUpdate instanceof Date ?
                    new Date(shareData.lastUpdate.getTime()) :
                    shareData.lastUpdate;

                return {
                    id: docSnapshot.id,
                    type: shareData.type,
                    senderId: shareData.fromUserId,
                    senderName: senderData?.informations?.name || 'İsimsiz',
                    senderUsername: senderData?.informations?.username,
                    senderPhoto: senderData?.profilePicture,
                    startTime: startTime,
                    lastUpdate: lastUpdate,
                    location: shareData.location,
                    locationInfo: locationInfo,
                    status: shareData.status
                };
            })
        );

        return shares;
    } catch (error) {
        console.error('Gelen paylaşımları getirme hatası:', error);
        return [];
    }
};

// Koordinatlardan adres bilgisi alma fonksiyonu
export const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=tr&key=AIzaSyCRuie7ba6LQGd4R-RP2-7GRINossjXCr8`
        );

        if (response.data.status !== 'OK') {
            throw new Error(`Geocoding API error: ${response.data.status}`);
        }

        const result = response.data.results[0];
        if (!result) {
            throw new Error('No results found');
        }

        // Adres bileşenlerini ayıkla
        const addressComponents = result.address_components;
        let district = '';
        let city = '';
        let country = '';
        let street = '';
        let streetNumber = '';
        let postalCode = '';

        for (const component of addressComponents) {
            const types = component.types;

            if (types.includes('administrative_area_level_2')) {
                district = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
                city = component.long_name;
            } else if (types.includes('country')) {
                country = component.long_name;
            } else if (types.includes('route')) {
                street = component.long_name;
            } else if (types.includes('street_number')) {
                streetNumber = component.long_name;
            } else if (types.includes('postal_code')) {
                postalCode = component.long_name;
            }

            // İlçe bulunamadıysa alternatif olarak sublocality'i kullan
            if (!district && (types.includes('sublocality_level_1') || types.includes('sublocality'))) {
                district = component.long_name;
            }

            // İlçe hala bulunamadıysa neighborhood'u kullan
            if (!district && types.includes('neighborhood')) {
                district = component.long_name;
            }
        }

        // Tam adres
        const formattedAddress = result.formatted_address;

        return {
            formattedAddress,
            district,
            city,
            country,
            street,
            streetNumber,
            postalCode,
            coordinates: {
                latitude,
                longitude
            }
        };
    } catch (error) {
        console.error('Adres bilgisi alınırken hata:', error);
        return {
            formattedAddress: 'Adres bilgisi alınamadı',
            district: '',
            city: '',
            country: '',
            coordinates: {
                latitude,
                longitude
            }
        };
    }
};

// Diğer konum ile ilgili fonksiyonlar buraya... 