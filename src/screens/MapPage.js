import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, SafeAreaView, Platform, Modal, Pressable } from 'react-native';
import MapView, { Polyline, Marker, AnimatedRegion } from 'react-native-maps';
import * as Location from 'expo-location';
import {
    collection,
    addDoc,
    onSnapshot,
    getDoc,
    serverTimestamp,
    query,
    getDocs,
    where,
    doc,
    deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { fetchFriends } from './FriendsPage';
import { haversine } from '../helpers/locationUtils';
import {
    shouldCollectPoint,
    GPS_ACCURACY,
    MOVEMENT_CONSTANTS,
    evaluateGPSQuality,
    isGPSUsable,
    isStationary,
    calculateBearing
} from '../helpers/pathTracking';
import { getPlaceFromCoordinates } from '../helpers/locationHelpers';
import FastImage from 'react-native-fast-image';
import { startBackgroundLocationUpdates, stopBackgroundLocationUpdates } from '../services/LocationBackgroundService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    useSharedValue,
} from 'react-native-reanimated';
import { listenToLocationShares, stopLocationSharing } from '../services/LocationSharingService';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../../firebaseConfig';
import LineStyleModal from '../modals/LineStyleModal';
import DurationModal from '../modals/DurationModal';
import { translate } from '../i18n/i18n';
import CapsuleButton from '../components/CapsuleButton';
import CapsuleModal from '../modals/CapsuleModal';

// Yol renk ve stilleri
const PATH_STYLES = {
    colors: {
        newPath: '#FFD700',
        discovered: '#4CAF50',
        undiscovered: '#808080'
    },
    width: 6
};


// Animasyonlu marker bileşeni
class AnimatedMarker extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            coordinate: new AnimatedRegion({
                latitude: props.coordinate.latitude || 0,
                longitude: props.coordinate.longitude || 0,
                latitudeDelta: 0.00922,
                longitudeDelta: 0.00421
            }),
            prevCoordinate: props.coordinate,
            isFirstRender: true
        };
        
        // Marker referansını sakla
        this.marker = null;
        
        // Animasyon işlemini sakla
        this.animation = null;
    }
    
    // Yeni props geldiğinde
    static getDerivedStateFromProps(nextProps, prevState) {
        const { coordinate } = nextProps;
        const { prevCoordinate, isFirstRender } = prevState;
        
        // Koordinatlar geçerli mi kontrol et
        if (!coordinate || !coordinate.latitude || !coordinate.longitude) {
            return null;
        }
        
        // İlk render ise veya koordinat değişmediyse güncelleme yapma
        if (isFirstRender || 
            (prevCoordinate.latitude === coordinate.latitude && 
             prevCoordinate.longitude === coordinate.longitude)) {
            return { isFirstRender: false, prevCoordinate: coordinate };
        }
        
        // Koordinat değiştiğinde state'i güncelle
        return {
            prevCoordinate: coordinate,
            isFirstRender: false
        };
    }
    
    componentDidMount() {
        // İlk render'da koordinatı doğrudan ayarla (animasyonsuz)
        const { coordinate } = this.props;
        if (coordinate && coordinate.latitude && coordinate.longitude) {
            this.setCoordinateWithoutAnimation(coordinate);
        }
    }

    componentDidUpdate(prevProps) {
        const { coordinate } = this.props;
        const { prevCoordinate } = this.state;
        
        // Koordinatlar geçerli mi kontrol et
        if (!coordinate || !coordinate.latitude || !coordinate.longitude) {
            return;
        }
        
        // Konum değiştiğinde animasyonlu geçiş yap
        if (prevProps.coordinate.latitude !== coordinate.latitude ||
            prevProps.coordinate.longitude !== coordinate.longitude) {
            
            // Animasyon süresi - mesafeye göre ayarla
            const distance = this.calculateDistance(
                prevCoordinate.latitude,
                prevCoordinate.longitude,
                coordinate.latitude,
                coordinate.longitude
            );
            
            // Mesafeye göre animasyon süresini ayarla (minimum 300ms, maksimum 1000ms)
            const duration = Math.min(Math.max(distance * 500, 300), 1000);
            
            // Animasyonu başlat
            this.animateMarker(coordinate, duration);
        }
    }
    
    // Animasyonsuz doğrudan koordinat ayarla
    setCoordinateWithoutAnimation(coordinate) {
        if (Platform.OS === 'android') {
            if (this.state.coordinate) {
                this.state.coordinate.setValue({
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude,
                    latitudeDelta: 0.00922,
                    longitudeDelta: 0.00421
                });
            }
        } else {
            // iOS için
            const newCoordinate = {
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                latitudeDelta: 0.00922,
                longitudeDelta: 0.00421
            };
            this.state.coordinate.setValue(newCoordinate);
        }
    }

    // İki nokta arasındaki mesafeyi hesapla (km cinsinden)
    calculateDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        
        const R = 6371; // Dünya yarıçapı (km)
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Mesafe (km)
    }

    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    animateMarker(coordinate, duration = 500) {
        // Önceki animasyonu iptal et
        if (this.animation) {
            this.animation.stop();
            this.animation = null;
        }
        
        const newCoordinate = {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: 0.00922,
            longitudeDelta: 0.00421
        };

        if (Platform.OS === 'android') {
            if (this.marker && this.marker._component) {
                try {
                    this.marker._component.animateMarkerToCoordinate(newCoordinate, duration);
                } catch (error) {
                    // Animasyon hatası durumunda doğrudan ayarla
                    this.setCoordinateWithoutAnimation(newCoordinate);
                }
            } else {
                // Marker referansı yoksa doğrudan ayarla
                this.setCoordinateWithoutAnimation(newCoordinate);
            }
        } else {
            // iOS için Animated.timing kullan
            this.animation = this.state.coordinate.timing({
                ...newCoordinate,
                duration,
                useNativeDriver: false // iOS için gerekli
            });
            
            this.animation.start();
        }
    }
    
    // Component kaldırıldığında animasyonu temizle
    componentWillUnmount() {
        if (this.animation) {
            this.animation.stop();
            this.animation = null;
        }
    }

    render() {
        const { children, onPress, tracksViewChanges = false } = this.props;
        return (
            <Marker.Animated
                ref={marker => { this.marker = marker; }}
                coordinate={this.state.coordinate}
                onPress={onPress}
                tracksViewChanges={tracksViewChanges}
            >
                {children}
            </Marker.Animated>
        );
    }
}

const CustomMarker = ({ photo, name, isLive = false }) => {
    return (
        <View style={customMarkerStyles.container}>
            <View style={[customMarkerStyles.bubble, isLive && customMarkerStyles.liveBubble]}>
                {photo ? (
                    <FastImage
                        source={{ uri: photo }}
                        style={customMarkerStyles.image}
                    />
                ) : (
                    <View style={[customMarkerStyles.fallbackImage, isLive && customMarkerStyles.liveFallbackImage]}>
                        <Text style={customMarkerStyles.fallbackText}>
                            {name ? name.charAt(0).toUpperCase() : '?'}
                        </Text>
                    </View>
                )}
                {isLive && (
                    <View style={customMarkerStyles.liveIndicator}>
                        <Ionicons name="radio" size={12} color="#FFFFFF" />
                    </View>
                )}
            </View>
            <View style={[customMarkerStyles.arrowBorder, isLive && customMarkerStyles.liveArrowBorder]} />
            <View style={[customMarkerStyles.arrow, isLive && customMarkerStyles.liveArrow]} />
        </View>
    );
};

