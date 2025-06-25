import { db, storage } from '../../firebaseConfig';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    arrayUnion,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    startAfter,
    arrayRemove,
    getDoc,
    Timestamp,
    onSnapshot,
    deleteDoc,
    writeBatch
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';

export const createPost = async (postData, imageUri) => {
    try {
        // 1. Görseli Storage'a yükle
        const imageRef = ref(storage, `posts/${Date.now()}_${imageUri.split('/').pop()}`);
        const response = await fetch(imageUri);
        if (!response.ok) {
            throw new Error('Görsel yüklenirken hata: ' + response.statusText);
        }

        const blob = await response.blob();
        await uploadBytes(imageRef, blob);
        const imageUrl = await getDownloadURL(imageRef);

        // 2. Post verilerini hazırla
        const post = {
            userId: postData.userId,
            imageUrl: imageUrl,
            description: postData.description || '',
            tags: postData.tags || [],
            location: postData.location || null,
            isPublic: postData.isPublic ?? true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            stats: {
                likes: 0,
                comments: 0
            }
        };

        // 3. Firestore'a post ekle
        const postRef = await addDoc(collection(db, 'posts'), post);
        return postRef.id;
    } catch (error) {
        console.error('Post oluşturma hatası:', error);
        throw error;
    }
};

// Gönderileri getir
export const fetchPosts = async (currentUserId, page = 1, pageSize = 10, friendsList = [], lastVisibleDoc = null) => {
    try {
        const postsRef = collection(db, 'posts');

        // Ana sorguyu oluştur
        let q;
        if (lastVisibleDoc) {
            // Eğer son görünen belge verilmişse, ondan sonrasını getir
            q = query(
                postsRef,
                orderBy('createdAt', 'desc'),
                startAfter(lastVisibleDoc),
                limit(pageSize + 1) // Bir fazla getir, daha fazla olup olmadığını kontrol etmek için
            );
        } else {
            // İlk sayfa için
            q = query(
                postsRef,
                orderBy('createdAt', 'desc'),
                limit(pageSize + 1) // Bir fazla getir, daha fazla olup olmadığını kontrol etmek için
            );
        }

        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs;

        // Daha fazla gönderi olup olmadığını kontrol et
        const hasMore = docs.length > pageSize;

        // Eğer daha fazla gönderi varsa, son belgeyi ayır
        const postsToProcess = hasMore ? docs.slice(0, pageSize) : docs;
        const lastVisible = docs.length > 0 ? docs[docs.length - 1] : null;

        const posts = [];

        // Kullanıcı bilgilerini toplu olarak çekmek için map oluştur
        const userIds = new Set();
        postsToProcess.forEach(doc => {
            userIds.add(doc.data().userId);
        });

        // Tüm kullanıcı bilgilerini tek seferde çek
        const userDataMap = {};
        const userPromises = Array.from(userIds).map(async (userId) => {
            const userDocRef = doc(db, 'users', userId);
            const userDocSnapshot = await getDoc(userDocRef);
            if (userDocSnapshot.exists()) {
                userDataMap[userId] = userDocSnapshot.data();
            }
        });

        await Promise.all(userPromises);

        for (const docSnapshot of postsToProcess) {
            const postData = docSnapshot.data();

            try {
                // Kullanıcı bilgilerini map'ten al
                const userData = userDataMap[postData.userId] || {};

                // Gizlilik kontrolü
                const visibility = userData.settings?.visibility || 'public';

                // Kullanıcı kendisi değilse ve profil görünürlüğü private ise ve arkadaş değilse, postu gösterme
                if (postData.userId !== currentUserId &&
                    visibility === 'private' &&
                    !friendsList.includes(postData.userId)) {
                    continue;
                }

                // Post görünürlük kontrolü
                if (!postData.isPublic &&
                    !friendsList.includes(postData.userId) &&
                    postData.userId !== currentUserId) {
                    continue;
                }

                posts.push({
                    id: docSnapshot.id,
                    ...postData,
                    user: {
                        id: postData.userId,
                        name: userData.informations?.name || 'İsimsiz Kullanıcı',
                        username: userData.informations?.username,
                        avatar: userData.profilePicture || null
                    },
                    likedBy: postData.likedBy || [],
                    comments: postData.comments || [],
                    createdAt: postData.createdAt?.toDate() || new Date(),
                    imageUrl: postData.imageUrl,
                    description: postData.description || '',
                    tags: postData.tags || [],
                    stats: postData.stats || { likes: 0, comments: 0 }
                });
            } catch (userError) {
                console.error('Kullanıcı bilgileri alınırken hata:', userError);
            }
        }

        // İlk beğenen kişilerin bilgilerini toplu olarak çek
        const likerIds = new Set();
        posts.forEach(post => {
            if (post.likedBy && post.likedBy.length > 0) {
                likerIds.add(post.likedBy[0]);
            }
        });

        const likerDataMap = {};
        const likerPromises = Array.from(likerIds).map(async (likerId) => {
            const likerDocRef = doc(db, 'users', likerId);
            const likerDocSnapshot = await getDoc(likerDocRef);
            if (likerDocSnapshot.exists()) {
                likerDataMap[likerId] = likerDocSnapshot.data();
            }
        });

        await Promise.all(likerPromises);

        // Beğenen kişi bilgilerini ekle
        const postsWithUserData = posts.map(post => {
            let firstLikerName = '';
            if (post.likedBy && post.likedBy.length > 0) {
                const firstLikerId = post.likedBy[0];
                const likerData = likerDataMap[firstLikerId];

                if (likerData) {
                    if (likerData.informations?.name) {
                        firstLikerName = likerData.informations.name;
                    } else if (likerData.informations?.username) {
                        firstLikerName = likerData.informations.username;
                    } else if (likerData.name) {
                        firstLikerName = likerData.name;
                    } else {
                        firstLikerName = 'İsimsiz Kullanıcı';
                    }
                } else {
                    firstLikerName = 'İsimsiz Kullanıcı';
                }
            }

            return {
                ...post,
                firstLikerName
            };
        });

        return {
            posts: postsWithUserData,
            lastVisible: lastVisible,
            hasMore: hasMore
        };
    } catch (error) {
        console.error('Gönderiler alınırken hata:', error);
        throw error;
    }
};

