import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback, ScrollView,
    Platform,
    FlatList, Alert,
    SafeAreaView,
    ActionSheetIOS,
    Share,
    Clipboard,
    TextInput, Animated,
    Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUserUid, sendFriendRequest, acceptFriendRequest, removeFriend } from '../services/friendFunctions';
import { db } from '../../firebaseConfig';
import FastImage from 'react-native-fast-image';
import { toggleLikePost, addComment, deleteComment } from '../services/postService';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, arrayUnion, arrayRemove, addDoc } from 'firebase/firestore';
import PostDetailModal from './PostDetailModal';
import Toast from 'react-native-toast-message';
import VerificationBadge from '../components/VerificationBadge';
import { checkUserVerification } from '../utils/verificationUtils';
import styles from '../styles/friendProfileModalStyle';

// Shimmer animasyonu bileşeni - performans için hafif bir shimmer efekti
const ShimmerEffect = ({ width, height, style }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true // Native driver kullanarak performansı artırıyoruz
            })
        ).start();
    }, []);

    const translateX = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width]
    });

    return (
        <View style={[{ width, height, overflow: 'hidden', backgroundColor: '#e0e0e0' }, style]}>
            <Animated.View
                style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#f5f5f5',
                    position: 'absolute',
                    opacity: 0.5,
                    transform: [{ translateX }]
                }}
            />
        </View>
    );
};

// Post grid için yer tutucu bileşen - Performans için React.memo ile optimize edildi
const PostGridSkeleton = React.memo(() => {
    // 3x3 grid için 9 adet yer tutucu
    const skeletonItems = Array.from({ length: 9 }, (_, i) => i);
    
    return (
        <FlatList
            data={skeletonItems}
            numColumns={3}
            renderItem={({ index }) => (
                <View style={styles.postSkeletonItem}>
                    <ShimmerEffect
                        width={styles.postItem.width}
                        height={styles.postItem.width}
                        style={{ borderRadius: 4 }}
                    />
                </View>
            )}
            keyExtractor={item => `post-skeleton-${item}`}
            scrollEnabled={false}
            contentContainerStyle={styles.postsGrid}
            removeClippedSubviews={false}
        />
    );
});

