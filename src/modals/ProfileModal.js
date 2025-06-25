import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput } from 'react-native';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, storage } from '../../firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';
import FriendProfileModal from './friendProfileModal';
import CapsuleViewModal from './CapsuleViewModal';
import VerificationBadge from '../components/VerificationBadge';
import { checkUserVerification } from '../utils/verificationUtils';
import { sendVerificationSMS, verifyPhoneNumber, isPhoneNumberVerified } from '../utils/phoneVerificationUtils';
import { translate } from '../i18n/i18n';

const showToast = (type, text1, text2) => {
    Toast.show({
        type: type,
        text1: text1,
        text2: text2
    });
};

const ProfileModal = ({ modalVisible, setModalVisible, navigation }) => {
    const [userData, setUserData] = useState(null);
    const [imageUri, setImageUri] = useState(null);
    const [phoneModalVisible, setPhoneModalVisible] = useState(false);
    const [instaModalVisible, setInstaModalVisible] = useState(false);
    const [bioModalVisible, setBioModalVisible] = useState(false);
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [capsuleModalVisible, setCapsuleModalVisible] = useState(false);
    const [uploading, setUploading] = useState(false); // Yükleme durumu
    const [progress, setProgress] = useState(0); // Yükleme ilerlemesi
    const [verificationStep, setVerificationStep] = useState('input'); // 'input', 'verify'
    const [verificationCode, setVerificationCode] = useState('');
    const [timer, setTimer] = useState(60);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [friendProfileVisible, setFriendProfileVisible] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState({
        hasBlueTick: false,
        hasGreenTick: false
    });

    const auth = getAuth();

    const user = getAuth().currentUser;

    const [userInfo, setUserInfo] = useState({
        bio: '',
        phoneNumber: '',
        insta: '',
        profileImage: '',
    });

    useEffect(() => {
        const user = auth.currentUser;
        if (user) {
            const getUserData = async () => {
                try {
                    if (!db) {
                        await initializeFirebase();
                        db = getFirebaseDb();
                        storage = getFirebaseStorage();
                    }
                    const docRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setUserInfo(docSnap.data());
                        setUserData(docSnap.data());
                        // Doğrulama durumunu kontrol et
                        await checkVerificationStatus();
                    }
                } catch (error) {
                    console.error('Kullanıcı verileri alınırken hata:', error);
                    showToast('error', translate('error'), translate('loading_user_data_error'));
                }
            };
            getUserData();
        }
    }, [user]);

    const fetchUserData = async () => {
        const user = auth.currentUser;
        if (!user) {
            return;
        }

        try {
            if (!db) {
                await initializeFirebase();
                db = getFirebaseDb();
                storage = getFirebaseStorage();
            }
            const userDoc = doc(db, `users/${user.uid}`);
            const userSnapshot = await getDoc(userDoc);

            if (userSnapshot.exists()) {
                const userInfo = userSnapshot.data().informations || {};
                const friends = userSnapshot.data().friends || [];
                setUserData((prevData) => ({
                    ...prevData,
                    ...userInfo,
                    contact: {
                        ...(prevData?.contact || {}),
                        ...(userInfo.contact || {}),
                    },
                    friendsCount: friends.length,
                }));

                // Doğrulama durumunu kontrol et
                await checkVerificationStatus();

            } else {
                await setDoc(userDoc, { informations: { email: user.email } }, { merge: true });
                setUserData({ email: user.email, contact: {}, friendsCount: 0 });
            }
        } catch (error) {
            showToast('error', translate('error'), translate('loading_user_data_error'));
        }
    };

    useEffect(() => {
        if (modalVisible) {
            fetchUserData();
            // Doğrulama durumunu da kontrol et
            checkVerificationStatus();
        }
    }, [modalVisible]);

    // Modal kapandığında temizleme işlemleri için
    useEffect(() => {
        return () => {
            // Modal kapandığında tüm alt modalları da kapatalım
            setPhoneModalVisible(false);
            setInstaModalVisible(false);
            setBioModalVisible(false);
            setImageModalVisible(false);
            setFriendProfileVisible(false);

            // Doğrulama adımlarını sıfırlayalım
            setVerificationStep('input');
            setVerificationCode('');
            setTimer(60);
            setIsTimerActive(false);
        };
    }, []);

    const handleAddPhoneNumber = async () => {
        if (!userInfo.phoneNumber || !userInfo.phoneNumber.match(/^\d{10,}$/)) {
            showToast('error', translate('error'), translate('invalid_phone'));
            return;
        }

        try {
            if (user) {

                // Telefon numarasının doğrulanmış olup olmadığını kontrol et
                const isVerified = await isPhoneNumberVerified(userInfo.phoneNumber);

                if (!isVerified) {
                    showToast('error', translate('error'), translate('phone_not_verified'));
                    return;
                }

                // Doğrulanmış telefon numarasını kullanıcı belgesine kaydet
                const userDoc = doc(db, 'users', user.uid);
                await setDoc(userDoc, { phoneNumber: userInfo.phoneNumber, isPhoneVerified: true }, { merge: true });

                // Kullanıcı verilerini güncelle
                setUserData((prevData) => ({
                    ...prevData,
                    phoneNumber: userInfo.phoneNumber,
                    isPhoneVerified: true
                }));

                setPhoneModalVisible(false);
                showToast('success', translate('success'), translate('phone_updated'));
            }
        } catch (error) {
            console.error("Telefon numarası ekleme hatası:", error);
            showToast('error', translate('error'), translate('loading_user_data_error'));
        }
    };

    const handleAddInstaAccount = async () => {
        try {
            if (user) {
                const userDoc = doc(db, 'users', user.uid);
                await setDoc(userDoc, { insta: userInfo.insta }, { merge: true });

                setUserData((prevData) => ({
                    ...prevData,
                    insta: userInfo.insta,
                }));
                setInstaModalVisible(false);
                showToast('success', translate('success'), translate('instagram_updated'));
            }
        } catch (error) {
            showToast('error', translate('error'), translate('loading_user_data_error'));
        }
    };

    const handleUpdateBio = async () => {
        try {
            if (user) {
                const userDoc = doc(db, 'users', user.uid);
                await setDoc(userDoc, { bio: userInfo.bio }, { merge: true });

                setUserData((prevData) => ({
                    ...prevData,
                    bio: userInfo.bio,
                }));
                setBioModalVisible(false);
                showToast('success', translate('success'), translate('bio_updated'));
            }
        } catch (error) {
            showToast('error', translate('error'), translate('loading_user_data_error'));
        }
    };

    const handleChangeProfilePicture = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showToast('error', translate('permission_required'), translate('media_permission_message'));
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.3,
        });

        if (!result.canceled) {
            const { uri } = result.assets[0];
            setImageUri(uri);
            setUploading(true);
            setProgress(0);

            const user = getAuth().currentUser;
            if (user) {
                try {
                    if (!storage) {
                        await initializeFirebase();
                        storage = getFirebaseStorage();
                        db = getFirebaseDb();
                    }

                    const response = await fetch(uri);
                    const blob = await response.blob();
                    const storageRef = ref(storage, `profile_pictures/${user.uid}`);
                    const uploadTask = uploadBytesResumable(storageRef, blob);

                    uploadTask.on(
                        'state_changed',
                        (snapshot) => {
                            const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setProgress(prog);
                        },
                        (error) => {
                            showToast('error', translate('error'), translate('upload_error'));
                            setUploading(false);
                        },
                        async () => {
                            try {
                                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                                const userDoc = doc(db, `users/${user.uid}`);
                                await setDoc(userDoc, { profilePicture: downloadURL }, { merge: true });
                                setUserData((prevData) => ({
                                    ...prevData,
                                    profilePicture: downloadURL,
                                }));
                                showToast('success', translate('success'), translate('profile_picture_updated'));
                            } catch (error) {
                                showToast('error', translate('error'), translate('profile_picture_update_error'));
                            } finally {
                                setUploading(false);
                            }
                        }
                    );
                } catch (error) {
                    showToast('error', translate('error'), translate('upload_error'));
                    setUploading(false);
                }
            }
        }
    };

    const getProfileImageUri = () => {
        if (userData?.profilePicture) {
            return { uri: userData.profilePicture };
        }
        else {
            const initials = userData?.name?.slice(0, 2).toUpperCase() || "PP";
            return {
                uri: `https://ui-avatars.com/api/?name=${initials}&background=4CAF50&color=fff&size=128`,
            };
        }
    };

    const handleNavigateToFriendsPage = () => {
        setModalVisible(false);
        navigation.navigate('Arkadaşlar');
    };

    const handleShowCapsules = () => {
        setCapsuleModalVisible(true);
    };

    const handleBioChange = (text) => {
        if (text.length <= 50) {
            setUserInfo((prevData) => ({
                ...prevData,
                bio: text,
            }));
        }
    };
    const handleInstaAccountChange = (text) => {
        setUserInfo((prevData) => ({
            ...prevData,
            insta: text,
        }));
    };

    // Timer için useEffect
    useEffect(() => {
        let interval;
        if (isTimerActive && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else if (timer === 0) {
            setIsTimerActive(false);
            setTimer(60);
        }
        return () => clearInterval(interval);
    }, [isTimerActive, timer]);

    const handleSendVerificationCode = async () => {
        if (!userInfo.phoneNumber || userInfo.phoneNumber.length !== 10 || !userInfo.phoneNumber.startsWith('5')) {
            showToast('error', translate('error'), translate('invalid_phone'));
            return;
        }

        try {
            const response = await sendVerificationSMS(userInfo.phoneNumber);

            if (response.success) {
                setVerificationStep('verify');
                setIsTimerActive(true);
                setTimer(60);
                showToast('success', translate('success'), translate('verification_code_sent'));
            } else {
                showToast('error', translate('error'), response.message || translate('verification_code_error'));
            }
        } catch (error) {
            console.error("Doğrulama kodu gönderme hatası:", error);
            showToast('error', translate('error'), translate('verification_error'));
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            showToast('error', translate('error'), translate('enter_valid_code'));
            return;
        }

        try {
            const response = await verifyPhoneNumber(userInfo.phoneNumber, verificationCode);

            if (response.success) {
                await handleAddPhoneNumber();
                setVerificationStep('input');
                setVerificationCode('');
                setPhoneModalVisible(false);
                showToast('success', translate('success'), translate('phone_verified'));
            } else {
                showToast('error', translate('error'), response.message || translate('invalid_code'));
            }
        } catch (error) {
            console.error("Doğrulama hatası:", error);
            showToast('error', translate('error'), translate('verification_failed'));
        }
    };

    // Kullanıcının doğrulama durumunu kontrol et
    const checkVerificationStatus = async () => {
        if (user) {
            try {
                const verificationResult = await checkUserVerification(user.uid);
                setVerificationStatus(verificationResult);
            } catch (error) {
                console.error("Doğrulama durumu kontrol hatası:", error);
            }
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
        >
            <BlurView intensity={20} style={styles.modalContainer}>
                <Animated.View
                    entering={FadeInDown.springify()}
                    exiting={FadeOutDown.springify()}
                    style={styles.modalContent}
                >
                    {/* Header Section */}
                    <View style={styles.headerSection}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setModalVisible(false)}
                        >
                            <MaterialCommunityIcons name="close" size={24} color="#666" />
                        </TouchableOpacity>

                        <View style={styles.profileHeader}>
                            <TouchableOpacity
                                style={styles.avatarContainer}
                                onPress={() => setImageModalVisible(true)}
                            >
                                <FastImage
                                    source={getProfileImageUri()}
                                    style={styles.avatarImage}
                                    resizeMode={FastImage.resizeMode.cover}
                                />
                                <View style={styles.editIconContainer}>
                                    <MaterialCommunityIcons
                                        name="camera"
                                        size={20}
                                        color="#fff"
                                        onPress={handleChangeProfilePicture}
                                    />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.userNameContainer}>
                                <Text style={styles.userName}>{userData?.name || translate('unauthorized_user')}</Text>
                                <VerificationBadge
                                    hasBlueTick={verificationStatus.hasBlueTick}
                                    hasGreenTick={verificationStatus.hasGreenTick}
                                    size={18}
                                    style={styles.verificationBadge}
                                    showTooltip={false}
                                />
                            </View>
                            <Text style={styles.userBio}>{userInfo?.bio || translate('add_bio')}</Text>
                        </View>

                        <View style={styles.statsContainer}>
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={handleNavigateToFriendsPage}
                            >
                                <Text style={styles.statNumber}>{userData?.friendsCount || 0}</Text>
                                <Text style={styles.statLabel}>{translate('friend')}</Text>
                            </TouchableOpacity>
                            <View style={styles.statDivider} />
                            <TouchableOpacity 
                                style={styles.statItem}
                                onPress={handleShowCapsules}
                            >
                                <View style={styles.capsuleContainer}>
                                    <View style={styles.betaContainer}>
                                        <Text style={styles.betaText}>{translate('test_phase')}</Text>
                                    </View>
                                    <Text style={styles.statNumber}>10</Text>
                                    <Text style={styles.statLabel}>{translate('capsule')}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.detailedProfileButton}
                            onPress={() => {
                                setFriendProfileVisible(true);
                            }}
                        >
                            <LinearGradient
                                colors={['#4CAF50', '#45a049']}
                                style={styles.detailedProfileGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <View style={styles.detailedProfileContent}>
                                    <MaterialCommunityIcons name="account-details" size={20} color="#fff" />
                                    <Text style={styles.detailedProfileText}>{translate('detailed_profile_view')}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Info Cards Section */}
                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>{translate('contact_info')}</Text>

                        <TouchableOpacity style={styles.infoCard}>
                            <MaterialCommunityIcons name="email-outline" size={24} color="#4CAF50" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>{translate('email')}</Text>
                                <Text style={styles.infoValue}>
                                    {userData?.email || auth.currentUser?.email || ''}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.infoCard}
                            onPress={() => setPhoneModalVisible(true)}
                        >
                            <MaterialCommunityIcons name="phone-outline" size={24} color="#4CAF50" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>{translate('phone')}</Text>
                                <View style={styles.phoneInfoContainer}>
                                    <Text style={styles.infoValue}>
                                        {userInfo?.phoneNumber || translate('add_phone_number')}
                                    </Text>
                                    {userInfo?.phoneNumber && userData?.isPhoneVerified && (
                                        <View style={styles.verifiedBadge}>
                                            <MaterialCommunityIcons name="check-circle" size={16} color="#4CAF50" />
                                            <Text style={styles.verifiedText}>{translate('verified')}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.infoCard}
                            onPress={() => setInstaModalVisible(true)}
                        >
                            <MaterialCommunityIcons name="instagram" size={24} color="#4CAF50" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>{translate('instagram')}</Text>
                                <Text style={styles.infoValue}>
                                    {'@' + userInfo?.insta || translate('add_instagram')}
                                </Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.infoCard}
                            onPress={() => setBioModalVisible(true)}
                        >
                            <MaterialCommunityIcons name="text" size={24} color="#4CAF50" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>{translate('bio')}</Text>
                                <Text style={styles.infoValue}>
                                    {userInfo?.bio || translate('add_bio_action')}
                                </Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </BlurView>

            <Modal
                animationType="fade"
                transparent={true}
                visible={phoneModalVisible}
                onRequestClose={() => {
                    setPhoneModalVisible(false);
                    setVerificationStep('input');
                    setVerificationCode('');
                }}
            >
                <BlurView intensity={20} style={styles.subModalContainer}>
                    <Animated.View
                        entering={FadeInDown.springify()}
                        exiting={FadeOutDown.springify()}
                        style={styles.subModalContent}
                    >
                        <View style={styles.subModalHeader}>
                            <Text style={styles.subModalTitle}>
                                {verificationStep === 'input' ? translate('phone_number') : translate('verification_code')}
                            </Text>
                            <TouchableOpacity
                                style={styles.subModalCloseButton}
                                onPress={() => {
                                    setPhoneModalVisible(false);
                                    setVerificationStep('input');
                                    setVerificationCode('');
                                }}
                            >
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {verificationStep === 'input' ? (
                            <>
                                <View style={styles.phoneInputContainer}>
                                    <View style={styles.countryCodeContainer}>
                                        <Text style={styles.countryCodeText}>+90</Text>
                                    </View>
                                    <View style={styles.phoneNumberInputContainer}>
                                        <MaterialCommunityIcons name="phone" size={22} color="#4CAF50" />
                                        <TextInput
                                            style={styles.input}
                                            value={userInfo.phoneNumber}
                                            onChangeText={(text) => {
                                                // Sadece sayısal değer içerdiğinden emin olalım
                                                const numericValue = text.replace(/[^0-9]/g, '');
                                                setUserInfo(prev => ({ ...prev, phoneNumber: numericValue }));
                                            }}
                                            placeholder="5XX XXX XX XX"
                                            keyboardType="phone-pad"
                                            placeholderTextColor="#999"
                                            maxLength={10}
                                        />
                                    </View>
                                </View>
                                <Text style={styles.phoneInstructions}>
                                    {translate('phone_instruction')}
                                </Text>

                                <View style={styles.phoneExample}>
                                    <Text style={styles.phoneExampleText}>{translate('phone_example')}</Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleSendVerificationCode}
                                >
                                    <LinearGradient
                                        colors={['#4CAF50', '#45a049']}
                                        style={styles.saveButtonGradient}
                                    >
                                        <Text style={styles.saveButtonText}>{translate('send_verification_code')}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <View style={styles.verificationContainer}>
                                    <Text style={styles.verificationText}>
                                        <Text style={styles.boldText}>+90 {userInfo.phoneNumber}</Text> {translate('enter_verification_code')}
                                    </Text>

                                    <View style={styles.verificationCodeContainer}>
                                        <TextInput
                                            style={styles.verificationCodeInput}
                                            value={verificationCode}
                                            onChangeText={(text) => {
                                                // Sadece sayısal değer içerdiğinden emin olalım
                                                const numericValue = text.replace(/[^0-9]/g, '');
                                                setVerificationCode(numericValue);
                                            }}
                                            placeholder="- - - - - -"
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            placeholderTextColor="#999"
                                            textAlign="center"
                                        />
                                    </View>

                                    <View style={styles.verificationTip}>
                                        <MaterialCommunityIcons name="information-outline" size={16} color="#666" />
                                        <Text style={styles.verificationTipText}>
                                            {translate('verification_tip')}
                                        </Text>
                                    </View>

                                    {isTimerActive && (
                                        <View style={styles.timerContainer}>
                                            <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
                                            <Text style={styles.timerText}>
                                                {translate('remaining_time', { time: timer })}
                                            </Text>
                                        </View>
                                    )}

                                    {!isTimerActive && (
                                        <TouchableOpacity
                                            style={styles.resendButton}
                                            onPress={handleSendVerificationCode}
                                        >
                                            <MaterialCommunityIcons name="refresh" size={16} color="#4CAF50" />
                                            <Text style={styles.resendButtonText}>{translate('resend_code')}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleVerifyCode}
                                >
                                    <LinearGradient
                                        colors={['#4CAF50', '#45a049']}
                                        style={styles.saveButtonGradient}
                                    >
                                        <Text style={styles.saveButtonText}>{translate('verify')}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </>
                        )}
                    </Animated.View>
                </BlurView>
            </Modal>

            <Modal
                animationType="fade"
                transparent={true}
                visible={instaModalVisible}
                onRequestClose={() => setInstaModalVisible(false)}
            >
                <BlurView intensity={20} style={styles.subModalContainer}>
                    <Animated.View
                        entering={FadeInDown.springify()}
                        exiting={FadeOutDown.springify()}
                        style={styles.subModalContent}
                    >
                        <View style={styles.subModalHeader}>
                            <Text style={styles.subModalTitle}>{translate('instagram_account')}</Text>
                            <TouchableOpacity
                                style={styles.subModalCloseButton}
                                onPress={() => setInstaModalVisible(false)}
                            >
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="instagram" size={24} color="#4CAF50" />
                            <TextInput
                                style={styles.input}
                                value={userInfo.insta}
                                onChangeText={handleInstaAccountChange}
                                placeholder={translate('enter_instagram')}
                                placeholderTextColor="#999"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleAddInstaAccount}
                        >
                            <LinearGradient
                                colors={['#4CAF50', '#45a049']}
                                style={styles.saveButtonGradient}
                            >
                                <Text style={styles.saveButtonText}>{translate('save')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </BlurView>
            </Modal>

            <Modal
                animationType="fade"
                transparent={true}
                visible={bioModalVisible}
                onRequestClose={() => setBioModalVisible(false)}
            >
                <BlurView intensity={20} style={styles.subModalContainer}>
                    <Animated.View
                        entering={FadeInDown.springify()}
                        exiting={FadeOutDown.springify()}
                        style={styles.subModalContent}
                    >
                        <View style={styles.subModalHeader}>
                            <Text style={styles.subModalTitle}>{translate('bio_title')}</Text>
                            <TouchableOpacity
                                style={styles.subModalCloseButton}
                                onPress={() => setBioModalVisible(false)}
                            >
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.inputContainer, styles.bioInputContainer]}>
                            <MaterialCommunityIcons name="text" size={24} color="#4CAF50" style={{ marginTop: 8 }} />
                            <TextInput
                                style={[styles.input, styles.bioInput]}
                                value={userInfo.bio}
                                onChangeText={handleBioChange}
                                placeholder={translate('bio_placeholder')}
                                placeholderTextColor="#999"
                                multiline
                                maxLength={50}
                                numberOfLines={2}
                            />
                        </View>

                        <Text style={styles.characterCount}>
                            {userInfo.bio ? userInfo.bio.length : 0}/50
                        </Text>

                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleUpdateBio}
                        >
                            <LinearGradient
                                colors={['#4CAF50', '#45a049']}
                                style={styles.saveButtonGradient}
                            >
                                <Text style={styles.saveButtonText}>{translate('save')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </BlurView>
            </Modal>

            <Modal
                animationType="fade"
                transparent={true}
                visible={imageModalVisible}
                onRequestClose={() => setImageModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.imageModalContent}>
                        <TouchableOpacity style={styles.closeButtonImage} onPress={() => setImageModalVisible(false)}>
                            <Text style={styles.closeButtonTextImage}>X</Text>
                        </TouchableOpacity>
                        <FastImage
                            style={styles.largeImage}
                            source={getProfileImageUri()}
                            resizeMode={FastImage.resizeMode.contain}
                        />
                        {/* Yükleme Durumu */}
                        {uploading && (
                            <View style={styles.uploadingContainer}>
                                <Text style={styles.uploadingText}>{translate('uploading', { progress: Math.round(progress) })}</Text>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[styles.progress, { width: `${progress}%` }]} // İlerlemeyi gösteriyoruz
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            <CapsuleViewModal 
                visible={capsuleModalVisible}
                onClose={() => setCapsuleModalVisible(false)}
                userId={user?.uid}
            />

            <FriendProfileModal
                visible={friendProfileVisible}
                onClose={() => setFriendProfileVisible(false)}
                friend={{
                    id: user?.uid,
                    name: userData?.name || userInfo?.name,
                    profilePicture: userData?.profilePicture,
                    bio: userData?.bio || userInfo?.bio,
                    friends: userData?.friends || [],
                    informations: {
                        name: userData?.name || userInfo?.name || translate('unauthorized_user'),
                        username: userData?.username || userInfo?.username,
                        email: userData?.email || user?.email
                    },
                    phoneNumber: userData?.phoneNumber || userInfo?.phoneNumber,
                    insta: userData?.insta || userInfo?.insta
                }}
                navigation={navigation}
            />

        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    modalContent: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    closeButton: {
        position: 'absolute',
        right: 0,
        top: 0,
        padding: 10,
    },
    profileHeader: {
        alignItems: 'center',
        marginTop: 20,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
        position: 'relative',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
        borderWidth: 3,
        borderColor: '#4CAF50',
    },
    editIconContainer: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        backgroundColor: '#4CAF50',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    userNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 5,
    },
    userBio: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        paddingVertical: 15,
        width: '100%',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#ddd',
        marginHorizontal: 20,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 5,
    },
    infoSection: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f8f9fa',
        borderRadius: 15,
        marginBottom: 10,
    },
    infoContent: {
        flex: 1,
        marginLeft: 15,
    },
    infoLabel: {
        fontSize: 12,
        color: '#666',
    },
    infoValue: {
        fontSize: 16,
        color: '#2c3e50',
        marginTop: 2,
    },
    subModalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        padding: 20,
    },
    subModalContent: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    subModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    subModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    subModalCloseButton: {
        padding: 5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        color: '#2c3e50',
    },
    bioInput: {
        minHeight: 60,
        textAlignVertical: 'top',
        paddingTop: 8,
        paddingBottom: 8,
    },
    saveButton: {
        overflow: 'hidden',
        borderRadius: 12,
        marginTop: 10,
    },
    saveButtonGradient: {
        padding: 15,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    imageModalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
    },
    largeImage: {
        width: 300,
        height: 300,
        borderRadius: 10,
    },
    closeButtonImage: {
        position: 'absolute',
        right: -15,
        top: -20,
        backgroundColor: '#FF4C4C',
        padding: 12,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonTextImage: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 20,
    },
    uploadingContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    uploadingText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    progressBar: {
        width: '100%',
        height: 10,
        backgroundColor: '#ddd',
        borderRadius: 5,
        marginTop: 10,
    },
    progress: {
        height: '100%',
        backgroundColor: '#4CAF50',
        borderRadius: 5,
    },
    verificationContainer: {
        marginBottom: 16,
    },
    verificationText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    timerText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
        fontWeight: '500',
    },
    resendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        padding: 12,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
    },
    resendButtonText: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    characterCount: {
        fontSize: 12,
        color: '#666',
        textAlign: 'right',
        marginTop: 4,
        marginBottom: 16,
        marginRight: 8,
    },
    bioInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    detailedProfileButton: {
        width: '100%',
        marginTop: 15,
        marginBottom: 5,
        borderRadius: 15,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    detailedProfileGradient: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    detailedProfileContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    detailedProfileText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
        marginLeft: 10,
    },
    verificationBadge: {
        marginLeft: 8,
        alignSelf: 'center',
        transform: [{ translateY: -1 }]
    },
    phoneInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        padding: 4,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
    },
    verifiedText: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
    },
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
    },
    countryCodeContainer: {
        paddingHorizontal: 12,
        paddingVertical: 14,
        backgroundColor: '#4CAF50',
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
    },
    countryCodeText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    phoneNumberInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
    },
    phoneInstructions: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
        textAlign: 'center',
    },
    phoneExample: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    phoneExampleText: {
        fontSize: 14,
        color: '#666',
    },
    verificationCodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginVertical: 16,
    },
    verificationCodeInput: {
        flex: 1,
        fontSize: 24,
        letterSpacing: 8,
        color: '#2c3e50',
        textAlign: 'center',
        fontWeight: '600',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        marginBottom: 8,
        padding: 12,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
    },
    verificationTip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        padding: 10,
        backgroundColor: '#FFF9C4',
        borderRadius: 8,
    },
    verificationTipText: {
        fontSize: 13,
        color: '#666',
        marginLeft: 6,
    },
    boldText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    capsuleContainer: {
        position: 'relative',
        alignItems: 'center',
    },
    betaContainer: {
        position: 'absolute',
        top: -10,
        right: -20,
        backgroundColor: '#FF9800',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 1,
    },
    betaText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff',
    },
    statItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default ProfileModal;