const MapPage = ({ route }) => {
    const [MapType, setMapType] = useState('standard');
    const [location, setLocation] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sharedLocations, setSharedLocations] = useState([]);
    const [receivedLocations, setReceivedLocations] = useState([]);
    const [receivedInstantLocations, setReceivedInstantLocations] = useState([]);
    const [friendPickerVisible, setFriendPickerVisible] = useState(false);
    const [friends, setFriends] = useState([]);
    const mapRef = useRef(null);
    const [liveLocations, setLiveLocations] = useState([]);
    const [activeShares, setActiveShares] = useState([]);
    const [locations, setLocations] = useState({
        active: {},
        shared: {}
    });
    const [pathCoordinates, setPathCoordinates] = useState([]);
    const [currentPath, setCurrentPath] = useState({
        points: [],
        startTime: null
    });
    const [savedPaths, setSavedPaths] = useState([]);
    const [selectedPath, setSelectedPath] = useState(null);
    const [is3DMode, setIs3DMode] = useState(false);
    const [showMapTypeMenu, setShowMapTypeMenu] = useState(false);
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [followsUserLocation, setFollowsUserLocation] = useState(false);
    const [showPathDetails, setShowPathDetails] = useState(false);
    const [accuracyHistory, setAccuracyHistory] = useState([]);
    const [isGPSCalibrated, setIsGPSCalibrated] = useState(false);
    const [gpsQuality, setGpsQuality] = useState('POOR');
    const [calibrationStartTime, setCalibrationStartTime] = useState(null);
    const [isMoving, setIsMoving] = useState(true);
    const [lastLocations, setLastLocations] = useState([]);
    const [locationSubscription, setLocationSubscription] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [isBackgroundDrawing, setIsBackgroundDrawing] = useState(false);
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState(null);
    const [showLineStyleModal, setShowLineStyleModal] = useState(false);
    const [selectedLineStyle, setSelectedLineStyle] = useState({
        color: PATH_STYLES.colors.discovered,
        width: PATH_STYLES.width,
        pattern: 'solid'
    });
    const [showCapsuleModal, setShowCapsuleModal] = useState(false);

    // Animasyon değerleri
    const translateY = useSharedValue(0);

    // Modal kapandığında translateY değerini sıfırla
    useEffect(() => {
        if (!showDurationModal) {
            translateY.value = 0;
        }
    }, [showDurationModal]);

    // Uygulama başladığında çizim indekslerini sıfırla
    useEffect(() => {
        const resetDrawingIndices = async () => {
            await AsyncStorage.setItem('foregroundPathPartIndex', '0');
        };

        resetDrawingIndices();
    }, []);

    // Modal açıldığında veya kapandığında handler

    useEffect(() => {
        const auth = getAuth();

        const startLocationTracking = async (currentUserId) => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(translate('error'), translate('location_permission_required'));
                    setLoading(false);
                    return;
                }

                // Kalibrasyon başlangıç zamanını ayarla
                setCalibrationStartTime(Date.now());
                setFollowsUserLocation(false); // Başlangıçta false olarak ayarlayalım

                const initialLocation = await Location.getCurrentPositionAsync({});
                setLocation(initialLocation);

                // Region state'ini güncelleyelim
                if (initialLocation && initialLocation.coords) {
                    setRegion({
                        latitude: initialLocation.coords.latitude,
                        longitude: initialLocation.coords.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                    });
                }

                setLoading(false);

                const subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: MOVEMENT_CONSTANTS.MOVEMENT_CHECK_INTERVAL,
                        distanceInterval: 10,
                    },
                    (newLocation) => {
                        setLocation(newLocation);

                        // Konum takibi - followsUserLocation'a bağlı
                        if (followsUserLocation && mapRef.current) {
                            mapRef.current.animateToRegion({
                                latitude: newLocation.coords.latitude,
                                longitude: newLocation.coords.longitude,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            }, 1000);

                            // Konum değiştiğinde region state'ini sadece followsUserLocation true ise güncelle
                            setRegion({
                                latitude: newLocation.coords.latitude,
                                longitude: newLocation.coords.longitude,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            });
                        }

                        // GPS kalibrasyonu ve diğer işlemler followsUserLocation'dan bağımsız
                        updateLocationData(newLocation, currentUserId);
                    }
                );

                setLocationSubscription(subscription);
            } catch (error) {
                console.error(translate('location_tracking_error'), error);
                setLoading(false);
            }
        };

        // Yeni fonksiyon: Konum verilerini güncelleme
        const updateLocationData = (newLocation, currentUserId) => {
            // Son konumları güncelle
            setLastLocations(prev => {
                const newLocations = [...prev, {
                    latitude: newLocation.coords.latitude,
                    longitude: newLocation.coords.longitude,
                    timestamp: new Date()
                }].slice(-MOVEMENT_CONSTANTS.STATIONARY_CHECK_COUNT);
                return newLocations;
            });

            // GPS doğruluğu geçmişini güncelle - daha hızlı dolması için her zaman ekle
            setAccuracyHistory(prev => {
                const newHistory = [...prev, newLocation.coords.accuracy];
                return newHistory.slice(-GPS_ACCURACY.SAMPLE_SIZE);
            });

            // GPS kalitesini değerlendir
            const quality = evaluateGPSQuality(newLocation.coords.accuracy);
            setGpsQuality(quality);

            // GPS kalibrasyonu kontrolü - iyileştirilmiş versiyon
            if (!isGPSCalibrated) {
                const timeSinceStart = Date.now() - calibrationStartTime;

                // Kalibrasyon için iki koşul:
                // 1. Minimum süre geçmiş olmalı
                // 2. Ya GPS kalitesi iyi olmalı ya da yeterli örnek toplanmış olmalı
                const hasMinimumTime = timeSinceStart >= GPS_ACCURACY.CALIBRATION_TIME;
                const hasGoodQuality = quality === 'OPTIMAL' || quality === 'GOOD';
                const hasEnoughSamples = accuracyHistory.length >= GPS_ACCURACY.SAMPLE_SIZE;

                if (hasMinimumTime && (hasGoodQuality || hasEnoughSamples)) {
                    setIsGPSCalibrated(true);
                }
            }

            // Hareket durumunu kontrol et - iyileştirilmiş versiyon
            const speedMs = newLocation.coords.speed || 0;
            const isCurrentlyStationary = isStationary(speedMs, lastLocations);

            // Hareket durumunu güncelle, ancak sadece değişiklik varsa
            if (isCurrentlyStationary !== !isMoving) {
                // Durağan durumdan hareketli duruma geçişte hemen güncelle
                if (!isCurrentlyStationary && !isMoving) {
                    setIsMoving(true);
                }
                // Hareketli durumdan durağan duruma geçişte biraz bekle (kararlılık için)
                else if (isCurrentlyStationary && isMoving) {
                    // Durağan duruma geçiş için bir zamanlayıcı kullanabiliriz
                    // Ancak bu örnekte basitlik için doğrudan güncelliyoruz
                    setIsMoving(false);
                }
            }

            // Hız hesaplamaları
            let speedKmh = 0;
            if (newLocation.coords.speed != null && newLocation.coords.speed >= 0) {
                speedKmh = Math.round(newLocation.coords.speed * 3.6);
                if (speedKmh < 3) speedKmh = 0;
            }
            setCurrentSpeed(speedKmh);

            // Konum takibi ve yol çizimi
            if (isGPSCalibrated && currentUserId) {
                trackUserLocation(newLocation, currentUserId);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                await startLocationTracking(user.uid);
            } else {
                setUserId(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
        };
    }, []); // followsUserLocation'ı dependency array'den çıkardık

    useEffect(() => {
        if (!userId) return;

        const pathsRef = collection(db, `users/${userId}/paths`);
        const unsubscribe = onSnapshot(pathsRef, (snapshot) => {
            const paths = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSavedPaths(paths);
        });

        return () => unsubscribe();
    }, [userId]);

    // RTDB dinleyicileri için referans
    const rtdbListenersRef = useRef({});

    // Konum dinleme useEffect'i - Yeni LocationSharingService API'si kullanılıyor
    useEffect(() => {
        if (!userId) return;

        // Aktif paylaşımları dinle - Yeni API kullanımı
        const unsubscribe = listenToLocationShares(
            userId, 
            // Anlık konum callback'i
            (instantLocations) => {
                // Gelen anlık konumları işle
                const formattedLocations = instantLocations.map(loc => {
                    // Gönderilen veya alınan paylaşımlara göre farklı işle
                    if (loc.isSent) {
                        // Gönderilen paylaşım
                        return {
                            id: loc.id,
                            shareId: loc.id,
                            type: 'instant',
                            receiverId: loc.receiverId,
                            senderName: loc.userName || 'İsimsiz',
                            senderPhoto: loc.userPhoto,
                            location: loc.location,
                            locationInfo: loc.locationInfo,
                            metadata: loc.metadata,
                            lastUpdate: loc.metadata?.updatedAt,
                            startTime: loc.metadata?.createdAt,
                            isSent: true
                        };
                    } else {
                        // Alınan paylaşım
                        return {
                            id: loc.id,
                            shareId: loc.id,
                            type: 'instant',
                            senderId: loc.senderId,
                            senderName: loc.senderName || 'İsimsiz',
                            senderPhoto: loc.senderPhoto,
                            location: loc.location,
                            locationInfo: loc.locationInfo,
                            metadata: loc.metadata,
                            lastUpdate: loc.metadata?.updatedAt,
                            startTime: loc.metadata?.createdAt,
                            isReceived: true
                        };
                    }
                });
                
                // Anlık konumları set et
                setReceivedInstantLocations(formattedLocations);
            },
            // Canlı konum callback'i
            (id, updatedLocation) => {
                if (id === null) {
                    // Tüm canlı konumları al
                    const formattedLocations = updatedLocation.map(loc => {
                        // Gönderilen veya alınan paylaşımlara göre farklı işle
                        if (loc.isSent) {
                            // Gönderilen paylaşım
                            return {
                                id: loc.id,
                                shareId: loc.id,
                                type: 'live',
                                receiverId: loc.receiverId,
                                senderName: loc.userName || 'İsimsiz',
                                senderPhoto: loc.userPhoto,
                                startTime: loc.startTime,
                                endTime: loc.endTime,
                                metadata: loc.metadata,
                                lastUpdate: loc.metadata?.updatedAt,
                                // Konum bilgisini doğrudan erişilebilir hale getir
                                latitude: loc.location?.latitude,
                                longitude: loc.location?.longitude,
                                // Orijinal konum nesnesini de koru
                                location: loc.location,
                                isSent: true
                            };
                        } else {
                            // Alınan paylaşım
                            return {
                                id: loc.id,
                                shareId: loc.id,
                                type: 'live',
                                senderId: loc.senderId,
                                senderName: loc.senderName || 'İsimsiz',
                                senderPhoto: loc.senderPhoto,
                                startTime: loc.startTime,
                                endTime: loc.endTime,
                                metadata: loc.metadata,
                                lastUpdate: loc.metadata?.updatedAt,
                                // Konum bilgisini doğrudan erişilebilir hale getir
                                latitude: loc.location?.latitude,
                                longitude: loc.location?.longitude,
                                // Orijinal konum nesnesini de koru
                                location: loc.location,
                                isReceived: true
                            };
                        }
                    });
                    
                    // Canlı konumları set et
                    setReceivedLocations(formattedLocations);
                } else {
                    // Tek bir canlı konum güncellendi
                    setReceivedLocations(prev => {
                        const updatedShares = prev.filter(loc => loc.id !== id);
                        
                        // Gönderilen veya alınan paylaşımlara göre farklı işle
                        let newShare;
                        if (updatedLocation.isSent) {
                            // Gönderilen paylaşım
                            newShare = {
                                id: id,
                                shareId: id,
                                type: 'live',
                                receiverId: updatedLocation.receiverId,
                                senderName: updatedLocation.userName || 'İsimsiz',
                                senderPhoto: updatedLocation.userPhoto,
                                // Konum bilgisini doğrudan erişilebilir hale getir
                                latitude: updatedLocation.location?.latitude,
                                longitude: updatedLocation.location?.longitude,
                                // Orijinal konum nesnesini de koru
                                location: updatedLocation.location,
                                metadata: updatedLocation.metadata,
                                lastUpdate: updatedLocation.metadata?.updatedAt,
                                startTime: updatedLocation.startTime,
                                endTime: updatedLocation.endTime,
                                isSent: true
                            };
                        } else {
                            // Alınan paylaşım
                            newShare = {
                                id: id,
                                shareId: id,
                                type: 'live',
                                senderId: updatedLocation.senderId,
                                senderName: updatedLocation.senderName || 'İsimsiz',
                                senderPhoto: updatedLocation.senderPhoto,
                                // Konum bilgisini doğrudan erişilebilir hale getir
                                latitude: updatedLocation.location?.latitude,
                                longitude: updatedLocation.location?.longitude,
                                // Orijinal konum nesnesini de koru
                                location: updatedLocation.location,
                                metadata: updatedLocation.metadata,
                                lastUpdate: updatedLocation.metadata?.updatedAt,
                                startTime: updatedLocation.startTime,
                                endTime: updatedLocation.endTime,
                                isReceived: true
                            };
                        }
                        
                        return [...updatedShares, newShare];
                    });
                    
                    // Varsa önceki dinleyiciyi temizle
                    if (rtdbListenersRef.current[id]) {
                        rtdbListenersRef.current[id]();
                        delete rtdbListenersRef.current[id];
                    }
                    
                    // RTDB'den canlı konum güncellemelerini dinle
                    const rtdbRef = ref(rtdb, `locations/${id}`);
                    const unsubscribe = onValue(rtdbRef, (snapshot) => {
                        const rtdbData = snapshot.val();
                        if (rtdbData) {
                            // RTDB'den gelen konum verisini kullan
                            setReceivedLocations(prev => {
                                return prev.map(loc => {
                                    if (loc.id === id) {
                                        // Konum bilgilerini güncelle
                                        return {
                                            ...loc,
                                            latitude: rtdbData.latitude,
                                            longitude: rtdbData.longitude,
                                            location: {
                                                ...loc.location,
                                                latitude: rtdbData.latitude,
                                                longitude: rtdbData.longitude,
                                                accuracy: rtdbData.accuracy,
                                                altitude: rtdbData.altitude,
                                                heading: rtdbData.heading,
                                                speed: rtdbData.speed
                                            },
                                            lastRtdbUpdate: rtdbData.timestamp
                                        };
                                    }
                                    return loc;
                                });
                            });
                        }
                    });
                    
                    // Temizleme fonksiyonunu sakla
                    rtdbListenersRef.current[id] = () => {
                        off(rtdbRef);
                    };
                }
            }
        );

        return () => {
            // Firestore dinleyicisini temizle
            if (unsubscribe) unsubscribe();
            
            // RTDB dinleyicilerini temizle
            Object.values(rtdbListenersRef.current).forEach(cleanupFn => {
                if (typeof cleanupFn === 'function') {
                    cleanupFn();
                }
            });
            rtdbListenersRef.current = {};
        };
    }, [userId]);

    // Konumları filtrelemek için useEffect
    useEffect(() => {
        const filterLocations = () => {
            // Canlı konumları filtrele
            const filteredLive = liveLocations.filter(location => {
                const hasActiveShare = activeShares.some(share =>
                    share.friendId === location.sharedBy &&
                    share.type === 'live'
                );
                return hasActiveShare;
            });

            // Paylaşılan konumları filtrele
            const filteredShared = sharedLocations.filter(location => {
                const hasActiveShare = activeShares.some(share =>
                    share.friendId === location.sharedBy &&
                    share.type === 'current'
                );
                return hasActiveShare;
            });

            setLocations({
                active: filteredLive.map(loc => ({
                    ...loc,
                    type: 'live'
                })),
                shared: filteredShared.map(loc => ({
                    ...loc,
                    type: 'shared'
                }))
            });
        };

        filterLocations();
    }, [activeShares, liveLocations, sharedLocations]);

    const handleMyLocation = () => {
        if (location?.coords) {
            mapRef.current?.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 1000);
            setFollowsUserLocation(true);
        }
    };

    useEffect(() => {
        if (friendPickerVisible && userId) {
            const loadFriends = async () => {
                const friendsList = await fetchFriends(userId);
                setFriends(friendsList);
            };
            loadFriends();
        }
    }, [friendPickerVisible, userId]);

    const savePath = useCallback(async (points, currentUserId) => {
        if (!currentUserId || points.length < 2) return;

        try {
            // Yolun başlangıç noktasından şehir bilgisini al
            const startPoint = points[0];
            const locationInfo = await getPlaceFromCoordinates(
                startPoint.latitude,
                startPoint.longitude
            );

            const pathRef = collection(db, `users/${currentUserId}/paths`);
            await addDoc(pathRef, {
                points: points.map(point => ({
                    latitude: point.latitude,
                    longitude: point.longitude,
                    timestamp: point.timestamp
                })),
                firstDiscovery: serverTimestamp(),
                visitCount: 1,
                type: 'discovered',
                city: locationInfo.city || 'Bilinmeyen',
                district: locationInfo.district || 'Bilinmeyen'
            });

        } catch (error) {
            console.error('Yol kaydedilirken hata:', error);
            // Hata durumunda bile kaydı yapalım ama şehir bilgisi olmadan
            const pathRef = collection(db, `users/${currentUserId}/paths`);
            await addDoc(pathRef, {
                points: points.map(point => ({
                    latitude: point.latitude,
                    longitude: point.longitude,
                    timestamp: point.timestamp
                })),
                firstDiscovery: serverTimestamp(),
                visitCount: 1,
                type: 'discovered',
                city: 'Bilinmeyen',
                district: 'Bilinmeyen'
            });
        }
    }, []);

    const trackUserLocation = useCallback(async (newLocation, currentUserId) => {
        if (!currentUserId) return;

        // GPS kullanılabilirlik kontrolü
        if (!isGPSUsable(newLocation.coords.accuracy, accuracyHistory)) {
            return;
        }

        // Yeni noktayı toplamak gerekiyor mu kontrol et
        const lastLocation = pathCoordinates.length > 0 ? pathCoordinates[pathCoordinates.length - 1] : null;

        // shouldCollectPoint kontrolü
        if (!shouldCollectPoint(newLocation, lastLocation)) {
            return;
        }

        // Yeni nokta için bearing hesapla
        let bearing = null;
        if (lastLocation) {
            bearing = calculateBearing(
                lastLocation.latitude,
                lastLocation.longitude,
                newLocation.coords.latitude,
                newLocation.coords.longitude
            );
        }

        const newPoint = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            timestamp: new Date(),
            accuracy: newLocation.coords.accuracy,
            quality: gpsQuality,
            bearing: bearing,
            speed: newLocation.coords.speed || 0
        };

        // Son nokta ile yeni nokta arasındaki mesafeyi kontrol et
        setPathCoordinates(prev => {
            const lastPoint = prev[prev.length - 1];
            if (lastPoint) {
                // İki nokta arası mesafeyi metre cinsinden hesapla
                const distance = haversine(
                    lastPoint.latitude,
                    lastPoint.longitude,
                    newPoint.latitude,
                    newPoint.longitude
                );

                // Mesafe çok fazlaysa (100m yerine 200m) ve hareketsiz duruma geçmişse yeni bir path başlat
                if (distance > 200 && !isMoving) {
                    return [newPoint]; // Yeni bir dizi başlat
                }
            }
            return [...prev, newPoint];
        });

        setCurrentPath(prev => {
            const lastPoint = prev.points[prev.points.length - 1];
            if (lastPoint) {
                const distance = haversine(
                    lastPoint.latitude,
                    lastPoint.longitude,
                    newPoint.latitude,
                    newPoint.longitude
                );

                // Mesafe çok fazlaysa (100m yerine 200m) ve hareketsiz duruma geçmişse yeni bir path başlat
                if (distance > 200 && !isMoving) {
                    if (prev.points.length >= 2) {
                        // Son iki noktayı dahil ederek kaydet
                        savePath([...prev.points], currentUserId);
                    }
                    return {
                        points: [newPoint],
                        startTime: new Date()
                    };
                }
            }

            const updatedPoints = [...prev.points, newPoint];
            if (!prev.startTime) {
                return {
                    points: updatedPoints,
                    startTime: new Date()
                };
            }

            const timeSinceStart = new Date() - prev.startTime;

            // Daha uzun bir süre ve daha fazla nokta için kayıt yapalım
            if (timeSinceStart > 10 * 60 * 1000 || updatedPoints.length >= 50) {
                // Tüm noktaları kaydet
                savePath(updatedPoints, currentUserId);
                return {
                    points: [newPoint], // Yeni yol için sadece son noktayı tut
                    startTime: new Date()
                };
            }

            return {
                points: updatedPoints,
                startTime: prev.startTime
            };
        });
    }, [accuracyHistory, gpsQuality, savePath, isMoving]);

    const toggle3DMode = () => {
        setIs3DMode(!is3DMode);
        if (mapRef.current) {
            mapRef.current.animateCamera({
                pitch: is3DMode ? 0 : 35,
                heading: is3DMode ? 0 : 30,
                duration: 1000
            });
        }
    };

    const mapTypes = [
        { id: 'standard', name: translate('map_standard'), icon: 'map-outline' },
        { id: 'satellite', name: translate('map_satellite'), icon: 'earth' },
        { id: 'hybrid', name: translate('map_hybrid'), icon: 'globe-outline' },
        { id: 'terrain', name: translate('map_terrain'), icon: 'layers-outline' }
    ];

    // Harita etkileşimlerini dinleyen fonksiyon
    const handleMapInteraction = () => {
        if (followsUserLocation) {
            setFollowsUserLocation(false);
        }
    };

    const handlePathPress = (path) => {
        setSelectedPath(path);
        setShowPathDetails(true);
    };

    const closePathDetails = () => {
        setShowPathDetails(false);
        setSelectedPath(null);
    };

    // Yol mesafesini hesaplama yardımcı fonksiyonu
    const calculatePathDistance = (points) => {
        if (!points || points.length < 2) return 0;

        let totalDistance = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const startPoint = points[i];
            const endPoint = points[i + 1];

            const distance = haversine(
                startPoint.latitude,
                startPoint.longitude,
                endPoint.latitude,
                endPoint.longitude
            );

            totalDistance += distance;
        }

        return totalDistance;
    };

    // Yol silme fonksiyonu
    const deletePath = async (pathId) => {
        if (!userId || !pathId) {
            Alert.alert(translate('error'), translate('user_or_path_info_missing'));
            return;
        }

        // Kullanıcıya silme işlemini onaylatma
        Alert.alert(
            translate('delete_path'),
            translate('delete_path_confirm'),
            [
                {
                    text: translate('cancel'),
                    style: 'cancel'
                },
                {
                    text: translate('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Firestore'dan yolu sil
                            const pathRef = doc(db, `users/${userId}/paths/${pathId}`);
                            await deleteDoc(pathRef);

                            // Başarılı mesajı göster
                            Alert.alert(translate('success'), translate('path_deleted'));

                            // Yol detaylarını kapat
                            closePathDetails();
                        } catch (error) {
                            console.error(translate('path_delete_error'), error);
                            Alert.alert(translate('error'), translate('path_delete_error_message') + error.message);
                        }
                    }
                }
            ]
        );
    };

    const handleMarkerPress = (share) => {
        // Konum uzaklığını hesapla
        let distance = 0;

        if (location && location.coords) {
            // Paylaşılan konumun koordinatlarını belirle
            let shareLatitude, shareLongitude;

            if (share.location) {
                shareLatitude = share.location.latitude;
                shareLongitude = share.location.longitude;
            } else if (share.latitude && share.longitude) {
                shareLatitude = share.latitude;
                shareLongitude = share.longitude;
            }

            // Eğer paylaşılan konum koordinatları varsa mesafeyi hesapla
            if (shareLatitude && shareLongitude) {
                distance = haversine(
                    location.coords.latitude,
                    location.coords.longitude,
                    shareLatitude,
                    shareLongitude
                );
            }
        }

        // Zaman bilgisini hesapla
        let lastUpdateText = 'Bilinmiyor';
        if (share && share.lastUpdate) {
            try {
                const now = new Date();

                // Firestore Timestamp, Date nesnesi veya ISO string olabilir
                let lastUpdate;

                if (typeof share.lastUpdate === 'object' && share.lastUpdate !== null) {
                    // Firestore Timestamp nesnesi ise
                    if (typeof share.lastUpdate.toDate === 'function') {
                        lastUpdate = share.lastUpdate.toDate();
                    }
                    // Zaten bir Date nesnesi ise
                    else if (share.lastUpdate instanceof Date) {
                        lastUpdate = share.lastUpdate;
                    }
                    // Seconds ve nanoseconds alanları varsa (Firestore Timestamp benzeri)
                    else if (share.lastUpdate.seconds !== undefined) {
                        lastUpdate = new Date(share.lastUpdate.seconds * 1000);
                    }
                    // Hiçbiri değilse şu anki zamanı kullan
                    else {
                        lastUpdate = now;
                    }
                }
                // String ise Date nesnesine çevir
                else if (typeof share.lastUpdate === 'string') {
                    lastUpdate = new Date(share.lastUpdate);
                }
                // Sayı ise milisaniye olarak kabul et
                else if (typeof share.lastUpdate === 'number') {
                    lastUpdate = new Date(share.lastUpdate);
                }
                // Hiçbiri değilse şu anki zamanı kullan
                else {
                    lastUpdate = now;
                }

                const diffMs = now - lastUpdate;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins < 1) {
                    lastUpdateText = 'Şimdi';
                } else if (diffMins < 60) {
                    lastUpdateText = `${diffMins} dakika önce`;
                } else if (diffMins < 24 * 60) {
                    const hours = Math.floor(diffMins / 60);
                    lastUpdateText = `${hours} saat önce`;
                } else {
                    const days = Math.floor(diffMins / (24 * 60));
                    lastUpdateText = `${days} gün önce`;
                }
            } catch (error) {
                console.error('Zaman hesaplama hatası:', error);
                lastUpdateText = 'Bilinmiyor';
            }
        }

        setSelectedLocation({
            ...share,
            distance: distance,
            lastUpdateText: lastUpdateText
        });
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedLocation(null);
    };

    useEffect(() => {
        const shareData = route?.params?.shareData;
        const initialRegion = route?.params?.initialRegion;

        if (shareData && initialRegion) {
            // Haritayı paylaşılan konuma odakla
            mapRef.current?.animateToRegion(initialRegion, 1000);

            // Paylaşım türüne göre marker göster
            if (shareData.type === 'received') {
                setSelectedLocation({
                    ...shareData.location,
                    title: `${shareData.senderName}'in Konumu`,
                    description: shareData.type === 'live' ? 'Canlı Konum' : 'Anlık Konum'
                });
            }
        }
    }, [route?.params]);


    // Arka plan çizim başlatma fonksiyonu
    const startBackgroundDrawing = async (durationMinutes) => {
        try {
            // Arka plan konum izni kontrolü - iyileştirilmiş versiyon
            let { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
                if (newStatus !== 'granted') {
                    Alert.alert(
                        translate('permission_required'),
                        translate('location_permission_drawing'),
                        [{ text: translate('ok') }]
                    );
                    return;
                }
            }

            // Arka plan izni kontrolü
            let { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
            if (bgStatus !== 'granted') {
                const { status: newBgStatus } = await Location.requestBackgroundPermissionsAsync();
                if (newBgStatus !== 'granted') {
                    Alert.alert(
                        translate('background_permission_required'),
                        translate('background_permission_drawing'),
                        [{ text: translate('ok') }]
                    );
                    return;
                }
                // İzin yeni verildiyse, status'u güncelle
                bgStatus = newBgStatus;
            }

            // İzinler tamam, devam et
            if (bgStatus === 'granted') {
                // Benzersiz bir oturum ID'si oluştur
                const sessionId = new Date().toISOString();
                await AsyncStorage.setItem('backgroundDrawingSessionId', sessionId);
                await AsyncStorage.setItem('backgroundSavedPathsCount', '0');

                // Arka plan çizim durumunu kaydet
                await AsyncStorage.setItem('backgroundDrawingEnabled', 'true');
                if (durationMinutes > 0) {
                    const endTime = new Date();
                    endTime.setMinutes(endTime.getMinutes() + durationMinutes);
                    await AsyncStorage.setItem('backgroundDrawingEndTime', endTime.toISOString());
                } else {
                    // Sınırsız süre için
                    await AsyncStorage.removeItem('backgroundDrawingEndTime');
                }

                // Arka plan konum takibini başlat
                const success = await startBackgroundLocationUpdates(userId, true);

                if (!success) {
                    throw new Error('Arka plan konum takibi başlatılamadı');
                }

                setIsBackgroundDrawing(true);
                setShowDurationModal(false);

                Alert.alert(
                    translate('background_drawing_started'),
                    durationMinutes > 0
                        ? translate('background_drawing_duration_minutes', { minutes: durationMinutes })
                        : translate('background_drawing_unlimited'),
                    [{ text: translate('ok') }]
                );
            }
        } catch (error) {
            console.error(translate('background_drawing_start_error'), error);
            Alert.alert(translate('error'), translate('background_drawing_start_error_message') + error.message);
        }
    };

    // Arka plan çizimini durdurma fonksiyonu
    const stopBackgroundDrawing = async () => {
        try {
            await AsyncStorage.setItem('backgroundDrawingEnabled', 'false');
            await stopBackgroundLocationUpdates();

            // Kaydedilen yol sayısını al
            const savedPathsCount = parseInt(await AsyncStorage.getItem('backgroundSavedPathsCount') || '0');

            setIsBackgroundDrawing(false);

            Alert.alert(
                translate('background_drawing_stopped'),
                savedPathsCount > 0
                    ? translate('saved_paths_count', { count: savedPathsCount })
                    : translate('no_saved_paths'),
                [{ text: translate('ok') }]
            );
        } catch (error) {
            console.error(translate('background_drawing_stop_error'), error);
            Alert.alert(translate('error'), translate('background_drawing_stop_error_message'));
        }
    };

    // Uygulama başladığında arka plan çizim durumunu kontrol et
    useEffect(() => {
        const checkBackgroundDrawingStatus = async () => {
            try {
                const isEnabled = await AsyncStorage.getItem('backgroundDrawingEnabled');
                const endTimeStr = await AsyncStorage.getItem('backgroundDrawingEndTime');

                if (isEnabled === 'true') {
                    // Süre kontrolü
                    if (endTimeStr) {
                        const endTime = new Date(endTimeStr);
                        const now = new Date();

                        if (now > endTime) {
                            // Süre dolmuş, çizimi durdur
                            await stopBackgroundDrawing();
                            return;
                        }
                    }

                    setIsBackgroundDrawing(true);
                }
            } catch (error) {
                console.error('Arka plan çizim durumu kontrol edilemedi:', error);
            }
        };

        if (userId) {
            checkBackgroundDrawingStatus();
        }
    }, [userId]);

    const handleStopShare = async (shareId) => {
        try {
            // Paylaşım ve kullanıcı bilgilerini kontrol et
            if (!shareId) {
                Alert.alert(translate('error'), translate('share_id_missing'));
                return;
            }

            if (!userId) {
                Alert.alert(translate('error'), translate('user_id_missing'));
                return;
            }
            
            // İlgili paylaşım bilgilerini bul
            const share = [...receivedInstantLocations, ...receivedLocations].find(s => s.id === shareId);
            if (!share) {
                Alert.alert(translate('error'), translate('share_not_found'));
                return;
            }
            
            // Paylaşımı durdur - Yeni API kullanımı
            await stopLocationSharing(userId, shareId, share.type);
            
            closeModal();
            Alert.alert(translate('success'), translate('share_stopped'));
        } catch (error) {
            console.error(translate('stop_sharing_error'), error);
            Alert.alert(translate('error'), translate('share_stop_error') + error.message);
        }
    };

    const handleShareMyLocation = async () => {
        try {
            // Kullanıcı ve seçili konum bilgilerini kontrol et
            if (!userId) {
                Alert.alert(translate('error'), translate('user_id_missing'));
                return;
            }

            if (!selectedLocation || !selectedLocation.senderId) {
                Alert.alert(translate('error'), translate('user_info_not_found'));
                return;
            }

            // Konum izinlerini kontrol et
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(translate('permission_error'), translate('location_permission_denied'));
                return;
            }

            // Mevcut konumu al
            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest
            }).catch(error => {
                console.error('Konum alma hatası:', error);
                throw new Error('Konum alınamadı');
            });

            if (!currentLocation || !currentLocation.coords) {
                Alert.alert(translate('error'), translate('location_info_not_found'));
                return;
            }

            // Konum bilgilerini al (şehir, ilçe vs.)
            const response = await Location.reverseGeocodeAsync({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude
            }).catch(error => {
                console.error('Ters geocoding hatası:', error);
                return null;
            });

            const locationInfo = response && response.length > 0 ? {
                city: response[0].city || response[0].region || 'Bilinmiyor',
                district: response[0].district || response[0].subregion || 'Bilinmiyor',
                street: response[0].street || '',
                country: response[0].country || 'Bilinmiyor'
            } : {
                city: 'Bilinmiyor',
                district: 'Bilinmiyor',
                street: '',
                country: 'Bilinmiyor'
            };

            // Kullanıcı bilgilerini al
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (!userDoc.exists()) {
                console.error(translate('user_document_not_found'));
                Alert.alert(translate('error'), translate('user_info_not_found'));
                return;
            }

            const userData = userDoc.data();

            // Kullanıcı bilgilerini güvenli bir şekilde hazırla
            const userName = userData?.informations?.name || 'İsimsiz';
            const userUsername = userData?.informations?.username || '';
            const userPhoto = userData?.profilePicture || '';

            // Karşı kullanıcı bilgilerini hazırla - null/undefined değerleri kontrol et
            const friendData = {
                friendName: selectedLocation.senderName || 'İsimsiz',
                friendUsername: selectedLocation.senderUsername || '',  // Undefined ise boş string kullan
                friendPhoto: selectedLocation.senderPhoto || ''  // Undefined ise boş string kullan
            };
            // Aktif paylaşım kontrolü
            const activeShareQuery = query(
                collection(db, `users/${userId}/shares`),
                where('friendId', '==', selectedLocation.senderId),
                where('status', '==', 'active'),
                where('type', '==', 'instant')
            );

            const activeShareSnapshot = await getDocs(activeShareQuery);
            if (!activeShareSnapshot.empty) {
                Alert.alert(
                    translate('info'),
                    translate('active_share_exists'),
                    [
                        {
                            text: translate('cancel'),
                            style: 'cancel'
                        },
                        {
                            text: translate('continue'),
                            onPress: async () => {
                                try {
                                    await createShare();
                                } catch (error) {
                                    console.error(translate('share_creation_error'), error);
                                    Alert.alert(translate('error'), translate('location_share_error') + error.message);
                                }
                            }
                        }
                    ]
                );
                return;
            }

            // Doğrudan paylaşım oluştur
            await createShare();

            // Paylaşım oluşturma fonksiyonu
            async function createShare() {
                // 1. Firestore'da paylaşım kaydı oluştur (shares)
                const shareRef = await addDoc(collection(db, `users/${userId}/shares`), {
                    type: 'instant',
                    friendId: selectedLocation.senderId,
                    status: 'active',
                    startTime: serverTimestamp(),
                    lastUpdate: serverTimestamp(),
                    locationInfo: locationInfo,
                    location: {
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude
                    },
                    friendName: friendData.friendName,
                    friendUsername: friendData.friendUsername,
                    friendPhoto: friendData.friendPhoto
                });

                // 2. Karşı tarafa paylaşımı ekle (receivedShares)
                await addDoc(collection(db, `users/${selectedLocation.senderId}/receivedShares`), {
                    type: 'instant',
                    fromUserId: userId,
                    shareId: shareRef.id,
                    status: 'active',
                    startTime: serverTimestamp(),
                    lastUpdate: serverTimestamp(),
                    locationInfo: locationInfo,
                    location: {
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude
                    },
                    senderName: userName,
                    senderUsername: userUsername,
                    senderPhoto: userPhoto
                });

                closeModal();
                Alert.alert(translate('success'), translate('location_share_started'));
            }
        } catch (error) {
            console.error(translate('location_sharing_error'), error);
            Alert.alert(translate('error'), translate('location_share_error') + error.message);
        }
    };
    // Çizgi stili seçildiğinde çağrılacak fonksiyon
    const handleSelectLineStyle = (style) => {
        setSelectedLineStyle(style);
        setShowLineStyleModal(false);

        // Kullanıcı tercihlerini AsyncStorage'a kaydet
        saveLineStylePreference(style);
    };

    // Çizgi stilini AsyncStorage'a kaydet
    const saveLineStylePreference = async (style) => {
        try {
            await AsyncStorage.setItem('userLineStylePreference', JSON.stringify(style));
        } catch (error) {
            console.error('Çizgi stili kaydedilemedi:', error);
        }
    };

    // Kullanıcı tercihlerini yükle
    const loadLineStylePreference = async () => {
        try {
            const savedStyle = await AsyncStorage.getItem('userLineStylePreference');
            if (savedStyle) {
                setSelectedLineStyle(JSON.parse(savedStyle));
            }
        } catch (error) {
            console.error('Çizgi stili yüklenemedi:', error);
        }
    };

    // Component mount olduğunda tercihleri yükle
    useEffect(() => {
        loadLineStylePreference();
    }, []);

    const [region, setRegion] = useState({
        latitude: location?.coords?.latitude || 37.78825,
        longitude: location?.coords?.longitude || -122.4324,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    });

    // Sayfa yüklendiğinde hemen kullanıcı konumunu almaya çalış
    useEffect(() => {
        const getInitialLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();

                const currentLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced // Daha hızlı konum için
                });

                if (currentLocation && currentLocation.coords) {
                    setLocation(currentLocation);
                    setRegion({
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                    });
                }
            } catch (error) {
                console.error('İlk konum alınamadı:', error);
            }
        };

        getInitialLocation();
    }, []);

    // FriendsPage'den gelen parametreleri işle
    useEffect(() => {
        // Route parametrelerini kontrol et
        const showActiveShares = route?.params?.showActiveShares || false;
        const initialSource = route?.params?.initialSource || null;
        
        if (showActiveShares && initialSource === 'friendsPage') {
          // Aktif paylaşımları göster - gerekirse belirli bir bölgeye odaklan
          if (liveLocations.length > 0 || sharedLocations.length > 0) {
            // Paylaşımlar varsa haritayı onlara odakla
            fitMapToShowAllLocations();
          }
        }
    }, [route?.params, liveLocations, sharedLocations]);
    
    // Haritayı tüm konumları gösterecek şekilde ayarla
    const fitMapToShowAllLocations = () => {
        if (!mapRef.current) return;
        
        const allLocations = [...receivedInstantLocations, ...receivedLocations]
          .filter(share => {
            // Konum bilgilerini kontrol et
            if (share.location) {
              return typeof share.location.latitude === 'number' &&
                typeof share.location.longitude === 'number';
            } else if (share.latitude && share.longitude) {
              // Alternatif konum formatı
              return typeof share.latitude === 'number' &&
                typeof share.longitude === 'number';
            }
            return false;
          })
          .map(share => {
            // Konum koordinatlarını belirle
            return share.location ?
              { 
                latitude: share.location.latitude, 
                longitude: share.location.longitude 
              } : 
              { 
                latitude: share.latitude, 
                longitude: share.longitude 
              };
          });
        
        // Kullanıcının kendi konumunu da ekle
        if (location?.coords) {
          allLocations.push({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          });
        }
        
        // Konum yoksa işlemi sonlandır
        if (allLocations.length === 0) return;
        
        // Tek konum varsa ona odaklan
        if (allLocations.length === 1) {
          mapRef.current.animateToRegion({
            latitude: allLocations[0].latitude,
            longitude: allLocations[0].longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05
          }, 1000);
          return;
        }
        
        // Birden fazla konum varsa hepsini gösterecek şekilde odaklan
        mapRef.current.fitToCoordinates(allLocations, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FDD329" />
                <Text>{translate('finding_location')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                mapType={MapType}
                showsUserLocation={true}
                followsUserLocation={followsUserLocation}
                onPanDrag={handleMapInteraction}
                onPinchEnd={handleMapInteraction}
                onRotateEnd={handleMapInteraction}
                initialRegion={region}
                region={region}
                zoomControlEnabled={false}
                mapToolbarEnabled={false}
                showsMyLocationButton={false}
                zoomEnabled={true}
                rotateEnabled={true}
                scrollEnabled={true}
                pitchEnabled={true}
            >
                {/* Kaydedilmiş yolları göster */}
                {savedPaths.map((path, index) => {
                    // Çizgi rengi ve stilini belirle
                    const isGradient = selectedLineStyle.color.startsWith('gradient');
                    const lineColor = isGradient
                        ? (selectedLineStyle.color === 'gradient-red' ? '#F44336' : '#2196F3')
                        : selectedLineStyle.color;

                    // Çizgi şablonu için dashed pattern
                    const lineDashPattern = selectedLineStyle.pattern === 'dotted'
                        ? [2, 2]
                        : selectedLineStyle.pattern === 'dashed'
                            ? [8, 4]
                            : undefined;

                    return (
                        <Polyline
                            key={`path-${index}`}
                            coordinates={path.points}
                            strokeWidth={selectedLineStyle.width}
                            strokeColor={lineColor}
                            lineDashPattern={lineDashPattern}
                            onPress={() => handlePathPress(path)}
                            tappable={true}
                            zIndex={5}
                        />
                    );
                })}

                {/* Aktif çizim yolunu göster */}
                {pathCoordinates.length > 0 && (
                    <Polyline
                        coordinates={pathCoordinates}
                        strokeWidth={selectedLineStyle.width}
                        strokeColor={selectedLineStyle.color.startsWith('gradient')
                            ? (selectedLineStyle.color === 'gradient-red' ? '#F44336' : '#2196F3')
                            : selectedLineStyle.color}
                        lineDashPattern={selectedLineStyle.pattern === 'dotted'
                            ? [2, 2]
                            : selectedLineStyle.pattern === 'dashed'
                                ? [8, 4]
                                : undefined}
                        zIndex={10}
                    />
                )}

                {/* Tüm konumlar için marker'lar */}
                {[...receivedInstantLocations, ...receivedLocations]
                    .filter(share => {
                        // Konum bilgilerini kontrol et
                        if (share.location) {
                            return typeof share.location.latitude === 'number' &&
                                typeof share.location.longitude === 'number';
                        } else if (share.latitude && share.longitude) {
                            // Alternatif konum formatı
                            return typeof share.latitude === 'number' &&
                                typeof share.longitude === 'number';
                        }
                        return false;
                    })
                    .map((share) => {
                        // Konum koordinatlarını belirle
                        const coordinate = share.location ?
                            { 
                                latitude: share.location.latitude, 
                                longitude: share.location.longitude 
                            } : 
                            { 
                                latitude: share.latitude, 
                                longitude: share.longitude 
                            };
                        
                        // Marker için kullanılacak isim ve fotoğrafı belirle
                        let displayName, displayPhoto;
                        
                        if (share.isSent) {
                            // Gönderilen paylaşım - alıcı bilgilerini göster
                            displayName = share.senderName || 'İsimsiz';
                            displayPhoto = share.senderPhoto;
                        } else {
                            // Alınan paylaşım - gönderici bilgilerini göster
                            displayName = share.senderName || 'İsimsiz';
                            displayPhoto = share.senderPhoto;
                        }

                        // Marker rengi ve stili için paylaşım tipini kontrol et
                        const isLiveLocation = share.type === 'live';
                        
                        // Marker içeriği
                        const markerContent = (
                            <CustomMarker
                                photo={displayPhoto}
                                name={displayName}
                                isLive={isLiveLocation}
                            />
                        );
                        
                        // Canlı konum paylaşımları için animasyonlu marker kullan
                        if (isLiveLocation) {
                            return (
                                <AnimatedMarker
                                    key={`${share.id}-animated`}
                                    coordinate={coordinate}
                                    onPress={() => handleMarkerPress(share)}
                                >
                                    {markerContent}
                                </AnimatedMarker>
                            );
                        } else {
                            // Anlık konum paylaşımları için normal marker kullan
                            return (
                                <Marker
                                    key={`${share.id}-${coordinate.latitude}-${coordinate.longitude}`}
                                    coordinate={coordinate}
                                    onPress={() => handleMarkerPress(share)}
                                >
                                    {markerContent}
                                </Marker>
                            );
                        }
                    })
                }
            </MapView>

            <View style={styles.statusBar}>
                {/* Hız Göstergesi */}
                <View style={styles.statusItem}>
                    <Ionicons name="speedometer-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.speedValue}>{currentSpeed}</Text>
                    <Text style={styles.speedUnit}>{translate('speed_unit')}</Text>
                </View>

                {/* GPS Durumu */}
                <View style={styles.statusItem}>
                    <Ionicons
                        name={gpsQuality === 'OPTIMAL' ? 'location' :
                            gpsQuality === 'GOOD' ? 'location-outline' : 'warning-outline'}
                        size={20}
                        color={gpsQuality === 'OPTIMAL' ? '#4CAF50' :
                            gpsQuality === 'GOOD' ? '#2196F3' : '#FFA000'}
                    />
                    {!isGPSCalibrated ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.statusText}>{translate('calibration')}</Text>
                        </View>
                    ) : (
                        <Text style={styles.statusText}>
                            {gpsQuality === 'OPTIMAL' ? translate('gps_optimal') :
                                gpsQuality === 'GOOD' ? translate('gps_good') :
                                    gpsQuality === 'FAIR' ? translate('gps_fair') : translate('gps_poor')}
                        </Text>
                    )}
                </View>

                {/* Hareket Durumu */}
                <View style={[styles.statusItem, styles.statusItemLast]}>
                    <Ionicons
                        name={isMoving ? "walk" : "pause-circle"}
                        size={20}
                        color="#FFFFFF"
                    />
                    <Text style={styles.statusText}>
                        {isMoving ? translate('moving') : translate('stationary')}
                    </Text>
                </View>
            </View>

            <SafeAreaView style={styles.mapControlsWrapper}>
                <View style={styles.mapControlsContainer}>
                    <View style={styles.mapControlsGroup}>
                        <TouchableOpacity
                            style={[styles.mapControlButton, styles.topButton]}
                            onPress={() => setShowMapTypeMenu(!showMapTypeMenu)}
                        >
                            <Ionicons
                                name={MapType === 'standard' ? "map-outline" :
                                    MapType === 'satellite' ? "earth" :
                                        MapType === 'hybrid' ? "globe-outline" : "layers-outline"}
                                size={22}
                                color="#333"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.mapControlButton, styles.middleButton]}
                            onPress={toggle3DMode}
                        >
                            <Text style={{color: '#333', fontSize: 14, fontWeight: 'bold'}}>
                                {is3DMode ? '3D' : '2D'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.mapControlButton,
                                styles.bottomButton,
                                followsUserLocation && styles.activeButton
                            ]}
                            onPress={handleMyLocation}
                        >
                            <Ionicons
                                name="locate"
                                size={22}
                                color={followsUserLocation ? "#007AFF" : "#333"}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Harita Tipi Menüsü */}
                    {showMapTypeMenu && (
                        <View style={styles.mapTypeMenu}>
                            {mapTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[
                                        styles.mapTypeMenuItem,
                                        MapType === type.id && styles.mapTypeMenuItemActive
                                    ]}
                                    onPress={() => {
                                        setMapType(type.id);
                                        setShowMapTypeMenu(false);
                                    }}
                                >
                                    <Ionicons name={type.icon} size={20} color={MapType === type.id ? "#007AFF" : "#333"} />
                                    <Text style={[
                                        styles.mapTypeMenuText,
                                        MapType === type.id && styles.mapTypeMenuTextActive
                                    ]}>
                                        {type.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </SafeAreaView>

            {/* Konum Detay Modalı */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={closeModal}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            {/* Modal Handle */}
                            <View style={styles.modalHandle} />

                            {/* Kişi Bilgileri */}
                            <View style={styles.userInfoContainer}>
                                <View style={styles.userPhotoContainer}>
                                    {selectedLocation?.senderPhoto ? (
                                        <FastImage
                                            source={{ uri: selectedLocation.senderPhoto }}
                                            style={styles.userPhoto}
                                            resizeMode={FastImage.resizeMode.cover}
                                        />
                                    ) : (
                                        <View style={styles.userPhotoDefault}>
                                            <Text style={styles.userPhotoInitial}>
                                                {selectedLocation?.senderName?.charAt(0) || '?'}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={[
                                        styles.shareTypeIndicator,
                                        selectedLocation?.type === 'instant' ? styles.instantType : styles.liveType
                                    ]} />
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{selectedLocation?.senderName || translate('unnamed_user')}</Text>
                                    <View style={styles.locationInfoContainer}>
                                        <Ionicons name="location" size={16} color="#666666" />
                                        <Text style={styles.locationInfo}>
                                            {selectedLocation?.locationInfo?.city || translate('unknown_city')}, {selectedLocation?.locationInfo?.district || translate('unknown_district')}
                                        </Text>
                                    </View>
                                    <View style={styles.shareTypeContainer}>
                                        <Ionicons
                                            name={selectedLocation?.type === 'instant' ? 'flash' : 'radio'}
                                            size={16}
                                            color={selectedLocation?.type === 'instant' ? '#FF9500' : '#30B0C7'}
                                        />
                                        <Text style={[
                                            styles.shareType,
                                            { color: selectedLocation?.type === 'instant' ? '#FF9500' : '#30B0C7' }
                                        ]}>
                                            {selectedLocation?.type === 'instant' ? translate('instant_location') : translate('live_location')}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Hızlı Aksiyonlar */}
                            <View style={styles.quickActions}>
                                <TouchableOpacity style={styles.quickActionButton}>
                                    <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                                        <Ionicons name="person" size={24} color="#4CAF50" />
                                    </View>
                                    <Text style={styles.actionText}>{translate('profile')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.quickActionButton}>
                                    <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                                        <Ionicons name="navigate" size={24} color="#2196F3" />
                                    </View>
                                    <Text style={styles.actionText}>{translate('directions')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.quickActionButton}>
                                    <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
                                        <Ionicons name="notifications" size={24} color="#FF9800" />
                                    </View>
                                    <Text style={styles.actionText}>{translate('notification')}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Konum Bilgileri */}
                            <View style={styles.locationDetails}>
                                <View style={styles.locationDetailItem}>
                                    <Ionicons name="time-outline" size={20} color="#666666" />
                                    <View style={styles.locationDetailText}>
                                        <Text style={styles.detailLabel}>{translate('last_update')}</Text>
                                        <Text style={styles.detailValue}>{selectedLocation?.lastUpdateText}</Text>
                                    </View>
                                </View>

                                <View style={styles.locationDetailItem}>
                                    <Ionicons name="speedometer-outline" size={20} color="#666666" />
                                    <View style={styles.locationDetailText}>
                                        <Text style={styles.detailLabel}>{translate('distance')}</Text>
                                        <Text style={styles.detailValue}>
                                            {selectedLocation?.distance !== undefined ? (
                                                selectedLocation.distance < 1000
                                                    ? `${Math.round(selectedLocation.distance)} ${translate('distance_meters')}`
                                                    : `${(selectedLocation.distance / 1000).toFixed(1)} ${translate('distance_km')}`
                                            ) : translate('calculating')}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Aksiyon Butonları */}
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
                                    onPress={handleShareMyLocation}
                                >
                                    <Text style={styles.actionButtonText}>{translate('share_my_location')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                                    onPress={() => selectedLocation?.id && handleStopShare(selectedLocation.id)}
                                >
                                    <Text style={styles.actionButtonText}>{translate('stop_sharing')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* Arka Plan Çizim Butonu ve Etiketi - En üstte olması için en son render edelim */}
            <View style={{ position: 'absolute', zIndex: 1000, left: 16, top: Platform.OS === 'ios' ? 120 : 100 }}>
                {isBackgroundDrawing && (
                    <View style={styles.backgroundDrawingLabel}>
                        <Text style={styles.backgroundDrawingLabelText}>{translate('active')}</Text>
                    </View>
                )}
                <TouchableOpacity
                    style={[
                        styles.backgroundDrawingButton,
                        isBackgroundDrawing && styles.backgroundDrawingActiveButton
                    ]}
                    onPress={() => isBackgroundDrawing ? stopBackgroundDrawing() : setShowDurationModal(true)}
                >
                    <Ionicons
                        name={isBackgroundDrawing ? "brush" : "brush-outline"}
                        size={24}
                        color={isBackgroundDrawing ? "#FFFFFF" : "#333333"}
                    />
                </TouchableOpacity>

                {/* Çizgi Tasarım Butonu */}
                <TouchableOpacity
                    style={styles.emojiButton}
                    onPress={() => setShowLineStyleModal(true)}
                >
                    <Ionicons
                        name="color-palette-outline"
                        size={24}
                        color="#333333"
                    />
                </TouchableOpacity>

                {/* Kapsül Butonu */}
                <CapsuleButton onPress={() => setShowCapsuleModal(true)} />
            </View>

            {/* Süre Seçim Modalı - Artık ayrı bir komponent olarak kullanıyoruz */}
            <DurationModal
                visible={showDurationModal}
                onClose={() => setShowDurationModal(false)}
                selectedDuration={selectedDuration}
                setSelectedDuration={setSelectedDuration}
                onStartDrawing={startBackgroundDrawing}
            />

            {/* Çizgi Tasarım Modalı - Artık ayrı bir komponent olarak kullanıyoruz */}
            <LineStyleModal
                visible={showLineStyleModal}
                onClose={() => setShowLineStyleModal(false)}
                selectedLineStyle={selectedLineStyle}
                onSelectLineStyle={handleSelectLineStyle}
            />

            {/* Kapsül Modalı */}
            <CapsuleModal
                visible={showCapsuleModal}
                onClose={() => setShowCapsuleModal(false)}
            />

            {/* Yol Detayları Modalı */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showPathDetails}
                onRequestClose={closePathDetails}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={closePathDetails}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            {/* Modal Handle */}
                            <View style={styles.modalHandle} />

                            {/* Yol Bilgileri */}
                            <View style={styles.pathInfoContainer}>
                                <View style={styles.pathIconContainer}>
                                    <View style={styles.pathIcon}>
                                        <Ionicons name="map" size={32} color="#2196F3" />
                                    </View>
                                </View>
                                <View style={styles.pathInfo}>
                                    <Text style={styles.pathTitle}>
                                        {selectedPath?.city || translate('unknown_location')}
                                    </Text>
                                    <Text style={styles.pathSubtitle}>
                                        {selectedPath?.district || translate('unknown_district')}
                                    </Text>
                                    <View style={styles.pathDetailRow}>
                                        <Ionicons name="calendar-outline" size={16} color="#666666" />
                                        <Text style={styles.pathDetailText}>
                                            {selectedPath?.firstDiscovery ?
                                                new Date(selectedPath.firstDiscovery.seconds * 1000).toLocaleDateString('tr-TR') :
                                                translate('unknown_date')}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Yol Detayları */}
                            <View style={styles.pathDetailsContainer}>
                                <View style={styles.pathDetailItem}>
                                    <Ionicons name="pin-outline" size={20} color="#666666" />
                                    <View style={styles.pathDetailContent}>
                                        <Text style={styles.pathDetailLabel}>{translate('points_count')}</Text>
                                        <Text style={styles.pathDetailValue}>
                                            {selectedPath?.points?.length || 0} {translate('points')}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.pathDetailItem}>
                                    <Ionicons name="trending-up-outline" size={20} color="#666666" />
                                    <View style={styles.pathDetailContent}>
                                        <Text style={styles.pathDetailLabel}>{translate('total_distance')}</Text>
                                        <Text style={styles.pathDetailValue}>
                                            {selectedPath?.points && selectedPath.points.length > 1 ?
                                                (calculatePathDistance(selectedPath.points) / 1000).toFixed(2) + ' ' + translate('distance_km') :
                                                translate('not_calculated')}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.pathDetailItem}>
                                    <Ionicons name="repeat-outline" size={20} color="#666666" />
                                    <View style={styles.pathDetailContent}>
                                        <Text style={styles.pathDetailLabel}>{translate('visit_count')}</Text>
                                        <Text style={styles.pathDetailValue}>
                                            {selectedPath?.visitCount || 1}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Aksiyon Butonları */}
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
                                    onPress={() => {
                                        // Yolu merkeze al
                                        if (selectedPath?.points && selectedPath.points.length > 0 && mapRef.current) {
                                            const midPoint = Math.floor(selectedPath.points.length / 2);
                                            mapRef.current.animateToRegion({
                                                latitude: selectedPath.points[midPoint].latitude,
                                                longitude: selectedPath.points[midPoint].longitude,
                                                latitudeDelta: 0.01,
                                                longitudeDelta: 0.01,
                                            }, 1000);
                                            closePathDetails();
                                        }
                                    }}
                                >
                                    <Text style={styles.actionButtonText}>{translate('show_on_map')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                                    onPress={() => selectedPath?.id && deletePath(selectedPath.id)}
                                >
                                    <Text style={styles.actionButtonText}>{translate('delete_path')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};

const customMarkerStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    bubble: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderColor: '#007AFF',
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
        elevation: 3,
    },
    liveBubble: {
        borderColor: '#30B0C7',  // Canlı konum için farklı renk
    },
    image: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    fallbackImage: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#007AFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveFallbackImage: {
        backgroundColor: '#30B0C7',  // Canlı konum için farklı renk
    },
    fallbackText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    arrow: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderTopColor: '#FFFFFF',
        borderWidth: 8,
        alignSelf: 'center',
        marginTop: -2,
        marginBottom: -15,
    },
    arrowBorder: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderTopColor: '#007AFF',
        borderWidth: 8,
        alignSelf: 'center',
        marginTop: -0.5,
    },
    liveArrow: {
        borderTopColor: '#FFFFFF',
    },
    liveArrowBorder: {
        borderTopColor: '#30B0C7',  // Canlı konum için farklı renk
    },
    liveIndicator: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#30B0C7',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    statusBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255, 255, 255, 0.2)',
    },
    statusItemLast: {
        borderRightWidth: 0,
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 6,
    },
    speedValue: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    speedUnit: {
        color: '#FFFFFF',
        fontSize: 12,
        marginLeft: 4,
        opacity: 0.8,
    },
    infoWindowContainer: {
        position: 'absolute',
        top: '40%',
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 1000,
    },
    mapControlsWrapper: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        paddingTop: Platform.OS === 'ios' ? 50 : 30, // iOS ve Android için güvenli alan
    },
    mapControlsContainer: {
        position: 'absolute',
        right: 16,
        top: Platform.OS === 'ios' ? 110 : 90, // Daha önce 50/30'du, şimdi daha aşağıya çektik
        backgroundColor: 'transparent',
    },
    mapControlsGroup: {
        backgroundColor: 'white',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    mapControlButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    topButton: {
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    middleButton: {
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    bottomButton: {
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapTypeMenu: {
        position: 'absolute',
        top: 50,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        minWidth: 150,
    },
    mapTypeMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 6,
    },
    mapTypeMenuItemActive: {
        backgroundColor: '#F0F0F0',
    },
    mapTypeMenuText: {
        marginLeft: 12,
        fontSize: 16,
        color: '#333',
    },
    mapTypeMenuTextActive: {
        color: '#007AFF',
        fontWeight: '500',
    },
    activeButton: {
        backgroundColor: '#F0F0F0', // Aktif durumda arka plan rengini değiştirelim
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        minHeight: '45%',
        maxHeight: '90%',
    },
    modalContent: {
        padding: 20,
    },
    modalHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    userInfoContainer: {
        flexDirection: 'row',
        marginBottom: 24,
        alignItems: 'center',
    },
    userPhotoContainer: {
        position: 'relative',
        marginRight: 16,
    },
    userPhoto: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    userPhotoDefault: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userPhotoInitial: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#666666',
    },
    shareTypeIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: 'white',
    },
    instantType: {
        backgroundColor: '#FF9500',
    },
    liveType: {
        backgroundColor: '#30B0C7',
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 2,
    },
    userUsername: {
        fontSize: 14,
        color: '#666666',
        marginBottom: 6,
    },
    locationInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    locationInfo: {
        fontSize: 14,
        color: '#666666',
        marginLeft: 4,
    },
    shareTypeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shareType: {
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 4,
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F0F0F0',
        marginBottom: 20,
    },
    quickActionButton: {
        alignItems: 'center',
    },
    actionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionText: {
        fontSize: 13,
        color: '#1A1A1A',
        fontWeight: '500',
    },
    locationDetails: {
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    locationDetailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationDetailText: {
        marginLeft: 12,
    },
    detailLabel: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        color: '#1A1A1A',
        fontWeight: '500',
    },
    actionButtons: {
        gap: 12,
    },
    actionButton: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    markerContainer: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    markerImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    markerDefault: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    markerInitial: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#757575',
    },
    markerTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderTopWidth: 15,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'white',
        alignSelf: 'center',
        marginTop: -2, // Üçgeni marker'a biraz daha yaklaştırır
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    backgroundDrawingButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        marginBottom: 8,
    },
    backgroundDrawingActiveButton: {
        backgroundColor: '#4CAF50',
    },
    backgroundDrawingLabel: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 80, // Butonun üstünde
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        width: 56,
        alignItems: 'center',
        zIndex: 1000,
    },
    backgroundDrawingLabelText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    emojiButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        marginBottom: 8,
    },
    pathInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    pathIconContainer: {
        marginRight: 16,
    },
    pathIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2196F3',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pathInfo: {
        flex: 1,
    },
    pathTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    pathSubtitle: {
        fontSize: 14,
        color: '#666666',
        marginBottom: 8,
    },
    pathDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pathDetailText: {
        fontSize: 12,
        color: '#666666',
        marginLeft: 4,
    },
    pathDetailsContainer: {
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    pathDetailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    pathDetailContent: {
        marginLeft: 12,
    },
    pathDetailLabel: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 2,
    },
    pathDetailValue: {
        fontSize: 14,
        color: '#1A1A1A',
        fontWeight: '500',
    },
    leftActionButtonsContainer: { // Yeni kapsayıcı stili
        position: 'absolute',
        top: Platform.OS === 'ios' ? 120 : 100,
        left: 16,
        zIndex: 1000,
        alignItems: 'center', // İçindeki butonları ortalamak için
    },
    actionButtonWrapper: { // Her buton ve etiketi için sarmalayıcı
        marginBottom: 14, // Butonlar arası boşluk
        alignItems: 'center', // Etiketin butonla hizalanması için
    },
    mapActionButton: { // Eski backgroundDrawingButton ve emojiButton'un genel hali
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    backgroundDrawingActiveButton: { // Aktif çizim butonu için özel stil
        backgroundColor: '#4CAF50',
    },
    backgroundDrawingLabel: {
        position: 'absolute',
        top: -20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        zIndex: 1001,
    },
    backgroundDrawingLabelText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default MapPage;