// Android için ActionSheet alternatifi
const CustomActionSheet = ({ options, cancelButtonIndex, destructiveButtonIndex, onPress, visible, onDismiss }) => {
    if (!visible) return null;

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="slide"
            onRequestClose={onDismiss}
        >
            <TouchableOpacity
                style={styles.actionSheetOverlay}
                activeOpacity={1}
                onPress={onDismiss}
            >
                <View style={styles.actionSheetContainer}>
                    {options.map((option, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.actionSheetItem,
                                index === destructiveButtonIndex && styles.actionSheetDestructive,
                                index === cancelButtonIndex && styles.actionSheetCancel
                            ]}
                            onPress={() => {
                                onDismiss();
                                onPress(index);
                            }}
                        >
                            <Text
                                style={[
                                    styles.actionSheetItemText,
                                    index === destructiveButtonIndex && styles.actionSheetDestructiveText
                                ]}
                            >
                                {option}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

// PostItem bileşeni - memo ile optimize edildi
const PostItem = memo(({ item, onPress }) => {
    return (
        <TouchableOpacity
            style={styles.postItem}
            onPress={onPress}
        >
            <FastImage
                source={{
                    uri: item.imageUrl,
                    priority: FastImage.priority.normal,
                    cache: FastImage.cacheControl.immutable
                }}
                style={styles.postImage}
                resizeMode={FastImage.resizeMode.cover}
                cacheKey={item.id}
            />
        </TouchableOpacity>
    );
});

const FriendProfileModal = ({ visible, onClose, friend, navigation }) => {
    const [friendshipStatus, setFriendshipStatus] = useState('none');
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const listRef = useRef(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [isProfilePrivate, setIsProfilePrivate] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');
    const [likedPosts, setLikedPosts] = useState([]);
    const [loadingLikedPosts, setLoadingLikedPosts] = useState(false);
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [isOwnProfile, setIsOwnProfile] = useState(false);
    const [profileImageModalVisible, setProfileImageModalVisible] = useState(false);
    const [friendsListModalVisible, setFriendsListModalVisible] = useState(false);
    const [friendsList, setFriendsList] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [canViewFriends, setCanViewFriends] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredFriendsList, setFilteredFriendsList] = useState([]);
    const [verificationStatus, setVerificationStatus] = useState({
        hasBlueTick: false,
        hasGreenTick: false
    });
    // Post detail modal için kapanma durumunu takip eden ref
    const isDetailModalClosingRef = useRef(false);

    // Optimize edilmiş renderlama fonksiyonları
    // Buradaki tanımlamaları bileşenin içine taşıyoruz, global tanımları siliyoruz
    const renderPostItem = useCallback(({ item }) => {
        return (
            <PostItem 
                item={item} 
                onPress={() => setSelectedPost(item)} 
            />
        );
    }, []);

    const keyExtractor = useCallback((item) => item.id, []);

    const getItemLayout = useCallback((data, index) => ({
        length: styles.postItem.width,
        offset: styles.postItem.width * index,
        index
    }), []);

    const renderFriendItem = useCallback(({ item }) => (
        <View style={styles.friendsModalListItem}>
            {/* Avatar */}
            <View style={styles.friendsModalListItemAvatarContainer}>
                {item.profilePicture ? (
                    <FastImage
                        source={{
                            uri: item.profilePicture,
                            priority: FastImage.priority.normal,
                            cache: FastImage.cacheControl.immutable
                        }}
                        style={styles.friendsModalListItemAvatar}
                    />
                ) : (
                    <View style={styles.friendsModalListItemAvatarPlaceholder}>
                        <Text style={styles.friendsModalListItemInitial}>
                            {(item.name || '').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>
            {/* User info */}
            <View style={styles.friendsModalListItemInfo}>
                <Text style={styles.friendsModalListItemName} numberOfLines={1} ellipsizeMode="tail">
                    {item.name}
                </Text>
            </View>
        </View>
    ), []);

    const getFriendItemLayout = useCallback((data, index) => ({
        length: 64, // Her öğenin yüksekliği
        offset: 64 * index,
        index
    }), []);

    // Post listesi FlatList'i için düzeltmeler
    const renderPostsListMemo = useCallback((postsList) => {
        if (postsList.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons 
                        name={activeTab === 'posts' ? "images-outline" : "heart-outline"} 
                        size={48} 
                        color="#ccc" 
                    />
                    <Text style={styles.emptyText}>
                        {activeTab === 'posts' ? 'Henüz paylaşım yok' : 'Henüz beğenilen paylaşım yok'}
                    </Text>
                </View>
            );
        }

        return (
            <FlatList
                data={postsList}
                renderItem={renderPostItem}
                keyExtractor={keyExtractor}
                numColumns={3}
                scrollEnabled={false}
                contentContainerStyle={styles.postsGrid}
                removeClippedSubviews={true}
                maxToRenderPerBatch={5}
                initialNumToRender={9}
                windowSize={5}
                updateCellsBatchingPeriod={50}
                getItemLayout={getItemLayout}
            />
        );
    }, [activeTab, renderPostItem, keyExtractor, getItemLayout]);

    useEffect(() => {
        if (friend && visible) {
            fetchFriendshipStatus();
            fetchFriendPosts();
            getCurrentUserUid().then(uid => {
                setCurrentUserId(uid);
                setIsOwnProfile(uid === friend.id);
                checkBlockStatus(uid);
                checkNotificationStatus(uid);
            });
            checkProfileVisibility();
            checkFriendsListPermission();
            checkVerificationStatus();
        }
    }, [friend?.id, visible]);

    useEffect(() => {
        if (friend && visible && activeTab === 'likes' && friendshipStatus === 'friend') {
            fetchLikedPosts();
        }
    }, [friend?.id, visible, activeTab, friendshipStatus]);

    useEffect(() => {
        if (!visible) {
            // Ref değerini tanımlamak için renderDetailModal'den bir referans alalım,
            // o yüzden bu useEffect içinde doğrudan modal state'lerini sıfırlamak yerine
            // bir gecikme kullanacağız
            
            // iOS'da modalların temizlenmesi için ekstra gecikme
            const delay = Platform.OS === 'ios' ? 500 : 300;
            
            const timeoutId = setTimeout(() => {
                // Tüm alt modalların kapanmasını sağla
                setSelectedPost(null);
                setProfileImageModalVisible(false);
                setFriendsListModalVisible(false);
            }, delay);
            
            // Timeout'u temizle
            return () => clearTimeout(timeoutId);
        }

        // Bileşen değiştirildiğinde ya da kaldırıldığında temizleme işlemi
        return () => {
            if (!visible) {
                setSelectedPost(null);
                setLoading(false);
                setLoadingPosts(false);
                setLoadingLikedPosts(false);
                setActionSheetVisible(false);
                setProfileImageModalVisible(false);
                setFriendsListModalVisible(false);
            }
        };
    }, [visible]);

    useEffect(() => {
        // Arama sorgusu değiştiğinde arkadaş listesini filtrele
        if (friendsList.length > 0) {
            if (searchQuery.trim() === '') {
                setFilteredFriendsList(friendsList);
            } else {
                const lowerCaseQuery = searchQuery.toLowerCase().trim();
                const filtered = friendsList.filter(friend =>
                    (friend.name && friend.name.toLowerCase().includes(lowerCaseQuery)) ||
                    (friend.username && friend.username.toLowerCase().includes(lowerCaseQuery))
                );
                setFilteredFriendsList(filtered);
            }
        } else {
            setFilteredFriendsList([]);
        }
    }, [searchQuery, friendsList]);

    // Bildirimden gelen selectedPostId'yi kontrol et
    useEffect(() => {
        if (friend?.selectedPostId && posts.length > 0) {
            const postToShow = posts.find(post => post.id === friend.selectedPostId);
            if (postToShow) {
                setSelectedPost(postToShow);
            }
        }
    }, [friend?.selectedPostId, posts]);

    const checkProfileVisibility = async () => {
        if (!friend?.id) return;

        try {
            const friendDoc = await getDoc(doc(db, 'users', friend.id));
            const friendData = friendDoc.data() || {};
            const visibility = friendData.settings?.visibility || 'public';

            const currentUserId = await getCurrentUserUid();
            const userDoc = await getDoc(doc(db, 'users', currentUserId));
            const userFriends = userDoc.data()?.friends || [];

            const isFriend = userFriends.includes(friend.id);

            // Profil gizli ve arkadaş değilse ve kendi profili değilse
            setIsProfilePrivate(visibility === 'private' && !isFriend && friend.id !== currentUserId);
        } catch (error) {
            console.error('Profil görünürlüğü kontrol hatası:', error);
        }
    };

    const checkFriendshipStatus = async (userId, otherUserId) => {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data();

            if (userData.friends?.includes(otherUserId)) {
                return 'friend';
            }

            if (userData.friendRequests?.sent?.includes(otherUserId)) {
                return 'pending';
            }

            if (userData.friendRequests?.received?.includes(otherUserId)) {
                return 'received';
            }

            return 'none';
        } catch (error) {
            console.error('Arkadaşlık durumu kontrol hatası:', error);
            return 'none';
        }
    };

    const fetchFriendshipStatus = async () => {
        try {
            const currentUserId = await getCurrentUserUid();
            const status = await checkFriendshipStatus(currentUserId, friend.id);
            setFriendshipStatus(status);
        } catch (error) {
            console.error('Arkadaşlık durumu kontrol hatası:', error);
        }
    };

    const fetchFriendPosts = async () => {
        if (!friend?.id) return;

        setLoadingPosts(true);
        try {
            const currentUserId = await getCurrentUserUid();
            const postsRef = collection(db, 'posts');
            const q = query(
                postsRef,
                where('userId', '==', friend.id),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const postsList = [];

            const userDoc = await getDoc(doc(db, 'users', currentUserId));
            const userFriends = userDoc.data()?.friends || [];

            const isFriend = userFriends.includes(friend.id);

            const friendDoc = await getDoc(doc(db, 'users', friend.id));
            const friendData = friendDoc.data() || {};
            const visibility = friendData.settings?.visibility || 'public';

            if (visibility === 'private' && !isFriend && friend.id !== currentUserId) {
                setPosts([]);
                setLoadingPosts(false);
                return;
            }

            querySnapshot.forEach((doc) => {
                const postData = doc.data();

                if (!postData.isPublic && !isFriend && friend.id !== currentUserId) {
                    return;
                }

                postsList.push({
                    id: doc.id,
                    ...postData,
                    createdAt: postData.createdAt?.toDate() || new Date(),
                    user: {
                        id: friend.id,
                        name: friend.name || friendData.informations?.name || 'İsimsiz Kullanıcı',
                        username: friend.informations?.username || friendData.informations?.username,
                        avatar: friend.profilePicture || friendData.profilePicture
                    }
                });
            });

            setPosts(postsList);
        } catch (error) {
            console.error('Arkadaş postları alınırken hata:', error);
        } finally {
            setLoadingPosts(false);
        }
    };

    const fetchLikedPosts = async () => {
        if (!friend?.id) return;

        setLoadingLikedPosts(true);
        try {
            const currentUserId = await getCurrentUserUid();
            const postsRef = collection(db, 'posts');

            // Tüm postları çekelim
            const q = query(postsRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            const allPosts = [];
            querySnapshot.forEach((doc) => {
                const postData = doc.data();
                if (postData.likedBy && postData.likedBy.includes(friend.id)) {
                    allPosts.push({
                        id: doc.id,
                        ...postData,
                        createdAt: postData.createdAt?.toDate() || new Date()
                    });
                }
            });

            // Kullanıcı bilgilerini ekleyelim
            const postsWithUserData = await Promise.all(
                allPosts.map(async (post) => {
                    const userDoc = await getDoc(doc(db, 'users', post.userId));
                    const userData = userDoc.data() || {};

                    return {
                        ...post,
                        user: {
                            id: post.userId,
                            name: userData.informations?.name || 'İsimsiz Kullanıcı',
                            username: userData.informations?.username,
                            avatar: userData.profilePicture
                        }
                    };
                })
            );

            setLikedPosts(postsWithUserData);
        } catch (error) {
            console.error('Beğenilen postları alırken hata:', error);
        } finally {
            setLoadingLikedPosts(false);
        }
    };

    const handleFriendAction = async () => {
        if (loading) return;

        if (friendshipStatus === 'friend') {
            Alert.alert(
                "Arkadaşlıktan Çıkar",
                `${friend.name || 'Bu kişi'} arkadaş listenizden çıkarılacak. Onaylıyor musunuz?`,
                [
                    {
                        text: "İptal",
                        style: "cancel"
                    },
                    {
                        text: "Evet, Çıkar",
                        onPress: () => removeFriendConfirmed(),
                        style: "destructive"
                    }
                ]
            );
            return;
        }

        setLoading(true);
        try {
            switch (friendshipStatus) {
                case 'none':
                    await sendFriendRequest(friend.id);
                    setFriendshipStatus('pending');
                    break;

                case 'received':
                    await acceptFriendRequest(friend.id);
                    setFriendshipStatus('friend');
                    break;
            }
        } catch (error) {
            console.error('Arkadaşlık aksiyonu hatası:', error);
        } finally {
            setLoading(false);
        }
    };

    const removeFriendConfirmed = async () => {
        setLoading(true);
        try {
            const currentUserId = await getCurrentUserUid();
            await removeFriend(currentUserId, friend.id);
            setFriendshipStatus('none');
        } catch (error) {
            console.error('Arkadaşlıktan çıkarma hatası:', error);
        } finally {
            setLoading(false);
        }
    };

    const getButtonConfig = () => {
        if (isOwnProfile) {
            return {
                primary: {
                    text: 'Profili Düzenle',
                    style: styles.editButton,
                    textStyle: styles.editButtonText,
                    onPress: () => {
                        handleEditProfile();
                    },
                    disabled: false
                },
                secondary: {
                    text: 'Profili Paylaş',
                    style: styles.shareButton,
                    textStyle: styles.shareButtonText,
                    onPress: () => {
                        handleShareProfile();
                    },
                    disabled: false
                }
            };
        }

        switch (friendshipStatus) {
            case 'friend':
                return {
                    primary: {
                        text: 'Arkadaşınız',
                        style: styles.friendButton,
                        textStyle: styles.friendButtonText,
                        onPress: handleFriendAction,
                        disabled: false
                    },
                    secondary: {
                        text: 'Mesaj',
                        style: styles.messageButton,
                        textStyle: styles.messageButtonText,
                        onPress: () => {
                            onClose();
                            setTimeout(() => {
                                navigation.navigate('DirectMessages', {
                                    screen: 'Chat',
                                    params: {
                                        friend: {
                                            id: friend.id,
                                            name: friend.name || friend.informations?.name || 'İsimsiz Kullanıcı',
                                            profilePicture: friend.profilePicture,
                                            informations: friend.informations
                                        }
                                    }
                                });
                            }, 300);
                        },
                        disabled: false
                    }
                };
            case 'pending':
                return {
                    primary: {
                        text: 'İstek Gönderildi',
                        style: styles.pendingButton,
                        textStyle: styles.pendingButtonText,
                        onPress: handleFriendAction,
                        disabled: true
                    },
                    secondary: {
                        text: 'Mesaj',
                        style: styles.messageButton,
                        textStyle: styles.messageButtonText,
                        onPress: () => {
                            onClose();
                            setTimeout(() => {
                                navigation.navigate('DirectMessages', {
                                    screen: 'Chat',
                                    params: {
                                        friend: {
                                            id: friend.id,
                                            name: friend.name || friend.informations?.name || 'İsimsiz Kullanıcı',
                                            profilePicture: friend.profilePicture,
                                            informations: friend.informations
                                        }
                                    }
                                });
                            }, 300);
                        },
                        disabled: false
                    }
                };
            case 'received':
                return {
                    primary: {
                        text: 'İsteği Kabul Et',
                        style: styles.acceptButton,
                        textStyle: styles.acceptButtonText,
                        onPress: handleFriendAction,
                        disabled: false
                    },
                    secondary: {
                        text: 'Mesaj',
                        style: styles.messageButton,
                        textStyle: styles.messageButtonText,
                        onPress: () => {
                            onClose();
                            setTimeout(() => {
                                navigation.navigate('DirectMessages', {
                                    screen: 'Chat',
                                    params: {
                                        friend: {
                                            id: friend.id,
                                            name: friend.name || friend.informations?.name || 'İsimsiz Kullanıcı',
                                            profilePicture: friend.profilePicture,
                                            informations: friend.informations
                                        }
                                    }
                                });
                            }, 300);
                        },
                        disabled: false
                    }
                };
            default:
                return {
                    primary: {
                        text: 'Arkadaş Ekle',
                        style: styles.followButton,
                        textStyle: styles.followButtonText,
                        onPress: handleFriendAction,
                        disabled: false
                    },
                    secondary: {
                        text: 'Mesaj',
                        style: styles.messageButton,
                        textStyle: styles.messageButtonText,
                        onPress: () => {
                            onClose();
                            setTimeout(() => {
                                navigation.navigate('DirectMessages', {
                                    screen: 'Chat',
                                    params: {
                                        friend: {
                                            id: friend.id,
                                            name: friend.name || friend.informations?.name || 'İsimsiz Kullanıcı',
                                            profilePicture: friend.profilePicture,
                                            informations: friend.informations
                                        }
                                    }
                                });
                            }, 300);
                        },
                        disabled: false
                    }
                };
        }
    };

    const buttonConfig = getButtonConfig();

    if (!friend) return null;

    const { informations } = friend;

    const handleLikePress = async (postId) => {
        if (!currentUserId) return;

        try {
            const isLiked = await toggleLikePost(postId, currentUserId);
            setPosts(currentPosts =>
                currentPosts.map(post => {
                    if (post.id === postId) {
                        const currentLikes = post.stats?.likes || 0;
                        const newLikes = isLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);

                        return {
                            ...post,
                            likedBy: isLiked
                                ? [...(post.likedBy || []), currentUserId]
                                : (post.likedBy || []).filter(id => id !== currentUserId),
                            stats: {
                                ...post.stats,
                                likes: newLikes
                            }
                        };
                    }
                    return post;
                })
            );
        } catch (error) {
            console.error('Beğeni hatası:', error);
        }
    };

    const handleCommentSubmit = async (postId, comment, replyToId = null) => {
        if (!currentUserId) return;

        try {
            if (comment === 'delete') {
                await deleteComment(postId, replyToId, currentUserId);
                setPosts(currentPosts =>
                    currentPosts.map(post => {
                        if (post.id === postId) {
                            return {
                                ...post,
                                comments: post.comments.filter(c => c.id !== replyToId),
                                stats: {
                                    ...post.stats,
                                    comments: (post.stats?.comments || 1) - 1
                                }
                            };
                        }
                        return post;
                    })
                );
            } else {
                const newComment = await addComment(postId, currentUserId, comment, replyToId);
                setPosts(currentPosts =>
                    currentPosts.map(post => {
                        if (post.id === postId) {
                            if (replyToId) {
                                const updatedComments = post.comments.map(c => {
                                    if (c.id === replyToId) {
                                        return {
                                            ...c,
                                            replies: [...(c.replies || []), newComment]
                                        };
                                    }
                                    return c;
                                });
                                return {
                                    ...post,
                                    comments: updatedComments,
                                    stats: {
                                        ...post.stats,
                                        comments: (post.stats?.comments || 0) + 1
                                    }
                                };
                            } else {
                                return {
                                    ...post,
                                    comments: [...(post.comments || []), newComment],
                                    stats: {
                                        ...post.stats,
                                        comments: (post.stats?.comments || 0) + 1
                                    }
                                };
                            }
                        }
                        return post;
                    })
                );
            }
        } catch (error) {
            console.error('Yorum işlemi hatası:', error);
        }
    };

    const handleMessagePress = () => {

        // Önce modalı kapatalım
        onClose();

        // Kısa bir gecikme ile navigasyonu gerçekleştirelim
        setTimeout(() => {
            // DirectMessages navigasyonuna yönlendir
            navigation.navigate('DirectMessages', {
                screen: 'Chat',
                params: {
                    friend: {
                        id: friend.id,
                        name: friend.name || friend.informations?.name || 'İsimsiz Kullanıcı',
                        profilePicture: friend.profilePicture,
                        informations: friend.informations
                    }
                },
                initial: false
            });
        }, 300);
    };

    const checkBlockStatus = async (uid) => {
        if (!friend?.id) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            const userData = userDoc.data();
            const blockedUsers = userData?.blockedUsers || [];
            setIsBlocked(blockedUsers.includes(friend.id));
        } catch (error) {
            console.error('Engelleme durumu kontrol hatası:', error);
        }
    };

    const checkNotificationStatus = async (uid) => {
        if (!friend?.id) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            const userData = userDoc.data();
            const mutedUsers = userData?.mutedUsers || [];
            setNotificationsEnabled(!mutedUsers.includes(friend.id));
        } catch (error) {
            console.error('Bildirim durumu kontrol hatası:', error);
        }
    };

    const handleMenuPress = () => {
        if (Platform.OS === 'ios') {
            showIOSActionSheet();
        } else {
            setActionSheetVisible(true);
        }
    };

    const showIOSActionSheet = () => {
        const options = getActionSheetOptions();

        ActionSheetIOS.showActionSheetWithOptions(
            {
                options: options.map(option => option.title),
                cancelButtonIndex: options.findIndex(option => option.id === 'cancel'),
                destructiveButtonIndex: options.findIndex(option => option.id === 'block' || option.id === 'report' || option.id === 'removeFriend'),
                userInterfaceStyle: 'light'
            },
            (buttonIndex) => {
                handleActionSheetPress(options[buttonIndex].id);
            }
        );
    };

    const getActionSheetOptions = () => {
        const isSelfProfile = currentUserId === friend?.id;
        const options = [];

        if (!isSelfProfile) {
            options.push({ id: 'share', title: 'Profili Paylaş' });
            options.push({ id: 'copy', title: 'Profil Bağlantısını Kopyala' });

            if (friendshipStatus === 'friend') {
                options.push({ id: 'removeFriend', title: 'Arkadaşlıktan Çıkar' });
            }

            options.push({
                id: 'notifications',
                title: notificationsEnabled ? 'Bildirimleri Kapat' : 'Bildirimleri Aç'
            });

            options.push({ id: 'report', title: 'Profili Şikayet Et' });

            options.push({
                id: 'block',
                title: isBlocked ? 'Engeli Kaldır' : 'Kullanıcıyı Engelle'
            });
        } else {
            options.push({ id: 'share', title: 'Profilimi Paylaş' });
            options.push({ id: 'copy', title: 'Profil Bağlantımı Kopyala' });
            options.push({ id: 'privacy', title: 'Gizlilik Ayarları' });
        }

        options.push({ id: 'cancel', title: 'İptal' });

        return options;
    };

    const handleActionSheetPress = async (actionId) => {
        if (!friend?.id || !currentUserId) return;

        switch (actionId) {
            case 'share':
                handleShareProfile();
                break;

            case 'copy':
                handleCopyProfileLink();
                break;

            case 'removeFriend':
                Alert.alert(
                    "Arkadaşlıktan Çıkar",
                    `${friend.name || 'Bu kişi'} arkadaş listenizden çıkarılacak. Onaylıyor musunuz?`,
                    [
                        { text: "İptal", style: "cancel" },
                        { text: "Evet, Çıkar", onPress: removeFriendConfirmed, style: "destructive" }
                    ]
                );
                break;

            case 'notifications':
                toggleNotifications();
                break;

            case 'report':
                handleReportProfile();
                break;

            case 'block':
                handleBlockUser();
                break;

            case 'privacy':
                navigation.navigate('Gizlilik');
                onClose();
                break;

            case 'cancel':
                break;
        }
    };

    const handleShareProfile = async () => {
        try {
            // Paylaşılacak mesaj
            const shareMessage = `${friend.name || 'Kullanıcı'} profilini STeaPP uygulamasında görüntüle!`;

            // Paylaşım URL'si
            const shareUrl = `https://steapp.com/profile/${friend.id}`;

            // Paylaşım başlığı
            const shareTitle = `${friend.name || 'Kullanıcı'} Profili`;

            // Share API'sini kullanarak paylaşım diyaloğunu aç
            const result = await Share.share(
                {
                    message: shareMessage,
                    url: shareUrl,
                    title: shareTitle,
                },
                {
                    // iOS için ek seçenekler
                    dialogTitle: 'Profili Paylaş',
                    subject: shareTitle,
                    // Android için ek seçenekler
                    tintColor: '#25D220'
                }
            );

        } catch (error) {
            console.error('Profil paylaşma hatası:', error);
            Alert.alert('Hata', 'Profil paylaşılırken bir sorun oluştu.');
        }
    };

    const handleCopyProfileLink = () => {
        Clipboard.setString(`app://profile/${friend.id}`);
        Alert.alert('Başarılı', 'Profil bağlantısı panoya kopyalandı.');
    };

    const toggleNotifications = async () => {
        try {
            const userRef = doc(db, 'users', currentUserId);

            if (notificationsEnabled) {
                await updateDoc(userRef, {
                    mutedUsers: arrayUnion(friend.id)
                });
                setNotificationsEnabled(false);
                Alert.alert('Bildirimler Kapatıldı', `${friend.name || 'Bu kullanıcı'} için bildirimler kapatıldı.`);
            } else {
                await updateDoc(userRef, {
                    mutedUsers: arrayRemove(friend.id)
                });
                setNotificationsEnabled(true);
                Alert.alert('Bildirimler Açıldı', `${friend.name || 'Bu kullanıcı'} için bildirimler açıldı.`);
            }
        } catch (error) {
            console.error('Bildirim durumu değiştirme hatası:', error);
            Alert.alert('Hata', 'Bildirim ayarları değiştirilirken bir hata oluştu.');
        }
    };

    const handleReportProfile = () => {
        Alert.alert(
            "Profili Şikayet Et",
            "Bu profili şikayet etme nedeniniz nedir?",
            [
                { text: "İptal", style: "cancel" },
                { text: "Sahte Profil", onPress: () => submitReport("fake_profile") },
                { text: "Uygunsuz İçerik", onPress: () => submitReport("inappropriate_content") },
                { text: "Taciz veya Zorbalık", onPress: () => submitReport("harassment") },
                { text: "Diğer", onPress: () => submitReport("other") }
            ]
        );
    };

    const submitReport = async (reason) => {
        try {
            const reportData = {
                reportedUserId: friend.id,
                reportedBy: currentUserId,
                reason: reason,
                timestamp: new Date(),
                status: 'pending',
                reportedUserName: friend.informations?.name || friend.name,
            };

            const reportsRef = collection(db, 'reports');
            await addDoc(reportsRef, reportData);

            Alert.alert(
                "Şikayet Alındı",
                "Şikayetiniz alındı. En kısa sürede incelenecektir.",
                [{ text: "Tamam" }],
                { cancelable: true, onDismiss: () => showBlockOption() }
            );

            setTimeout(() => {
                showBlockOption();
            }, 500);
        } catch (error) {
            console.error('Şikayet gönderme hatası:', error);
            Alert.alert('Hata', 'Şikayet gönderilirken bir hata oluştu.');
        }
    };

    const showBlockOption = () => {
        if (isBlocked) return;

        Alert.alert(
            "Kullanıcıyı Engelle",
            `${friend.informations?.name || friend.name} adlı kullanıcıyı engellemek ister misiniz?`,
            [
                { text: "Hayır", style: "cancel" },
                { text: "Evet, Engelle", onPress: blockUser, style: "destructive" }
            ]
        );
    };

    const handleBlockUser = async () => {
        if (isBlocked) {
            Alert.alert(
                "Engeli Kaldır",
                `${friend.name || 'Bu kullanıcı'} için engeli kaldırmak istediğinize emin misiniz?`,
                [
                    { text: "İptal", style: "cancel" },
                    { text: "Evet, Kaldır", onPress: unblockUser }
                ]
            );
        } else {
            Alert.alert(
                "Kullanıcıyı Engelle",
                `${friend.name || 'Bu kullanıcı'} engellenecek. Bu kişi artık sizinle iletişim kuramayacak ve içeriklerinizi göremeyecek.`,
                [
                    { text: "İptal", style: "cancel" },
                    { text: "Engelle", onPress: blockUser, style: "destructive" }
                ]
            );
        }
    };

    const blockUser = async () => {
        try {
            const userRef = doc(db, 'users', currentUserId);

            await updateDoc(userRef, {
                blockedUsers: arrayUnion(friend.id)
            });

            if (friendshipStatus === 'friend') {
                await removeFriend(currentUserId, friend.id);
                setFriendshipStatus('none');
            }

            setIsBlocked(true);
            Alert.alert('Kullanıcı Engellendi', `${friend.name || 'Bu kullanıcı'} engellendi.`);

            onClose();
        } catch (error) {
            console.error('Kullanıcı engelleme hatası:', error);
            Alert.alert('Hata', 'Kullanıcı engellenirken bir hata oluştu.');
        }
    };

    const unblockUser = async () => {
        try {
            const userRef = doc(db, 'users', currentUserId);

            await updateDoc(userRef, {
                blockedUsers: arrayRemove(friend.id)
            });

            setIsBlocked(false);
            Alert.alert('Engel Kaldırıldı', `${friend.name || 'Bu kullanıcı'} için engel kaldırıldı.`);
        } catch (error) {
            console.error('Kullanıcı engel kaldırma hatası:', error);
            Alert.alert('Hata', 'Kullanıcının engeli kaldırılırken bir hata oluştu.');
        }
    };

    const handleEditProfile = () => {
        try {
            // Ana modalı kapatmayı garantilemek için doğrudan setFriendProfileVisible ve onClose kullanıyoruz
            onClose();

            // ProfileModal'a yönlendirme yapmak yerine, ana ProfileModal'ı açmak için
            // bir timeout kullanıyoruz
            setTimeout(() => {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainTabs' }],
                });

                // Kısa bir gecikme ile ProfileModal'ı açıyoruz
                setTimeout(() => {
                    navigation.navigate('ProfileModal');
                }, 100);
            }, 300);
        } catch (error) {
            console.error('Navigation error:', error);
        }
    };

    const getProfileImageSource = (user) => {
        if (user?.profilePicture) {
            return {
                uri: user.profilePicture,
                priority: FastImage.priority.high,
                cache: FastImage.cacheControl.immutable
            };
        } else {
            // Kullanıcının adının ilk iki harfini al
            const initials = (user?.informations?.name || user?.name || "")
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

            // UI Avatars API'sini kullanarak isim baş harfleri ile avatar oluştur
            return {
                uri: `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=256&bold=true`,
                priority: FastImage.priority.high,
                cache: FastImage.cacheControl.web
            };
        }
    };

    const renderDetailModal = () => {
        // Aktif sekmeye göre doğru veri kaynağını seçelim
        const currentPosts = activeTab === 'posts' ? posts : likedPosts;

        return (
            <PostDetailModal
                visible={selectedPost !== null && !isDetailModalClosingRef.current}
                onClose={() => {
                    // Kapatma işlemi başladığında ref'i güncelle
                    isDetailModalClosingRef.current = true;
                    
                    // Önce modal kapanmasına izin ver, sonra state'i güncelle
                    // Buradaki gecikme modal kapanma animasyonunu tamamlamaya yardımcı olur
                    const delay = Platform.OS === 'ios' ? 350 : 250;
                    
                    setTimeout(() => {
                        // Modal kapandıktan sonra state'i güncelle
                        setSelectedPost(null);
                        // Ref'i sıfırla (gelecekteki açılmalar için)
                        isDetailModalClosingRef.current = false;
                    }, delay);
                }}
                selectedPost={selectedPost}
                currentPosts={currentPosts}
                currentUserId={currentUserId}
                onLikePress={handleLikePress}
                onCommentPress={handleCommentSubmit}
                onPostUpdate={(updatedPost) => {
                    if (selectedPost && updatedPost.id === selectedPost.id) {
                        // Sadece seçili gönderi güncellendiğinde state'i güncelle
                        setSelectedPost(updatedPost);
                    }
                }}
                navigation={navigation}
            />
        );
    };

    const handleProfileImagePress = () => {
        setProfileImageModalVisible(true);
    };

    const handleProfileImageLongPress = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['İptal', 'Resmi Paylaş', 'Resmi Kaydet'],
                    cancelButtonIndex: 0,
                    userInterfaceStyle: 'light'
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        handleShareProfileImage();
                    } else if (buttonIndex === 2) {
                        Alert.alert('Bilgi', 'Bu özellik şu anda geliştirme aşamasındadır.');
                    }
                }
            );
        } else {
            setActionSheetVisible(true);
        }
    };

    const handleShareProfileImage = async () => {
        try {
            // Paylaşılacak mesaj
            const shareMessage = `${friend.name || 'Kullanıcı'} profil fotoğrafı`;

            // Paylaşım URL'si
            const profilePictureUrl = friend.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent((friend?.informations?.name || friend?.name || "").substring(0, 2))}&background=random&color=fff&size=256&bold=true`;

            // Share API'sini kullanarak paylaşım diyaloğunu aç
            const result = await Share.share(
                {
                    message: shareMessage,
                    url: profilePictureUrl,
                    title: `${friend.name || 'Kullanıcı'} Profil Fotoğrafı`,
                },
                {
                    // iOS için ek seçenekler
                    dialogTitle: 'Profil Fotoğrafını Paylaş',
                    subject: `${friend.name || 'Kullanıcı'} Profil Fotoğrafı`,
                    // Android için ek seçenekler
                    tintColor: '#25D220'
                }
            );

        } catch (error) {
            console.error('Profil fotoğrafı paylaşma hatası:', error);
            Alert.alert('Hata', 'Profil fotoğrafı paylaşılırken bir sorun oluştu.');
        }
    };

    const renderProfileImageModal = () => {
        return (
            <Modal
                visible={profileImageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setProfileImageModalVisible(false);
                    // Modal state'ini temizleyelim
                    setTimeout(() => {
                        if (Platform.OS === 'ios') {
                            // iOS için ek gecikme
                            setTimeout(() => {
                                setProfileImageModalVisible(false);
                            }, 100);
                        }
                    }, 50);
                }}
                statusBarTranslucent={true}
            >
                <View style={styles.profileImageModalContainer}>
                    <TouchableOpacity
                        style={styles.profileImageModalOverlay}
                        activeOpacity={1}
                        onPress={() => {
                            setProfileImageModalVisible(false);
                            // Modal'ı kapatmak için bir kısa gecikme ekleyelim
                            setTimeout(() => {
                                if (Platform.OS === 'ios') {
                                    // iOS için ek gecikme
                                    setTimeout(() => {
                                        setProfileImageModalVisible(false);
                                    }, 100);
                                }
                            }, 50);
                        }}
                    >
                        <View style={styles.profileImageModalContent}>
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onLongPress={handleProfileImageLongPress}
                                delayLongPress={500}
                            >
                                <FastImage
                                    source={getProfileImageSource(friend)}
                                    style={styles.profileImageModalImage}
                                    resizeMode={FastImage.resizeMode.contain}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.profileImageModalCloseButton}
                                onPress={() => {
                                    setProfileImageModalVisible(false);
                                    // Modal'ı kapatmak için bir kısa gecikme ekleyelim
                                    setTimeout(() => {
                                        if (Platform.OS === 'ios') {
                                            // iOS için ek gecikme
                                            setTimeout(() => {
                                                setProfileImageModalVisible(false);
                                            }, 100);
                                        }
                                    }, 50);
                                }}
                            >
                                <Ionicons name="close-circle" size={36} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    };

    const checkFriendsListPermission = async () => {
        if (!friend?.id) return;

        try {
            const friendDoc = await getDoc(doc(db, 'users', friend.id));
            const friendData = friendDoc.data() || {};
            const friendsListSetting = friendData.settings?.privacySettings?.friendsList;

            // Kullanıcı kendi profilini her zaman görebilir
            const currentUserId = await getCurrentUserUid();

            // Arkadaş listesi ayarı true ise veya kendi profili ise görüntülenebilir
            setCanViewFriends(friendsListSetting === true || friend.id === currentUserId);
        } catch (error) {
            console.error('Arkadaş listesi izni kontrol hatası:', error);
            setCanViewFriends(false);
        }
    };

    const fetchFriendsList = async () => {
        if (!friend?.id || !canViewFriends) return;

        setLoadingFriends(true);
        try {
            const friendDoc = await getDoc(doc(db, 'users', friend.id));
            const friendData = friendDoc.data() || {};
            const friendIds = friendData.friends || [];

            if (friendIds.length === 0) {
                setFriendsList([]);
                setLoadingFriends(false);
                return;
            }

            // Her bir arkadaş için kullanıcı bilgilerini al
            const friendsData = await Promise.all(
                friendIds.map(async (friendId) => {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', friendId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            return {
                                id: friendId,
                                name: userData.informations?.name || 'İsimsiz Kullanıcı',
                                username: userData.informations?.username || '',
                                profilePicture: userData.profilePicture || '',
                                informations: userData.informations || {}
                            };
                        }
                        return null;
                    } catch (error) {
                        console.error(`Kullanıcı bilgisi alınamadı: ${friendId}`, error);
                        return null;
                    }
                })
            );

            // null değerleri filtrele
            const validFriends = friendsData.filter(friend => friend !== null);
            setFriendsList(validFriends);
            setFilteredFriendsList(validFriends);
        } catch (error) {
            console.error('Arkadaş listesi alınırken hata:', error);
        } finally {
            setLoadingFriends(false);
        }
    };

    const handleFriendsCountPress = () => {
        if (!canViewFriends) {
            // Arkadaş listesi gizliyse uyarı göster
            Toast.show({
                type: 'info',
                text1: 'Bilgi',
                text2: 'Bu kullanıcı arkadaş listesinin görüntülenmesini engelliyor.',
                position: 'top',
                visibilityTime: 4000,
            });
            return;
        }

        // Arkadaş listesini aç
        fetchFriendsList();
        setFriendsListModalVisible(true);
    };

    const renderFriendsListModal = () => {
        return (
            <Modal
                visible={friendsListModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setFriendsListModalVisible(false);
                    // Modal'ı kapatmak için bir kısa gecikme ekleyelim
                    setTimeout(() => {
                        if (Platform.OS === 'ios') {
                            // iOS için ek gecikme
                            setTimeout(() => {
                                setFriendsListModalVisible(false);
                            }, 100);
                        }
                    }, 50);
                }}
                statusBarTranslucent={true}
            >
                <TouchableOpacity
                    style={styles.friendsModalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setFriendsListModalVisible(false);
                        // Modal'ı kapatmak için bir kısa gecikme ekleyelim
                        setTimeout(() => {
                            if (Platform.OS === 'ios') {
                                // iOS için ek gecikme
                                setTimeout(() => {
                                    setFriendsListModalVisible(false);
                                }, 100);
                            }
                        }, 50);
                    }}
                >
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View style={styles.friendsModalCard}>
                            {/* Header */}
                            <View style={styles.friendsModalCardHeader}>
                                <View style={styles.friendsModalCardHeaderLeft}>
                                    <Ionicons name="people" size={20} color="#25D220" />
                                    <Text style={styles.friendsModalCardTitle}>Arkadaş Listesi</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        setFriendsListModalVisible(false);
                                        // Modal'ı kapatmak için bir kısa gecikme ekleyelim
                                        setTimeout(() => {
                                            if (Platform.OS === 'ios') {
                                                // iOS için ek gecikme
                                                setTimeout(() => {
                                                    setFriendsListModalVisible(false);
                                                }, 100);
                                            }
                                        }, 50);
                                    }}
                                    style={styles.friendsModalCardClose}
                                >
                                    <Ionicons name="close" size={20} color="#888" />
                                </TouchableOpacity>
                            </View>

                            {/* Divider */}
                            <View style={styles.friendsModalDivider} />

                            {/* Subtitle */}
                            <Text style={styles.friendsModalCardSubtitle}>
                                {friend?.name || friend?.informations?.name || 'Kullanıcı'} adlı kişinin {friendsList.length || 0} arkadaşı
                            </Text>

                            {/* Search Bar */}
                            <View style={styles.friendsModalSearchContainer}>
                                <Ionicons name="search-outline" size={16} color="#999" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.friendsModalSearchInput}
                                    placeholder="Ara"
                                    placeholderTextColor="#999"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={16} color="#999" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Friends List */}
                            {loadingFriends ? (
                                <View style={styles.friendsModalLoadingContainer}>
                                    <Ionicons name="sync-outline" size={24} color="#25D220" />
                                    <Text style={styles.friendsModalLoadingText}>Yükleniyor...</Text>
                                </View>
                            ) : filteredFriendsList.length > 0 ? (
                                <FlatList
                                    data={filteredFriendsList}
                                    keyExtractor={keyExtractor}
                                    renderItem={renderFriendItem}
                                    showsVerticalScrollIndicator={false}
                                    initialNumToRender={10}
                                    maxToRenderPerBatch={5}
                                    updateCellsBatchingPeriod={50}
                                    windowSize={5}
                                    removeClippedSubviews={true}
                                    getItemLayout={getFriendItemLayout}
                                />
                            ) : searchQuery.length > 0 ? (
                                <View style={styles.friendsModalEmptyContainer}>
                                    <Ionicons name="search-outline" size={40} color="#DDDDDD" />
                                    <Text style={styles.friendsModalEmptyText}>
                                        "{searchQuery}" için sonuç bulunamadı
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.friendsModalEmptyContainer}>
                                    <Ionicons name="people-outline" size={40} color="#DDDDDD" />
                                    <Text style={styles.friendsModalEmptyText}>
                                        Henüz arkadaş eklenmemiş
                                    </Text>
                                </View>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </TouchableOpacity>
            </Modal>
        );
    };

    const checkVerificationStatus = async () => {
        if (!friend?.id) return;

        try {
            // verificationUtils.js içindeki checkUserVerification fonksiyonunu kullan
            const verificationResult = await checkUserVerification(friend.id);

            setVerificationStatus({
                hasBlueTick: verificationResult.hasBlueTick,
                hasGreenTick: verificationResult.hasGreenTick
            });
        } catch (error) {
            console.error('Doğrulama durumu kontrol hatası:', error);
            setVerificationStatus({
                hasBlueTick: false,
                hasGreenTick: false
            });
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="slide"
            onRequestClose={() => {
                // Alt modallardan herhangi biri açıksa, önce onları kapat
                if (selectedPost || profileImageModalVisible || friendsListModalVisible) {
                    if (selectedPost) {
                        isDetailModalClosingRef.current = true;
                        setTimeout(() => {
                            setSelectedPost(null);
                            isDetailModalClosingRef.current = false;
                        }, Platform.OS === 'ios' ? 350 : 250);
                    }
                    if (profileImageModalVisible) {
                        setProfileImageModalVisible(false);
                    }
                    if (friendsListModalVisible) {
                        setFriendsListModalVisible(false);
                    }
                    return;
                }
                // Alt modallar kapalıysa ana modalı kapat
                onClose();
            }}
            statusBarTranslucent={true}
        >
            {Platform.OS === 'android' ? (
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.modalContainer}>
                        <View style={styles.headerSection}>
                            <TouchableOpacity style={styles.backButton} onPress={onClose}>
                                <Ionicons name="arrow-back" size={24} color="#333" />
                            </TouchableOpacity>
                            <View style={styles.headerTitleContainer}>
                                <Text style={styles.headerTitle}>{informations?.username || friend.name}</Text>
                                <VerificationBadge
                                    hasBlueTick={verificationStatus.hasBlueTick}
                                    hasGreenTick={verificationStatus.hasGreenTick}
                                    size={18}
                                    style={styles.verificationBadge}
                                    showTooltip={false}
                                />
                            </View>
                            <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
                                <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        
                        {isProfilePrivate ? (
                            <View style={styles.privateProfileContainer}>
                                <View style={styles.profileTopSection}>
                                    <View style={styles.profileImageContainer}>
                                        <TouchableOpacity
                                            onPress={handleProfileImagePress}
                                            activeOpacity={0.8}
                                        >
                                            <FastImage
                                                source={getProfileImageSource(friend)}
                                                style={styles.profileImage}
                                                resizeMode={FastImage.resizeMode.cover}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.statsContainer}>
                                        <TouchableOpacity
                                            style={styles.statCard}
                                            onPress={handleFriendsCountPress}
                                        >
                                            <Text style={styles.statNumber}>{friend.friends?.length || 0}</Text>
                                            <Text style={styles.statLabel}>Arkadaş</Text>
                                        </TouchableOpacity>
                                        <View style={styles.statCard}>
                                            <Text style={styles.statNumber}>-</Text>
                                            <Text style={styles.statLabel}>Paylaşım</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.profileInfo}>
                                    <View style={styles.nameContainer}>
                                        <Text style={styles.name}>{informations?.name || friend.name}</Text>
                                        <VerificationBadge
                                            hasBlueTick={verificationStatus.hasBlueTick}
                                            hasGreenTick={verificationStatus.hasGreenTick}
                                            size={18}
                                            style={styles.nameVerificationBadge}
                                            showTooltip={false}
                                        />
                                    </View>
                                </View>

                                <View style={styles.actionButtonsRow}>
                                    <TouchableOpacity
                                        style={buttonConfig.primary.style}
                                        onPress={() => {
                                            buttonConfig.primary.onPress();
                                        }}
                                        disabled={buttonConfig.primary.disabled || loading}
                                    >
                                        <Text style={buttonConfig.primary.textStyle}>
                                            {loading ? 'İşleniyor...' : buttonConfig.primary.text}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={buttonConfig.secondary.style}
                                        onPress={buttonConfig.secondary.onPress}
                                        disabled={buttonConfig.secondary.disabled}
                                    >
                                        <Text style={buttonConfig.secondary.textStyle}>
                                            {buttonConfig.secondary.text}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.privateProfileContent}>
                                    <View style={styles.lockIconContainer}>
                                        <Ionicons name="lock-closed" size={64} color="#ccc" />
                                    </View>
                                    <Text style={styles.privateProfileTitle}>Bu Hesap Gizli</Text>
                                    <Text style={styles.privateProfileText}>
                                        Fotoğraf ve videolarını görmek için bu hesabı takip et.
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.scrollContent}
                            >
                                <View style={styles.profileHeader}>
                                    <View style={styles.profileTopSection}>
                                        <View style={styles.profileImageContainer}>
                                            <TouchableOpacity
                                                onPress={handleProfileImagePress}
                                                activeOpacity={0.8}
                                            >
                                                <FastImage
                                                    source={getProfileImageSource(friend)}
                                                    style={styles.profileImage}
                                                    resizeMode={FastImage.resizeMode.cover}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.statsContainer}>
                                            <TouchableOpacity
                                                style={styles.statCard}
                                                onPress={handleFriendsCountPress}
                                            >
                                                <Text style={styles.statNumber}>{friend.friends?.length || 0}</Text>
                                                <Text style={styles.statLabel}>Arkadaş</Text>
                                            </TouchableOpacity>
                                            <View style={styles.statCard}>
                                                <Text style={styles.statNumber}>{posts.length}</Text>
                                                <Text style={styles.statLabel}>Paylaşım</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.profileInfo}>
                                        <View style={styles.nameContainer}>
                                            <Text style={styles.name}>{informations?.name || friend.name}</Text>
                                            <VerificationBadge
                                                hasBlueTick={verificationStatus.hasBlueTick}
                                                hasGreenTick={verificationStatus.hasGreenTick}
                                                size={18}
                                                style={styles.nameVerificationBadge}
                                                showTooltip={false}
                                            />
                                        </View>
                                        {friend.bio && friend.bio !== "undefined" && (
                                            <Text style={styles.bioText}>{friend.bio}</Text>
                                        )}
                                    </View>

                                    <View style={styles.actionButtonsRow}>
                                        <TouchableOpacity
                                            style={buttonConfig.primary.style}
                                            onPress={() => {
                                                buttonConfig.primary.onPress();
                                            }}
                                            disabled={buttonConfig.primary.disabled || loading}
                                        >
                                            <Text style={buttonConfig.primary.textStyle}>
                                                {loading ? 'İşleniyor...' : buttonConfig.primary.text}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={buttonConfig.secondary.style}
                                            onPress={buttonConfig.secondary.onPress}
                                            disabled={buttonConfig.secondary.disabled}
                                        >
                                            <Text style={buttonConfig.secondary.textStyle}>
                                                {buttonConfig.secondary.text}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.postsContainer}>
                                    <View style={styles.postsHeader}>
                                        <TouchableOpacity
                                            style={[
                                                styles.tabButton,
                                                activeTab === 'posts' && styles.activeTabButton
                                            ]}
                                            onPress={() => setActiveTab('posts')}
                                        >
                                            <Ionicons
                                                name="grid-outline"
                                                size={24}
                                                color={activeTab === 'posts' ? "#25D220" : "#333"}
                                            />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.tabButton,
                                                activeTab === 'likes' && styles.activeTabButton
                                            ]}
                                            onPress={() => {
                                                setActiveTab('likes');
                                                if (friendshipStatus !== 'friend' && friend.id !== currentUserId) {
                                                    Alert.alert(
                                                        "Sınırlı Erişim",
                                                        "Beğenilen gönderileri görmek için arkadaş olmanız gerekiyor.",
                                                        [{ text: "Tamam", onPress: () => setActiveTab('posts') }]
                                                    );
                                                }
                                            }}
                                        >
                                            <Ionicons
                                                name="heart-outline"
                                                size={24}
                                                color={activeTab === 'likes' ? "#25D220" : "#333"}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    {activeTab === 'posts' ? (
                                        loadingPosts ? (
                                            <PostGridSkeleton />
                                        ) : (
                                            renderPostsListMemo(posts)
                                        )
                                    ) : (
                                        friendshipStatus === 'friend' || friend.id === currentUserId ? (
                                            loadingLikedPosts ? (
                                                <PostGridSkeleton />
                                            ) : (
                                                renderPostsListMemo(likedPosts)
                                            )
                                        ) : (
                                            <View style={styles.emptyContainer}>
                                                <Ionicons name="lock-closed-outline" size={48} color="#ccc" />
                                                <Text style={styles.emptyText}>Beğenilen paylaşımları görmek için arkadaş olmanız gerekiyor</Text>
                                            </View>
                                        )
                                    )}
                                </View>
                            </ScrollView>
                        )}
                    </View>

                    {Platform.OS === 'android' && (
                        <CustomActionSheet
                            options={getActionSheetOptions().map(option => option.title)}
                            cancelButtonIndex={getActionSheetOptions().findIndex(option => option.id === 'cancel')}
                            destructiveButtonIndex={getActionSheetOptions().findIndex(option =>
                                option.id === 'block' || option.id === 'report' || option.id === 'removeFriend'
                            )}
                            onPress={(index) => handleActionSheetPress(getActionSheetOptions()[index].id)}
                            visible={actionSheetVisible}
                            onDismiss={() => {
                                setActionSheetVisible(false);
                                // Modal'ı kapatmak için bir kısa gecikme ekleyelim
                                setTimeout(() => {
                                    if (Platform.OS === 'ios') {
                                        // iOS için ek gecikme
                                        setTimeout(() => {
                                            setActionSheetVisible(false);
                                        }, 100);
                                    }
                                }, 50);
                            }}
                        />
                    )}

                    {selectedPost && renderDetailModal()}
                    {renderProfileImageModal()}
                    {renderFriendsListModal()}
                    <Toast />
                </SafeAreaView>
            ) : (
                <View style={styles.modalContainer}>
                    <View style={styles.headerSection}>
                        <TouchableOpacity style={styles.backButton} onPress={onClose}>
                            <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>{informations?.username || friend.name}</Text>
                            <VerificationBadge
                                hasBlueTick={verificationStatus.hasBlueTick}
                                hasGreenTick={verificationStatus.hasGreenTick}
                                size={18}
                                style={styles.verificationBadge}
                                showTooltip={false}
                            />
                        </View>
                        <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
                            <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    
                    {isProfilePrivate ? (
                        <View style={styles.privateProfileContainer}>
                            <View style={styles.profileTopSection}>
                                <View style={styles.profileImageContainer}>
                                    <TouchableOpacity
                                        onPress={handleProfileImagePress}
                                        activeOpacity={0.8}
                                    >
                                        <FastImage
                                            source={getProfileImageSource(friend)}
                                            style={styles.profileImage}
                                            resizeMode={FastImage.resizeMode.cover}
                                        />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.statsContainer}>
                                    <TouchableOpacity
                                        style={styles.statCard}
                                        onPress={handleFriendsCountPress}
                                    >
                                        <Text style={styles.statNumber}>{friend.friends?.length || 0}</Text>
                                        <Text style={styles.statLabel}>Arkadaş</Text>
                                    </TouchableOpacity>
                                    <View style={styles.statCard}>
                                        <Text style={styles.statNumber}>{posts.length}</Text>
                                        <Text style={styles.statLabel}>Paylaşım</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.profileInfo}>
                                <View style={styles.nameContainer}>
                                    <Text style={styles.name}>{informations?.name || friend.name}</Text>
                                    <VerificationBadge
                                        hasBlueTick={verificationStatus.hasBlueTick}
                                        hasGreenTick={verificationStatus.hasGreenTick}
                                        size={18}
                                        style={styles.nameVerificationBadge}
                                        showTooltip={false}
                                    />
                                </View>
                            </View>

                            <View style={styles.actionButtonsRow}>
                                <TouchableOpacity
                                    style={buttonConfig.primary.style}
                                    onPress={() => {
                                        buttonConfig.primary.onPress();
                                    }}
                                    disabled={buttonConfig.primary.disabled || loading}
                                >
                                    <Text style={buttonConfig.primary.textStyle}>
                                        {loading ? 'İşleniyor...' : buttonConfig.primary.text}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={buttonConfig.secondary.style}
                                    onPress={buttonConfig.secondary.onPress}
                                    disabled={buttonConfig.secondary.disabled}
                                >
                                    <Text style={buttonConfig.secondary.textStyle}>
                                        {buttonConfig.secondary.text}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.privateProfileContent}>
                                <View style={styles.lockIconContainer}>
                                    <Ionicons name="lock-closed" size={64} color="#ccc" />
                                </View>
                                <Text style={styles.privateProfileTitle}>Bu Hesap Gizli</Text>
                                <Text style={styles.privateProfileText}>
                                    Fotoğraf ve videolarını görmek için bu hesabı takip et.
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                        >
                            <View style={styles.profileHeader}>
                                <View style={styles.profileTopSection}>
                                    <View style={styles.profileImageContainer}>
                                        <TouchableOpacity
                                            onPress={handleProfileImagePress}
                                            activeOpacity={0.8}
                                        >
                                            <FastImage
                                                source={getProfileImageSource(friend)}
                                                style={styles.profileImage}
                                                resizeMode={FastImage.resizeMode.cover}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.statsContainer}>
                                        <TouchableOpacity
                                            style={styles.statCard}
                                            onPress={handleFriendsCountPress}
                                        >
                                            <Text style={styles.statNumber}>{friend.friends?.length || 0}</Text>
                                            <Text style={styles.statLabel}>Arkadaş</Text>
                                        </TouchableOpacity>
                                        <View style={styles.statCard}>
                                            <Text style={styles.statNumber}>{posts.length}</Text>
                                            <Text style={styles.statLabel}>Paylaşım</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.profileInfo}>
                                    <View style={styles.nameContainer}>
                                        <Text style={styles.name}>{informations?.name || friend.name}</Text>
                                        <VerificationBadge
                                            hasBlueTick={verificationStatus.hasBlueTick}
                                            hasGreenTick={verificationStatus.hasGreenTick}
                                            size={18}
                                            style={styles.nameVerificationBadge}
                                            showTooltip={false}
                                        />
                                    </View>
                                    {friend.bio && friend.bio !== "undefined" && (
                                        <Text style={styles.bioText}>{friend.bio}</Text>
                                    )}
                                </View>

                                <View style={styles.actionButtonsRow}>
                                    <TouchableOpacity
                                        style={buttonConfig.primary.style}
                                        onPress={() => {
                                            buttonConfig.primary.onPress();
                                        }}
                                        disabled={buttonConfig.primary.disabled || loading}
                                    >
                                        <Text style={buttonConfig.primary.textStyle}>
                                            {loading ? 'İşleniyor...' : buttonConfig.primary.text}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={buttonConfig.secondary.style}
                                        onPress={buttonConfig.secondary.onPress}
                                        disabled={buttonConfig.secondary.disabled}
                                    >
                                        <Text style={buttonConfig.secondary.textStyle}>
                                            {buttonConfig.secondary.text}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.postsContainer}>
                                <View style={styles.postsHeader}>
                                    <TouchableOpacity
                                        style={[
                                            styles.tabButton,
                                            activeTab === 'posts' && styles.activeTabButton
                                        ]}
                                        onPress={() => setActiveTab('posts')}
                                    >
                                        <Ionicons
                                            name="grid-outline"
                                            size={24}
                                            color={activeTab === 'posts' ? "#25D220" : "#333"}
                                        />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.tabButton,
                                            activeTab === 'likes' && styles.activeTabButton
                                        ]}
                                        onPress={() => {
                                            setActiveTab('likes');
                                            if (friendshipStatus !== 'friend' && friend.id !== currentUserId) {
                                                Alert.alert(
                                                    "Sınırlı Erişim",
                                                    "Beğenilen gönderileri görmek için arkadaş olmanız gerekiyor.",
                                                    [{ text: "Tamam", onPress: () => setActiveTab('posts') }]
                                                );
                                            }
                                        }}
                                    >
                                        <Ionicons
                                            name="heart-outline"
                                            size={24}
                                            color={activeTab === 'likes' ? "#25D220" : "#333"}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {activeTab === 'posts' ? (
                                    loadingPosts ? (
                                        <PostGridSkeleton />
                                    ) : (
                                        renderPostsListMemo(posts)
                                    )
                                ) : (
                                    friendshipStatus === 'friend' || friend.id === currentUserId ? (
                                        loadingLikedPosts ? (
                                            <PostGridSkeleton />
                                        ) : (
                                            renderPostsListMemo(likedPosts)
                                        )
                                    ) : (
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="lock-closed-outline" size={48} color="#ccc" />
                                            <Text style={styles.emptyText}>Beğenilen paylaşımları görmek için arkadaş olmanız gerekiyor</Text>
                                        </View>
                                    )
                                )}
                            </View>
                        </ScrollView>
                    )}
                    
                    {selectedPost && renderDetailModal()}
                    {renderProfileImageModal()}
                    {renderFriendsListModal()}
                    <Toast />
                </View>
            )}
        </Modal>
    );
};

export default FriendProfileModal;