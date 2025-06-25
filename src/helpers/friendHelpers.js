import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

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

// Diğer arkadaşlık ile ilgili fonksiyonlar buraya... 