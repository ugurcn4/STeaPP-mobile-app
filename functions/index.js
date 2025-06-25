/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Firebase Admin başlatma
initializeApp();

// Firestore referansı
const db = getFirestore();

// Expo Push Notification endpoint'i
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// SMS API configuration - Netgsm veya benzer bir servis kullanılabilir
const SMS_API_ENDPOINT = "https://api.netgsm.com.tr/sms/send/get";
const SMS_USERNAME = "YOUR_NETGSM_USERNAME"; // Netgsm kullanıcı adı
const SMS_PASSWORD = "YOUR_NETGSM_PASSWORD"; // Netgsm şifre
const SMS_HEADER = "YOUR_SENDER_ID";         // Netgsm başlık (gönderici adı)

// SMS gönderme fonksiyonu (Netgsm API örneği)
const sendSMS = async (phoneNumber, message) => {
    try {
        // Telefon numarasının formatını düzenle (90 ile başlamalı - NetGSM için)
        const formattedPhone = phoneNumber.startsWith("0")
            ? "9" + phoneNumber.slice(1)
            : phoneNumber.startsWith("+90")
                ? phoneNumber.slice(1)
                : "90" + phoneNumber;

        // NetGSM API URL parametreleri
        const params = {
            usercode: SMS_USERNAME,
            password: SMS_PASSWORD,
            gsmno: formattedPhone,
            message: message,
            msgheader: SMS_HEADER,
            dil: "TR",
        };

        // API isteği gönder
        const response = await axios.get(SMS_API_ENDPOINT, { params });
        ("SMS API yanıtı:", response.data);

        // API yanıtını kontrol et
        if (response.data && response.data.includes("00")) {
            return { success: true, message: "SMS başarıyla gönderildi" };
        } else {
            throw new Error(`SMS gönderilemedi: ${response.data}`);
        }
    } catch (error) {
        console.error("SMS gönderme hatası:", error);
        throw error;
    }
};

// Expo Push Notification gönderme fonksiyonu
const sendExpoPushNotification = async (token, title, body, data) => {
    try {
        ("Bildirim gönderiliyor:", { token, title, body, data });

        const message = {
            to: token,
            title,
            body,
            data: {
                ...data,
                screen: data.type, // Açılacak ekran adı
                openScreen: true,  // Yönlendirme gerektiğini belirtir
            },
            sound: "default",
            priority: "high",
            channelId: "default",
        };

        ("Hazırlanan bildirim mesajı:", message);

        const response = await axios.post(EXPO_PUSH_ENDPOINT, message, {
            headers: {
                "Accept": "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
        });

        ("Expo API yanıtı:", response.data);
        return response.data;
    } catch (error) {
        console.error("Bildirim gönderme hatası detayları:", {
            token,
            title,
            body,
            error: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : error.message
        });
        throw error;
    }
};

// Arkadaşlık isteği bildirimi
exports.onFriendRequestUpdate = onDocumentUpdated("users/{userId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Yeni gelen arkadaşlık isteklerini kontrol et
    const newReceivedRequests = (after.friendRequests && after.friendRequests.received) || [];
    const oldReceivedRequests = (before.friendRequests && before.friendRequests.received) || [];

    // Yeni eklenen istekleri bul
    const newRequests = newReceivedRequests.filter(id => !oldReceivedRequests.includes(id));

    if (newRequests.length > 0) {
        const toUserId = event.params.userId;

        try {
            // Her yeni istek için bildirim gönder
            for (const fromUserId of newRequests) {
                // Gönderen kullanıcının bilgilerini al
                const fromUserDoc = await db.collection("users").doc(fromUserId).get();
                const fromUser = fromUserDoc.data();

                // Bildirim oluştur
                const notification = {
                    recipientId: toUserId,
                    senderId: fromUserId,
                    type: "friendRequest",
                    title: "Yeni Arkadaşlık İsteği",
                    body: `${fromUser.displayName || "Bir kullanıcı"} size arkadaşlık isteği gönderdi`,
                    status: "unread",
                    createdAt: new Date(),
                    data: {
                        type: "friendRequest",
                        senderId: fromUserId,
                        screen: "FriendsPage",   // Açılacak ekran adı
                        params: {                   // Ekran parametreleri
                            tab: "İstekler"         // Gelen istekler sekmesi
                        }
                    },
                };

                // Bildirimi Firestore'a kaydet
                await db.collection("notifications").add(notification);

                // Kullanıcının Expo Push Token'larını al
                const userDoc = await db.collection("users").doc(toUserId).get();
                const user = userDoc.data();
                const tokens = Object.values(user.fcmTokens || {}).map((t) => t.token).filter(Boolean);

                // Her token için bildirim gönder
                for (const token of tokens) {
                    if (token.startsWith("ExponentPushToken[")) {
                        await sendExpoPushNotification(
                            token,
                            notification.title,
                            notification.body,
                            notification.data
                        );
                    }
                }
            }
        } catch (error) {
            console.error("Arkadaşlık isteği bildirimi hatası:", error);
        }
    }
});

