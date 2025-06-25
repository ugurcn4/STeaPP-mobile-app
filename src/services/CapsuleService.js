import { 
  collection, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../../firebaseConfig';
import { getAuth } from 'firebase/auth';

/**
 * Kapsül oluşturur
 * @param {Object} capsuleData - Kapsül verileri
 * @returns {Promise<Object>} - Oluşturulan kapsül belgesi
 */
export const createCapsule = async (capsuleData) => {
  try {
    const user = getAuth().currentUser;
    
    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }

    const capsuleWithMetadata = {
      ...capsuleData,
      createdBy: user.uid,
      creationDate: serverTimestamp(),
      status: 'pending',
    };

    const capsuleRef = await addDoc(collection(db, 'Capsules'), capsuleWithMetadata);
    
    return {
      id: capsuleRef.id,
      ...capsuleWithMetadata
    };
  } catch (error) {
    console.error('Kapsül oluşturma hatası:', error);
    throw error;
  }
};

/**
 * Kullanıcının kapsüllerini getirir
 * @param {string} filter - Filtreleme seçeneği ('all', 'pending', 'opened')
 * @returns {Promise<Array>} - Kapsüllerin listesi
 */
export const getUserCapsules = async (filter = 'all') => {
  try {
    const user = getAuth().currentUser;
    
    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }

    let queryConstraints = [
      where('createdBy', '==', user.uid),
      orderBy('creationDate', 'desc')
    ];

    // Filtre seçeneğine göre ek kısıtlamalar ekle
    if (filter === 'pending') {
      queryConstraints.unshift(where('status', '==', 'pending'));
    } else if (filter === 'opened') {
      queryConstraints.unshift(where('status', '==', 'opened'));
    }

    const q = query(collection(db, 'Capsules'), ...queryConstraints);
    const querySnapshot = await getDocs(q);
    
    const capsules = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return capsules;
  } catch (error) {
    console.error('Kapsülleri getirme hatası:', error);
    throw error;
  }
};

/**
 * Bir içerik medyasını yükler (resim, video, ses)
 * @param {string} contentUri - Yüklenecek içeriğin URI'si
 * @param {string} contentType - İçerik tipi ('image', 'video', 'audio')
 * @param {string} capsuleId - Kapsül ID'si
 * @returns {Promise<string>} - Yüklenen içeriğin download URL'i
 */
export const uploadCapsuleContent = async (contentUri, contentType, capsuleId) => {
  try {
    const user = getAuth().currentUser;
    
    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }

    // İçerik için benzersiz bir isim oluştur
    const timestamp = new Date().getTime();
    const filename = `capsules/${user.uid}/${capsuleId}/${contentType}_${timestamp}`;
    
    // Dosyayı URI'den alıp storage'a yükle
    const response = await fetch(contentUri);
    const blob = await response.blob();
    
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    
    // Yüklenen dosyanın download URL'ini al
    const downloadUrl = await getDownloadURL(storageRef);
    
    return downloadUrl;
  } catch (error) {
    console.error('İçerik yükleme hatası:', error);
    throw error;
  }
};

/**
 * Belirli bir kapsülü getirir
 * @param {string} capsuleId - Kapsül ID'si
 * @returns {Promise<Object>} - Kapsül verisi
 */
