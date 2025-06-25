import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, SafeAreaView, StatusBar } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { lightTheme, darkTheme } from '../../themes';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { changeLanguage, loadLanguage } from '../../redux/slices/languageSlice';
import { translate } from '../../i18n/i18n';

// Dil seçenekleri
const languageOptions = [
    {
        id: 'tr',
        name: 'Türkçe',
        nativeName: 'Türkçe',
        flag: '🇹🇷',
        isActive: true
    },
    {
        id: 'en',
        name: 'İngilizce',
        nativeName: 'English',
        flag: '🇬🇧',
        isActive: true,
        comingSoon: false
    },
    {
        id: 'de',
        name: 'Almanca',
        nativeName: 'Deutsch',
        flag: '🇩🇪',
        isActive: true,
        comingSoon: false
    },
    {
        id: 'es',
        name: 'İspanyolca',
        nativeName: 'Español',
        flag: '🇪🇸',
        isActive: true,
        comingSoon: false
    },
    {
        id: 'fr',
        name: 'Fransızca',
        nativeName: 'Français',
        flag: '🇫🇷',
        isActive: false,
        comingSoon: true
    },
    {
        id: 'ar',
        name: 'Arapça',
        nativeName: 'العربية',
        flag: '🇸🇦',
        isActive: false,
        comingSoon: true
    }
];

const DilSecenekleriPage = ({ navigation }) => {
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;
    const currentLanguage = useSelector((state) => state.language.language);
    const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
    const dispatch = useDispatch();

    // Sayfa yüklendiğinde AsyncStorage'dan dil ayarını yükle
    useEffect(() => {
        dispatch(loadLanguage());
    }, [dispatch]);

    useEffect(() => {
        setSelectedLanguage(currentLanguage);
    }, [currentLanguage]);

    const handleLanguageSelect = (langId) => {
        // Eğer yakında eklenecek bir dil ise bilgilendirme mesajı göster
        const language = languageOptions.find(lang => lang.id === langId);

        if (language.comingSoon) {
            Alert.alert(
                translate('language_coming_soon'),
                `${language.name} ${translate('language_settings_description')}`,
                [{ text: translate('done'), style: "default" }]
            );
            return;
        }

        // AsyncStorage ile Redux'u kullanarak dil değişimini yap
        dispatch(changeLanguage(langId))
            .unwrap()
            .then(() => {
                setSelectedLanguage(langId);
                Alert.alert(
                    translate('language_changed'),
                    translate('language_changed_message', { language: language.name }),
                    [{ text: translate('done'), style: "default" }]
                );
            })
            .catch((error) => {
                console.error("Dil değiştirme hatası:", error);
                Alert.alert(
                    translate('error'),
                    translate('language_change_error'),
                    [{ text: translate('done'), style: "default" }]
                );
            });
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.background }]}>
            <StatusBar
                backgroundColor={currentTheme.background}
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
            />
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: currentTheme.text }]}>
                    {translate('language_settings')}
                </Text>
                <View style={styles.placeholderRight} />
            </View>

            <ScrollView
                style={[styles.container, { backgroundColor: currentTheme.background }]}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.infoContainer}>
                    <Ionicons name="information-circle-outline" size={22} color={currentTheme.textSecondary} />
                    <Text style={[styles.infoText, { color: currentTheme.textSecondary }]}>
                        {translate('language_settings_description')}
                    </Text>
                </View>

                <View style={styles.languageContainer}>
                    {languageOptions.map((language) => (
                        <TouchableOpacity
                            key={language.id}
                            style={[
                                styles.languageCard,
                                {
                                    backgroundColor: currentTheme.cardBackground,
                                    borderColor: selectedLanguage === language.id
                                        ? '#4CAF50'
                                        : 'rgba(0,0,0,0.05)'
                                },
                                selectedLanguage === language.id && styles.selectedLanguageCard
                            ]}
                            onPress={() => handleLanguageSelect(language.id)}
                            disabled={language.comingSoon}
                        >
                            <View style={styles.languageDetails}>
                                <Text style={styles.languageFlag}>
                                    {language.flag}
                                </Text>
                                <View style={styles.languageTextContainer}>
                                    <Text style={[
                                        styles.languageName,
                                        { color: currentTheme.text }
                                    ]}>
                                        {language.name}
                                    </Text>
                                    <Text style={[
                                        styles.languageNativeName,
                                        { color: currentTheme.textSecondary }
                                    ]}>
                                        {language.nativeName}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.languageStatus}>
                                {language.comingSoon ? (
                                    <View style={styles.comingSoonBadge}>
                                        <Text style={styles.comingSoonText}>{translate('language_coming_soon')}</Text>
                                    </View>
                                ) : selectedLanguage === language.id ? (
                                    <View style={styles.selectedIconContainer}>
                                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                                    </View>
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={[styles.footerText, { color: currentTheme.textSecondary }]}>
                    {translate('more_languages_soon')}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 40,
        paddingHorizontal: 16
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        paddingTop: Platform.OS === 'android' ? 8 : 0,
        marginTop: Platform.OS === 'android' ? 8 : 0,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    placeholderRight: {
        width: 40,
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        padding: 12,
        marginTop: 16,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        marginLeft: 8,
        lineHeight: 20,
    },
    languageContainer: {
        marginTop: 20,
    },
    languageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    selectedLanguageCard: {
        borderWidth: 2,
    },
    languageDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    languageFlag: {
        fontSize: 24,
        marginRight: 12,
    },
    languageTextContainer: {
        flexDirection: 'column',
    },
    languageName: {
        fontSize: 16,
        fontWeight: '500',
    },
    languageNativeName: {
        fontSize: 14,
        marginTop: 2,
    },
    languageStatus: {
        alignItems: 'flex-end',
    },
    selectedIconContainer: {
        width: 24,
        height: 24,
    },
    comingSoonBadge: {
        backgroundColor: '#FFC107',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    comingSoonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    footerText: {
        textAlign: 'center',
        fontSize: 14,
        marginTop: 16,
        marginBottom: 24,
    }
});

export default DilSecenekleriPage; 