// Beğeni işlemi
export const toggleLikePost = async (postId, userId) => {
    if (!postId || !userId) {
        throw new Error('Post ID ve User ID gerekli');
    }

    try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);

        if (!postDoc.exists()) {
            throw new Error('Post bulunamadı');
        }

        const postData = postDoc.data();
        const currentLikes = postData.stats?.likes || 0;
        const likedBy = postData.likedBy || [];
        const isLiked = likedBy.includes(userId);

        // Beğeni ekleniyorsa veya kaldırılıyorsa
        if (!isLiked) {
            // Beğeni ekleniyor - bildirim için like kaydı oluştur
            const likesRef = collection(db, 'likes');
            await addDoc(likesRef, {
                postId,
                userId,  // beğeniyi yapan kişi
                ownerId: postData.userId, // gönderi sahibi
                createdAt: new Date()
            });
        } else {
            // Beğeni kaldırılıyor - bildirim kaydını silmeye gerek yok
            // İsteğe bağlı olarak burada ilgili beğeni belgesini bulup silebilirsiniz
        }

        await updateDoc(postRef, {
            'stats.likes': isLiked ? currentLikes - 1 : currentLikes + 1,
            likedBy: isLiked ? arrayRemove(userId) : arrayUnion(userId)
        });

        return !isLiked; // true: beğenildi, false: beğeni kaldırıldı
    } catch (error) {
        console.error('Beğeni işlemi hatası:', error);
        throw error;
    }
};

