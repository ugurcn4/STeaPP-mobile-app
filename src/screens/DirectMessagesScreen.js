import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    TextInput,
    Alert,
    Animated
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { getCurrentUserUid } from '../services/friendFunctions';
import { getRecentChats, deleteChat, deleteChatForEveryone } from '../services/messageService';
import NewChatModal from '../components/NewChatModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FastImage from 'react-native-fast-image';
import VerificationBadge from '../components/VerificationBadge';
import { checkUserVerification } from '../utils/verificationUtils';

const DirectMessagesScreen = ({ navigation, route }) => {
    const [chats, setChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isNewChatModalVisible, setIsNewChatModalVisible] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [swipedChatId, setSwipedChatId] = useState(null);
    const [verifications, setVerifications] = useState({});

    useEffect(() => {
        const getUserId = async () => {
            const uid = await getCurrentUserUid();
            setCurrentUserId(uid);
        };
        getUserId();
    }, []);

    useEffect(() => {
        let unsubscribe;

        const loadChats = async () => {
            if (!currentUserId) return;

            try {
                const cachedChats = await AsyncStorage.getItem(`chats_${currentUserId}`);
                if (cachedChats) {
                    setChats(JSON.parse(cachedChats));
                    setIsLoading(false);
                }

                unsubscribe = getRecentChats(currentUserId, (recentChats) => {
                    setChats(recentChats);
                    setIsLoading(false);
                    AsyncStorage.setItem(`chats_${currentUserId}`, JSON.stringify(recentChats));
                });
            } catch (error) {
                console.error('Sohbetler yüklenirken hata:', error);
                setIsLoading(false);
            }
        };

        if (currentUserId) {
            loadChats();
        }

        return () => unsubscribe && unsubscribe();
    }, [currentUserId]);

    useEffect(() => {
        const initialChat = route.params?.initialChat;
        if (initialChat) {
            navigation.navigate('Chat', { friend: initialChat });
        }
    }, [route.params]);

    useEffect(() => {
        const loadVerifications = async () => {
            if (!chats.length) return;

            const verificationData = {};

            for (const chat of chats) {
                try {
                    const status = await checkUserVerification(chat.user.id);
                    verificationData[chat.user.id] = status;
                } catch (error) {
                    console.error('Doğrulama durumu kontrolünde hata:', error);
                }
            }

            setVerifications(verificationData);
        };

        loadVerifications();
    }, [chats]);

    const handleNewChat = () => {
        setIsNewChatModalVisible(true);
    };

    const handleSelectFriend = (friend) => {
        setIsNewChatModalVisible(false);
        navigation.navigate('Chat', { friend });
    };

    const handleDeleteChat = (chatId) => {
        Alert.alert(
            'Sohbeti Sil',
            'Bu sohbeti silmek istediğinizden emin misiniz?',
            [
                {
                    text: 'İptal',
                    style: 'cancel'
                },
                {
                    text: 'Benden Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await deleteChat(chatId, currentUserId);
                            if (result.success) {
                                setChats(prevChats => prevChats.filter(chat => chat.chatId !== chatId));
                            } else {
                                Alert.alert('Hata', 'Sohbet silinirken bir hata oluştu');
                            }
                        } catch (error) {
                            Alert.alert('Hata', 'Sohbet silinirken bir hata oluştu');
                        }
                    }
                },
                {
                    text: 'Herkesten Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await deleteChatForEveryone(chatId);
                            if (result.success) {
                                setChats(prevChats => prevChats.filter(chat => chat.chatId !== chatId));
                            } else {
                                Alert.alert('Hata', 'Sohbet silinirken bir hata oluştu');
                            }
                        } catch (error) {
                            Alert.alert('Hata', 'Sohbet silinirken bir hata oluştu');
                        }
                    }
                }
            ]
        );
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <BlurView intensity={100} style={styles.headerBlur}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={28} color="#25D220" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Mesajlar</Text>
                    <TouchableOpacity
                        onPress={handleNewChat}
                        style={styles.newChatButton}
                    >
                        <Ionicons name="create-outline" size={24} color="#25D220" />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Ara..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#666"
                    />
                </View>
            </BlurView>
        </View>
    );

    const renderChatItem = ({ item }) => {
        const rowTranslateAnimatedValue = new Animated.Value(0);
        const verification = verifications[item.user.id] || { hasBlueTick: false, hasGreenTick: false };

        const animateRow = (toValue) => {
            Animated.spring(rowTranslateAnimatedValue, {
                toValue,
                useNativeDriver: true,
                tension: 50,
                friction: 9
            }).start(() => {
                if (toValue === -100) {
                    setSwipedChatId(item.chatId);
                } else {
                    setSwipedChatId(null);
                }
            });
        };

        const renderLastMessage = () => {
            const message = item.lastMessage;
            if (!message) return 'Yeni sohbet';

            switch (message.mediaType) {
                case 'voice':
                    return '🎤 Sesli mesaj';
                case 'image':
                    return '📷 Fotoğraf';
                case 'document':
                    return '📎 Dosya';
                case 'story_reply':
                    return '💫 Hikayeye yanıt';
                default:
                    return message.message || 'Yeni sohbet';
            }
        };

        const formatTime = (timestamp) => {
            if (!timestamp || !timestamp.toDate) return '';

            try {
                const date = timestamp.toDate();
                const now = new Date();

                if (date.toDateString() === now.toDateString()) {
                    return date.toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else if (date.getFullYear() === now.getFullYear()) {
                    return date.toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long'
                    });
                } else {
                    return date.toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    });
                }
            } catch (error) {
                return '';
            }
        };

        return (
            <View style={styles.chatItemContainer}>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteChat(item.chatId)}
                    activeOpacity={0.9}
                >
                    <View style={styles.deleteButtonInner}>
                        <Ionicons name="trash" size={28} color="#fff" />
                    </View>
                </TouchableOpacity>

                <PanGestureHandler
                    onGestureEvent={({ nativeEvent }) => {
                        const { translationX } = nativeEvent;
                        if (translationX < 0 && translationX > -120) {
                            rowTranslateAnimatedValue.setValue(translationX);
                        }
                    }}
                    onHandlerStateChange={({ nativeEvent }) => {
                        if (nativeEvent.state === State.END) {
                            const { translationX, velocityX } = nativeEvent;

                            if (translationX < -40 || velocityX < -500) {
                                animateRow(-80);
                            } else {
                                animateRow(0);
                            }
                        }
                    }}
                >
                    <Animated.View
                        style={[
                            styles.chatItem,
                            {
                                transform: [{
                                    translateX: rowTranslateAnimatedValue
                                }]
                            }
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.chatItemContent}
                            activeOpacity={0.7}
                            onPress={() => {
                                if (swipedChatId === item.chatId) {
                                    animateRow(0);
                                } else {
                                    navigation.navigate('Chat', { friend: item.user });
                                }
                            }}
                        >
                            <FastImage
                                source={
                                    item.user.profilePicture
                                        ? {
                                            uri: item.user.profilePicture,
                                            priority: FastImage.priority.normal,
                                            cache: FastImage.cacheControl.immutable
                                        }
                                        : {
                                            uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}&background=random`,
                                            priority: FastImage.priority.normal,
                                            cache: FastImage.cacheControl.web
                                        }
                                }
                                style={styles.avatar}
                            />
                            {item.user.isOnline && <View style={styles.onlineIndicator} />}

                            <View style={styles.chatInfo}>
                                <View style={styles.chatHeader}>
                                    <View style={styles.userNameContainer}>
                                        <Text style={styles.userName}>{item.user.name}</Text>
                                        <VerificationBadge
                                            hasBlueTick={verification.hasBlueTick}
                                            hasGreenTick={verification.hasGreenTick}
                                            size={12}
                                            style={styles.verificationBadge}
                                        />
                                    </View>
                                    <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
                                </View>
                                <View style={styles.lastMessageContainer}>
                                    <Text style={styles.lastMessage} numberOfLines={1}>
                                        {renderLastMessage()}
                                    </Text>
                                    {item.unreadCount > 0 && (
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </PanGestureHandler>
            </View>
        );
    };

    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#666" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
            <Text style={styles.emptyText}>
                Arkadaşlarınla sohbet etmeye başla!
            </Text>
        </View>
    );

    const filteredChats = useMemo(() => {
        return chats.filter(chat =>
            chat.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (chat.lastMessage?.message || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [chats, searchQuery]);

    const keyExtractor = useCallback((item) => item.chatId, []);

    const getItemLayout = useCallback((data, index) => ({
        length: 82,
        offset: 82 * index,
        index,
    }), []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <StatusBar barStyle="dark-content" />
                    {renderHeader()}

                    <FlatList
                        data={filteredChats}
                        renderItem={renderChatItem}
                        keyExtractor={keyExtractor}
                        getItemLayout={getItemLayout}
                        ListEmptyComponent={renderEmptyComponent}
                        contentContainerStyle={styles.listContainer}
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={10}
                        windowSize={10}
                        initialNumToRender={10}
                    />

                    <NewChatModal
                        visible={isNewChatModalVisible}
                        onClose={() => setIsNewChatModalVisible(false)}
                        onSelectFriend={handleSelectFriend}
                    />
                </View>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    headerContainer: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    headerBlur: {
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        margin: 16,
        marginTop: 0,
        borderRadius: 10,
        padding: 8,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    listContainer: {
        flexGrow: 1,
    },
    chatItemContainer: {
        backgroundColor: '#FF3B30',
        overflow: 'hidden',
        marginBottom: StyleSheet.hairlineWidth,
        position: 'relative',
    },
    chatItem: {
        backgroundColor: '#fff',
    },
    chatItemContent: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        backgroundColor: '#fff',
        minHeight: 82,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    onlineIndicator: {
        position: 'absolute',
        left: 55,
        top: 45,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
        borderColor: '#fff',
    },
    chatInfo: {
        flex: 1,
        marginLeft: 12,
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    userNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 4,
        marginRight: 2,
    },
    verificationBadge: {
        marginLeft: 2,
        marginBottom: 4,
    },
    timestamp: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    lastMessageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
        flex: 1,
    },
    unreadBadge: {
        backgroundColor: '#FF3B30',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
        marginLeft: 8,
    },
    unreadCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyIcon: {
        marginBottom: 16,
        opacity: 0.7,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    newChatButton: {
        padding: 8,
    },
    deleteButton: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 80,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButtonInner: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
    }
});

export default DirectMessagesScreen; 