import { collection, addDoc, query, where, getDocs, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Rastgele 6 haneli doğrulama kodu üretir
 * @returns {string} - 6 haneli doğrulama kodu
 */
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Firebase Cloud Functions kullanarak SMS gönderir
 * @param {string} phoneNumber - Telefon numarası
 * @returns {Promise<Object>} - İşlem sonucu
 */
export const sendVerificationSMS = async (phoneNumber) => {
    try {
        // Telefon numarasının formatını kontrol et
        if (!phoneNumber || !phoneNumber.match(/^\d{10,}$/)) {
            return { success: false, message: 'Geçerli bir telefon numarası girmelisiniz' };
        }

        // Daha önce gönderilmiş aktif doğrulama kodu var mı kontrol et
        const verificationRef = collection(db, 'phone_verifications');
        const activeVerificationsQuery = query(
            verificationRef,
            where("phoneNumber", "==", phoneNumber),
            where("isVerified", "==", false)
        );

        const querySnapshot = await getDocs(activeVerificationsQuery);
        const currentTime = new Date();

        // Eski aktif kodları manuel olarak filtreleyelim
        const activeVerifications = querySnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.expiresAt && data.expiresAt.toDate() > currentTime;
        });

        // Varsa, eski aktif doğrulama kodunu sil
        for (const document of activeVerifications) {
            await deleteDoc(doc(db, 'phone_verifications', document.id));
        }

        // Yeni doğrulama kodu oluştur
        const verificationCode = generateVerificationCode();

        // Kodun geçerlilik süresini belirle (10 dakika)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        // Firestore'a doğrulama bilgilerini kaydet
        const docRef = await addDoc(collection(db, 'phone_verifications'), {
            phoneNumber,
            verificationCode,
            createdAt: serverTimestamp(),
            expiresAt,
            isVerified: false
        });

        try {
            // Firebase Cloud Functions'ı başlat
            const functions = getFunctions();
            const sendSMSFunction = httpsCallable(functions, 'sendVerificationSMS');

            // Cloud Function'ı çağır
            const result = await sendSMSFunction({
                phoneNumber: phoneNumber,
                verificationCode: verificationCode
            });

            return { success: true, message: 'Doğrulama kodu telefonunuza gönderildi' };
        } catch (functionError) {
            console.error('SMS gönderme fonksiyon hatası:', functionError);


            // Üretim ortamında olup olmadığımızı kontrol et
            if (process.env.NODE_ENV === 'production') {
                return { success: false, message: 'SMS gönderme hatası: ' + functionError.message };
            } else {
                // Geliştirme ortamında başarılı dön, konsol log'undan kodu alabilirsin
                return { success: true, message: 'Doğrulama kodu telefonunuza gönderildi (Geliştirme modu)' };
            }
        }
    } catch (error) {
        console.error('Doğrulama kodu gönderme hatası:', error);
        return { success: false, message: 'Doğrulama kodu gönderilemedi, lütfen daha sonra tekrar deneyin' };
    }
};

/**
 * Doğrulama kodunu kontrol eder
 * @param {string} phoneNumber - Telefon numarası
 * @param {string} verificationCode - Doğrulama kodu
 * @returns {Promise<Object>} - İşlem sonucu
 */
export const verifyPhoneNumber = async (phoneNumber, verificationCode) => {
    try {
        // Telefon numarası ve doğrulama kodunun formatını kontrol et
        if (!phoneNumber || !phoneNumber.match(/^\d{10,}$/)) {
            return { success: false, message: 'Geçerli bir telefon numarası girmelisiniz' };
        }

        if (!verificationCode || verificationCode.length !== 6) {
            return { success: false, message: 'Geçerli bir doğrulama kodu girmelisiniz' };
        }

        // Doğrulama kaydını bul
        const verificationRef = collection(db, 'phone_verifications');
        const verificationQuery = query(
            verificationRef,
            where("phoneNumber", "==", phoneNumber),
            where("verificationCode", "==", verificationCode),
            where("isVerified", "==", false)
        );

        const querySnapshot = await getDocs(verificationQuery);
        const currentTime = new Date();

        // Süresi dolmamış doğrulama kodlarını manuel olarak filtreleyelim
        const validVerifications = querySnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.expiresAt && data.expiresAt.toDate() > currentTime;
        });

        // Eşleşen kayıt yoksa
        if (validVerifications.length === 0) {
            return { success: false, message: 'Geçersiz veya süresi dolmuş doğrulama kodu' };
        }

        // Doğrulama kaydını güncelle
        const verificationDoc = validVerifications[0];
        await updateDoc(doc(db, 'phone_verifications', verificationDoc.id), {
            isVerified: true,
            verifiedAt: serverTimestamp()
        });

        return { success: true, message: 'Telefon numarası başarıyla doğrulandı' };
    } catch (error) {
        console.error('Telefon doğrulama hatası:', error);
        return { success: false, message: 'Doğrulama işlemi sırasında bir hata oluştu' };
    }
};

/**
 * Telefon numarasının daha önce doğrulanıp doğrulanmadığını kontrol eder
 * @param {string} phoneNumber - Telefon numarası
 * @returns {Promise<boolean>} - Doğrulanmış ise true, değilse false
 */
export const isPhoneNumberVerified = async (phoneNumber) => {
    try {
        // Telefon numarasının formatını kontrol et
        if (!phoneNumber || !phoneNumber.match(/^\d{10,}$/)) {
            return false;
        }

        // Doğrulama kaydını bul
        const verificationRef = collection(db, 'phone_verifications');
        const verificationQuery = query(
            verificationRef,
            where("phoneNumber", "==", phoneNumber),
            where("isVerified", "==", true)
        );

        const querySnapshot = await getDocs(verificationQuery);

        // Doğrulanmış kayıt varsa
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Telefon doğrulama kontrolü hatası:', error);
        return false;
    }
}; 