// Yeni mesaj bildirimi
exports.onNewMessage = onDocumentCreated("messages/{messageId}", async (event) => {
    const message = event.data.data();
    ("Yeni mesaj alındı:", message);

    if (!message) {
        ("Mesaj verisi boş, işlem sonlandırılıyor");
        return;
    }

    const { receiverId, senderId, chatId, message: text, mediaType } = message;

    // receiverId kontrolü ekle
    if (!receiverId) {
        console.error("Alıcı ID'si bulunamadı:", message);
        return;
    }

    // Kendi mesajlarımız için bildirim gönderme
    if (senderId === receiverId) {
        ("Kendi mesajı olduğu için bildirim gönderilmiyor");
        return;
    }

    try {
        // Gönderen kullanıcının bilgilerini al
        ("Gönderen kullanıcı bilgileri alınıyor:", senderId);
        const senderDoc = await db.collection("users").doc(senderId).get();
        const sender = senderDoc.data();

        if (!sender) {
            console.error("Gönderen kullanıcı bulunamadı:", senderId);
            return;
        }

        ("Gönderen kullanıcı bilgileri:", sender);

        // Bildirim oluştur
        const notification = {
            recipientId: receiverId,  // receiverId kullan
            senderId: senderId,
            type: "message",
            title: "Yeni Mesaj",
            body: `${(sender.informations && sender.informations.name) || sender.displayName || "Bilinmeyen Kullanıcı"}: ${text ? text.substring(0, 50) + (text.length > 50 ? "..." : "") : ""}`,
            status: "unread",
            createdAt: new Date(),
            data: {
                type: "message",
                messageId: event.data.id,
                chatId: chatId,
                senderId: senderId,
                screen: "ChatScreen",    // Açılacak ekran adı
                params: {          // Ekran parametreleri
                    chatId: chatId,
                    userId: senderId
                }
            }
        };

        ("Oluşturulan bildirim:", notification);

        // Bildirimi Firestore'a kaydet
        await db.collection("notifications").add(notification);
        ("Bildirim Firestore'a kaydedildi");

        // Kullanıcının Expo Push Token'larını al
        ("Alıcı kullanıcının token bilgileri alınıyor:", receiverId);
        const userDoc = await db.collection("users").doc(receiverId).get();
        const user = userDoc.data();

        if (!user) {
            console.error("Alıcı kullanıcı bulunamadı:", receiverId);
            return;
        }

        const tokens = Object.values(user.fcmTokens || {}).map((t) => t.token).filter(Boolean);
        ("Bulunan token sayısı:", tokens.length);

        // Her token için bildirim gönder
        for (const token of tokens) {
            if (token.startsWith("ExponentPushToken[")) {
                ("Token geçerli, bildirim gönderiliyor:", token);
                await sendExpoPushNotification(
                    token,
                    notification.title,
                    notification.body,
                    notification.data
                );
            } else {
                ("Geçersiz token formatı:", token);
            }
        }
    } catch (error) {
        console.error("Mesaj bildirimi hatası:", error);
        console.error("Hata detayları:", {
            messageId: event.data.id,
            receiverId,
            senderId,
            error: error.stack
        });
    }
});

