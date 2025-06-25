import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { translate } from '../../i18n/i18n';

// Hava durumu ikonlarını tanımlayalım
const weatherIcons = {
    '01d': 'sunny',
    '01n': 'moon',
    '02d': 'partly-sunny',
    '02n': 'cloudy-night',
    '03d': 'cloud',
    '03n': 'cloud',
    '04d': 'cloudy',
    '04n': 'cloudy',
    '09d': 'rainy',
    '09n': 'rainy',
    '10d': 'rainy',
    '10n': 'rainy',
    '11d': 'thunderstorm',
    '11n': 'thunderstorm',
    '13d': 'snow',
    '13n': 'snow',
    '50d': 'cloudy',
    '50n': 'cloudy'
};

// Hava durumu arka plan renklerini tanımlayalım
const weatherGradients = {
    '01d': ['#4DA0B0', '#D39D38'],
    '01n': ['#283E51', '#4B79A1'],
    '02d': ['#2C3E50', '#3498DB'],
    '02n': ['#2C3E50', '#1A1A1A'],
    '03d': ['#373B44', '#4286f4'],
    '03n': ['#373B44', '#4286f4'],
    '04d': ['#757F9A', '#D7DDE8'],
    '04n': ['#757F9A', '#D7DDE8'],
    '09d': ['#000046', '#1CB5E0'],
    '09n': ['#000046', '#1CB5E0'],
    '10d': ['#000046', '#1CB5E0'],
    '10n': ['#000046', '#1CB5E0'],
    '11d': ['#16222A', '#3A6073'],
    '11n': ['#16222A', '#3A6073'],
    '13d': ['#E6DADA', '#274046'],
    '13n': ['#E6DADA', '#274046'],
    '50d': ['#606c88', '#3f4c6b'],
    '50n': ['#606c88', '#3f4c6b']
};

const WeatherCard = ({ weather }) => {
    if (!weather) return null;

    const getWeatherIcon = (iconCode) => {
        return weatherIcons[iconCode] || 'cloudy';
    };

    const getWeatherGradient = (iconCode) => {
        return weatherGradients[iconCode] || ['#4c669f', '#3b5998'];
    };

    return (
        <TouchableOpacity style={styles.weatherCard}>
            <LinearGradient
                colors={getWeatherGradient(weather.icon)}
                style={styles.weatherGradient}
            >
                <View style={styles.weatherContent}>
                    <View style={styles.weatherMainInfo}>
                        <View style={styles.weatherLocationContainer}>
                            <Ionicons name="location" size={20} color="#fff" style={styles.locationIcon} />
                            <Text style={styles.weatherLocation}>
                                {weather.city}, {weather.district}
                            </Text>
                        </View>
                        <Text style={styles.weatherTemp}>
                            {weather.temperature.toFixed(1)}°
                        </Text>
                        <Text style={styles.weatherDescription}>
                            {weather.description}
                        </Text>
                    </View>

                    <View style={styles.weatherIconContainer}>
                        <Ionicons
                            name={getWeatherIcon(weather.icon)}
                            size={80}
                            color="#fff"
                            style={styles.weatherMainIcon}
                        />
                    </View>
                </View>

                <View style={styles.weatherDetailsContainer}>
                    <View style={styles.weatherDetailItem}>
                        <Ionicons name="water" size={20} color="#fff" />
                        <Text style={styles.weatherDetailText}>
                            {translate('humidity')}: {weather.humidity}%
                        </Text>
                    </View>

                    <View style={styles.weatherDetailItem}>
                        <Ionicons name="speedometer" size={20} color="#fff" />
                        <Text style={styles.weatherDetailText}>
                            {translate('wind')}: {weather.windSpeed} m/s
                        </Text>
                    </View>

                    {weather.rainProbability > 0 && (
                        <View style={styles.weatherDetailItem}>
                            <Ionicons name="rainy" size={20} color="#fff" />
                            <Text style={styles.weatherDetailText}>
                                {translate('rain')}: {weather.rainProbability}%
                            </Text>
                        </View>
                    )}
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    weatherCard: {
        borderRadius: 25,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    weatherGradient: {
        padding: 20,
    },
    weatherContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    weatherMainInfo: {
        flex: 1,
    },
    weatherLocationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationIcon: {
        marginRight: 5,
    },
    weatherLocation: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    weatherTemp: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
        marginVertical: 5,
    },
    weatherDescription: {
        color: '#fff',
        fontSize: 16,
        textTransform: 'capitalize',
        opacity: 0.9,
    },
    weatherIconContainer: {
        padding: 10,
    },
    weatherMainIcon: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    weatherDetailsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
    },
    weatherDetailItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    weatherDetailText: {
        color: '#fff',
        marginLeft: 8,
        fontSize: 14,
        opacity: 0.9,
    },
});

export default WeatherCard; 