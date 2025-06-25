import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import FastImage from 'react-native-fast-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { translate } from '../../i18n/i18n';

// Bölge isimlerini düzgün formata çeviren fonksiyon
const formatRegionName = (region) => {
    if (!region) return translate('waiting_to_be_explored');

    const regionKey = `region_${region}`;
    return translate(regionKey);
};

const CityExplorerCard = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [cities, setCities] = useState([]);
    const [imageLoadingStates, setImageLoadingStates] = useState({});
    const lastLoadedIndex = useRef(0);
    const allCitiesRef = useRef([]);
    const loadingMoreRef = useRef(false);
    const scrollViewRef = useRef(null);

    // İlleri sırayla yükle
    const loadMoreCities = useCallback(async () => {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;

        try {
            const startIndex = lastLoadedIndex.current;
            const endIndex = Math.min(startIndex + 5, allCitiesRef.current.length);

            if (startIndex >= allCitiesRef.current.length) {
                loadingMoreRef.current = false;
                return;
            }

            const newCities = allCitiesRef.current.slice(startIndex, endIndex);
            lastLoadedIndex.current = endIndex;

            setCities(prevCities => [...prevCities, ...newCities]);
        } finally {
            loadingMoreRef.current = false;
        }
    }, []);

    // Periyodik olarak yeni şehirleri yükle
    useEffect(() => {
        let interval;
        if (allCitiesRef.current.length > 0) {
            interval = setInterval(() => {
                loadMoreCities();
            }, 2000); // Her 2 saniyede bir 5 şehir ekle
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [loadMoreCities]);

    // Kullanıcı oturumunu dinle
    useEffect(() => {
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => {
            unsubscribeAuth();
        };
    }, []);

    // Şehirleri Firebase'den çek
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const db = getFirestore();
                const citiesRef = collection(db, 'cities');
                const snapshot = await getDocs(citiesRef);

                // Tüm şehirleri referansta sakla ve alfabetik olarak sırala
                allCitiesRef.current = snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        image: doc.data().imageUrl
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name, 'tr')); // Türkçe alfabetik sıralama

                // İlk 10 şehri hemen yükle
                const initialCities = allCitiesRef.current.slice(0, 10);
                lastLoadedIndex.current = 10;
                setCities(initialCities);
                setLoading(false);
            } catch (error) {
                console.error(translate('cities_loading_error'), error);
                setLoading(false);
            }
        };

        fetchCities();
    }, []);

    // Kullanıcı kaydırma işlemlerini yönet
    const handleScrollEnd = (event) => {
        // Kullanıcı sona yaklaştıysa daha fazla şehir yükle
        const contentWidth = event.nativeEvent.contentSize.width;
        const layoutWidth = event.nativeEvent.layoutMeasurement.width;
        const position = event.nativeEvent.contentOffset.x;

        if (position + layoutWidth > contentWidth - 200) {
            loadMoreCities();
        }
    };

    const handleCardPress = () => {
        if (!user) {
            navigation.navigate('Auth');
            return;
        }
        navigation.navigate('CityExplorer');
    };

    // Resim yükleme durumunu izle
    const handleImageLoad = (cityId) => {
        setImageLoadingStates(prev => ({
            ...prev,
            [cityId]: false
        }));
    };

    const handleImageLoadStart = (cityId) => {
        setImageLoadingStates(prev => ({
            ...prev,
            [cityId]: true
        }));
    };

    // Loading durumunda farklı bir görünüm
    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['#3494E6', '#EC6EAD']}
                    style={[styles.card, styles.loadingCard]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.loadingContent}>
                        <MaterialIcons name="location-city" size={24} color="#FFF" />
                        <Text style={styles.loadingText}>{translate('loading')}</Text>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#3494E6', '#EC6EAD']}
                style={[styles.card, styles.emptyStateCard]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.emptyStateContent}>
                    <MaterialIcons name="explore" size={40} color="#FFF" style={styles.emptyStateIcon} />
                    <Text style={styles.emptyStateTitle}>
                        {translate('ready_for_adventure')}
                    </Text>
                    <Text style={styles.emptyStateDescription}>
                        {translate('start_explore_collect')}
                    </Text>

                    {/* Şehirler Kaydırması */}
                    <View style={styles.suggestedCities}>
                        <ScrollView
                            ref={scrollViewRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={handleScrollEnd}
                            contentContainerStyle={styles.scrollViewContent}
                        >
                            {cities.map((city, index) => (
                                <View
                                    key={`${city.id}-${index}`}
                                    style={styles.suggestedCityCard}
                                >
                                    <View style={styles.cityImageContainer}>
                                        {imageLoadingStates[city.id] && (
                                            <View style={styles.imagePlaceholder}>
                                                <ActivityIndicator size="small" color="#FFF" />
                                                <Text style={styles.loadingImageText}>{translate('loading')}</Text>
                                            </View>
                                        )}
                                        <FastImage
                                            source={{ uri: city.image }}
                                            style={styles.cityImage}
                                            onLoadStart={() => handleImageLoadStart(city.id)}
                                            onLoad={() => handleImageLoad(city.id)}
                                            resizeMode={FastImage.resizeMode.cover}
                                        />
                                    </View>
                                    <Text style={styles.cityTitle}>{city.name}</Text>
                                    <Text style={styles.cityDescription}>
                                        {formatRegionName(city.region)}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Gamification Elementleri */}
                    <View style={styles.rewardsPreview}>
                        <Text style={styles.rewardsTitle}>{translate('what_awaits_you')}</Text>
                        <View style={styles.rewardsList}>
                            <View style={styles.rewardItem}>
                                <MaterialIcons name="emoji-events" size={24} color="#FFD700" />
                                <Text style={styles.rewardText}>{translate('special_badges')}</Text>
                            </View>
                            <View style={styles.rewardItem}>
                                <MaterialIcons name="local-activity" size={24} color="#FFD700" />
                                <Text style={styles.rewardText}>{translate('city_points')}</Text>
                            </View>
                            <View style={styles.rewardItem}>
                                <MaterialIcons name="leaderboard" size={24} color="#FFD700" />
                                <Text style={styles.rewardText}>{translate('ranking')}</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.startButton}
                        onPress={handleCardPress}
                    >
                        <Text style={styles.startButtonText}>
                            {user ? translate('start_exploring') : translate('login')}
                        </Text>
                        <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        borderRadius: 25,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    card: {
        padding: 16,
        borderRadius: 20,
    },
    loadingCard: {
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 150,
    },
    loadingContent: {
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFF',
        marginTop: 10,
        fontSize: 16,
        fontWeight: '500',
    },
    emptyStateCard: {
        padding: 16,
        paddingBottom: 24,
    },
    emptyStateContent: {
        alignItems: 'center',
        width: '100%',
        gap: 12,
    },
    emptyStateIcon: {
        marginBottom: 12,
    },
    emptyStateTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyStateDescription: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    suggestedCities: {
        width: '100%',
        height: 160,
        marginVertical: 16,
        overflow: 'hidden',
    },
    scrollViewContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    citySet: {
        flexDirection: 'row',
    },
    suggestedCityCard: {
        width: 140,
        height: 160,
        marginLeft: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    cityImageContainer: {
        width: '100%',
        height: 90,
        position: 'relative',
    },
    imagePlaceholder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(100,100,100,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    loadingImageText: {
        color: '#FFF',
        fontSize: 12,
        marginTop: 5,
    },
    cityImage: {
        width: '100%',
        height: 90,
        resizeMode: 'cover',
    },
    cityTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        padding: 8,
        paddingBottom: 4,
    },
    cityDescription: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        padding: 8,
        paddingTop: 0,
    },
    rewardsPreview: {
        width: '100%',
        marginVertical: 16,
    },
    rewardsTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    rewardsList: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    rewardItem: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 12,
        width: '30%',
    },
    rewardText: {
        color: '#FFF',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        marginTop: 8,
    },
    startButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
});

export default CityExplorerCard; 