// Yorum ve yanıt ekleme fonksiyonunu güncelleyelim
export const addComment = async (postId, userId, comment, replyToId = null) => {
    // Parametreleri detaylı kontrol edelim
    if (!postId) {
        throw new Error('Post ID gerekli');
    }
    if (!userId) {
        throw new Error('User ID gerekli');
    }
    if (!comment || comment.trim() === '') {
        throw new Error('Yorum metni gerekli');
    }

    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);

        if (!postDoc.exists()) {
            throw new Error('Post bulunamadı');
        }

        const postData = postDoc.data();
        const currentComments = postData.comments || [];
        const currentStats = postData.stats || { comments: 0 };

        // Tüm alanların tanımlı olduğundan emin olalım
        const newComment = {
            id: Date.now().toString(),
            userId: userId || '',
            text: comment.trim(),
            createdAt: new Date().toISOString(),
            user: {
                name: userData.informations?.name || 'İsimsiz Kullanıcı',
                username: userData.informations?.username || '',
                avatar: userData.profilePicture || null
            },
            replies: []
        };

        // Her alanın undefined olmadığından emin olalım
        Object.keys(newComment).forEach(key => {
            if (newComment[key] === undefined) {
                newComment[key] = null;
            }
        });

        // Kullanıcı kendi gönderisine yorum yapmıyorsa bildirim için comments koleksiyonuna kayıt ekleyelim
        if (userId !== postData.userId) {
            const commentsRef = collection(db, 'comments');
            await addDoc(commentsRef, {
                postId,
                userId,  // yorumu yapan kişi
                ownerId: postData.userId, // gönderi sahibi
                text: comment.trim(),
                replyToId: replyToId,
                createdAt: new Date()
            });
        }

        // Yanıt olarak mı yoksa ana yorum olarak mı ekleniyor kontrol edelim
        if (replyToId) {
            // Bir yoruma yanıt veriliyor
            const updatedComments = currentComments.map(c => {
                if (c.id === replyToId) {
                    return {
                        ...c,
                        replies: [...(c.replies || []), newComment]
                    };
                }
                return c;
            });

            await updateDoc(postRef, {
                comments: updatedComments,
                'stats.comments': (currentStats.comments || 0) + 1
            });
        } else {
            // Ana yorum ekleniyor
            await updateDoc(postRef, {
                comments: [...currentComments, newComment],
                'stats.comments': (currentStats.comments || 0) + 1
            });
        }

        return newComment;
    } catch (error) {
        console.error('Yorum ekleme hatası:', error);
        throw error;
    }
};

// Yorum silme fonksiyonu
export const deleteComment = async (postId, commentId, userId) => {
    try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);

        if (!postDoc.exists()) {
            throw new Error('Post bulunamadı');
        }

        const postData = postDoc.data();
        const currentComments = postData.comments || [];
        const currentStats = postData.stats || { comments: 0 };

        // Yorumu bul ve yetki kontrolü yap
        const comment = currentComments.find(c => c.id === commentId);
        if (!comment) {
            throw new Error('Yorum bulunamadı');
        }

        // Yorum sahibi veya post sahibi silebilir
        if (comment.userId !== userId && postData.userId !== userId) {
            throw new Error('Bu yorumu silme yetkiniz yok');
        }

        // Yorumu filtrele ve güncelle
        const updatedComments = currentComments.filter(c => c.id !== commentId);

        await updateDoc(postRef, {
            comments: updatedComments,
            'stats.comments': currentStats.comments - 1
        });

        return true;
    } catch (error) {
        console.error('Yorum silme hatası:', error);
        throw error;
    }
};

// Gerçek zamanlı post dinleyicisi
export const subscribeToPost = (postId, callback) => {
    const postRef = doc(db, 'posts', postId);
    return onSnapshot(postRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
            const postData = docSnapshot.data();
            try {
                const userDocRef = doc(db, 'users', postData.userId);
                const userDocSnapshot = await getDoc(userDocRef);
                const userData = userDocSnapshot.data() || {};

                const formattedPost = {
                    id: docSnapshot.id,
                    ...postData,
                    user: {
                        id: postData.userId,
                        name: userData.informations?.name || 'İsimsiz Kullanıcı',
                        username: userData.informations?.username,
                        avatar: userData.profilePicture || null
                    },
                    likedBy: postData.likedBy || [],
                    comments: postData.comments || [],
                    createdAt: postData.createdAt?.toDate() || new Date(),
                    imageUrl: postData.imageUrl,
                    description: postData.description || '',
                    tags: postData.tags || [],
                    stats: postData.stats || { likes: 0, comments: 0 }
                };
                callback(formattedPost);
            } catch (error) {
                console.error('Post verisi formatlanırken hata:', error);
            }
        }
    });
};

