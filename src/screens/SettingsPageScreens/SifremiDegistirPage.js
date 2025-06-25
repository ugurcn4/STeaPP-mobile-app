import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { useSelector } from 'react-redux';
import { lightTheme, darkTheme } from '../../themes';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { translate } from '../../i18n/i18n';

const SifremiDegistirPage = ({ navigation }) => {
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Şifre kriterlerini kontrol eden değişkenler
    const [passwordCriteria, setPasswordCriteria] = useState({
        length: false,
        uppercase: false,
        number: false
    });

    // Şifre kriterleri kontrolü
    const checkPasswordCriteria = (password) => {
        const criteria = {
            length: password.length >= 6,
            uppercase: /[A-Z]/.test(password),
            number: /[0-9]/.test(password)
        };
        setPasswordCriteria(criteria);
        return criteria.length && criteria.uppercase && criteria.number;
    };

    const getErrorMessage = (errorCode) => {
        switch (errorCode) {
            case 'auth/wrong-password':
                return translate('wrong_password');
            case 'auth/too-many-requests':
                return translate('too_many_requests');
            case 'auth/requires-recent-login':
                return translate('requires_recent_login');
            case 'auth/weak-password':
                return translate('weak_password');
            case 'auth/network-request-failed':
                return translate('network_request_failed');
            case 'auth/invalid-credential':
                return translate('invalid_credential');
            case 'auth/internal-error':
                return translate('internal_error');
            default:
                return translate('unexpected_error');
        }
    };

    // Şifre değişikliğini yap
    const handleChangePassword = async () => {
        // Form validasyonu
        let hasError = false;
        const newErrors = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        };

        if (!currentPassword) {
            newErrors.currentPassword = translate('current_password_required');
            hasError = true;
        }

        if (!newPassword) {
            newErrors.newPassword = translate('new_password_required');
            hasError = true;
        } else if (!checkPasswordCriteria(newPassword)) {
            newErrors.newPassword = translate('password_criteria_not_met');
            hasError = true;
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = translate('confirm_password_required');
            hasError = true;
        } else if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = translate('passwords_not_match');
            hasError = true;
        }

        if (currentPassword === newPassword) {
            newErrors.newPassword = translate('same_password');
            hasError = true;
        }

        setErrors(newErrors);
        if (hasError) return;

        // Şifre değiştirme işlemi
        setLoading(true);
        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) {
                throw new Error(translate('session_not_found'));
            }

            if (!user.email) {
                throw new Error(translate('email_not_found'));
            }

            // Kullanıcının kimliğini doğrula
            const credential = EmailAuthProvider.credential(user.email, currentPassword);

            try {
                // Kimlik doğrulama işlemi
                await reauthenticateWithCredential(user, credential);
            } catch (error) {
                if (error.code === 'auth/wrong-password') {
                    setErrors({
                        ...errors,
                        currentPassword: translate('wrong_password')
                    });
                    throw error;
                }
                throw error;
            }

            // Şifre güncelleme
            await updatePassword(user, newPassword);

            Alert.alert(
                translate('success'),
                translate('password_changed'),
                [
                    {
                        text: translate('ok'),
                        onPress: () => {
                            // Form alanlarını temizle
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                            // Ayarlar sayfasına dön
                            navigation.goBack();
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error);

            const errorMessage = getErrorMessage(error.code);

            if (error.code === 'auth/wrong-password') {
                setErrors({
                    ...errors,
                    currentPassword: errorMessage
                });
            } else {
                Alert.alert(
                    translate('error'),
                    errorMessage,
                    [
                        {
                            text: translate('ok'),
                            onPress: () => {
                                if (error.code === 'auth/requires-recent-login') {
                                    // Kullanıcıyı giriş sayfasına yönlendir
                                    // navigation.navigate('Login');
                                }
                            }
                        }
                    ]
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.background }]}>
            <StatusBar
                backgroundColor="transparent"
                translucent
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
            />

            <LinearGradient
                colors={[currentTheme.primary + '15', currentTheme.background]}
                style={styles.gradientBackground}
            />

            <View style={styles.header}>
                <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: `${currentTheme.primary}20` }]}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={currentTheme.primary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: currentTheme.text }]}>
                    {translate('change_password_title')}
                </Text>
                <View style={styles.placeholderRight} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoid}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.container}>

                        {/* Mevcut Şifre */}
                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: currentTheme.text }]}>
                                {translate('current_password')}
                            </Text>
                            <View style={[
                                styles.inputWrapper,
                                {
                                    backgroundColor: currentTheme.cardBackground,
                                    borderColor: errors.currentPassword ? currentTheme.error : currentTheme.border
                                }
                            ]}>
                                <TextInput
                                    style={[styles.input, { color: currentTheme.text }]}
                                    placeholder={translate('enter_current_password')}
                                    placeholderTextColor={currentTheme.textSecondary}
                                    secureTextEntry={!showCurrentPassword}
                                    value={currentPassword}
                                    onChangeText={(text) => {
                                        setCurrentPassword(text);
                                        if (errors.currentPassword) setErrors({ ...errors, currentPassword: '' });
                                    }}
                                />
                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                                >
                                    <Ionicons
                                        name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                                        size={22}
                                        color={currentTheme.text}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.currentPassword ? (
                                <Text style={styles.errorText}>{errors.currentPassword}</Text>
                            ) : null}

                            {/* Şifremi Unuttum Bağlantısı */}
                            <TouchableOpacity
                                style={styles.forgotPasswordButton}
                                onPress={() => navigation.navigate('ForgotPassword')}
                            >
                                <Text style={[styles.forgotPasswordText, { color: currentTheme.primary }]}>
                                    {translate('forgot_password')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Yeni Şifre */}
                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: currentTheme.text }]}>
                                {translate('new_password')}
                            </Text>
                            <View style={[
                                styles.inputWrapper,
                                {
                                    backgroundColor: currentTheme.cardBackground,
                                    borderColor: errors.newPassword ? currentTheme.error : currentTheme.border
                                }
                            ]}>
                                <TextInput
                                    style={[styles.input, { color: currentTheme.text }]}
                                    placeholder={translate('enter_new_password')}
                                    placeholderTextColor={currentTheme.textSecondary}
                                    secureTextEntry={!showNewPassword}
                                    value={newPassword}
                                    onChangeText={(text) => {
                                        setNewPassword(text);
                                        checkPasswordCriteria(text);
                                        if (errors.newPassword) setErrors({ ...errors, newPassword: '' });
                                    }}
                                />
                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() => setShowNewPassword(!showNewPassword)}
                                >
                                    <Ionicons
                                        name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                                        size={22}
                                        color={currentTheme.text}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.newPassword ? (
                                <Text style={styles.errorText}>{errors.newPassword}</Text>
                            ) : null}

                            {/* Şifre kriterleri */}
                            <View style={styles.criteriaContainer}>
                                <View style={styles.criteriaRow}>
                                    <Ionicons
                                        name={passwordCriteria.length ? "checkmark-circle" : "checkmark-circle-outline"}
                                        size={16}
                                        color={passwordCriteria.length ? currentTheme.success : currentTheme.textSecondary}
                                    />
                                    <Text style={[
                                        styles.criteriaText,
                                        { color: passwordCriteria.length ? currentTheme.success : currentTheme.textSecondary }
                                    ]}>
                                        {translate('min_6_chars')}
                                    </Text>
                                </View>

                                <View style={styles.criteriaRow}>
                                    <Ionicons
                                        name={passwordCriteria.uppercase ? "checkmark-circle" : "checkmark-circle-outline"}
                                        size={16}
                                        color={passwordCriteria.uppercase ? currentTheme.success : currentTheme.textSecondary}
                                    />
                                    <Text style={[
                                        styles.criteriaText,
                                        { color: passwordCriteria.uppercase ? currentTheme.success : currentTheme.textSecondary }
                                    ]}>
                                        {translate('min_1_uppercase')}
                                    </Text>
                                </View>

                                <View style={styles.criteriaRow}>
                                    <Ionicons
                                        name={passwordCriteria.number ? "checkmark-circle" : "checkmark-circle-outline"}
                                        size={16}
                                        color={passwordCriteria.number ? currentTheme.success : currentTheme.textSecondary}
                                    />
                                    <Text style={[
                                        styles.criteriaText,
                                        { color: passwordCriteria.number ? currentTheme.success : currentTheme.textSecondary }
                                    ]}>
                                        {translate('min_1_number')}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Şifre Tekrar */}
                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: currentTheme.text }]}>
                                {translate('confirm_new_password')}
                            </Text>
                            <View style={[
                                styles.inputWrapper,
                                {
                                    backgroundColor: currentTheme.cardBackground,
                                    borderColor: errors.confirmPassword ? currentTheme.error : currentTheme.border
                                }
                            ]}>
                                <TextInput
                                    style={[styles.input, { color: currentTheme.text }]}
                                    placeholder={translate('enter_confirm_password')}
                                    placeholderTextColor={currentTheme.textSecondary}
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onChangeText={(text) => {
                                        setConfirmPassword(text);
                                        if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                                    }}
                                />
                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    <Ionicons
                                        name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                        size={22}
                                        color={currentTheme.text}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword ? (
                                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                            ) : null}
                        </View>

                        {/* Değiştir butonu */}
                        <TouchableOpacity
                            style={[
                                styles.changeButton,
                                {
                                    backgroundColor: '#000000',
                                    opacity: loading ? 0.9 : 1
                                }
                            ]}
                            onPress={handleChangePassword}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <View style={styles.buttonContent}>
                                    <Text style={styles.changeButtonText}>{translate('change_password_button')}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Ek bilgiler */}
                        <View style={styles.tipsContainer}>
                            <View style={styles.tipRow}>
                                <Ionicons name="alert-circle-outline" size={20} color={currentTheme.warning} />
                                <Text style={[styles.tipText, { color: currentTheme.text }]}>
                                    {translate('password_tip_1')}
                                </Text>
                            </View>
                            <View style={styles.tipRow}>
                                <Ionicons name="shield-outline" size={20} color={currentTheme.info} />
                                <Text style={[styles.tipText, { color: currentTheme.text }]}>
                                    {translate('password_tip_2')}
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 0,
        backgroundColor: 'transparent',
    },
    backButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    placeholderRight: {
        width: 40,
    },
    keyboardAvoid: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
    },
    container: {
        flex: 1,
        padding: 20,
    },
    inputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 16,
        height: 56,
        paddingHorizontal: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
    },
    input: {
        flex: 1,
        height: 56,
        fontSize: 16,
        fontWeight: '500',
    },
    eyeButton: {
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 13,
        marginTop: 6,
        marginLeft: 4,
        fontWeight: '500',
    },
    criteriaContainer: {
        marginTop: 16,
        backgroundColor: 'rgba(0,0,0,0.03)',
        padding: 16,
        borderRadius: 12,
    },
    criteriaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    criteriaText: {
        fontSize: 14,
        marginLeft: 8,
        fontWeight: '500',
    },
    changeButton: {
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 20,
        marginVertical: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    changeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    tipsContainer: {
        marginTop: 20,
        backgroundColor: 'rgba(0,0,0,0.03)',
        padding: 20,
        borderRadius: 16,
    },
    tipRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.5)',
        padding: 12,
        borderRadius: 12,
    },
    tipText: {
        marginLeft: 10,
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
    },
    forgotPasswordButton: {
        alignItems: 'flex-start',
        paddingVertical: 10,
        marginTop: 5,
    },
    forgotPasswordText: {
        fontSize: 14,
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
    gradientBackground: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 200,
        opacity: 0.5,
    },
});

export default SifremiDegistirPage; 