import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform,
    Linking
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { translate } from '../../i18n/i18n';
import FastImage from 'react-native-fast-image';

const GOOGLE_PLACES_API_KEY = 'AIzaSyA_03hHCb_1yHt-TbGPFSRgGSmDoIhIMSk';

const categories = [
    { id: 'all', name: translate('attraction_all'), icon: 'place' },
    { id: 'museum', name: translate('attraction_museums'), icon: 'museum' },
    { id: 'park', name: translate('attraction_parks'), icon: 'park' },
    { id: 'tourist_attraction', name: translate('attraction_tourist'), icon: 'attractions' },
    { id: 'historic', name: translate('attraction_historic'), icon: 'account-balance' },
    { id: 'natural', name: translate('attraction_natural'), icon: 'landscape' }
];

const getPhotoUrl = (photoReference) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
};

const CategoryButton = memo(({ item, isSelected, onPress }) => (
    <TouchableOpacity
        style={[
            styles.categoryButton,
            isSelected && styles.categoryButtonActive
        ]}
        onPress={() => onPress(item.id)}
    >
        <MaterialIcons
            name={item.icon}
            size={24}
            color={isSelected ? '#fff' : '#4CAF50'}
        />
        <Text style={[
            styles.categoryText,
            isSelected && styles.categoryTextActive
        ]}>
            {item.name}
        </Text>
    </TouchableOpacity>
));

const AttractionCard = memo(({ item, onPress }) => (
    <TouchableOpacity
        style={styles.attractionCard}
        onPress={() => onPress(item)}
    >
        {item.photoReference ? (
            <FastImage
                source={{ uri: getPhotoUrl(item.photoReference) }}
                style={styles.attractionImage}
                resizeMode={FastImage.resizeMode.cover}
            />
        ) : (
            <View style={styles.placeholderImage}>
                <MaterialIcons name="photo" size={40} color="#4CAF50" />
            </View>
        )}

        <View style={styles.attractionContent}>
            <Text style={styles.attractionName} numberOfLines={1}>
                {item.name}
            </Text>

            <Text style={styles.attractionAddress} numberOfLines={2}>
                {item.address}
            </Text>

            <View style={styles.attractionFooter}>
                {item.rating && (
                    <View style={styles.ratingContainer}>
                        <MaterialIcons name="star" size={16} color="#FFD700" />
                        <Text style={styles.rating}>
                            {item.rating} ({item.totalRatings || 0})
                        </Text>
                    </View>
                )}
                <View style={styles.distanceContainer}>
                    <MaterialIcons name="directions-walk" size={16} color="#7F8C8D" />
                    <Text style={styles.distance}>{item.distance} km</Text>
                </View>
            </View>

            {/* Web sitesi butonu */}
            <TouchableOpacity
                style={styles.websiteButton}
                onPress={() => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(item.name)}`)}
            >
                <MaterialIcons name="search" size={16} color="#FFF" />
                <Text style={styles.websiteButtonText}>{translate('attraction_search_web')}</Text>
            </TouchableOpacity>
        </View>
    </TouchableOpacity>
));

const NearbyAttractions = () => {
    const navigation = useNavigation();
    const [attractions, setAttractions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [userLocation, setUserLocation] = useState(null);

    useEffect(() => {
        getLocationAndAttractions();
    }, [selectedCategory]);

    const getLocationAndAttractions = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                Alert.alert(
                    translate('attractions_permission_title'),
                    translate('attractions_permission_message'),
                    [{ text: translate('attractions_ok') }]
                );
                setLoading(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            setUserLocation(location.coords);
            const { latitude, longitude } = location.coords;

            let placeType = selectedCategory === 'all' ? 'tourist_attraction' : selectedCategory;

            const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=5000&type=${placeType}&language=tr&key=${GOOGLE_PLACES_API_KEY}`;
            
            const response = await fetch(apiUrl);
            
            const data = await response.json();

            if (data.status === 'OK' && data.results && data.results.length > 0) {
                const formattedAttractions = data.results.map(place => {
                    return {
                        id: place.place_id,
                        name: place.name,
                        address: place.vicinity,
                        rating: place.rating,
                        totalRatings: place.user_ratings_total,
                        photoReference: place.photos?.[0]?.photo_reference,
                        latitude: place.geometry.location.lat,
                        longitude: place.geometry.location.lng,
                        distance: calculateDistance(
                            latitude,
                            longitude,
                            place.geometry.location.lat,
                            place.geometry.location.lng
                        ),
                        types: place.types
                    };
                });

                setAttractions(formattedAttractions);
            } else {
                setAttractions([]);
            }
            
            setLoading(false);
        } catch (error) {
            console.error('❌ Aktiviteler yüklenirken hata oluştu:', error);
            console.error('❌ Hata detayları:', error.message);
            console.error('❌ Hata stack:', error.stack);
            // Hata durumunda boş liste göster
            setAttractions([]);
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

    const renderCategoryItem = useCallback(({ item }) => (
        <CategoryButton
            item={item}
            isSelected={selectedCategory === item.id}
            onPress={setSelectedCategory}
        />
    ), [selectedCategory]);

    const renderAttractionItem = useCallback(({ item }) => (
        <AttractionCard
            item={item}
            onPress={openMaps}
        />
    ), []);

    const getItemLayout = useCallback((data, index) => ({
        length: 320,
        offset: 320 * index,
        index,
    }), []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialIcons name="arrow-back" size={24} color="#2C3E50" />
                    <Text style={styles.headerTitle}>{translate('attractions_title')}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.categoriesContainer}>
                <FlatList
                    data={categories}
                    renderItem={renderCategoryItem}
                    keyExtractor={item => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesList}
                />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                </View>
            ) : attractions.length > 0 ? (
                <FlatList
                    data={attractions}
                    renderItem={renderAttractionItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    getItemLayout={getItemLayout}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    initialNumToRender={8}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="sentiment-dissatisfied" size={64} color="#BDBDBD" />
                    <Text style={styles.emptyText}>{translate('attractions_empty')}</Text>
                    <Text style={styles.emptySubText}>{translate('attractions_empty_subtitle')}</Text>
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
    categoriesContainer: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    categoriesList: {
        paddingHorizontal: 16,
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F8E9',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    categoryButtonActive: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50',
    },
    categoryText: {
        marginLeft: 8,
        color: '#4CAF50',
        fontWeight: '600',
    },
    categoryTextActive: {
        color: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    listContainer: {
        padding: 16,
        paddingBottom: 100,
    },
    attractionCard: {
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
    attractionImage: {
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
    attractionContent: {
        padding: 16,
    },
    attractionName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginBottom: 8,
    },
    attractionAddress: {
        fontSize: 14,
        color: '#7F8C8D',
        marginBottom: 12,
        lineHeight: 20,
    },
    attractionFooter: {
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
    }
});

export default NearbyAttractions; 