import { db } from '../../firebaseConfig';
import { doc, getDoc} from 'firebase/firestore';

// Arkadaşları getir
export const getFriends = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();

        if (!userData.friends) {
            return [];
        }

        // Arkadaşların detaylı bilgilerini al
        const friendPromises = userData.friends.map(async (friendId) => {
            try {
                const friendDoc = await getDoc(doc(db, 'users', friendId));
                if (friendDoc.exists()) {
                    const friendData = friendDoc.data();
                    return {
                        id: friendId,
                        ...friendData,
                        name: friendData.informations?.name || 'İsimsiz Kullanıcı',
                        username: friendData.informations?.username,
                        email: friendData.informations?.email
                    };
                }
                return null;
            } catch (error) {
                console.error(`${friendId} için detaylar alınamadı:`, error);
                return null;
            }
        });

        const friends = await Promise.all(friendPromises);
        const validFriends = friends.filter(friend => friend !== null);

        return validFriends;
    } catch (error) {
        console.error('Arkadaşları getirme hatası:', error);
        throw error;
    }
};

// Arkadaş detaylarını getir
export const getFriendDetails = async (friendId) => {
    try {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        if (!friendDoc.exists()) {
            return null;
        }
        return {
            id: friendId,
            ...friendDoc.data()
        };
    } catch (error) {
        console.error('Arkadaş detayları alınırken hata:', error);
        return null;
    }
};