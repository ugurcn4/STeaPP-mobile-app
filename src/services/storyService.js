import { db, storage } from '../../firebaseConfig';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, deleteDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Önbellek için basit bir Map yapısı
const storyCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 dakika

export const uploadStory = async (userId, storyFile, storyData = {}) => {
    try {
        // Storage'a hikayeyi yükle
        const storyRef = ref(storage, `stories/${userId}/${Date.now()}`);
        await uploadBytes(storyRef, storyFile);
        const storyUrl = await getDownloadURL(storyRef);

        // Hikaye verilerini hazırla
        const storyDoc = {
            userId,
            storyUrl,
            createdAt: Timestamp.now(),
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
            viewedBy: [],
            likes: [],
            text: storyData.text || '',
            textPosition: storyData.textPosition || { x: 0, y: 0 },
            textColor: storyData.textColor || '#FFFFFF',
            fontSize: storyData.fontSize || 20,
            location: storyData.location || null,
            music: storyData.music || null,
        };

        // Firestore'a hikaye bilgilerini kaydet
        const docRef = await addDoc(collection(db, 'stories'), storyDoc);

        return { success: true, storyId: docRef.id };
    } catch (error) {
        console.error('Hikaye yükleme hatası:', error);
        return { success: false, error: error.message };
    }
};

export const getStories = async (userIds) => {
    try {
        if (!userIds || userIds.length === 0) {
            return [];
        }

        const cacheKey = userIds.sort().join('_');
        const cachedData = storyCache.get(cacheKey);
        if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
            return cachedData.stories;
        }

        const storiesRef = collection(db, 'stories');
        const q = query(
            storiesRef,
            where('userId', 'in', userIds),
            where('expiresAt', '>', Timestamp.now()),
            orderBy('expiresAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const stories = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            textPosition: doc.data().textPosition || { x: 0, y: 0 },
            textColor: doc.data().textColor || '#FFFFFF',
            fontSize: doc.data().fontSize || 20,
        }));

        storyCache.set(cacheKey, {
            stories,
            timestamp: Date.now()
        });

        return stories;
    } catch (error) {
        console.error('Hikayeleri getirme hatası:', error);
        return [];
    }
};

export const deleteExpiredStories = async () => {
    try {
        const storiesRef = collection(db, 'stories');
        const q = query(
            storiesRef,
            where('expiresAt', '<', Timestamp.now())
        );

        const querySnapshot = await getDocs(q);
        const batch = db.batch();

        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
    } catch (error) {
        console.error('Süresi dolmuş hikayeleri silme hatası:', error);
    }
};

export const checkAndDeleteExpiredStories = async () => {
    try {
        const storiesRef = collection(db, 'stories');
        const now = Timestamp.now();
        const oneDayAgo = new Date(now.toMillis() - 24 * 60 * 60 * 1000);

        // Süresi dolmuş hikayeleri bul
        const q = query(
            storiesRef,
            where('timestamp', '<', Timestamp.fromDate(oneDayAgo))
        );

        const snapshot = await getDocs(q);

        // Her bir süresi dolmuş hikaye için
        for (const doc of snapshot.docs) {
            const story = doc.data();

            // Önce Storage'dan medyayı silmeyi dene
            if (story.mediaUrl) {
                try {
                    // URL'den storage path'ini çıkar
                    const storageRef = ref(storage, story.mediaUrl);
                    await deleteObject(storageRef).catch(error => {
                        // Eğer dosya zaten silinmişse veya bulunamazsa hata verme
                        if (error.code !== 'storage/object-not-found') {
                            console.error('Hikaye medyası silinirken hata:', error);
                        }
                    });
                } catch (error) {
                }
            }

            // Firestore'dan hikayeyi sil
            try {
                await deleteDoc(doc.ref);
            } catch (error) {
                console.error('Hikaye dokümanı silinirken hata:', error);
            }
        }

        return true;
    } catch (error) {
        console.error('Süresi dolmuş hikayeleri silme hatası:', error);
        return false;
    }
};

