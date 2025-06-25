import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    SafeAreaView,
    ActivityIndicator,
    ScrollView,
    Modal,
    FlatList
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, socialLogin } from '../redux/userSlice';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getAuth, OAuthProvider, signInWithCredential, FacebookAuthProvider } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { ResponseType } from 'expo-auth-session';
import { useGoogleAuth, handleGoogleLogin } from '../services/googleAuthService';
import { translate, loadI18nLanguage } from '../i18n/i18n';
import { changeLanguage } from '../redux/slices/languageSlice';
import { BlurView } from 'expo-blur';
import FastImage from 'react-native-fast-image';

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

// WebBrowser'ın auth session'ını kurulumu
WebBrowser.maybeCompleteAuthSession();

const LoginPage = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [languageModalVisible, setLanguageModalVisible] = useState(false);
    const loginStatus = useSelector((state) => state.user.status);
    const currentLanguage = useSelector((state) => state.language.language) || 'tr';
    const dispatch = useDispatch();

    // Google kimlik doğrulama hook'u
    const googleAuth = useGoogleAuth();
    const googlePromptAsync = googleAuth.promptAsync;

    // Facebook kimlik doğrulama hook'u
    const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({
        clientId: '3564202470553580',
        responseType: ResponseType.Token,
        redirectUri: 'https://auth.expo.io/@ugurrucr/steapp'
    });

    // Ekranı tekrar render etmek için state
    const [forceRender, setForceRender] = useState(false);

    useEffect(() => {
        setLoading(loginStatus === 'loading');
    }, [loginStatus]);

    useEffect(() => {
        navigation.setOptions({
            headerShown: false
        });
    }, [navigation]);

    // Google yanıtını işleme 
    useEffect(() => {
        if (googleAuth.response?.type === 'success') {
            try {
                // Code flow için 'authentication.accessToken' yerine 'code' kullanılır
                const authData = googleAuth.response;
                if (authData?.authentication?.accessToken) {
                    // Token akışı için
                    handleGoogleLogin(authData.authentication.accessToken, dispatch);
                } else if (authData?.authentication?.idToken) {
                    // ID token varsa
                    handleGoogleLogin(authData.authentication.idToken, dispatch);
                } else if (authData.code) {
                    // Normalde code'u sunucuya gönderip token almanız gerekir
                    // Burada demo amaçlı doğrudan token gibi kullanıyoruz
                    handleGoogleLogin(authData.code, dispatch);
                } else {
                    console.error('Google yanıtında token bilgisi bulunamadı');
                    Toast.show({
                        type: 'error',
                        text1: translate('login_error'),
                        text2: translate('login_google_incomplete'),
                        position: 'top',
                    });
                }
            } catch (error) {
                console.error('Google yanıt işleme hatası:', error);
                Toast.show({
                    type: 'error',
                    text1: translate('login_failed'),
                    text2: translate('login_google_error'),
                    position: 'top',
                });
            }
        } else if (googleAuth.response?.type === 'error') {
            console.error('Google giriş hatası:', googleAuth.response.error);
            Toast.show({
                type: 'error',
                text1: translate('login_failed'),
                text2: translate('login_google_failed'),
                position: 'top',
            });
        }
    }, [googleAuth.response, dispatch]);

    // Facebook yanıtını işleme
    useEffect(() => {
        if (fbResponse?.type === 'success') {
            const { authentication } = fbResponse;
            handleFacebookSignIn(authentication.accessToken);
        }
    }, [fbResponse]);

    // Email/şifre ile giriş
    const handleLogin = async () => {
        if (!email || !password) {
            Toast.show({
                type: 'error',
                text1: translate('login_error'),
                text2: translate('login_error_empty_fields'),
                position: 'top',
            });
            return;
        }

        setLoading(true);
        try {
            await dispatch(login({ email, password })).unwrap();
        } catch (error) {
            console.error('Giriş hatası:', error);
            Toast.show({
                type: 'error',
                text1: translate('login_failed'),
                text2: error || translate('login_error_check_credentials'),
                position: 'top',
            });
        } finally {
            setLoading(false);
        }
    };

    // Facebook ile giriş
    const handleFacebookSignIn = async (token) => {
        try {
            const auth = getAuth();
            const credential = FacebookAuthProvider.credential(token);
            const userCredential = await signInWithCredential(auth, credential);
            const firebaseToken = await userCredential.user.getIdToken();

            const userDataToStore = {
                token: firebaseToken,
                user: {
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    emailVerified: userCredential.user.emailVerified,
                    username: userCredential.user.displayName || userCredential.user.email?.split('@')[0]
                }
            };

            await AsyncStorage.setItem('userToken', firebaseToken);
            await AsyncStorage.setItem('userData', JSON.stringify(userDataToStore));
            await dispatch(socialLogin(userDataToStore)).unwrap();

            Toast.show({
                type: 'success',
                text1: translate('login_success'),
                text2: translate('login_facebook_success'),
                position: 'top',
            });
        } catch (error) {
            console.error('Facebook giriş hatası:', error);
            Toast.show({
                type: 'error',
                text1: translate('login_failed'),
                text2: translate('login_facebook_error'),
                position: 'top',
            });
        }
    };

    // Sosyal giriş işleyicisi
    const handleSocialLogin = async (provider) => {
        if (provider === 'Google') {
            try {

                // iOS için özel parametreler
                const promptParams = Platform.OS === 'ios'
                    ? { showInRecents: true }
                    : { showInRecents: true, useProxy: true };


                // Google giriş işlemini başlat
                const result = await googlePromptAsync(promptParams);

            } catch (error) {
                console.error('Google giriş başlatma hatası:', error);
                Toast.show({
                    type: 'error',
                    text1: translate('login_failed'),
                    text2: translate('login_google_start_error'),
                    position: 'top',
                });
            }
        } else if (provider === 'Facebook') {
            // Facebook ile giriş için yakında bilgisi gösterilecek
            Toast.show({
                type: 'info',
                text1: translate('login_info'),
                text2: translate('login_facebook_coming_soon'),
                position: 'top',
                visibilityTime: 3000,
            });
        } else if (provider === 'Apple') {
            try {
                const credential = await AppleAuthentication.signInAsync({
                    requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    ],
                });

                const { identityToken, nonce, email, fullName, user: appleUser } = credential;

                // Firebase ile giriş yap
                const auth = getAuth();
                const appleProvider = new OAuthProvider('apple.com');
                const firebaseCredential = appleProvider.credential({
                    idToken: identityToken,
                    rawNonce: nonce
                });

                const userCredential = await signInWithCredential(auth, firebaseCredential);
                const token = await userCredential.user.getIdToken();

                // Kullanıcı bilgilerini hazırla
                const userDataToStore = {
                    token,
                    user: {
                        uid: userCredential.user.uid,
                        email: email || userCredential.user.email,
                        emailVerified: userCredential.user.emailVerified,
                        username: fullName ? `${fullName.givenName} ${fullName.familyName}` : email?.split('@')[0]
                    }
                };

                // AsyncStorage'a kaydet
                await AsyncStorage.setItem('userToken', token);
                await AsyncStorage.setItem('userData', JSON.stringify(userDataToStore));

                // Redux store'u güncelle
                await dispatch(socialLogin(userDataToStore)).unwrap();

                Toast.show({
                    type: 'success',
                    text1: translate('login_success'),
                    text2: translate('login_apple_success'),
                    position: 'top',
                });

            } catch (error) {
                console.error('Apple giriş hatası:', error);
                Toast.show({
                    type: 'error',
                    text1: translate('login_failed'),
                    text2: translate('login_apple_error') + error.message,
                    position: 'top',
                });
            }
        }
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
                Toast.show({
                    type: 'error',
                    text1: translate('error'),
                    text2: translate('language_change_error'),
                    position: 'top',
                });
            });
    };

    // Mevcut dil bilgisini al
    const getCurrentLanguageName = () => {
        const lang = languageOptions.find(lang => lang.id === currentLanguage);
        return lang ? lang.flag : '🇹🇷';
    };

    return (
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
                                        <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
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
                enabled
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    alwaysBounceVertical={false}
                    scrollEventThrottle={16}
                    decelerationRate="normal"
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <View style={styles.mainContent}>
                        <View style={styles.header}>
                            <Text style={styles.title}>{translate('login_welcome')}</Text>
                            <Text style={styles.subtitle}>{translate('login_subtitle')}</Text>
                        </View>

                        <View style={styles.formContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder={translate('login_email_placeholder')}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor="#A0A0A0"
                            />

                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={[styles.input, styles.passwordInput]}
                                    placeholder={translate('login_password_placeholder')}
                                    value={password}
                                    onChangeText={setPassword}
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

                            <TouchableOpacity
                                style={styles.forgotPassword}
                                onPress={() => navigation.navigate('ForgotPassword')}
                            >
                                <Text style={styles.forgotPasswordText}>{translate('login_forgot_password')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.signInButton}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.signInButtonText}>{translate('login_button')}</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={styles.divider} />
                                <Text style={styles.dividerText}>{translate('login_or')}</Text>
                                <View style={styles.divider} />
                            </View>

                            <View style={styles.socialButtonsContainer}>
                                <TouchableOpacity
                                    style={[styles.socialButton, { backgroundColor: '#4267B2' }]}
                                    onPress={() => handleSocialLogin('Facebook')}
                                    disabled={false}
                                >
                                    <Ionicons name="logo-facebook" size={26} color="#FFF" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.socialButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DADCE0' }]}
                                    onPress={() => handleSocialLogin('Google')}
                                    disabled={!googleAuth.request}
                                >
                                    <FastImage
                                        source={require('../../assets/images/google-logo.png')}
                                        style={{ width: 40, height: 40 }}
                                        resizeMode={FastImage.resizeMode.contain}
                                    />
                                </TouchableOpacity>

                                {Platform.OS === 'ios' && (
                                    <TouchableOpacity
                                        style={[styles.socialButton, { backgroundColor: '#000000' }]}
                                        onPress={() => handleSocialLogin('Apple')}
                                    >
                                        <Ionicons name="logo-apple" size={26} color="#FFF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.registerContainer}>
                                <Text style={styles.registerText}>{translate('login_no_account')} </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Kayıt Ol')}>
                                    <Text style={styles.registerLink}>{translate('login_register')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.featureSection}>
                            <View style={styles.featureGrid}>
                                <View style={styles.featureItem}>
                                    <View style={[styles.featureIconContainer, { backgroundColor: '#FF6B6B' }]}>
                                        <Ionicons name="location-outline" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.featureText}>{translate('login_feature_location')}</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={[styles.featureIconContainer, { backgroundColor: '#4ECDC4' }]}>
                                        <Ionicons name="time-outline" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.featureText}>{translate('login_feature_history')}</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={[styles.featureIconContainer, { backgroundColor: '#45B7D1' }]}>
                                        <Ionicons name="people-outline" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.featureText}>{translate('login_feature_group')}</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={[styles.featureIconContainer, { backgroundColor: '#82C596' }]}>
                                        <Ionicons name="shield-checkmark-outline" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.featureText}>{translate('login_feature_secure')}</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={[styles.featureIconContainer, { backgroundColor: '#FFD93D' }]}>
                                        <Ionicons name="notifications-outline" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.featureText}>{translate('login_feature_notifications')}</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={[styles.featureIconContainer, { backgroundColor: '#FF8C94' }]}>
                                        <Ionicons name="analytics-outline" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.featureText}>{translate('login_feature_analytics')}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    mainContent: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    },
    header: {
        paddingHorizontal: 24,
        marginBottom: 32,
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
        marginBottom: 20,
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
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotPasswordText: {
        color: '#666666',
        fontSize: 14,
    },
    signInButton: {
        height: 56,
        backgroundColor: '#34A853',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    signInButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 1,
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    registerText: {
        color: '#666666',
        fontSize: 14,
    },
    registerLink: {
        color: '#FF6B6B',
        fontSize: 14,
        fontWeight: '600',
    },
    featureSection: {
        backgroundColor: '#F8F9FF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    featureItem: {
        width: '30%',
        alignItems: 'center',
    },
    featureIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 4,
    },
    featureText: {
        fontSize: 12,
        color: '#333333',
        textAlign: 'center',
        fontWeight: '500',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E5E5',
    },
    dividerText: {
        color: '#666666',
        paddingHorizontal: 16,
        fontSize: 14,
    },
    socialButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 24,
        gap: 24,
    },
    socialButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 6,
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
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
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

export default LoginPage;