import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Text,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Dimensions,
    Modal,
    Animated,
    Easing,
    Platform
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import Activity from '../components/Activity';
import FastImage from 'react-native-fast-image';
import { fetchLikedPosts, fetchArchivedPosts, toggleLikePost, addComment, deleteComment, fetchArchiveGroups } from '../services/postService';
import { getAuth } from 'firebase/auth';
import PostDetailModal from '../modals/PostDetailModal';

const { width } = Dimensions.get('window');
const GRID_SIZE = width / 3;
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

// Shimmer animasyonu bileşeni
const ShimmerEffect = ({ width, height, style }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: 2000,
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

// Grid görünümü için yer tutucu bileşen
const GridSkeleton = React.memo(() => {
    // Daha az yer tutucu kullanarak başlangıç yüklemesini hızlandıralım
    const skeletonItems = new Array(15).fill(null);

    return (
        <View style={[styles.gridContainer, styles.flashListContainer]}>
            <FlashList
                data={skeletonItems}
                numColumns={3}
                renderItem={({ index }) => (
                    <View key={`grid-skeleton-${index}`} style={styles.skeletonGridItem}>
                        <ShimmerEffect
                            width={GRID_SIZE - 2}
                            height={GRID_SIZE - 2}
                            style={{ borderRadius: 8 }}
                        />
                        <View style={styles.skeletonOverlay}>
                            <View style={styles.statsContainer}>
                                <View style={[styles.skeletonStatItem, styles.likeSkeletonStatItem]} />
                                <View style={[styles.skeletonStatItem, styles.commentSkeletonStatItem]} />
                            </View>
                        </View>
                    </View>
                )}
                keyExtractor={(_, index) => `skeleton-${index}`}
                scrollEnabled={false}
                estimatedItemSize={GRID_SIZE}
            />
        </View>
    );
});

// Koleksiyon görünümü için yer tutucu bileşen
const CollectionSkeleton = React.memo(() => {
    const skeletonItems = new Array(9).fill(null);

    return (
        <View style={[styles.collectionsContainer, styles.flashListContainer]}>
            <FlashList
                data={skeletonItems}
                numColumns={3}
                renderItem={({ index }) => (
                    <View
                        key={`collection-skeleton-${index}`}
                        style={[
                            styles.skeletonCollectionCard,
                            index % 3 !== 2 && { marginRight: 8 }
                        ]}
                    >
                        <View style={styles.skeletonCollectionEmoji}>
                            <ShimmerEffect
                                width={48}
                                height={48}
                                style={{ borderRadius: 24 }}
                            />
                        </View>
                        <View style={styles.collectionInfo}>
                            <View style={styles.skeletonCollectionName}>
                                <ShimmerEffect width={'80%'} height={12} style={{ borderRadius: 6 }} />
                            </View>
                            <View style={styles.skeletonCollectionDescription}>
                                <ShimmerEffect width={'100%'} height={8} style={{ borderRadius: 4 }} />
                            </View>
                            <View style={styles.skeletonPostCount}>
                                <ShimmerEffect width={'40%'} height={8} style={{ borderRadius: 4 }} />
                            </View>
                        </View>
                    </View>
                )}
                keyExtractor={(_, index) => `collection-skeleton-${index}`}
                scrollEnabled={false}
                estimatedItemSize={GRID_SIZE}
                columnWrapperStyle={styles.row}
            />
        </View>
    );
});

const LikedPostsScreen = ({ navigation }) => {
    const [selectedPost, setSelectedPost] = useState(null);
    const [activeTab, setActiveTab] = useState('liked'); // 'liked' veya 'archived'
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const listRef = useRef(null);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const POSTS_PER_PAGE = 21;
    const INITIAL_POSTS_TO_RENDER = 12;

    const gridKey = useRef(`grid-${activeTab}`);

    // Her sekme için ayrı veri ve yükleme durumu tutuyoruz
    const [tabData, setTabData] = useState({
        liked: {
            posts: [],
            lastDoc: null,
            hasMore: true,
            loading: true,
            refreshing: false
        },
        archived: {
            posts: [],
            collections: [],
            loading: true,
            refreshing: false
        }
    });

    // Aktif sekmenin verilerine kolay erişim için
    const activeTabData = tabData[activeTab];

    const loadPosts = async (isInitial = true) => {
        try {
            if (isInitial) {
                setTabData(prev => ({
                    ...prev,
                    [activeTab]: {
                        ...prev[activeTab],
                        loading: true,
                        posts: [] // İlk yüklemede listeyi temizle
                    }
                }));
            } else {
                setTabData(prev => ({
                    ...prev,
                    [activeTab]: {
                        ...prev[activeTab],
                        paginationLoading: true
                    }
                }));
            }

            if (!activeTabData.hasMore && !isInitial && activeTab === 'liked') return;

            if (activeTab === 'liked') {
                const { posts: newPosts, lastVisible } = await fetchLikedPosts(
                    currentUser.uid,
                    POSTS_PER_PAGE,
                    isInitial ? null : activeTabData.lastDoc
                );

                // Yeni postları mevcut postlarla birleştir
                const updatedPosts = isInitial ? newPosts : [...activeTabData.posts, ...newPosts];

                setTabData(prev => ({
                    ...prev,
                    liked: {
                        ...prev.liked,
                        posts: updatedPosts,
                        lastDoc: lastVisible,
                        hasMore: newPosts.length === POSTS_PER_PAGE,
                        loading: false,
                        paginationLoading: false,
                        refreshing: false
                    }
                }));
            }
        } catch (error) {
            console.error('Gönderiler yüklenirken hata:', error);
            setTabData(prev => ({
                ...prev,
                [activeTab]: {
                    ...prev[activeTab],
                    loading: false,
                    paginationLoading: false,
                    refreshing: false
                }
            }));
        }
    };

    useEffect(() => {
        if (activeTab === 'liked' && tabData.liked.posts.length === 0) {
            loadPosts();
        } else if (activeTab === 'archived' && tabData.archived.collections.length === 0) {
            loadCollections();
        }
    }, [activeTab]);

    const handleRefresh = async () => {
        setTabData(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                refreshing: true
            }
        }));

        if (activeTab === 'liked') {
            await loadPosts(true);
        } else {
            await loadCollections();
        }
    };

    const handlePostUpdate = (updatedPost) => {
        setTabData(prev => {
            if (activeTab === 'liked') {
                return {
                    ...prev,
                    liked: {
                        ...prev.liked,
                        posts: prev.liked.posts.map(post =>
                            post.id === updatedPost.id ? updatedPost : post
                        )
                    }
                };
            } else {
                // Arşivlenenler sekmesindeyken, tüm arşivlenen gönderileri güncelle
                // Bu, ortak koleksiyonlardaki gönderilerin de düzgün güncellenmesini sağlar
                const updatedPosts = prev.archived.posts.map(post =>
                    post.id === updatedPost.id ? updatedPost : post
                );

                return {
                    ...prev,
                    archived: {
                        ...prev.archived,
                        posts: updatedPosts
                    }
                };
            }
        });
    };

    const handleLikePress = async (postId) => {
        if (!currentUser?.uid) return;

        try {
            const isLiked = await toggleLikePost(postId, currentUser.uid);

            // Aktif sekmeye göre doğru veri kümesini güncelleyelim
            setTabData(prevTabData => {
                if (activeTab === 'liked') {
                    // Beğenilen postlar sekmesindeki güncelleme
                    const updatedPosts = prevTabData.liked.posts.map(post => {
                        if (post.id === postId) {
                            const currentLikes = post.stats?.likes || 0;
                            const newLikes = Math.max(0, currentLikes + (isLiked ? 1 : -1));

                            // Beğeni kaldırıldıysa postu listeden kaldır
                            if (!isLiked) {
                                return null;
                            }

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
                    }).filter(Boolean); // null olan postları filtrele

                    return {
                        ...prevTabData,
                        liked: {
                            ...prevTabData.liked,
                            posts: updatedPosts
                        }
                    };
                } else {
                    // Arşivlenen postlar sekmesindeki güncelleme
                    const updatedPosts = prevTabData.archived.posts.map(post => {
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
                    });

                    return {
                        ...prevTabData,
                        archived: {
                            ...prevTabData.archived,
                            posts: updatedPosts
                        }
                    };
                }
            });
        } catch (error) {
            console.error('Beğeni hatası:', error);
        }
    };

    const handleCommentSubmit = async (postId, comment, replyToId = null) => {
        if (!currentUser?.uid) return;

        try {
            if (comment === 'delete') {
                await deleteComment(postId, replyToId, currentUser.uid);

                // Aktif sekmeye göre doğru veri kümesini güncelleyelim
                setTabData(prevTabData => {
                    if (activeTab === 'liked') {
                        // Beğenilen postlar sekmesindeki güncelleme
                        const updatedPosts = prevTabData.liked.posts.map(post => {
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
                        });

                        return {
                            ...prevTabData,
                            liked: {
                                ...prevTabData.liked,
                                posts: updatedPosts
                            }
                        };
                    } else {
                        // Arşivlenen postlar sekmesindeki güncelleme
                        const updatedPosts = prevTabData.archived.posts.map(post => {
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
                        });

                        return {
                            ...prevTabData,
                            archived: {
                                ...prevTabData.archived,
                                posts: updatedPosts
                            }
                        };
                    }
                });
            } else {
                const newComment = await addComment(postId, currentUser.uid, comment, replyToId);

                // Aktif sekmeye göre doğru veri kümesini güncelleyelim
                setTabData(prevTabData => {
                    if (activeTab === 'liked') {
                        // Beğenilen postlar sekmesindeki güncelleme
                        const updatedPosts = prevTabData.liked.posts.map(post => {
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
                        });

                        return {
                            ...prevTabData,
                            liked: {
                                ...prevTabData.liked,
                                posts: updatedPosts
                            }
                        };
                    } else {
                        // Arşivlenen postlar sekmesindeki güncelleme
                        const updatedPosts = prevTabData.archived.posts.map(post => {
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
                        });

                        return {
                            ...prevTabData,
                            archived: {
                                ...prevTabData.archived,
                                posts: updatedPosts
                            }
                        };
                    }
                });
            }
        } catch (error) {
            console.error('Yorum işlemi hatası:', error);
        }
    };

    const loadCollections = async () => {
        try {
            const userCollections = await fetchArchiveGroups(currentUser.uid);
            const archivedPosts = await fetchArchivedPosts(currentUser.uid);

            const collectionsWithCount = userCollections.map(collection => ({
                ...collection,
                postCount: archivedPosts.filter(post =>
                    post.archiveGroups?.includes(collection.id)
                ).length
            }));

            setTabData(prev => ({
                ...prev,
                archived: {
                    ...prev.archived,
                    collections: collectionsWithCount,
                    posts: archivedPosts,
                    loading: false,
                    refreshing: false
                }
            }));
        } catch (error) {
            console.error('Koleksiyonlar yüklenirken hata:', error);
            setTabData(prev => ({
                ...prev,
                archived: {
                    ...prev.archived,
                    loading: false,
                    refreshing: false
                }
            }));
        }
    };

    const loadArchivedPosts = async (collectionId = null) => {
        try {
            setTabData(prev => ({
                ...prev,
                archived: {
                    ...prev.archived,
                    loading: true
                }
            }));

            // Tüm arşivlenen gönderileri çek
            const archivedPosts = await fetchArchivedPosts(currentUser.uid);

            if (collectionId) {

                // Kullanıcının koleksiyonunun türünü belirle
                const selectedCollection = tabData.archived.collections.find(c => c.id === collectionId);
                const isSharedCollection = selectedCollection?.isShared === true;

                let filteredPosts = [];

                if (isSharedCollection) {
                    // Ortak koleksiyon için archiveGroups alanına göre filtrele
                    filteredPosts = archivedPosts.filter(post =>
                        post.archiveGroups?.includes(collectionId)
                    );
                } else {
                    // Normal koleksiyon için kullanıcının archivedBy alanında olup olmadığına ve
                    // archiveGroups alanına göre filtrele
                    filteredPosts = archivedPosts.filter(post =>
                        post.archivedBy?.includes(currentUser.uid) &&
                        post.archiveGroups?.includes(collectionId)
                    );
                }

                setTabData(prev => ({
                    ...prev,
                    archived: {
                        ...prev.archived,
                        posts: filteredPosts,
                        loading: false
                    }
                }));
            } else {
                setTabData(prev => ({
                    ...prev,
                    archived: {
                        ...prev.archived,
                        posts: archivedPosts,
                        loading: false
                    }
                }));
            }
        } catch (error) {
            console.error('Arşivlenen gönderiler yüklenirken hata:', error);
            setTabData(prev => ({
                ...prev,
                archived: {
                    ...prev.archived,
                    loading: false
                }
            }));
        }
    };

    const handleCollectionPress = (collection) => {
        // Önce koleksiyonu seçelim
        setSelectedCollection(collection);

        // Mevcut postları temizleyelim ve loading durumunu true yapalım
        setTabData(prev => ({
            ...prev,
            archived: {
                ...prev.archived,
                posts: [], // Postları temizle
                loading: true
            }
        }));

        // Sonra yeni postları yükleyelim
        loadArchivedPosts(collection.id);
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View style={styles.headerTabs}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('liked')}
                        style={styles.headerTab}
                    >
                        <Text style={[
                            styles.headerTabText,
                            activeTab === 'liked' && styles.activeHeaderTabText
                        ]}>
                            Beğenilenler
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTabDivider}>|</Text>
                    <TouchableOpacity
                        onPress={() => setActiveTab('archived')}
                        style={styles.headerTab}
                    >
                        <Text style={[
                            styles.headerTabText,
                            activeTab === 'archived' && styles.activeHeaderTabText
                        ]}>
                            Arşivlenenler
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={{ width: 24 }} />
            </View>
        </View>
    );

    // Performans için memoize edilmiş render fonksiyonları
    const renderGridItem = useCallback(({ item }) => (
        <TouchableOpacity
            onPress={() => setSelectedPost(item)}
            style={styles.gridItem}
        >
            <FastImage
                source={{ uri: item.imageUrl }}
                style={styles.gridImage}
                resizeMode={FastImage.resizeMode.cover}
                priority={FastImage.priority.high}
            />
            <View style={styles.gridOverlay}>
                <View style={styles.statsContainer}>
                    <View style={[styles.statItem, styles.likeStatItem]}>
                        <Ionicons name="heart" size={16} color="#FF4B6A" />
                        <Text style={[styles.statText, styles.likeStatText]}>
                            {item.stats?.likes || 0}
                        </Text>
                    </View>
                    <View style={[styles.statItem, styles.commentStatItem]}>
                        <Ionicons name="chatbubble" size={16} color="#4B9DFF" />
                        <Text style={[styles.statText, styles.commentStatText]}>
                            {item.stats?.comments || 0}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    ), []);

    const renderCollectionItem = useCallback(({ item, index }) => (
        <TouchableOpacity
            style={[
                styles.collectionCard,
                index % 3 !== 2 && { marginRight: 8 }
            ]}
            onPress={() => handleCollectionPress(item)}
        >
            <View style={styles.collectionEmoji}>
                <Text style={styles.emojiText}>{item.emoji}</Text>
            </View>
            <View style={styles.collectionInfo}>
                <Text style={styles.collectionName} numberOfLines={1}>
                    {item.name}
                </Text>
                {item.description && (
                    <Text style={styles.collectionDescription} numberOfLines={1}>
                        {item.description}
                    </Text>
                )}
                <Text style={styles.postCount}>
                    {item.postCount} gönderi
                </Text>
            </View>
        </TouchableOpacity>
    ), []);

    // Grid görünümü için optimize edilmiş liste
    const GridList = useCallback(() => (
        <FlashList
            key={gridKey.current}
            data={tabData.liked.posts}
            numColumns={3}
            renderItem={renderGridItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.gridContainer}
            refreshing={tabData.liked.refreshing}
            onRefresh={handleRefresh}
            estimatedItemSize={GRID_SIZE}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            initialNumToRender={INITIAL_POSTS_TO_RENDER}
            ListFooterComponent={() => (
                tabData.liked.paginationLoading ? (
                    <View style={styles.footerLoader}>
                        <ActivityIndicator color="#2196F3" />
                    </View>
                ) : null
            )}
        />
    ), [tabData.liked]);

    // Koleksiyonlar listesi
    const CollectionsList = useCallback(() => (
        <FlashList
            data={tabData.archived.collections}
            renderItem={renderCollectionItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.collectionsContainer}
            numColumns={3}
            columnWrapperStyle={styles.row}
            refreshing={tabData.archived.refreshing}
            onRefresh={handleRefresh}
            estimatedItemSize={GRID_SIZE}
            initialNumToRender={INITIAL_POSTS_TO_RENDER}
        />
    ), [tabData.archived]);

    // Seçili koleksiyon görünümü için optimize edilmiş liste
    const SelectedCollectionList = useCallback(() => {
        // Sadece seçili koleksiyona ait postları filtreleyelim
        const isSharedCollection = selectedCollection?.isShared === true;

        // Filtereleme mantığını iyileştiriyoruz
        let filteredPosts = [];

        try {
            if (isSharedCollection) {
                // Ortak koleksiyon için archiveGroups alanına göre filtrele
                // Bu filtreleme archiveGroups alanı var mı kontrolü yapıyor ve bu alan varsa seçili koleksiyonda mı diye bakıyor
                filteredPosts = tabData.archived.posts.filter(post => {
                    if (!post.archiveGroups) return false;
                    return post.archiveGroups.includes(selectedCollection.id);
                });
            } else {
                // Normal koleksiyon için kullanıcının archivedBy alanında olup olmadığına ve
                // archiveGroups alanına göre filtrele
                filteredPosts = tabData.archived.posts.filter(post => {
                    return post.archivedBy?.includes(currentUser.uid) &&
                        post.archiveGroups?.includes(selectedCollection.id);
                });
            }
        } catch (error) {
            console.error('Gönderileri filtrelemede hata:', error);
        }

        return (
            <>
                <View style={styles.selectedCollectionHeader}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => {
                            setSelectedCollection(null);
                            loadCollections();
                        }}
                    >
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.selectedCollectionTitle}>
                        {selectedCollection.name}
                        {isSharedCollection && (
                            <Text style={styles.sharedCollectionBadge}> (Ortak)</Text>
                        )}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                {tabData.archived.loading ? (
                    <GridSkeleton />
                ) : (
                    <FlashList
                        data={filteredPosts}
                        numColumns={3}
                        renderItem={renderGridItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.gridContainer}
                        refreshing={tabData.archived.refreshing}
                        onRefresh={handleRefresh}
                        estimatedItemSize={GRID_SIZE}
                        initialNumToRender={INITIAL_POSTS_TO_RENDER}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="images-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyText}>
                                    Bu koleksiyonda henüz gönderi yok
                                </Text>
                                {isSharedCollection && (
                                    <Text style={styles.emptySubText}>
                                        Ortak koleksiyonlara diğer üyeler de gönderi ekleyebilir
                                    </Text>
                                )}
                            </View>
                        )}
                    />
                )}
            </>
        );
    }, [tabData.archived, selectedCollection, currentUser.uid]);

    const handleLoadMore = () => {
        if (!activeTabData.loading && !activeTabData.paginationLoading && activeTabData.hasMore && activeTab === 'liked') {
            loadPosts(false);
        }
    };

    const renderArchivedContent = useCallback(() => {
        if (selectedCollection) {
            return <SelectedCollectionList />;
        }

        return tabData.archived.collections.length > 0 ? (
            <CollectionsList />
        ) : (
            <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>
                    Henüz koleksiyon oluşturmadınız
                </Text>
                <Text style={styles.emptySubText}>
                    Gönderilerinizi düzenlemek için koleksiyon oluşturun
                </Text>
            </View>
        );
    }, [selectedCollection, tabData.archived]);

    const renderDetailModal = () => {
        // Aktif sekmeye göre doğru veri kaynağını seçelim
        let currentPosts = [];

        if (activeTab === 'liked') {
            currentPosts = tabData.liked.posts;
        } else {
            // Ortak koleksiyon görüntüleniyorsa
            if (selectedCollection && selectedCollection.isShared) {
                // Ortak koleksiyonda olup, seçili koleksiyonda olan tüm gönderileri göster
                currentPosts = tabData.archived.posts.filter(post =>
                    post.archiveGroups?.includes(selectedCollection.id)
                );
            } else {
                // Normal koleksiyon veya tüm kaydedilenler için
                currentPosts = tabData.archived.posts.filter(post =>
                    post.archivedBy?.includes(currentUser.uid)
                );
            }
        }

        return (
            <PostDetailModal
                visible={selectedPost !== null}
                onClose={() => setSelectedPost(null)}
                selectedPost={selectedPost}
                currentPosts={currentPosts}
                currentUserId={currentUser?.uid}
                onLikePress={handleLikePress}
                onCommentPress={handleCommentSubmit}
                onPostUpdate={(updatedPost) => {
                    handlePostUpdate(updatedPost);
                    if (selectedPost && updatedPost.id === selectedPost.id) {
                        // Sadece seçili gönderi güncellendiğinde state'i güncelle
                        setSelectedPost(updatedPost);
                    }
                }}
                navigation={navigation}
            />
        );
    };

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
                {renderHeader()}
                {activeTabData.loading &&
                    (activeTab === 'liked' ? tabData.liked.posts.length === 0 : tabData.archived.collections.length === 0) ? (
                    activeTab === 'liked' ? <GridSkeleton /> : <CollectionSkeleton />
                ) : (
                    <View style={styles.flashListContainer}>
                        {activeTab === 'liked' ? <GridList /> : renderArchivedContent()}
                        {renderDetailModal()}
                    </View>
                )}
            </SafeAreaView>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    flashListContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
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
        fontSize: 18,
        fontWeight: '600',
        color: '#8E8E8E',
    },
    activeHeaderTabText: {
        color: '#262626',
    },
    headerTabDivider: {
        fontSize: 18,
        fontWeight: '300',
        color: '#8E8E8E',
        marginHorizontal: 8,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        fontWeight: '600',
    },
    emptySubText: {
        marginTop: 8,
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    gridContainer: {
        flex: 1,
        padding: 1,
    },
    gridItem: {
        width: GRID_SIZE - 2,
        height: GRID_SIZE - 2,
        margin: 1,
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
    },
    gridImage: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
    },
    gridOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: 6,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
        backdropFilter: 'blur(5px)',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
        elevation: 2,
    },
    likeStatItem: {
        backgroundColor: 'rgba(255,75,106,0.25)',
    },
    commentStatItem: {
        backgroundColor: 'rgba(75,157,255,0.25)',
    },
    statText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    likeStatText: {
        color: '#FFE8EC',
    },
    commentStatText: {
        color: '#E8F2FF',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
        zIndex: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        paddingBottom: 15,
    },
    modalContent: {
        paddingBottom: 20,
        paddingTop: 0,
    },
    postContainer: {
        backgroundColor: '#fff',
        marginBottom: 1,
        marginTop: 0,
    },
    collectionsContainer: {
        flex: 1,
        padding: 8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    collectionCard: {
        flex: 1,
        maxWidth: (width - 32) / 3, // 3 sütun için eşit genişlik
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        marginBottom: 8,
    },
    collectionEmoji: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    emojiText: {
        fontSize: 24,
    },
    collectionInfo: {
        flex: 1,
    },
    collectionName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    collectionDescription: {
        fontSize: 13,
        color: '#666',
        marginBottom: 4,
        lineHeight: 18,
    },
    postCount: {
        fontSize: 12,
        color: '#2196F3',
        fontWeight: '500',
        marginTop: 'auto', // Alt kısma sabitlemek için
    },
    selectedCollectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    selectedCollectionTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerLoader: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    // Skeleton styles
    skeletonGridItem: {
        width: GRID_SIZE - 2,
        height: GRID_SIZE - 2,
        margin: 1,
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    skeletonImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
        backgroundColor: '#e0e0e0',
    },
    skeletonOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 6,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
    },
    skeletonStatItem: {
        width: 40,
        height: 18,
        borderRadius: 12,
        marginHorizontal: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    likeSkeletonStatItem: {
        backgroundColor: 'rgba(255,75,106,0.15)',
    },
    commentSkeletonStatItem: {
        backgroundColor: 'rgba(75,157,255,0.15)',
    },
    skeletonCollectionCard: {
        flex: 1,
        maxWidth: '31%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        marginBottom: 8,
    },
    skeletonCollectionEmoji: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginBottom: 12,
        overflow: 'hidden',
    },
    skeletonCollectionName: {
        width: '80%',
        height: 12,
        marginBottom: 8,
        overflow: 'hidden',
        borderRadius: 6,
    },
    skeletonCollectionDescription: {
        width: '100%',
        height: 8,
        marginBottom: 4,
        overflow: 'hidden',
        borderRadius: 4,
    },
    skeletonPostCount: {
        width: '40%',
        height: 8,
        marginTop: 8,
        overflow: 'hidden',
        borderRadius: 4,
    },
    sharedCollectionBadge: {
        fontSize: 14,
        color: '#2196F3',
        fontWeight: '500',
        marginLeft: 6,
    },
});

export default LikedPostsScreen; 