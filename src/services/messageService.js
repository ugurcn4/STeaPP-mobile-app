import { db } from '../../firebaseConfig';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
    doc,
    getDoc,
    updateDoc,
    getDocs,
    limit,
    setDoc,
    increment,
    writeBatch,
} from 'firebase/firestore';
import { storage } from '../../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Platform } from 'react-native';

// Yeni mesaj gönderme
export const sendMessage = async (senderId, receiverId, message, type = 'text', storyData = null) => {
    try {
        // ChatId'yi her zaman aynı formatta oluştur
        const participants = [senderId, receiverId].sort();
        const chatId = `${participants[0]}_${participants[1]}`;

        // Chat dokümanını kontrol et ve oluştur
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        const timestamp = Timestamp.now();

        const messageData = {
            chatId,
            senderId,
            receiverId,
            message,
            timestamp,
            read: false,  // Her zaman false olarak başlat
            mediaType: type
        };

        // Eğer hikaye yanıtı ise, hikaye verilerini ekle
        if (type === 'story_reply' && storyData) {

            messageData.mediaType = 'story_reply';
            messageData.storyUrl = storyData.storyUrl;
            messageData.storyId = storyData.storyId;
        }


        if (!chatDoc.exists()) {
            // Chat yoksa oluştur
            await setDoc(chatRef, {
                participants: [senderId, receiverId],
                lastMessage: { message, mediaType: type },
                lastMessageTime: timestamp,
                unreadCount: {
                    [senderId]: 0,
                    [receiverId]: 1
                }
            });
        } else {
            // Varsa güncelle
            await updateDoc(chatRef, {
                lastMessage: { message, mediaType: type },
                lastMessageTime: timestamp,
                [`unreadCount.${receiverId}`]: increment(1)
            });
        }

        // Mesajı ekle
        await addDoc(collection(db, 'messages'), messageData);

        return { success: true };
    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        return { success: false, error };
    }
};

// Mesajları dinleme
export const subscribeToMessages = (userId1, userId2, callback) => {
    // ChatId'yi aynı formatta oluştur
    const participants = [userId1, userId2].sort();
    const chatId = `${participants[0]}_${participants[1]}`;

    const q = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId),
        orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => {
            const data = doc.data();
            // Eğer mesaj bu kullanıcı için silinmişse, gösterme
            if (data.deletedFor?.includes(userId1)) {
                return null;
            }
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp
            };
        })
            .filter(message => message !== null); // Silinen mesajları filtrele

        // Mesajları tarihe göre sırala (en yeni en üstte)
        const sortedMessages = messages.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
        callback(sortedMessages);
    });
};

// Mesajı okundu olarak işaretle
export const markMessageAsRead = async (messageId) => {
    try {
        await updateDoc(doc(db, 'messages', messageId), { read: true });
        return { success: true };
    } catch (error) {
        console.error('Mesaj okundu işaretlenemedi:', error);
        return { success: false, error };
    }
};

// Mesajı okundu olarak işaretle
export const markChatAsRead = async (chatId, receiverId) => {
    try {
        const batch = writeBatch(db);

        // 1. Okunmamış mesajları bul
        const q = query(
            collection(db, 'messages'),
            where('chatId', '==', chatId),
            where('receiverId', '==', receiverId),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);

        // Okunmamış mesaj yoksa işlem yapma
        if (snapshot.empty) {
            return { success: true };
        }

        // 2. Tüm mesajları batch ile güncelle
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        // 3. Chat dokümanını da aynı batch içinde güncelle
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (chatDoc.exists()) {
            batch.update(chatRef, {
                [`unreadCount.${receiverId}`]: 0
            });
        }

        // 4. Batch'i commit et
        await batch.commit();

        return { success: true };
    } catch (error) {
        console.error('Mesajlar okundu olarak işaretlenemedi:', error);
        return { success: false, error };
    }
};

