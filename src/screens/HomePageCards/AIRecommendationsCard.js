import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, Animated, Easing } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { translate } from '../../i18n/i18n';
import styles from '../../styles/HomePageStyles';

const AIRecommendationsCard = ({ navigation }) => {
    const [currentMessage, setCurrentMessage] = useState(0);
    const pulseAnim = new Animated.Value(1);
    const rotateAnim = new Animated.Value(0);

    const messages = [
        translate('ai_help_message'),
        translate('ai_discover_places'),
        translate('ai_today_suggestion'),
        translate('ai_create_routes'),
        translate('ai_special_recommendations')
    ];

    useEffect(() => {
        const messageTimer = setInterval(() => {
            setCurrentMessage((prev) => (prev + 1) % messages.length);
        }, 3000);

        // Pulse ve rotasyon animasyonları
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 1000,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 10000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.timing(rotateAnim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        ).start();

        return () => clearInterval(messageTimer);
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <TouchableOpacity
            style={styles.aiRecommendCard}
            onPress={() => navigation.navigate('AIChat')}
            activeOpacity={0.9}
        >
            <LinearGradient
                colors={['#7B4DFF', '#6236FF', '#4A1FFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.aiCardGradient}
            >
                <View style={styles.aiCardContent}>
                    <View style={styles.aiCardLeft}>
                        <Animated.View 
                            style={[
                                styles.aiIconContainer,
                                { 
                                    transform: [
                                        { scale: pulseAnim },
                                    ] 
                                }
                            ]}
                        >
                            <View style={styles.aiIconInner}>
                                <Animated.View style={[styles.aiIconRing, { transform: [{ rotate: spin }] }]}>
                                    <MaterialIcons name="blur-on" size={32} color="rgba(255,255,255,0.8)" />
                                </Animated.View>
                                <View style={styles.aiIconCenter}>
                                    <Ionicons name="flash" size={20} color="#FFF" />
                                </View>
                            </View>
                        </Animated.View>
                        <View style={styles.aiCardTextContainer}>
                            <Text style={styles.aiCardTitle}>{translate('ai_assistant_name')}</Text>
                            <View style={styles.messageContainer}>
                                <Text
                                    style={styles.aiCardSubtitle}
                                    numberOfLines={2}
                                >
                                    {messages[currentMessage]}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.aiCardIcon}>
                        <MaterialIcons name="arrow-forward" size={24} color="#FFF" />
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

export default React.memo(AIRecommendationsCard); 