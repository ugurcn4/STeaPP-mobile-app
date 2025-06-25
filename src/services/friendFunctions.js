import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Firebase ayar dosyasını buraya ekle
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Alert } from 'react-native';

/**
 * Kullanıcıları ada göre arar.
 * @param {string} searchQuery - Arama yapılacak kullanıcı adı.
 * @returns {Promise<Array>} - Bulunan kullanıcıların listesi.
 */
export const searchUsers = async (searchQuery) => {
    try {
        const usersRef = collection(db, 'users');

        // Tüm kullanıcıları çek
        const querySnapshot = await getDocs(usersRef);

        // JavaScript tarafında filtreleme yap
        const users = querySnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
            }))
            .filter(user =>
                user.informations?.name
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase())
            );
        return users;
    } catch (error) {
        console.error('Kullanıcı arama hatası:', error);
        throw error;
    }
};

/**
 * Giriş yapan kullanıcının UID'sini alır.
 * @returns {Promise<string | null>} - Kullanıcı UID'si veya null.
 */
export const getCurrentUserUid = () => {
    return new Promise((resolve, reject) => {
        const auth = getAuth();
        onAuthStateChanged(auth, (user) => {
            if (user) {
                resolve(user.uid);
            } else {
                resolve(null);
            }
        }, reject);
    });
};

/**
 * Arkadaşlık isteği gönderir.
 * @param {string} friendId - İstek gönderilecek arkadaşın UID'si.
 * @returns {Promise<Object>} - İşlem sonucu.
 */
export const sendFriendRequest = async (friendId) => {
    try {
        const currentUserId = await getCurrentUserUid();
        if (!currentUserId) {
            throw new Error('Giriş yapan kullanıcı bulunamadı.');
        }

        // Kullanıcı referanslarını oluştur
        const currentUserRef = doc(db, 'users', currentUserId);
        const friendUserRef = doc(db, 'users', friendId);

        // Kullanıcı belgelerini getir
        const currentUserSnapshot = await getDoc(currentUserRef);
        const friendUserSnapshot = await getDoc(friendUserRef);

        if (!currentUserSnapshot.exists() || !friendUserSnapshot.exists()) {
            throw new Error('Kullanıcı belgeleri bulunamadı.');
        }

        const currentUserData = currentUserSnapshot.data();
        const friendUserData = friendUserSnapshot.data();

        // Eğer friendRequests alanı eksikse varsayılan bir değer ayarla
        if (!currentUserData.friendRequests) {
            currentUserData.friendRequests = { sent: [], received: [] };
        }

        if (!friendUserData.friendRequests) {
            friendUserData.friendRequests = { sent: [], received: [] };
        }

        // Kullanıcı kendini arkadaş olarak ekleyemez 
        if (currentUserId === friendId) {
            return { success: false, message: 'Kendinize arkadaşlık isteği gönderemezsiniz.' };
        }

        // Zaten arkadaş olma durumu
        if (currentUserData.friends && currentUserData.friends.includes(friendId)) {
            return { success: false, message: 'Bu kullanıcı zaten arkadaşınız.' };
        }

        // Zaten gönderilmiş istek durumu
        if (currentUserData.friendRequests.sent.includes(friendId)) {
            return { success: false, message: 'Bu kullanıcıya zaten arkadaşlık isteği gönderdiniz.' };
        }

        // Zaten alınmış istek durumu
        if (currentUserData.friendRequests.received.includes(friendId)) {
            return { success: false, message: 'Bu kullanıcıdan zaten arkadaşlık isteği aldınız.' };
        }

        // Arkadaşlık isteği gönder
        await updateDoc(friendUserRef, {
            'friendRequests.received': arrayUnion(currentUserId),
        });

        await updateDoc(currentUserRef, {
            'friendRequests.sent': arrayUnion(friendId),
        });

        return { success: true, message: 'Arkadaşlık isteği gönderildi.' };
    } catch (error) {
        console.error('Arkadaşlık isteği gönderme hatası:', error.message);
        console.error('Hata detayı:', error);
        throw error;
    }
};

/**
 * Arkadaşlık isteğini kabul eder.
 * @param {string} friendId - İstek kabul edilecek arkadaşın UID'si.
 * @returns {Promise<Object>} - İşlem sonucu.
 */
