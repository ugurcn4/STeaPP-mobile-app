import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet, Dimensions,
    TouchableOpacity,
    Animated,
    Easing
} from 'react-native';
import FastImage from 'react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Onboarding'in tamamlandığını kontrol etmek için kullanacağımız anahtar
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

const slides = [
    {
        id: '2',
        image: require('../../../assets/images/onboarding/2.png')
    },
    {
        id: '3',
        image: require('../../../assets/images/onboarding/3.png')
    },
    {
        id: '4',
        image: require('../../../assets/images/onboarding/4.png')
    },
    {
        id: '5',
        image: require('../../../assets/images/onboarding/5.png')
    },
    {
        id: '6',
        image: require('../../../assets/images/onboarding/6.png')
    },
    {
        id: '7',
        image: require('../../../assets/images/onboarding/7.png')
    },
    {
        id: '8',
        image: require('../../../assets/images/onboarding/8.png')
    },
    {
        id: '9',
        image: require('../../../assets/images/onboarding/9.png')
    },
    {
        id: '10',
        image: require('../../../assets/images/onboarding/10.png')
    }
];

const OnboardingScreen = ({ navigation, route }) => {
    // Settings'den gelip gelmediğini kontrol edelim
    const isFromSettings = route.params?.fromSettings;

    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(isFromSettings ? 1 : 0)).current;
    const translateY = useRef(new Animated.Value(isFromSettings ? 0 : 50)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Eğer ayarlardan geliyorsa, animasyonu atlayalım ya da çok daha hızlı yapalım
        if (isFromSettings) {
            // Animasyon zaten başlangıç değerlerinde olacak
        } else {
            // Normal başlangıç animasyonu
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 800, // Daha hızlı animasyon
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 800, // Daha hızlı animasyon
                    useNativeDriver: true,
                }),
            ]).start();
        }

        // Next butonu için sürekli animasyon
        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.1,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // Görselleri önceden yükle
    useEffect(() => {
        // İlk görsel için scroll'u sıfırla
        if (flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false });
            setCurrentIndex(0);
        }
    }, []);

    const renderItem = ({ item, index }) => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.9, 1, 0.9],
        });

        const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.6, 1, 0.6],
        });

        return (
            <View style={styles.slide}>
                {/* Arka plan görseli */}
                <FastImage
                    source={item.image}
                    style={styles.fullScreenImage}
                    resizeMode={FastImage.resizeMode.cover}
                />
            </View>
        );
    };

    // İlerleme çubuğu için sabit stillendirilmiş noktaları gösterelim (animasyonsuz)
    const renderDots = () => {
        return (
            <View style={styles.dotsWrapper}>
                {slides.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            index === currentIndex ? styles.activeDot : styles.inactiveDot
                        ]}
                    />
                ))}
            </View>
        );
    };

    // Onboarding tamamlandığını kaydetme fonksiyonu
    const markOnboardingAsCompleted = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
        } catch (error) {
            console.error('Onboarding durumu kaydedilirken hata oluştu:', error);
        }
    };

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current.scrollToIndex({
                index: currentIndex + 1,
                animated: true
            });
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 50,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]).start(async () => {
                // Onboarding'i tamamlandı olarak işaretle
                await markOnboardingAsCompleted();

                // Settings'den geldiyse geri dönelim, değilse login'e gidelim
                if (isFromSettings) {
                    navigation.goBack();
                } else {
                    navigation.replace('Giriş Yap');
                }
            });
        }
    };

    const handleSkip = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 50,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(async () => {
            // Onboarding'i tamamlandı olarak işaretle
            await markOnboardingAsCompleted();

            // Settings'den geldiyse geri dönelim, değilse login'e gidelim
            if (isFromSettings) {
                navigation.goBack();
            } else {
                navigation.replace('Giriş Yap');
            }
        });
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY }]
                }
            ]}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={handleSkip}
                    style={styles.skipButton}
                >
                    <Text style={styles.skipText}>Atla</Text>
                </TouchableOpacity>
            </View>

            <Animated.FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={0} // İlk sayfadan başla
                initialNumToRender={2} // İlk 2 sayfayı hemen renderla
                maxToRenderPerBatch={3} // Daha fazla öğeyi aynı anda renderla
                windowSize={5} // Daha büyük bir pencere boyutu
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                }}
                keyExtractor={(item) => item.id}
            />

            <View style={styles.footer}>
                {renderDots()}
                <Animated.View
                    style={[
                        styles.nextButton,
                        { transform: [{ scale: scaleAnim }] }
                    ]}
                >
                    <TouchableOpacity onPress={handleNext}>
                        <Text style={styles.nextButtonText}>
                            {currentIndex === slides.length - 1 ? 'Başla' : 'İleri'}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // Sadece atla butonu olduğu için sağa yaslı
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 20,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    skipButton: {
        padding: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 20,
        paddingHorizontal: 20,
    },
    skipText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    slide: {
        width,
        height,
        position: 'relative',
    },
    fullScreenImage: {
        width,
        height,
        position: 'absolute',
        top: 0,
        left: 0,
    },
    overlay: {
        display: 'none', // Gölge katmanını gizliyoruz
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingBottom: 50,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    dotsWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        height: 8,
        width: 8,
        borderRadius: 4,
        marginHorizontal: 3,
    },
    activeDot: {
        backgroundColor: '#FFF',
        width: 24, // Aktif nokta daha uzun
    },
    inactiveDot: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    nextButton: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '600',
    }
});

export default OnboardingScreen; 