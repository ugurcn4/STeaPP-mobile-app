import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    Dimensions,
    ActivityIndicator,
    Modal
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../../firebaseConfig';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { translate } from '../../i18n/i18n';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 50;

const MaviTikSorgulamaPage = ({ navigation }) => {
    const theme = useSelector((state) => state.theme.theme);
    const userRedux = useSelector((state) => state.user);
    const [selectedType, setSelectedType] = useState(null);
    const [fullName, setFullName] = useState('');
    const [selectedTitle, setSelectedTitle] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [showTitleModal, setShowTitleModal] = useState(false);
    const [reason, setReason] = useState('');
    const [hasAttachedID, setHasAttachedID] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [userEmail, setUserEmail] = useState('');
    const [priorityStatus, setPriorityStatus] = useState(null);
    const [activeCardIndex, setActiveCardIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const autoScrollTimer = useRef(null);
    const manualScrollTimeout = useRef(null);
    const [applicationStatus, setApplicationStatus] = useState(null);

    const bannerCards = [
        {
            id: '1',
            title: translate('verify_account'),
            description: translate('verify_account_desc'),
            backgroundColor: '#E6F2FF',
            iconName: 'shield-checkmark',
            iconColor: '#1E90FF'
        },
        {
            id: '2',
            title: translate('special_first_250'),
            description: translate('special_first_250_desc'),
            backgroundColor: '#FFF4E6',
            iconName: 'star',
            iconColor: '#FF9500'
        }
    ];

    const flatListRef = useRef(null);

    // Unvan seçenekleri
    const titles = [
        { id: '1', name: 'Sanatçı' },
        { id: '2', name: 'Müzisyen' },
        { id: '3', name: 'Yazar' },
        { id: '4', name: 'Gazeteci' },
        { id: '5', name: 'Sosyal Medya Fenomeni' },
        { id: '6', name: 'Akademisyen' },
        { id: '7', name: 'Doktor' },
        { id: '8', name: 'Sporcu' },
        { id: '9', name: 'İş İnsanı' },
        { id: '10', name: 'Politikacı' },
        { id: '11', name: 'Avukat' },
        { id: '12', name: 'Mühendis' },
        { id: '13', name: 'Mimar' },
        { id: '14', name: 'Oyuncu' },
        { id: '15', name: 'Seslendirme Sanatçısı' },
        { id: '16', name: 'Yönetmen' },
        { id: '17', name: 'Prodüktör' },
        { id: '18', name: 'Şef' },
        { id: '19', name: 'Dizi/Film Yapımcısı' },
        { id: '20', name: 'Dijital İçerik Üreticisi' },
        { id: '21', name: 'YouTuber' },
        { id: '22', name: 'Gezgin/Seyahat İçerik Üreticisi' },
        { id: '23', name: 'E-Spor Oyuncusu' },
        { id: '24', name: 'Podcast Yapımcısı' },
        { id: '25', name: 'Eğitmen/Mentor' },
        { id: '26', name: 'Dansçı' },
        { id: '27', name: 'Fotoğrafçı' },
        { id: '28', name: 'Grafik Tasarımcısı' },
        { id: '29', name: 'Moda Tasarımcısı' },
        { id: '30', name: 'Makyaj Sanatçısı' },
        { id: '31', name: 'Fitness Eğitmeni' },
        { id: '32', name: 'Beslenme Uzmanı' },
        { id: '33', name: 'Psikolog' },
        { id: '34', name: 'Yemek Şefi' },
        { id: '35', name: 'Gurme/Yemek Eleştirmeni' },
        { id: '36', name: 'Teknoloji İncelemecisi' },
        { id: '37', name: 'Oyun İncelemecisi' },
        { id: '38', name: 'Karikatürist' },
        { id: '39', name: 'Radyo Programcısı' },
        { id: '40', name: 'DJ' },
        { id: '41', name: 'Köşe Yazarı' },
        { id: '42', name: 'Astroloji Uzmanı' },
        { id: '43', name: 'Yaşam Koçu' },
        { id: '44', name: 'Aktivist' },
        { id: '45', name: 'Dernek/Vakıf Yöneticisi' },
        { id: '46', name: 'Influencer' },
        { id: '47', name: 'Diğer' }
    ];

    // Arama sonuçlarını filtrele
    const filteredTitles = searchText
        ? titles.filter(title => title.name.toLowerCase().includes(searchText.toLowerCase()))
        : titles;

    // Otomatik kaydırma için timer'ı başlat
    useEffect(() => {
        startAutoScroll();

        return () => {
            // Sayfa unmount edildiğinde timer'ı temizle
            if (autoScrollTimer.current) {
                clearInterval(autoScrollTimer.current);
            }
            if (manualScrollTimeout.current) {
                clearTimeout(manualScrollTimeout.current);
            }
        };
    }, []);

    // Aktif kart indexi değiştiğinde otomatik kaydırma işlemi
    useEffect(() => {
        // Kullanıcı manuel kaydırma yaparsa, autoScroll false olacak
        // Bu durumda bir şey yapmadan dön
        if (!autoScroll) return;

        // Timer devam ediyor olabilir, sıfırlayalım
        if (autoScrollTimer.current) {
            clearInterval(autoScrollTimer.current);
        }

        // Yeni timer başlat
        startAutoScroll();
    }, [activeCardIndex, autoScroll]);

    const startAutoScroll = () => {
        if (autoScrollTimer.current) {
            clearInterval(autoScrollTimer.current);
        }

        autoScrollTimer.current = setInterval(() => {
            if (autoScroll && flatListRef.current) {
                // Sıradaki kartın indexini hesapla (döngüsel)
                const nextIndex = (activeCardIndex + 1) % bannerCards.length;

                // FlatList'i sıradaki karta kaydır
                flatListRef.current.scrollToIndex({
                    animated: true,
                    index: nextIndex,
                    viewOffset: 0
                });

                // Aktif kart indexini güncelle
                setActiveCardIndex(nextIndex);
            }
        }, 2000); // 2 saniyede bir otomatik kaydırma
    };

    // AsyncStorage'dan kullanıcı bilgilerini al
    const getUserDataFromStorage = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
                const userData = JSON.parse(userDataString);

                if (userData.user && userData.user.email) {
                    setUserEmail(userData.user.email);
                    return userData.user;
                }
            }
            return null;
        } catch (error) {
            console.error("AsyncStorage'dan kullanıcı bilgisi alınamadı:", error);
            return null;
        }
    };

    // Kullanıcı bilgilerini Redux ve AsyncStorage'dan alma
    useEffect(() => {
        const fetchUserData = async () => {
            // İlk olarak Redux store'dan kontrol et
            if (userRedux && userRedux.user) {
                setCurrentUser(userRedux.user);

                if (userRedux.user.email) {
                    setUserEmail(userRedux.user.email);

                    // Kullanıcının mevcut başvurularını kontrol et
                    await checkExistingApplications(userRedux.user.email);
                    return;
                }
            }

            // Redux'ta yoksa AsyncStorage'dan almayı dene
            const userData = await getUserDataFromStorage();
            if (userData) {
                setCurrentUser(userData);
                if (userData.email) {
                    // Kullanıcının mevcut başvurularını kontrol et
                    await checkExistingApplications(userData.email);
                }
            } else {
                // Son çare: Firebase auth'dan mevcut kullanıcıyı al
                const auth = getAuth();
                const user = auth.currentUser;
                if (user) {
                    setCurrentUser(user);
                    setUserEmail(user.email);

                    // Kullanıcının mevcut başvurularını kontrol et
                    await checkExistingApplications(user.email);
                }
            }
        };

        fetchUserData();
    }, [userRedux]);

    // Kullanıcının mevcut başvurularını kontrol eden fonksiyon
    const checkExistingApplications = async (email) => {
        try {
            const blueTickRef = collection(db, 'blue_tick');

            // Kullanıcının tüm başvurularını al
            const userApplicationsQuery = query(
                blueTickRef,
                where("email", "==", email)
            );

            const userApplicationsSnapshot = await getDocs(userApplicationsQuery);

            if (userApplicationsSnapshot.empty) {
                // Hiç başvuru yok
                setApplicationStatus(null);
                return;
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

            setApplicationStatus({
                pendingBlue,
                pendingGreen,
                approvedBlue,
                approvedGreen,
                rejectedApplications,
                totalApplications: userApplicationsSnapshot.size
            });

        } catch (error) {
            console.error("Başvuru durumu kontrol hatası:", error);
        }
    };

    const handleBack = () => {
        navigation.goBack();
    };

    // Kullanıcının kayıt sırasını Firebase'den kontrol et
    const checkUserRegistrationRank = async (email) => {
        try {
            setLoading(true);

            // Arama için e-posta alanını normalleştir
            const normalizedEmail = email.toLowerCase().trim();

            // Belirli bir e-posta adresiyle kullanıcıyı Firebase'de bul
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where("informations.email", "==", normalizedEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return { found: false, message: 'Kullanıcı bulunamadı' };
            }

            // Kullanıcı belgesini al
            const userDoc = querySnapshot.docs[0];
            const userId = userDoc.id;
            const userData = userDoc.data();

            // Kullanıcının Firestore'daki oluşturulma zamanını al
            const createdAt = userData.createdAt;

            if (!createdAt) {
                return {
                    found: true,
                    isInFirst250: false,
                    rank: 999,
                    message: 'Kullanıcı zamanı bulunamadı'
                };
            }

            // Tüm kullanıcıları oluşturulma tarihine göre sırala
            const allUsersQuery = query(
                usersRef,
                orderBy("createdAt", "asc")
            );

            const allUsersSnapshot = await getDocs(allUsersQuery);

            // Kullanıcının sırasını bul
            let userRank = 0;
            for (let i = 0; i < allUsersSnapshot.docs.length; i++) {
                if (allUsersSnapshot.docs[i].id === userId) {
                    userRank = i + 1; // Sıralama 1'den başlar
                    break;
                }
            }

            const isInFirst250 = userRank <= 250;
            
            // Dil çevirisini manuel olarak oluştur
            let message = '';
            if (isInFirst250) {
                message = `Kaydınız ${userRank}. sırada. Ücretsiz mavi tik veya yeşil tik için başvurunuzu tamamlayın.`;
            } else {
                message = `Kaydınız ${userRank}. sırada. Yine de mavi tik veya yeşil tik başvurusu yapabilirsiniz.`;
            }

            return {
                found: true,
                isInFirst250,
                rank: userRank,
                message: message
            };

        } catch (error) {
            console.error("Kayıt sırası kontrolünde hata:", error);
            return {
                found: false,
                message: 'Kayıt sırası kontrolünde hata'
            };
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        // Form doğrulama kontrolleri
        if (!selectedType) {
            Alert.alert('Hata', 'Lütfen doğrulama tipini seçiniz');
            return;
        }

        if (!fullName.trim()) {
            Alert.alert('Hata', 'Lütfen tam adınızı giriniz');
            return;
        }

        if (!selectedTitle) {
            Alert.alert('Hata', 'Lütfen bir unvan seçiniz');
            return;
        }

        if (!reason.trim()) {
            Alert.alert('Hata', 'Lütfen doğrulama sebebinizi belirtiniz');
            return;
        }

        try {
            setLoading(true);

            // Kullanıcı bilgisini al
            const auth = getAuth();
            const user = auth.currentUser;
            const userID = user ? user.uid : null;

            if (!userID) {
                Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.');
                setLoading(false);
                return;
            }

            // Aynı e-posta ve doğrulama tipiyle mevcut başvuru var mı kontrol et
            const blueTickRef = collection(db, 'blue_tick');

            // Bekleyen başvuruları kontrol et
            const pendingApplicationQuery = query(
                blueTickRef,
                where("email", "==", userEmail),
                where("verificationType", "==", selectedType),
                where("status", "==", "pending")
            );
            const pendingApplicationSnapshot = await getDocs(pendingApplicationQuery);

            // Onaylanmış başvuruları kontrol et
            const approvedApplicationQuery = query(
                blueTickRef,
                where("email", "==", userEmail),
                where("verificationType", "==", selectedType),
                where("status", "==", "approved")
            );
            const approvedApplicationSnapshot = await getDocs(approvedApplicationQuery);

            // Eğer aynı tip için bekleyen bir başvuru varsa engelle
            if (!pendingApplicationSnapshot.empty) {
                setLoading(false);
                Alert.alert(
                    'Bekleyen Başvuru Mevcut',
                    `${selectedType === 'blue' ? 'Mavi' : 'Yeşil'} tik için zaten incelenen bir başvurunuz bulunmaktadır. Mevcut başvurunuzun sonuçlanmasını bekleyiniz.`,
                    [{ text: 'Tamam' }]
                );
                return;
            }

            // Eğer aynı tip için onaylanmış bir başvuru varsa engelle
            if (!approvedApplicationSnapshot.empty) {
                setLoading(false);
                Alert.alert(
                    'Onaylanmış Başvuru Mevcut',
                    `${selectedType === 'blue' ? 'Mavi' : 'Yeşil'} tik başvurunuz zaten onaylanmış durumda. Profiliniz onaylı olarak işaretlenmiştir.`,
                    [{ text: 'Tamam' }]
                );
                return;
            }

            // Firebase Storage ve Firestore'a bağlan
            const storage = getStorage();
            let fileDownloadURL = null;

            // Dosya varsa yükle
            if (selectedFile) {
                try {
                    // Dosya adını benzersiz yap
                    const timestamp = new Date().getTime();
                    const fileExtension = selectedFile.name.split('.').pop();
                    const fileName = `${userID}_${timestamp}.${fileExtension}`;

                    // Storage referansı oluştur
                    const fileStorageRef = storageRef(storage, `ek_belgeler/${fileName}`);

                    // Dosyayı fetch ile al
                    const response = await fetch(selectedFile.uri);
                    const blob = await response.blob();

                    // Dosyayı yükle
                    await uploadBytesResumable(fileStorageRef, blob);

                    // Dosya URL'ini al
                    fileDownloadURL = await getDownloadURL(fileStorageRef);
                } catch (error) {
                    console.error("Dosya yükleme hatası:", error);
                    Alert.alert(
                        'Uyarı',
                        'Dosya yüklenirken bir hata oluştu, ancak başvurunuz devam edecek.',
                        [{ text: 'Tamam' }]
                    );
                }
            }

            // Firestore'a veri ekle
            const submissionData = {
                userID: userID,
                fullName: fullName,
                email: userEmail,
                verificationType: selectedType,
                title: selectedTitle.name,
                titleID: selectedTitle.id,
                reason: reason,
                status: 'pending', // İnceleme durumu (pending, approved, rejected)
                fileURL: fileDownloadURL,
                fileName: selectedFile ? selectedFile.name : null,
                fileType: selectedFile ? selectedFile.type : null,
                submitDate: serverTimestamp(),
                reviewDate: null,
                reviewerID: null,
                reviewNote: null,
            };

            // Firestore'a başvuruyu ekle
            const docRef = await addDoc(blueTickRef, submissionData);

            setLoading(false);

            // Başarılı başvuru bildirimi
            Alert.alert(
                'Başvurunuz Alındı',
                'Profil doğrulama başvurunuz başarıyla kaydedilmiştir. İnceleme sonrası size bildirim gönderilecektir.',
                [{ text: 'Tamam', onPress: () => navigation.goBack() }]
            );

        } catch (error) {
            setLoading(false);
            console.error('Başvuru gönderme hatası:', error);
            Alert.alert(
                'Hata',
                'Başvurunuz gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
                [{ text: 'Tamam' }]
            );
        }
    };

    const attachFile = async () => {
        try {
            // Dosya seçme işlemi
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'image/jpeg',
                    'image/png',
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ],
                copyToCacheDirectory: true,
            });

            // Kullanıcı seçim yaptı mı kontrol et
            if (result.canceled) {
                return;
            }

            const fileInfo = result.assets[0];

            // Dosya boyutunu kontrol et (byte cinsinden)
            const fileStats = await FileSystem.getInfoAsync(fileInfo.uri);
            const fileSize = fileStats.size;

            if (fileSize > 1048576) { // 1MB = 1048576 bytes
                Alert.alert(
                    'Hata',
                    'Dosya boyutu 1MB\'ı aşıyor. Lütfen daha küçük bir dosya seçin.',
                    [{ text: 'Tamam' }]
                );
                return;
            }

            // Dosya uzantısını kontrol et
            const fileExtension = fileInfo.name.split('.').pop().toLowerCase();
            const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];

            if (!allowedExtensions.includes(fileExtension)) {
                Alert.alert(
                    'Desteklenmeyen Dosya Formatı',
                    'Lütfen JPG, PNG, PDF veya DOCX formatında bir dosya seçin.',
                    [{ text: 'Tamam' }]
                );
                return;
            }

            // Seçilen dosya bilgisini kaydet
            setSelectedFile({
                name: fileInfo.name,
                size: fileSize,
                type: fileInfo.mimeType,
                uri: fileInfo.uri
            });

            setHasAttachedID(true);
            Alert.alert('Başarılı', `"${fileInfo.name}" belgesi başarıyla yüklendi`);

        } catch (error) {
            console.error('Dosya seçme hatası:', error);
            Alert.alert(
                'Hata',
                'Dosya seçilirken bir hata oluştu. Lütfen tekrar deneyin.',
                [{ text: 'Tamam' }]
            );
        }
    };

    // Dosya boyutunu okunabilir formata dönüştüren fonksiyon
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    };

    // Dosya tipini simge ile temsil eden bileşen
    const FileTypeIcon = ({ fileType }) => {
        if (fileType && fileType.includes('image')) {
            return <Ionicons name="image" size={22} color="#1E90FF" />;
        } else if (fileType && fileType.includes('pdf')) {
            return <Ionicons name="document-text" size={22} color="#FF3B30" />;
        } else if (fileType && (fileType.includes('word') || fileType.includes('document'))) {
            return <Ionicons name="document" size={22} color="#007AFF" />;
        } else {
            return <Ionicons name="document" size={22} color="#8E8E93" />;
        }
    };

    // Dosyayı kaldır
    const removeFile = () => {
        Alert.alert(
            'Dosyayı Kaldır',
            'Yüklenen dosyayı kaldırmak istediğinize emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Kaldır',
                    style: 'destructive',
                    onPress: () => {
                        setSelectedFile(null);
                        setHasAttachedID(false);
                    }
                }
            ]
        );
    };

    const checkPriorityStatus = async () => {
        if (!userEmail.trim()) {
            Alert.alert('Hata', 'Lütfen e-posta adresinizi giriniz');
            return;
        }

        if (!userEmail.includes('@') || !userEmail.includes('.')) {
            Alert.alert('Hata', 'Lütfen geçerli bir e-posta adresi giriniz');
            return;
        }

        // Firebase'den kullanıcının sıralamasını kontrol et
        const result = await checkUserRegistrationRank(userEmail);

        if (!result.found) {
            Alert.alert('Bilgi', result.message);
            return;
        }

        setPriorityStatus({
            isInFirst250: result.isInFirst250,
            userNumber: result.rank,
            message: result.message
        });
    };

    // Kart kaydırma olayını yakalayarak aktif kartı güncelle
    const handleScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const currentIndex = Math.round(contentOffsetX / (CARD_WIDTH + 15));

        if (currentIndex !== activeCardIndex) {
            // Aktif kart değiştiğinde otomatik kaydırmayı durdur
            setAutoScroll(false);
            setActiveCardIndex(currentIndex);

            // Kullanıcı kaydırmayı bıraktıktan 2 saniye sonra otomatik kaydırmayı yeniden başlat
            if (manualScrollTimeout.current) {
                clearTimeout(manualScrollTimeout.current);
            }

            manualScrollTimeout.current = setTimeout(() => {
                setAutoScroll(true);
            }, 2000);
        }
    };

    // Kartlara dokunulduğunda otomatik kaydırmayı durdur
    const handleCardPress = () => {
        setAutoScroll(false);

        // 2 saniye sonra yeniden başlat
        if (manualScrollTimeout.current) {
            clearTimeout(manualScrollTimeout.current);
        }

        manualScrollTimeout.current = setTimeout(() => {
            setAutoScroll(true);
        }, 2000);
    };

    // Unvan seçimi için renderItem fonksiyonu
    const renderTitleItem = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.titleItem,
                selectedTitle?.id === item.id && styles.selectedTitleItem
            ]}
            onPress={() => {
                setSelectedTitle(item);
                setShowTitleModal(false);
            }}
        >
            <Text style={[
                styles.titleItemText,
                selectedTitle?.id === item.id && styles.selectedTitleItemText
            ]}>
                {item.name}
            </Text>
        </TouchableOpacity>
    );

    const renderBannerCard = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleCardPress}
        >
            <View style={[styles.bannerCard, { backgroundColor: item.backgroundColor, width: CARD_WIDTH }]}>
                <View style={styles.bannerTextContainer}>
                    <Text style={styles.bannerTitle}>{item.title}</Text>
                    <Text style={styles.bannerSubtitle}>
                        {item.description}
                    </Text>
                </View>
                <View style={styles.bannerImageContainer}>
                    <Ionicons name={item.iconName} size={60} color={item.iconColor} />
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{translate('profile_verification')}</Text>
                    <View style={styles.placeholderRight} />
                </View>

                <ScrollView style={styles.scrollView}>
                    {/* Mevcut Başvuru Durumu */}
                    {applicationStatus && (applicationStatus.pendingBlue || applicationStatus.pendingGreen ||
                        applicationStatus.approvedBlue || applicationStatus.approvedGreen || applicationStatus.rejectedApplications > 0) && (
                            <View style={styles.applicationStatusContainer}>
                                <View style={styles.applicationStatusHeader}>
                                    <Ionicons name="information-circle" size={24} color="#1E90FF" />
                                    <Text style={styles.applicationStatusTitle}>{translate('current_application_status')}</Text>
                                </View>

                                {applicationStatus.pendingBlue && (
                                    <View style={[styles.statusItem, { borderLeftColor: '#FF9500' }]}>
                                        <Ionicons name="time-outline" size={20} color="#FF9500" />
                                        <Text style={styles.statusText}>
                                            {translate('blue_pending')}
                                        </Text>
                                    </View>
                                )}

                                {applicationStatus.pendingGreen && (
                                    <View style={[styles.statusItem, { borderLeftColor: '#FF9500' }]}>
                                        <Ionicons name="time-outline" size={20} color="#FF9500" />
                                        <Text style={styles.statusText}>
                                            {translate('green_pending')}
                                        </Text>
                                    </View>
                                )}

                                {applicationStatus.approvedBlue && (
                                    <View style={[styles.statusItem, { borderLeftColor: '#32CD32' }]}>
                                        <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
                                        <Text style={styles.statusText}>
                                            {translate('blue_approved')}
                                        </Text>
                                    </View>
                                )}

                                {applicationStatus.approvedGreen && (
                                    <View style={[styles.statusItem, { borderLeftColor: '#32CD32' }]}>
                                        <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
                                        <Text style={styles.statusText}>
                                            {translate('green_approved')}
                                        </Text>
                                    </View>
                                )}

                                {applicationStatus.rejectedApplications > 0 && (
                                    <View style={[styles.statusItem, { borderLeftColor: '#FF3B30' }]}>
                                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                                        <Text style={styles.statusText}>
                                            {applicationStatus.rejectedApplications} {translate('rejected_applications')}
                                            {!applicationStatus.pendingBlue && !applicationStatus.pendingGreen ?
                                                ` ${translate('can_apply_again')}` : ''}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                    {/* Yatay Kaydırılabilir Banner Kartları */}
                    <View style={styles.bannerContainer}>
                        <FlatList
                            ref={flatListRef}
                            data={bannerCards}
                            renderItem={renderBannerCard}
                            keyExtractor={item => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            pagingEnabled
                            snapToInterval={CARD_WIDTH + 15}
                            decelerationRate="fast"
                            contentContainerStyle={styles.flatListContainer}
                            onScroll={handleScroll}
                            scrollEventThrottle={16}
                            onScrollBeginDrag={() => setAutoScroll(false)}
                            onMomentumScrollEnd={() => {
                                // Kaydırma tamamlandığında 2 saniye sonra otomatik kaydırmayı başlat
                                if (manualScrollTimeout.current) {
                                    clearTimeout(manualScrollTimeout.current);
                                }

                                manualScrollTimeout.current = setTimeout(() => {
                                    setAutoScroll(true);
                                }, 2000);
                            }}
                        />
                        <View style={styles.paginationContainer}>
                            {bannerCards.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.paginationDot,
                                        index === activeCardIndex && styles.activePaginationDot
                                    ]}
                                />
                            ))}
                        </View>
                    </View>

                    {/* Öncelik Durumu Sorgulama */}
                    <View style={styles.priorityCheckContainer}>
                        <Text style={styles.priorityCheckTitle}>{translate('first_250_check')}</Text>
                        <Text style={styles.priorityCheckDescription}>
                            {translate('first_250_check_desc')}
                        </Text>

                        <View style={styles.priorityCheckForm}>
                            <TextInput
                                style={styles.priorityCheckInput}
                                placeholder={translate('enter_email')}
                                value={userEmail}
                                onChangeText={setUserEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={[
                                    styles.priorityCheckButton,
                                    loading && styles.disabledButton
                                ]}
                                onPress={checkPriorityStatus}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.priorityCheckButtonText}>{translate('check')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {priorityStatus && (
                            <View style={[
                                styles.priorityStatusContainer,
                                priorityStatus.isInFirst250 ? styles.priorityStatusSuccess : styles.priorityStatusFail
                            ]}>
                                <Ionicons
                                    name={priorityStatus.isInFirst250 ? "checkmark-circle" : "alert-circle"}
                                    size={24}
                                    color={priorityStatus.isInFirst250 ? "#32CD32" : "#FF3B30"}
                                />
                                <View style={styles.priorityStatusTextContainer}>
                                    <Text style={styles.priorityStatusTitle}>
                                        {priorityStatus.isInFirst250
                                            ? translate('congrats_first_250')
                                            : translate('sorry_not_first_250')
                                        }
                                    </Text>
                                    <Text style={styles.priorityStatusDescription}>
                                        {priorityStatus.message}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Doğrulama Tipleri */}
                    <Text style={styles.sectionTitle}>{translate('select_verification_type')}</Text>
                    <View style={styles.verificationTypes}>
                        <TouchableOpacity
                            style={[
                                styles.verificationTypeCard,
                                selectedType === 'blue' && styles.selectedCard
                            ]}
                            onPress={() => setSelectedType('blue')}
                        >
                            <View style={styles.cardHeader}>
                                <Ionicons name="checkmark-circle" size={28} color="#1E90FF" />
                                <Text style={styles.cardTitle}>{translate('blue_tick')}</Text>
                            </View>
                            <Text style={styles.cardDescription}>
                                {translate('blue_tick_desc')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.verificationTypeCard,
                                selectedType === 'green' && styles.selectedCard
                            ]}
                            onPress={() => setSelectedType('green')}
                        >
                            <View style={styles.cardHeader}>
                                <Ionicons name="checkmark-circle" size={28} color="#32CD32" />
                                <Text style={styles.cardTitle}>{translate('green_tick')}</Text>
                            </View>
                            <Text style={styles.cardDescription}>
                                {translate('green_tick_desc')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <Text style={styles.sectionTitle}>{translate('application_form')}</Text>
                    <View style={styles.formContainer}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{translate('full_name')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={translate('enter_full_name')}
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{translate('title')}</Text>
                            <TouchableOpacity
                                style={styles.titleSelectButton}
                                onPress={() => setShowTitleModal(true)}
                            >
                                <Text style={selectedTitle ? styles.titleSelectedText : styles.titlePlaceholderText}>
                                    {selectedTitle ? selectedTitle.name : translate('select_title')}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{translate('verification_reason')}</Text>
                            <TextInput
                                style={[styles.input, styles.multilineInput]}
                                placeholder={translate('verification_reason_hint')}
                                value={reason}
                                onChangeText={setReason}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{translate('additional_document')}</Text>
                            {!hasAttachedID ? (
                                <TouchableOpacity
                                    style={styles.attachButton}
                                    onPress={attachFile}
                                >
                                    <Ionicons name="cloud-upload-outline" size={22} color="#1E90FF" />
                                    <Text style={styles.attachButtonText}>{translate('upload_document')}</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.selectedFileContainer}>
                                    <View style={styles.selectedFileInfo}>
                                        <FileTypeIcon fileType={selectedFile?.type} />
                                        <View style={styles.fileDetails}>
                                            <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                                                {selectedFile?.name}
                                            </Text>
                                            <Text style={styles.fileSize}>
                                                {formatFileSize(selectedFile?.size)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.fileActions}>
                                        <TouchableOpacity
                                            style={styles.removeFileButton}
                                            onPress={removeFile}
                                        >
                                            <Ionicons name="close-circle" size={24} color="#FF3B30" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                            <Text style={styles.attachNote}>
                                {translate('supported_formats')}
                            </Text>
                            <Text style={styles.attachDescription}>
                                {translate('document_note')}
                            </Text>
                        </View>
                    </View>

                    {/* Bilgilendirme */}
                    <View style={styles.infoContainer}>
                        <Ionicons name="information-circle-outline" size={24} color="#666" />
                        <Text style={styles.infoText}>
                            {translate('info_text')}
                            <Text style={styles.link}> {translate('privacy_policy')}</Text>.
                        </Text>
                    </View>
                </ScrollView>

                {/* Submit Button */}
                <View style={styles.bottomContainer}>
                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.submitButtonText}>{translate('send_application')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Unvan Seçim Modalı */}
            <Modal
                visible={showTitleModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTitleModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{translate('select_title_modal')}</Text>
                            <TouchableOpacity onPress={() => setShowTitleModal(false)}>
                                <Ionicons name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={translate('search_title')}
                                value={searchText}
                                onChangeText={setSearchText}
                                autoCapitalize="none"
                            />
                            {searchText.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchText('')}>
                                    <Ionicons name="close-circle" size={20} color="#666" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <FlatList
                            data={filteredTitles}
                            renderItem={renderTitleItem}
                            keyExtractor={item => item.id}
                            showsVerticalScrollIndicator={true}
                            contentContainerStyle={styles.modalList}
                            ListEmptyComponent={() => (
                                <View style={styles.noResultContainer}>
                                    <Ionicons name="search-outline" size={40} color="#CCC" />
                                    <Text style={styles.noResultText}>{translate('no_results')}</Text>
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    placeholderRight: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    bannerContainer: {
        marginTop: 20,
    },
    flatListContainer: {
        paddingHorizontal: 25,
    },
    bannerCard: {
        flexDirection: 'row',
        padding: 20,
        marginRight: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    bannerTextContainer: {
        flex: 3,
    },
    bannerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    bannerSubtitle: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
    },
    bannerImageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D3D3D3',
        marginHorizontal: 4,
    },
    activePaginationDot: {
        backgroundColor: '#1E90FF',
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    priorityCheckContainer: {
        marginHorizontal: 16,
        marginTop: 24,
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    priorityCheckTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        color: '#212529',
    },
    priorityCheckDescription: {
        fontSize: 14,
        color: '#495057',
        marginBottom: 16,
        lineHeight: 20,
    },
    priorityCheckForm: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    priorityCheckInput: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CED4DA',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        marginRight: 8,
    },
    priorityCheckButton: {
        backgroundColor: '#1E90FF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        minWidth: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    priorityCheckButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    disabledButton: {
        backgroundColor: '#A9BCD0',
        opacity: 0.8,
    },
    priorityStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
    },
    priorityStatusSuccess: {
        backgroundColor: 'rgba(50, 205, 50, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(50, 205, 50, 0.3)',
    },
    priorityStatusFail: {
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.3)',
    },
    priorityStatusTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    priorityStatusTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212529',
        marginBottom: 4,
    },
    priorityStatusDescription: {
        fontSize: 14,
        color: '#495057',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 24,
        marginBottom: 16,
        marginHorizontal: 16,
    },
    verificationTypes: {
        paddingHorizontal: 16,
    },
    verificationTypeCard: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCard: {
        borderColor: '#1E90FF',
        backgroundColor: '#F0F8FF',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    formContainer: {
        paddingHorizontal: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    },
    multilineInput: {
        height: 100,
        paddingTop: 12,
    },
    attachButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F8FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1E90FF',
        borderStyle: 'dashed',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    attachButtonText: {
        color: '#1E90FF',
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 8,
    },
    attachNote: {
        fontSize: 12,
        color: '#666',
        marginTop: 8,
    },
    attachDescription: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
        lineHeight: 16,
    },
    infoContainer: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 100,
        flexDirection: 'row',
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
        lineHeight: 20,
    },
    link: {
        color: '#1E90FF',
        textDecorationLine: 'underline',
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    submitButton: {
        backgroundColor: '#1E90FF',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Unvan Seçim Stili
    titleSelectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    titlePlaceholderText: {
        fontSize: 16,
        color: '#A0A0A0',
    },
    titleSelectedText: {
        fontSize: 16,
        color: '#000',
    },

    // Modal stilleri
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        margin: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        padding: 4,
    },
    modalList: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    titleItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 4,
    },
    selectedTitleItem: {
        backgroundColor: '#E6F2FF',
    },
    titleItemText: {
        fontSize: 16,
        color: '#333',
    },
    selectedTitleItemText: {
        color: '#1E90FF',
        fontWeight: '500',
    },
    noResultContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    noResultText: {
        fontSize: 16,
        color: '#999',
        marginTop: 8,
    },
    selectedFileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    selectedFileInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    fileDetails: {
        marginLeft: 10,
        flex: 1,
    },
    fileName: {
        fontSize: 14,
        color: '#000',
        fontWeight: '500',
    },
    fileSize: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    fileActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    removeFileButton: {
        padding: 4,
    },
    applicationStatusContainer: {
        marginHorizontal: 16,
        marginTop: 24,
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    applicationStatusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    applicationStatusTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
        color: '#212529',
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: '#FFF',
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#1E90FF',
    },
    statusText: {
        fontSize: 14,
        color: '#495057',
        marginLeft: 8,
        flex: 1,
    },
});

export default MaviTikSorgulamaPage; 