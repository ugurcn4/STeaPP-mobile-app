import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    FlatList, KeyboardAvoidingView, Platform, Animated,
    Alert, Keyboard, StatusBar, SafeAreaView
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAIResponse } from '../services/aiService';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from '../i18n/i18n';
import { BlurView } from 'expo-blur';

const SUGGESTED_PROMPTS = [
    {
        id: '1',
        title: 'ai_prompt_historical',
        prompt: 'ai_prompt_historical_text',
        icon: 'time'
    },
    {
        id: '2',
        title: 'ai_prompt_food',
        prompt: 'ai_prompt_food_text',
        icon: 'restaurant'
    },
    {
        id: '3',
        title: 'ai_prompt_nature',
        prompt: 'ai_prompt_nature_text',
        icon: 'leaf'
    },
    {
        id: '4',
        title: 'ai_prompt_family',
        prompt: 'ai_prompt_family_text',
        icon: 'people'
    },
    {
        id: '5',
        title: 'ai_prompt_famous',
        prompt: 'ai_prompt_famous_text',
        icon: 'star'
    },
    {
        id: '6',
        title: 'ai_prompt_stories',
        prompt: 'ai_prompt_stories_text',
        icon: 'book'
    },
    {
        id: '7',
        title: 'ai_prompt_culture',
        prompt: 'ai_prompt_culture_text',
        icon: 'globe'
    },
    {
        id: '8',
        title: 'ai_prompt_joke',
        prompt: 'ai_prompt_joke_text',
        icon: 'happy'
    }
];