// Aktivite bildirimi
exports.onNewActivity = onDocumentCreated("activities/{activityId}", async (event) => {
    const activity = event.data.data();
    const { createdBy, participants, title } = activity;

    try {
        // Aktiviteyi oluşturan kullanıcının bilgilerini al
        const creatorDoc = await db.collection("users").doc(createdBy).get();
        const creator = creatorDoc.data();

        // Katılımcılara bildirim gönder
        for (const participantId of participants) {
            // Kendimize bildirim gönderme
            if (participantId === createdBy) continue;

            // Bildirim oluştur
            const notification = {
                recipientId: participantId,
                senderId: createdBy,
                type: "activity",
                title: "Yeni Aktivite",
                body: `${creator.displayName} sizi "${title}" aktivitesine davet etti`,
                status: "unread",
                createdAt: new Date(),
                data: {
                    type: "activity",
                    activityId: event.data.id,
                    createdBy,
                    screen: "ActivityDetail",    // Açılacak ekran adı
                    params: {                   // Ekran parametreleri
                        activityId: event.data.id
                    }
                },
            };

            // Bildirimi Firestore'a kaydet
            await db.collection("notifications").add(notification);

            // Kullanıcının Expo Push Token'larını al
            const userDoc = await db.collection("users").doc(participantId).get();
            const user = userDoc.data();
            const tokens = Object.values(user.fcmTokens || {}).map((t) => t.token).filter(Boolean);

            // Her token için bildirim gönder
            for (const token of tokens) {
                if (token.startsWith("ExponentPushToken[")) {
                    await sendExpoPushNotification(
                        token,
                        notification.title,
                        notification.body,
                        notification.data
                    );
                }
            }
        }
    } catch (error) {
        console.error("Aktivite bildirimi hatası:", error);
    }
});

// Phone Verification SMS gönderme
exports.sendVerificationSMS = onCall({
    enforceAppCheck: false // Testler için false, üretimde true yapılmalı
}, async (request) => {
    const { phoneNumber, verificationCode } = request.data;

    // Parametreleri kontrol et
    if (!phoneNumber) {
        throw new HttpsError("invalid-argument", "Telefon numarası belirtilmedi");
    }

    if (!verificationCode) {
        throw new HttpsError("invalid-argument", "Doğrulama kodu belirtilmedi");
    }

    try {
        // SMS mesajını hazırla
        const message = `Doğrulama kodunuz: ${verificationCode}`;

        // SMS gönder
        const result = await sendSMS(phoneNumber, message);

        // Sonucu dön
        return { success: true, message: "Doğrulama kodu SMS ile gönderildi" };
    } catch (error) {
        console.error("Doğrulama SMS gönderme hatası:", error);
        throw new HttpsError("internal", "SMS gönderilemedi: " + error.message);
    }
});

// Telefon doğrulama kodlarını izle
exports.watchPhoneVerifications = onDocumentCreated("phone_verifications/{verificationId}", async (event) => {
    const verification = event.data.data();
    const verificationId = event.params.verificationId;

    if (!verification) {
        ("Doğrulama verisi boş, işlem sonlandırılıyor");
        return;
    }

    const { phoneNumber, verificationCode, isVerified } = verification;

    // Henüz doğrulanmamış kayıtlar için SMS gönder
    if (!isVerified && phoneNumber && verificationCode) {
        try {
            // SMS mesajını hazırla
            const message = `Doğrulama kodunuz: ${verificationCode}`;

            // SMS gönder - Gerçek SMS API'si ile değiştirin
            // Örnek: await sendSMS(phoneNumber, message);
            (`SMS gönderildi: ${phoneNumber} numarasına "${message}"`);

            // Şimdilik SMS gönderim durumunu veritabanına kaydedelim
            await db.collection("phone_verifications").doc(verificationId).update({
                smsSent: true,
                smsSentAt: new Date()
            });

        } catch (error) {
            console.error("Doğrulama SMS hatası:", error);

            // Hata durumunu veritabanına kaydedelim
            await db.collection("phone_verifications").doc(verificationId).update({
                smsError: error.message,
                smsErrorAt: new Date()
            });
        }
    }
});