// Medya mesajı gönderme
export const sendMediaMessage = async (senderId, receiverId, mediaFile, type = 'image') => {
    try {
        const chatId = [senderId, receiverId].sort().join('_');
        const timestamp = Timestamp.now();

        // Storage'a medya yükleme
        const storageRef = ref(storage, `chat_media/${chatId}/${timestamp.toMillis()}`);
        await uploadBytes(storageRef, mediaFile);
        const mediaUrl = await getDownloadURL(storageRef);

        // Mesajı veritabanına kaydetme
        await addDoc(collection(db, 'messages'), {
            chatId,
            senderId,
            receiverId,
            mediaUrl,
            mediaType: type,
            timestamp,
            read: false
        });

        // Chat dokümanını güncelle
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            await setDoc(chatRef, {
                participants: [senderId, receiverId],
                lastMessage: { mediaType: type },
                lastMessageTime: timestamp,
                unreadCount: {
                    [senderId]: 0,
                    [receiverId]: 1
                }
            });
        } else {
            await updateDoc(chatRef, {
                lastMessage: { mediaType: type },
                lastMessageTime: timestamp,
                [`unreadCount.${receiverId}`]: increment(1)
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Medya gönderme hatası:', error);
        return { success: false, error };
    }
};

// Sesli mesaj gönderme
export const sendVoiceMessage = async (senderId, receiverId, audioBlob) => {
    try {
        const chatId = [senderId, receiverId].sort().join('_');
        const timestamp = Timestamp.now();

        const extension = Platform.OS === 'ios' ? '.m4a' : '.mp4';
        const fileName = `voice_${timestamp.toMillis()}${extension}`;

        const metadata = {
            contentType: 'audio/mp4',
        };

        const storageRef = ref(storage, `chat_media/${chatId}/${fileName}`);
        await uploadBytes(storageRef, audioBlob, metadata);
        const audioUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, 'messages'), {
            chatId,
            senderId,
            receiverId,
            audioUrl,
            mediaType: 'voice',
            duration: audioBlob.duration || 0,
            timestamp,
            read: false,
            fileName,
            platform: Platform.OS
        });

        // Chat dokümanını güncelle
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            await setDoc(chatRef, {
                participants: [senderId, receiverId],
                lastMessage: { mediaType: 'voice' },
                lastMessageTime: timestamp,
                unreadCount: {
                    [senderId]: 0,
                    [receiverId]: 1
                }
            });
        } else {
            await updateDoc(chatRef, {
                lastMessage: { mediaType: 'voice' },
                lastMessageTime: timestamp,
                [`unreadCount.${receiverId}`]: increment(1)
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Ses mesajı gönderme hatası:', error);
        return { success: false, error };
    }
};

// Son sohbetleri getir
export const getRecentChats = (userId, callback) => {
    const chatsRef = collection(db, 'chats');
    const q = query(
        chatsRef,
        where('participants', 'array-contains', userId)
    );

    return onSnapshot(q, async (snapshot) => {
        try {
            const chatsData = await Promise.all(
                snapshot.docs.map(async (docSnapshot) => {
                    const chatData = docSnapshot.data();
                    const otherUserId = chatData.participants.find(id => id !== userId);

                    // Kullanıcı bilgilerini al
                    const userRef = doc(db, 'users', otherUserId);
                    const userDoc = await getDoc(userRef);
                    const userData = userDoc.data() || {};
                    const userInfo = userData.informations || {};

                    // unreadCount'u doğrudan chat dokümanından al
                    const unreadCount = chatData.unreadCount?.[userId] || 0;

                    return {
                        chatId: docSnapshot.id,
                        lastMessage: chatData.lastMessage || {},
                        timestamp: chatData.lastMessageTime,
                        unreadCount,
                        user: {
                            id: otherUserId,
                            name: userInfo.name || userData.name || 'İsimsiz',
                            profilePicture: userInfo.profilePicture || userData.profilePicture,
                            isOnline: userData.isOnline || false,
                        }
                    };
                })
            );

            const sortedChats = chatsData
                .filter(chat => chat.timestamp)
                .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

            callback(sortedChats);
        } catch (error) {
            console.error('Sohbet verilerini işlerken hata:', error);
            callback([]);
        }
    });
};

export const getUnreadMessageCount = async (userId) => {
    try {
        const messagesRef = collection(db, 'messages');
        const q = query(
            messagesRef,
            where('receiverId', '==', userId),
            where('read', '==', false)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.size; // Okunmamış mesaj sayısı

    } catch (error) {
        console.error('Okunmamış mesaj sayısı alınırken hata:', error);
        return 0;
    }
};

// Story yanıtı gönderme
export const sendStoryReply = async (senderId, receiverId, message, storyData) => {
    try {
        if (!storyData || !storyData.storyUrl || !storyData.storyId) {
            throw new Error('Story verisi eksik');
        }

        return await sendMessage(senderId, receiverId, message, 'story_reply', storyData);
    } catch (error) {
        console.error('Story yanıtı gönderme hatası:', error);
        return { success: false, error };
    }
};

// Sohbeti silme (benden sil)
export const deleteChat = async (chatId, userId) => {
    try {
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            throw new Error('Sohbet bulunamadı');
        }

        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, where('chatId', '==', chatId));
        const snapshot = await getDocs(q);

        const batch = writeBatch(db);

        // Her mesaj için deletedFor alanını güncelle
        snapshot.docs.forEach((doc) => {
            const messageData = doc.data();
            const updates = {};

            if (!messageData.deletedFor) {
                updates.deletedFor = [userId];
            } else if (!messageData.deletedFor.includes(userId)) {
                updates.deletedFor = [...messageData.deletedFor, userId];
            }

            if (Object.keys(updates).length > 0) {
                batch.update(doc.ref, updates);
            }
        });

        // Chat dokümanını güncelle
        const chatData = chatDoc.data();
        const updates = {
            deletedFor: chatData.deletedFor ?
                [...new Set([...chatData.deletedFor, userId])] :
                [userId]
        };
        batch.update(chatRef, updates);

        await batch.commit();

        return { success: true };
    } catch (error) {
        console.error('Sohbet silme hatası:', error);
        return { success: false, error };
    }
};

// Sohbeti herkesten silme
export const deleteChatForEveryone = async (chatId) => {
    try {
        // Tüm mesajları getir
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, where('chatId', '==', chatId));
        const snapshot = await getDocs(q);

        // Mesajları sil
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Sohbeti sil
        const chatRef = doc(db, 'chats', chatId);
        batch.delete(chatRef);

        await batch.commit();

        return { success: true };
    } catch (error) {
        console.error('Sohbet silme hatası:', error);
        return { success: false, error };
    }
};