export const acceptFriendRequest = async (friendId) => {
    try {
        const currentUserId = await getCurrentUserUid();
        if (!currentUserId) {
            throw new Error('Giriş yapan kullanıcı bulunamadı.');
        }

        const currentUserRef = doc(db, 'users', currentUserId);
        const friendUserRef = doc(db, 'users', friendId);

        // Kullanıcı belgelerini getir
        const currentUserSnapshot = await getDoc(currentUserRef);
        const friendUserSnapshot = await getDoc(friendUserRef);

        if (!currentUserSnapshot.exists() || !friendUserSnapshot.exists()) {
            throw new Error('Kullanıcı belgeleri bulunamadı.');
        }

        const currentUserData = currentUserSnapshot.data();

        // Sadece kendisine gönderilen istekleri kabul edebilir
        if (!currentUserData.friendRequests.received.includes(friendId)) {
            Alert.alert('Hata', 'Bu kullanıcıdan arkadaşlık isteği almadınız.');
            return { success: false, message: 'Bu kullanıcıdan arkadaşlık isteği almadınız.' };
        }

        // Arkadaş ilişkisini iki yönlü olarak kaydet
        await updateDoc(currentUserRef, {
            'friends': arrayUnion(friendId),
            'friendRequests.received': arrayRemove(friendId),
        });

        await updateDoc(friendUserRef, {
            'friends': arrayUnion(currentUserId),
            'friendRequests.sent': arrayRemove(currentUserId),
        });

        return { success: true, message: 'Arkadaşlık isteği kabul edildi.' };
    } catch (error) {
        console.error('Arkadaşlık isteği kabul etme hatası:', error);
        throw error;
    }
};

/**
 * Arkadaşlık isteğini reddeder.
 * @param {string} friendId - İstek reddedilecek arkadaşın UID'si.
 * @returns {Promise<Object>} - İşlem sonucu.
 */
export const rejectFriendRequest = async (friendId) => {
    try {
        const currentUserId = await getCurrentUserUid();
        if (!currentUserId) {
            throw new Error('Giriş yapan kullanıcı bulunamadı.');
        }

        const currentUserRef = doc(db, 'users', currentUserId);
        const friendUserRef = doc(db, 'users', friendId);

        // Kullanıcı belgelerini getir
        const currentUserSnapshot = await getDoc(currentUserRef);
        const friendUserSnapshot = await getDoc(friendUserRef);

        if (!currentUserSnapshot.exists() || !friendUserSnapshot.exists()) {
            throw new Error('Kullanıcı belgeleri bulunamadı.');
        }

        const currentUserData = currentUserSnapshot.data();

        // Sadece kendisine gönderilen istekleri reddedebilir
        if (!currentUserData.friendRequests.received.includes(friendId)) {
            Alert.alert('Hata', 'Bu kullanıcıdan arkadaşlık isteği almadınız.');
            return { success: false, message: 'Bu kullanıcıdan arkadaşlık isteği almadınız.' };
        }

        // Arkadaşlık isteğini reddet
        await updateDoc(currentUserRef, {
            'friendRequests.received': arrayRemove(friendId),
        });

        await updateDoc(friendUserRef, {
            'friendRequests.sent': arrayRemove(currentUserId),
        });

        return { success: true, message: 'Arkadaşlık isteği reddedildi.' };
    } catch (error) {
        console.error('Arkadaşlık isteği reddetme hatası:', error);
        throw error;
    }
};

// Bekleyen Arkadaşlık isteklerini alma
export const getFriendRequests = async () => {
    try {
        const currentUserId = await getCurrentUserUid();
        if (!currentUserId) throw new Error('Giriş yapan kullanıcı bulunamadı.');

        const userRef = doc(db, 'users', currentUserId);
        const userSnapshot = await getDoc(userRef);

        if (!userSnapshot.exists()) throw new Error('Kullanıcı belgesi bulunamadı.');

        const userData = userSnapshot.data();
        const receivedRequests = userData.friendRequests?.received || [];

        // Arkadaşlık isteklerini işlemeye başla
        const friendRequests = await Promise.all(
            receivedRequests.map(async (friendId) => {
                const friendRef = doc(db, 'users', friendId);
                const friendSnapshot = await getDoc(friendRef);

                if (friendSnapshot.exists()) {
                    const friendData = friendSnapshot.data();
                    return {
                        id: friendId,
                        name: friendData.informations.name || 'Bilinmeyen Kullanıcı',
                        profilePicture: friendData.profilePicture || null,
                        friends: friendData.friends || [],
                    };
                }

                return {
                    id: friendId,
                    name: 'Bilinmeyen Kullanıcı',
                    profilePicture: null,
                    friends: [],
                };
            })
        );

        return friendRequests;
    } catch (error) {
        console.error('Arkadaşlık isteklerini alma hatası:', error);
        throw error;
    }
};