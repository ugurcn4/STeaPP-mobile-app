import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Platform, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/userSlice';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { lightTheme, darkTheme } from '../themes';
import { translate } from '../i18n/i18n';

// Shadow Wrapper Component
const ShadowWrapper = ({ children, style }) => {
    if (Platform.OS === 'ios') {
        return <View style={style}>{children}</View>;
    }

    return (
        <View style={[style, {
            backgroundColor: 'white',
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.05)',
        }]}>
            {children}
        </View>
    );
};

const SettingsPage = ({ navigation }) => {
    const dispatch = useDispatch();
    const theme = useSelector((state) => state.theme.theme);
    const [searchQuery, setSearchQuery] = useState('');
    const scrollRef = useRef(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);

    const sections = [
        {
            title: translate('blue_green_tick'),
            iconName: "checkmark-circle",
            screen: "MaviTikSorgulama",
            iconColor: '#1E90FF',
            isNew: true,
            badge: translate('new_feature')
        },
        {
            title: translate('steapp_participants_title'),
            iconName: "people-circle",
            screen: "STeaPPKatilanlar", 
            isNew: true,
            badge: translate('new_feature'),
            iconColor: '#2196F3'
        },
        {
            title: translate('announcements'),
            iconName: "megaphone-outline", 
            screen: "SettingsPageScreens",
            params: { screen: "Duyurular" },
            iconColor: '#FFA500',
            isNew: true,
            badge: translate('new_feature')
        },
        {
            title: translate('change_password'),
            iconName: "key",
            screen: "SifremiDegistir",
            iconColor: '#FF5733'
        },
        {
            title: translate('language_settings'),
            iconName: "language-outline",
            screen: "DilSecenekleri",
            iconColor: '#8A2BE2'
        },
        {
            title: translate('notifications'),
            iconName: "notifications-outline",
            screen: "Bildirimler",
            iconColor: '#FF6347'
        },
        {
            title: translate('permissions'),
            iconName: "key-outline",
            screen: "Izinler",
            iconColor: '#4682B4'
        },
        {
            title: translate('privacy'),
            iconName: "lock-closed-outline",
            screen: "Gizlilik",
            iconColor: '#32CD32'
        },
        {
            title: translate('updates'),
            iconName: "cloud-download-outline",
            screen: "Updates",
            iconColor: '#4CAF50'
        },
        {
            title: translate('onboarding'),
            iconName: "layers-outline",
            screen: "Onboarding",
            iconColor: '#9C27B0'
        },
        {
            title: translate('help_support'),
            iconName: "help-circle-outline",
            screen: "YardimDestek",
            iconColor: '#FFD700'
        },
        {
            title: translate('about'),
            iconName: "information-circle-outline",
            screen: "Hakkinda",
            iconColor: '#1E90FF'
        },
        {
            title: translate('invite_friends'),
            iconName: "people-outline",
            screen: "Arkadaşlarımı Davet Et",
            iconColor: '#FF69B4'
        },
    ];

    const filteredSections = sections.filter(section =>
        section.title.toLowerCase().trim().includes(searchQuery.toLowerCase().trim())
    );

    // Davet kartları
    const inviteCards = [
        {
            id: 1,
            title: translate('invite_friend'),
            description: translate('invite_friend_desc'),
            iconName: "people-circle-outline",
            color: "#FF69B4",
            screen: "Arkadaşlarımı Davet Et",
            buttonText: translate('invite')
        },
        {
            id: 2,
            title: translate('earn_points'),
            description: translate('earn_points_desc'),
            iconName: "trophy-outline",
            color: "#4CAF50",
            screen: "Arkadaşlarımı Davet Et",
            buttonText: translate('earn')
        },
        {
            id: 3,
            title: translate('blue_green_tick'),
            description: translate('blue_green_tick_desc'),
            iconName: "flash",
            color: "#FFD700",
            screen: "MaviTikSorgulama",
            buttonText: translate('explore')
        }
    ];

    // Otomatik kart kaydırma için effect
    useEffect(() => {
        let cardTimer;

        // İlk render'dan sonra timer'ı başlat
        const startAutoScroll = () => {
            cardTimer = setInterval(() => {
                if (scrollRef.current && inviteCards.length > 1) {
                    const nextIndex = (currentCardIndex + 1) % inviteCards.length;

                    try {
                        scrollRef.current.scrollToIndex({
                            index: nextIndex,
                            animated: true,
                            viewOffset: 0,
                            viewPosition: 0
                        });
                        setCurrentCardIndex(nextIndex);
                    } catch (error) {
                        // Hata durumunda scrollToOffset kullan
                        const offset = nextIndex * (Dimensions.get('window').width - 40);
                        scrollRef.current.scrollToOffset({
                            offset,
                            animated: true
                        });
                        setCurrentCardIndex(nextIndex);
                    }
                }
            }, 5000); // 5 saniyede bir kaydır
        };

        // Timer'ı başlat
        startAutoScroll();

        // Component unmount olduğunda timer'ı temizle
        return () => {
            if (cardTimer) {
                clearInterval(cardTimer);
            }
        };
    }, [currentCardIndex, inviteCards.length]);

    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

    const handleLogout = () => {
        Alert.alert(
            translate('logout_title'),
            translate('logout_confirm'),
            [
                { text: translate('no'), onPress: () => { } },
                {
                    text: translate('yes'),
                    onPress: async () => {
                        await dispatch(logout());
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Auth' }]
                        });
                    }
                }
            ],
            { cancelable: false }
        );
    };

    const handleNavigation = (screen, params) => {
        if (screen === 'Onboarding') {
            navigation.navigate(screen, { fromSettings: true });
        } else if (screen === 'STeaPPKatilanlar') {
            navigation.navigate('SettingsPageScreens', { screen: 'STeaPPKatilanlar' });
        } else if (screen === 'SettingsPageScreens' && params) {
            navigation.navigate(screen, params);
        } else {
            navigation.navigate(screen);
        }
    };

    const renderInviteCardsCarousel = () => {
        const cardWidth = Dimensions.get('window').width - 40; // 20px padding on each side

        return (
            <View style={styles.carouselSection}>
                <View style={styles.sectionTitleContainer}>
                    <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                        {translate('special_campaigns')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => handleNavigation('Arkadaşlarımı Davet Et')}
                        style={styles.seeAllButton}
                    >
                        <Text style={styles.seeAllText}>{translate('see_all')}</Text>
                    </TouchableOpacity>
                </View>
                <View style={[styles.flashListContainer, { height: 180 }]}>
                    <FlashList
                        ref={scrollRef}
                        data={inviteCards}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        pagingEnabled
                        decelerationRate="fast"
                        snapToInterval={cardWidth}
                        snapToAlignment="start"
                        initialScrollIndex={0}
                        estimatedItemSize={cardWidth}
                        onMomentumScrollEnd={(event) => {
                            const contentOffset = event.nativeEvent.contentOffset.x;
                            const viewSize = cardWidth;
                            const newIndex = Math.round(contentOffset / viewSize);
                            if (newIndex !== currentCardIndex) {
                                setCurrentCardIndex(newIndex);
                            }
                        }}
                        getItemLayout={(data, index) => ({
                            length: cardWidth,
                            offset: cardWidth * index,
                            index,
                        })}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <ShadowWrapper style={[
                                styles.inviteCard,
                                {
                                    backgroundColor: currentTheme.cardBackground,
                                    width: cardWidth - 20,
                                    marginHorizontal: 10
                                }
                            ]}>
                                <View style={styles.inviteCardContent}>
                                    <View style={[styles.inviteIconContainer, { backgroundColor: `${item.color}20` }]}>
                                        <Ionicons name={item.iconName} size={32} color={item.color} />
                                    </View>
                                    <View style={styles.inviteTextContainer}>
                                        <Text style={[styles.inviteTitle, { color: currentTheme.text }]}>
                                            {item.title}
                                        </Text>
                                        <Text style={[styles.inviteDescription, { color: currentTheme.textSecondary }]}>
                                            {item.description}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.inviteCardFooter}>
                                    <TouchableOpacity
                                        style={[styles.inviteButton, { backgroundColor: item.color }]}
                                        onPress={() => handleNavigation(item.screen)}
                                    >
                                        <Text style={styles.inviteButtonText}>{item.buttonText}</Text>
                                        <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 5 }} />
                                    </TouchableOpacity>
                                </View>
                            </ShadowWrapper>
                        )}
                    />
                </View>
                <View style={styles.carouselIndicators}>
                    {inviteCards.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.carouselDot,
                                currentCardIndex === index ? styles.carouselDotActive : null
                            ]}
                        />
                    ))}
                </View>
            </View>
        );
    };

    const renderLogoutButton = () => (
        <TouchableOpacity
            style={[
                styles.logoutButton,
                Platform.OS === 'android' && styles.logoutButtonAndroid
            ]}
            onPress={handleLogout}
        >
            <Text style={[
                styles.logoutButtonText,
                Platform.OS === 'android' && styles.logoutButtonTextAndroid
            ]}>
                {translate('logout')}
            </Text>
        </TouchableOpacity>
    );

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: currentTheme.background }]}
            contentContainerStyle={{ paddingBottom: 80 }}
        >
            <ShadowWrapper style={[styles.header, { backgroundColor: currentTheme.background }]}>
                <Text style={[styles.headerTitle, { color: currentTheme.text }]}>{translate('settings')}</Text>

                {/* Arama Çubuğu */}
                <View style={[styles.searchContainer, { backgroundColor: currentTheme.cardBackground }]}>
                    <Ionicons name="search" size={20} color={currentTheme.text} style={styles.searchIcon} />
                    <TextInput
                        style={[
                            styles.searchInput,
                            { color: currentTheme.text },
                            Platform.OS === 'ios' ? { fontStyle: 'normal' } : null
                        ]}
                        placeholder={translate('search_settings')}
                        placeholderTextColor={Platform.OS === 'ios'
                            ? `${currentTheme.textSecondary}99`
                            : currentTheme.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </ShadowWrapper>

            <View style={styles.content}>
                {/* Davet Kartları Carousel */}
                {renderInviteCardsCarousel()}

                {/* Ayarlar Kartları */}
                {filteredSections.length > 0 ? (
                    filteredSections.map((section, index) => (
                        <ShadowWrapper key={index} style={[styles.settingsCard, { backgroundColor: currentTheme.cardBackground }]}>
                            <TouchableOpacity
                                onPress={() => handleNavigation(section.screen, section.params)}
                            >
                                <View style={styles.settingRow}>
                                    <View style={[styles.iconContainer, { backgroundColor: section.iconColor + '20' }]}>
                                        <Ionicons name={section.iconName} size={24} color={section.iconColor} />
                                    </View>
                                    <View style={styles.settingInfo}>
                                        <Text style={[styles.settingTitle, { color: currentTheme.text }]}>
                                            {section.title}
                                        </Text>
                                        {section.isNew && (
                                            <View style={styles.badgeContainer}>
                                                <Text style={styles.badgeText}>{section.badge}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Ionicons name="chevron-forward" size={24} color={currentTheme.text} />
                                </View>
                            </TouchableOpacity>
                        </ShadowWrapper>
                    ))
                ) : (
                    <ShadowWrapper style={[styles.settingsCard, { backgroundColor: currentTheme.cardBackground }]}>
                        <Text style={[styles.noResults, { color: currentTheme.textSecondary }]}>
                            {translate('no_results')}
                        </Text>
                    </ShadowWrapper>
                )}

                {/* Çıkış Yap Butonu */}
                {renderLogoutButton()}
            </View>
        </ScrollView>
    );
};

export default SettingsPage;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingTop: 60,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
        borderRadius: 15,
        padding: 10,
        marginBottom: 10,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
        fontWeight: '500',
        letterSpacing: 0.5,
        paddingVertical: 8,
    },
    content: {
        padding: 20,
    },
    settingsCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
    },
    themeOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    themeOption: {
        flex: 1,
        alignItems: 'center',
        padding: 15,
        borderRadius: 15,
        marginHorizontal: 5,
        backgroundColor: '#F5F6FA',
    },
    selectedThemeOption: {
        backgroundColor: '#4CAF50',
    },
    themeText: {
        marginTop: 8,
        fontSize: 14,
        color: '#666',
    },
    selectedThemeText: {
        color: '#fff',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    settingInfo: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    noResults: {
        textAlign: 'center',
        fontSize: 16,
    },
    logoutButton: {
        marginHorizontal: 16,
        marginBottom: Platform.OS === 'ios' ? 40 : 20,
        borderRadius: 8,
    },
    logoutButtonAndroid: {
        backgroundColor: '#FF3B30',
        elevation: 3,
        padding: 12,
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        color: Platform.OS === 'ios' ? '#FF3B30' : '#FFF',
    },
    logoutButtonTextAndroid: {
        color: '#FFF',
    },
    flashBanner: {
        borderRadius: 20,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,105,255,0.2)',
    },
    flashBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    flashIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    flashTextContainer: {
        flex: 1,
    },
    flashTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    flashDescription: {
        fontSize: 14,
    },
    flashButton: {
        backgroundColor: '#1E90FF',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        marginLeft: 10,
    },
    flashButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    badgeContainer: {
        backgroundColor: '#FF6347',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 12,
        marginTop: 5,
        alignSelf: 'flex-start', // Yazı kadar genişlik için
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    carouselSection: {
        marginBottom: 25,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    seeAllButton: {
        padding: 5,
    },
    seeAllText: {
        color: '#4CAF50',
        fontWeight: '600',
        fontSize: 14,
    },
    carouselContainer: {
        marginBottom: 10,
    },
    inviteCard: {
        borderRadius: 20,
        padding: 15,
        margin: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,105,255,0.1)',
        elevation: 5,
    },
    inviteCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    inviteIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    inviteTextContainer: {
        flex: 1,
    },
    inviteTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    inviteDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    inviteCardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    inviteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 15,
    },
    inviteButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    carouselIndicators: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 10,
    },
    carouselDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ccc',
        marginHorizontal: 3,
    },
    carouselDotActive: {
        backgroundColor: '#4CAF50',
        width: 12,
        height: 8,
    },
    searchPlaceholder: {
        fontFamily: 'System',
        fontWeight: '500',
        fontSize: 16,
        fontStyle: 'italic',
        letterSpacing: 0.3,
        opacity: 0.7,
    },
    flashListContainer: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
