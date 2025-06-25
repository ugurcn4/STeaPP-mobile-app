import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  BackHandler,
  ActivityIndicator,
  Alert,
  SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Toast } from 'react-native-toast-message';
import CustomDatePicker from '../components/CustomDatePicker';
import RecipientSelector from '../components/RecipientSelector';

import capsuleService from '../services/CapsuleService';


// Tab tipleri
const TABS = {
  CREATE: 'create',
  MY_CAPSULES: 'myCapsules'
};

// Kapsül içerik tipleri
const CONTENT_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file' // Yeni içerik tipi: dosya
};

// Alıcı tipleri
const RECIPIENT_TYPES = {
  SELF: 'self',
  SPECIFIC: 'specific',
  PUBLIC: 'public'
};


// İmport kısmına şu satırı ekle (en üstteki import bloğuna):
import { styles } from '../styles/CapsuleModalStyles';

const CapsuleModal = ({ visible, onClose }) => {
  // Tab durum yönetimi
  const [activeTab, setActiveTab] = useState(TABS.CREATE);
  
  // Kapsül oluşturma ekranı için durumlar
  const [capsuleType, setCapsuleType] = useState(null); // 'time' veya 'location'
  
  // Kapsül form verileri
  const [capsuleTitle, setCapsuleTitle] = useState('');
  const [capsuleContents, setCapsuleContents] = useState([]);
  const [selectedTime, setSelectedTime] = useState('1y'); // '1w', '1m', '1y', '5y'
  const [openDate, setOpenDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationRadius, setLocationRadius] = useState(100); // metre cinsinden
  const [locationHasTimeConstraint, setLocationHasTimeConstraint] = useState(false);
  const [recipientType, setRecipientType] = useState(RECIPIENT_TYPES.SELF);
  const [specificRecipients, setSpecificRecipients] = useState([]);
  
  // Kapsüllerim ekranı için durumlar
  const [capsules, setCapsules] = useState([]);
  const [capsuleFilter, setCapsuleFilter] = useState('all'); // 'all', 'pending', 'opened'
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal içi işlemler için durum
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTextInput, setActiveTextInput] = useState('');
  const [textInputContent, setTextInputContent] = useState('');
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  
  // Kullanıcının mevcut konumu
  const [userLocation, setUserLocation] = useState(null);
  
  // İzinler
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [hasMediaPermission, setHasMediaPermission] = useState(false);
  
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);

  // Yeni durum değişkenleri ekleyelim
  const [resultMessage, setResultMessage] = useState(null);
  const [resultType, setResultType] = useState(null); // 'success' veya 'error'

  // Android geri tuşu için
  useEffect(() => {
    const backAction = () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [visible]);

  // Modal açıldığında izinleri kontrol et
  useEffect(() => {
    if (visible) {
      checkPermissions();
      resetForm();
      
      // Kapsüllerim sekmesi açıksa, kapsülleri getir
      if (activeTab === TABS.MY_CAPSULES) {
        fetchUserCapsules();
      }
    }
  }, [visible, activeTab]);
  
  // Tab değiştirildiğinde
  useEffect(() => {
    if (activeTab === TABS.MY_CAPSULES) {
      fetchUserCapsules();
    }
  }, [activeTab, capsuleFilter]);
  
  // Seçilen zaman değiştiğinde, açılma tarihini güncelle
  useEffect(() => {
    if (selectedTime && !openDate) { // Sadece openDate null ise güncelle
      const now = new Date();
      let futureDate = new Date();
      
      switch (selectedTime) {
        case '1w':
          futureDate.setDate(now.getDate() + 7);
          break;
        case '1m':
          futureDate.setMonth(now.getMonth() + 1);
          break;
        case '1y':
          futureDate.setFullYear(now.getFullYear() + 1);
          break;
        case '5y':
          futureDate.setFullYear(now.getFullYear() + 5);
          break;
        case '10y':
          futureDate.setFullYear(now.getFullYear() + 10);
          break;
        default:
          break;
      }
      
      // Bu sadece arka planda tarih hesaplamak için, UI'da gösterilmiyor
      setOpenDate(null); // Özel tarih seçilmediğini belirtmek için null yapıyoruz
    }
  }, [selectedTime]);
  
  // Formu sıfırla
  const resetForm = () => {
    setCapsuleType(null);
    setCapsuleTitle('');
    setCapsuleContents([]);
    setSelectedTime('1y');
    setOpenDate(null);
    setShowDatePicker(false);
    setSelectedLocation(null);
    setShowLocationPicker(false);
    setLocationRadius(100);
    setLocationHasTimeConstraint(false);
    setRecipientType(RECIPIENT_TYPES.SELF);
    setSpecificRecipients([]);
    setIsSubmitting(false);
    // Sonuç mesajını da sıfırlayalım
    setResultMessage(null);
    setResultType(null);
  };
  
  // İzinleri kontrol et
  const checkPermissions = async () => {
    // Konum izni kontrolü
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    setHasLocationPermission(locationStatus === 'granted');
    
    if (locationStatus === 'granted') {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
      }
    }
    
    // Medya kütüphanesi izni kontrolü
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
    setHasMediaPermission(mediaStatus === 'granted');
  };

  // Kullanıcı detaylarını getiren fonksiyon

  // Kullanıcının kapsüllerini getir
  const fetchUserCapsules = async () => {
    try {
      setIsLoading(true);
      const userCapsules = await capsuleService.getUserCapsules(capsuleFilter);
      
      // Alıcı bilgileri direkt olarak kapsüllerin içinde bulunuyor
      const processedCapsules = userCapsules.map(capsule => {
        // Kapsül içindeki recipients alanı artık dizi olarak değil, doğrudan detayları içeren bir array
        if (Array.isArray(capsule.recipients) && capsule.recipients.length > 0) {
          // recipients dizisini direkt olarak recipientDetails olarak kullan
          return {
            ...capsule,
            recipientDetails: capsule.recipients.map(recipient => ({
              id: recipient.id || '',
              name: recipient.name || '',
              avatar: recipient.avatar || null,
              username: recipient.username || ''
            }))
          };
        }
        return capsule;
      });
      
      setCapsules(processedCapsules);
    } catch (error) {
      console.error('Kapsülleri getirirken hata oluştu:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Kapsülleriniz yüklenemedi. Lütfen tekrar deneyin.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Metin içeriği ekle
  const handleAddTextContent = () => {
    setActiveTextInput(CONTENT_TYPES.TEXT);
    setTextInputContent('');
    setShowTextInputModal(true);
  };
  
  // Resim içeriği ekle
  const handleAddImageContent = async () => {
    if (!hasMediaPermission) {
      Alert.alert(
        'İzin Gerekli',
        'Fotoğraf eklemek için galeri erişim izni gereklidir.',
        [{ text: 'Tamam' }]
      );
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        
        setCapsuleContents(prevContents => [
          ...prevContents,
          {
            id: Date.now().toString(),
            type: CONTENT_TYPES.IMAGE,
            uri: selectedImage.uri,
            preview: selectedImage.uri
          }
        ]);
      }
    } catch (error) {
      console.error('Resim seçilirken hata oluştu:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Resim seçilemedi. Lütfen tekrar deneyin.'
      });
    }
  };
  
  // Video içeriği ekle
  const handleAddVideoContent = async () => {
    if (!hasMediaPermission) {
      Alert.alert(
        'İzin Gerekli',
        'Video eklemek için galeri erişim izni gereklidir.',
        [{ text: 'Tamam' }]
      );
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedVideo = result.assets[0];
        
        setCapsuleContents(prevContents => [
          ...prevContents,
          {
            id: Date.now().toString(),
            type: CONTENT_TYPES.VIDEO,
            uri: selectedVideo.uri,
            preview: selectedVideo.uri
          }
        ]);
      }
    } catch (error) {
      console.error('Video seçilirken hata oluştu:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Video seçilemedi. Lütfen tekrar deneyin.'
      });
    }
  };
  
  // Ses içeriği ekle
  const handleAddAudioContent = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true
      });
      
      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const selectedAudio = result.assets[0];
        
        setCapsuleContents(prevContents => [
          ...prevContents,
          {
            id: Date.now().toString(),
            type: CONTENT_TYPES.AUDIO,
            uri: selectedAudio.uri,
            name: selectedAudio.name,
            preview: null
          }
        ]);
      }
    } catch (error) {
      console.error('Ses dosyası seçilirken hata oluştu:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Ses dosyası seçilemedi. Lütfen tekrar deneyin.'
      });
    }
  };
  
  // Dosya seçme fonksiyonunu ekleyelim
  const handleAddFileContent = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Tüm dosya tipleri
        copyToCacheDirectory: true
      });
      
      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const selectedFile = result.assets[0];
        
        // Dosya boyutu kontrolü (2MB = 2 * 1024 * 1024 bytes)
        if (selectedFile.size > 2 * 1024 * 1024) {
          Toast.show({
            type: 'error',
            text1: 'Dosya çok büyük',
            text2: 'Dosya boyutu en fazla 2MB olabilir. Premium hesaplar daha büyük dosyalar yükleyebilir.'
          });
          return;
        }
        
        setCapsuleContents(prevContents => [
          ...prevContents,
          {
            id: Date.now().toString(),
            type: CONTENT_TYPES.FILE,
            uri: selectedFile.uri,
            name: selectedFile.name,
            size: selectedFile.size,
            preview: null
          }
        ]);
      }
    } catch (error) {
      console.error('Dosya seçilirken hata oluştu:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Dosya seçilemedi. Lütfen tekrar deneyin.'
      });
    }
  };
  
  // İçerik kaldır
  const handleRemoveContent = (contentId) => {
    setCapsuleContents(prevContents => 
      prevContents.filter(content => content.id !== contentId)
    );
  };
  
  // Metin giriş modalını onayla
  const handleConfirmTextInput = () => {
    if (textInputContent.trim()) {
      setCapsuleContents(prevContents => [
        ...prevContents,
        {
          id: Date.now().toString(),
          type: CONTENT_TYPES.TEXT,
          text: textInputContent.trim()
        }
      ]);
      
      setShowTextInputModal(false);
      setTextInputContent('');
    } else {
      // Toast kullanımı yerine Alert kullanabiliriz
      Alert.alert('Boş Mesaj', 'Lütfen bir mesaj girin.');
    }
  };
  
  // Konum seçimini onayla
  const handleConfirmLocation = () => {
    if (selectedLocation) {
      setShowLocationPicker(false);
    } else {
      // Toast kullanımı yerine Alert kullanabiliriz
      Alert.alert('Konum Seçilmedi', 'Lütfen bir konum seçin.');
    }
  };
  
  // Tarih seçicisini göster
  const handleShowDatePicker = () => {
    // Eğer başka bir hızlı seçim aktifse, onu temizle
    setSelectedTime(null);
    
    // Tarih seçiciyi göster (başlangıç değeri olarak openDate veya şimdiki tarih + 1 yıl)
    if (!openDate) {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 1);
      setOpenDate(defaultDate);
    }
    
    setShowDatePicker(true);
  };
  
  // Tarih seçimini onayla
  
  // Formu kontrol et
  const validateForm = () => {
    if (!capsuleTitle.trim()) {
      setResultMessage('Lütfen kapsüle bir başlık verin.');
      setResultType('error');
      return false;
    }
    
    if (capsuleContents.length === 0) {
      setResultMessage('Lütfen en az bir içerik ekleyin.');
      setResultType('error');
      return false;
    }
    
    if (capsuleType === 'time' && !openDate) {
      setResultMessage('Lütfen kapsülün açılacağı tarihi seçin.');
      setResultType('error');
      return false;
    }
    
    if (capsuleType === 'location' && !selectedLocation) {
      setResultMessage('Lütfen kapsülün açılacağı konumu seçin.');
      setResultType('error');
      return false;
    }
    
    return true;
  };
  
  // Kapsül oluştur
  const handleCreateCapsule = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      // Sonuç mesajını temizleyelim
      setResultMessage(null);
      setResultType(null);
      
      // Kapsül verilerini hazırla
      const capsuleData = {
        title: capsuleTitle.trim(),
        type: capsuleType,
        contents: []
      };
      
      // Alıcı tipine göre veri ekle
      if (recipientType === RECIPIENT_TYPES.SPECIFIC) {
        capsuleData.recipients = specificRecipients.map(r => r.id);
        capsuleData.recipientDetails = specificRecipients;
      } else {
        capsuleData.recipients = recipientType;
      }
      
      // Kapsül tipine göre ek veriler ekle
      if (capsuleType === 'time') {
        capsuleData.openDate = openDate;
      } else if (capsuleType === 'location') {
        capsuleData.location = {
          ...selectedLocation,
          radius: locationRadius
        };
        
        if (locationHasTimeConstraint && openDate) {
          capsuleData.location.validUntil = openDate;
        }
      }
      
      // Önce kapsülü oluştur
      const createdCapsule = await capsuleService.createCapsule(capsuleData);
      
      // Sonra içerikleri yükle
      const contentPromises = capsuleContents.map(async (content) => {
        if (content.type === CONTENT_TYPES.TEXT) {
          // Metin içeriği doğrudan eklenebilir
          return {
            type: content.type,
            data: content.text
          };
        } else {
          // Medya içeriği için dosya yükleme
          try {
            const downloadUrl = await capsuleService.uploadCapsuleContent(
              content.uri,
              content.type,
              createdCapsule.id
            );
            
            return {
              type: content.type,
              data: downloadUrl,
              ...(content.name ? { name: content.name } : {})
            };
          } catch (uploadError) {
            console.error('İçerik yükleme hatası:', uploadError);
            throw new Error('İçerik yüklenemedi.');
          }
        }
      });
      
      // Tüm içeriklerin yüklenmesini bekle
      const uploadedContents = await Promise.all(contentPromises);
      
      // Kapsülü güncelle
      await capsuleService.updateCapsuleContents(createdCapsule.id, uploadedContents);
      
      // Toast yerine sadece durum değişkenlerini güncelleyelim
      setResultMessage(`"${capsuleTitle}" kapsülünüz başarıyla oluşturuldu.`);
      setResultType('success');
      
      // 3 saniye sonra kapsüllerim sekmesine geçelim
      setTimeout(() => {
        // Formu sıfırla ve kapsülleri yenile
        resetForm();
        
        // Kapsüllerim sekmesine geç
        setActiveTab(TABS.MY_CAPSULES);
      }, 3000);
      
    } catch (error) {
      console.error('Kapsül oluşturma hatası:', error);
      
      // Toast kullanımını kaldırıp durum değişkenlerini güncelleyelim
      setResultMessage('Kapsül oluşturulamadı. Lütfen tekrar deneyin.');
      setResultType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Kapsül tipini seçme ekranı
  const renderCapsuleTypeSelection = () => {
    return (
      <View style={styles.typeSelectionContainer}>
        {/* Başlık Bölümü */}
        <View style={styles.welcomeContainer}>
          <View style={styles.bottleImageContainer}>
            <Ionicons name="time" size={64} color="#3498db" />
          </View>
          <Text style={styles.welcomeTitle}>Zaman ve Mekan Kapsülleri</Text>
          <Text style={styles.welcomeSubtitle}>Özel mesajlarınızı gelecekte veya özel konumlarda açılmak üzere saklayın</Text>
        </View>
        
        {/* Kapsülün örnekleri */}
        <Text style={styles.examplesTitle}>Ne Yapabilirsiniz?</Text>
        <View style={styles.examplesContainer}>
          <View style={styles.exampleItem}>
            <View style={[styles.exampleIcon, {backgroundColor: 'rgba(231, 76, 60, 0.1)'}]}>
              <Ionicons name="heart-outline" size={20} color="#e74c3c" />
            </View>
            <View style={styles.exampleTextContainer}>
              <Text style={styles.exampleTitle}>Çocuğunuzun 18. Doğum Günü</Text>
              <Text style={styles.exampleText}>Doğduğu hastanede, 18 yaşına geldiğinde ona açılacak bir mesaj bırakın</Text>
            </View>
          </View>
          
          <View style={styles.exampleItem}>
            <View style={[styles.exampleIcon, {backgroundColor: 'rgba(46, 204, 113, 0.1)'}]}>
              <Ionicons name="diamond-outline" size={20} color="#2ecc71" />
            </View>
            <View style={styles.exampleTextContainer}>
              <Text style={styles.exampleTitle}>Evlilik Yıldönümü Sürprizi</Text>
              <Text style={styles.exampleText}>Eşinize ilk tanıştığınız kafede 10. yıldönümünüzde açılacak bir anı</Text>
            </View>
          </View>
          
          <View style={styles.exampleItem}>
            <View style={[styles.exampleIcon, {backgroundColor: 'rgba(52, 152, 219, 0.1)'}]}>
              <Ionicons name="school-outline" size={20} color="#3498db" />
            </View>
            <View style={styles.exampleTextContainer}>
              <Text style={styles.exampleTitle}>Mezuniyet Anısı</Text>
              <Text style={styles.exampleText}>Üniversite arkadaşlarınızla kampüste, 10 yıl sonra açılacak hatıralar</Text>
            </View>
          </View>
        </View>
        
        {/* Kapsül Tipi Seçimi */}
        <Text style={styles.capsuleTypeTitle}>Nasıl Bir Kapsül Oluşturmak İstersiniz?</Text>
        <View style={styles.capsuleTypeCards}>
          <TouchableOpacity
            style={styles.capsuleTypeCard}
            onPress={() => setCapsuleType('time')}
          >
            <View style={styles.capsuleTypeIconContainer}>
              <Ionicons name="timer-outline" size={36} color="#3498db" />
            </View>
            <Text style={styles.capsuleTypeCardTitle}>Zaman Kapsülü</Text>
            <Text style={styles.capsuleTypeDescription}>Belirlediğin tarihte açılacak</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.capsuleTypeCard}
            onPress={() => setCapsuleType('location')}
          >
            <View style={styles.capsuleTypeIconContainer}>
              <Ionicons name="location-outline" size={36} color="#e74c3c" />
            </View>
            <Text style={styles.capsuleTypeCardTitle}>Konum Kapsülü</Text>
            <Text style={styles.capsuleTypeDescription}>Bu konuma dönüldüğünde açılacak</Text>
          </TouchableOpacity>
        </View>
        
        {/* Güvenlik Açıklaması - Alt Kısım */}
        <View style={styles.securityContainer}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#2ecc71" style={styles.securityIcon} />
          <Text style={styles.securityText}>
            Kapsülleriniz tamamen güvenli! Belirlediğiniz zaman veya konum koşulu sağlanana kadar STeaPP dahil hiç kimse içeriğe erişemez.
          </Text>
        </View>
      </View>
    );
  };
  
  // Yeni Kapsül Oluşturma Tab İçeriği
  const renderCreateTab = () => {
    if (!capsuleType) {
      return renderCapsuleTypeSelection();
    }
    
    return renderCapsuleForm();
  };

  // Kapsül oluşturma formu
  const renderCapsuleForm = () => {
    // Sonuç overlay'ini oluşturalım
    const renderResultOverlay = () => {
      if (!resultMessage) return null;
      
      return (
        <View style={[
          styles.resultOverlay,
          resultType === 'success' ? styles.successOverlay : styles.errorOverlay
        ]}>
          <View style={styles.resultIconContainer}>
            <Ionicons 
              name={resultType === 'success' ? 'checkmark-circle' : 'close-circle'} 
              size={60} 
              color="#fff" 
            />
          </View>
          
          <Text style={styles.resultMessage}>
            {resultType === 'success' ? 'Harika!' : 'Üzgünüz!'}
          </Text>
          
          <Text style={styles.resultMessage}>{resultMessage}</Text>
          
          {resultType === 'success' && (
            <View style={{alignItems: 'center'}}>
              <Text style={styles.resultSubMessage}>
                Kapsüllerim sayfasına yönlendiriliyorsunuz...
              </Text>
              <View style={{marginTop: 20}}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            </View>
          )}
          
          {resultType === 'error' && (
            <TouchableOpacity 
              style={styles.resultButton}
              onPress={() => {
                setResultMessage(null);
                setResultType(null);
              }}
            >
              <Text style={styles.resultButtonText}>Tekrar Dene</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    };
    
    return (
      <View style={styles.capsuleFormContainer}>
        <View style={styles.formHeaderContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setCapsuleType(null)}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.formTitle}>
            {capsuleType === 'time' ? 'Zaman Kapsülü Oluştur' : 'Konum Kapsülü Oluştur'}
          </Text>
          
          <View style={styles.placeholderView} />
        </View>
        
        {/* İçerik başlık alanı */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Kapsül Başlığı</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="pencil-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="Kapsüle bir isim ver"
              placeholderTextColor="#999"
              value={capsuleTitle}
              onChangeText={setCapsuleTitle}
            />
          </View>
        </View>
        
        {/* İçerik ekleme bölümü */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>İçerik Ekle</Text>
          <Text style={styles.sectionSubtitle}>Kapsülüne eklemek istediğin içerik türünü seç</Text>
          
          {/* İçerik türlerine dosya tipini ekleyelim */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.contentTypeScroll}
          >
            {/* Metin Kartı */}
            <TouchableOpacity 
              style={styles.contentTypeCard}
              onPress={handleAddTextContent}
            >
              <View style={[styles.contentTypeIcon, { backgroundColor: 'rgba(52, 152, 219, 0.1)' }]}>
                <Ionicons name="chatbubble-outline" size={24} color="#333" />
              </View>
              <Text style={styles.contentTypeTitle}>Mesaj</Text>
              <Text style={styles.contentTypeSubtitle}>Metin mesajı ekle</Text>
              <View style={styles.addButtonContainer}>
                <Ionicons name="add-circle" size={26} color="#333" />
              </View>
            </TouchableOpacity>
            
            {/* Fotoğraf Kartı */}
            <TouchableOpacity 
              style={styles.contentTypeCard}
              onPress={handleAddImageContent}
            >
              <View style={[styles.contentTypeIcon, { backgroundColor: 'rgba(46, 204, 113, 0.1)' }]}>
                <Ionicons name="image-outline" size={24} color="#333" />
              </View>
              <Text style={styles.contentTypeTitle}>Fotoğraf</Text>
              <Text style={styles.contentTypeSubtitle}>Resim yükle</Text>
              <View style={styles.addButtonContainer}>
                <Ionicons name="add-circle" size={26} color="#333" />
              </View>
            </TouchableOpacity>
            
            {/* Video Kartı */}
            <TouchableOpacity 
              style={styles.contentTypeCard}
              onPress={handleAddVideoContent}
            >
              <View style={[styles.contentTypeIcon, { backgroundColor: 'rgba(155, 89, 182, 0.1)' }]}>
                <Ionicons name="videocam-outline" size={24} color="#333" />
              </View>
              <Text style={styles.contentTypeTitle}>Video</Text>
              <Text style={styles.contentTypeSubtitle}>Video ekle</Text>
              <View style={styles.addButtonContainer}>
                <Ionicons name="add-circle" size={26} color="#333" />
              </View>
            </TouchableOpacity>
            
            {/* Ses Kartı */}
            <TouchableOpacity 
              style={styles.contentTypeCard}
              onPress={handleAddAudioContent}
            >
              <View style={[styles.contentTypeIcon, { backgroundColor: 'rgba(231, 76, 60, 0.1)' }]}>
                <Ionicons name="mic-outline" size={24} color="#333" />
              </View>
              <Text style={styles.contentTypeTitle}>Ses</Text>
              <Text style={styles.contentTypeSubtitle}>Sesli mesaj kaydet</Text>
              <View style={styles.addButtonContainer}>
                <Ionicons name="add-circle" size={26} color="#333" />
              </View>
            </TouchableOpacity>
            
            {/* Dosya Kartı - Yeni */}
            <TouchableOpacity 
              style={styles.contentTypeCard}
              onPress={handleAddFileContent}
            >
              <View style={[styles.contentTypeIcon, { backgroundColor: 'rgba(52, 73, 94, 0.1)' }]}>
                <Ionicons name="document-outline" size={24} color="#333" />
              </View>
              <Text style={styles.contentTypeTitle}>Dosya</Text>
              <Text style={styles.contentTypeSubtitle}>Belge ekle (maks. 2MB)</Text>
              <View style={styles.premiumNoteContainer}>
                <Text style={styles.premiumNoteText}>Premium: Sınırsız</Text>
              </View>
              <View style={styles.addButtonContainer}>
                <Ionicons name="add-circle" size={26} color="#333" />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        {/* İçerik önizleme alanı */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Eklenen İçerikler</Text>
          {capsuleContents.length > 0 ? (
            <View style={styles.contentGrid}>
              {capsuleContents.map((content) => (
                <View key={content.id} style={styles.contentGridItem}>
                  <View style={styles.contentPreviewHeader}>
                    <View style={styles.contentTypeIndicator}>
                      <Ionicons 
                        name={
                          content.type === CONTENT_TYPES.TEXT 
                            ? "chatbubble-outline" 
                            : content.type === CONTENT_TYPES.IMAGE 
                              ? "image-outline" 
                              : content.type === CONTENT_TYPES.VIDEO 
                                ? "videocam-outline" 
                                : content.type === CONTENT_TYPES.FILE
                                  ? "document-outline"
                                  : "musical-note-outline"
                        } 
                        size={16} 
                        color="#fff" 
                      />
                    </View>
                    <Text style={styles.contentPreviewTitle}>
                      {content.type === CONTENT_TYPES.TEXT 
                        ? 'Metin'
                        : content.type === CONTENT_TYPES.IMAGE
                          ? 'Fotoğraf'
                          : content.type === CONTENT_TYPES.VIDEO
                            ? 'Video'
                            : content.type === CONTENT_TYPES.FILE
                              ? 'Dosya'
                              : 'Ses'}
                    </Text>
                    <TouchableOpacity 
                      style={styles.contentRemoveButton}
                      onPress={() => handleRemoveContent(content.id)}
                    >
                      <Ionicons name="close-circle" size={22} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.contentPreviewBody}>
                    {content.type === CONTENT_TYPES.TEXT ? (
                      <Text style={styles.textPreview} numberOfLines={3}>{content.text}</Text>
                    ) : content.type === CONTENT_TYPES.IMAGE ? (
                      <Image 
                        source={{ uri: content.preview }} 
                        style={styles.imagePreview} 
                        resizeMode="cover"
                      />
                    ) : content.type === CONTENT_TYPES.VIDEO ? (
                      <View style={styles.videoPreviewContainer}>
                        <Image 
                          source={{ uri: content.preview }} 
                          style={styles.videoPreview} 
                          resizeMode="cover"
                        />
                        <View style={styles.videoPreviewOverlay}>
                          <Ionicons name="play" size={24} color="#fff" />
                        </View>
                      </View>
                    ) : content.type === CONTENT_TYPES.FILE ? (
                      <View style={styles.filePreviewContainer}>
                        <Ionicons name="document" size={24} color="#34495e" />
                        <View style={styles.fileInfoContainer}>
                          <Text style={styles.filePreviewName} numberOfLines={1}>{content.name}</Text>
                          <Text style={styles.filePreviewSize}>{(content.size / 1024).toFixed(1)} KB</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.audioPreviewContainer}>
                        <Ionicons name="musical-note" size={24} color="#333" />
                        <Text style={styles.audioPreviewText} numberOfLines={1}>
                          {content.name || "Ses dosyası"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
          <View style={styles.emptyContentPreview}>
            <Ionicons name="albums-outline" size={40} color="#ccc" />
            <Text style={styles.emptyContentText}>Henüz içerik eklenmedi</Text>
          </View>
          )}
        </View>
        
        {/* İşlem sonuç overlay'i */}
        {renderResultOverlay()}
        
        {/* Kapsül açılma ayarları */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>
            {capsuleType === 'time' ? 'Ne Zaman Açılsın?' : 'Nerede Açılsın?'}
          </Text>
          
          {capsuleType === 'time' ? (
            <View style={styles.timeSelectionContainer}>
              <Text style={styles.timeOptionsLabel}>Hızlı Seçim</Text>
              <View style={styles.quickTimeOptions}>
                <TouchableOpacity 
                  style={[styles.quickTimeButton, selectedTime === '1w' && styles.quickTimeButtonActive]}
                  onPress={() => {
                    setSelectedTime('1w');
                    setOpenDate(null); // Özel tarih iptal edilir
                  }}
                >
                  <Text style={selectedTime === '1w' ? styles.quickTimeTextActive : styles.quickTimeText}>1 Hafta</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickTimeButton, selectedTime === '1m' && styles.quickTimeButtonActive]}
                  onPress={() => {
                    setSelectedTime('1m');
                    setOpenDate(null);
                  }}
                >
                  <Text style={selectedTime === '1m' ? styles.quickTimeTextActive : styles.quickTimeText}>1 Ay</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickTimeButton, selectedTime === '1y' && styles.quickTimeButtonActive]}
                  onPress={() => {
                    setSelectedTime('1y');
                    setOpenDate(null);
                  }}
                >
                  <Text style={selectedTime === '1y' ? styles.quickTimeTextActive : styles.quickTimeText}>1 Yıl</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickTimeButton, selectedTime === '5y' && styles.quickTimeButtonActive]}
                  onPress={() => {
                    setSelectedTime('5y');
                    setOpenDate(null);
                  }}
                >
                  <Text style={selectedTime === '5y' ? styles.quickTimeTextActive : styles.quickTimeText}>5 Yıl</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickTimeButton, selectedTime === '10y' && styles.quickTimeButtonActive]}
                  onPress={() => {
                    setSelectedTime('10y');
                    setOpenDate(null);
                  }}
                >
                  <Text style={selectedTime === '10y' ? styles.quickTimeTextActive : styles.quickTimeText}>10 Yıl</Text>
                </TouchableOpacity>
              </View>
              
              {/* Tarih göstergesi */}
              <View style={styles.dateDisplayContainer}>
                <View style={styles.dateIconWrapper}>
                  <Ionicons name="calendar-outline" size={22} color="#fff" />
                </View>
                <Text style={styles.dateDisplayText}>
                  {openDate 
                    ? `${format(openDate, 'd MMMM yyyy', { locale: tr })} (Özel tarih)` 
                    : selectedTime === '1w' 
                      ? '1 hafta sonra açılacak'
                      : selectedTime === '1m'
                        ? '1 ay sonra açılacak'
                        : selectedTime === '1y'
                          ? '1 yıl sonra açılacak'
                          : selectedTime === '5y'
                            ? '5 yıl sonra açılacak'
                            : '10 yıl sonra açılacak'
                  }
                </Text>
                <TouchableOpacity 
                  style={styles.datePickerButton}
                  onPress={handleShowDatePicker}
                >
                  <Text style={styles.datePickerButtonText}>Özel Tarih</Text>
                  <Ionicons name="chevron-forward" size={16} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.locationSelectionContainer}>
              <TouchableOpacity 
                style={styles.mapPreviewPlaceholder}
                onPress={() => setShowLocationPicker(true)}
              >
                {selectedLocation ? (
                  <MapView
                    style={styles.miniMapPreview}
                    region={{
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    <Marker
                      coordinate={selectedLocation}
                    />
                    <Circle
                      center={selectedLocation}
                      radius={locationRadius}
                      fillColor="rgba(52, 152, 219, 0.2)"
                      strokeColor="rgba(52, 152, 219, 0.5)"
                    />
                  </MapView>
                ) : (
                  <>
                <View style={styles.mapIconWrapper}>
                  <Ionicons name="map-outline" size={32} color="#fff" />
                </View>
                <Text style={styles.mapPreviewText}>Konum seçmek için dokun</Text>
                  </>
                )}
              </TouchableOpacity>
              
              {/* Yarıçap seçimi */}
              <Text style={styles.radiusLabel}>Yarıçap Seçimi</Text>
              <View style={styles.radiusOptions}>
                <TouchableOpacity 
                  style={[styles.radiusOption, locationRadius === 50 && styles.radiusOptionActive]}
                  onPress={() => setLocationRadius(50)}
                >
                  <Text style={locationRadius === 50 ? styles.radiusTextActive : styles.radiusText}>50m</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.radiusOption, locationRadius === 100 && styles.radiusOptionActive]}
                  onPress={() => setLocationRadius(100)}
                >
                  <Text style={locationRadius === 100 ? styles.radiusTextActive : styles.radiusText}>100m</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.radiusOption, locationRadius === 250 && styles.radiusOptionActive]}
                  onPress={() => setLocationRadius(250)}
                >
                  <Text style={locationRadius === 250 ? styles.radiusTextActive : styles.radiusText}>250m</Text>
                </TouchableOpacity>
              </View>
              
              {/* Konum + Zaman seçeneği */}
              <TouchableOpacity 
                style={[
                  styles.addTimeToLocationButton,
                  locationHasTimeConstraint && { backgroundColor: '#e1f0fd', borderColor: '#3498db' }
                ]}
                onPress={() => setLocationHasTimeConstraint(!locationHasTimeConstraint)}
              >
                <View style={[
                  styles.addTimeIconWrapper,
                  locationHasTimeConstraint && { backgroundColor: '#2980b9' }
                ]}>
                  <Ionicons name="time-outline" size={18} color="#fff" />
                </View>
                <Text style={[
                  styles.addTimeToLocationText,
                  locationHasTimeConstraint && { color: '#2980b9', fontWeight: '600' }
                ]}>
                  {locationHasTimeConstraint ? 'Zaman koşulu eklendi' : 'Zaman koşulu ekle'}
                </Text>
              </TouchableOpacity>
              
              {/* Eğer zaman koşulu eklenirse, tarih seçim bölümünü göster */}
              {locationHasTimeConstraint && (
                <View style={styles.timeConstraintContainer}>
                  <Text style={styles.timeConstraintLabel}>Kapsül bu tarihten sonra geçersiz olacak:</Text>
                  <View style={styles.dateDisplayContainer}>
                    <View style={styles.dateIconWrapper}>
                      <Ionicons name="calendar-outline" size={22} color="#fff" />
                    </View>
                    <Text style={styles.dateDisplayText}>
                      {openDate ? format(openDate, 'd MMMM yyyy', { locale: tr }) : 'Tarih seçilmedi'}
                    </Text>
                    <TouchableOpacity 
                      style={styles.datePickerButton}
                      onPress={handleShowDatePicker}
                    >
                      <Text style={styles.datePickerButtonText}>Değiştir</Text>
                      <Ionicons name="chevron-forward" size={16} color="#3498db" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Alıcı seçimi */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Kim Açabilsin?</Text>
          <View style={styles.recipientOptionsContainer}>
            <TouchableOpacity 
              style={[styles.recipientOption, recipientType === RECIPIENT_TYPES.SELF && styles.recipientOptionActive]}
              onPress={() => setRecipientType(RECIPIENT_TYPES.SELF)}
            >
              <View style={[styles.recipientIconWrapper, recipientType === RECIPIENT_TYPES.SELF && styles.recipientIconWrapperActive]}>
                <Ionicons name="person-outline" size={22} color={recipientType === RECIPIENT_TYPES.SELF ? "#fff" : "#333"} />
              </View>
              <Text style={[styles.recipientText, recipientType === RECIPIENT_TYPES.SELF && styles.recipientTextActive]}>Sadece Ben</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.recipientOption, recipientType === RECIPIENT_TYPES.SPECIFIC && styles.recipientOptionActive]}
              onPress={() => {
                setRecipientType(RECIPIENT_TYPES.SPECIFIC);
                setShowRecipientSelector(true);
              }}
            >
              <View style={[styles.recipientIconWrapper, recipientType === RECIPIENT_TYPES.SPECIFIC && styles.recipientIconWrapperActive]}>
                <Ionicons name="people-outline" size={22} color={recipientType === RECIPIENT_TYPES.SPECIFIC ? "#fff" : "#333"} />
              </View>
              <Text style={[styles.recipientText, recipientType === RECIPIENT_TYPES.SPECIFIC && styles.recipientTextActive]}>Belirli Kişiler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.recipientOption, recipientType === RECIPIENT_TYPES.PUBLIC && styles.recipientOptionActive]}
              onPress={() => setRecipientType(RECIPIENT_TYPES.PUBLIC)}
            >
              <View style={[styles.recipientIconWrapper, recipientType === RECIPIENT_TYPES.PUBLIC && styles.recipientIconWrapperActive]}>
                <Ionicons name="earth-outline" size={22} color={recipientType === RECIPIENT_TYPES.PUBLIC ? "#fff" : "#333"} />
              </View>
              <Text style={[styles.recipientText, recipientType === RECIPIENT_TYPES.PUBLIC && styles.recipientTextActive]}>Herkes</Text>
            </TouchableOpacity>
          </View>
          
          {/* Seçilen kişileri göster */}
          {recipientType === RECIPIENT_TYPES.SPECIFIC && specificRecipients.length > 0 && (
            <View style={styles.selectedRecipientsContainer}>
              <Text style={styles.selectedRecipientsTitle}>
                Seçilen Kişiler ({specificRecipients.length})
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.selectedRecipientsScroll}
              >
                {specificRecipients.map((recipient) => (
                  <View key={recipient.id} style={styles.recipientChip}>
                    {recipient.avatar ? (
                      <Image source={{ uri: recipient.avatar }} style={styles.recipientAvatar} />
                    ) : (
                      <View style={styles.recipientLetterAvatar}>
                        <Text style={styles.recipientLetterText}>
                          {recipient.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.recipientChipName}>{recipient.name}</Text>
                  </View>
                ))}
                <TouchableOpacity 
                  style={styles.editRecipientsButton}
                  onPress={() => setShowRecipientSelector(true)}
                >
                  <Ionicons name="pencil" size={16} color="#333" />
                  <Text style={styles.editRecipientsText}>Düzenle</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
        
        {/* İşlem butonları */}
        <View style={styles.formActions}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => setCapsuleType(null)}
            disabled={isSubmitting || resultMessage}
          >
            <Text style={styles.cancelButtonText}>Vazgeç</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.createButton, 
              (isSubmitting || resultMessage) && styles.createButtonDisabled
            ]}
            onPress={handleCreateCapsule}
            disabled={isSubmitting || resultMessage}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
            <Text style={styles.createButtonText}>Kapsülü Oluştur</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Kapsüllerim Tab İçeriği
  const renderMyCapsules = () => {
    // Sonuç overlay'ini oluşturalım (aynı formatı kullanabiliriz)
    const renderResultMessage = () => {
      if (!resultMessage) return null;
      
      return (
        <View style={[
          styles.resultOverlay,
          resultType === 'success' ? styles.successOverlay : styles.errorOverlay
        ]}>
          <View style={styles.resultIconContainer}>
            <Ionicons 
              name={resultType === 'success' ? 'checkmark-circle' : 'close-circle'} 
              size={60} 
              color="#fff" 
            />
          </View>
          
          <Text style={styles.resultMessage}>
            {resultType === 'success' ? 'Başarılı!' : 'Hata!'}
          </Text>
          
          <Text style={styles.resultMessage}>{resultMessage}</Text>
          
          {resultType === 'error' && (
            <TouchableOpacity 
              style={styles.resultButton}
              onPress={() => {
                setResultMessage(null);
                setResultType(null);
              }}
            >
              <Text style={styles.resultButtonText}>Tamam</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    };

    return (
      <View style={styles.myCapsuleContainer}>
        <Text style={styles.myCapsuleTitle}>Kapsüllerim</Text>
        
        {/* Filtreleme alanı */}
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterButton, capsuleFilter === 'all' && styles.activeFilterButton]}
            onPress={() => setCapsuleFilter('all')}
          >
            <Text style={capsuleFilter === 'all' ? styles.activeFilterText : styles.filterText}>
              Tümü
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, capsuleFilter === 'pending' && styles.activeFilterButton]}
            onPress={() => setCapsuleFilter('pending')}
          >
            <Text style={capsuleFilter === 'pending' ? styles.activeFilterText : styles.filterText}>
              Bekleyenler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, capsuleFilter === 'opened' && styles.activeFilterButton]}
            onPress={() => setCapsuleFilter('opened')}
          >
            <Text style={capsuleFilter === 'opened' ? styles.activeFilterText : styles.filterText}>
              Açılmış
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Sonuç mesajını göster */}
        {renderResultMessage()}
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>Kapsüller yükleniyor...</Text>
          </View>
        ) : capsules.length === 0 ? (
        <View style={styles.emptyCapsuleContainer}>
            <Ionicons name="hourglass-outline" size={60} color="#ccc" />
            <Text style={styles.emptyTitle}>
              {capsuleFilter === 'all' 
                ? 'Henüz Kapsülün Yok' 
                : capsuleFilter === 'pending' 
                  ? 'Bekleyen Kapsülün Yok' 
                  : 'Açılmış Kapsülün Yok'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {capsuleFilter === 'all' 
                ? 'İlk kapsülünü oluşturmak için "Yeni Kapsül" sekmesine geç' 
                : capsuleFilter === 'pending' 
                  ? 'Bekleyen kapsül oluşturmak için "Yeni Kapsül" sekmesine geç' 
                  : 'Henüz kapsül açılmamış. Koşulları sağlayan kapsüller burada görünecek'}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.capsulesList}>
            {capsules.map(capsule => (
              <TouchableOpacity 
                key={capsule.id} 
                style={styles.capsuleCard}
                onPress={() => handleViewCapsule(capsule)}
              >
                <View style={styles.capsuleCardHeader}>
                  <View style={[
                    styles.capsuleTypeIndicator, 
                    capsule.type === 'location' ? styles.locationIndicator : styles.timeIndicator
                  ]}>
                    <Ionicons 
                      name={capsule.type === 'location' ? 'location' : 'time'} 
                      size={16} 
                      color="#fff" 
                    />
        </View>
                  <Text style={styles.capsuleCardTitle}>{capsule.title}</Text>
                  
                  <View style={[
                    styles.capsuleStatusBadge, 
                    capsule.status === 'opened' ? styles.openedBadge : styles.pendingBadge
                  ]}>
                    <Text style={[
                      styles.capsuleStatusText,
                      capsule.status === 'opened' ? styles.openedStatusText : styles.pendingStatusText
                    ]}>
                      {capsule.status === 'opened' ? 'Açıldı' : 'Bekliyor'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.capsuleCardBody}>
                  {/* İçerik Previews */}
                  <View style={styles.contentPreviewRow}>
                    {capsule.contents && capsule.contents.length > 0 ? (
                      <View style={styles.contentTypeIcons}>
                        {capsule.contents.slice(0, 4).map((content, index) => (
                          <View 
                            key={index} 
                            style={[
                              styles.miniContentTypeIndicator,
                              content.type === 'text' ? { backgroundColor: '#3498db' } :
                              content.type === 'image' ? { backgroundColor: '#2ecc71' } :
                              content.type === 'video' ? { backgroundColor: '#9b59b6' } :
                              { backgroundColor: '#e74c3c' }
                            ]}
                          >
                            <Ionicons 
                              name={
                                content.type === 'text' ? 'chatbubble-outline' :
                                content.type === 'image' ? 'image-outline' :
                                content.type === 'video' ? 'videocam-outline' :
                                'musical-note-outline'
                              } 
                              size={12} 
                              color="#fff" 
                            />
                          </View>
                        ))}
                        {capsule.contents.length > 4 && (
                          <View style={styles.extraContentIndicator}>
                            <Text style={styles.extraContentText}>+{capsule.contents.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.noContentText}>İçerik bilgisi yok</Text>
                    )}
                  </View>
                  
                  {/* Kapsül Bilgileri */}
                  <View style={styles.capsuleDetailsRow}>
                    <View style={styles.capsuleDetailItem}>
                      <Ionicons 
                        name={capsule.type === 'location' ? 'navigate-outline' : 'alarm-outline'} 
                        size={16} 
                        color="#666" 
                      />
                      <Text style={styles.capsuleDetailText}>
                        {capsule.type === 'location' 
                          ? 'Konum kapsülü' 
                          : capsule.openDate && capsule.openDate.toDate
                            ? `Açılma: ${format(capsule.openDate.toDate(), 'd MMM yyyy', { locale: tr })}`
                            : 'Açılma tarihi yok'}
                      </Text>
                    </View>
                    
                    <View style={styles.capsuleDetailItem}>
                      <Ionicons 
                        name={
                          capsule.recipients === 'self' 
                            ? 'person-outline' 
                            : capsule.recipients === 'public' 
                              ? 'earth-outline' 
                              : 'people-outline'
                        } 
                        size={16} 
                        color="#666" 
                      />
                      <Text style={styles.capsuleDetailText}>
                        {capsule.recipients === 'self' 
                          ? 'Sadece ben' 
                          : capsule.recipients === 'public' 
                            ? 'Herkes' 
                            : capsule.recipientDetails && capsule.recipientDetails.length > 0
                              ? `${capsule.recipientDetails.length} kişi`
                              : 'Belirli kişiler'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Oluşturulma tarihi */}
                  <View style={styles.capsuleInfoRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.capsuleInfoText}>
                      {capsule.creationDate && capsule.creationDate.toDate
                        ? `Oluşturulma: ${format(capsule.creationDate.toDate(), 'd MMM yyyy', { locale: tr })}`
                        : 'Oluşturulma tarihi bilinmiyor'}
                    </Text>
                  </View>
                  
                  {/* Belirli kişilerin listesi gösterilsin (eğer varsa) */}
                  {capsule.recipients !== 'self' && capsule.recipients !== 'public' && 
                   capsule.recipientDetails && capsule.recipientDetails.length > 0 && (
                    <View style={styles.recipientsPreviewContainer}>
                      <Text style={styles.recipientsPreviewLabel}>Alıcılar:</Text>
                      <View style={styles.recipientsChipContainer}>
                        {capsule.recipientDetails.slice(0, 3).map((recipient, index) => (
                          <View key={index} style={styles.miniRecipientChip}>
                            {recipient.avatar ? (
                              <Image source={{ uri: recipient.avatar }} style={styles.miniRecipientAvatar} />
                            ) : (
                              <View style={styles.miniRecipientLetterAvatar}>
                                <Text style={styles.miniRecipientLetterText}>
                                  {recipient.name?.charAt(0).toUpperCase() || '?'}
                                </Text>
                              </View>
                            )}
                            <Text style={styles.miniRecipientName} numberOfLines={1}>
                              {recipient.name}
                            </Text>
                          </View>
                        ))}
                        {capsule.recipientDetails.length > 3 && (
                          <View style={styles.miniRecipientMore}>
                            <Text style={styles.miniRecipientMoreText}>+{capsule.recipientDetails.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
                
                {/* Kapsül kontrolleri (eğer bekleyen kapsül ise) */}
                {capsule.status === 'pending' && (
                  <View style={styles.capsuleActions}>
                    <TouchableOpacity 
                      style={styles.capsuleActionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteCapsule(capsule);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                      <Text style={[styles.capsuleActionText, { color: '#e74c3c' }]}>Sil</Text>
                    </TouchableOpacity>
                    
                    {capsule.type === 'time' && (
                      <View style={styles.timeRemainingBadge}>
                        <Ionicons name="time-outline" size={14} color="#3498db" />
                        <Text style={styles.timeRemainingText}>
                          {formatRemainingTime(capsule.openDate?.toDate())}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };
  
  // Kalan süreyi formatla
  const formatRemainingTime = (date) => {
    if (!date) return 'Tarih yok';
    
    const now = new Date();
    const diffMs = date - now;
    
    if (diffMs <= 0) return 'Açılma zamanı geldi';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays > 365) {
      const years = Math.floor(diffDays / 365);
      return `${years} yıl kaldı`;
    } else if (diffDays > 30) {
      const months = Math.floor(diffDays / 30);
      return `${months} ay kaldı`;
    } else if (diffDays > 0) {
      return `${diffDays} gün kaldı`;
    } else {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      return diffHours > 0 ? `${diffHours} saat kaldı` : 'Çok az kaldı';
    }
  };
  
  // Kapsül detaylarını görüntüle
  const handleViewCapsule = (capsule) => {
    if (capsule.status === 'opened') {
      // Kapsül açılmışsa, içeriğini göster
      // Bu kısım için ayrı bir modal veya ekran gerekebilir
      Alert.alert(
        `${capsule.title}`,
        `Bu kapsül açıldı ve içeriği görüntülenebilir.\n\nİçerik: ${capsule.contents?.length || 0} öğe\n`,
        [{ text: 'Tamam' }]
      );
    } else {
      // Kapsül henüz açılmamışsa, bilgilerini göster
      const openInfo = capsule.type === 'time'
        ? `Bu kapsül ${capsule.openDate && capsule.openDate.toDate 
            ? format(capsule.openDate.toDate(), 'd MMMM yyyy', { locale: tr }) 
            : 'belirtilen tarihte'} açılacak.`
        : `Bu kapsül belirtilen konuma ulaşıldığında açılabilecek. Konum yarıçapı: ${capsule.location?.radius || 100}m.`;
      
      const recipientsInfo = capsule.recipients === 'self' 
        ? 'Bu kapsülü sadece siz açabilirsiniz.' 
        : capsule.recipients === 'public' 
          ? 'Bu kapsülü herkes açabilir. Koşullar sağlandığında kapsül herkese açık olacak.'
          : capsule.recipientDetails && capsule.recipientDetails.length > 0
            ? `Bu kapsülü belirli kişiler açabilir (${capsule.recipientDetails.length} kişi): ${capsule.recipientDetails.slice(0, 3).map(r => r.name).join(', ')}${capsule.recipientDetails.length > 3 ? ` ve ${capsule.recipientDetails.length - 3} kişi daha...` : ''}`
            : 'Bu kapsülü belirlediğiniz kişiler açabilir.';
            
      const notificationInfo = 'Koşullar sağlandığında alıcılar kapsülün açılabilir olduğuna dair bildirim alacaklar.';
      
      Alert.alert(
        capsule.title,
        `${openInfo}\n\n${recipientsInfo}\n\n${notificationInfo}\n\nİçerik: ${capsule.contents?.length || 0} öğe\nOluşturulma: ${
          capsule.creationDate && capsule.creationDate.toDate 
            ? format(capsule.creationDate.toDate(), 'd MMMM yyyy', { locale: tr }) 
            : 'Tarih bilinmiyor'
        }`,
        [{ text: 'Tamam' }]
      );
    }
  };
  
  // Kapsül silme
  const handleDeleteCapsule = (capsule) => {
    Alert.alert(
      'Kapsülü Sil',
      `"${capsule.title}" kapsülünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      [
        { 
          text: 'İptal', 
          style: 'cancel' 
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await capsuleService.deleteCapsule(capsule.id);
              
              // Toast yerine durum mesajını kullanalım
              setResultMessage(`"${capsule.title}" kapsülü başarıyla silindi.`);
              setResultType('success');
              
              // 2 saniye sonra kapsülleri yenile ve mesajı kaldır
              setTimeout(() => {
                setResultMessage(null);
                setResultType(null);
                // Kapsülleri yeniden yükle
                fetchUserCapsules();
              }, 2000);
            } catch (error) {
              console.error('Kapsül silme hatası:', error);
              
              // Toast yerine durum mesajını kullanalım
              setResultMessage('Kapsül silinemedi. Lütfen tekrar deneyin.');
              setResultType('error');
              
              // 3 saniye sonra hata mesajını kaldır
              setTimeout(() => {
                setResultMessage(null);
                setResultType(null);
              }, 3000);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Tab içeriğini render etme
  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.CREATE:
        return renderCreateTab();
      case TABS.MY_CAPSULES:
        return renderMyCapsules();
      default:
        return null;
    }
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalOverlayTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={styles.modalContainer}>
          {/* Modal Handle */}
          <View style={styles.modalHandleContainer}>
            <TouchableOpacity onPress={onClose}>
              <View style={styles.modalHandle} />
            </TouchableOpacity>
          </View>
          
          {/* Tab Bar */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === TABS.CREATE && styles.activeTabButton]}
              onPress={() => setActiveTab(TABS.CREATE)}
            >
              <Text style={[styles.tabText, activeTab === TABS.CREATE && styles.activeTabText]}>
                Yeni Kapsül
              </Text>
              {activeTab === TABS.CREATE && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tabButton, activeTab === TABS.MY_CAPSULES && styles.activeTabButton]}
              onPress={() => setActiveTab(TABS.MY_CAPSULES)}
            >
              <Text style={[styles.tabText, activeTab === TABS.MY_CAPSULES && styles.activeTabText]}>
                Kapsüllerim
              </Text>
              {activeTab === TABS.MY_CAPSULES && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          </View>
          
          {/* Tab İçerikleri */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
          >
            {renderTabContent()}
          </ScrollView>
        </View>
      </View>
      
      {/* Metin Girişi Modalı */}
      <Modal
        visible={showTextInputModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTextInputModal(false)}
      >
        <View style={styles.textInputModalOverlay}>
          <View style={styles.textInputModalContainer}>
            <View style={styles.textInputModalHeader}>
              <Text style={styles.textInputModalTitle}>Metin Mesajı Ekle</Text>
              <TouchableOpacity
                style={styles.textInputModalCloseButton}
                onPress={() => setShowTextInputModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.textInputModalInput}
              placeholder="Mesajınızı buraya yazın..."
              placeholderTextColor="#999"
              multiline
              value={textInputContent}
              onChangeText={setTextInputContent}
              autoFocus
            />
            
            <View style={styles.textInputModalActions}>
              <TouchableOpacity
                style={styles.textInputModalCancelButton}
                onPress={() => setShowTextInputModal(false)}
              >
                <Text style={styles.textInputModalCancelText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.textInputModalConfirmButton}
                onPress={handleConfirmTextInput}
              >
                <Text style={styles.textInputModalConfirmText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
    </Modal>
      
      {/* Konum Seçme Modalı */}
      <Modal
        visible={showLocationPicker}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <SafeAreaView style={styles.locationPickerContainer}>
          <View style={styles.locationPickerHeader}>
            <TouchableOpacity
              style={styles.locationPickerBackButton}
              onPress={() => setShowLocationPicker(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            
            <Text style={styles.locationPickerTitle}>Konum Seç</Text>
            
            <TouchableOpacity
              style={styles.locationPickerConfirmButton}
              onPress={handleConfirmLocation}
              disabled={!selectedLocation}
            >
              <Text style={[
                styles.locationPickerConfirmText,
                !selectedLocation && { color: '#ccc' }
              ]}>
                Tamam
              </Text>
            </TouchableOpacity>
          </View>
          
          {hasLocationPermission ? (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.mapView}
                initialRegion={userLocation ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                } : {
                  latitude: 41.0082, // İstanbul
                  longitude: 28.9784,
                  latitudeDelta: 0.1,
                  longitudeDelta: 0.1,
                }}
                onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
              >
                {selectedLocation && (
                  <>
                    <Marker
                      coordinate={selectedLocation}
                      draggable
                      onDragEnd={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
                    />
                    <Circle
                      center={selectedLocation}
                      radius={locationRadius}
                      fillColor="rgba(52, 152, 219, 0.2)"
                      strokeColor="rgba(52, 152, 219, 0.5)"
                    />
                  </>
                )}
                
                {userLocation && (
                  <Marker
                    coordinate={userLocation}
                    pinColor="blue"
                    title="Şu anki konumunuz"
                  />
                )}
              </MapView>
            </View>
          ) : (
            <View style={styles.locationPermissionContainer}>
              <Ionicons name="location-off" size={64} color="#e74c3c" />
              <Text style={styles.locationPermissionTitle}>Konum İzni Gerekli</Text>
              <Text style={styles.locationPermissionText}>
                Konum kapsülü oluşturmak için cihazınızın konum bilgisine erişim izni vermeniz gerekmektedir.
              </Text>
              <TouchableOpacity
                style={styles.locationPermissionButton}
                onPress={checkPermissions}
              >
                <Text style={styles.locationPermissionButtonText}>İzin Ver</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {hasLocationPermission && (
            <View style={styles.locationPickerControls}>
              <Text style={styles.locationPickerHelpText}>
                {selectedLocation ? 'Konum seçildi. İsterseniz işaretçiyi sürükleyebilirsiniz.' : 'Haritaya dokunarak konum seçin.'}
              </Text>
              
              {userLocation && !selectedLocation && (
                <TouchableOpacity
                  style={styles.useCurrentLocationButton}
                  onPress={() => setSelectedLocation(userLocation)}
                >
                  <Ionicons name="locate" size={20} color="#fff" />
                  <Text style={styles.useCurrentLocationText}>Mevcut Konumumu Kullan</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </SafeAreaView>
      </Modal>
      
      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.datePickerModalOverlay}>
            <CustomDatePicker
              selectedDate={openDate || new Date()}
              onDateChange={(date) => setOpenDate(date)}
              onConfirm={(date) => {
                setOpenDate(date);
                setShowDatePicker(false);
              }}
              onCancel={() => setShowDatePicker(false)}
            />
          </View>
        </Modal>
      )}
      
      <RecipientSelector
        visible={showRecipientSelector}
        onClose={() => setShowRecipientSelector(false)}
        onSelectRecipients={(recipients) => {
          setSpecificRecipients(recipients);
          setShowRecipientSelector(false);
        }}
        initialRecipients={specificRecipients}
      />
    </Modal>
  );
};

export default CapsuleModal; 