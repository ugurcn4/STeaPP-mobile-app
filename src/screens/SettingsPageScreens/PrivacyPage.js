import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { lightTheme, darkTheme } from '../../themes';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { auth, db } from '../../../firebaseConfig';
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { logout, updatePrivacySettings, savePrivacySettings, updateVisibility, setAllPrivacySettings } from '../../redux/userSlice';
import Toast from 'react-native-toast-message';
import { translate } from '../../i18n/i18n';

const PrivacyPage = ({ navigation }) => {
    const dispatch = useDispatch();
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;
    const user = useSelector((state) => state.user.user) || auth.currentUser;
    const privacySettings = useSelector((state) => state.user.settings.privacySettings);
    const visibility = useSelector((state) => state.user.settings.visibility);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [password, setPassword] = useState('');
    const [deleteReason, setDeleteReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [secureTextEntry, setSecureTextEntry] = useState(true);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        if (!user?.uid) {
            const currentUser = auth.currentUser;
            if (!currentUser?.uid) {
                Alert.alert(translate('error'), translate('session_expired'));
                navigation.navigate('Login');
                return;
            }
        }

        // Firestore'dan ayarları çek
        const fetchSettings = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.settings?.privacySettings) {
                        dispatch(setAllPrivacySettings(userData.settings.privacySettings));
                    }
                }
            } catch (error) {
                console.error('Ayarlar yüklenirken hata:', error);
            }
        };

        fetchSettings();

        // Klavye olaylarını dinle
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            // Abonelikleri temizle
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, [user]);

    const getSettingMessage = (setting, value) => {
        switch (setting) {
            case 'visibility':
                return value === 'public'
                    ? translate('visibility_public')
                    : translate('visibility_private');
            case 'locationSharing':
                return value
                    ? translate('location_enabled')
                    : translate('location_disabled');
            case 'activityStatus':
                return value
                    ? translate('activity_enabled')
                    : translate('activity_disabled');
            case 'friendsList':
                return value
                    ? translate('friends_list_enabled')
                    : translate('friends_list_disabled');
            case 'searchable':
                return value
                    ? translate('search_enabled')
                    : translate('search_disabled');
            case 'dataCollection':
                return value
                    ? translate('data_collection_enabled')
                    : translate('data_collection_disabled');
            default:
                return translate('settings_updated');
        }
    };

    const showToast = (message) => {
        Toast.show({
            type: 'success',
            text1: translate('info'),
            text2: message,
            position: 'top',
            visibilityTime: 4000,
        });
    };

    const toggleSetting = async (key) => {
        if (!user?.uid) {
            Alert.alert(translate('error'), translate('user_access_error'));
            return;
        }

        const newValue = !privacySettings[key];

        dispatch(updatePrivacySettings({ setting: key, value: newValue }));

        try {
            await dispatch(savePrivacySettings({
                userId: user.uid,
                settings: {
                    ...privacySettings,
                    [key]: newValue
                }
            }));
            showToast(getSettingMessage(key, newValue));
        } catch (error) {
            console.error('Ayar güncellenirken hata:', error);
            Alert.alert(translate('error'), translate('settings_error'));
        }
    };

    const handleVisibilityChange = async (newValue) => {
        if (!user?.uid) {
            Alert.alert(translate('error'), translate('user_access_error'));
            return;
        }

        dispatch(updateVisibility(newValue));

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                'settings.visibility': newValue
            });
            showToast(getSettingMessage('visibility', newValue));
        } catch (error) {
            console.error('Görünürlük ayarı güncellenirken hata:', error);
            Alert.alert(translate('error'), translate('visibility_error'));
        }
    };

    const deleteReasons = [
        translate('reason_not_using'),
        translate('reason_privacy'),
        translate('reason_another_app'),
        translate('reason_technical'),
        translate('reason_other')
    ];

    const showDeleteConfirmation = () => {
        Alert.alert(
            translate('delete_account_title'),
            translate('delete_account_confirmation'),
            [
                {
                    text: translate('cancel'),
                    style: "cancel"
                },
                {
                    text: translate('continue'),
                    onPress: () => setDeleteModalVisible(true),
                    style: "destructive"
                }
            ]
        );
    };

    const handleDeleteAccount = async () => {
        if (!password) {
            Alert.alert(translate('error'), translate('password_required'));
            return;
        }
        if (!deleteReason) {
            Alert.alert(translate('error'), translate('reason_required'));
            return;
        }

        setLoading(true);
        try {
            const user = auth.currentUser;

            if (!user || !user.email) {
                throw new Error(translate('user_not_found'));
            }

            // Kimlik doğrulama işlemini güncelle
            try {
                const credential = EmailAuthProvider.credential(
                    user.email,
                    password
                );

                await reauthenticateWithCredential(user, credential);
            } catch (authError) {
                console.error('Kimlik doğrulama hatası:', authError);
                if (authError.code === 'auth/invalid-credential') {
                    Alert.alert(
                        translate('error'),
                        translate('wrong_password')
                    );
                } else if (authError.code === 'auth/too-many-requests') {
                    Alert.alert(
                        translate('error'),
                        translate('too_many_attempts')
                    );
                } else {
                    Alert.alert(
                        translate('error'),
                        translate('auth_failed')
                    );
                }
                setLoading(false);
                return;
            }

            // Batch işlemi başlat
            const batch = writeBatch(db);

            // Kullanıcının tüm verilerini temizle
            const collectionsToDelete = [
                'users',
                'userSettings',
                'locations',
                'shares',
                'sharedLocations',
                'liveLocations',
                'friends',
                'notifications'
            ];

            // Her bir koleksiyonda kullanıcıya ait verileri sil
            for (const collectionName of collectionsToDelete) {
                // Ana dokümanı sil
                const docRef = doc(db, collectionName, user.uid);
                batch.delete(docRef);

                // Alt koleksiyonları temizle
                const subCollections = await getDocs(
                    query(collection(db, collectionName), where('userId', '==', user.uid))
                );
                subCollections.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }

            // Arkadaşlık ilişkilerini temizle
            const friendsQuery = query(
                collection(db, 'friends'),
                where('friendId', '==', user.uid)
            );
            const friendDocs = await getDocs(friendsQuery);
            friendDocs.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Silme nedenini kaydet (istatistik için)
            const deleteReasonRef = doc(db, 'deletedAccounts', user.uid);
            batch.set(deleteReasonRef, {
                reason: deleteReason,
                timestamp: new Date().toISOString(),
                email: user.email,
                deletedAt: new Date()
            });

            // Tüm batch işlemlerini gerçekleştir
            await batch.commit();

            // Firebase Auth'dan kullanıcıyı sil
            await deleteUser(user);

            // Modal ve loading durumlarını kapat
            setDeleteModalVisible(false);
            setLoading(false);

            // Önce Redux state'i güncelle
            dispatch(logout());

            // Bilgilendirme mesajı
            Alert.alert(
                translate('account_deleted'),
                translate('account_deleted_success')
            );

        } catch (error) {
            console.error('Hesap silme hatası:', error);
            Alert.alert(
                translate('error'),
                translate('account_delete_error')
            );
            setLoading(false);
            setDeleteModalVisible(false);
        }
    };

    return (
        <>
            <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
                <View style={styles.headerContainer}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons
                            name="arrow-back"
                            size={24}
                            color={currentTheme.text}
                        />
                    </TouchableOpacity>
                    <Text style={[styles.header, { color: currentTheme.text }]}>
                        {translate('privacy_page')}
                    </Text>
                </View>

                <View style={styles.section}>
                    <View style={styles.privacyItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="person-outline" size={24} color={currentTheme.text} />
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: currentTheme.text }]}>
                                    {translate('profile_visibility')}
                                </Text>
                                <Text style={styles.settingDescription}>
                                    {translate('profile_visibility_desc')}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={visibility === 'public'}
                            onValueChange={(value) => handleVisibilityChange(value ? 'public' : 'private')}
                            trackColor={{ false: "#767577", true: "#32CD32" }}
                        />
                    </View>

                    <View style={styles.privacyItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="location-outline" size={24} color={currentTheme.text} />
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: currentTheme.text }]}>
                                    {translate('location_sharing')}
                                </Text>
                                <Text style={styles.settingDescription}>
                                    {translate('location_sharing_desc')}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={privacySettings.locationSharing}
                            onValueChange={() => toggleSetting('locationSharing')}
                            trackColor={{ false: "#767577", true: "#32CD32" }}
                        />
                    </View>

                    <View style={styles.privacyItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="radio-button-on-outline" size={24} color={currentTheme.text} />
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: currentTheme.text }]}>
                                    {translate('online_status')}
                                </Text>
                                <Text style={styles.settingDescription}>
                                    {translate('online_status_desc')}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={privacySettings.activityStatus}
                            onValueChange={() => toggleSetting('activityStatus')}
                            trackColor={{ false: "#767577", true: "#32CD32" }}
                        />
                    </View>

                    <View style={styles.privacyItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="people-outline" size={24} color={currentTheme.text} />
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: currentTheme.text }]}>
                                    {translate('friends_list')}
                                </Text>
                                <Text style={styles.settingDescription}>
                                    {translate('friends_list_desc')}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={privacySettings.friendsList}
                            onValueChange={() => toggleSetting('friendsList')}
                            trackColor={{ false: "#767577", true: "#32CD32" }}
                        />
                    </View>

                    <View style={styles.privacyItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="search-outline" size={24} color={currentTheme.text} />
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: currentTheme.text }]}>
                                    {translate('search_visibility')}
                                </Text>
                                <Text style={styles.settingDescription}>
                                    {translate('search_visibility_desc')}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={privacySettings.searchable}
                            onValueChange={() => toggleSetting('searchable')}
                            trackColor={{ false: "#767577", true: "#32CD32" }}
                        />
                    </View>

                    <View style={styles.privacyItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="analytics-outline" size={24} color={currentTheme.text} />
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: currentTheme.text }]}>
                                    {translate('data_collection')}
                                </Text>
                                <Text style={styles.settingDescription}>
                                    {translate('data_collection_desc')}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={privacySettings.dataCollection}
                            onValueChange={() => toggleSetting('dataCollection')}
                            trackColor={{ false: "#767577", true: "#32CD32" }}
                        />
                    </View>
                </View>

                <View style={styles.dangerZone}>
                    <Text style={styles.dangerZoneTitle}>{translate('danger_zone')}</Text>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={showDeleteConfirmation}
                    >
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                        <Text style={styles.deleteButtonText}>{translate('delete_account')}</Text>
                    </TouchableOpacity>
                </View>

                <Modal
                    visible={deleteModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setDeleteModalVisible(false)}
                    statusBarTranslucent={true}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalContainer}
                    >
                        <TouchableOpacity
                            style={styles.modalContainer}
                            activeOpacity={1}
                            onPress={() => {
                                Keyboard.dismiss();
                                setDeleteModalVisible(false);
                            }}
                        >
                            <View
                                style={[
                                    styles.modalView,
                                    {
                                        backgroundColor: '#FFFFFF',
                                        marginTop: keyboardVisible ? 30 : 'auto'
                                    }
                                ]}
                            >
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={(e) => e.stopPropagation()}
                                >
                                    <View style={[
                                        styles.modalContent,
                                        {
                                            backgroundColor: '#FFFFFF'
                                        }
                                    ]}>
                                        <View style={styles.modalHeader}>
                                            <Ionicons name="warning-outline" size={40} color="#FF3B30" />
                                            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>
                                                {translate('delete_account_sure')}
                                            </Text>
                                            <Text style={[styles.modalSubtitle, { color: currentTheme.textSecondary }]}>
                                                {translate('delete_account_permanent')}
                                            </Text>
                                        </View>

                                        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                                            {translate('delete_reason')}
                                        </Text>
                                        <ScrollView style={styles.reasonsContainer}>
                                            {deleteReasons.map((reason, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={[
                                                        styles.reasonButton,
                                                        { backgroundColor: currentTheme.cardBackground },
                                                        deleteReason === reason && styles.selectedReason
                                                    ]}
                                                    onPress={() => setDeleteReason(reason)}
                                                >
                                                    <View style={styles.reasonContent}>
                                                        <View style={styles.radioButton}>
                                                            <View style={deleteReason === reason ? styles.radioButtonSelected : null} />
                                                        </View>
                                                        <Text style={[
                                                            styles.reasonText,
                                                            { color: currentTheme.text }
                                                        ]}>
                                                            {reason}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>

                                        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                                            {translate('account_password')}
                                        </Text>
                                        <View style={styles.passwordContainer}>
                                            <TextInput
                                                style={[styles.passwordInput, {
                                                    backgroundColor: currentTheme.cardBackground,
                                                    borderColor: currentTheme.border,
                                                    color: currentTheme.text,
                                                    flex: 1
                                                }]}
                                                placeholder={translate('enter_password')}
                                                placeholderTextColor={currentTheme.textSecondary}
                                                secureTextEntry={secureTextEntry}
                                                value={password}
                                                onChangeText={setPassword}
                                            />
                                            <TouchableOpacity
                                                style={styles.eyeIcon}
                                                onPress={() => setSecureTextEntry(!secureTextEntry)}
                                            >
                                                <Ionicons
                                                    name={secureTextEntry ? "eye-outline" : "eye-off-outline"}
                                                    size={24}
                                                    color={currentTheme.text}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.modalButtons}>
                                            <TouchableOpacity
                                                style={[styles.modalButton, styles.cancelButton]}
                                                onPress={() => setDeleteModalVisible(false)}
                                            >
                                                <Text style={styles.cancelButtonText}>{translate('go_back')}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[
                                                    styles.modalButton,
                                                    styles.confirmButton,
                                                    !password || !deleteReason && styles.disabledButton
                                                ]}
                                                onPress={handleDeleteAccount}
                                                disabled={loading || !password || !deleteReason}
                                            >
                                                <Text style={styles.confirmButtonText}>
                                                    {loading ? translate('deleting') : translate('delete_account_btn')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </Modal>

                <Text style={[styles.note, { color: currentTheme.text }]}>
                    {translate('privacy_note')}
                </Text>
            </ScrollView>
            <Toast />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 60,
    },
    backButton: {
        padding: 10,
        marginRight: 10,
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    section: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
    },
    privacyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    textContainer: {
        marginLeft: 15,
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    settingDescription: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    note: {
        fontSize: 14,
        fontStyle: 'italic',
        marginTop: 20,
        opacity: 0.7,
        textAlign: 'center',
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    dangerZone: {
        marginTop: 30,
        padding: 20,
        borderRadius: 12,
        backgroundColor: 'rgba(255,59,48,0.1)',
    },
    dangerZoneTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FF3B30',
        marginBottom: 15,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(255,59,48,0.2)',
        borderRadius: 8,
    },
    deleteButtonText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    modalView: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 12,
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    reasonsContainer: {
        maxHeight: 200,
        marginBottom: 24,
    },
    reasonButton: {
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        backgroundColor: '#FFFFFF',
    },
    reasonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#FF3B30',
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonSelected: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF3B30',
    },
    selectedReason: {
        borderColor: '#FF3B30',
        borderWidth: 2,
    },
    reasonText: {
        fontSize: 15,
        flex: 1,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    passwordInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        backgroundColor: '#FFFFFF',
        borderColor: 'rgba(0,0,0,0.1)',
    },
    eyeIcon: {
        position: 'absolute',
        right: 16,
        height: '100%',
        justifyContent: 'center',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    confirmButton: {
        backgroundColor: '#FF3B30',
    },
    disabledButton: {
        backgroundColor: '#FF3B30',
        opacity: 0.5,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
});

export default PrivacyPage; 