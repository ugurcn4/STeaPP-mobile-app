import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    Linking,
    Alert,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { sendPasswordResetEmail } from '../redux/userSlice';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { translate } from '../i18n/i18n';

const ForgotPassword = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const dispatch = useDispatch();

    useEffect(() => {
        navigation.setOptions({
            headerShown: false
        });
    }, [navigation]);

    const handlePasswordReset = () => {
        dispatch(sendPasswordResetEmail(email))
            .unwrap()
            .then(() => {
                Toast.show({
                    type: 'success',
                    position: 'top',
                    text1: translate('success'),
                    text2: translate('forgot_password_email_sent'),
                    visibilityTime: 2000,
                    autoHide: true,
                });
                navigation.navigate(translate('login'));
            })
            .catch((error) => {
                Toast.show({
                    type: 'error',
                    position: 'top',
                    text1: translate('error'),
                    text2: translate('forgot_password_email_error'),
                    visibilityTime: 2000,
                    autoHide: true,
                });
            });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
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
                            <Text style={styles.title}>{translate('forgot_password_title')}</Text>
                            <Text style={styles.subtitle}>
                                {translate('forgot_password_subtitle')}
                            </Text>
                        </View>

                        <View style={styles.formContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder={translate('forgot_password_email_placeholder')}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor="#A0A0A0"
                            />

                            <TouchableOpacity
                                style={styles.resetButton}
                                onPress={handlePasswordReset}
                            >
                                <Text style={styles.resetButtonText}>
                                    {translate('forgot_password_reset_button')}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => navigation.goBack()}
                            >
                                <Text style={styles.backButtonText}>
                                    {translate('forgot_password_back_to_login')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.infoSection}>
                        <Text style={styles.infoTitle}>{translate('forgot_password_helpful_info')}</Text>

                        <View style={styles.infoContainer}>
                            <Ionicons name="mail-outline" size={24} color="#FF6B6B" />
                            <Text style={styles.infoText}>
                                {translate('forgot_password_info_email')}
                            </Text>
                        </View>

                        <View style={styles.infoContainer}>
                            <Ionicons name="time-outline" size={24} color="#4ECDC4" />
                            <Text style={styles.infoText}>
                                {translate('forgot_password_info_expiry')}
                            </Text>
                        </View>

                        <View style={styles.infoContainer}>
                            <Ionicons name="shield-checkmark-outline" size={24} color="#82C596" />
                            <Text style={styles.infoText}>
                                {translate('forgot_password_info_security')}
                            </Text>
                        </View>

                        <View style={styles.helpSection}>
                            <Text style={styles.helpTitle}>{translate('forgot_password_still_issues')}</Text>
                            <TouchableOpacity
                                style={styles.helpButton}
                                onPress={() => {
                                    Linking.openURL('https://sites.google.com/view/steapp-privacy-policy/destek-ekibi')
                                        .catch((err) => {
                                            console.error('Bağlantı açılamadı:', err);
                                            Alert.alert(translate('error'), translate('forgot_password_support_error'));
                                        });
                                }}
                            >
                                <Ionicons name="help-circle-outline" size={20} color="#666666" />
                                <Text style={styles.helpButtonText}>{translate('forgot_password_contact_support')}</Text>
                            </TouchableOpacity>
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
        marginBottom: 24,
    },
    resetButton: {
        height: 56,
        backgroundColor: '#FF6B6B',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    resetButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        alignItems: 'center',
        padding: 12,
    },
    backButtonText: {
        color: '#666666',
        fontSize: 14,
        fontWeight: '500',
    },
    infoSection: {
        backgroundColor: '#F8F9FF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 16,
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    infoText: {
        flex: 1,
        marginLeft: 12,
        color: '#666666',
        fontSize: 14,
        lineHeight: 20,
    },
    helpSection: {
        marginTop: 24,
        alignItems: 'center',
    },
    helpTitle: {
        fontSize: 16,
        color: '#666666',
        marginBottom: 12,
    },
    helpButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    helpButtonText: {
        color: '#666666',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },
});

export default ForgotPassword;
