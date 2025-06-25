import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

/**
 * Kullanıcının doğrulama durumunu kontrol eder.
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - Doğrulama durumu bilgilerini içeren nesne
 */
export const checkUserVerification = async (userId) => {
    try {
        // Kullanıcı belgesini al
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return { hasBlueTick: false, hasGreenTick: false };
        }

        const userData = userDoc.data();

        // Kullanıcı verileri içinde verification bilgisi var mı kontrol et
        if (userData.verification) {
            const { verificationType } = userData.verification;

            if (verificationType === 'both') {
                return { hasBlueTick: true, hasGreenTick: true };
            } else if (verificationType === 'blue') {
                return { hasBlueTick: true, hasGreenTick: false };
            } else if (verificationType === 'green') {
                return { hasBlueTick: false, hasGreenTick: true };
            }
        }

        // Blue_tick koleksiyonundan kullanıcının onaylı başvurularını kontrol et
        const blueTickRef = collection(db, 'blue_tick');
        const blueTickQuery = query(
            blueTickRef,
            where("userID", "==", userId),
            where("status", "==", "approved")
        );

        const blueTickDocs = await getDocs(blueTickQuery);

        if (blueTickDocs.empty) {
            return { hasBlueTick: false, hasGreenTick: false };
        }

        let hasBlueTick = false;
        let hasGreenTick = false;

        blueTickDocs.forEach(doc => {
            const data = doc.data();
            if (data.verificationType === 'blue') hasBlueTick = true;
            if (data.verificationType === 'green') hasGreenTick = true;
        });

        // Kullanıcı belgesini güncellememiz gerekebilir, ancak bu fonksiyonda sadece kontrol ediyoruz

        return { hasBlueTick, hasGreenTick };
    } catch (error) {
        console.error("Doğrulama durumu kontrol hatası:", error);
        return { hasBlueTick: false, hasGreenTick: false };
    }
};

/**
 * Kullanıcının doğrulama durumunu e-posta adresine göre kontrol eder.
 * @param {string} email - Kullanıcı e-posta adresi
 * @returns {Promise<Object>} - Doğrulama durumu bilgilerini içeren nesne
 */
export const checkUserVerificationByEmail = async (email) => {
    try {
        // Kullanıcıyı e-posta adresine göre bul
        const usersRef = collection(db, 'users');
        const userQuery = query(
            usersRef,
            where("informations.email", "==", email)
        );

        const userDocs = await getDocs(userQuery);

        if (userDocs.empty) {
            return { hasBlueTick: false, hasGreenTick: false };
        }

        // İlk eşleşen kullanıcıyı al
        const userId = userDocs.docs[0].id;
        return checkUserVerification(userId);
    } catch (error) {
        console.error("E-posta ile doğrulama durumu kontrol hatası:", error);
        return { hasBlueTick: false, hasGreenTick: false };
    }
};

/**
 * Blue_tick koleksiyonundan kullanıcının başvuru durumunu kontrol eder.
 * @param {string} email - Kullanıcı e-posta adresi
 * @returns {Promise<Object>} - Başvuru durumu bilgilerini içeren nesne
 */
export const checkApplicationStatus = async (email) => {
    try {
        const blueTickRef = collection(db, 'blue_tick');
        const userApplicationsQuery = query(
            blueTickRef,
            where("email", "==", email)
        );

        const userApplicationsSnapshot = await getDocs(userApplicationsQuery);

        if (userApplicationsSnapshot.empty) {
            return {
                pendingBlue: false,
                pendingGreen: false,
                approvedBlue: false,
                approvedGreen: false,
                rejectedApplications: 0,
                totalApplications: 0
            };
        }

        // Başvuruları durumlarına göre sınıflandır
        let pendingBlue = false;
        let pendingGreen = false;
        let approvedBlue = false;
        let approvedGreen = false;
        let rejectedApplications = 0;

        userApplicationsSnapshot.forEach(doc => {
            const data = doc.data();

            if (data.status === 'pending') {
                if (data.verificationType === 'blue') pendingBlue = true;
                if (data.verificationType === 'green') pendingGreen = true;
            }
            else if (data.status === 'approved') {
                if (data.verificationType === 'blue') approvedBlue = true;
                if (data.verificationType === 'green') approvedGreen = true;
            }
            else if (data.status === 'rejected') {
                rejectedApplications++;
            }
        });

        return {
            pendingBlue,
            pendingGreen,
            approvedBlue,
            approvedGreen,
            rejectedApplications,
            totalApplications: userApplicationsSnapshot.size
        };
    } catch (error) {
        console.error("Başvuru durumu kontrol hatası:", error);
        return {
            pendingBlue: false,
            pendingGreen: false,
            approvedBlue: false,
            approvedGreen: false,
            rejectedApplications: 0,
            totalApplications: 0
        };
    }
};