// Beğenilen gönderileri getir
export const fetchLikedPosts = async (currentUserId, limitCount = 21, lastVisible = null) => {
    try {
        let postsRef = collection(db, 'posts');
        let queryConstraints = [
            where('likedBy', 'array-contains', currentUserId),
            orderBy('createdAt', 'desc')
        ];

        if (limitCount) {
            queryConstraints.push(limit(limitCount));
        }

        if (lastVisible) {
            queryConstraints.push(startAfter(lastVisible));
        }

        let q = query(postsRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);
        const posts = [];
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

        for (const docSnapshot of querySnapshot.docs) {
            const postData = docSnapshot.data();
            try {
                const userDocRef = doc(db, 'users', postData.userId);
                const userDocSnapshot = await getDoc(userDocRef);
                const userData = userDocSnapshot.data() || {};

                posts.push({
                    id: docSnapshot.id,
                    ...postData,
                    user: {
                        id: postData.userId,
                        name: userData.informations?.name || 'İsimsiz Kullanıcı',
                        username: userData.informations?.username,
                        avatar: userData.profilePicture || null
                    },
                    likedBy: postData.likedBy || [],
                    comments: postData.comments || [],
                    createdAt: postData.createdAt?.toDate() || new Date(),
                    imageUrl: postData.imageUrl,
                    description: postData.description || '',
                    tags: postData.tags || [],
                    stats: postData.stats || { likes: 0, comments: 0 }
                });
            } catch (error) {
                console.error('Kullanıcı bilgileri alınırken hata:', error);
            }
        }

        return {
            posts,
            lastVisible: lastDoc
        };
    } catch (error) {
        console.error('Beğenilen gönderiler alınırken hata:', error);
        throw error;
    }
};

// Post silme fonksiyonu
export const deletePost = async (postId) => {
    try {
        const postRef = doc(db, 'posts', postId);

        // Önce postu getir
        const postDoc = await getDoc(postRef);
        if (!postDoc.exists()) {
            throw new Error('Gönderi bulunamadı');
        }

        const postData = postDoc.data();

        // Görseli Storage'dan sil
        if (postData.imageUrl) {
            try {
                const imageRef = ref(storage, postData.imageUrl);
                await deleteObject(imageRef);
            } catch (error) {
                console.error('Görsel silinirken hata:', error);
                // Görsel silinmese bile post silinmesine devam et
            }
        }

        // Postu Firestore'dan sil
        await deleteDoc(postRef);

        return true;
    } catch (error) {
        console.error('Post silme hatası:', error);
        throw new Error('Gönderi silinirken bir hata oluştu');
    }
};

// Gönderiyi arşivle/arşivden çıkar
export const toggleArchivePost = async (postId, userId) => {
    if (!postId || !userId) {
        throw new Error('Post ID ve User ID gerekli');
    }

    try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);

        if (!postDoc.exists()) {
            throw new Error('Post bulunamadı');
        }

        const postData = postDoc.data();
        const archivedBy = postData.archivedBy || [];
        const isArchived = archivedBy.includes(userId);

        await updateDoc(postRef, {
            archivedBy: isArchived ? arrayRemove(userId) : arrayUnion(userId)
        });

        return !isArchived; // true: arşivlendi, false: arşivden çıkarıldı
    } catch (error) {
        console.error('Arşivleme işlemi hatası:', error);
        throw error;
    }
};

