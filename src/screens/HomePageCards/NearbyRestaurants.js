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

const RestaurantCard = memo(({ item, onPress }) => (
    <TouchableOpacity
        style={styles.restaurantCard}
        onPress={() => onPress(item)}
    >
        {item.photoReference ? (
            <FastImage
                source={{ uri: getPhotoUrl(item.photoReference) }}
                style={styles.restaurantImage}
                resizeMode={FastImage.resizeMode.cover}
            />
        ) : (
            <View style={styles.placeholderImage}>
                <MaterialIcons name="restaurant" size={40} color="#4CAF50" />
            </View>
        )}

        <View style={styles.restaurantContent}>
            <View style={styles.headerRow}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                    {item.name}
                </Text>
                <View style={styles.distanceContainer}>
                    <MaterialIcons name="directions-walk" size={16} color="#7F8C8D" />
                    <Text style={styles.distance}>{item.distance} km</Text>
                </View>
            </View>

            <Text style={styles.restaurantAddress} numberOfLines={2}>
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
                {item.isOpen !== undefined && (
                    <View style={[
                        styles.statusContainer,
                        { backgroundColor: item.isOpen ? '#E8F5E9' : '#FFEBEE' }
                    ]}>
                        <Text style={[
                            styles.statusText,
                            { color: item.isOpen ? '#4CAF50' : '#FF5252' }
                        ]}>
                            {item.isOpen ? translate('restaurant_open') : translate('restaurant_closed')}
                        </Text>
                    </View>
                )}
            </View>

            {/* Web sitesi butonu */}
            <TouchableOpacity
                style={styles.websiteButton}
                onPress={() => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(item.name)}`)}
            >
                <MaterialIcons name="search" size={16} color="#FFF" />
                <Text style={styles.websiteButtonText}>{translate('restaurant_search_web')}</Text>
            </TouchableOpacity>
        </View>
    </TouchableOpacity>
));

const NearbyRestaurants = () => {
    const navigation = useNavigation();
    const [restaurants, setRestaurants] = useState([]);
    const [filteredRestaurants, setFilteredRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'nearest', 'rating', 'open'

    useEffect(() => {
        getLocationAndRestaurants();
    }, []);

    // Aktif filtreye göre restoranları filtrele
    useEffect(() => {
        if (restaurants.length === 0) return;

        let filtered = [...restaurants];

        if (activeFilter === 'nearest') {
            // Mesafeye göre sırala (en yakından en uzağa)
            filtered.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        } else if (activeFilter === 'rating') {
            // Puana göre sırala (en yüksekten en düşüğe)
            filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (activeFilter === 'open') {
            // Sadece açık olan restoranları filtrele
            filtered = filtered.filter(restaurant => restaurant.isOpen);
        }

        setFilteredRestaurants(filtered);
    }, [activeFilter, restaurants]);

    const getLocationAndRestaurants = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                Alert.alert(
                    translate('restaurants_permission_title'),
                    translate('restaurants_permission_message'),
                    [{ text: translate('restaurants_ok') }]
                );
                setLoading(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=1500&type=restaurant&language=tr&key=${GOOGLE_PLACES_API_KEY}`;
            
            const response = await fetch(apiUrl);

            const data = await response.json();

            if (data.status === 'OK' && data.results && data.results.length > 0) {
                const formattedRestaurants = data.results.map(place => {
                    return {
                        id: place.place_id,
                        name: place.name,
                        address: place.vicinity,
                        rating: place.rating,
                        totalRatings: place.user_ratings_total,
                        isOpen: place.opening_hours?.open_now,
                        photoReference: place.photos?.[0]?.photo_reference,
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

                setRestaurants(formattedRestaurants);
                setFilteredRestaurants(formattedRestaurants);
            } else {
                // Gerçek veri alınamadı, boş liste ile devam et
                setRestaurants([]);
                setFilteredRestaurants([]);
            }

            setLoading(false);
        } catch (error) {
            console.error('❌ Restoranlar yüklenirken hata oluştu:', error);
            console.error('❌ Hata detayları:', error.message);
            console.error('❌ Hata stack:', error.stack);
            // Hata durumunda boş liste göster
            setRestaurants([]);
            setFilteredRestaurants([]);
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

    const renderRestaurant = useCallback(({ item }) => (
        <RestaurantCard
            item={item}
            onPress={openMaps}
        />
    ), []);

    const getItemLayout = useCallback((data, index) => ({
        length: 300, // kart yüksekliği + margin
        offset: 300 * index,
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
                    title={translate('restaurant_filter_rating')}
                    icon="star"
                    active={activeFilter === 'rating'}
                    onPress={() => setActiveFilter('rating')}
                />
                <FilterButton
                    title={translate('restaurant_filter_open')}
                    icon="lock-open"
                    active={activeFilter === 'open'}
                    onPress={() => setActiveFilter('open')}
                />
            </ScrollView>
        </View>
    );

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
                    <Text style={styles.headerTitle}>{translate('restaurants_title')}</Text>
                </TouchableOpacity>
            </View>

            {renderFilterButtons()}

            {filteredRestaurants.length > 0 ? (
                <View style={styles.flashListContainer}>
                    <FlashList
                        data={filteredRestaurants}
                        renderItem={renderRestaurant}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        estimatedItemSize={300}
                        removeClippedSubviews={true}
                        initialNumToRender={8}
                    />
                </View>
            ) : (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="sentiment-dissatisfied" size={64} color="#BDBDBD" />
                    <Text style={styles.emptyText}>{translate('restaurants_empty')}</Text>
                    <Text style={styles.emptySubText}>{translate('restaurants_empty_subtitle')}</Text>
                </View>
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
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#7F8C8D',
        textAlign: 'center',
        marginTop: 8,
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
    listContainer: {
        padding: 16,
        paddingBottom: 100,
    },
    restaurantCard: {
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
    restaurantImage: {
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
    restaurantContent: {
        padding: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    restaurantName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2C3E50',
        flex: 1,
        marginRight: 8,
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
        fontSize: 14,
        color: '#7F8C8D',
        marginLeft: 4,
    },
    restaurantAddress: {
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
    statusContainer: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
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
    flashListContainer: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
});

export default NearbyRestaurants;
