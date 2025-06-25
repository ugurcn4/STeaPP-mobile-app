import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform, 
    Dimensions,
    Alert,
    Linking,
    ActionSheetIOS,
    StatusBar,
    AppState,
    Vibration,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    sendMessage,
    subscribeToMessages,
    markChatAsRead,
    sendMediaMessage,
    sendVoiceMessage,
    addMessageToFavorites,
    deleteMessage,
    deleteMessageForEveryone,
    reportMessage,
    getFavoriteMessages
} from '../services/messageService';
import { getCurrentUserUid } from '../services/friendFunctions';
import { BlurView } from 'expo-blur';
import FriendProfileModal from '../modals/friendProfileModal';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
    updateOnlineStatus,
    subscribeToUserStatus,
    initializeOnlineStatusTracking
} from '../services/onlineStatusService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import FastImage from 'react-native-fast-image';
import VerificationBadge from '../components/VerificationBadge';
import { checkUserVerification } from '../utils/verificationUtils';


const { width } = Dimensions.get('window');

// Mesajları tarihe göre gruplandıran yardımcı fonksiyon
const groupMessagesByDate = (messages) => {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    messages.forEach(message => {
        const messageDate = message.timestamp.toDate();
        messageDate.setHours(0, 0, 0, 0);

        let dateKey;

        if (messageDate.getTime() === today.getTime()) {
            dateKey = 'Bugün';
        } else if (messageDate.getTime() === yesterday.getTime()) {
            dateKey = 'Dün';
        } else {
            // Son 7 gün içindeyse gün adını göster
            const diffDays = Math.round((today - messageDate) / (1000 * 60 * 60 * 24));
            if (diffDays < 7) {
                const options = { weekday: 'long' };
                dateKey = messageDate.toLocaleDateString('tr-TR', options);
                // İlk harfi büyük yap
                dateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);
            } else {
                // 7 günden eskiyse tam tarih göster
                dateKey = messageDate.toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        }

        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }

        groups[dateKey].push(message);
    });

    return groups;
};