// Arşivlenen gönderileri getir
export const fetchArchivedPosts = async (userId) => {
    try {
        const postsRef = collection(db, 'posts');

        // 1. Kullanıcının archivedBy alanında olduğu gönderileri çekelim
        const q = query(
            postsRef,
            where('archivedBy', 'array-contains', userId),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const posts = [];

        // Postları işle ve ekle
        for (const docSnapshot of querySnapshot.docs) {
            const postData = docSnapshot.data();
            try {
                const userDocRef = doc(db, 'users', postData.userId);
                const userDocSnapshot = await getDoc(userDocRef);
                const userData = userDocSnapshot.data() || {};

                posts.push({
                    id: docSnapshot.id,
                    ...postData,
                    user: {
                        id: postData.userId,
                        name: userData.informations?.name || 'İsimsiz Kullanıcı',
                        username: userData.informations?.username,
                        avatar: userData.profilePicture || null
                    },
                    likedBy: postData.likedBy || [],
                    archivedBy: postData.archivedBy || [],
                    comments: postData.comments || [],
                    createdAt: postData.createdAt?.toDate() || new Date(),
                    imageUrl: postData.imageUrl,
                    description: postData.description || '',
                    tags: postData.tags || [],
                    stats: postData.stats || { likes: 0, comments: 0 }
                });
            } catch (error) {
                console.error('Kullanıcı bilgileri alınırken hata:', error);
            }
        }

        // 2. Kullanıcının koleksiyonlarını çekelim
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userArchiveGroups = userDoc.data().archiveGroups || [];

            // Ortak koleksiyonları belirleyelim
            const sharedGroups = userArchiveGroups.filter(group => group.isShared).map(group => group.id);

            if (sharedGroups.length > 0) {

                // Ortak koleksiyonlardaki gönderileri çekelim
                for (const groupId of sharedGroups) {
                    // Gruptaki gönderileri çek
                    const sharedPostsQuery = query(
                        postsRef,
                        where('archiveGroups', 'array-contains', groupId),
                        orderBy('createdAt', 'desc')
                    );

                    const sharedPostsSnapshot = await getDocs(sharedPostsQuery);

                    for (const docSnapshot of sharedPostsSnapshot.docs) {
                        // Post zaten eklenmişse tekrar ekleme
                        if (posts.some(post => post.id === docSnapshot.id)) {
                            continue;
                        }

                        const postData = docSnapshot.data();
                        try {
                            const userDocRef = doc(db, 'users', postData.userId);
                            const userDocSnapshot = await getDoc(userDocRef);
                            const userData = userDocSnapshot.data() || {};

                            posts.push({
                                id: docSnapshot.id,
                                ...postData,
                                user: {
                                    id: postData.userId,
                                    name: userData.informations?.name || 'İsimsiz Kullanıcı',
                                    username: userData.informations?.username,
                                    avatar: userData.profilePicture || null
                                },
                                likedBy: postData.likedBy || [],
                                archivedBy: postData.archivedBy || [],
                                comments: postData.comments || [],
                                createdAt: postData.createdAt?.toDate() || new Date(),
                                imageUrl: postData.imageUrl,
                                description: postData.description || '',
                                tags: postData.tags || [],
                                stats: postData.stats || { likes: 0, comments: 0 }
                            });
                        } catch (error) {
                            console.error('Kullanıcı bilgileri alınırken hata:', error);
                        }
                    }
                }
            }
        }

        // Son olarak gönderileri tarihe göre sırala
        posts.sort((a, b) => b.createdAt - a.createdAt);

        return posts;
    } catch (error) {
        console.error('Arşivlenen gönderiler alınırken hata:', error);
        throw error;
    }
};

// Arşiv grubu oluştur
export const createArchiveGroup = async (userId, groupData) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const archiveGroups = userDoc.data().archiveGroups || [];
        const newGroup = {
            id: Date.now().toString(),
            name: groupData.name,
            description: groupData.description || '',
            emoji: groupData.emoji || '📁',
            createdAt: new Date().toISOString(),
            postCount: 0
        };

        // Mevcut grupları al ve yeni grubu ekle
        const updatedGroups = [...archiveGroups, newGroup];

        // Tüm grupları güncelle
        await updateDoc(userRef, {
            archiveGroups: updatedGroups
        });

        return newGroup;
    } catch (error) {
        console.error('Arşiv grubu oluşturma hatası:', error);
        throw error;
    }
};

// Postu gruba ekle/çıkar
export const updatePostArchiveGroups = async (postId, userId, groupIds) => {
    try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);

        if (!postDoc.exists()) {
            throw new Error('Gönderi bulunamadı');
        }

        const postData = postDoc.data();
        let updatedGroupIds = groupIds;

        // Eğer ortak koleksiyonlar varsa, diğer koleksiyonları da koruyalım
        if (postData.archiveGroups && Array.isArray(postData.archiveGroups)) {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userArchiveGroups = userDoc.data().archiveGroups || [];

                // Kullanıcının ortak koleksiyonlarını bul
                const userSharedGroups = userArchiveGroups.filter(group => group.isShared);
                const userSharedGroupIds = userSharedGroups.map(group => group.id);

                // Gönderinin mevcut koleksiyonlarından, diğer kullanıcılara ait olanları koru
                const otherUsersGroupIds = postData.archiveGroups.filter(groupId =>
                    !userSharedGroupIds.includes(groupId) && !groupIds.includes(groupId)
                );

                // Yeni seçilen grup ID'leri ile birleştir
                updatedGroupIds = [...groupIds, ...otherUsersGroupIds];
            }
        }

        // Tek bir updateDoc işlemi ile tüm güncellemeleri yap
        await updateDoc(postRef, {
            archiveGroups: updatedGroupIds,
            archivedBy: arrayUnion(userId)
        });

        return true;
    } catch (error) {
        console.error('Post arşiv grubu güncelleme hatası:', error);
        throw error;
    }
};

