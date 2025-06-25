import React, { useState, useEffect } from 'react';
import {
    View,
    TextInput,
    FlatList,
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { getPlaceFromCoordinates } from '../helpers/locationHelpers';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash/debounce';
import * as Location from 'expo-location';

const LocationPicker = ({ onSelect, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const debouncedSearch = debounce(async (query) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsLoading(true);
        try {
            let results = [];
            // Google Cloud Console'dan alınan API anahtarı
            const GOOGLE_PLACES_API_KEY = 'AIzaSyCRuie7ba6LQGd4R-RP2-7GRINossjXCr8';

            // Önce konum izni kontrolü yap
            const { status } = await Location.requestForegroundPermissionsAsync();

            // Mevcut konumu al (eğer izin verildiyse)
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({});
                const placeInfo = await getPlaceFromCoordinates(
                    location.coords.latitude,
                    location.coords.longitude
                );

                // Konum bilgisi boş ise varsayılan değer kullan
                const locationName = placeInfo && (placeInfo.district || placeInfo.city)
                    ? `${placeInfo.district || ''}, ${placeInfo.city || ''}`.trim()
                    : 'Konumunuz';

                results.push({
                    id: 'current-location',
                    name: locationName,
                    address: placeInfo ? `${placeInfo.district || ''}, ${placeInfo.city || ''}`.trim() : 'Mevcut konum',
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
            }

            // Google Places Text Search API ile arama yap
            const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}&language=tr&region=tr`;

            const response = await fetch(textSearchUrl);
            const data = await response.json();

            if (data.status === 'OK' && data.results && data.results.length > 0) {
                const placeResults = data.results.slice(0, 15).map((place, index) => {
                    return {
                        id: `search-${index}`,
                        name: place.name,
                        address: place.formatted_address,
                        latitude: place.geometry.location.lat,
                        longitude: place.geometry.location.lng,
                        rating: place.rating,
                        userRatingsTotal: place.user_ratings_total,
                        placeId: place.place_id,
                        types: place.types
                    };
                });

                results = [...results, ...placeResults];
            } else {
                // API yanıtı başarısız olduğunda alternatif arama yöntemi kullan
                try {
                    // Geocoding API ile arama yap
                    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}&language=tr&region=tr`;
                    const geocodingResponse = await fetch(geocodingUrl);
                    const geocodingData = await geocodingResponse.json();

                    if (geocodingData.status === 'OK' && geocodingData.results && geocodingData.results.length > 0) {
                        const geocodingResults = geocodingData.results.slice(0, 15).map((place, index) => {
                            return {
                                id: `geocoding-${index}`,
                                name: place.formatted_address.split(',')[0],
                                address: place.formatted_address,
                                latitude: place.geometry.location.lat,
                                longitude: place.geometry.location.lng,
                                types: place.types
                            };
                        });

                        results = [...results, ...geocodingResults];
                    }
                } catch (geocodingError) {
                    console.error('Geocoding API hatası:', geocodingError);
                }
            }

            setSearchResults(results);
        } catch (error) {
            console.error('Konum arama hatası:', error);
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    }, 300);

    useEffect(() => {
        return () => {
            debouncedSearch.cancel();
        };
    }, []);

    const handleSearch = (query) => {
        setSearchQuery(query);
        debouncedSearch(query);
    };

    const handleSelect = async (place) => {
        try {
            setIsLoading(true);
            const details = {
                latitude: place.latitude,
                longitude: place.longitude,
                address: place.address,
                name: place.name
            };
            onSelect(details);
        } catch (error) {
            console.error('Konum detayları alınamadı:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderLocationItem = ({ item }) => {
        // Değerleri önceden hazırla
        const ratingText = item.rating ? `${item.rating}` : '';
        const ratingsCountText = item.userRatingsTotal ? ` (${item.userRatingsTotal})` : '';

        return (
            <TouchableOpacity
                style={styles.locationItem}
                onPress={() => handleSelect(item)}
            >
                <View style={styles.locationIcon}>
                    <Ionicons
                        name={getIconForPlaceType(item.types)}
                        size={24}
                        color="#2196F3"
                    />
                </View>
                <View style={styles.locationInfo}>
                    <Text style={styles.locationName} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <View style={styles.locationDetails}>
                        <Text style={styles.locationAddress} numberOfLines={1}>
                            {item.address}
                        </Text>
                        {item.distance && (
                            <Text style={styles.locationDistance}>
                                {`• ${item.distance}`}
                            </Text>
                        )}
                    </View>
                    {item.rating && (
                        <View style={styles.ratingContainer}>
                            <Ionicons name="star" size={14} color="#FFC107" />
                            <Text style={styles.ratingText}>
                                {ratingText}{ratingsCountText}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.title}>Konum Seç</Text>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Konum ara..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoFocus
                />
            </View>

            {isLoading ? (
                <ActivityIndicator style={styles.loader} color="#25D220" />
            ) : (
                <>
                    {searchQuery.length >= 2 && searchResults.length === 0 ? (
                        <View style={styles.noResultsContainer}>
                            <Ionicons name="search-outline" size={48} color="#ccc" />
                            <Text style={styles.noResultsText}>Sonuç bulunamadı</Text>
                            <Text style={styles.noResultsSubText}>Farklı bir arama terimi deneyin</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={searchResults}
                            renderItem={renderLocationItem}
                            keyExtractor={(item) => item.id}
                            style={styles.list}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    )}
                </>
            )}
        </View>
    );
};

// Mesafe hesaplama yardımcı fonksiyonu
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Metre cinsinden mesafe
};

const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
};

const formatDistance = (meters) => {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
};

// Yer türüne göre ikon seçimi
const getIconForPlaceType = (types = []) => {
    if (types.includes('restaurant')) return 'restaurant';
    if (types.includes('cafe')) return 'cafe';
    if (types.includes('store')) return 'storefront';
    if (types.includes('park')) return 'leaf';
    if (types.includes('school')) return 'school';
    return 'location';
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    closeButton: {
        padding: 8,
    },
    title: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        paddingHorizontal: 16,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: '#333',
    },
    loader: {
        marginTop: 20,
    },
    list: {
        flex: 1,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        marginHorizontal: 8,
        marginVertical: 4,
        borderRadius: 8,
    },
    locationIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationInfo: {
        flex: 1,
        marginLeft: 12,
    },
    locationName: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    locationDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    locationAddress: {
        color: '#666',
        fontSize: 14,
        flex: 1,
    },
    separator: {
        height: 1,
        backgroundColor: '#444',
        marginLeft: 68,
    },
    locationDistance: {
        color: '#666',
        fontSize: 12,
        marginLeft: 8,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingText: {
        color: '#999',
        fontSize: 12,
        marginLeft: 4,
    },
    noResultsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    noResultsText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
        marginTop: 16,
    },
    noResultsSubText: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
    },
});

export default LocationPicker; 