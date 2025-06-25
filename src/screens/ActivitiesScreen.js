import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Activity from '../components/Activity';
import NotificationItem from '../components/NotificationItem';
import Stories from '../components/Stories';
import { translate } from '../i18n/i18n';
import { fetchNotifications, markNotificationAsRead } from '../redux/slices/notificationSlice';
import { getCurrentUserUid } from '../services/friendFunctions';
import { getFriends } from '../services/friendService';
import { getUnreadMessageCount } from '../services/messageService';
import { addComment, deleteComment, fetchPosts, toggleLikePost } from '../services/postService';
import { checkAndDeleteExpiredStories } from '../services/storyService';
import * as SplashScreen from 'expo-splash-screen';

// Activity bileşenini performans için memoize edelim
const MemoizedActivity = React.memo(Activity);

const ActivitiesScreen = ({ navigation, route }) => {
    const [refreshing, setRefreshing] = useState(false);
    const [friends, setFriends] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState('activities'); // 'activities' veya 'notifications'
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const auth = getAuth();
    const currentUser = auth.currentUser; // Firebase'den current user'ı alalım

    const dispatch = useDispatch();
    const {
        notifications,
        loading: notificationsLoading    } = useSelector(state => state.notifications);
    const userId = useSelector(state => state.auth.user?.id);

    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    // Pagination için yeni state'ler
    const [page, setPage] = useState(1);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastVisibleDoc, setLastVisibleDoc] = useState(null);

    useEffect(() => {
        const initializeData = async () => {
            setLoading(true);
            try {
                const currentUid = await getCurrentUserUid();

                if (currentUid) {
                    // Tüm veri yükleme işlemlerini paralel olarak başlat
                    const [friendsPromise, postsPromise, notificationsPromise, unreadCountPromise] = [
                        fetchFriends(),
                        loadPosts(true),
                        dispatch(fetchNotifications(currentUid)),
                        getUnreadMessageCount(currentUid)
                    ];

                    // Tüm işlemleri paralel olarak bekle
                    const [friendsResult, _, __, unreadCount] = await Promise.all([
                        friendsPromise,
                        postsPromise,
                        notificationsPromise,
                        unreadCountPromise
                    ]);

                    // Sonuçları state'e kaydet
                    setUnreadCount(unreadCount);
                }
            } catch (error) {
                console.error('Veri yükleme hatası:', error);
            } finally {
                setLoading(false);
                // Splash screen'i kapat
                try {
                    await SplashScreen.hideAsync();
                } catch (error) {
                    console.error('Splash screen kapatma hatası:', error);
                }
            }
        };

        initializeData();
        checkAndDeleteExpiredStories();

        const interval = setInterval(checkAndDeleteExpiredStories, 60 * 60 * 1000);

        navigation.setOptions({
            cardStyle: { backgroundColor: '#fff' },
            cardStyleInterpolator: ({ current: { progress } }) => ({
                cardStyle: {
                    opacity: progress,
                },
            }),
        });

        return () => {
            clearInterval(interval);
        };
    }, [navigation, userId, dispatch]);

    useEffect(() => {
        loadPosts();
    }, []);

    // useCallback ile fonksiyonları memoize edelim
    const loadPosts = useCallback(async (refresh = false) => {
        try {
            if (refresh) {
                setLoading(true);
                setPage(1);
                setHasMorePosts(true);
                setLastVisibleDoc(null);
            } else if (loadingMore || !hasMorePosts) {
                return;
            } else {
                setLoadingMore(true);
            }

            if (!currentUser?.uid) return;

            // Sayfalama parametreleri ekleyelim
            const pageSize = 3; // İlk yüklemede daha az gönderi yükle (5'ten 3'e düşürdük)

            // Sayfalama ve limit ile sorgu yaparak daha az veri çek
            const result = await fetchPosts(
                currentUser.uid,
                page,
                pageSize,
                friends.map(f => f.id), // Arkadaş listesini doğrudan gönder
                lastVisibleDoc
            );

            const fetchedPosts = result.posts;
            const newLastVisible = result.lastVisible;
            const hasMore = result.hasMore;

            // Eğer sayfa yenileniyorsa, eski verileri temizle
            if (refresh || page === 1) {
                setPosts(fetchedPosts);
            } else {
                // Yeni verileri mevcut verilere ekle
                setPosts(prevPosts => {
                    // Yinelenen gönderileri filtrele
                    const existingIds = new Set(prevPosts.map(p => p.id));
                    const newPosts = fetchedPosts.filter(p => !existingIds.has(p.id));
                    return [...prevPosts, ...newPosts];
                });
            }

            // Son görünen belgeyi kaydet
            setLastVisibleDoc(newLastVisible);

            // Daha fazla gönderi var mı kontrolü
            setHasMorePosts(hasMore);

            // Bir sonraki sayfa için page değerini artır
            if (fetchedPosts.length > 0 && !refresh) {
                setPage(prevPage => prevPage + 1);
            }
        } catch (error) {
            console.error('Gönderiler yüklenirken hata:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [currentUser?.uid, page, hasMorePosts, loadingMore, friends, lastVisibleDoc]);

    // Daha fazla veri yükleme fonksiyonu
    const handleLoadMore = useCallback(() => {
        if (!loading && !loadingMore && hasMorePosts) {
            loadPosts(false);
        }
    }, [loading, loadingMore, hasMorePosts, loadPosts]);

    // Yenileme fonksiyonu
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                fetchFriends(),
                loadPosts(true)
            ]);

            if (userId && activeTab === 'notifications') {
                await dispatch(fetchNotifications(userId));
            }
        } catch (error) {
            console.error('Yenileme hatası:', error);
        } finally {
            setRefreshing(false);
        }
    }, [activeTab, userId, dispatch, fetchFriends, loadPosts]);

    // Beğeni işlemi
    const handleLikePress = useCallback(async (postId) => {
        if (!currentUser?.uid) return;

        try {
            const isLiked = await toggleLikePost(postId, currentUser.uid);
            setPosts(currentPosts =>
                currentPosts.map(post => {
                    if (post.id === postId) {
                        const currentLikes = post.stats?.likes || 0;
                        const newLikes = Math.max(0, currentLikes + (isLiked ? 1 : -1));

                        return {
                            ...post,
                            likedBy: isLiked
                                ? [...(post.likedBy || []), currentUser.uid]
                                : (post.likedBy || []).filter(id => id !== currentUser.uid),
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
    }, [currentUser?.uid]);

    // Yorum işleme
    const handleCommentSubmit = useCallback(async (postId, comment, replyToId = null) => {
        if (!comment || comment.trim() === '' || isSubmittingComment || !currentUser?.uid) {
            return;
        }

        try {
            setIsSubmittingComment(true);

            if (comment === 'delete') {
                await deleteComment(postId, replyToId, currentUser.uid);
                setPosts(currentPosts =>
                    currentPosts.map(post => {
                        if (post.id === postId) {
                            return {
                                ...post,
                                comments: post.comments.filter(c => c.id !== replyToId),
                                stats: {
                                    ...post.stats,
                                    comments: Math.max(0, (post.stats?.comments || 1) - 1)
                                }
                            };
                        }
                        return post;
                    })
                );
            } else {
                const newComment = await addComment(postId, currentUser.uid, comment, replyToId);
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
        } finally {
            setIsSubmittingComment(false);
        }
    }, [currentUser?.uid, isSubmittingComment]);

    // Post silme işlemi
    const handleDeletePost = useCallback((postId) => {
        // Silinen postu state'den kaldır
        setPosts(currentPosts => currentPosts.filter(post => post.id !== postId));
    }, []);

    // Aktiviteler listesini render eden fonksiyon
    const renderActivities = useCallback(() => {
        // Memoize edilmiş postlar
        const memoizedPosts = useMemo(() => posts, [posts]);

        // İlk yükleme sırasında ve henüz post yoksa yükleme göstergesini göster
        if (loading && !refreshing && !posts.length) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#25D220" />
                </View>
            );
        }

        // Hiç gönderi yoksa ve yükleme tamamlandıysa boş ekran göster
        if (!loading && !posts.length) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                        Henüz gönderi bulunmuyor
                    </Text>
                    <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={() => onRefresh()}
                    >
                        <Text style={styles.refreshButtonText}>Yenile</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <FlashList
                data={memoizedPosts}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <MemoizedActivity
                        activity={item}
                        onLikePress={() => handleLikePress(item.id)}
                        onCommentPress={(comment, replyToId) => handleCommentSubmit(item.id, comment, replyToId)}
                        onDeletePress={() => handleDeletePost(item.id)}
                        isLiked={item.likedBy?.includes(currentUser?.uid)}
                        currentUserId={currentUser?.uid}
                        navigation={navigation}
                    />
                )}
                estimatedItemSize={500}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#2196F3']}
                        tintColor="#2196F3"
                    />
                }
                ListFooterComponent={() => (
                    <View>
                        {loadingMore && hasMorePosts ? (
                            <View style={styles.footerLoader}>
                                <ActivityIndicator size="small" color="#2196F3" />
                            </View>
                        ) : !hasMorePosts && posts.length > 0 ? (
                            <View style={styles.endOfListContainer}>
                                <Text style={styles.endOfListText}>
                                    Tüm gönderileri gördünüz
                                </Text>
                            </View>
                        ) : null}
                        <View style={styles.bottomSpacer} />
                    </View>
                )}
                ListHeaderComponent={() => (
                    <>
                        <Stories friends={friends} navigation={navigation} />
                        <View style={styles.separator} />
                        {loading && refreshing ? (
                            <View style={styles.headerLoader}>
                                <ActivityIndicator size="small" color="#25D220" />
                            </View>
                        ) : null}
                    </>
                )}
                drawDistance={500}
                overrideItemLayout={(layout, item) => {
                    layout.size = 500; // Ortalama bir gönderi yüksekliği
                }}
                contentContainerStyle={[styles.flatListContent, { paddingBottom: 20 }]}
            />
        );
    }, [posts, loading, refreshing, onRefresh, handleLoadMore, handleLikePress, handleCommentSubmit, handleDeletePost, currentUser?.uid, loadingMore, hasMorePosts, friends, navigation]);

    // Bildirimler listesini render eden fonksiyon
    const renderNotifications = useCallback(() => {
        // Bildirimler yüklenirken ve yenileme yapılmıyorsa yükleme göstergesini göster
        if (notificationsLoading && !refreshing && !notifications.length) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#25D220" />
                </View>
            );
        }

        // Bildirim yoksa boş ekran göster
        if (!notifications || notifications.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                        Henüz bildiriminiz bulunmuyor
                    </Text>
                </View>
            );
        }

        // Bildirimleri memoize edelim
        const memoizedNotifications = useMemo(() => notifications, [notifications]);

        return (
            <FlashList
                data={memoizedNotifications}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <NotificationItem
                        notification={{
                            ...item,
                            title: item.title || 'Yeni Bildirim',
                            body: item.body || '',
                            type: item.type || 'message'
                        }}
                        onPress={() => handleNotificationPress(item)}
                    />
                )}
                estimatedItemSize={80}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#2196F3']}
                        tintColor="#2196F3"
                    />
                }
                drawDistance={400}
                overrideItemLayout={(layout, item) => {
                    layout.size = 80; // Bildirim satırının ortalama yüksekliği
                }}
                contentContainerStyle={[styles.flatListContent, { paddingBottom: 20 }]}
                ListFooterComponent={() => <View style={styles.bottomSpacer} />}
                ListHeaderComponent={() => (
                    notificationsLoading && refreshing ? (
                        <View style={styles.headerLoader}>
                            <ActivityIndicator size="small" color="#25D220" />
                        </View>
                    ) : null
                )}
            />
        );
    }, [notifications, notificationsLoading, refreshing, onRefresh, handleNotificationPress]);

    const fetchFriends = useCallback(async () => {
        try {
            const uid = await getCurrentUserUid();
            if (uid) {
                const friendsList = await getFriends(uid);
                setFriends(friendsList);
            }
        } catch (error) {
            console.error('Arkadaşları getirme hatası:', error);
        }
    }, []);

    // Tab değiştiğinde bildirimleri yükle
    useEffect(() => {
        if (activeTab === 'notifications' && userId) {
            dispatch(fetchNotifications(userId));
        }
    }, [activeTab, userId, dispatch]);

    const onGestureEvent = useCallback(({ nativeEvent }) => {
        if (nativeEvent.state === State.END) {
            if (nativeEvent.translationX < -50) {
                navigation.navigate('DirectMessages');
            }
        }
    }, [navigation]);

    const handleNotificationPress = useCallback(async (notification) => {
        if (notification.status === 'unread') {
            dispatch(markNotificationAsRead(notification.id));
        }

        // Bildirim tipine göre yönlendirme
        switch (notification.type) {
            case 'friendRequest':
                navigation.navigate('FriendRequests', {
                    userId: notification.data?.senderId
                });
                break;
            case 'message':
                navigation.navigate('DirectMessages', {
                    screen: 'Chat',
                    params: {
                        conversationId: notification.data?.chatId || notification.chatId,
                        otherUserId: notification.data?.senderId || notification.senderId
                    }
                });
                break;
            case 'activity':
                // İlgili aktiviteye yönlendir
                break;
            default:
        }
    }, [dispatch, navigation]);

    // Header'ı memoize edelim
    const renderHeader = useMemo(() => {
        return (
            <PanGestureHandler onGestureEvent={onGestureEvent}>
                <Animated.View>
                    <View style={styles.header}>
                        <View style={styles.headerTabs}>
                            <TouchableOpacity
                                onPress={() => setActiveTab('activities')}
                                style={styles.headerTab}
                            >
                                <Text style={[
                                    styles.headerTabText,
                                    activeTab !== 'activities' && styles.inactiveTabText
                                ]}>
                                    {translate('discover')}
                                </Text>
                            </TouchableOpacity>
                            <Text style={styles.headerTabDivider}>|</Text>
                            <TouchableOpacity
                                onPress={() => setActiveTab('notifications')}
                                style={styles.headerTab}
                            >
                                <Text style={[
                                    styles.headerTabText,
                                    activeTab !== 'notifications' && styles.inactiveTabText
                                ]}>
                                    {translate('notifications_activities')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('CreatePost')}
                                style={styles.headerAction}
                            >
                                <Ionicons name="add-circle-outline" size={24} color="#262626" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('LikedPosts')}
                                style={styles.headerAction}
                            >
                                <Ionicons name="heart-outline" size={24} color="#262626" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('DirectMessages')}
                                style={styles.headerAction}
                            >
                                <View style={styles.messageIconContainer}>
                                    <Ionicons name="chatbubble-outline" size={24} color="#262626" />
                                    {unreadCount > 0 && (
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadBadgeText}>
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </PanGestureHandler>
        );
    }, [activeTab, unreadCount, navigation, onGestureEvent]);

    // Route params'ı dinle
    useEffect(() => {
        if (route.params?.refresh) {
            loadPosts();
            // Paramı temizle
            navigation.setParams({ refresh: undefined });
        }
    }, [route.params?.refresh]);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaViewRN
                style={styles.container}
                edges={['top']}
            >
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />

                {renderHeader}

                {/* ScrollView yerine içerik tabına göre değişen listeler */}
                {activeTab === 'activities' ? renderActivities() : renderNotifications()}
            </SafeAreaViewRN>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    listContainer: {
        flex: 1,
        width: '100%',
    },
    flatListContent: {
        flexGrow: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: '#DBDBDB',
    },
    headerTabs: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTab: {
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    headerTabText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#262626',
    },
    inactiveTabText: {
        color: '#8E8E8E',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerAction: {
        marginLeft: 20,
    },
    separator: {
        height: 1,
        backgroundColor: '#DBDBDB',
        marginVertical: 10,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 16,
        color: '#8E8E8E',
        textAlign: 'center',
    },
    footerLoader: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomSpacer: {
        height: 80,
    },
    headerLoader: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skeletonContainer: {
        padding: 16,
        backgroundColor: '#fff',
        marginBottom: 8,
    },
    skeletonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    skeletonAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        marginRight: 12,
    },
    skeletonName: {
        width: 120,
        height: 16,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
    },
    skeletonImage: {
        width: '100%',
        height: 300,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginBottom: 12,
    },
    skeletonActions: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    skeletonAction: {
        width: 24,
        height: 24,
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        marginRight: 16,
    },
    skeletonText: {
        width: '80%',
        height: 16,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
        marginBottom: 8,
    },
    skeletonTextShort: {
        width: '40%',
        height: 16,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
    },
    headerTabDivider: {
        fontSize: 24,
        fontWeight: '300',
        color: '#8E8E8E',
        marginHorizontal: 8,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        marginRight: 16,
    },
    messageIconContainer: {
        position: 'relative',
        width: 24,
        height: 24,
    },
    unreadBadge: {
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#fff',
        zIndex: 1,
    },
    unreadBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
    },
    activeHeaderTabText: {
        color: '#262626',
    },
    refreshButton: {
        padding: 16,
        backgroundColor: '#2196F3',
        borderRadius: 8,
        marginTop: 16,
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    endOfListContainer: {
        padding: 16,
        backgroundColor: '#fff',
        marginBottom: 8,
    },
    endOfListText: {
        color: '#8E8E8E',
        textAlign: 'center',
    },
});

export default ActivitiesScreen; 