// Arşiv gruplarını getir
export const fetchArchiveGroups = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return [];
        }

        return userDoc.data().archiveGroups || [];
    } catch (error) {
        console.error('Arşiv grupları getirme hatası:', error);
        throw error;
    }
};

// Arşiv grubunu sil
export const deleteArchiveGroup = async (userId, groupId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const archiveGroups = userDoc.data().archiveGroups || [];
        const updatedGroups = archiveGroups.filter(group => group.id !== groupId);

        // Önce kullanıcının gruplarını güncelle
        await updateDoc(userRef, {
            archiveGroups: updatedGroups
        });

        // Tüm postları kontrol et ve güncelle
        const postsRef = collection(db, 'posts');
        const q = query(postsRef);  // Tüm postları al
        const querySnapshot = await getDocs(q);

        if (querySnapshot.size > 0) {
            const batch = writeBatch(db);
            let hasUpdates = false;

            querySnapshot.docs.forEach(docSnapshot => {
                const postData = docSnapshot.data();
                if (postData.archiveGroups && Array.isArray(postData.archiveGroups)) {
                    if (postData.archiveGroups.includes(groupId)) {
                        hasUpdates = true;
                        batch.update(docSnapshot.ref, {
                            archiveGroups: postData.archiveGroups.filter(id => id !== groupId)
                        });
                    }
                }
            });

            // Sadece güncelleme varsa batch'i commit et
            if (hasUpdates) {
                await batch.commit();
            }
        }

        return true;
    } catch (error) {
        console.error('Arşiv grubu silme hatası:', error);
        throw error;
    }
};

// Varsayılan koleksiyon oluştur veya getir
export const getOrCreateDefaultCollection = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const archiveGroups = userDoc.data().archiveGroups || [];
        const defaultCollection = archiveGroups.find(group => group.isDefault);

        if (defaultCollection) {
            return defaultCollection;
        }

        // Varsayılan koleksiyon yoksa oluştur
        const newDefaultCollection = {
            id: Date.now().toString(),
            name: 'Kaydedilenler',
            description: 'Otomatik kaydedilen gönderiler',
            emoji: '📌',
            createdAt: new Date().toISOString(),
            isDefault: true,
            postCount: 0
        };

        const updatedGroups = [...archiveGroups, newDefaultCollection];
        await updateDoc(userRef, {
            archiveGroups: updatedGroups
        });

        return newDefaultCollection;
    } catch (error) {
        console.error('Varsayılan koleksiyon hatası:', error);
        throw error;
    }
};

// Hızlı kaydetme fonksiyonu
export const quickSavePost = async (postId, userId) => {
    try {
        const defaultCollection = await getOrCreateDefaultCollection(userId);
        await updatePostArchiveGroups(postId, userId, [defaultCollection.id]);
        return defaultCollection;
    } catch (error) {
        console.error('Hızlı kaydetme hatası:', error);
        throw error;
    }
};

// Ortak koleksiyon oluştur
export const createSharedArchiveGroup = async (userId, groupData, friendIds) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        // Yeni grup için benzersiz bir ID oluştur
        const groupId = Date.now().toString();

        // Yeni grup verisi
        const newGroup = {
            id: groupId,
            name: groupData.name,
            description: groupData.description || '',
            emoji: groupData.emoji || '👥',
            createdAt: new Date().toISOString(),
            isShared: true,
            createdBy: userId,
            members: [userId, ...friendIds],
            postCount: 0
        };

        // Batch işlemi başlat
        const batch = writeBatch(db);

        // Oluşturucu kullanıcının arşiv gruplarını güncelle
        const creatorArchiveGroups = userDoc.data().archiveGroups || [];
        batch.update(userRef, {
            archiveGroups: [...creatorArchiveGroups, newGroup]
        });

        // Arkadaşların kullanıcı verilerini güncelle
        for (const friendId of friendIds) {
            const friendRef = doc(db, 'users', friendId);
            const friendDoc = await getDoc(friendRef);

            if (friendDoc.exists()) {
                const friendArchiveGroups = friendDoc.data().archiveGroups || [];
                batch.update(friendRef, {
                    archiveGroups: [...friendArchiveGroups, newGroup]
                });
            }
        }

        // Batch işlemini tamamla
        await batch.commit();

        return newGroup;
    } catch (error) {
        console.error('Ortak arşiv grubu oluşturma hatası:', error);
        throw error;
    }
};