// Mesajı favorilere ekleme
export const addMessageToFavorites = async (userId, message) => {
    try {
        await addDoc(collection(db, 'favorites'), {
            userId,
            messageId: message.id,
            message: message.message || '',
            mediaType: message.mediaType || 'text',
            mediaUrl: message.mediaUrl || null,
            audioUrl: message.audioUrl || null,
            timestamp: message.timestamp,
            chatId: message.chatId,
            senderId: message.senderId,
            receiverId: message.receiverId,
            addedAt: Timestamp.now()
        });
        return { success: true };
    } catch (error) {
        console.error('Favorilere ekleme hatası:', error);
        throw error;
    }
};

// Favorileri getir
export const getFavoriteMessages = async (userId) => {
    try {
        const q = query(
            collection(db, 'favorites'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // JavaScript tarafında sıralama yapılıyor
        return messages.sort((a, b) => b.addedAt.toMillis() - a.addedAt.toMillis());
    } catch (error) {
        console.error('Favorileri getirme hatası:', error);
        throw error;
    }
};

// Mesajı silme (benden)
export const deleteMessage = async (messageId, userId) => {
    try {
        const batch = writeBatch(db);
        const messageRef = doc(db, 'messages', messageId);
        const messageDoc = await getDoc(messageRef);

        if (!messageDoc.exists()) {
            throw new Error('Mesaj bulunamadı');
        }

        const messageData = messageDoc.data();
        const currentDeletedFor = messageData.deletedFor || [];
        const newDeletedFor = [...new Set([...currentDeletedFor, userId])];

        // Eğer mesaj her iki kullanıcı tarafından da silindiyse
        if (newDeletedFor.length === 2) {
            // Mesajı tamamen sil
            batch.delete(messageRef);

            // Chat dokümanını güncelle
            const chatRef = doc(db, 'chats', messageData.chatId);
            const chatDoc = await getDoc(chatRef);

            if (chatDoc.exists()) {
                const chatData = chatDoc.data();
                // Silinen mesaj son mesajsa, bir önceki mesajı bul
                if (chatData.lastMessage?.message === messageData.message &&
                    chatData.lastMessageTime?.toMillis() === messageData.timestamp.toMillis()) {

                    const q = query(
                        collection(db, 'messages'),
                        where('chatId', '==', messageData.chatId),
                        where('timestamp', '<', messageData.timestamp),
                        orderBy('timestamp', 'desc'),
                        limit(1)
                    );

                    const prevMessages = await getDocs(q);

                    if (!prevMessages.empty) {
                        const prevMessage = prevMessages.docs[0].data();
                        batch.update(chatRef, {
                            lastMessage: {
                                message: prevMessage.message,
                                mediaType: prevMessage.mediaType
                            },
                            lastMessageTime: prevMessage.timestamp
                        });
                    } else {
                        // Eğer başka mesaj yoksa lastMessage'ı temizle
                        batch.update(chatRef, {
                            lastMessage: {
                                message: '',
                                mediaType: 'text'
                            },
                            lastMessageTime: Timestamp.now()
                        });
                    }
                }
            }
        } else {
            // Sadece deletedFor alanını güncelle
            batch.update(messageRef, {
                deletedFor: newDeletedFor
            });
        }

        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error('Mesaj silme hatası:', error);
        throw error;
    }
};

// Mesajı şikayet etme
export const reportMessage = async (messageId) => {
    try {
        await addDoc(collection(db, 'reports'), {
            messageId,
            timestamp: Timestamp.now(),
            status: 'pending'
        });
        return { success: true };
    } catch (error) {
        console.error('Mesaj şikayet hatası:', error);
        throw error;
    }
};

// Mesajı herkesten silme
export const deleteMessageForEveryone = async (messageId) => {
    try {
        const batch = writeBatch(db);
        const messageRef = doc(db, 'messages', messageId);
        const messageDoc = await getDoc(messageRef);

        if (!messageDoc.exists()) {
            throw new Error('Mesaj bulunamadı');
        }

        const messageData = messageDoc.data();

        // Mesajı sil
        batch.delete(messageRef);

        // Chat dokümanını güncelle
        const chatRef = doc(db, 'chats', messageData.chatId);
        const chatDoc = await getDoc(chatRef);

        if (chatDoc.exists()) {
            const chatData = chatDoc.data();
            // Silinen mesaj son mesajsa, bir önceki mesajı bul
            if (chatData.lastMessage?.message === messageData.message &&
                chatData.lastMessageTime?.toMillis() === messageData.timestamp.toMillis()) {

                const q = query(
                    collection(db, 'messages'),
                    where('chatId', '==', messageData.chatId),
                    where('timestamp', '<', messageData.timestamp),
                    orderBy('timestamp', 'desc'),
                    limit(1)
                );

                const prevMessages = await getDocs(q);

                if (!prevMessages.empty) {
                    const prevMessage = prevMessages.docs[0].data();
                    batch.update(chatRef, {
                        lastMessage: {
                            message: prevMessage.message,
                            mediaType: prevMessage.mediaType
                        },
                        lastMessageTime: prevMessage.timestamp
                    });
                } else {
                    // Eğer başka mesaj yoksa lastMessage'ı temizle
                    batch.update(chatRef, {
                        lastMessage: {
                            message: '',
                            mediaType: 'text'
                        },
                        lastMessageTime: Timestamp.now()
                    });
                }
            }
        }

        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error('Mesaj silme hatası:', error);
        throw error;
    }
}; 