// Beğeni bildirimi
exports.onNewLike = onDocumentCreated("likes/{likeId}", async (event) => {
    const like = event.data.data();
    ("Yeni beğeni alındı:", like);

    // Gerekli alanları kontrol et
    if (!like || !like.postId || !like.userId || !like.ownerId) {
        ("Geçersiz beğeni verisi, işlem sonlandırılıyor");
        return;
    }

    // Kendi gönderisini beğenenler için bildirim gönderme
    if (like.userId === like.ownerId) {
        ("Kullanıcı kendi gönderisini beğendiği için bildirim gönderilmiyor");
        return;
    }

    try {
        // Kullanıcının bildirim ayarlarını kontrol et
        const ownerDoc = await db.collection("users").doc(like.ownerId).get();
        const owner = ownerDoc.data();

        ("Kullanıcı bildirim ayarları:", owner.notificationSettings);

        // Bildirim ayarlarını kontrol et
        if (!owner || !owner.notificationSettings || !owner.notificationSettings.likeNotifications) {
            ("Kullanıcının beğeni bildirimleri kapalı");
            return;
        }

        // Beğenen kullanıcının bilgilerini al
        const userDoc = await db.collection("users").doc(like.userId).get();
        const user = userDoc.data();

        // Kullanıcı adını doğru şekilde al
        const userName = user.displayName ||
            (user.informations && user.informations.name) ||
            "Bir kullanıcı";

        // Gönderi bilgilerini al (opsiyonel - bildirimde gönderi başlığını kullanmak isterseniz)
        const postDoc = await db.collection("posts").doc(like.postId).get();
        const post = postDoc.data();
        const postTitle = post && post.title ? post.title : "gönderinizi";

        // Bildirim oluştur
        const notification = {
            recipientId: like.ownerId,
            senderId: like.userId,
            type: "like",
            title: "Yeni Beğeni",
            body: `${userName} ${postTitle} beğendi`,
            status: "unread",
            createdAt: new Date(),
            data: {
                type: "like",
                likeId: event.data.id,
                postId: like.postId,
                userId: like.userId,
                screen: "FriendProfileModal",       // Profil modalını açacak
                params: {
                    friend: {
                        id: like.ownerId,
                        selectedPostId: like.postId  // Seçili gönderiyi belirt
                    }
                }
            }
        };

        // Bildirimi Firestore'a kaydet
        await db.collection("notifications").add(notification);

        // Expo Push Token'larını al
        const tokens = Object.values(owner.fcmTokens || {}).map((t) => t.token).filter(Boolean);

        // Her token için bildirim gönder
        for (const token of tokens) {
            if (token.startsWith("ExponentPushToken[")) {
                await sendExpoPushNotification(
                    token,
                    notification.title,
                    notification.body,
                    notification.data
                );
            }
        }
    } catch (error) {
        console.error("Beğeni bildirimi hatası:", error);
    }
});

