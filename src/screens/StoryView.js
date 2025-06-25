import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    StatusBar,
    Text,
    ActivityIndicator,
    PanResponder,
    Animated,
    ScrollView,
    Platform,
    Alert,
    TextInput,
    Keyboard,
    KeyboardAvoidingView,
    ToastAndroid
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getStoryViewers, markStoryAsViewed, likeStory, deleteStory } from '../services/storyService';
import { getCurrentUserUid } from '../services/friendFunctions';
import { doc, onSnapshot, addDoc, collection, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Audio } from 'expo-av';
import { refreshTrackPreview } from '../services/musicService';

const { width, height } = Dimensions.get('window');

const StoryView = ({ route, navigation }) => {
    const { stories, user, isOwnStory, updateStories } = route.params;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [viewers, setViewers] = useState([]);
    const [showViewers, setShowViewers] = useState(false);
    const slideAnim = useRef(new Animated.Value(height)).current;
    const panY = useRef(new Animated.Value(0)).current;
    const [isLiked, setIsLiked] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [isPaused, setIsPaused] = useState(false);
    const progressInterval = useRef(null);
    const longPressTimeout = useRef(null);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [message, setMessage] = useState('');
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const messageInputRef = useRef(null);
    const [storySound, setStorySound] = useState(null);
    const [sound, setSound] = useState(null);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 20;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) {
                    if (storySound) {
                        storySound.unloadAsync();
                    }
                    Animated.timing(panY, {
                        toValue: height,
                        duration: 300,
                        useNativeDriver: true
                    }).start(() => navigation.goBack());
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        tension: 30,
                        useNativeDriver: true
                    }).start();
                }
            }
        })
    ).current;

    useEffect(() => {
        const handleStoryView = async () => {
            try {
                const currentUserId = await getCurrentUserUid();
                const currentStory = stories[currentIndex];

                if (currentUserId && !isOwnStory) {
                    // Görüntüleme kaydı ekle
                    const result = await markStoryAsViewed(currentStory.id, currentUserId);

                    // Görüntüleyenleri güncelle
                    if (isOwnStory) {
                        await fetchViewers();
                    }
                }
            } catch (error) {
                console.error('Hikaye görüntüleme hatası:', error);
            }
        };

        handleStoryView();

        const timer = setInterval(() => {
            if (!loading && !isTransitioning && progress < 1 && !showViewers && !isPaused) {
                // 10 saniye için progress artışını ayarla (0.01 = 1/100)
                setProgress(prev => prev + 0.01);
            }
        }, 100); // 100ms aralıklarla güncelle

        return () => clearInterval(timer);
    }, [currentIndex, loading, isTransitioning, showViewers, isPaused]);

    // Görüntüleyenleri getirme fonksiyonunu ayrı bir useEffect'te tutalım
    useEffect(() => {
        if (isOwnStory) {
            fetchViewers();
        }
    }, [currentIndex, isOwnStory]);

    useEffect(() => {
        if (isOwnStory && stories[currentIndex]) {
            const storyRef = doc(db, 'stories', stories[currentIndex].id);
            const unsubscribe = onSnapshot(storyRef, (doc) => {
                if (doc.exists()) {
                    const data = doc.data();
                    setViewers(data.viewedBy || []);
                }
            });

            return () => unsubscribe();
        }
    }, [currentIndex, isOwnStory]);

    useEffect(() => {
        const init = async () => {
            const uid = await getCurrentUserUid();
            setCurrentUserId(uid);

            // Mevcut hikayenin beğeni durumunu kontrol et
            const currentStory = stories[currentIndex];
            if (currentStory?.likes?.includes(uid)) {
                setIsLiked(true);
            } else {
                setIsLiked(false);
            }
        };

        init();
    }, [currentIndex]);

    useEffect(() => {
        const keyboardWillShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardWillHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardWillShowListener.remove();
            keyboardWillHideListener.remove();
        };
    }, []);

    const handleStoryTransition = (nextIndex) => {
        if (isTransitioning) return;
        setIsTransitioning(true);

        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            })
        ]).start(() => {
            setIsTransitioning(false);
            setCurrentIndex(nextIndex);
            setProgress(0);
        });
    };

    const handlePress = (event) => {
        const x = event.nativeEvent.locationX;
        if (x < width / 2) {
            if (currentIndex > 0) {
                handleStoryTransition(currentIndex - 1);
            }
        } else {
            if (currentIndex < stories.length - 1) {
                handleStoryTransition(currentIndex + 1);
            } else {
                if (storySound) {
                    storySound.unloadAsync();
                }
                navigation.goBack();
            }
        }
    };

    useEffect(() => {
        if (progress >= 1 && !isTransitioning) {
            if (currentIndex < stories.length - 1) {
                handleStoryTransition(currentIndex + 1);
            } else {
                if (storySound) {
                    storySound.unloadAsync();
                }
                navigation.goBack();
            }
        }
    }, [progress]);

    const fetchViewers = async () => {
        try {
            const currentStory = stories[currentIndex];
            const viewersList = await getStoryViewers(currentStory.id);
            setViewers(viewersList);
        } catch (error) {
            console.error('Görüntüleyenler alınamadı:', error);
        }
    };

    const toggleViewers = () => {
        if (showViewers) {
            // Panel'i kapat
            Animated.spring(slideAnim, {
                toValue: height,
                tension: 65,
                friction: 11,
                useNativeDriver: true
            }).start(() => {
                setShowViewers(false);
                setIsPaused(false); // Panel kapandığında ilerlemeyi devam ettir
            });
        } else {
            // Panel'i aç
            setShowViewers(true);
            setIsPaused(true); // Panel açıldığında ilerlemeyi durdur
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 65,
                friction: 11,
                useNativeDriver: true
            }).start();
        }
    };

    const formatViewTime = (timestamp) => {
        if (!timestamp) {
            return '';
        }

        try {
            const date = timestamp.toDate();
            return date.toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch (error) {
            console.error('Zaman formatı hatası:', error);
            return '';
        }
    };

    const handleLike = async () => {
        try {
            const currentStory = stories[currentIndex];
            const result = await likeStory(currentStory.id, currentUserId);

            if (result) {
                setIsLiked(!isLiked);

                // stories state'ini güncelle
                const newStories = stories.map((story, index) => {
                    if (index === currentIndex) {
                        return {
                            ...story,
                            likes: !isLiked
                                ? [...(story.likes || []), currentUserId]
                                : (story.likes || []).filter(id => id !== currentUserId)
                        };
                    }
                    return story;
                });

                // route.params üzerinden stories'i güncelle
                if (route.params?.updateStories) {
                    route.params.updateStories(newStories);
                }
            }
        } catch (error) {
            console.error('Beğenme hatası:', error);
        }
    };

    const handleDeleteStory = () => {
        Alert.alert(
            'Hikayeyi Sil',
            'Bu hikayeyi silmek istediğinizden emin misiniz?',
            [
                {
                    text: 'İptal',
                    style: 'cancel'
                },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await deleteStory(stories[currentIndex].id);
                            if (result.success) {
                                // Hikayeyi listeden kaldır
                                const updatedStories = stories.filter((_, index) => index !== currentIndex);

                                if (updatedStories.length === 0) {
                                    // Eğer başka hikaye kalmadıysa geri dön
                                    navigation.goBack();
                                } else {
                                    // Güncel hikaye listesini güncelle
                                    if (updateStories) {
                                        updateStories(updatedStories);
                                    }
                                    // Eğer son hikaye silindiyse bir öncekine geç
                                    if (currentIndex === stories.length - 1) {
                                        setCurrentIndex(currentIndex - 1);
                                    }
                                }

                                Alert.alert('Başarılı', 'Hikaye başarıyla silindi');
                            } else {
                                Alert.alert('Hata', 'Hikaye silinirken bir sorun oluştu');
                            }
                        } catch (error) {
                            console.error('Hikaye silme hatası:', error);
                            Alert.alert('Hata', 'Hikaye silinirken bir sorun oluştu');
                        }
                    }
                }
            ]
        );
    };

    const handleOptionsPress = () => {
        setShowOptionsMenu(!showOptionsMenu);
        setIsPaused(true); // Menü açıkken hikaye ilerlemesini durdur
    };

    const handleOptionsClose = () => {
        setShowOptionsMenu(false);
        setIsPaused(false); // Menü kapandığında hikaye ilerlemesini devam ettir
    };

    const ViewersPanel = () => {
        const panResponderViewers = useRef(
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderMove: (_, gestureState) => {
                    if (gestureState.dy > 0) {
                        slideAnim.setValue(gestureState.dy);
                    }
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (gestureState.dy > 50) {
                        // Panel'i kapat
                        Animated.spring(slideAnim, {
                            toValue: height,
                            tension: 65,
                            friction: 11,
                            useNativeDriver: true
                        }).start(() => {
                            toggleViewers();
                            setIsPaused(false); // Panel kapandığında ilerlemeyi devam ettir
                        });
                    } else {
                        // Geri döndür
                        Animated.spring(slideAnim, {
                            toValue: 0,
                            tension: 65,
                            friction: 11,
                            useNativeDriver: true
                        }).start();
                    }
                }
            })
        ).current;

        return (
            <Animated.View
                style={[
                    styles.viewersPanel,
                    {
                        transform: [{ translateY: slideAnim }],
                        zIndex: 4 // Panel'in zIndex'ini artır
                    }
                ]}
            >
                {/* Tutma çubuğu ve başlık kısmı */}
                <View {...panResponderViewers.panHandlers} style={styles.panelHeader}>
                    <View style={styles.viewersPanelHandle} />
                    <View style={styles.viewersHeader}>
                        <Text style={styles.viewersTitle}>Görüntüleyenler</Text>
                        <TouchableOpacity onPress={toggleViewers}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Görüntüleyenler listesi */}
                <ScrollView style={styles.viewersList}>
                    {viewers.length === 0 ? (
                        <View style={styles.noViewersContainer}>
                            <Text style={styles.noViewersText}>Henüz görüntüleyen yok</Text>
                        </View>
                    ) : (
                        viewers.map((viewer, index) => (
                            <View
                                key={`viewer-${viewer.id}-${index}`}
                                style={styles.viewerItem}
                            >
                                <FastImage
                                    source={
                                        viewer.profilePicture
                                            ? { uri: viewer.profilePicture }
                                            : { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(viewer.name)}&background=random&size=200` }
                                    }
                                    style={styles.viewerAvatar}
                                    resizeMode={FastImage.resizeMode.cover}
                                />
                                <View style={styles.viewerInfo}>
                                    <View style={styles.viewerTextContainer}>
                                        <Text style={styles.viewerName}>{viewer.name}</Text>
                                        <Text style={styles.viewerTime}>
                                            {formatViewTime(viewer.viewedAt)}
                                        </Text>
                                    </View>
                                </View>
                                {viewer.liked && (
                                    <Ionicons name="heart" size={20} color="red" style={styles.likeIcon} />
                                )}
                            </View>
                        ))
                    )}
                </ScrollView>
            </Animated.View>
        );
    };

    const handleSendMessage = async () => {
        if (!message.trim()) return;

        try {
            const currentUserId = await getCurrentUserUid();
            const chatId = currentUserId > user.id ?
                `${currentUserId}_${user.id}` :
                `${user.id}_${currentUserId}`;

            // Messages koleksiyonuna mesajı ekle
            await addDoc(collection(db, 'messages'), {
                chatId: chatId,
                message: message.trim(),
                read: false,
                receiverId: user.id,
                senderId: currentUserId,
                timestamp: serverTimestamp(),
                mediaType: 'story_reply',
                storyId: stories[currentIndex].id,
                storyUrl: stories[currentIndex].storyUrl
            });

            // Chats koleksiyonunu güncelle
            const chatRef = doc(db, 'chats', chatId);
            const chatDoc = await getDoc(chatRef);

            const chatData = {
                lastMessage: message.trim(),
                lastMessageTime: serverTimestamp(),
                lastMessageSenderId: currentUserId,
                participants: [currentUserId, user.id],
                updatedAt: serverTimestamp()
            };

            if (!chatDoc.exists()) {
                await setDoc(chatRef, {
                    ...chatData,
                    createdAt: serverTimestamp()
                });
            } else {
                await setDoc(chatRef, chatData, { merge: true });
            }

            // Input'u temizle ve klavyeyi kapat
            setMessage('');
            Keyboard.dismiss();

            // Platform'a göre başarı mesajı
            if (Platform.OS === 'ios') {
                Alert.alert('', 'Mesaj gönderildi');
            } else {
                ToastAndroid.show('Mesaj gönderildi', ToastAndroid.SHORT);
            }

        } catch (error) {
            console.error('Mesaj gönderme hatası:', error);
            Alert.alert('Hata', 'Mesaj gönderilemedi');
        }
    };

    // Müzik çalma fonksiyonunu ekle
    const playStoryMusic = async (track) => {
        try {
            if (storySound) {
                await storySound.unloadAsync();
            }

            if (track?.id) {
                // Taze önizleme URL'si al
                const refreshedTrack = await refreshTrackPreview(track.id);

                if (refreshedTrack.success && refreshedTrack.previewUrl) {
                    const { sound: newSound } = await Audio.Sound.createAsync(
                        { uri: refreshedTrack.previewUrl },
                        {
                            isLooping: true,
                            shouldPlay: true,
                            volume: 0.5
                        },
                        (status) => {
                            if (status.error) {
                                console.error('Ses çalma hatası:', status.error);
                            }
                        }
                    );

                    setStorySound(newSound);
                } else {
                    console.error('Müzik önizlemesi alınamadı');
                }
            }
        } catch (error) {
            console.error('Müzik çalma hatası:', error);
        }
    };

    // Hikaye değiştiğinde müziği güncelle
    useEffect(() => {
        const currentStory = stories[currentIndex];
        if (currentStory?.music) {
            playStoryMusic(currentStory.music);
        } else if (storySound) {
            storySound.unloadAsync();
            setStorySound(null);
        }
    }, [currentIndex]);

    // Müzik çalma fonksiyonu
    const playMusic = async (musicUrl) => {
        try {
            if (sound) {
                await sound.unloadAsync();
            }
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: musicUrl },
                { shouldPlay: true }
            );
            setSound(newSound);
        } catch (error) {
            console.error('Müzik çalma hatası:', error);
        }
    };

    // Komponentin unmount olması durumunda müziği durdur
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    // Navigation'a müzik durdurma işlevini ekle
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', () => {
            if (storySound) {
                storySound.unloadAsync();
            }
        });

        return unsubscribe;
    }, [navigation, storySound]);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            <View style={styles.safeAreaContainer}>
                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    {stories.map((_, index) => (
                        <View key={index} style={styles.progressBarContainer}>
                            <View
                                style={[
                                    styles.progressBar,
                                    {
                                        width: `${index === currentIndex ? progress * 100 : index < currentIndex ? 100 : 0}%`
                                    }
                                ]}
                            />
                        </View>
                    ))}
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.userInfo}>
                        <FastImage
                            source={
                                user?.profilePicture
                                    ? { uri: user.profilePicture }
                                    : { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}&background=random` }
                            }
                            style={styles.userAvatar}
                            resizeMode={FastImage.resizeMode.cover}
                        />
                        <Text style={styles.userName}>{user?.name}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        {isOwnStory && (
                            <TouchableOpacity
                                style={styles.optionsButton}
                                onPress={handleOptionsPress}
                            >
                                <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Options Menu Popup */}
                {showOptionsMenu && (
                    <View style={styles.optionsMenuContainer}>
                        <View style={styles.optionsMenu}>
                            <TouchableOpacity
                                style={styles.optionItem}
                                onPress={() => {
                                    handleOptionsClose();
                                    handleDeleteStory();
                                }}
                            >
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                <Text style={styles.optionText}>Hikayeyi Sil</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Story Content */}
            <TouchableOpacity
                activeOpacity={1}
                style={styles.storyContainer}
                onPress={handlePress}
            >
                <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
                    <FastImage
                        source={{ uri: stories[currentIndex].storyUrl }}
                        style={styles.storyImage}
                        resizeMode={FastImage.resizeMode.cover}
                        onLoadStart={() => setLoading(true)}
                        onLoadEnd={() => setLoading(false)}
                    />
                </Animated.View>
            </TouchableOpacity>

            {/* Görüntüleyenler Butonu */}
            {isOwnStory && (
                <TouchableOpacity
                    style={styles.viewersButton}
                    onPress={toggleViewers}
                >
                    <View style={styles.viewersButtonContent}>
                        <Ionicons name="eye-outline" size={20} color="#FFF" />
                        <Text style={styles.viewersButtonText}>
                            {viewers.length} görüntüleme
                        </Text>
                        <Ionicons name="chevron-up" size={20} color="#FFF" />
                    </View>
                </TouchableOpacity>
            )}

            {/* Görüntüleyenler Paneli Arka Planı */}
            {isOwnStory && showViewers && (
                <View
                    style={[
                        styles.modalBackground,
                        { zIndex: 3 } // Arka plan zIndex'ini panel'den düşük tut
                    ]}
                    onTouchEnd={toggleViewers}
                />
            )}

            {/* Görüntüleyenler Paneli */}
            {isOwnStory && showViewers && <ViewersPanel />}

            {/* Loading Indicator */}
            {(loading || isTransitioning) && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FFF" />
                </View>
            )}

            {/* Mesaj Gönderme Alanı */}
            <Animated.View
                style={[
                    styles.messageContainer,
                    {
                        transform: [{
                            translateY: isKeyboardVisible ? -250 : 0
                        }]
                    }
                ]}
            >
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons name="search" size={26} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.messageInputContainer}>
                    <TextInput
                        ref={messageInputRef}
                        style={styles.messageInput}
                        placeholder="Mesaj gönder..."
                        placeholderTextColor="#999"
                        value={message}
                        onChangeText={setMessage}
                        multiline={false}
                        returnKeyType="send"
                        onSubmitEditing={handleSendMessage}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                </View>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={handleLike}
                >
                    <Ionicons
                        name={isLiked ? "heart" : "heart-outline"}
                        size={26}
                        color={isLiked ? "#FF3B30" : "#FFF"}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.iconButton,
                        message.trim() ? styles.activeIconButton : null
                    ]}
                    onPress={handleSendMessage}
                >
                    <Ionicons
                        name="paper-plane-outline"
                        size={26}
                        color={message.trim() ? "#0095f6" : "#FFF"}
                    />
                </TouchableOpacity>
            </Animated.View>

            {/* Müzik kartını sadece bir kere göster ve ViewersPanel dışında tut */}
            {!showViewers && stories[currentIndex]?.music && (
                <View style={styles.musicCard}>
                    <LinearGradient
                        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.musicGradient}
                    >
                        <View style={styles.musicContent}>
                            <FastImage
                                source={{ uri: stories[currentIndex].music.imageUrl }}
                                style={styles.musicImage}
                                resizeMode={FastImage.resizeMode.cover}
                            />
                            <View style={styles.musicInfo}>
                                <Text style={styles.musicTitle} numberOfLines={1}>
                                    {stories[currentIndex].music.name}
                                </Text>
                                <Text style={styles.musicArtist} numberOfLines={1}>
                                    {stories[currentIndex].music.artist}
                                </Text>
                            </View>
                            <View style={styles.musicIconContainer}>
                                <Ionicons name="musical-notes" size={16} color="#FFF" />
                            </View>
                        </View>
                    </LinearGradient>
                </View>
            )}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    storyContainer: {
        flex: 1,
        backgroundColor: '#000',
        position: 'relative',
    },
    storyImage: {
        width: width,
        height: height - (Platform.OS === 'ios' ? 40 : StatusBar.currentHeight),
        resizeMode: 'cover',
        marginTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight,
    },
    header: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 55 : StatusBar.currentHeight + 15,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        zIndex: 2,
    },
    progressContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 48 : StatusBar.currentHeight + 8,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        zIndex: 2,
    },
    viewersButton: {
        position: 'absolute',
        bottom: 85,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 20,
        padding: 12,
        zIndex: 2,
    },
    viewersButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewersButtonText: {
        color: '#FFF',
        fontSize: 16,
        marginHorizontal: 8,
    },
    viewersPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height * 0.7,
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        zIndex: 4,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84
    },
    viewersPanelHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#DDD',
        borderRadius: 2,
        alignSelf: 'center',
        marginVertical: 10,
    },
    viewersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
    viewersList: {
        flex: 1,
    },
    viewerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 0.5,
        borderBottomColor: '#EFEFEF',
        minHeight: 72,
    },
    viewerInfo: {
        flex: 1,
        marginLeft: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    viewerTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    viewerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E1E1E1',
    },
    viewerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#262626',
        marginBottom: 2,
    },
    viewerTime: {
        fontSize: 13,
        color: '#8E8E8E',
    },
    likeIcon: {
        marginLeft: 10,
    },
    viewersTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    userName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    modalBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 3
    },
    panelHeader: {
        width: '100%',
    },
    noViewersContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    noViewersText: {
        fontSize: 16,
        color: '#8E8E8E',
        textAlign: 'center',
    },
    safeAreaContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2,
    },
    progressBarContainer: {
        flex: 1,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.5)',
        marginHorizontal: 2,
        borderRadius: 1,
        overflow: 'hidden'
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#FFF',
        borderRadius: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionsButton: {
        marginRight: 15,
        padding: 5,
    },
    closeButton: {
        padding: 5,
    },
    optionsMenuContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 90 : StatusBar.currentHeight + 50,
        right: 15,
        zIndex: 1000,
    },
    optionsMenu: {
        backgroundColor: '#FFF',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        minWidth: 150,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    optionText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#FF3B30',
        fontWeight: '500',
    },
    messageContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 15,
        left: 0,
        right: 0,
        backgroundColor: '#000',
        paddingHorizontal: 15,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        borderTopWidth: 0.5,
        zIndex: 2,
    },
    messageInputContainer: {
        flex: 1,
        backgroundColor: '#262626',
        borderRadius: 22,
        marginHorizontal: 10,
        height: 44,
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    messageInput: {
        color: '#FFF',
        fontSize: 16,
        paddingHorizontal: 15,
        maxHeight: 100,
    },
    iconButton: {
        padding: 8,
        borderRadius: 20,
    },
    activeIconButton: {
        backgroundColor: 'rgba(0, 149, 246, 0.1)',
    },
    musicCard: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        right: 16,
        borderRadius: 8,
        overflow: 'hidden',
        maxWidth: 280,
    },
    musicGradient: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    musicContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    musicImage: {
        width: 32,
        height: 32,
        borderRadius: 4,
    },
    musicInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    musicTitle: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    musicArtist: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 2,
    },
    musicIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default StoryView; 