/**
 * Blue_tick koleksiyonunda bir başvuruyu onaylar ve kullanıcı belgesini günceller.
 * Bu fonksiyon sadece admin tarafından kullanılmalıdır.
 * 
 * @param {string} applicationId - Başvuru belgesi ID'si
 * @param {string} reviewNote - İnceleme notu
 * @param {string} adminId - İncelemeyi yapan admin ID'si
 * @returns {Promise<boolean>} - İşlem başarılı ise true, değilse false
 */
export const approveVerification = async (applicationId, reviewNote, adminId) => {
    try {
        // 1. blue_tick koleksiyonundaki başvuruyu güncelle
        const applicationRef = doc(db, 'blue_tick', applicationId);
        const applicationSnap = await getDoc(applicationRef);

        if (!applicationSnap.exists()) {
            throw new Error('Başvuru bulunamadı');
        }

        const applicationData = applicationSnap.data();

        // Başvuruyu güncelle
        await updateDoc(applicationRef, {
            status: 'approved',
            reviewDate: serverTimestamp(),
            reviewerID: adminId,
            reviewNote: reviewNote || 'Doğrulama onaylandı'
        });

        // 2. Kullanıcının users koleksiyonundaki belgesini kontrol et
        const userRef = doc(db, 'users', applicationData.userID);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('Kullanıcı bulunamadı');
        }

        const userData = userDoc.data();

        // Kullanıcının mevcut doğrulama durumunu kontrol et
        let verificationType = applicationData.verificationType;

        if (userData.verification) {
            // Kullanıcının zaten doğrulanmış hesabı var mı kontrol et
            const existingType = userData.verification.verificationType;

            // Farklı bir doğrulama tipi varsa, "both" olarak ayarla
            if (existingType && existingType !== applicationData.verificationType) {
                verificationType = 'both';
            }
        }

        // 3. Kullanıcı belgesini güncelle
        await updateDoc(userRef, {
            'verification.isVerified': true,
            'verification.verificationType': verificationType,
            'verification.verifiedAt': serverTimestamp(),
            'verification.verifiedBy': adminId
        });

        return true;
    } catch (error) {
        console.error('Onay işlemi başarısız:', error);
        return false;
    }
};

/**
 * Blue_tick koleksiyonunda bir başvuruyu reddeder.
 * Bu fonksiyon sadece admin tarafından kullanılmalıdır.
 * 
 * @param {string} applicationId - Başvuru belgesi ID'si
 * @param {string} reviewNote - Red nedeni
 * @param {string} adminId - İncelemeyi yapan admin ID'si
 * @returns {Promise<boolean>} - İşlem başarılı ise true, değilse false
 */
export const rejectVerification = async (applicationId, reviewNote, adminId) => {
    try {
        // 1. blue_tick koleksiyonundaki başvuruyu güncelle
        const applicationRef = doc(db, 'blue_tick', applicationId);
        const applicationSnap = await getDoc(applicationRef);

        if (!applicationSnap.exists()) {
            throw new Error('Başvuru bulunamadı');
        }

        // Başvuruyu güncelle
        await updateDoc(applicationRef, {
            status: 'rejected',
            reviewDate: serverTimestamp(),
            reviewerID: adminId,
            reviewNote: reviewNote || 'Doğrulama reddedildi'
        });

        return true;
    } catch (error) {
        console.error('Red işlemi başarısız:', error);
        return false;
    }
}; 