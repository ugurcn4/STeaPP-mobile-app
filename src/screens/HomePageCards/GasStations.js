import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Platform, ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { translate } from '../../i18n/i18n';
import FastImage from 'react-native-fast-image';

const GOOGLE_PLACES_API_KEY = 'AIzaSyA_03hHCb_1yHt-TbGPFSRgGSmDoIhIMSk';

const getPhotoUrl = (photoReference) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
};

// Benzin tipleri için renkler
const getFuelTypeColor = (fuelType) => {
    switch (fuelType) {
        case translate('fuel_type_gasoline'):
            return '#FF9800';
        case translate('fuel_type_diesel'):
            return '#4CAF50';
        case translate('fuel_type_lpg'):
            return '#2196F3';
        case translate('fuel_type_electric'):
            return '#9C27B0';
        default:
            return '#757575';
    }
};

const GasStationCard = memo(({ item, onPress }) => (
    <TouchableOpacity
        style={styles.stationCard}
        onPress={() => onPress(item)}
    >
        {item.photoReference ? (
            <FastImage
                source={{ uri: getPhotoUrl(item.photoReference) }}
                style={styles.stationImage}
                resizeMode={FastImage.resizeMode.cover}
            />
        ) : (
            <View style={styles.placeholderImage}>
                <MaterialIcons name="local-gas-station" size={40} color="#FF9800" />
            </View>
        )}

        <View style={styles.stationContent}>
            <View style={styles.headerRow}>
                <Text style={styles.stationName} numberOfLines={1}>
                    {item.name}
                </Text>
                <View style={styles.distanceContainer}>
                    <MaterialIcons name="directions-walk" size={16} color="#7F8C8D" />
                    <Text style={styles.distance}>{item.distance} km</Text>
                </View>
            </View>

            <Text style={styles.stationAddress} numberOfLines={2}>
                {item.address}
            </Text>

            {/* Yakıt Tipleri */}
            <View style={styles.fuelTypesContainer}>
                {item.fuelTypes && item.fuelTypes.map((fuelType, index) => (
                    <View
                        key={index}
                        style={[
                            styles.fuelTypeTag,
                            { backgroundColor: getFuelTypeColor(fuelType) + '20' }
                        ]}
                    >
                        <Text
                            style={[
                                styles.fuelTypeText,
                                { color: getFuelTypeColor(fuelType) }
                            ]}
                        >
                            {fuelType}
                        </Text>
                    </View>
                ))}
            </View>

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
                            {item.isOpen ? translate('gas_stations_24hour') : translate('gas_stations_closed')}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    </TouchableOpacity>
));