const AIChatScreen = ({ navigation }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading] = useState(false);
    const flatListRef = useRef(null);
    const loadingDots = useRef(new Animated.Value(0)).current;
    const [location, setLocation] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [typingText, setTypingText] = useState('');
    const typingAnimation = useRef(null);
    const [messagesLoaded, setMessagesLoaded] = useState(false);
    const inputRef = useRef(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const keyboardHeight = useRef(new Animated.Value(0)).current;

    const startLoadingAnimation = () => {
        Animated.sequence([
            Animated.timing(loadingDots, {
                toValue: 3,
                duration: 1000,
                useNativeDriver: true
            }),
            Animated.timing(loadingDots, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true
            })
        ]).start(() => {
            if (isLoading) startLoadingAnimation();
        });
    };

    useEffect(() => {
        // Konum izni ve mevcut konumu al
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({});
                setLocation(location);
            }
        })();
    }, []);

    useEffect(() => {
        if (isTyping) {
            let dots = '';
            typingAnimation.current = setInterval(() => {
                dots = dots.length >= 3 ? '' : dots + '.';
                setTypingText(`${translate('ai_chat_typing')}${dots}`);
            }, 500);
        } else {
            if (typingAnimation.current) {
                clearInterval(typingAnimation.current);
            }
        }

        return () => {
            if (typingAnimation.current) {
                clearInterval(typingAnimation.current);
            }
        };
    }, [isTyping]);

    const sendMessage = async (text) => {
        if (!text.trim()) return;

        const userMessage = {
            id: Date.now().toString(),
            text: text.trim(),
            isUser: true,
            timestamp: new Date()
        };

        // Önce kullanıcı mesajını ekle
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsTyping(true);

        try {
            let response;
            if (location) {
                const coords = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                };

                // Son 5 mesajı geçmiş olarak gönder
                const recentHistory = [...messages, userMessage].slice(-5);
                response = await getAIResponse(text, coords, recentHistory);
            } else {
                response = translate('ai_chat_location_error');
            }

            setIsTyping(false);

            // AI yanıtını ekle
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: response,
                isUser: false,
                timestamp: new Date()
            }]);

        } catch (error) {
            console.error('AI yanıt hatası:', error);
            setIsTyping(false);

            // Hata mesajını ekle
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: translate('ai_chat_error'),
                isUser: false,
                timestamp: new Date()
            }]);
        }
    };

    // Sohbet geçmişini yükleme
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const savedMessages = await AsyncStorage.getItem('chatHistory');
                if (savedMessages) {
                    // Mesajları yükle ve yüklendiğini işaretle
                    setMessages(JSON.parse(savedMessages));
                    setMessagesLoaded(true);
                } else {
                    // Mesaj yoksa da yüklendiğini işaretle
                    setMessagesLoaded(true);
                }
            } catch (error) {
                console.error('Sohbet geçmişi yüklenemedi:', error);
                Alert.alert(
                    translate('error'),
                    translate('ai_chat_load_error')
                );
                // Hata durumunda da yüklendiğini işaretle
                setMessagesLoaded(true);
            }
        };
        loadMessages();
    }, []);

    // Mesajlar değiştiğinde kaydet - debounce ekleyelim
    useEffect(() => {
        const saveMessages = async () => {
            try {
                await AsyncStorage.setItem('chatHistory', JSON.stringify(messages));
            } catch (error) {
                console.error('Sohbet geçmişi kaydedilemedi:', error);
            }
        };

        // Performans için debounce ekleyelim
        const timeoutId = setTimeout(() => {
            if (messages.length > 0) {
                saveMessages();
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [messages]);

    // Yeni mesaj eklendiğinde otomatik kaydırma için useEffect ekleyelim
    // Ancak sadece mesajlar yüklendikten sonra çalışsın
    useEffect(() => {
        if (messages.length > 0 && messagesLoaded) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, messagesLoaded]);

    // Klavye açılma/kapanma durumunu takip et
    useEffect(() => {
        const keyboardWillShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                setKeyboardVisible(true);
                // Klavye yüksekliği animasyonunu başlat
                Animated.timing(keyboardHeight, {
                    toValue: e.endCoordinates.height,
                    duration: Platform.OS === 'ios' ? 250 : 0,
                    useNativeDriver: false
                }).start();
                
                // Mesajlar varsa, en alttaki mesaja scroll yap
                if (messages.length > 0) {
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
            }
        );

        const keyboardWillHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
                // Klavye yüksekliği animasyonunu sıfırla
                Animated.timing(keyboardHeight, {
                    toValue: 0,
                    duration: Platform.OS === 'ios' ? 250 : 0,
                    useNativeDriver: false
                }).start();
            }
        );

        return () => {
            keyboardWillShowListener.remove();
            keyboardWillHideListener.remove();
        };
    }, [messages.length]);

    // Mesaj gönderme sonrası klavyeyi kapat
    const handleSendMessage = async (text) => {
        await sendMessage(text);
        if (Platform.OS === 'android') {
            Keyboard.dismiss();
        }
    };

    // Sohbeti temizleme fonksiyonu
    const clearChat = async () => {
        Alert.alert(
            translate('ai_chat_clear_title'),
            translate('ai_chat_clear_message'),
            [
                {
                    text: translate('ai_chat_clear_cancel'),
                    style: 'cancel'
                },
                {
                    text: translate('ai_chat_clear_confirm'),
                    onPress: async () => {
                        setMessages([]);
                        await AsyncStorage.removeItem('chatHistory');
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const renderSuggestedPrompt = ({ item }) => (
        <TouchableOpacity
            style={styles.promptChip}
            onPress={() => sendMessage(translate(item.prompt))}
        >
            <Ionicons name={item.icon} size={18} color="#6C3EE8" style={styles.promptIcon} />
            <Text style={styles.promptChipText} numberOfLines={1}>{translate(item.title)}</Text>
        </TouchableOpacity>
    );

    const renderMessage = ({ item }) => (
        <View style={[
            styles.messageContainer,
            item.isUser ? styles.userMessage : styles.aiMessage
        ]}>
            {!item.isUser && (
                <View style={styles.aiAvatar}>
                    <LinearGradient
                        colors={['#8C63FF', '#6C3EE8']}
                        style={styles.avatarGradient}
                    >
                        <MaterialIcons name="psychology" size={18} color="#FFF" />
                    </LinearGradient>
                </View>
            )}
            <View style={[
                styles.messageContent,
                item.isUser ? styles.userMessageContent : styles.aiMessageContent
            ]}>
                <Text style={[
                    styles.messageText,
                    item.isUser ? styles.userMessageText : styles.aiMessageText
                ]}>{item.text}</Text>
                <Text style={styles.timestamp}>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <LinearGradient
                colors={['#8C63FF', '#6C3EE8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerLeftSection}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{translate('ai_chat_title')}</Text>
                </View>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={clearChat}
                >
                    <Ionicons name="trash-outline" size={22} color="#FFF" />
                </TouchableOpacity>
            </LinearGradient>

            <KeyboardAvoidingView 
                style={styles.chatContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[
                        styles.messagesList,
                        { paddingBottom: messages.length > 0 ? 100 : 20 }
                    ]}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => {
                        if (messagesLoaded && messages.length > 0) {
                            flatListRef.current?.scrollToEnd({ animated: false });
                        }
                    }}
                    onLayout={() => {
                        if (messagesLoaded && messages.length > 0) {
                            flatListRef.current?.scrollToEnd({ animated: false });
                        }
                    }}
                    ListFooterComponent={() => (
                        isTyping ? (
                            <View style={styles.typingContainer}>
                                <View style={styles.aiAvatar}>
                                    <LinearGradient
                                        colors={['#8C63FF', '#6C3EE8']}
                                        style={styles.avatarGradient}
                                    >
                                        <MaterialIcons name="psychology" size={18} color="#FFF" />
                                    </LinearGradient>
                                </View>
                                <View style={styles.typingBubble}>
                                    <Animated.View style={styles.typingDotsContainer}>
                                        <Text style={styles.typingText}>{typingText}</Text>
                                    </Animated.View>
                                </View>
                            </View>
                        ) : null
                    )}
                />

                {messages.length === 0 && (
                    <View style={[
                        styles.emptyStateContainer,
                        keyboardVisible && styles.emptyStateContainerKeyboardOpen
                    ]}>
                        <View style={styles.emptyStateIconContainer}>
                            <LinearGradient
                                colors={['#8C63FF', '#6C3EE8']}
                                style={styles.emptyStateGradient}
                            >
                                <Ionicons name="chatbubble-ellipses" size={40} color="#FFF" />
                            </LinearGradient>
                        </View>
                        <Text style={styles.emptyStateTitle}>{translate('ai_chat_suggested_title')}</Text>
                        <View style={styles.promptsListContainer}>
                            <FlatList
                                data={SUGGESTED_PROMPTS}
                                renderItem={renderSuggestedPrompt}
                                keyExtractor={item => item.id}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.promptsList}
                                numColumns={2}
                                scrollEnabled={true}
                                columnWrapperStyle={styles.promptsRow}
                            />
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>

            <Animated.View 
                style={[
                    styles.inputContainerWrapper,
                    {
                        transform: [{ translateY: Animated.multiply(keyboardHeight, -1) }]
                    }
                ]}
            >
                <BlurView intensity={30} tint="light" style={styles.inputBlur}>
                    <SafeAreaView edges={['bottom']}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                ref={inputRef}
                                style={styles.input}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder={translate('ai_chat_input_placeholder')}
                                placeholderTextColor="#8C8C8C"
                                multiline
                                maxHeight={100}
                            />
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    !inputText.trim() && styles.sendButtonDisabled
                                ]}
                                onPress={() => handleSendMessage(inputText)}
                                disabled={!inputText.trim()}
                            >
                                <Ionicons 
                                    name="send" 
                                    size={20} 
                                    color={inputText.trim() ? "#FFF" : "#A8A8A8"} 
                                />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </BlurView>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9'
    },
    header: {
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    headerLeftSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
        marginRight: 8,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold'
    },
    menuButton: {
        padding: 8,
        marginRight: -8
    },
    chatContainer: {
        flex: 1,
        backgroundColor: '#F9F9F9',
        paddingBottom: 60,
    },
    messagesList: {
        padding: 16,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        maxWidth: '80%'
    },
    userMessage: {
        alignSelf: 'flex-end'
    },
    aiMessage: {
        alignSelf: 'flex-start'
    },
    aiAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        shadowColor: '#6C3EE8',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3
    },
    avatarGradient: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageContent: {
        padding: 14,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1
    },
    userMessageContent: {
        backgroundColor: '#6C3EE8',
        borderBottomRightRadius: 4,
    },
    aiMessageContent: {
        backgroundColor: '#FFF',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userMessageText: {
        color: '#FFF',
    },
    aiMessageText: {
        color: '#333',
    },
    timestamp: {
        fontSize: 11,
        color: 'rgba(150, 150, 150, 0.7)',
        marginTop: 6,
        alignSelf: 'flex-end'
    },
    inputContainerWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 1,
        borderTopColor: 'rgba(200, 200, 200, 0.3)',
        backgroundColor: 'transparent',
        zIndex: 100,
    },
    inputBlur: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        paddingVertical: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    input: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 8,
        maxHeight: 100,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(200, 200, 200, 0.3)',
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#6C3EE8',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6C3EE8',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
        elevation: 3
    },
    sendButtonDisabled: {
        backgroundColor: '#E0E0E0',
        shadowOpacity: 0,
    },
    emptyStateContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 80, // Input alanı için boşluk
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    emptyStateContainerKeyboardOpen: {
        justifyContent: 'flex-start',
        paddingTop: 60,
    },
    emptyStateIconContainer: {
        marginBottom: 24,
        shadowColor: '#6C3EE8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6
    },
    emptyStateGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 24,
        textAlign: 'center'
    },
    promptsListContainer: {
        width: '100%',
        maxHeight: Platform.OS === 'ios' ? '60%' : '50%',
    },
    promptsList: {
        paddingBottom: 20,
    },
    promptsRow: {
        justifyContent: 'space-between',
    },
    promptChip: {
        backgroundColor: '#FFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        marginVertical: 6,
        shadowColor: '#8C63FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        width: '48%', // Sabit genişlik (marjları hesaba katarak)
    },
    promptIcon: {
        marginRight: 8,
    },
    promptChipText: {
        color: '#333',
        fontSize: 14,
        fontWeight: '500',
        flex: 1, // Metin çok uzunsa sığdırmak için
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    typingBubble: {
        backgroundColor: '#F0E7FF',
        padding: 12,
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        maxWidth: '70%',
    },
    typingDotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typingText: {
        color: '#6C3EE8',
        fontSize: 14,
    }
});

export default AIChatScreen; 