export const getCapsuleById = async (capsuleId) => {
  try {
    const capsuleRef = doc(db, 'Capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);
    
    if (!capsuleSnap.exists()) {
      throw new Error('Kapsül bulunamadı');
    }
    
    return {
      id: capsuleSnap.id,
      ...capsuleSnap.data()
    };
  } catch (error) {
    console.error('Kapsül getirme hatası:', error);
    throw error;
  }
};

/**
 * Kapsülü açar (durumunu 'opened' olarak günceller)
 * @param {string} capsuleId - Kapsül ID'si
 * @returns {Promise<Object>} - Güncellenen kapsül verisi
 */
export const openCapsule = async (capsuleId) => {
  try {
    const user = getAuth().currentUser;
    
    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }
    
    const capsuleRef = doc(db, 'Capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);
    
    if (!capsuleSnap.exists()) {
      throw new Error('Kapsül bulunamadı');
    }
    
    const capsuleData = capsuleSnap.data();
    
    // Kullanıcının bu kapsülü açma yetkisi var mı kontrol et
    if (capsuleData.recipients === 'self' && capsuleData.createdBy !== user.uid) {
      throw new Error('Bu kapsülü açma yetkiniz yok');
    }
    
    // Belirli kişiler için olan kapsüllerde, kullanıcı listede var mı kontrol et
    if (Array.isArray(capsuleData.recipients) && !capsuleData.recipients.includes(user.uid) && capsuleData.createdBy !== user.uid) {
      throw new Error('Bu kapsülü açma yetkiniz yok');
    }
    
    // Kapsülü açılmış olarak işaretle
    await updateDoc(capsuleRef, {
      status: 'opened',
      openedAt: serverTimestamp(),
      openedBy: user.uid
    });
    
    // Güncellenmiş kapsülü getir
    return getCapsuleById(capsuleId);
  } catch (error) {
    console.error('Kapsül açma hatası:', error);
    throw error;
  }
};

/**
 * Belirli bir mesafedeki konum kapsüllerini getirir
 * @param {Object} currentLocation - Mevcut konum {latitude, longitude}
 * @param {number} radius - Mesafe (metre)
 * @returns {Promise<Array>} - Kapsüllerin listesi
 */
export const getNearbyCapsules = async (currentLocation, radius) => {
  try {
    const user = getAuth().currentUser;
    
    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }
    
    // NOT: Bu işlev basitleştirilmiştir. Gerçek dünyada konum tabanlı sorgular
    // daha karmaşık olup, genellikle geospatial indeksleme gerektirir.
    // Burada tüm kapsülleri çekip, istemci tarafında filtreleme yapıyoruz.
    
    // Yalnızca konum kapsüllerini getir
    const q = query(
      collection(db, 'Capsules'),
      where('type', '==', 'location'),
      where('status', '==', 'pending')
    );
    
    const querySnapshot = await getDocs(q);
    
    const capsules = [];
    
    querySnapshot.forEach(doc => {
      const capsuleData = doc.data();
      
      // Kapsül public veya kullanıcıya ait mi kontrol et
      const isPublic = capsuleData.recipients === 'public';
      const isOwner = capsuleData.createdBy === user.uid;
      const isRecipient = Array.isArray(capsuleData.recipients) && capsuleData.recipients.includes(user.uid);
      
      if (isPublic || isOwner || isRecipient) {
        if (capsuleData.location) {
          // Basit mesafe hesaplama (Haversine formülü ile)
          const distance = calculateDistance(
            currentLocation.latitude, currentLocation.longitude,
            capsuleData.location.latitude, capsuleData.location.longitude
          );
          
          // Metre cinsinden mesafe, kapsül yarıçapı içinde mi?
          if (distance <= radius) {
            capsules.push({
              id: doc.id,
              ...capsuleData,
              distance: Math.round(distance)
            });
          }
        }
      }
    });
    
    // Mesafeye göre sırala
    return capsules.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Yakındaki kapsülleri getirme hatası:', error);
    throw error;
  }
};

/**
 * İki konum arasındaki mesafeyi hesaplar (Haversine formülü)
 * @param {number} lat1 - İlk konumun enlem değeri
 * @param {number} lon1 - İlk konumun boylam değeri
 * @param {number} lat2 - İkinci konumun enlem değeri
 * @param {number} lon2 - İkinci konumun boylam değeri
 * @returns {number} - Metre cinsinden mesafe
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Dünya yarıçapı (metre)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Metre cinsinden mesafe
};

/**
 * Kapsülü siler
 * @param {string} capsuleId - Kapsül ID'si
 * @returns {Promise<void>}
 */
export const deleteCapsule = async (capsuleId) => {
  try {
    const user = getAuth().currentUser;
    
    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }
    
    const capsuleRef = doc(db, 'Capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);
    
    if (!capsuleSnap.exists()) {
      throw new Error('Kapsül bulunamadı');
    }
    
    const capsuleData = capsuleSnap.data();
    
    // Yalnızca oluşturan kullanıcı silebilir
    if (capsuleData.createdBy !== user.uid) {
      throw new Error('Bu kapsülü silme yetkiniz yok');
    }
    
    await deleteDoc(capsuleRef);
  } catch (error) {
    console.error('Kapsül silme hatası:', error);
    throw error;
  }
};

/**
 * Kapsülün içeriklerini günceller
 * @param {string} capsuleId - Kapsül ID'si
 * @param {Array} contents - Yeni içerik dizisi
 * @returns {Promise<Object>} - Güncellenen kapsül verisi
 */
export const updateCapsuleContents = async (capsuleId, contents) => {
  try {
    const user = getAuth().currentUser;
    
    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }
    
    const capsuleRef = doc(db, 'Capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);
    
    if (!capsuleSnap.exists()) {
      throw new Error('Kapsül bulunamadı');
    }
    
    const capsuleData = capsuleSnap.data();
    
    // Yalnızca oluşturan kullanıcı içeriği güncelleyebilir
    if (capsuleData.createdBy !== user.uid) {
      throw new Error('Bu kapsülün içeriklerini güncelleme yetkiniz yok');
    }
    
    // İçerikleri güncelle
    await updateDoc(capsuleRef, {
      contents: contents
    });
    
    // Güncellenmiş kapsülü getir
    return getCapsuleById(capsuleId);
  } catch (error) {
    console.error('Kapsül içeriklerini güncelleme hatası:', error);
    throw error;
  }
};

export default {
  createCapsule,
  getUserCapsules,
  uploadCapsuleContent,
  getCapsuleById,
  openCapsule,
  getNearbyCapsules,
  deleteCapsule,
  updateCapsuleContents
}; 