const GasStations = () => {
    const navigation = useNavigation();
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState(null);
    const [filterType, setFilterType] = useState('all'); // 'all', 'nearest', 'rating'

    useEffect(() => {
        getLocationAndGasStations();
    }, []);

    const getLocationAndGasStations = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                Alert.alert(
                    translate('gas_stations_permission_title'),
                    translate('gas_stations_permission_message'),
                    [{ text: translate('gas_stations_ok') }]
                );
                setLoading(false);
                return;
            }
            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=5000&type=gas_station&language=tr&key=${GOOGLE_PLACES_API_KEY}`;
            
            const response = await fetch(apiUrl)
            
            const data = await response.json();

            if (data.status === 'OK' && data.results && data.results.length > 0) {
                const formattedStations = data.results.map(place => {
                    
                    // Yakıt tipleri için gerçek veri yok, bu yüzden yaygın yakıt tiplerini atayalım
                    const fuelTypes = [];
                    const allFuelTypes = [
                        translate('fuel_type_gasoline'),
                        translate('fuel_type_diesel'),
                        translate('fuel_type_lpg'),
                        translate('fuel_type_electric')
                    ];

                    // Her istasyon için rastgele yakıt tipleri (gerçek API'den bu bilgi gelmiyor)
                    // İstasyon adına göre yakıt tiplerini belirleyelim
                    if (place.name.toLowerCase().includes('shell')) {
                        fuelTypes.push(translate('fuel_type_gasoline'), translate('fuel_type_diesel'));
                    } else if (place.name.toLowerCase().includes('bp')) {
                        fuelTypes.push(translate('fuel_type_gasoline'), translate('fuel_type_diesel'), translate('fuel_type_lpg'));
                    } else if (place.name.toLowerCase().includes('total')) {
                        fuelTypes.push(translate('fuel_type_gasoline'), translate('fuel_type_diesel'));
                    } else if (place.name.toLowerCase().includes('opet')) {
                        fuelTypes.push(translate('fuel_type_gasoline'), translate('fuel_type_diesel'), translate('fuel_type_lpg'));
                    } else {
                        // Diğer istasyonlar için rastgele yakıt tipleri
                        const fuelCount = Math.floor(Math.random() * 3) + 1; // 1-3 arası yakıt tipi
                        for (let i = 0; i < fuelCount; i++) {
                            const randomFuel = allFuelTypes[Math.floor(Math.random() * allFuelTypes.length)];
                            if (!fuelTypes.includes(randomFuel)) {
                                fuelTypes.push(randomFuel);
                            }
                        }
                    }

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
                        fuelTypes: fuelTypes,
                        distance: calculateDistance(
                            latitude,
                            longitude,
                            place.geometry.location.lat,
                            place.geometry.location.lng
                        )
                    };
                });
                setStations(formattedStations);
            } else {
                setApiError({
                    status: data.status,
                    message: data.error_message || 'API yanıtı boş veya hatalı'
                });
                setStations([]);
            }

            setLoading(false);
        } catch (error) {
            console.error('❌ Benzin istasyonları yüklenirken hata oluştu:', error);
            console.error('❌ Hata detayları:', error.message);
            console.error('❌ Hata stack:', error.stack);
            setApiError({
                status: 'ERROR',
                message: error.message
            });
            setStations([]);
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

    const renderStation = useCallback(({ item }) => (
        <GasStationCard
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
                    active={filterType === 'all'}
                    onPress={() => setFilterType('all')}
                />
                <FilterButton
                    title={translate('filter_nearest')}
                    icon="near-me"
                    active={filterType === 'nearest'}
                    onPress={() => {
                        setFilterType('nearest');
                        setStations([...stations].sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)));
                    }}
                />
                <FilterButton
                    title={translate('filter_rating')}
                    icon="star"
                    active={filterType === 'rating'}
                    onPress={() => {
                        setFilterType('rating');
                        setStations([...stations].sort((a, b) => (b.rating || 0) - (a.rating || 0)));
                    }}
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
                <Text style={styles.errorTitle}>{translate('gas_stations_error_title')}</Text>
                <Text style={styles.errorMessage}>
                    {translate('gas_stations_error_message')}
                </Text>
                <Text style={styles.errorDetail}>
                    {`${apiError.status}: ${apiError.message}`}
                </Text>
                <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => {
                        setLoading(true);
                        setApiError(null);
                        getLocationAndGasStations();
                    }}
                >
                    <MaterialIcons name="refresh" size={18} color="#FFF" />
                    <Text style={styles.retryButtonText}>{translate('gas_stations_retry')}</Text>
                </TouchableOpacity>
            </View>
        );
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
                color={active ? '#FFFFFF' : '#FF9800'}
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

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF9800" />
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
                    <Text style={styles.headerTitle}>{translate('gas_stations_title')}</Text>
                </TouchableOpacity>
            </View>

            {/* Filtreler */}
            {!loading && stations.length > 0 && renderFilterButtons()}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF9800" />
                    <Text style={styles.loadingText}>{translate('gas_stations_loading')}</Text>
                </View>
            ) : stations.length > 0 ? (
                <FlatList
                    data={stations}
                    renderItem={renderStation}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                    getItemLayout={getItemLayout}
                    initialNumToRender={5}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                />
            ) : (
                // Hata durumunu veya boş durumu göster
                apiError ? renderErrorState() : (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="local-gas-station" size={60} color="#BDBDBD" />
                        <Text style={styles.emptyTitle}>{translate('gas_stations_not_found')}</Text>
                        <Text style={styles.emptyText}>{translate('gas_stations_try_again')}</Text>
                        <TouchableOpacity 
                            style={styles.retryButton}
                            onPress={() => {
                                setLoading(true);
                                getLocationAndGasStations();
                            }}
                        >
                            <MaterialIcons name="refresh" size={18} color="#FFF" />
                            <Text style={styles.retryButtonText}>{translate('gas_stations_retry')}</Text>
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
        backgroundColor: '#FFF3E0',
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#FF9800',
    },
    filterButtonActive: {
        backgroundColor: '#FF9800',
        borderColor: '#FF9800',
    },
    filterButtonText: {
        color: '#FF9800',
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
    stationCard: {
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
    stationImage: {
        width: '100%',
        height: 180,
        backgroundColor: '#f5f5f5',
    },
    placeholderImage: {
        width: '100%',
        height: 180,
        backgroundColor: '#FFF3E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stationContent: {
        padding: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    stationName: {
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
        marginLeft: 4,
        fontSize: 14,
        color: '#7F8C8D',
    },
    stationAddress: {
        fontSize: 14,
        color: '#7F8C8D',
        marginBottom: 12,
        lineHeight: 20,
    },
    fuelTypesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    fuelTypeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 6,
        marginBottom: 4,
    },
    fuelTypeText: {
        fontSize: 12,
        fontWeight: '600',
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
        backgroundColor: '#FF9800',
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
});

export default GasStations; 