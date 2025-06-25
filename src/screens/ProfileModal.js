// ProfileModal.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity, TextInput,
    Alert,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import FastImage from 'react-native-fast-image';

const ProfileModal = ({ route, navigation }) => {
    const { modalVisible } = route.params || { modalVisible: false };
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [userData, setUserData] = useState({
        username: '',
        bio: '',
        phone: '',
        instagram: '',
        website: '',
        profilePicture: null
    });
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [originalData, setOriginalData] = useState({});
    const [hasChanges, setHasChanges] = useState(false);
    const [usernameError, setUsernameError] = useState('');

    const auth = getAuth();

    useEffect(() => {
        fetchUserData();
    }, []);

    useEffect(() => {
        // Değişiklikleri kontrol et
        const checkChanges = () => {
            for (const key in userData) {
                if (userData[key] !== originalData[key]) {
                    return true;
                }
            }
            return false;
        };

        setHasChanges(checkChanges());
    }, [userData, originalData]);

    const fetchUserData = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (user) {
                // Kullanıcı bilgilerini al
                const userDoc = doc(db, `users/${user.uid}`);
                const userSnapshot = await getDoc(userDoc);
                const userData = userSnapshot.exists() ? userSnapshot.data() : {};

                // İletişim bilgilerini al
                const contactDoc = doc(db, `users/${user.uid}/informations/contact`);
                const contactSnapshot = await getDoc(contactDoc);
                const contactData = contactSnapshot.exists() ? contactSnapshot.data() : {};

                // Kullanıcı bilgilerini birleştir
                // İsim değil kullanıcı adını kullanıyoruz
                const username = userData.informations?.username || userData.informations?.name || '';

                const combinedData = {
                    username: username,
                    bio: userData.bio || '',
                    phone: contactData.phone || '',
                    instagram: userData.insta || '',
                    website: userData.website || '',
                    profilePicture: userData.profilePicture || null
                };

                setUserData(combinedData);
                setOriginalData(combinedData);

                // Kullanıcı adını doğrula
                validateUsername(username);
            }
        } catch (error) {
            console.error('Kullanıcı verileri getirilirken hata oluştu:', error);
            Alert.alert('Hata', 'Kullanıcı bilgileri yüklenirken bir sorun oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        setUserData(prev => ({ ...prev, [field]: value }));

        // Kullanıcı adı doğrulama işlemi
        if (field === 'username') {
            validateUsername(value);
        }
    };

    // Kullanıcı adı doğrulama
    const validateUsername = (username) => {
        // Boş kontrol
        if (!username || username.trim() === '') {
            setUsernameError('');
            return true; // Başlangıçta boş ise hata gösterme
        }

        // Boşluk kontrolü
        if (username.includes(' ')) {
            setUsernameError('Kullanıcı adı boşluk içeremez');
            return false;
        }

        // Türkçe karakterler ve diğer geçerli karakterler için regex
        const usernameRegex = /^[a-zA-ZğĞüÜşŞıİöÖçÇ0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            if (username.length < 3) {
                setUsernameError('Kullanıcı adı en az 3 karakter olmalıdır');
            } else if (username.length > 20) {
                setUsernameError('Kullanıcı adı en fazla 20 karakter olmalıdır');
            } else {
                setUsernameError('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir');
            }
            return false;
        }

        setUsernameError('');
        return true;
    };

    const handleSave = async () => {
        if (!hasChanges) return;

        // Kullanıcı adı doğrulama kontrolü
        if (!validateUsername(userData.username)) {
            Alert.alert('Hata', 'Lütfen geçerli bir kullanıcı adı girin');
            return;
        }

        setSaving(true);
        try {
            const user = auth.currentUser;
            if (user) {
                // Kullanıcı bilgilerini güncelle
                const userDoc = doc(db, `users/${user.uid}`);

                // Bilgileri birleştir ve güncelle
                await updateDoc(userDoc, {
                    profilePicture: userData.profilePicture,
                    bio: userData.bio,
                    'informations.name': userData.username, // İsim olarak kullanıcı adını ayarla
                    'informations.username': userData.username
                });

                // İletişim bilgilerini güncelle
                const contactDoc = doc(db, `users/${user.uid}/informations/contact`);
                await setDoc(contactDoc, {
                    phone: userData.phone,
                    instagram: userData.instagram,
                    website: userData.website
                }, { merge: true });

                Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi.');
                setOriginalData(userData);
                navigation.goBack();
            }
        } catch (error) {
            console.error('Profil güncellenirken hata oluştu:', error);
            Alert.alert('Hata', 'Profil bilgileriniz güncellenirken bir sorun oluştu.');
        } finally {
            setSaving(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.granted === false) {
                Alert.alert('İzin Gerekli', 'Galeriye erişim izni vermeniz gerekiyor.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedImage = result.assets[0];
                await uploadImage(selectedImage.uri);
            }
        } catch (error) {
            console.error('Resim seçilirken hata oluştu:', error);
            Alert.alert('Hata', 'Resim seçilirken bir sorun oluştu.');
        }
    };

    const uploadImage = async (uri) => {
        setIsUploading(true);
        setUploadProgress(0);

        try {
            const response = await fetch(uri);
            const blob = await response.blob();

            const storage = getStorage();
            const user = auth.currentUser;
            const storageRef = ref(storage, `profilePictures/${user.uid}/${Date.now()}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Resim yüklenirken hata oluştu:', error);
                    Alert.alert('Hata', 'Resim yüklenirken bir sorun oluştu.');
                    setIsUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setUserData(prev => ({ ...prev, profilePicture: downloadURL }));
                    setIsUploading(false);
                }
            );
        } catch (error) {
            console.error('Resim yüklenirken hata oluştu:', error);
            Alert.alert('Hata', 'Resim yüklenirken bir sorun oluştu.');
            setIsUploading(false);
        }
    };

    const getProfileImageSource = () => {
        if (userData.profilePicture) {
            return {
                uri: userData.profilePicture,
                priority: FastImage.priority.normal,
                cache: FastImage.cacheControl.immutable
            };
        } else {
            // Kullanıcı adının ilk iki harfini al
            const initials = (userData.username || "")
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

            // UI Avatars API'sini kullanarak kullanıcı adı baş harfleri ile avatar oluştur
            return {
                uri: `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=256&bold=true`,
                priority: FastImage.priority.normal,
                cache: FastImage.cacheControl.web
            };
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#25D220" />
                <Text style={styles.loadingText}>Profil bilgileri yükleniyor...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => {
                            if (hasChanges) {
                                Alert.alert(
                                    'Değişiklikler Kaydedilmedi',
                                    'Yaptığınız değişiklikler kaydedilmedi. Çıkmak istediğinize emin misiniz?',
                                    [
                                        { text: 'İptal', style: 'cancel' },
                                        { text: 'Çık', onPress: () => navigation.goBack() }
                                    ]
                                );
                            } else {
                                navigation.goBack();
                            }
                        }}
                    >
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profili Düzenle</Text>
                    <TouchableOpacity
                        style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.saveButtonText}>Kaydet</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.profileImageSection}>
                        <View style={styles.profileImageContainer}>
                            {isUploading ? (
                                <View style={styles.uploadingContainer}>
                                    <ActivityIndicator size="large" color="#25D220" />
                                    <Text style={styles.uploadingText}>{Math.round(uploadProgress)}%</Text>
                                </View>
                            ) : (
                                <>
                                    <FastImage
                                        source={getProfileImageSource()}
                                        style={styles.profileImage}
                                        resizeMode={FastImage.resizeMode.cover}
                                    />
                                    <View style={styles.onlineIndicator} />
                                </>
                            )}
                            <TouchableOpacity
                                style={styles.editImageButton}
                                onPress={handlePickImage}
                                disabled={isUploading}
                            >
                                <Ionicons name="camera" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Kullanıcı Adı</Text>
                            <TextInput
                                style={[styles.input, usernameError ? styles.inputError : null]}
                                value={userData.username}
                                onChangeText={(text) => handleInputChange('username', text)}
                                placeholder="Kullanıcı adınızı girin"
                                placeholderTextColor="#999"
                                autoCapitalize="none"
                            />
                            {usernameError ? (
                                <Text style={styles.errorText}>{usernameError}</Text>
                            ) : (
                                <Text style={styles.inputHelperText}>
                                    Bu kullanıcı adı profilinizde görünecektir. Apple ile giriş yapan kullanıcılar burada adını düzenleyebilir.
                                </Text>
                            )}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Biyografi</Text>
                            <TextInput
                                style={[styles.input, styles.bioInput]}
                                value={userData.bio}
                                onChangeText={(text) => handleInputChange('bio', text)}
                                placeholder="Kendiniz hakkında kısa bir bilgi girin"
                                placeholderTextColor="#999"
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.sectionDivider}>
                            <Text style={styles.sectionTitle}>İletişim Bilgileri</Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Telefon</Text>
                            <View style={styles.inputWithIcon}>
                                <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.iconInput}
                                    value={userData.phone}
                                    onChangeText={(text) => handleInputChange('phone', text)}
                                    placeholder="Telefon numaranızı girin"
                                    placeholderTextColor="#999"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Instagram</Text>
                            <View style={styles.inputWithIcon}>
                                <Ionicons name="logo-instagram" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.iconInput}
                                    value={userData.instagram}
                                    onChangeText={(text) => handleInputChange('instagram', text)}
                                    placeholder="Instagram kullanıcı adınızı girin"
                                    placeholderTextColor="#999"
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Web Sitesi</Text>
                            <View style={styles.inputWithIcon}>
                                <Ionicons name="globe-outline" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.iconInput}
                                    value={userData.website}
                                    onChangeText={(text) => handleInputChange('website', text)}
                                    placeholder="Web sitenizi girin"
                                    placeholderTextColor="#999"
                                    autoCapitalize="none"
                                    keyboardType="url"
                                />
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
        backgroundColor: '#fff',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    saveButton: {
        backgroundColor: '#25D220',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveButtonDisabled: {
        backgroundColor: '#ccc',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    profileImageSection: {
        alignItems: 'center',
        paddingVertical: 24,
        position: 'relative',
    },
    profileImageContainer: {
        position: 'relative',
        width: 120,
        height: 120,
        marginBottom: 8,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        borderWidth: 3,
        borderColor: '#25D220',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#25D220',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    uploadingContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    uploadingText: {
        color: '#fff',
        fontWeight: 'bold',
        marginTop: 8,
    },
    editImageButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#25D220',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    formSection: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#333',
    },
    bioInput: {
        height: 100,
        paddingTop: 12,
    },
    sectionDivider: {
        marginVertical: 16,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    iconInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#333',
    },
    inputError: {
        borderColor: '#FF3B30',
    },
    errorText: {
        fontSize: 12,
        color: '#FF3B30',
        marginTop: 4,
    },
    inputHelperText: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
        fontStyle: 'italic',
    },
});

export default ProfileModal;