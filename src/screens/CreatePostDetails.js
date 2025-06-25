import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    SafeAreaView,
    ScrollView,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    TouchableWithoutFeedback,
    Modal,
    ActivityIndicator,
    StatusBar
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import LocationPicker from '../components/LocationPicker';
import { LinearGradient } from 'expo-linear-gradient';
import { createPost } from '../services/postService';
import { useSelector } from 'react-redux';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../../firebaseConfig';
import * as MediaLibrary from 'expo-media-library';
import { translate } from '../i18n/i18n';

const { width } = Dimensions.get('window');
const MAX_INPUT_HEIGHT = 150; // Maksimum açıklama alanı yüksekliği
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const CreatePostDetails = ({ route, navigation }) => {
    const { image } = route.params;
    const { isAuth } = useSelector((state) => state.user);
    const [userData, setUserData] = useState(null);
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState(null);
    const [isPublic, setIsPublic] = useState(true);
    const [tags, setTags] = useState([]);
    const [currentTag, setCurrentTag] = useState('');
    const [, setInputHeight] = useState(60);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const auth = getAuth();
                const currentUser = auth.currentUser;

                if (!currentUser) {
                    navigation.replace('Auth');
                    return;
                }

                const db = getFirebaseDb();
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

                if (!userDoc.exists()) {
                    console.error('Kullanıcı dokümanı bulunamadı');
                    return;
                }

                const userInfo = userDoc.data();
                setUserData({
                    uid: currentUser.uid,
                    ...userInfo
                });
            } catch (error) {
                console.error('Kullanıcı bilgileri alma hatası:', error);
                alert(translate('user_data_fetch_error'));
            }
        };

        fetchUserData();
    }, [navigation]);

    useEffect(() => {
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                if (currentTag.trim()) {
                    handleAddTag();
                }
            }
        );

        return () => {
            keyboardDidHideListener.remove();
        };
    }, [currentTag]);

    const handleAddTag = () => {
        if (currentTag.trim() && !tags.includes(currentTag.trim())) {
            setTags([...tags, currentTag.trim()]);
            setCurrentTag('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleContentSizeChange = (event) => {
        const { height } = event.nativeEvent.contentSize;
        if (height <= MAX_INPUT_HEIGHT) {
            setInputHeight(height);
        }
    };

    const handleShare = async () => {
        if (!image) {
            alert(translate('select_image_required'));
            return;
        }

        if (!userData?.uid) {
            alert(translate('login_required'));
            navigation.replace('Auth');
            return;
        }

        setIsLoading(true);
        try {
            let processedImageUri = image;

            // iOS için resim işleme
            if (Platform.OS === 'ios' && image.startsWith('ph://')) {
                try {
                    const { status } = await MediaLibrary.requestPermissionsAsync();
                    if (status !== 'granted') {
                        alert(translate('gallery_permission_error'));
                        setIsLoading(false);
                        return;
                    }

                    const asset = await MediaLibrary.getAssetInfoAsync(image.replace('ph://', ''));
                    if (asset) {
                        processedImageUri = asset.localUri || asset.uri;

                        if (processedImageUri.startsWith('ph://')) {
                            const assetInfo = await MediaLibrary.createAssetAsync(image);
                            processedImageUri = assetInfo.uri;
                        }
                    }
                } catch (error) {
                    console.error('iOS resim dönüştürme hatası:', error);
                    processedImageUri = image;
                }
            }

            if (!processedImageUri) {
                throw new Error(translate('valid_image_not_found'));
            }

            const postData = {
                userId: userData.uid,
                description,
                tags,
                location,
                isPublic,
                userInfo: {
                    name: userData.informations?.name,
                    username: userData.informations?.username,
                    profilePicture: userData.informations?.profileImage
                }
            };

            await createPost(postData, processedImageUri);

            // Değiştirilmiş navigasyon kodu
            navigation.reset({
                index: 0,
                routes: [
                    {
                        name: 'MainTabs',
                        params: { screen: 'Etkinlikler', refresh: true }
                    }
                ],
            });

        } catch (error) {
            console.error('Paylaşım hatası:', error);
            alert(translate('share_error') + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLocationSelect = (selectedLocation) => {
        setLocation({
            name: selectedLocation.name,
            address: selectedLocation.address,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude
        });
        setShowLocationPicker(false);
    };

    useEffect(() => {
        if (!isAuth) {
            navigation.replace('Auth');
        }
    }, [isAuth, navigation]);

    return (
        <>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={true} />
            <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: STATUSBAR_HEIGHT,
                backgroundColor: '#fff',
                zIndex: 9999
            }} />
            <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT : 0 }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
                >
                    {/* Header */}
                    <View style={[styles.header, { marginTop: Platform.OS === 'android' ? 0 : 0 }]}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{translate('create_post_title')}</Text>
                        <TouchableOpacity
                            onPress={handleShare}
                            style={[styles.shareButton, !image && styles.shareButtonDisabled]}
                            disabled={!image || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.shareButtonText}>{translate('share')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <ScrollView
                            bounces={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Görsel Önizleme */}
                            <View style={styles.postPreviewContainer}>
                                {/* Post Header */}
                                <View style={styles.postHeader}>
                                    <View style={styles.userInfoContainer}>
                                        <FastImage
                                            source={{
                                                uri: userData?.profilePicture || 'https://ui-avatars.com/api/?name=Kullanıcı&background=random'
                                            }}
                                            style={styles.userAvatar}
                                            resizeMode={FastImage.resizeMode.cover}
                                        />
                                        <View style={styles.userTextContainer}>
                                            <Text style={styles.userName}>{userData?.informations?.name || translate('user_name')}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Post Image */}
                                <View style={styles.imageContainer}>
                                    <FastImage
                                        source={{ uri: image }}
                                        style={styles.image}
                                        resizeMode={FastImage.resizeMode.cover}
                                    />
                                    <LinearGradient
                                        colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.4)']}
                                        style={styles.imageOverlay}
                                    >
                                        <View style={styles.imageFooter}>
                                            <View style={styles.imageInfo}>
                                                <MaterialIcons name="photo-camera" size={16} color="#fff" />
                                                <Text style={styles.imageInfoText}>{translate('original')}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.imageButton}
                                                onPress={() => navigation.goBack()}
                                            >
                                                <MaterialIcons name="photo-library" size={22} color="#fff" />
                                                <Text style={styles.imageButtonText}>{translate('change')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </LinearGradient>
                                </View>

                                {/* Post Footer Preview */}
                                <View style={styles.postFooterPreview}>
                                    <View style={styles.postActions}>
                                        <View style={styles.actionButton}>
                                            <MaterialIcons name="favorite-border" size={24} color="#666" />
                                            <Text style={styles.actionText}>0</Text>
                                        </View>
                                        <View style={styles.actionButton}>
                                            <MaterialIcons name="chat-bubble-outline" size={24} color="#666" />
                                            <Text style={styles.actionText}>0</Text>
                                        </View>
                                        <View style={styles.actionButton}>
                                            <MaterialIcons name="share" size={24} color="#666" />
                                        </View>
                                    </View>
                                    <Text style={styles.postPreviewDescription}>
                                        {description ? description : translate('description_preview')}
                                    </Text>
                                    {location && (
                                        <View style={styles.locationPreview}>
                                            <MaterialIcons name="location-on" size={16} color="#2196F3" />
                                            <Text style={styles.locationText}>{location.name}</Text>
                                        </View>
                                    )}
                                    {tags.length > 0 && (
                                        <View style={styles.tagsPreview}>
                                            {tags.map((tag, index) => (
                                                <Text key={index} style={styles.tagPreview}>#{tag}</Text>
                                            ))}
                                        </View>
                                    )}
                                    <Text style={styles.timePreview}>{translate('now')}</Text>
                                </View>
                            </View>

                            {/* İçerik Alanı */}
                            <View style={styles.contentContainer}>
                                <Text style={styles.sectionTitle}>{translate('post_details')}</Text>

                                {/* Açıklama */}
                                <View style={styles.inputContainer}>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                minHeight: 60,
                                                maxHeight: MAX_INPUT_HEIGHT
                                            }
                                        ]}
                                        placeholder={translate('add_description')}
                                        value={description}
                                        onChangeText={setDescription}
                                        multiline
                                        maxLength={2200}
                                        placeholderTextColor="#666"
                                        onContentSizeChange={handleContentSizeChange}
                                        scrollEnabled={true}
                                    />
                                    <Text style={styles.charCount}>
                                        {description.length}/2200
                                    </Text>
                                </View>

                                {/* Etiketler */}
                                <View style={styles.tagsContainer}>
                                    <View style={styles.tagInput}>
                                        <Text style={styles.hashTag}>#</Text>
                                        <TextInput
                                            style={styles.tagInputField}
                                            placeholder={translate('add_tag')}
                                            value={currentTag}
                                            onChangeText={text => setCurrentTag(text.replace(/\s+/g, ''))}
                                            onSubmitEditing={handleAddTag}
                                            returnKeyType="done"
                                            maxLength={30}
                                            placeholderTextColor="#666"
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.tagsScroll}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {tags.map((tag, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.tag}
                                                onPress={() => handleRemoveTag(tag)}
                                            >
                                                <Text style={styles.tagText}>#{tag}</Text>
                                                <Ionicons name="close-circle" size={16} color="#666" />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Konum */}
                                <TouchableOpacity
                                    style={styles.optionButton}
                                    onPress={() => setShowLocationPicker(true)}
                                >
                                    <MaterialIcons name="location-on" size={24} color="#666" />
                                    <Text style={styles.optionText}>
                                        {location ? location.name : translate('add_location')}
                                    </Text>
                                    <MaterialIcons name="chevron-right" size={24} color="#666" />
                                </TouchableOpacity>

                                {/* Konum seçici modal */}
                                <Modal
                                    visible={showLocationPicker}
                                    animationType="slide"
                                    transparent={true}
                                    onRequestClose={() => setShowLocationPicker(false)}
                                >
                                    <TouchableOpacity
                                        style={styles.modalOverlay}
                                        activeOpacity={1}
                                        onPress={() => setShowLocationPicker(false)}
                                    >
                                        <TouchableOpacity
                                            style={styles.modalContent}
                                            activeOpacity={1}
                                            onPress={e => e.stopPropagation()}
                                        >
                                            <LocationPicker
                                                onSelect={handleLocationSelect}
                                                onClose={() => setShowLocationPicker(false)}
                                            />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                </Modal>

                                {/* Gizlilik Ayarı */}
                                <View style={styles.privacyContainer}>
                                    <Text style={styles.privacyTitle}>{translate('who_can_see')}</Text>
                                    <TouchableOpacity
                                        style={[
                                            styles.privacyOption,
                                            isPublic && styles.privacyOptionSelected
                                        ]}
                                        onPress={() => setIsPublic(true)}
                                    >
                                        <View style={styles.privacyIconContainer}>
                                            <MaterialIcons
                                                name="public"
                                                size={24}
                                                color={isPublic ? "#2196F3" : "#666"}
                                            />
                                        </View>
                                        <View style={styles.privacyTextContainer}>
                                            <Text style={[
                                                styles.privacyOptionTitle,
                                                isPublic && styles.privacyOptionTitleSelected
                                            ]}>
                                                {translate('public')}
                                            </Text>
                                            <Text style={styles.privacyOptionDescription}>
                                                {translate('public_description')}
                                            </Text>
                                        </View>
                                        <MaterialIcons
                                            name={isPublic ? "radio-button-checked" : "radio-button-unchecked"}
                                            size={24}
                                            color={isPublic ? "#2196F3" : "#666"}
                                        />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.privacyOption,
                                            !isPublic && styles.privacyOptionSelected
                                        ]}
                                        onPress={() => setIsPublic(false)}
                                    >
                                        <View style={styles.privacyIconContainer}>
                                            <MaterialIcons
                                                name="people"
                                                size={24}
                                                color={!isPublic ? "#2196F3" : "#666"}
                                            />
                                        </View>
                                        <View style={styles.privacyTextContainer}>
                                            <Text style={[
                                                styles.privacyOptionTitle,
                                                !isPublic && styles.privacyOptionTitleSelected
                                            ]}>
                                                {translate('friends_only')}
                                            </Text>
                                            <Text style={styles.privacyOptionDescription}>
                                                {translate('friends_only_description')}
                                            </Text>
                                        </View>
                                        <MaterialIcons
                                            name={!isPublic ? "radio-button-checked" : "radio-button-unchecked"}
                                            size={24}
                                            color={!isPublic ? "#2196F3" : "#666"}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    shareButton: {
        backgroundColor: '#2196F3',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    shareButtonDisabled: {
        backgroundColor: '#ccc',
    },
    shareButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    postPreviewContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        marginHorizontal: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 8,
    },
    userTextContainer: {
        flexDirection: 'column',
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    imageContainer: {
        width: '100%',
        height: width,
        backgroundColor: '#f5f5f5',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
        padding: 16,
    },
    imageFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    imageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    imageInfoText: {
        color: '#fff',
        marginLeft: 6,
        fontSize: 12,
    },
    imageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    imageButtonText: {
        color: '#fff',
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '500',
    },
    postFooterPreview: {
        padding: 12,
    },
    postActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    actionText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 4,
    },
    postPreviewDescription: {
        fontSize: 15,
        color: '#333',
        marginBottom: 8,
    },
    locationPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    locationText: {
        fontSize: 14,
        color: '#2196F3',
        marginLeft: 4,
    },
    tagsPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: 8,
    },
    tagPreview: {
        fontSize: 14,
        color: '#2196F3',
        marginRight: 8,
    },
    timePreview: {
        fontSize: 12,
        color: '#999',
        marginTop: 8,
    },
    contentContainer: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginHorizontal: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 16,
    },
    inputContainer: {
        marginBottom: 8,
    },
    input: {
        fontSize: 16,
        textAlignVertical: 'top',
        color: '#333',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
    },
    charCount: {
        fontSize: 12,
        color: '#666',
        textAlign: 'right',
        marginTop: 4,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    optionText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: '#333',
    },
    tagsContainer: {
        marginBottom: 16,
    },
    tagInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    hashTag: {
        fontSize: 16,
        color: '#2196F3',
        marginRight: 4,
    },
    tagInputField: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        paddingVertical: 8,
    },
    tagsScroll: {
        flexGrow: 0,
        marginBottom: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginRight: 8,
    },
    tagText: {
        color: '#2196F3',
        marginRight: 4,
        fontSize: 14,
    },
    privacyContainer: {
        marginTop: 16,
        backgroundColor: '#fff',
    },
    privacyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    privacyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        marginBottom: 8,
    },
    privacyOptionSelected: {
        backgroundColor: '#e3f2fd',
        borderColor: '#2196F3',
        borderWidth: 1,
    },
    privacyIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    privacyTextContainer: {
        flex: 1,
    },
    privacyOptionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    privacyOptionTitleSelected: {
        color: '#2196F3',
    },
    privacyOptionDescription: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        height: '75%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
});

export default CreatePostDetails; 