const ChatScreen = ({ route, navigation }) => {
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [inputHeight, setInputHeight] = useState(20);
    const [friendData, setFriendData] = useState(route.params.friend);
    const flatListRef = useRef();
    const [isOnline, setIsOnline] = useState(false);
    const [friendProfileVisible, setFriendProfileVisible] = useState(false);
    const [lastSeen, setLastSeen] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimer = useRef(null);
    const [playingAudio, setPlayingAudio] = useState(null);
    const [sound, setSound] = useState(null);
    const [initialLoad, setInitialLoad] = useState(true);
    const [newMessageReceived, setNewMessageReceived] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const inputRef = useRef(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [favoritesModalVisible, setFavoritesModalVisible] = useState(false);
    const [favoriteMessages, setFavoriteMessages] = useState([]);
    const [friendVerification, setFriendVerification] = useState({ hasBlueTick: false, hasGreenTick: false });
    const [groupedMessages, setGroupedMessages] = useState({});

    useEffect(() => {
        navigation.setOptions({
            headerShown: false
        });

        const loadMessages = async () => {
            setIsLoading(true);
            const uid = await getCurrentUserUid();
            setCurrentUserId(uid);

            // Çevrimiçi durumu izlemeyi başlat
            initializeOnlineStatusTracking(uid);

            // Kullanıcıyı çevrimiçi yap
            await updateOnlineStatus(uid, true);

            // Friend bilgilerini güncelle
            const friendRef = doc(db, 'users', friendData.id);
            const friendSnapshot = await getDoc(friendRef);
            if (friendSnapshot.exists()) {
                const data = friendSnapshot.data();
                setFriendData(prevData => ({
                    ...prevData,
                    friends: data.friends || [],
                }));
            }

            const chatId = [uid, friendData.id].sort().join('_');

            // Chat ekranına girildiğinde okunmamış mesajları kontrol et
            const markUnreadMessages = async () => {
                const q = query(
                    collection(db, 'messages'),
                    where('chatId', '==', chatId),
                    where('receiverId', '==', uid),
                    where('read', '==', false)
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    await markChatAsRead(chatId, uid);
                }
            };

            // İlk yüklemede okunmamış mesajları işaretle
            await markUnreadMessages();

            const unsubscribeMessages = subscribeToMessages(
                uid,
                friendData.id,
                (newMessages) => {
                    const sortedMessages = newMessages.sort((a, b) =>
                        b.timestamp.toMillis() - a.timestamp.toMillis()
                    );

                    // Mesajları tarihe göre gruplandır
                    const grouped = groupMessagesByDate(sortedMessages);
                    setGroupedMessages(grouped);

                    if (!initialLoad && messages.length < sortedMessages.length) {
                        setNewMessageReceived(true);
                        // Yeni mesaj geldiğinde ve alıcıysak okundu olarak işaretle
                        const hasNewUnreadMessages = sortedMessages.some(
                            msg => msg.receiverId === uid && !msg.read &&
                                (!messages.length || msg.timestamp > messages[0].timestamp)
                        );

                        if (hasNewUnreadMessages) {
                            markChatAsRead(chatId, uid);
                        }
                    }

                    setMessages(sortedMessages);
                    setInitialLoad(false);
                    setIsLoading(false);
                }
            );

            // Arkadaşın çevrimiçi durumunu dinle
            const unsubscribeOnlineStatus = subscribeToUserStatus(
                friendData.id,
                ({ isOnline: online, lastSeen: last }) => {
                    setIsOnline(online);
                    setLastSeen(last);
                }
            );

            // Uygulama durumu değişikliklerini dinle
            const appStateSubscription = AppState.addEventListener('change', nextAppState => {
                if (nextAppState === 'active') {
                    updateOnlineStatus(uid, true);
                } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                    updateOnlineStatus(uid, false);
                }
            });

            // Arkadaşın doğrulama durumunu kontrol et
            const checkFriendVerification = async () => {
                try {
                    const verificationStatus = await checkUserVerification(friendData.id);
                    setFriendVerification(verificationStatus);
                } catch (error) {
                    console.error('Doğrulama durumu kontrolünde hata:', error);
                }
            };

            checkFriendVerification();

            return () => {
                if (unsubscribeMessages) {
                    unsubscribeMessages();
                }
                unsubscribeOnlineStatus();
                appStateSubscription.remove();
                // Çıkış yaparken çevrimdışı yap
                updateOnlineStatus(uid, false);
                if (unsubscribeCallListener) {
                    unsubscribeCallListener();
                }
            };
        };

        loadMessages();
    }, [friendData.id, navigation]);

    useEffect(() => {
        if (newMessageReceived) {
            setNewMessageReceived(false);
        }
    }, [newMessageReceived]);

    useEffect(() => {
        const checkPermissions = async () => {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'İzin Gerekli',
                    'Sesli mesaj göndermek için mikrofon izni gerekiyor'
                );
            }
        };
        checkPermissions();
    }, []);

    useEffect(() => {
        const loadFavorites = async () => {
            if (currentUserId) {
                try {
                    const favorites = await getFavoriteMessages(currentUserId);
                    setFavoriteMessages(favorites);
                } catch (error) {
                    console.error('Favoriler yüklenirken hata:', error);
                }
            }
        };
        loadFavorites();
    }, [currentUserId]);

    const handleSendMessage = async () => {
        if (!messageText.trim()) return;

        const uid = await getCurrentUserUid();
        await sendMessage(uid, friendData.id, messageText.trim());
        setMessageText('');
    };

    const handleMediaPicker = async () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['İptal', 'Fotoğraf Çek', 'Galeriden Seç', 'Dosya Seç'],
                    cancelButtonIndex: 0,
                },
                async (buttonIndex) => {
                    if (buttonIndex === 1) {
                        await handleCamera();
                    } else if (buttonIndex === 2) {
                        await handleGallery();
                    } else if (buttonIndex === 3) {
                        await handleDocument();
                    }
                }
            );
        } else {
            Alert.alert(
                'Medya Ekle',
                'Lütfen bir seçenek seçin',
                [
                    {
                        text: 'Fotoğraf Çek',
                        onPress: handleCamera
                    },
                    {
                        text: 'Galeriden Seç',
                        onPress: handleGallery
                    },
                    {
                        text: 'Dosya Seç',
                        onPress: handleDocument
                    },
                    {
                        text: 'İptal',
                        style: 'cancel'
                    }
                ],
                { cancelable: true }
            );
        }
    };

    const handleCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('İzin Gerekli', 'Kamera izni gerekiyor');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });

        if (!result.canceled) {
            await handleMediaUpload(result.assets[0].uri, 'image');
        }
    };

    const handleGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('İzin Gerekli', 'Galeri izni gerekiyor');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.8,
        });

        if (!result.canceled) {
            await handleMediaUpload(result.assets[0].uri, 'image');
        }
    };

    const handleDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (result.type === 'success') {
                await handleMediaUpload(result.uri, 'document');
            }
        } catch (err) {
            console.error('Dosya seçme hatası:', err);
        }
    };

    const handleMediaUpload = async (uri, type) => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            await sendMediaMessage(currentUserId, friendData.id, blob, type);
        } catch (error) {
            console.error('Medya yükleme hatası:', error);
            Alert.alert('Hata', 'Medya gönderilemedi');
        }
    };

    const startRecording = async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recordingOptions = {
                android: {
                    extension: '.mp4',
                    outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
                    audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
            };

            const { recording } = await Audio.Recording.createAsync(recordingOptions);
            setRecording(recording);
            setIsRecording(true);

            recordingTimer.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Ses kaydı başlatılamadı:', err);
            Alert.alert('Hata', 'Ses kaydı başlatılamadı');
        }
    };

    const stopRecording = async () => {
        if (!recording || !isRecording) return;

        try {
            setIsRecording(false);
            clearInterval(recordingTimer.current);

            const uri = recording.getURI();
            await recording.stopAndUnloadAsync();

            const response = await fetch(uri);
            const blob = await response.blob();
            blob.duration = recordingDuration;

            await sendVoiceMessage(currentUserId, friendData.id, blob);

            setRecording(null);
            setRecordingDuration(0);

        } catch (err) {
            console.error('Ses kaydı durdurulamadı:', err);
            Alert.alert('Hata', 'Ses kaydı gönderilemedi');
            setRecording(null);
            setIsRecording(false);
            setRecordingDuration(0);
            clearInterval(recordingTimer.current);
        }
    };

    const playVoiceMessage = async (audioUrl, messageId) => {
        try {
            if (playingAudio === messageId && sound) {
                await sound.unloadAsync();
                setSound(null);
                setPlayingAudio(null);
                return;
            }

            if (sound) {
                await sound.unloadAsync();
                setSound(null);
            }

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                shouldDuckAndroid: false,
            });

            // Platform'a göre dosya uzantısını belirle
            const extension = Platform.OS === 'ios' ? '.m4a' : '.aac';
            const localUri = `${FileSystem.cacheDirectory}voice_${messageId}${extension}`;

            const { uri } = await FileSystem.downloadAsync(audioUrl, localUri);

            const newSound = new Audio.Sound();

            await newSound.loadAsync(
                { uri },
                {
                    shouldPlay: true,
                    volume: 1.0,
                    rate: 1.0,
                }
            );

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setPlayingAudio(null);
                    setSound(null);
                }
            });

            setSound(newSound);
            setPlayingAudio(messageId);

        } catch (err) {
            console.error('Ses oynatılamadı:', err);
            Alert.alert('Hata', 'Ses mesajı oynatılamadı');
            setSound(null);
            setPlayingAudio(null);
        }
    };

    const handleMessageLongPress = (message) => {
        Vibration.vibrate(50); // Hafif titreşim efekti
        setSelectedMessage(message);

        if (Platform.OS === 'ios') {
            const options = ['İptal', 'Favorilere Ekle', 'Benden Sil'];

            // Eğer mesajı gönderen kişiysek "Herkesten Sil" seçeneğini ekle
            if (message.senderId === currentUserId) {
                options.push('Herkesten Sil');
            } else {
                options.push('Mesajı Şikayet Et');
            }

            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    destructiveButtonIndex: message.senderId === currentUserId ? [2, 3] : [2],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        handleAddToFavorites(message);
                    } else if (buttonIndex === 2) {
                        handleDeleteMessage(message);
                    } else if (buttonIndex === 3) {
                        if (message.senderId === currentUserId) {
                            handleDeleteMessageForEveryone(message);
                        } else {
                            handleReportMessage(message);
                        }
                    }
                }
            );
        } else {
            // Android için Alert kullan
            const options = [
                {
                    text: 'Favorilere Ekle',
                    onPress: () => handleAddToFavorites(message)
                },
                {
                    text: 'Benden Sil',
                    onPress: () => handleDeleteMessage(message),
                    style: 'destructive'
                }
            ];

            // Mesajı gönderen kişiysek "Herkesten Sil" seçeneğini ekle
            if (message.senderId === currentUserId) {
                options.push({
                    text: 'Herkesten Sil',
                    onPress: () => handleDeleteMessageForEveryone(message),
                    style: 'destructive'
                });
            } else {
                options.push({
                    text: 'Mesajı Şikayet Et',
                    onPress: () => handleReportMessage(message),
                    style: 'destructive'
                });
            }

            options.push({
                text: 'İptal',
                style: 'cancel'
            });

            Alert.alert('Mesaj Seçenekleri', '', options);
        }
    };

    const handleAddToFavorites = async (message) => {
        try {
            await addMessageToFavorites(currentUserId, message);
            Alert.alert('Başarılı', 'Mesaj favorilere eklendi');
        } catch (error) {
            console.error('Favorilere ekleme hatası:', error);
            Alert.alert('Hata', 'Mesaj favorilere eklenemedi');
        }
    };

    const handleDeleteMessage = (message) => {
        const options = [
            {
                text: 'İptal',
                style: 'cancel'
            },
            {
                text: 'Benden Sil',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteMessage(message.id, currentUserId);
                    } catch (error) {
                        console.error('Mesaj silme hatası:', error);
                        Alert.alert('Hata', 'Mesaj silinemedi');
                    }
                }
            }
        ];

        // Sadece mesajı gönderen kişi herkesten silebilir
        if (message.senderId === currentUserId) {
            options.push({
                text: 'Herkesten Sil',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteMessageForEveryone(message.id);
                    } catch (error) {
                        console.error('Mesaj silme hatası:', error);
                        Alert.alert('Hata', 'Mesaj silinemedi');
                    }
                }
            });
        }

        Alert.alert(
            'Mesajı Sil',
            'Bu mesajı silmek istediğinizden emin misiniz?',
            options
        );
    };

    const handleReportMessage = (message) => {
        Alert.alert(
            'Mesajı Şikayet Et',
            'Bu mesajı şikayet etmek istediğinizden emin misiniz?',
            [
                {
                    text: 'İptal',
                    style: 'cancel'
                },
                {
                    text: 'Şikayet Et',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await reportMessage(message.id);
                            Alert.alert('Başarılı', 'Mesaj şikayet edildi');
                        } catch (error) {
                            console.error('Mesaj şikayet hatası:', error);
                            Alert.alert('Hata', 'Mesaj şikayet edilemedi');
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteMessageForEveryone = async (message) => {
        try {
            await deleteMessageForEveryone(message.id);
        } catch (error) {
            console.error('Mesaj silme hatası:', error);
            Alert.alert('Hata', 'Mesaj silinemedi');
        }
    };

    // Mesajları ve tarih ayırıcılarını içeren düz bir liste oluştur
    const getMessagesWithDateSeparators = () => {
        const result = [];

        // Tarihleri sırala (en yeni en üstte)
        const sortedDates = Object.keys(groupedMessages).sort((a, b) => {
            // Bugün ve Dün için özel sıralama
            if (a === 'Bugün') return -1;
            if (b === 'Bugün') return 1;
            if (a === 'Dün') return -1;
            if (b === 'Dün') return 1;

            // Diğer tarihler için
            return 0; // Mesajlar zaten tarih sırasına göre gruplandırıldı
        });

        sortedDates.forEach(date => {
            // Önce bu tarihe ait mesajları ekle
            groupedMessages[date].forEach(message => {
                result.push({
                    ...message,
                    type: 'message'
                });
            });

            // Sonra tarih ayırıcısını ekle
            result.push({
                id: `date-${date}`,
                type: 'date',
                date: date
            });
        });

        return result;
    };

    // Tarih ayırıcısı bileşeni
    const DateSeparator = ({ date }) => (
        <View style={styles.dateSeparatorContainer}>
            <View style={styles.dateSeparatorLine} />
            <View style={styles.dateSeparatorTextContainer}>
                <Text style={styles.dateSeparatorText}>{date}</Text>
            </View>
            <View style={styles.dateSeparatorLine} />
        </View>
    );

    // renderItem fonksiyonunu güncelle
    const renderItem = ({ item }) => {
        if (item.type === 'date') {
            return <DateSeparator date={item.date} />;
        }

        return renderMessage({ item });
    };

    const renderMessage = ({ item }) => {
        const isMine = item.senderId === currentUserId;
        const isFavorite = favoriteMessages.some(fav => fav.messageId === item.id);
        const renderMessageContent = () => {
            // Story yanıtı kontrolü
            if (item.mediaType === 'story_reply') {
                return (
                    <View>
                        <Text style={[
                            styles.messageText,
                            isMine ? styles.myMessageText : styles.theirMessageText
                        ]}>
                            {item.message}
                        </Text>
                        <TouchableOpacity
                            style={[
                                styles.storyReplyContainer,
                                isMine ? styles.myStoryReply : styles.theirStoryReply
                            ]}
                            onPress={() => {
                                if (item.storyId) {
                                    // navigation.navigate('StoryDetail', { storyId: item.storyId });
                                }
                            }}
                        >
                            <FastImage
                                source={{ uri: item.storyUrl }}
                                style={styles.storyThumbnail}
                                resizeMode={FastImage.resizeMode.cover}
                            />
                            <Text style={[
                                styles.storyReplyText,
                                isMine ? styles.myStoryReplyText : styles.theirStoryReplyText
                            ]}>
                                Hikayeye yanıt
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            }

            // Normal metin mesajı
            if (!item.mediaType || item.mediaType === 'text') {
                return (
                    <Text style={[
                        styles.messageText,
                        isMine ? styles.myMessageText : styles.theirMessageText
                    ]}>
                        {item.message}
                    </Text>
                );
            }

            // Ses mesajı
            if (item.audioUrl) {
                return (
                    <TouchableOpacity
                        style={styles.voiceMessageContainer}
                        onPress={() => playVoiceMessage(item.audioUrl, item.id)}
                    >
                        <View style={[
                            styles.voiceIconContainer,
                            { backgroundColor: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }
                        ]}>
                            <Ionicons
                                name={playingAudio === item.id ? "pause" : "play"}
                                size={20}
                                color={isMine ? "#FFF" : "#666"}
                            />
                        </View>
                        <View style={styles.voiceContentContainer}>
                            <View style={styles.voiceWaveform}>
                                {[...Array(15)].map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.waveformBar,
                                            isMine ? styles.myWaveformBar : styles.theirWaveformBar,
                                            { height: Math.random() * 15 + 5 }
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={[
                                styles.voiceDuration,
                                isMine ? styles.myVoiceDuration : styles.theirVoiceDuration
                            ]}>
                                {Math.floor(item.duration)}s
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            }

            // Medya mesajı
            if (item.mediaUrl) {
                switch (item.mediaType) {
                    case 'image':
                        return (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('ImageViewer', { url: item.mediaUrl })}
                            >
                                <FastImage
                                    source={{ uri: item.mediaUrl }}
                                    style={styles.mediaImage}
                                    resizeMode={FastImage.resizeMode.cover}
                                />
                            </TouchableOpacity>
                        );
                    case 'document':
                        return (
                            <TouchableOpacity
                                style={styles.documentContainer}
                                onPress={() => Linking.openURL(item.mediaUrl)}
                            >
                                <Ionicons name="document-outline" size={24} color={isMine ? "#FFF" : "#666"} />
                                <Text style={[styles.documentText, isMine ? styles.myMessageText : styles.theirMessageText]}>
                                    Döküman
                                </Text>
                            </TouchableOpacity>
                        );
                    default:
                        return null;
                }
            }

            // Varsayılan olarak metin mesajını göster
            return (
                <Text style={[
                    styles.messageText,
                    isMine ? styles.myMessageText : styles.theirMessageText
                ]}>
                    {item.message}
                </Text>
            );
        };

        return (
            <TouchableOpacity
                onLongPress={() => handleMessageLongPress(item)}
                delayLongPress={200}
                activeOpacity={0.7}
            >
                <View style={[
                    styles.messageContainer,
                    isMine ? styles.myMessage : styles.theirMessage
                ]}>
                    <View style={[
                        styles.messageBubble,
                        isMine ? styles.myMessageBubble : styles.theirMessageBubble
                    ]}>
                        {renderMessageContent()}
                        <View style={styles.messageFooter}>
                            {isFavorite && (
                                <Ionicons
                                    name="star"
                                    size={14}
                                    color={isMine ? "rgba(255,255,255,0.9)" : "#666"}
                                    style={styles.favoriteIcon}
                                />
                            )}
                            {isMine ? (
                                <View style={styles.readStatusContainer}>
                                    <View style={styles.readStatusWrapper}>
                                        {item.read ? (
                                            <Ionicons
                                                name="checkmark-done-outline"
                                                size={16}
                                                color="rgba(255,255,255,0.9)"
                                            />
                                        ) : (
                                            <Ionicons
                                                name="checkmark-outline"
                                                size={16}
                                                color="rgba(255,255,255,0.7)"
                                            />
                                        )}
                                    </View>
                                    <Text style={[styles.timeText, styles.myTimeText]}>
                                        {item.timestamp.toDate().toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={[styles.timeText, styles.theirTimeText]}>
                                    {item.timestamp.toDate().toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderHeader = () => (
        <View style={[
            styles.headerContainer,
            Platform.OS === 'android' ? styles.androidHeaderContainer : {}
        ]}>
            <BlurView intensity={100} style={[
                styles.headerBlur,
                Platform.OS === 'android' ? styles.androidHeaderBlur : {}
            ]}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={28} color="#25D220" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.userInfo}
                        onPress={() => setFriendProfileVisible(true)}
                    >
                        <FastImage
                            source={
                                friendData.profilePicture
                                    ? {
                                        uri: friendData.profilePicture,
                                        priority: FastImage.priority.normal,
                                    }
                                    : {
                                        uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(friendData.name)}&background=random`,
                                        priority: FastImage.priority.normal,
                                    }
                            }
                            style={styles.profileImage}
                            resizeMode={FastImage.resizeMode.cover}
                        />
                        <View style={styles.userTextInfo}>
                            <View style={styles.userNameContainer}>
                                <Text style={styles.userName} numberOfLines={1}>
                                    {friendData.informations?.name || friendData.name || 'İsimsiz'}
                                </Text>
                                <VerificationBadge
                                    hasBlueTick={friendVerification.hasBlueTick}
                                    hasGreenTick={friendVerification.hasGreenTick}
                                    size={12}
                                    style={styles.verificationBadge}
                                />
                            </View>
                            {renderUserStatus()}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.favoriteButton}
                        onPress={() => setFavoritesModalVisible(true)}
                    >
                        <Ionicons name="star-outline" size={24} color="#25D220" />
                    </TouchableOpacity>
                </View>
            </BlurView>
        </View>
    );

    const renderInputBar = () => (
        <BlurView intensity={100} style={styles.inputBarContainer}>
            <View style={styles.inputBar}>
                <TouchableOpacity
                    style={styles.attachButton}
                    onPress={handleMediaPicker}
                >
                    <Ionicons name="add-circle-outline" size={24} color="#666" />
                </TouchableOpacity>

                <View style={[styles.inputWrapper, { minHeight: Math.min(inputHeight + 24, 150) }]}>
                    <TextInput
                        ref={inputRef}
                        style={[styles.input, { minHeight: Math.min(inputHeight, 120) }]}
                        value={messageText}
                        onChangeText={(text) => {
                            setMessageText(text);
                            if (text.length === 0) {
                                setInputHeight(20);
                            } else {
                                inputRef.current?.measure((x, y, width, height) => {
                                    const newHeight = Math.max(20, height);
                                    setInputHeight(newHeight);
                                });
                            }
                        }}
                        placeholder={isRecording ? `Kaydediliyor... ${recordingDuration}s` : "Mesaj yaz..."}
                        placeholderTextColor="#666"
                        multiline
                        editable={!isRecording}
                        scrollEnabled={inputHeight >= 120}
                        onContentSizeChange={(e) => {
                            const newHeight = Math.max(20, e.nativeEvent.contentSize.height);
                            setInputHeight(newHeight);
                        }}
                    />
                </View>

                {messageText.trim() ? (
                    <TouchableOpacity
                        style={styles.sendButton}
                        onPress={handleSendMessage}
                    >
                        <Ionicons name="send" size={24} color="#2196F3" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.voiceButton, isRecording && styles.recordingButton]}
                        onLongPress={startRecording}
                        onPressOut={stopRecording}
                        delayLongPress={200}
                    >
                        <Ionicons
                            name={isRecording ? "radio-button-on" : "mic-outline"}
                            size={24}
                            color={isRecording ? "#FF3B30" : "#666"}
                        />
                    </TouchableOpacity>
                )}
            </View>
        </BlurView>
    );

    const formatLastSeen = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Az önce';
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} dakika önce`;
        }
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} saat önce`;
        }
        return date.toLocaleDateString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderUserStatus = () => {
        return (
            <View style={styles.statusContainer}>
                {isOnline && (
                    <View style={styles.onlineDot} />
                )}
                <Text style={styles.userStatus}>
                    {isOnline ? 'Çevrimiçi' : lastSeen ? `Son görülme: ${formatLastSeen(lastSeen)}` : ''}
                </Text>
            </View>
        );
    };

    const renderEmptyMessage = () => {
        if (isLoading) return null;

        return (
            <View style={[
                styles.emptyContainer,
                // Platform'a göre transform uygula
                Platform.OS === 'ios' ? { transform: [{ scaleY: -1 }] } : {}
            ]}>
                <Ionicons name="lock-closed" size={48} color="#666" style={styles.lockIcon} />
                <Text style={styles.emptyTitle}>
                    Uçtan uca şifrelenmiş
                </Text>
                <Text style={styles.emptyText}>
                    Mesajlarınız ve aramalarınız uçtan uca şifrelenmiştir. Üçüncü şahıslar, hatta STeaPP bile bunları okuyamaz veya dinleyemez.
                </Text>
            </View>
        );
    };

    const FavoritesModal = ({ visible, onClose, favorites }) => (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <BlurView intensity={100} tint="light" style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View style={styles.modalHeaderLeft}>
                            <Ionicons name="star" size={24} color="#007AFF" />
                            <Text style={styles.modalTitle}>Favori Mesajlar</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search-outline" size={20} color="#666" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Favorilerde ara..."
                            placeholderTextColor="#666"
                        />
                    </View>

                    <FlatList
                        data={favorites}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.favoritesList}
                        renderItem={({ item }) => (
                            <View style={styles.favoriteItem}>
                                {item.message && (
                                    <Text style={styles.favoriteMessage}>{item.message}</Text>
                                )}
                                <Text style={styles.favoriteTime}>
                                    {item.timestamp.toDate().toLocaleTimeString('tr-TR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </Text>
                                <View style={styles.favoriteActions}>
                                    <TouchableOpacity style={styles.favoriteAction}>
                                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.favoriteAction}>
                                        <Ionicons name="share-outline" size={20} color="#007AFF" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="star-outline" size={48} color="#666" />
                                <Text style={styles.emptyTitle}>Henüz favori mesajınız yok</Text>
                                <Text style={styles.emptyText}>
                                    Bir mesaja uzun basıp "Favorilere Ekle" seçeneğini kullanarak favori mesajlarınızı ekleyebilirsiniz.
                                </Text>
                            </View>
                        }
                    />
                </BlurView>
            </View>
        </Modal>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
            {renderHeader()}
            <View style={styles.content}>
                <FlatList
                    ref={flatListRef}
                    data={getMessagesWithDateSeparators()}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[
                        styles.messagesList,
                        messages.length === 0 && { flexGrow: 1, justifyContent: 'center' }
                    ]}
                    inverted={true}
                    ListEmptyComponent={renderEmptyMessage}
                    showsVerticalScrollIndicator={false}
                    onEndReachedThreshold={0.1}
                    initialNumToRender={20}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={true}
                    style={Platform.OS === 'android' && messages.length === 0 ? { transform: [{ scaleY: 1 }] } : {}}
                    maintainVisibleContentPosition={{
                        minIndexForVisible: 0,
                        autoscrollToTopThreshold: 10
                    }}
                />
            </View>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {renderInputBar()}
            </KeyboardAvoidingView>
            <FriendProfileModal
                visible={friendProfileVisible}
                onClose={() => setFriendProfileVisible(false)}
                friend={friendData}
            />
            <FavoritesModal
                visible={favoritesModalVisible}
                onClose={() => setFavoritesModalVisible(false)}
                favorites={favoriteMessages}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    headerContainer: {
        backgroundColor: '#FFF',
        zIndex: 1000,
        height: Platform.OS === 'ios' ? 100 : 70,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    androidHeaderContainer: {
        height: 70 + (StatusBar.currentHeight || 0),
    },
    headerBlur: {
        height: '100%',
        paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    },
    androidHeaderBlur: {
        paddingTop: 0,
    },
    header: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -8,
    },
    userInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 4,
        marginRight: 8,
    },
    profileImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F0F0',
    },
    userTextInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    userNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userName: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 2,
        marginRight: 2,
    },
    verificationBadge: {
        marginLeft: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        backgroundColor: '#F8F9FB',
        marginTop: Platform.OS === 'ios' ? 90 : (70 + (StatusBar.currentHeight || 0)),
    },
    messagesList: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 90 : 70,
    },
    messageContainer: {
        marginVertical: 4,
        maxWidth: width * 0.75,
    },
    messageBubble: {
        padding: 12,
        borderRadius: 20,
        maxWidth: '100%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    myMessage: {
        alignSelf: 'flex-end',
    },
    theirMessage: {
        alignSelf: 'flex-start',
    },
    myMessageBubble: {
        backgroundColor: '#25D220', // Daha koyu ve soft bir yeşil
        borderBottomRightRadius: 4,
        borderTopLeftRadius: 24,
        shadowColor: 'rgba(18, 140, 126, 0.15)', // Yeşil tona uygun gölge
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 1,
        shadowRadius: 4,
    },
    theirMessageBubble: {
        backgroundColor: '#F8F9FA', // Biraz daha soft bir beyaz
        borderBottomLeftRadius: 4,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    myMessageText: {
        color: '#FFFFFF',
        fontWeight: '400', // Beyaz metin daha iyi okunabilirlik için normal kalınlıkta
    },
    theirMessageText: {
        color: '#2C3E50', // Daha koyu bir metin rengi
        fontWeight: '400',
    },
    timeText: {
        fontSize: 11,
        marginTop: 4,
    },
    myTimeText: {
        color: 'rgba(255,255,255,0.9)',
    },
    theirTimeText: {
        color: '#65676B',
    },
    inputBarContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        backgroundColor: '#FFF',
        minHeight: Platform.OS === 'ios' ? 90 : 70,
        maxHeight: 200,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        paddingBottom: Platform.OS === 'ios' ? 32 : 12,
        backgroundColor: '#FFF',
    },
    attachButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: '#F0F2F5',
        borderRadius: 24,
        marginHorizontal: 8,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'ios' ? 8 : 4,
        justifyContent: 'center',
    },
    input: {
        fontSize: 16,
        color: '#1A1A1A',
        padding: 0,
        textAlignVertical: 'top',
        maxHeight: 120
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    voiceButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingButton: {
        backgroundColor: 'rgba(255,59,48,0.1)',
    },
    readStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 4,
    },
    readStatusWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 2,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    lockIcon: {
        marginBottom: 16,
        opacity: 0.7,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 8,
        marginTop: 16,
    },
    emptyText: {
        fontSize: 15,
        color: '#65676B',
        textAlign: 'center',
        lineHeight: 22,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
        marginRight: 4,
    },
    userStatus: {
        fontSize: 13,
        color: '#65676B',
    },
    mediaImage: {
        width: 200,
        height: 200,
        borderRadius: 16,
        marginBottom: 4,
    },
    documentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
    },
    documentText: {
        fontSize: 14,
    },
    voiceMessageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        minWidth: 160,
        maxWidth: 250,
    },
    voiceIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    voiceContentContainer: {
        flex: 1,
    },
    voiceWaveform: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
        gap: 2,
    },
    waveformBar: {
        width: 2.5,
        borderRadius: 1.25,
    },
    myWaveformBar: {
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    theirWaveformBar: {
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    voiceDuration: {
        fontSize: 12,
        marginTop: 4,
    },
    myVoiceDuration: {
        color: 'rgba(255,255,255,0.9)',
    },
    theirVoiceDuration: {
        color: 'rgba(0,0,0,0.5)',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
    },
    statusText: {
        fontSize: 12,
        color: '#7F8C8D',
    },
    storyReplyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    myStoryReply: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    theirStoryReply: {
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    storyThumbnail: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 8,
    },
    storyReplyText: {
        fontSize: 13,
        fontWeight: '500',
    },
    myStoryReplyText: {
        color: 'rgba(255,255,255,0.9)',
    },
    theirStoryReplyText: {
        color: 'rgba(0,0,0,0.7)',
    },
    favoriteButton: {
        padding: 8,
        marginLeft: 8,
    },
    favoriteIcon: {
        marginRight: 4,
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#F0F0F0',
        margin: 12,
        borderRadius: 10,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#000',
    },
    favoritesList: {
        paddingBottom: 20,
    },
    favoriteItem: {
        padding: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5EA',
        backgroundColor: '#FFF',
    },
    favoriteMessage: {
        fontSize: 16,
        lineHeight: 22,
        marginBottom: 6,
    },
    favoriteTime: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 8,
    },
    favoriteActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
    },
    favoriteAction: {
        padding: 4,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        height: 300,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        color: '#000',
    },
    emptyText: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 32,
    },
    dateSeparatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 12,
        paddingHorizontal: 16,
    },
    dateSeparatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    dateSeparatorTextContainer: {
        paddingHorizontal: 8,
        backgroundColor: '#F8F9FB',
        borderRadius: 10,
        marginHorizontal: 8,
    },
    dateSeparatorText: {
        fontSize: 12,
        color: '#65676B',
        fontWeight: '600',
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
});

export default ChatScreen; 