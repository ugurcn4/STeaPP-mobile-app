import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAIRecommendations } from '../services/aiService';
import * as Location from 'expo-location';
import { getWeatherInfo } from '../services/weatherService';

const AIRecommendationsScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [recommendations, setRecommendations] = useState([]);
    const [, setError] = useState(null);

    useEffect(() => {
        loadRecommendations();
    }, []);

    const loadRecommendations = async () => {
        try {
            setLoading(true);

            // Konum izni al
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Konum izni gerekli');
                setLoading(false);
                return;
            }

            // Mevcut konumu al
            const location = await Location.getCurrentPositionAsync({});

            // Hava durumu bilgisini al
            const weather = await getWeatherInfo({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });

            // AI önerilerini al
            const aiRecommendations = await getAIRecommendations(
                location.coords.latitude,
                location.coords.longitude,
                {
                    weather: weather.condition,
                    temperature: weather.temperature,
                    description: weather.description
                }
            );

            setRecommendations(aiRecommendations);
        } catch (error) {
            console.error('Öneri yükleme hatası:', error);
            setError('Öneriler yüklenirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const renderRecommendationCard = (item) => (
        <TouchableOpacity
            key={item.id}
            style={styles.recommendationCard}
            onPress={() => {
                // Rota detaylarına git
            }}
        >
            <Image
                source={{ uri: item.image }}
                style={styles.cardImage}
            />
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.cardGradient}
            >
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardDescription}>{item.description}</Text>
                    <View style={styles.cardDetails}>
                        <View style={styles.detailItem}>
                            <MaterialIcons name="timer" size={16} color="#fff" />
                            <Text style={styles.detailText}>{item.duration}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <MaterialIcons name="directions-walk" size={16} color="#fff" />
                            <Text style={styles.detailText}>{item.distance}</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialIcons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Önerileri</Text>
                <View style={styles.headerRight} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#25D220" />
                    <Text style={styles.loadingText}>Öneriler hazırlanıyor...</Text>
                </View>
            ) : (
                <ScrollView style={styles.content}>
                    {recommendations.map(renderRecommendationCard)}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
    },
    headerRight: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    recommendationCard: {
        height: 200,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundColor: '#fff',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    cardGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '70%',
        justifyContent: 'flex-end',
        padding: 16,
    },
    cardContent: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 8,
    },
    cardDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    detailText: {
        color: '#fff',
        marginLeft: 4,
        fontSize: 12,
    },
});

export default AIRecommendationsScreen; 