// Ortak koleksiyona üye ekle
export const addMemberToSharedGroup = async (groupId, newMemberId, currentUserId) => {
    try {
        // Grup bilgilerini al
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('archiveGroups', 'array-contains',
            { id: groupId }));

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error('Koleksiyon bulunamadı');
        }

        // Yeni üyenin kullanıcı belgesini al
        const newMemberRef = doc(db, 'users', newMemberId);
        const newMemberDoc = await getDoc(newMemberRef);

        if (!newMemberDoc.exists()) {
            throw new Error('Eklenecek kullanıcı bulunamadı');
        }

        // Batch işlemi başlat
        const batch = writeBatch(db);

        let groupData = null;

        // Tüm ilgili kullanıcıları güncelle
        for (const userDoc of querySnapshot.docs) {
            const userData = userDoc.data();
            const archiveGroups = userData.archiveGroups || [];

            const groupIndex = archiveGroups.findIndex(group => group.id === groupId);

            if (groupIndex !== -1) {
                // Grup verisini kaydet
                if (!groupData) {
                    groupData = archiveGroups[groupIndex];
                }

                // Eğer kullanıcı zaten grup üyesi değilse ekle
                if (!archiveGroups[groupIndex].members.includes(newMemberId)) {
                    const updatedGroup = {
                        ...archiveGroups[groupIndex],
                        members: [...archiveGroups[groupIndex].members, newMemberId]
                    };

                    const updatedGroups = [...archiveGroups];
                    updatedGroups[groupIndex] = updatedGroup;

                    batch.update(userDoc.ref, {
                        archiveGroups: updatedGroups
                    });
                }
            }
        }

        // Yeni üyenin koleksiyonlarına ekle
        if (groupData) {
            const newMemberGroups = newMemberDoc.data().archiveGroups || [];

            // Eğer kullanıcıda bu grup yoksa ekle
            if (!newMemberGroups.find(group => group.id === groupId)) {
                batch.update(newMemberRef, {
                    archiveGroups: [...newMemberGroups, groupData]
                });
            }
        }

        // Batch işlemini tamamla
        await batch.commit();

        return true;
    } catch (error) {
        console.error('Ortak koleksiyona üye ekleme hatası:', error);
        throw error;
    }
};

// Ortak koleksiyondan üye çıkar
export const removeMemberFromSharedGroup = async (groupId, memberId, currentUserId) => {
    try {
        // Grup yaratıcısı mı kontrol et
        const userRef = doc(db, 'users', currentUserId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const archiveGroups = userDoc.data().archiveGroups || [];
        const groupIndex = archiveGroups.findIndex(group => group.id === groupId);

        if (groupIndex === -1) {
            throw new Error('Koleksiyon bulunamadı');
        }

        const group = archiveGroups[groupIndex];

        // Sadece oluşturucu üyeleri çıkarabilir ya da kişi kendini çıkarabilir
        if (group.createdBy !== currentUserId && memberId !== currentUserId) {
            throw new Error('Bu işlem için yetkiniz yok');
        }

        // Tüm ilgili kullanıcıları bul
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('archiveGroups', 'array-contains', { id: groupId }));
        const querySnapshot = await getDocs(q);

        // Batch işlemi başlat
        const batch = writeBatch(db);

        // Tüm ilgili kullanıcıları güncelle
        for (const userDoc of querySnapshot.docs) {
            const userData = userDoc.data();
            const userGroups = userData.archiveGroups || [];

            const userGroupIndex = userGroups.findIndex(g => g.id === groupId);

            if (userGroupIndex !== -1) {
                const updatedGroup = {
                    ...userGroups[userGroupIndex],
                    members: userGroups[userGroupIndex].members.filter(id => id !== memberId)
                };

                // Eğer çıkarılacak üye kendisiyse, koleksiyonu tamamen kaldır
                if (userDoc.id === memberId) {
                    batch.update(userDoc.ref, {
                        archiveGroups: userGroups.filter(g => g.id !== groupId)
                    });
                } else {
                    // Değilse sadece üye listesini güncelle
                    const updatedGroups = [...userGroups];
                    updatedGroups[userGroupIndex] = updatedGroup;

                    batch.update(userDoc.ref, {
                        archiveGroups: updatedGroups
                    });
                }
            }
        }

        // Batch işlemini tamamla
        await batch.commit();

        return true;
    } catch (error) {
        console.error('Ortak koleksiyondan üye çıkarma hatası:', error);
        throw error;
    }
};

