import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Platform,
    Alert,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, interpolate, useAnimatedStyle, withSpring, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

const UpdatesPage = ({ navigation }) => {
    const [isChecking, setIsChecking] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [lastChecked, setLastChecked] = useState(null);
    const [currentVersion, setCurrentVersion] = useState('1.0.0');
    const [updateInfo, setUpdateInfo] = useState(null);

    const pulseAnim = useSharedValue(1);
    const rotateAnim = useSharedValue(0);

    useEffect(() => {
        navigation.setOptions({
            headerBackTitle: ' ',
            headerShown: false,
        });
        checkForUpdates();

        // Başlangıç animasyonları
        pulseAnim.value = withRepeat(
            withTiming(1.1, {
                duration: 2000,
                easing: Easing.inOut(Easing.ease),
            }),
            -1,
            true
        );

        rotateAnim.value = withRepeat(
            withTiming(360, {
                duration: 10000,
                easing: Easing.linear,
            }),
            -1,
            false
        );

        if (global.updateDownloaded) {
            setUpdateAvailable(true);
        }
    }, [navigation]);

    const iconAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: pulseAnim.value },
                { rotate: `${rotateAnim.value}deg` },
            ],
        };
    });

    const checkForUpdates = async () => {
        try {
            setIsChecking(true);
            // Eğer daha önce indirilmiş bir güncelleme varsa
            if (global.updateDownloaded) {
                setUpdateAvailable(true);
                setLastChecked(new Date());
                setUpdateInfo({ isAvailable: true });
                setIsChecking(false);
                return;
            }

            const update = await Updates.checkForUpdateAsync();
            setUpdateAvailable(update.isAvailable);
            setLastChecked(new Date());
            setUpdateInfo(update);
        } catch (error) {
            Alert.alert('Hata', 'Güncellemeler kontrol edilirken bir hata oluştu.');
            console.error('Güncelleme kontrolü hatası:', error);
        } finally {
            setIsChecking(false);
        }
    };

    const installUpdate = async () => {
        try {
            setIsChecking(true);

            // Eğer başlangıçta indirilmiş güncelleme varsa direkt reload yap
            if (global.updateDownloaded) {
                await Updates.reloadAsync();
                return;
            }

            Alert.alert(
                'Güncelleme',
                'Güncelleme indirilip yüklenecek. Uygulama yeniden başlatılacak.',
                [
                    { text: 'İptal', style: 'cancel' },
                    {
                        text: 'Güncelle',
                        onPress: async () => {
                            try {
                                await Updates.fetchUpdateAsync();
                                global.updateDownloaded = true;
                                await Updates.reloadAsync();
                            } catch (error) {
                                Alert.alert('Hata', 'Güncelleme yüklenirken bir hata oluştu.');
                                console.error('Güncelleme yükleme hatası:', error);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            Alert.alert('Hata', 'Güncelleme işlemi sırasında bir hata oluştu.');
            console.error('Güncelleme hatası:', error);
        } finally {
            setIsChecking(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const updateTips = [
        {
            icon: 'shield-checkmark-outline',
            title: 'Güvenlik',
            description: 'Düzenli güncellemeler güvenliğinizi artırır ve verilerinizi korur.'
        },
        {
            icon: 'flash-outline',
            title: 'Performans',
            description: 'Her güncelleme ile daha hızlı ve daha akıcı bir deneyim.'
        },
        {
            icon: 'star-outline',
            title: 'Yeni Özellikler',
            description: 'Güncellemelerle birlikte yeni özellikler ve iyileştirmeler.'
        }
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#6366F1" />
            <ScrollView style={styles.container}>
                <LinearGradient
                    colors={['#6366F1', '#4F46E5', '#4338CA']}
                    style={styles.header}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    
                    <Animated.View 
                        entering={FadeInDown.springify()}
                        style={[styles.headerContent]}
                    >
                        <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
                            <Ionicons name="cloud-upload-outline" size={40} color="#fff" />
                        </Animated.View>
                        <Text style={styles.headerTitle}>Güncellemeler</Text>
                        <View style={styles.versionContainer}>
                            <Text style={styles.versionLabel}>Mevcut Sürüm</Text>
                            <Text style={styles.versionNumber}>{currentVersion}</Text>
                        </View>
                        {lastChecked && (
                            <Text style={styles.lastChecked}>
                                Son kontrol: {formatDate(lastChecked)}
                            </Text>
                        )}
                    </Animated.View>
                </LinearGradient>

                <View style={styles.content}>
                    <Animated.View
                        entering={FadeInDown.springify().delay(100)}
                        style={styles.statusCard}
                    >
                        <View style={styles.statusContainer}>
                            <View style={[
                                styles.statusIndicator,
                                { backgroundColor: updateAvailable ? '#F59E0B' : '#10B981' }
                            ]} />
                            <Text style={styles.statusText}>
                                {updateAvailable ? 'Güncelleme Mevcut' : 'Güncel'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.updateButton,
                                isChecking && styles.buttonDisabled,
                                updateAvailable && styles.updateAvailableButton
                            ]}
                            onPress={updateAvailable ? installUpdate : checkForUpdates}
                            disabled={isChecking}
                        >
                            {isChecking ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons
                                        name={updateAvailable ? "cloud-download-outline" : "refresh-outline"}
                                        size={24}
                                        color="#fff"
                                        style={styles.buttonIcon}
                                    />
                                    <Text style={styles.buttonText}>
                                        {updateAvailable ? 'Güncellemeyi Yükle' : 'Güncellemeleri Kontrol Et'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    {updateInfo && (
                        <Animated.View
                            entering={FadeInDown.springify().delay(200)}
                            style={styles.infoCard}
                        >
                            <Text style={styles.infoTitle}>Güncelleme Bilgileri</Text>
                            <View style={styles.infoRow}>
                                <Ionicons name="information-circle-outline" size={20} color="#6366F1" />
                                <Text style={styles.infoText}>
                                    Güncelleme ID: {Updates.updateId || 'Mevcut değil'}
                                </Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Ionicons name="time-outline" size={20} color="#6366F1" />
                                <Text style={styles.infoText}>
                                    Yayın Tarihi: {formatDate(new Date())}
                                </Text>
                            </View>
                        </Animated.View>
                    )}

                    <View style={styles.tipsContainer}>
                        <Text style={styles.tipsTitle}>Neden Güncel Kalmalıyım?</Text>
                        {updateTips.map((tip, index) => (
                            <Animated.View
                                key={index}
                                entering={FadeInDown.springify().delay(300 + (index * 100))}
                                style={styles.tipCard}
                            >
                                <View style={[styles.tipIconContainer, { backgroundColor: `rgba(99, 102, 241, ${0.1 + (index * 0.1)})` }]}>
                                    <Ionicons name={tip.icon} size={24} color="#6366F1" />
                                </View>
                                <View style={styles.tipContent}>
                                    <Text style={styles.tipTitle}>{tip.title}</Text>
                                    <Text style={styles.tipDescription}>{tip.description}</Text>
                                </View>
                            </Animated.View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#6366F1',
    },
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 20 : 40,
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        overflow: 'hidden',
    },
    headerContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    backButton: {
        position: 'absolute',
        left: 20,
        top: Platform.OS === 'ios' ? 20 : 40,
        zIndex: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        padding: 8,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
        textAlign: 'center',
    },
    versionContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    versionLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        marginBottom: 5,
    },
    versionNumber: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    lastChecked: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginTop: 5,
    },
    content: {
        padding: 20,
        marginTop: -30,
    },
    statusCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    statusText: {
        fontSize: 18,
        color: '#1F2937',
        fontWeight: '600',
    },
    updateButton: {
        backgroundColor: '#6366F1',
        borderRadius: 15,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    updateAvailableButton: {
        backgroundColor: '#F59E0B',
        shadowColor: '#F59E0B',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonIcon: {
        marginRight: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 15,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 12,
    },
    infoText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#4B5563',
    },
    tipsContainer: {
        marginTop: 10,
    },
    tipsTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 15,
        textAlign: 'center',
    },
    tipCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tipIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    tipContent: {
        flex: 1,
    },
    tipTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    tipDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
});

export default UpdatesPage; 