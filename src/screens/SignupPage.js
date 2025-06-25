import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Keyboard,
    StyleSheet,
    Modal,
    FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { register } from '../redux/userSlice';
import { translate, loadI18nLanguage } from '../i18n/i18n';
import { changeLanguage } from '../redux/slices/languageSlice';
import { BlurView } from 'expo-blur';

// Dil seçenekleri
const languageOptions = [
    {
        id: 'tr',
        name: 'Türkçe',
        nativeName: 'Türkçe',
        flag: '🇹🇷',
    },
    {
        id: 'en',
        name: 'İngilizce',
        nativeName: 'English',
        flag: '🇬🇧',
    },
    {
        id: 'de',
        name: 'Almanca',
        nativeName: 'Deutsch',
        flag: '🇩🇪',
    },
    {
        id: 'es',
        name: 'İspanyolca',
        nativeName: 'Español',
        flag: '🇪🇸',
    }
];

const SignupPage = ({ navigation }) => {
    const [username, setUserName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [verifyPassword, setVerifyPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showVerifyPassword, setShowVerifyPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [languageModalVisible, setLanguageModalVisible] = useState(false);
    const [forceRender, setForceRender] = useState(false);

    const dispatch = useDispatch();
    const { Loading } = useSelector(state => state.user);
    const currentLanguage = useSelector((state) => state.language.language) || 'tr';

    useEffect(() => {
        navigation.setOptions({
            headerShown: false
        });
    }, [navigation]);

    // Kullanıcı adı doğrulama
    const validateUsername = (username) => {
        // Türkçe karakterler ve diğer geçerli karakterler için regex
        const usernameRegex = /^[a-zA-ZğĞüÜşŞıİöÖçÇ0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            return translate('signup_error_username');
        }
        return '';
    };

    // Email doğrulama
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return translate('signup_error_email');
        }
        return '';
    };

    // Şifre doğrulama
    const validatePassword = (password) => {
        if (password.length < 6) {
            return translate('signup_error_password_length');
        }
        if (!/[A-Z]/.test(password)) {
            return translate('signup_error_password_uppercase');
        }
        if (!/[0-9]/.test(password)) {
            return translate('signup_error_password_number');
        }
        return '';
    };

    const handleRegister = async () => {
        setIsLoading(true);
        setErrorMessage('');

        // Tüm alanların dolu olduğunu kontrol et
        if (!username || !email || !password || !verifyPassword) {
            setErrorMessage(translate('signup_error_empty_fields'));
            setIsLoading(false);
            return;
        }

        // Kullanıcı adı doğrulama
        const usernameError = validateUsername(username);
        if (usernameError) {
            setErrorMessage(usernameError);
            setIsLoading(false);
            return;
        }

        // Email doğrulama
        const emailError = validateEmail(email);
        if (emailError) {
            setErrorMessage(emailError);
            setIsLoading(false);
            return;
        }

        // Şifre doğrulama
        const passwordError = validatePassword(password);
        if (passwordError) {
            setErrorMessage(passwordError);
            setIsLoading(false);
            return;
        }

        // Şifre eşleşme kontrolü
        if (password !== verifyPassword) {
            setErrorMessage(translate('signup_error_password_match'));
            setIsLoading(false);
            return;
        }

        try {
            const result = await dispatch(register({ email, password, username })).unwrap();

            if (result && result.user) {
                // Kayıt başarılı, ana sayfaya yönlendir
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainStack' }],
                });
            }
        } catch (error) {
            // Daha detaylı hata yakalama ve gösterme
            console.error('Kayıt hatası detayları:', JSON.stringify(error));

            // Hata bir string ise direkt göster, object ise mesaj kısmını al
            let errorMsg = typeof error === 'string'
                ? error
                : error?.message || translate('signup_error_default');

            setErrorMessage(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Input değişikliklerinde hata mesajını temizle
    const handleInputChange = (setter) => (value) => {
        setErrorMessage('');
        setter(value);
    };

    // Dil değiştirme fonksiyonu
    const handleLanguageSelect = (langId) => {
        dispatch(changeLanguage(langId))
            .unwrap()
            .then(() => {
                // Dil değiştikten sonra i18n'i güncelleyelim
                loadI18nLanguage(langId);
                // Şimdi modal'ı kapatalım
                setLanguageModalVisible(false);
                // Ekranı zorla tekrar render edelim
                setForceRender(prev => !prev);
            })
            .catch(error => {
                console.error('Dil değiştirme hatası:', error);
                setErrorMessage(translate('language_change_error'));
            });
    };

    // Mevcut dil bilgisini al
    const getCurrentLanguageName = () => {
        const lang = languageOptions.find(lang => lang.id === currentLanguage);
        return lang ? lang.flag : '🇹🇷';
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                
                {/* Dil değiştirme butonu */}
                <TouchableOpacity 
                    style={styles.languageButton}
                    onPress={() => setLanguageModalVisible(true)}
                >
                    <Text style={styles.languageButtonText}>{getCurrentLanguageName()}</Text>
                    <Ionicons name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>

                {/* Dil seçim modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={languageModalVisible}
                    onRequestClose={() => setLanguageModalVisible(false)}
                >
                    <TouchableOpacity 
                        style={styles.modalOverlay} 
                        activeOpacity={1}
                        onPress={() => setLanguageModalVisible(false)}
                    >
                        <BlurView intensity={15} style={StyleSheet.absoluteFill} />
                        <View style={styles.languageModalContainer}>
                            <View style={styles.languageModalHeader}>
                                <Text style={styles.languageModalTitle}>{translate('select_language')}</Text>
                                <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                                    <Ionicons name="close-circle" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={languageOptions}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.languageItem,
                                            currentLanguage === item.id && styles.selectedLanguageItem
                                        ]}
                                        onPress={() => handleLanguageSelect(item.id)}
                                    >
                                        <Text style={styles.languageFlag}>{item.flag}</Text>
                                        <View style={styles.languageTextContainer}>
                                            <Text style={styles.languageName}>{item.name}</Text>
                                            <Text style={styles.languageNativeName}>{item.nativeName}</Text>
                                        </View>
                                        {currentLanguage === item.id && (
                                            <Ionicons name="checkmark-circle" size={22} color="#FF6B6B" />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </TouchableOpacity>
                </Modal>
                
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContainer}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        <View style={styles.mainContent}>
                            <View style={styles.header}>
                                <Text style={styles.title}>{translate('signup_welcome')}</Text>
                                <Text style={styles.subtitle}>{translate('signup_subtitle')}</Text>
                            </View>

                            <View style={styles.formContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder={translate('signup_username')}
                                    value={username}
                                    onChangeText={handleInputChange(setUserName)}
                                    autoCapitalize="none"
                                    placeholderTextColor="#A0A0A0"
                                />

                                <TextInput
                                    style={styles.input}
                                    placeholder={translate('signup_email')}
                                    value={email}
                                    onChangeText={handleInputChange(setEmail)}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    placeholderTextColor="#A0A0A0"
                                />

                                <View style={styles.passwordContainer}>
                                    <TextInput
                                        style={[styles.input, styles.passwordInput]}
                                        placeholder={translate('signup_password')}
                                        value={password}
                                        onChangeText={handleInputChange(setPassword)}
                                        secureTextEntry={!showPassword}
                                        placeholderTextColor="#A0A0A0"
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeIcon}
                                    >
                                        <Ionicons
                                            name={showPassword ? "eye-outline" : "eye-off-outline"}
                                            size={24}
                                            color="#A0A0A0"
                                        />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.passwordContainer}>
                                    <TextInput
                                        style={[styles.input, styles.passwordInput]}
                                        placeholder={translate('signup_verify_password')}
                                        value={verifyPassword}
                                        onChangeText={handleInputChange(setVerifyPassword)}
                                        secureTextEntry={!showVerifyPassword}
                                        placeholderTextColor="#A0A0A0"
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowVerifyPassword(!showVerifyPassword)}
                                        style={styles.eyeIcon}
                                    >
                                        <Ionicons
                                            name={showVerifyPassword ? "eye-outline" : "eye-off-outline"}
                                            size={24}
                                            color="#A0A0A0"
                                        />
                                    </TouchableOpacity>
                                </View>

                                {errorMessage ? (
                                    <Text style={styles.errorText}>{errorMessage}</Text>
                                ) : null}

                                <TouchableOpacity
                                    style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
                                    onPress={handleRegister}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.signUpButtonText}>{translate('signup_button')}</Text>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.loginContainer}>
                                    <Text style={styles.loginText}>{translate('signup_have_account')} </Text>
                                    <TouchableOpacity onPress={() => navigation.navigate('Giriş Yap')}>
                                        <Text style={styles.loginLink}>{translate('signup_login')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <View style={styles.termsSection}>
                            <Text style={styles.termsText}>
                                {translate('signup_terms')}
                                <Text style={styles.termsLink}>{translate('signup_terms_of_use')}</Text>
                                {translate('signup_and')}
                                <Text style={styles.termsLink}>{translate('signup_privacy_policy')}</Text>
                                {translate('signup_agree')}
                            </Text>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'space-between',
    },
    mainContent: {
        paddingTop: 60,
        paddingBottom: 20,
    },
    header: {
        paddingHorizontal: 24,
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666666',
        lineHeight: 24,
    },
    formContainer: {
        paddingHorizontal: 24,
    },
    input: {
        height: 56,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#1A1A1A',
        marginBottom: 16,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        marginBottom: 16,
    },
    passwordInput: {
        flex: 1,
        marginBottom: 0,
        backgroundColor: 'transparent',
    },
    eyeIcon: {
        padding: 16,
    },
    errorText: {
        color: '#FF6B6B',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    signUpButton: {
        height: 56,
        backgroundColor: '#FF6B6B',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    signUpButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loginText: {
        color: '#666666',
        fontSize: 14,
    },
    loginLink: {
        color: '#FF6B6B',
        fontSize: 14,
        fontWeight: '600',
    },
    termsSection: {
        backgroundColor: '#F8F9FF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    termsText: {
        textAlign: 'center',
        color: '#666666',
        fontSize: 14,
        lineHeight: 20,
    },
    termsLink: {
        color: '#FF6B6B',
        fontWeight: '500',
    },
    signUpButtonDisabled: {
        opacity: 0.7,
    },
    // Dil buton stilleri
    languageButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 20,
        zIndex: 99,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 4,
    },
    languageButtonText: {
        fontSize: 18,
        marginRight: 4,
    },
    // Modal stilleri
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    languageModalContainer: {
        width: '80%',
        maxHeight: '70%',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 12,
    },
    languageModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    languageModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    languageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginVertical: 4,
    },
    selectedLanguageItem: {
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
    },
    languageFlag: {
        fontSize: 24,
        marginRight: 12,
    },
    languageTextContainer: {
        flex: 1,
    },
    languageName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1A1A1A',
    },
    languageNativeName: {
        fontSize: 14,
        color: '#666666',
        marginTop: 2,
    },
});

export default SignupPage;