// Yorum bildirimi
exports.onNewComment = onDocumentCreated("comments/{commentId}", async (event) => {
    const comment = event.data.data();
    ("Yeni yorum alındı:", comment);

    // Gerekli alanları kontrol et
    if (!comment || !comment.postId || !comment.userId || !comment.ownerId || !comment.text) {
        ("Geçersiz yorum verisi, işlem sonlandırılıyor");
        return;
    }

    // Kendi gönderisine yorum yapanlar için bildirim gönderme (opsiyonel - isteğe bağlı değiştirilebilir)
    if (comment.userId === comment.ownerId) {
        ("Kullanıcı kendi gönderisine yorum yaptığı için bildirim gönderilmiyor");
        return;
    }

    try {
        // Kullanıcının bildirim ayarlarını kontrol et
        const ownerDoc = await db.collection("users").doc(comment.ownerId).get();
        const owner = ownerDoc.data();

        // Bildirim ayarlarını kontrol et
        if (!owner || !owner.notificationSettings || !owner.notificationSettings.commentNotifications) {
            ("Kullanıcının yorum bildirimleri kapalı");
            return;
        }

        // Yorum yapan kullanıcının bilgilerini al
        const userDoc = await db.collection("users").doc(comment.userId).get();
        const user = userDoc.data();

        // Kullanıcı adını doğru şekilde al
        const userName = user.displayName ||
            (user.informations && user.informations.name) ||
            "Bir kullanıcı";

        // Gönderi bilgilerini al (opsiyonel)
        const postDoc = await db.collection("posts").doc(comment.postId).get();
        const post = postDoc.data();
        const postTitle = post && post.title ? post.title : "gönderinize";

        // Yorum metnini kısalt
        const shortComment = comment.text.length > 40
            ? comment.text.substring(0, 40) + "..."
            : comment.text;

        // Bildirim oluştur
        const notification = {
            recipientId: comment.ownerId,
            senderId: comment.userId,
            type: "comment",
            title: "Yeni Yorum",
            body: `${userName} ${postTitle}: "${shortComment}"`,
            status: "unread",
            createdAt: new Date(),
            data: {
                type: "comment",
                commentId: event.data.id,
                postId: comment.postId,
                userId: comment.userId,
                screen: "FriendProfileModal",       // Profil modalını açacak
                params: {
                    friend: {
                        id: comment.ownerId,
                        selectedPostId: comment.postId  // Seçili gönderiyi belirt
                    }
                }
            }
        };

        // Bildirimi Firestore'a kaydet
        await db.collection("notifications").add(notification);

        // Expo Push Token'larını al
        const tokens = Object.values(owner.fcmTokens || {}).map((t) => t.token).filter(Boolean);

        // Her token için bildirim gönder
        for (const token of tokens) {
            if (token.startsWith("ExponentPushToken[")) {
                await sendExpoPushNotification(
                    token,
                    notification.title,
                    notification.body,
                    notification.data
                );
            }
        }
    } catch (error) {
        console.error("Yorum bildirimi hatası:", error);
    }
});

// Yeni kullanıcı oluşturulduğunda çalışacak fonksiyon
exports.onUserCreated = onDocumentCreated("users/{userId}", async (event) => {
    const userId = event.params.userId;
    const userData = event.data.data();

    try {
        // Varsayılan bildirim ayarları
        const defaultNotificationSettings = {
            allNotifications: true,
            newFriends: true,
            messages: true,
            activityUpdates: true,
            likeNotifications: true,
            commentNotifications: true,
            emailNotifications: true
        };

        // Kullanıcı dokümanını güncelle
        await db.collection("users").doc(userId).set({
            ...userData,
            notificationSettings: defaultNotificationSettings
        }, { merge: true });

    } catch (error) {
        console.error("Varsayılan bildirim ayarları ayarlanırken hata:", error);
    }
});

// Mevcut kullanıcılar için bildirim ayarlarını güncelleyen fonksiyon
exports.updateAllUsersNotificationSettings = onCall(async (context) => {
    try {
        const usersSnapshot = await db.collection("users").get();
        const batch = db.batch();

        usersSnapshot.docs.forEach((doc) => {
            const defaultSettings = {
                allNotifications: true,
                newFriends: true,
                messages: true,
                activityUpdates: true,
                likeNotifications: true,
                commentNotifications: true,
                emailNotifications: true
            };

            batch.set(doc.ref, {
                notificationSettings: defaultSettings
            }, { merge: true });
        });

        await batch.commit();
        return { success: true, message: "Tüm kullanıcıların bildirim ayarları güncellendi" };
    } catch (error) {
        console.error("Toplu güncelleme hatası:", error);
        throw new Error("Kullanıcı ayarları güncellenirken hata oluştu");
    }
});