// Ortak koleksiyonu sil
export const deleteSharedArchiveGroup = async (groupId, userId) => {
    try {
        // Kullanıcı bilgilerini al
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const archiveGroups = userDoc.data().archiveGroups || [];
        const group = archiveGroups.find(g => g.id === groupId);

        if (!group) {
            throw new Error('Koleksiyon bulunamadı');
        }

        // Sadece oluşturucu koleksiyonu silebilir
        if (group.createdBy !== userId) {
            throw new Error('Bu koleksiyonu silme yetkiniz yok');
        }

        // Tüm üyelerde koleksiyonu bul
        const batch = writeBatch(db);

        // Tüm üyeleri dolaş
        for (const memberId of group.members) {
            const memberRef = doc(db, 'users', memberId);
            const memberDoc = await getDoc(memberRef);

            if (memberDoc.exists()) {
                const memberGroups = memberDoc.data().archiveGroups || [];
                batch.update(memberRef, {
                    archiveGroups: memberGroups.filter(g => g.id !== groupId)
                });
            }
        }

        // İlgili gönderileri güncelle
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, where('archiveGroups', 'array-contains', groupId));
        const postsSnapshot = await getDocs(q);

        postsSnapshot.forEach(postDoc => {
            const postData = postDoc.data();
            batch.update(postDoc.ref, {
                archiveGroups: postData.archiveGroups.filter(id => id !== groupId)
            });
        });

        // Batch işlemini tamamla
        await batch.commit();

        return true;
    } catch (error) {
        console.error('Ortak koleksiyon silme hatası:', error);
        throw error;
    }
};

// Ortak koleksiyonları getir
export const fetchSharedArchiveGroups = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return [];
        }

        const archiveGroups = userDoc.data().archiveGroups || [];

        // Ortak koleksiyonları filtrele
        return archiveGroups.filter(group => group.isShared === true);
    } catch (error) {
        console.error('Ortak koleksiyonları getirme hatası:', error);
        throw error;
    }
};

// Ortak koleksiyona gönderi ekle
export const addPostToSharedCollection = async (postId, userId, sharedGroupId) => {
    try {
        // Önce ortak koleksiyonu bul
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const userGroups = userDoc.data().archiveGroups || [];
        const sharedGroup = userGroups.find(group => group.id === sharedGroupId);

        if (!sharedGroup || !sharedGroup.isShared) {
            throw new Error('Ortak koleksiyon bulunamadı');
        }

        // Gönderiyi al
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);

        if (!postDoc.exists()) {
            throw new Error('Gönderi bulunamadı');
        }

        const postData = postDoc.data();
        const currentArchiveGroups = postData.archiveGroups || [];
        const currentArchivedBy = postData.archivedBy || [];

        // Koleksiyon üyelerini al
        const memberIds = sharedGroup.members || [];

        // Eklenmemiş üyeleri belirle
        const membersToAdd = memberIds.filter(memberId => !currentArchivedBy.includes(memberId));

        // Gönderiyi koleksiyona eklemek için tüm değişiklikleri tek seferde yap
        const updates = {
            archiveGroups: [...new Set([...currentArchiveGroups, sharedGroupId])]
        };

        // archivedBy alanı varsa güncelle, yoksa oluştur
        if (membersToAdd.length > 0) {
            // Tüm üyeleri ekleyeceğiz, arrayUnion yerine doğrudan set ediyoruz
            updates.archivedBy = [...new Set([...currentArchivedBy, ...membersToAdd])];
        }

        // Tüm değişiklikleri tek seferde uygula
        await updateDoc(postRef, updates);

        return true;
    } catch (error) {
        console.error('Ortak koleksiyona gönderi ekleme hatası:', error);
        throw error;
    }
}; 