export const getStoryViewers = async (storyId) => {
    try {
        const storyRef = doc(db, 'stories', storyId);
        const storyDoc = await getDoc(storyRef);

        if (!storyDoc.exists()) return [];

        const storyData = storyDoc.data();
        const viewerIds = storyData.viewedBy || [];
        const viewTimes = storyData.viewTimes || {};  // Görüntüleme zamanları
        const likeIds = storyData.likes || [];

        const viewersPromises = viewerIds.map(async (viewerId) => {
            const userDoc = await getDoc(doc(db, 'users', viewerId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const profilePicture =
                    userData.profilePicture ||
                    userData.informations?.profilePicture ||
                    userData.informations?.profileImage ||
                    null;

                // viewTimes'dan ilgili kullanıcının görüntüleme zamanını al
                const viewTime = viewTimes[viewerId];

                return {
                    id: viewerId,
                    name: userData.informations?.name || 'İsimsiz Kullanıcı',
                    profilePicture,
                    viewedAt: viewTime,  // Timestamp olarak gönder
                    liked: likeIds.includes(viewerId)
                };
            }
            return null;
        });

        const viewers = await Promise.all(viewersPromises);
        return viewers
            .filter(viewer => viewer !== null)
            .sort((a, b) => {
                // Tarihe göre sırala (en yeni en üstte)
                if (!a.viewedAt || !b.viewedAt) return 0;
                return b.viewedAt.seconds - a.viewedAt.seconds;
            });
    } catch (error) {
        console.error('Görüntüleyenler alınırken hata:', error);
        return [];
    }
};

export const likeStory = async (storyId, userId) => {
    try {
        const storyRef = doc(db, 'stories', storyId);
        const storyDoc = await getDoc(storyRef);

        if (!storyDoc.exists()) {
            return false;
        }

        const storyData = storyDoc.data();
        const likes = storyData.likes || [];
        const isLiked = likes.includes(userId);

        if (isLiked) {
            // Beğeniyi kaldır
            await updateDoc(storyRef, {
                likes: arrayRemove(userId)
            });
        } else {
            // Beğeni ekle
            await updateDoc(storyRef, {
                likes: arrayUnion(userId)
            });
        }

        return true;
    } catch (error) {
        console.error('Hikaye beğenme hatası:', error);
        return false;
    }
};

// Beğeni sayısını getir
export const getStoryLikes = async (storyId) => {
    try {
        const storyRef = doc(db, 'stories', storyId);
        const storyDoc = await getDoc(storyRef);

        if (!storyDoc.exists()) {
            return 0;
        }

        const storyData = storyDoc.data();
        return storyData.likes?.length || 0;
    } catch (error) {
        console.error('Beğeni sayısı alma hatası:', error);
        return 0;
    }
};

export const markStoryAsViewed = async (storyId, userId) => {
    try {
        const storyRef = doc(db, 'stories', storyId);
        const storyDoc = await getDoc(storyRef);

        if (!storyDoc.exists()) {
            console.error('Hikaye bulunamadı');
            return false;
        }

        const storyData = storyDoc.data();
        const currentViewers = storyData.viewedBy || [];
        const viewTime = Timestamp.now();

        // Eğer zaten görüntülemişse tekrar ekleme
        if (currentViewers.includes(userId)) {
            return true;
        }

        // Yeni görüntüleme ekle
        await updateDoc(storyRef, {
            viewedBy: arrayUnion(userId),
            viewTimes: {
                ...(storyData.viewTimes || {}),
                [userId]: viewTime
            }
        });
        return true;
    } catch (error) {
        console.error('Hikaye görüntüleme kaydı hatası:', error);
        return false;
    }
};

// Önbelleği temizle
export const clearStoryCache = () => {
    storyCache.clear();
};

// Hikayeyi sil
export const deleteStory = async (storyId) => {
    try {
        // Hikaye dokümanını al
        const storyRef = doc(db, 'stories', storyId);
        const storyDoc = await getDoc(storyRef);

        if (!storyDoc.exists()) {
            throw new Error('Hikaye bulunamadı');
        }

        const storyData = storyDoc.data();

        // Storage'dan medyayı sil
        if (storyData.storyUrl) {
            const storageRef = ref(storage, storyData.storyUrl);
            try {
                await deleteObject(storageRef);
            } catch (error) {
                console.error('Storage medya silme hatası:', error);
                // Medya zaten silinmiş olabilir, devam et
            }
        }

        // Firestore'dan hikayeyi sil
        await deleteDoc(storyRef);

        return { success: true };
    } catch (error) {
        console.error('Hikaye silme hatası:', error);
        return { success: false, error: error.message };
    }
}; 