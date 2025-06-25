import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { translate } from '../../i18n/i18n';
import FastImage from 'react-native-fast-image';

const GOOGLE_PLACES_API_KEY = 'AIzaSyA_03hHCb_1yHt-TbGPFSRgGSmDoIhIMSk';

const getPhotoUrl = (photoReference) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
};

const getPriceLevel = (level) => {
    return '₺'.repeat(level || 1);
};

// Filtre butonları için bileşen
const FilterButton = memo(({ title, active, onPress, icon }) => (
    <TouchableOpacity
        style={[
            styles.filterButton,
            active && styles.filterButtonActive
        ]}
        onPress={onPress}
    >
        <MaterialIcons
            name={icon}
            size={18}
            color={active ? '#FFFFFF' : '#4CAF50'}
            style={styles.filterIcon}
        />
        <Text
            style={[
                styles.filterButtonText,
                active && styles.filterButtonTextActive
            ]}
        >
            {title}
        </Text>
    </TouchableOpacity>
));

const HotelCard = memo(({ item, onPress }) => (
    <TouchableOpacity
        style={styles.hotelCard}
        onPress={() => onPress(item)}
    >
        {item.photoReference ? (
            <FastImage
                source={{ uri: getPhotoUrl(item.photoReference) }}
                style={styles.hotelImage}
                resizeMode={FastImage.resizeMode.cover}
            />
        ) : (
            <View style={styles.placeholderImage}>
                <MaterialIcons name="hotel" size={40} color="#4CAF50" />
            </View>
        )}

        <View style={styles.hotelContent}>
            <View style={styles.headerRow}>
                <Text style={styles.hotelName} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={styles.priceLevel}>
                    {getPriceLevel(item.priceLevel)}
                </Text>
            </View>

            <Text style={styles.hotelAddress} numberOfLines={2}>
                {item.address}
            </Text>

            <View style={styles.footerRow}>
                {item.rating && (
                    <View style={styles.ratingContainer}>
                        <MaterialIcons name="star" size={16} color="#FFD700" />
                        <Text style={styles.rating}>
                            {item.rating}
                        </Text>
                        <Text style={styles.totalRatings}>
                            ({item.totalRatings || 0})
                        </Text>
                    </View>
                )}
                <View style={styles.distanceContainer}>
                    <MaterialIcons name="location-on" size={16} color="#7F8C8D" />
                    <Text style={styles.distance}>{item.distance} km</Text>
                </View>
            </View>

            {/* Web sitesi butonu */}
            <TouchableOpacity
                style={styles.websiteButton}
                onPress={() => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(item.name)}`)}
            >
                <MaterialIcons name="search" size={16} color="#FFF" />
                <Text style={styles.websiteButtonText}>{translate('hotel_search_web')}</Text>
            </TouchableOpacity>
        </View>
    </TouchableOpacity>
));

const NearbyHotels = () => {
    const navigation = useNavigation();
    const [hotels, setHotels] = useState([]);
    const [filteredHotels, setFilteredHotels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'nearest', 'price_low', 'price_high'
    const [apiError, setApiError] = useState(null); // API hata durumunu takip etmek için

    useEffect(() => {
        getLocationAndHotels();
    }, []);

    // Aktif filtreye göre otelleri filtrele
    useEffect(() => {
        if (hotels.length === 0) return;

        let filtered = [...hotels];

        if (activeFilter === 'nearest') {
            // Mesafeye göre sırala (en yakından en uzağa)
            filtered.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        } else if (activeFilter === 'price_low') {
            // Fiyata göre sırala (en düşükten en yükseğe)
            filtered.sort((a, b) => (a.priceLevel || 1) - (b.priceLevel || 1));
        } else if (activeFilter === 'price_high') {
            // Fiyata göre sırala (en yüksekten en düşüğe)
            filtered.sort((a, b) => (b.priceLevel || 1) - (a.priceLevel || 1));
        }

        setFilteredHotels(filtered);
    }, [activeFilter, hotels]);

    const getLocationAndHotels = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                Alert.alert(
                    translate('hotels_permission_title'),
                    translate('hotels_permission_message'),
                    [{ text: translate('hotels_ok') }]
                );
                setLoading(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=5000&type=lodging&language=tr&key=${GOOGLE_PLACES_API_KEY}`;

            
            const response = await fetch(apiUrl);
            
            const data = await response.json();

            if (data.status === 'OK' && data.results && data.results.length > 0) {
                const formattedHotels = data.results.map(place => {
                    return {
                        id: place.place_id,
                        name: place.name,
                        address: place.vicinity,
                        rating: place.rating,
                        totalRatings: place.user_ratings_total,
                        photoReference: place.photos?.[0]?.photo_reference,
                        priceLevel: place.price_level, // Fiyat seviyesi (1-4 arası)
                        latitude: place.geometry.location.lat,
                        longitude: place.geometry.location.lng,
                        distance: calculateDistance(
                            latitude,
                            longitude,
                            place.geometry.location.lat,
                            place.geometry.location.lng
                        )
                    };
                });

                setHotels(formattedHotels);
                setFilteredHotels(formattedHotels);
            } else {
                setApiError({
                    status: data.status,
                    message: data.error_message || 'API yanıtı boş veya hatalı'
                });
                // Gerçek veri alınamadı, boş liste ile devam et
                setHotels([]);
                setFilteredHotels([]);
            }

            setLoading(false);
        } catch (error) {
            console.error('❌ Oteller yüklenirken hata oluştu:', error);
            console.error('❌ Hata detayları:', error.message);
            console.error('❌ Hata stack:', error.stack);
            setApiError({
                status: 'ERROR',
                message: error.message
            });
            // Hata durumunda boş liste göster
            setHotels([]);
            setFilteredHotels([]);
            setLoading(false);
        }
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance.toFixed(1);
    };

    const deg2rad = (deg) => {
        return deg * (Math.PI / 180);
    };

    const openMaps = (item) => {
        const scheme = Platform.select({
            ios: 'maps:0,0?q=',
            android: 'geo:0,0?q='
        });
        const latLng = `${item.latitude},${item.longitude}`;
        const label = item.name;
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });

        Linking.openURL(url);
    };

    const renderHotel = useCallback(({ item }) => (
        <HotelCard
            item={item}
            onPress={openMaps}
        />
    ), []);

    const getItemLayout = useCallback((data, index) => ({
        length: 320, // kart yüksekliği + margin
        offset: 320 * index,
        index,
    }), []);

    // Filtre butonlarını render etme fonksiyonu
    const renderFilterButtons = () => (
        <View style={styles.filterContainer}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
            >
                <FilterButton
                    title={translate('filter_all')}
                    icon="format-list-bulleted"
                    active={activeFilter === 'all'}
                    onPress={() => setActiveFilter('all')}
                />
                <FilterButton
                    title={translate('filter_nearest')}
                    icon="near-me"
                    active={activeFilter === 'nearest'}
                    onPress={() => setActiveFilter('nearest')}
                />
                <FilterButton
                    title={translate('hotel_price_low')}
                    icon="arrow-downward"
                    active={activeFilter === 'price_low'}
                    onPress={() => setActiveFilter('price_low')}
                />
                <FilterButton
                    title={translate('hotel_price_high')}
                    icon="arrow-upward"
                    active={activeFilter === 'price_high'}
                    onPress={() => setActiveFilter('price_high')}
                />
            </ScrollView>
        </View>
    );

    // Hata durumunu gösteren bileşen
    const renderErrorState = () => {
        if (!apiError) return null;
        
        return (
            <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={40} color="#FF5252" />
                <Text style={styles.errorTitle}>{translate('hotels_error_title')}</Text>
                <Text style={styles.errorMessage}>
                    {translate('hotels_error_message')}
                </Text>
                <Text style={styles.errorDetail}>
                    {`${apiError.status}: ${apiError.message}`}
                </Text>
                <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => {
                        setLoading(true);
                        setApiError(null);
                        getLocationAndHotels();
                    }}
                >
                    <MaterialIcons name="refresh" size={18} color="#FFF" />
                    <Text style={styles.retryButtonText}>{translate('hotels_retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialIcons name="arrow-back" size={24} color="#2C3E50" />
                    <Text style={styles.headerTitle}>{translate('hotels_title')}</Text>
                </TouchableOpacity>
            </View>

            {/* Filtreler */}
            {!loading && hotels.length > 0 && renderFilterButtons()}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={styles.loadingText}>{translate('hotels_loading')}</Text>
                </View>
            ) : hotels.length > 0 ? (
                <View style={styles.flashListContainer}>
                    <FlashList
                        data={filteredHotels}
                        renderItem={renderHotel}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        estimatedItemSize={320}
                        initialNumToRender={5}
                    />
                </View>
            ) : (
                // Hata durumunu veya boş durumu göster
                apiError ? renderErrorState() : (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="hotel" size={60} color="#BDBDBD" />
                        <Text style={styles.emptyTitle}>{translate('hotels_not_found')}</Text>
                        <Text style={styles.emptyText}>{translate('hotels_try_again')}</Text>
                        <TouchableOpacity 
                            style={styles.retryButton}
                            onPress={() => {
                                setLoading(true);
                                getLocationAndHotels();
                            }}
                        >
                            <MaterialIcons name="refresh" size={18} color="#FFF" />
                            <Text style={styles.retryButtonText}>{translate('hotels_retry')}</Text>
                        </TouchableOpacity>
                    </View>
                )
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#757575',
        marginTop: 10,
    },
    emptyText: {
        fontSize: 14,
        color: '#9E9E9E',
        textAlign: 'center',
        marginTop: 5,
        marginBottom: 20,
    },
    header: {
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 15,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginLeft: 8,
    },
    filterContainer: {
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    filterScrollContent: {
        paddingHorizontal: 16,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#F1F8E9',
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    filterButtonActive: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50',
    },
    filterButtonText: {
        color: '#4CAF50',
        fontWeight: '600',
        fontSize: 14,
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
    },
    filterIcon: {
        marginRight: 4,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    hotelCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
    },
    hotelImage: {
        width: '100%',
        height: 180,
        backgroundColor: '#f5f5f5',
    },
    placeholderImage: {
        width: '100%',
        height: 180,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    hotelContent: {
        padding: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    hotelName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2C3E50',
        flex: 1,
        marginRight: 8,
    },
    priceLevel: {
        fontSize: 16,
        color: '#4CAF50',
        fontWeight: '600',
    },
    hotelAddress: {
        fontSize: 14,
        color: '#7F8C8D',
        marginBottom: 12,
        lineHeight: 20,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    rating: {
        marginLeft: 4,
        fontSize: 14,
        color: '#2C3E50',
        fontWeight: '600',
    },
    totalRatings: {
        fontSize: 14,
        color: '#7F8C8D',
        marginLeft: 4,
    },
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    distance: {
        marginLeft: 4,
        fontSize: 14,
        color: '#7F8C8D',
    },
    websiteButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 4,
        paddingVertical: 6,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
    },
    websiteButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF5252',
        marginTop: 10,
    },
    errorMessage: {
        fontSize: 14,
        color: '#757575',
        textAlign: 'center',
        marginTop: 5,
        marginBottom: 10,
    },
    errorDetail: {
        fontSize: 12,
        color: '#9E9E9E',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        flexDirection: 'row',
        backgroundColor: '#4CAF50',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        marginLeft: 5,
    },
    loadingText: {
        fontSize: 14,
        color: '#7F8C8D',
        marginTop: 10,
    },
    flashListContainer: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
});

export default NearbyHotels; 