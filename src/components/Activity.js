import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, TouchableWithoutFeedback, Animated, Alert, Modal, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FastImage from 'react-native-fast-image';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import CommentsModal from './CommentsModal';
import { subscribeToPost, deletePost, toggleArchivePost, createArchiveGroup, updatePostArchiveGroups, fetchArchiveGroups, quickSavePost } from '../services/postService';
import ArchiveGroupModal from '../modals/ArchiveGroupModal';
import Toast from 'react-native-toast-message';
import FriendProfileModal from '../modals/friendProfileModal';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import ZoomableImage from './ZoomableImage';
import VerificationBadge from '../components/VerificationBadge';
import { checkUserVerification } from '../utils/verificationUtils';
import { translate } from '../i18n/i18n';

const { width } = Dimensions.get('window');

const Activity = ({ activity, onLikePress, onCommentPress, isLiked, currentUserId, onUpdate, onDelete, navigation }) => {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);
    const [isLikedByModalVisible, setIsLikedByModalVisible] = useState(false);
    const maxLength = 100; // Maksimum karakter sayısı
    const [localLiked, setLocalLiked] = useState(isLiked);
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [heartPosition, setHeartPosition] = useState({ x: 0, y: 0 });
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const [lastTap, setLastTap] = useState(null);
    const DOUBLE_TAP_DELAY = 300; // milisaniye cinsinden çift tıklama aralığı
    const [showOptions, setShowOptions] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const isOwner = activity.userId === currentUserId;
    const [isArchived, setIsArchived] = useState(activity.archivedBy?.includes(currentUserId));
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [archiveGroups, setArchiveGroups] = useState([]);
    const [selectedGroups, setSelectedGroups] = useState(activity.archiveGroups || []);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [friendModalVisible, setFriendModalVisible] = useState(false);
    const [likedByUsers, setLikedByUsers] = useState([]);
    const [loadingLikedBy, setLoadingLikedBy] = useState(false);
    const [isImageZoomed, setIsImageZoomed] = useState(false);
    const [userVerification, setUserVerification] = useState({ hasBlueTick: false, hasGreenTick: false });

    useEffect(() => {
        setLocalLiked(isLiked);
    }, [isLiked]);

    useEffect(() => {
        // Post'u gerçek zamanlı dinle
        const unsubscribe = subscribeToPost(activity.id, (updatedPost) => {
            if (onUpdate) {
                onUpdate(updatedPost);
            }
        });

        return () => unsubscribe();
    }, [activity.id]);

    useEffect(() => {
        if (showArchiveModal) {
            loadArchiveGroups();
        }
    }, [showArchiveModal]);

    useEffect(() => {
        if (activity.userId) {
            const fetchUserVerification = async () => {
                try {
                    const verificationStatus = await checkUserVerification(activity.userId);
                    setUserVerification(verificationStatus);
                } catch (error) {
                    console.error('Kullanıcı doğrulama durumu kontrolünde hata:', error);
                    setUserVerification({ hasBlueTick: false, hasGreenTick: false });
                }
            };

            fetchUserVerification();
        }
    }, [activity.userId]);

    const handleLikePress = useCallback(() => {
        setLocalLiked(!localLiked);
        onLikePress();
    }, [localLiked, onLikePress]);

    const handleUserPress = useCallback(() => {
        if (activity.user) {
            // Kullanıcı verisini daha kapsamlı hazırlayalım
            const completeUserData = {
                ...activity.user,
                id: activity.userId || activity.user.id,
                name: activity.user.name || translate('activity_unnamed_user'),
                profilePicture: activity.user.profilePicture || activity.user.avatar || null,
                bio: activity.user.bio || activity.user.informations?.bio || '',
                friends: activity.user.friends || [],
                informations: {
                    ...(activity.user.informations || {}),
                    name: activity.user.name || activity.user.informations?.name || translate('activity_unnamed_user'),
                    username: activity.user.username ||
                        activity.user.informations?.username ||
                        (activity.user.name || activity.user.informations?.name || translate('activity_user')).toLowerCase().replace(/\s+/g, '_'),
                    bio: activity.user.bio || activity.user.informations?.bio || ''
                }
            };

            // Kullanıcının tam bilgilerini Firestore'dan alalım
            fetchCompleteUserData(completeUserData);
        }
    }, [activity.user, activity.userId]);

    const handleCommentUserPress = (user) => {
        if (user) {
            const completeUserData = {
                ...user,
                id: user.id,
                name: user.name || translate('activity_unnamed_user'),
                profilePicture: user.profilePicture || user.avatar || null,
                bio: user.bio || user.informations?.bio || '',
                friends: user.friends || [],
                informations: {
                    ...(user.informations || {}),
                    name: user.name || user.informations?.name || translate('activity_unnamed_user'),
                    username: user.username ||
                        user.informations?.username ||
                        (user.name || user.informations?.name || translate('activity_user')).toLowerCase().replace(/\s+/g, '_'),
                    bio: user.bio || user.informations?.bio || ''
                }
            };

            // Kullanıcının tam bilgilerini Firestore'dan alalım
            fetchCompleteUserData(completeUserData);
        }
    };

    // Kullanıcının tam bilgilerini Firestore'dan alan yeni fonksiyon
    const fetchCompleteUserData = async (userData) => {
        try {
            if (!userData.id) {
                setSelectedFriend(userData);
                setFriendModalVisible(true);
                return;
            }

            const userDoc = await getDoc(doc(db, 'users', userData.id));
            if (userDoc.exists()) {
                const firebaseUserData = userDoc.data();

                // Mevcut verilerle Firestore verilerini birleştir
                const mergedUserData = {
                    ...userData,
                    profilePicture: userData.profilePicture || firebaseUserData.profilePicture || null,
                    bio: userData.bio || firebaseUserData.bio || firebaseUserData.informations?.bio || '',
                    friends: firebaseUserData.friends || [],
                    informations: {
                        ...(userData.informations || {}),
                        ...(firebaseUserData.informations || {}),
                        name: userData.name || firebaseUserData.informations?.name || translate('activity_unnamed_user'),
                        username: userData.informations?.username ||
                            firebaseUserData.informations?.username ||
                            (userData.name || firebaseUserData.informations?.name || translate('activity_user')).toLowerCase().replace(/\s+/g, '_'),
                        bio: userData.bio || firebaseUserData.bio || firebaseUserData.informations?.bio || ''
                    }
                };

                setSelectedFriend(mergedUserData);
            } else {
                // Firestore'da kullanıcı bulunamadıysa mevcut verileri kullan
                setSelectedFriend(userData);
            }

            setFriendModalVisible(true);
        } catch (error) {
            console.error('Kullanıcı bilgileri alınırken hata:', error);
            // Hata durumunda mevcut verileri kullan
            setSelectedFriend(userData);
            setFriendModalVisible(true);
        }
    };


    const renderDescription = () => {
        if (!activity.description) return null;

        if (activity.description.length <= maxLength || isDescriptionExpanded) {
            return (
                <View style={styles.descriptionContainer}>
                    <View style={styles.userNameVerificationRow}>
                        <Text style={styles.username}>{activity.user.name}</Text>
                        <VerificationBadge
                            hasBlueTick={userVerification.hasBlueTick}
                            hasGreenTick={userVerification.hasGreenTick}
                            size={14}
                            style={styles.verificationBadgeInline}
                        />
                        <Text style={styles.descriptionText}>{activity.description}</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.descriptionContainer}>
                <View style={styles.userNameVerificationRow}>
                    <Text style={styles.username}>{activity.user.name}</Text>
                    <VerificationBadge
                        hasBlueTick={userVerification.hasBlueTick}
                        hasGreenTick={userVerification.hasGreenTick}
                        size={14}
                        style={styles.verificationBadgeInline}
                    />
                    <Text style={styles.descriptionText}>
                        {activity.description.slice(0, maxLength)}...
                        <Text
                            style={styles.seeMore}
                            onPress={() => setIsDescriptionExpanded(true)}
                        > {translate('activity_see_more')}</Text>
                    </Text>
                </View>
            </View>
        );
    };

    const renderComments = () => {
        if (!activity.comments || activity.comments.length === 0) return null;

        return (
            <View style={styles.commentsContainer}>
                {activity.comments.slice(0, 2).map((comment, index) => (
                    <View key={comment.id} style={styles.commentItem}>
                        <View style={styles.userNameVerificationRow}>
                            <Text
                                style={styles.commentUsername}
                                onPress={() => handleCommentUserPress(comment.user)}
                            >
                                {comment.user?.name || translate('activity_user')}
                            </Text>
                            {/* Sadece yorum gönderen kişi gönderi sahibiyse rozeti göster */}
                            {comment.userId === activity.userId && (
                                <VerificationBadge
                                    hasBlueTick={userVerification.hasBlueTick}
                                    hasGreenTick={userVerification.hasGreenTick}
                                    size={12}
                                    style={styles.verificationBadgeInline}
                                />
                            )}
                            <Text style={styles.commentText}>{comment.text}</Text>
                        </View>
                    </View>
                ))}
                {activity.comments.length > 2 && (
                    <TouchableOpacity onPress={handleCommentPress}>
                        <Text style={styles.viewAllComments}>
                            {activity.comments.length} {translate('activity_view_all_comments')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const handleCommentPress = () => {
        setIsCommentsModalVisible(true);
    };

    const handleCloseComments = () => {
        setIsCommentsModalVisible(false);
    };

    const handleAddComment = (comment, replyToId) => {
        onCommentPress(comment, replyToId);
    };

    const handleDeleteComment = async (commentId) => {
        try {
            // Silme işlemini parent komponente ilet
            await onCommentPress('delete', commentId);
        } catch (error) {
            console.error('Yorum silme hatası:', error);
        }
    };

    const handleImagePress = (event) => {
        const now = Date.now();

        if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
            // Çift tıklama algılandı
            setLastTap(null); // Reset

            // Tıklama pozisyonunu kaydet
            const locationX = event.nativeEvent.locationX || event.nativeEvent.x || 0;
            const locationY = event.nativeEvent.locationY || event.nativeEvent.y || 0;

            setHeartPosition({
                x: locationX,
                y: locationY
            });

            // Kalp animasyonunu göster
            setShowHeartAnimation(true);

            // Opaklık ve ölçek animasyonlarını başlat
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 200,
                        delay: 500,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 3,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 0,
                        duration: 200,
                        delay: 500,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start(() => {
                setShowHeartAnimation(false);
                scaleAnim.setValue(0);
            });

            // Beğenilmemişse beğeni işlemini gerçekleştir
            if (!localLiked) {
                handleLikePress();
            }
        } else {
            setLastTap(now);
        }
    };

    const handleOptionsPress = (event) => {
        // Butonun konumunu al
        const { pageX, pageY } = event.nativeEvent;
        setMenuPosition({ x: pageX, y: pageY });
        setShowOptions(true);
    };

    const handleDeletePress = () => {
        setShowOptions(false);
        Alert.alert(
            translate('activity_delete_post'),
            translate('activity_delete_confirm'),
            [
                {
                    text: translate('cancel'),
                    style: 'cancel'
                },
                {
                    text: translate('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deletePost(activity.id);
                            if (onDelete) {
                                onDelete(activity.id);
                            }
                        } catch (error) {
                            Alert.alert(translate('error'), error.message);
                        }
                    }
                }
            ]
        );
    };

    const handleArchivePress = async () => {
        if (isSaving) return; // Çift tıklamayı önle

        try {
            setIsSaving(true);

            // Eğer zaten arşivlenmişse, arşivden kaldır
            if (isArchived) {
                // Arşivden kaldırma işlemi
                await toggleArchivePost(activity.id, currentUserId);

                // UI'ı güncelle
                setIsArchived(false);
                setSelectedGroups([]);

                // Başarılı kaldırma bildirimi göster
                Toast.show({
                    type: 'success',
                    text1: translate('activity_removed_from_saved'),
                    position: 'bottom',
                    visibilityTime: 2000,
                });
            } else {
                // Yeni kaydetme işlemi
                const defaultCollection = await quickSavePost(activity.id, currentUserId);

                // UI'ı güncelle
                setIsArchived(true);
                setSelectedGroups([defaultCollection.id]);

                // Başarılı kaydetme bildirimi göster
                Toast.show({
                    type: 'success',
                    text1: translate('activity_saved'),
                    text2: `"${defaultCollection.name}" ${translate('activity_added_to_collection')}`,
                    position: 'bottom',
                    visibilityTime: 2000,
                });
            }
        } catch (error) {
            console.error('Kaydetme/kaldırma hatası:', error);
            Toast.show({
                type: 'error',
                text1: translate('error'),
                text2: translate('activity_operation_error'),
                position: 'bottom',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchiveLongPress = () => {
        setShowArchiveModal(true);
    };

    const loadArchiveGroups = async () => {
        try {
            const groups = await fetchArchiveGroups(currentUserId);
            setArchiveGroups(groups);
            setSelectedGroups(activity.archiveGroups || []);
        } catch (error) {
            console.error('Arşiv grupları yüklenirken hata:', error);
        }
    };

    const handleCreateGroup = async (groupData) => {
        try {
            const newGroup = await createArchiveGroup(currentUserId, groupData);
            // Yeni grubu state'e ekle
            setArchiveGroups(prev => [...prev, newGroup]);
            return newGroup; // Oluşturulan grubu dön
        } catch (error) {
            console.error('Grup oluşturma hatası:', error);
            throw error; // Hatayı yukarı ilet
        }
    };

    const handleSaveArchiveGroups = async (groupIds) => {
        try {
            if (!Array.isArray(groupIds)) {
                console.error('Geçersiz grup ID listesi');
                return;
            }

            // 1. Grup bilgisini güncelle
            await updatePostArchiveGroups(activity.id, currentUserId, groupIds);

            // 2. UI'ı güncelle
            setIsArchived(true);
            setSelectedGroups(groupIds);

            // 3. Modal'ı kapat
            setShowArchiveModal(false);
        } catch (error) {
            console.error('Arşivleme hatası:', error);
            Alert.alert(translate('error'), translate('activity_collection_save_error'));
        }
    };

    const fetchGroups = async () => {
        try {
            const groups = await fetchArchiveGroups(currentUserId);
            setArchiveGroups(groups);
        } catch (error) {
            console.error('Grupları getirme hatası:', error);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    // Beğenenleri yükle
    const fetchLikedByUsers = async () => {
        if (!activity.likedBy || activity.likedBy.length === 0) return;

        try {
            setLoadingLikedBy(true);
            const userPromises = activity.likedBy.map(userId =>
                getDoc(doc(db, 'users', userId))
            );

            const userDocs = await Promise.all(userPromises);
            const usersData = userDocs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(user => user.informations); // Geçerli kullanıcıları filtrele

            // Doğrulama durumlarını al
            const verificationPromises = usersData.map(async (user) => {
                try {
                    const verificationStatus = await checkUserVerification(user.id);
                    return {
                        ...user,
                        verification: verificationStatus
                    };
                } catch (error) {
                    console.error('Kullanıcı doğrulama durumu kontrolünde hata:', error);
                    return {
                        ...user,
                        verification: { hasBlueTick: false, hasGreenTick: false }
                    };
                }
            });

            const usersWithVerification = await Promise.all(verificationPromises);
            setLikedByUsers(usersWithVerification);
        } catch (error) {
            console.error('Beğenen kullanıcılar yüklenirken hata:', error);
        } finally {
            setLoadingLikedBy(false);
        }
    };

    // Modal açıldığında beğenenleri yükle
    useEffect(() => {
        if (isLikedByModalVisible) {
            fetchLikedByUsers();
        }
    }, [isLikedByModalVisible]);

    // Beğenenler listesi için optimize edilmiş render item
    const renderLikedByItem = useCallback(({ item }) => (
        <TouchableOpacity
            style={styles.likedByUserItem}
            onPress={() => {
                const completeUserData = {
                    ...item,
                    name: item.informations?.name || translate('activity_unnamed_user'),
                    informations: {
                        ...item.informations,
                        username: item.informations?.username || item.informations?.name?.toLowerCase().replace(/\s+/g, '_') || 'kullanici'
                    }
                };
                setSelectedFriend(completeUserData);
                setIsLikedByModalVisible(false);
                setFriendModalVisible(true);
            }}
        >
            <FastImage
                source={{
                    uri: item.profilePicture || 'https://via.placeholder.com/100',
                    priority: FastImage.priority.normal,
                    cache: FastImage.cacheControl.immutable,
                }}
                style={styles.likedByUserAvatar}
            />
            <View style={styles.likedByUserInfo}>
                <View style={styles.likedByUserNameRow}>
                    <Text style={styles.likedByUserName}>{item.informations?.name || translate('activity_unnamed_user')}</Text>
                    {item.verification && (
                        <VerificationBadge
                            hasBlueTick={item.verification.hasBlueTick}
                            hasGreenTick={item.verification.hasGreenTick}
                            size={12}
                            style={styles.verificationBadgeLiker}
                        />
                    )}
                </View>
                {item.informations?.username && (
                    <Text style={styles.likedByUserUsername}>@{item.informations.username}</Text>
                )}
            </View>
        </TouchableOpacity>
    ), []);

    return (
        <View style={styles.activityCard}>
            <View style={styles.activityHeader}>
                <View style={styles.userInfoContainer}>
                    <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
                        <FastImage
                            source={{
                                uri: activity.user?.avatar || 'https://via.placeholder.com/40',
                                priority: FastImage.priority.high,
                                cache: FastImage.cacheControl.immutable,
                            }}
                            style={styles.avatarImage}
                        />
                        <View style={styles.userTextContainer}>
                            <View style={styles.userNameVerificationRow}>
                                <Text style={styles.username}>{activity.user?.name || translate('activity_unnamed_user')}</Text>

                                <VerificationBadge
                                    hasBlueTick={userVerification.hasBlueTick}
                                    hasGreenTick={userVerification.hasGreenTick}
                                    size={14}
                                    style={styles.verificationBadge}
                                />

                                {/* Konum bilgisini kullanıcı adının yanına taşıyalım */}
                                {activity.location && (
                                    <View style={styles.headerLocationContainer}>
                                        <Ionicons name="location-outline" size={12} color="#2196F3" />
                                        <Text
                                            style={styles.headerLocationText}
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                        >
                                            {typeof activity.location === 'object'
                                                ? (activity.location.name || activity.location.address || translate('activity_location'))
                                                : activity.location}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.timestamp}>
                                {formatDistanceToNow(activity.createdAt, { addSuffix: true, locale: tr })}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.optionsButton}
                    onPress={handleOptionsPress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
                </TouchableOpacity>
            </View>

            <TouchableWithoutFeedback onPress={handleImagePress}>
                <View style={styles.imageContainer}>
                    <ZoomableImage
                        source={{ 
                            uri: activity.imageUrl,
                            priority: FastImage.priority.normal,
                            cache: FastImage.cacheControl.immutable,
                        }}
                        style={styles.activityImage}
                        resizeMode={FastImage.resizeMode.cover}
                        onDoubleTap={handleImagePress}
                        onZoomChange={setIsImageZoomed}
                    >
                        {showHeartAnimation && (
                            <Animated.View
                                style={[
                                    styles.heartAnimation,
                                    {
                                        left: heartPosition.x - 50,
                                        top: heartPosition.y - 50,
                                        opacity: fadeAnim,
                                        transform: [
                                            { scale: scaleAnim }
                                        ]
                                    }
                                ]}
                                pointerEvents="none"
                            >
                                <Ionicons name="heart" size={100} color="#fff" />
                            </Animated.View>
                        )}
                    </ZoomableImage>
                </View>
            </TouchableWithoutFeedback>

            <View style={styles.contentContainer}>
                <View style={styles.interactionContainer}>
                    <View style={styles.leftInteractions}>
                        <View style={styles.likeContainer}>
                            <TouchableOpacity
                                style={[styles.likeButton, localLiked && styles.likeButtonActive]}
                                onPress={handleLikePress}
                            >
                                <Ionicons
                                    name={localLiked ? "heart" : "heart-outline"}
                                    size={24}
                                    color={localLiked ? "#E91E63" : "#666"}
                                />
                            </TouchableOpacity>

                            <View style={styles.likeDivider} />

                            <TouchableOpacity
                                style={styles.likeCountButton}
                                onPress={() => setIsLikedByModalVisible(true)}
                            >
                                <Text style={[
                                    styles.interactionCount,
                                    localLiked && styles.interactionCountActive
                                ]}>
                                    {activity.stats?.likes || 0}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.commentContainer}>
                            <TouchableOpacity
                                style={styles.commentButton}
                                onPress={() => setIsCommentsModalVisible(true)}
                            >
                                <Ionicons
                                    name="chatbubble-outline"
                                    size={22}
                                    color="#2196F3"
                                />
                            </TouchableOpacity>

                            <View style={styles.commentDivider} />

                            <TouchableOpacity
                                style={styles.commentCountButton}
                                onPress={() => setIsCommentsModalVisible(true)}
                            >
                                <Text style={styles.interactionCount}>
                                    {activity.stats?.comments || 0}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.bookmarkButton}
                        onPress={handleArchivePress}
                        onLongPress={handleArchiveLongPress}
                        delayLongPress={500}
                        disabled={isSaving}
                    >
                        <Ionicons
                            name={isArchived ? "bookmark" : "bookmark-outline"}
                            size={22}
                            color={isArchived ? "#2196F3" : "#666"}
                        />
                    </TouchableOpacity>
                </View>

                {/* Yeni beğeni özeti bölümü */}
                {activity.likedBy && activity.likedBy.length > 0 && (
                    <View style={styles.likeSummaryContainer}>
                        <TouchableOpacity
                            onPress={() => setIsLikedByModalVisible(true)}
                        >
                            <Text style={styles.likeSummaryTextLight}>
                                {(() => {
                                    // Tek beğeni varsa
                                    if (activity.likedBy.length === 1) {
                                        if (activity.likedBy[0] === currentUserId) {
                                            return (
                                                <Text>
                                                    <Text style={styles.likeSummaryTextBold}>{translate('activity_you')}</Text>
                                                    <Text style={styles.likeSummaryTextLight}> {translate('activity_liked')}</Text>
                                                </Text>
                                            );
                                        }

                                        // Burada düzeltme yapalım
                                        return (
                                            <Text>
                                                <Text
                                                    style={styles.likeSummaryTextBold}
                                                    onPress={(e) => {
                                                        e.stopPropagation(); // Üst TouchableOpacity'nin tetiklenmesini engelle
                                                        handleCommentUserPress(activity.user);
                                                    }}
                                                >
                                                    {activity.user?.name || translate('activity_user')}
                                                </Text>
                                                <Text style={styles.likeSummaryTextLight}> {translate('activity_liked_by_other')}</Text>
                                            </Text>
                                        );
                                    }

                                    // Birden fazla beğeni varsa
                                    const isCurrentUserFirst = activity.likedBy[0] === currentUserId;
                                    const firstLiker = isCurrentUserFirst ? translate('activity_you') : (activity.firstLikerName || activity.user?.name || translate('activity_user'));
                                    const otherCount = activity.likedBy.length - 1;

                                    return (
                                        <Text>
                                            <Text style={styles.likeSummaryTextBold}>{firstLiker}</Text>
                                            <Text style={styles.likeSummaryTextLight}> {translate('activity_and')} </Text>
                                            <Text style={styles.likeSummaryTextBold}>{translate('activity_other_people', {count: otherCount})}</Text>
                                            <Text style={styles.likeSummaryTextLight}> {translate('activity_liked_by_other')}</Text>
                                        </Text>
                                    );
                                })()}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Konum bilgisini içerik alanına ekleyelim */}
                {activity.location && (
                    <View style={styles.locationContainer}>
                        <Ionicons name="location-outline" size={16} color="#2196F3" />
                        <Text style={styles.locationText}>
                            {typeof activity.location === 'object'
                                ? (activity.location.name || activity.location.address || 'Konum')
                                : activity.location}
                        </Text>
                    </View>
                )}

                <View style={styles.descriptionContainer}>
                    {renderDescription()}
                </View>

                {activity.tags && activity.tags.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.tagsContainer}
                    >
                        {activity.tags.map((tag, index) => (
                            <View key={index} style={styles.tagContainer}>
                                <Text style={styles.tag}>#{tag}</Text>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Yorumlar bölümü */}
                {renderComments()}
            </View>

            <CommentsModal
                visible={isCommentsModalVisible}
                onClose={handleCloseComments}
                comments={activity.comments || []}
                onAddComment={handleAddComment}
                currentUserId={currentUserId}
                postUserId={activity.userId}
                onDelete={handleDeleteComment}
            />

            {/* Context Menu Modal */}
            <Modal
                visible={showOptions}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowOptions(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOptions(false)}
                >
                    <View style={[
                        styles.contextMenu,
                        {
                            position: 'absolute',
                            right: width - menuPosition.x + 10,
                            top: menuPosition.y - 20,
                        }
                    ]}>
                        {isOwner && (
                            <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={handleDeletePress}
                            >
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                <Text style={styles.contextMenuTextDelete}>Sil</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.contextMenuItem}
                            onPress={() => setShowOptions(false)}
                        >
                            <Ionicons name="close-outline" size={20} color="#666" />
                            <Text style={styles.contextMenuTextCancel}>Kapat</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            <ArchiveGroupModal
                visible={showArchiveModal}
                onClose={() => setShowArchiveModal(false)}
                archiveGroups={archiveGroups}
                selectedGroups={selectedGroups}
                onSelectGroups={setSelectedGroups}
                onCreateGroup={handleCreateGroup}
                onSave={handleSaveArchiveGroups}
                userId={currentUserId}
                onGroupsUpdated={fetchGroups}
            />
            <FriendProfileModal
                visible={friendModalVisible}
                onClose={() => setFriendModalVisible(false)}
                friend={selectedFriend}
                navigation={navigation}
            />
            <Modal
                visible={isLikedByModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsLikedByModalVisible(false)}
                statusBarTranslucent={true}
                presentationStyle="overFullScreen"
            >
                <TouchableOpacity
                    style={styles.likedByModalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsLikedByModalVisible(false)}
                >
                    <View style={styles.likedByModalContainer}>
                        <View style={styles.likedByModalHeader}>
                            <TouchableOpacity
                                style={styles.likedByModalCloseButton}
                                onPress={() => setIsLikedByModalVisible(false)}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                            <Text style={styles.likedByModalTitle}>Beğenenler</Text>
                            <View style={styles.likedByModalHeaderRight} />
                        </View>

                        {loadingLikedBy ? (
                            <View style={styles.likedByModalLoading}>
                                <ActivityIndicator size="large" color="#2196F3" />
                            </View>
                        ) : (
                            <FlashList
                                data={likedByUsers}
                                keyExtractor={item => item.id}
                                renderItem={renderLikedByItem}
                                estimatedItemSize={64}
                                contentContainerStyle={styles.likedByModalList}
                                showsVerticalScrollIndicator={false}
                                drawDistance={400}
                                overrideItemLayout={(layout, item) => {
                                    layout.size = 64;
                                }}
                                style={styles.likedByListContainer}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    activityCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 0,
        shadowColor: "transparent",
        shadowOffset: {
            width: 0,
            height: 0,
        },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingBottom: 8,
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 2,
        borderColor: '#E91E63',
    },
    userTextContainer: {
        flexDirection: 'column',
    },
    userNameVerificationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    username: {
        fontWeight: '700',
        fontSize: 15,
        color: '#262626',
    },
    timestamp: {
        fontSize: 12,
        color: '#8E8E8E',
        marginTop: 2,
    },
    imageContainer: {
        position: 'relative',
        height: width, // Kare görüntü için
        overflow: 'visible', // Görüntünün dışarı çıkmasına izin ver
        zIndex: 10, // Diğer öğelerin üzerinde görünmesi için
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        shadowColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
    },
    activityImage: {
        width: width,
        height: width,
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
    },
    imageGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 0, // Yüksekliği 0 yaparak görünmez hale getirin
        opacity: 0, // Opaklığı 0 yaparak görünmez hale getirin
    },
    contentContainer: {
        padding: 16,
    },
    interactionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    leftInteractions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    interactionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        padding: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 6,
    },
    interactionCount: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        marginLeft: 4,
    },
    interactionCountActive: {
        color: '#E91E63',
    },
    description: {
        fontSize: 14,
        color: '#262626',
        lineHeight: 20,
    },
    seeMore: {
        color: '#8E8E8E',
        fontWeight: '600',
    },
    descriptionContainer: {
        marginVertical: 8,
        paddingHorizontal: 4,
    },
    descriptionNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    verificationBadgeSm: {
        marginLeft: 4,
        marginRight: 6,
    },
    verificationBadgeInline: {
        marginHorizontal: 6,
    },
    descriptionText: {
        fontSize: 14,
        color: '#262626',
        lineHeight: 20,
        alignSelf: 'center',
    },
    tagsContainer: {
        flexDirection: 'row',
        marginTop: 8,
    },
    tagContainer: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
    },
    tag: {
        fontSize: 13,
        color: '#2196F3',
        fontWeight: '500',
    },
    bookmarkButton: {
        padding: 4,
    },
    commentsContainer: {
        marginTop: 8,
        paddingHorizontal: 4,
    },
    commentItem: {
        marginVertical: 2,
    },
    commentNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    commentUsername: {
        fontWeight: '600',
        color: '#262626',
    },
    commentText: {
        fontSize: 14,
        color: '#262626',
        lineHeight: 18,
        alignSelf: 'center',
    },
    viewAllComments: {
        color: '#8E8E8E',
        fontSize: 14,
        marginTop: 4,
    },
    heartAnimation: {
        position: 'absolute',
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        pointerEvents: 'none',
    },
    optionsButton: {
        padding: 8,
        marginLeft: 'auto',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    contextMenu: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 4,
        minWidth: 120,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        maxWidth: width - 32,
    },
    contextMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 6,
    },
    contextMenuTextDelete: {
        color: '#FF3B30',
        fontSize: 15,
        marginLeft: 8,
        fontWeight: '500',
    },
    contextMenuTextCancel: {
        color: '#666',
        fontSize: 15,
        marginLeft: 8,
        fontWeight: '500',
    },
    likeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        padding: 4,
    },
    likeButton: {
        padding: 8,
        borderRadius: 16,
    },
    likeButtonActive: {
        backgroundColor: '#FFE8EC',
    },
    likeDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#ddd',
        marginHorizontal: 4,
    },
    likeCountButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 16,
    },
    commentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        padding: 4,
    },
    commentButton: {
        padding: 8,
        borderRadius: 16,
    },
    commentDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#ddd',
        marginHorizontal: 4,
    },
    commentCountButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 16,
    },
    likeSummaryContainer: {
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginTop: -4,
    },
    likeSummaryTextLight: {
        fontSize: 14,
        color: '#666',
        fontWeight: '400',
    },
    likeSummaryTextBold: {
        fontSize: 14,
        color: '#262626',
        fontWeight: '600',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    likeSummaryButton: {
        padding: 8,
        borderRadius: 16,
        backgroundColor: '#F5F5F5',
    },
    likedByModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    likedByModalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 12,
        height: 500,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -3,
        },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 10,
        flex: 1,
    },
    likedByModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginBottom: 8,
    },
    likedByModalCloseButton: {
        padding: 8,
    },
    likedByModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    likedByModalHeaderRight: {
        flex: 1,
    },
    likedByModalLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    likedByUserItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    likedByUserAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    likedByUserInfo: {
        flexDirection: 'column',
    },
    likedByUserNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    likedByUserName: {
        fontWeight: 'bold',
    },
    likedByUserUsername: {
        fontSize: 12,
        color: '#8E8E8E',
    },
    verificationBadge: {
        marginLeft: 4,
    },
    headerLocationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    headerLocationText: {
        marginLeft: 4,
        fontSize: 12,
        color: '#2196F3',
        fontWeight: '500',
        maxWidth: 80,
    },
    verificationBadgeComment: {
        marginLeft: 4,
    },
    verificationBadgeLiker: {
        marginLeft: 4,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 10,
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    locationText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#2196F3',
        fontWeight: '600',
    },
    likedByModalList: {
        flexGrow: 1,
        paddingHorizontal: 4,
    },
    likedByListContainer: {
        flex: 1,
        width: '100%',
    },
});

export default React.memo(Activity, (prevProps, nextProps) => {
    // Özel memoization karşılaştırması (gereksiz render'ları önlemek için)
    return (
        prevProps.activity.id === nextProps.activity.id &&
        prevProps.isLiked === nextProps.isLiked &&
        prevProps.currentUserId === nextProps.currentUserId &&
        // Yorumlar ve beğeniler değiştiyse render edilmeli
        prevProps.activity.stats?.likes === nextProps.activity.stats?.likes &&
        prevProps.activity.stats?.comments === nextProps.activity.stats?.comments &&
        prevProps.activity.comments?.length === nextProps.activity.comments?.length &&
        // Arşivleme durumu değiştiyse render edilmeli
        JSON.stringify(prevProps.activity.archivedBy) === JSON.stringify(nextProps.activity.archivedBy) &&
        // Beğenenler listesi değiştiyse render edilmeli
        JSON.stringify(prevProps.activity.likedBy) === JSON.stringify(nextProps.activity.likedBy)
    );
});