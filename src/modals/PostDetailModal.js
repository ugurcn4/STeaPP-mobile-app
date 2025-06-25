import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Dimensions
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import Activity from '../components/Activity';

const { width } = Dimensions.get('window');

const PostDetailModal = ({
    visible,
    onClose,
    selectedPost,
    currentPosts,
    currentUserId,
    onLikePress,
    onCommentPress,
    onPostUpdate,
    navigation
}) => {
    const [postHeights, setPostHeights] = useState({});
    const [initialScrollDone, setInitialScrollDone] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const listRef = useRef(null);

    const selectedIndex = currentPosts.findIndex(post => post.id === selectedPost?.id);

    // Modal kapandığında state'leri sıfırlayalım
    useEffect(() => {
        if (!visible) {
            setInitialScrollDone(false);
            // Modal tamamen kapandığında isClosing'i sıfırla
            const timeout = setTimeout(() => {
                setIsClosing(false);
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [visible]);

    // Modal açıldığında scroll işlemini yapalım
    useEffect(() => {
        if (visible && selectedPost && !initialScrollDone && !isClosing) {
            scrollToSelectedIndex();
        }
    }, [visible, selectedPost, isClosing]);

    // Güvenli kapanma işlemi için bir wrapper fonksiyon
    const handleClose = () => {
        if (isClosing) return; // Eğer zaten kapanıyorsa tekrar tetiklemeyi önle
        
        setIsClosing(true);
        onClose();
    };

    // Scroll işlemini kontrol eden fonksiyon
    const scrollToSelectedIndex = () => {
        if (!selectedPost || initialScrollDone || !listRef.current) return;

        const selectedIndex = currentPosts.findIndex(post => post.id === selectedPost?.id);

        if (selectedIndex !== -1) {
            setTimeout(() => {
                try {
                    listRef.current.scrollToIndex({
                        index: selectedIndex,
                        animated: false,
                        viewPosition: 0
                    });
                } catch (error) {
                }
                setInitialScrollDone(true);
            }, 50);
        }
    };

    // Optimize edilmiş renderItem fonksiyonu
    const renderItem = useCallback(({ item }) => (
        <View
            onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                setPostHeights(prev => ({
                    ...prev,
                    [item.id]: height
                }));
            }}
            style={styles.postContainer}
        >
            <Activity
                activity={item}
                onLikePress={() => onLikePress(item.id)}
                onCommentPress={(comment, replyToId) => {
                    onCommentPress(item.id, comment, replyToId);
                }}
                isLiked={item.likedBy?.includes(currentUserId)}
                currentUserId={currentUserId}
                onUpdate={(updatedPost) => {
                    onPostUpdate(updatedPost);
                }}
                navigation={navigation}
            />
        </View>
    ), [currentUserId, onLikePress, onCommentPress, onPostUpdate, navigation]);

    // Optimize edilmiş keyExtractor
    const keyExtractor = useCallback((item) => item.id, []);

    return (
        <Modal
            visible={visible && !isClosing}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity
                        onPress={handleClose}
                        style={styles.backButton}
                        disabled={isClosing}
                    >
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Gönderi Detayı</Text>
                    <View style={{ width: 24 }} />
                </View>
                {selectedPost && (
                    <FlashList
                        ref={listRef}
                        data={currentPosts}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.modalContent}
                        estimatedItemSize={500}
                        estimatedListSize={{
                            height: Dimensions.get('window').height,
                            width: Dimensions.get('window').width
                        }}
                        initialScrollIndex={selectedIndex}
                        getItemType={(item) => 'post'}
                        onScrollToIndexFailed={(info) => {
                            setTimeout(() => {
                                if (listRef.current) {
                                    try {
                                        listRef.current.scrollToIndex({
                                            index: selectedIndex,
                                            animated: false
                                        });
                                    } catch (error) {
                                    }
                                }
                            }, 200);
                        }}
                        scrollEventThrottle={16}
                        maintainVisibleContentPosition={{
                            minIndexForVisible: 0,
                        }}
                        overrideItemLayout={(layout, item) => {
                            layout.size = postHeights[item.id] || 500;
                        }}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
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
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    backButton: {
        padding: 4,
    },
    modalContent: {
        paddingBottom: 20,
        paddingTop: 0,
    },
    postContainer: {
        backgroundColor: '#fff',
        marginBottom: 1,
        marginTop: 0,
        width: '100%',
        flex: 1
    },
    listContainer: {
        flex: 1,
        width: '100%'
    }
});

export default PostDetailModal; 