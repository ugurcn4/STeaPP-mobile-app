import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUserUid } from '../services/friendFunctions';
import {
  listenToLocationShares,
  shareInstantLocation,
  startLiveLocationSharing,
  stopLocationSharing
} from '../services/LocationSharingService';
import { getFriendDetails } from '../helpers/friendHelpers';
import * as Location from 'expo-location';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import Toast from 'react-native-toast-message';

// Profil görüntüsü veya baş harfi gösteren bileşen
const ProfileImage = ({ photo, name, size = 44 }) => {
  if (photo) {
    return <FastImage source={{ uri: photo }} style={[styles.profileImage, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  
  // Fotoğraf yoksa baş harfini göster
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const colors = ['#FF9500', '#FF3B30', '#5856D6', '#007AFF', '#4CD964', '#FF2D55'];
  const colorIndex = name ? name.length % colors.length : 0;
  
  return (
    <View style={[
      styles.initialContainer, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor: colors[colorIndex] 
      }
    ]}>
      <Text style={[styles.initialText, { fontSize: size / 2 }]}>{initial}</Text>
    </View>
  );
};

const { width } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const LocationsScreen = () => {
  const navigation = useNavigation();
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedShareType, setSelectedShareType] = useState('');
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' veya 'groups'
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState({});
  const [friends, setFriends] = useState([]);
  const [activeShares, setActiveShares] = useState([]);
  const [groups, setGroups] = useState([]);
  const [hasActiveShares, setHasActiveShares] = useState(false);

  // Dinleyicileri temizlemek için kullanılacak
  useEffect(() => {
    let unsubscribe = null;
    
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const uid = await getCurrentUserUid();
        setCurrentUserId(uid);
        
        if (uid) {
          // Arkadaş listesini çek
          await fetchFriends(uid);
          
          // Grup listesini çek
          await fetchGroups(uid);
          
          // Aktif paylaşımları dinle - Yeni API kullanımı
          unsubscribe = listenToLocationShares(
            uid, 
            // Anlık konum callback'i
            (instantLocations) => {
              const formattedLocations = instantLocations.map(loc => {
                // Gönderilen veya alınan paylaşımlara göre farklı işle
                if (loc.isSent) {
                  // Gönderilen paylaşım
                  return {
                    id: loc.id,
                    type: 'instant',
                    receiverId: loc.receiverId,
                    userName: loc.userName || 'İsimsiz',
                    userPhoto: loc.userPhoto,
                    location: loc.location,
                    locationInfo: loc.locationInfo,
                    metadata: loc.metadata,
                    lastUpdate: loc.metadata?.updatedAt,
                    startTime: loc.metadata?.createdAt,
                    isSent: true
                  };
                } else {
                  // Alınan paylaşım
                  return {
                    id: loc.id,
                    type: 'instant',
                    senderId: loc.senderId,
                    userName: loc.senderName || 'İsimsiz',
                    userPhoto: loc.senderPhoto,
                    location: loc.location,
                    locationInfo: loc.locationInfo,
                    metadata: loc.metadata,
                    lastUpdate: loc.metadata?.updatedAt,
                    startTime: loc.metadata?.createdAt,
                    isReceived: true
                  };
                }
              });
              
              // Canlı konumlarla birleştir ve state'e kaydet
              setActiveShares(prev => {
                const liveLocs = prev.filter(share => share.type === 'live');
                return [...liveLocs, ...formattedLocations];
              });
            },
            // Canlı konum callback'i
            (id, updatedLocation) => {
              if (id === null) {
                // Tüm canlı konumları al
                const formattedLocations = updatedLocation.map(loc => {
                  // Gönderilen veya alınan paylaşımlara göre farklı işle
                  if (loc.isSent) {
                    // Gönderilen paylaşım
                    return {
                      id: loc.id,
                      type: 'live',
                      receiverId: loc.receiverId,
                      userName: loc.userName || 'İsimsiz',
                      userPhoto: loc.userPhoto,
                      startTime: loc.startTime,
                      endTime: loc.endTime,
                      metadata: loc.metadata,
                      lastUpdate: loc.metadata?.updatedAt,
                      location: loc.location,
                      isSent: true
                    };
                  } else {
                    // Alınan paylaşım
                    return {
                      id: loc.id,
                      type: 'live',
                      senderId: loc.senderId,
                      userName: loc.senderName || 'İsimsiz',
                      userPhoto: loc.senderPhoto,
                      startTime: loc.startTime,
                      endTime: loc.endTime,
                      metadata: loc.metadata,
                      lastUpdate: loc.metadata?.updatedAt,
                      location: loc.location,
                      isReceived: true
                    };
                  }
                });
                
                // Anlık konumlarla birleştir ve state'e kaydet
                setActiveShares(prev => {
                  const instantLocs = prev.filter(share => share.type === 'instant');
                  return [...instantLocs, ...formattedLocations];
                });
              } else {
                // Tek bir canlı konum güncellendi
                setActiveShares(prev => {
                  const updatedShares = prev.filter(loc => loc.id !== id);
                  
                  // Gönderilen veya alınan paylaşımlara göre farklı işle
                  let newShare;
                  if (updatedLocation.isSent) {
                    // Gönderilen paylaşım
                    newShare = {
                      id: id,
                      type: 'live',
                      receiverId: updatedLocation.receiverId,
                      userName: updatedLocation.userName || 'İsimsiz',
                      userPhoto: updatedLocation.userPhoto,
                      location: updatedLocation.location,
                      metadata: updatedLocation.metadata,
                      lastUpdate: updatedLocation.metadata?.updatedAt,
                      startTime: updatedLocation.startTime,
                      endTime: updatedLocation.endTime,
                      isSent: true
                    };
                  } else {
                    // Alınan paylaşım
                    newShare = {
                      id: id,
                      type: 'live',
                      senderId: updatedLocation.senderId,
                      userName: updatedLocation.senderName || 'İsimsiz',
                      userPhoto: updatedLocation.senderPhoto,
                      location: updatedLocation.location,
                      metadata: updatedLocation.metadata,
                      lastUpdate: updatedLocation.metadata?.updatedAt,
                      startTime: updatedLocation.startTime,
                      endTime: updatedLocation.endTime,
                      isReceived: true
                    };
                  }
                  
                  return [...updatedShares, newShare];
                });
              }
            }
          );
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Kullanıcı bilgileri alınırken hata oluştu:', error);
        setIsLoading(false);
      }
    };
    
    fetchUserData();
    
    return () => {
      // Komponent unmount olduğunda dinleyicileri temizle
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({
      title: 'Konumlar',
      headerStyle: {
        backgroundColor: '#252636',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
  }, [navigation]);

  // Zaman bilgilerini daha detaylı formatla
  const formatDateTime = (date) => {
    if (!date) return 'Bilinmeyen zaman';
    
    let dateObj;
    try {
      // Firestore Timestamp nesnesini kontrol et
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      // Date nesnesi mi kontrol et
      else if (date instanceof Date) {
        dateObj = date;
      }
      // Timestamp milisaniye değeri mi kontrol et
      else if (typeof date === 'number') {
        dateObj = new Date(date);
      }
      // String ise Date nesnesine çevir
      else if (typeof date === 'string') {
        dateObj = new Date(date);
      }
      // Hiçbiri değilse veya geçersizse
      else {
        return 'Bilinmeyen zaman';
      }

      // Geçerli bir tarih mi kontrol et
      if (isNaN(dateObj.getTime())) {
        return 'Bilinmeyen zaman';
      }

      // Bugün ise saat göster
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const paylaşımDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      
      const isToday = paylaşımDate.getTime() === today.getTime();
      
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
      
      if (isToday) {
        return `Bugün ${hours}:${minutes}`;
      }
      
      // Dün ise dün göster
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = paylaşımDate.getTime() === yesterday.getTime();
      
      if (isYesterday) {
        return `Dün ${hours}:${minutes}`;
      }
      
      // Diğer durumlarda tarih ve saat göster
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      
      return `${day}.${month}.${dateObj.getFullYear()} ${hours}:${minutes}`;
    } catch (error) {
      console.error('Tarih formatlanırken hata:', error);
      return 'Bilinmeyen zaman';
    }
  };
  
  const formatShareTime = (date) => {
    if (!date) return 'Bilinmeyen zaman';
    
    try {
      let dateObj;
      // Firestore Timestamp nesnesini kontrol et
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      // Date nesnesi mi kontrol et
      else if (date instanceof Date) {
        dateObj = date;
      }
      // Timestamp milisaniye değeri mi kontrol et
      else if (typeof date === 'number') {
        dateObj = new Date(date);
      }
      // String ise Date nesnesine çevir
      else if (typeof date === 'string') {
        dateObj = new Date(date);
      }
      // Hiçbiri değilse veya geçersizse
      else {
        return 'Bilinmeyen zaman';
      }

      // Geçerli bir tarih mi kontrol et
      if (isNaN(dateObj.getTime())) {
        return 'Bilinmeyen zaman';
      }

      const now = new Date();
      const diffMs = now - dateObj;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
        return 'Az önce';
      } else if (diffMins < 60) {
        return `${diffMins} dakika önce`;
      } else {
        const hours = Math.floor(diffMins / 60);
        if (hours < 24) {
          return `${hours} saat önce`;
        } else {
          const days = Math.floor(hours / 24);
          return `${days} gün önce`;
        }
      }
    } catch (error) {
      console.error('Paylaşım zamanı formatlanırken hata:', error);
      return 'Bilinmeyen zaman';
    }
  };
  
  // Konum izni isteme ve konum alma - Yeni API kullanımı
  const requestLocationAndShare = async (friendId, shareType) => {
    try {
      setIsLoading(true);
      
      if (!currentUserId) {
        Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı.');
        setIsLoading(false);
        return;
      }
      
      let shareId;
      
      // Paylaşım tipine göre işlem yap
      if (shareType === 'instant') {
        // Anlık konum paylaşımı
        shareId = await shareInstantLocation(currentUserId, friendId);
      } else if (shareType === 'live') {
        // Canlı konum paylaşımı - varsayılan 60 dakika
        shareId = await startLiveLocationSharing(currentUserId, friendId, 60);
      }
      
      if (shareId) {
        Alert.alert(
          'Başarılı', 
          shareType === 'instant' 
            ? 'Anlık konum paylaşıldı' 
            : 'Canlı konum paylaşımı başlatıldı'
        );
      } else {
        Alert.alert('Hata', 'Konum paylaşılamadı.');
      }
      
      setShowShareModal(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Konum paylaşımı sırasında hata:', error);
      Alert.alert('Hata', `Konum paylaşılırken bir sorun oluştu: ${error.message || 'Bilinmeyen hata'}`);
      setIsLoading(false);
    }
  };
  
  // Konum paylaşımını durdur
  const handleStopShare = async (shareId) => {
    try {
      if (!shareId || !currentUserId) {
        Alert.alert('Hata', 'Geçersiz paylaşım bilgisi');
        return;
      }
      
      setIsLoading(true);
      
      // İlgili paylaşım bilgilerini bul
      const share = activeShares.find(s => s.id === shareId);
      if (!share) {
        Alert.alert('Hata', 'Paylaşım bilgisi bulunamadı');
        setIsLoading(false);
        return;
      }
      
      // Paylaşımı durdur - Yeni yapıda type parametresi eklendi
      await stopLocationSharing(currentUserId, shareId, share.type);
      
      Alert.alert('Başarılı', 'Konum paylaşımı durduruldu');
      setIsLoading(false);
    } catch (error) {
      console.error('Konum paylaşımı durdurulurken hata:', error);
      Alert.alert('Hata', `Paylaşım durdurulurken bir sorun oluştu: ${error.message || 'Bilinmeyen hata'}`);
      setIsLoading(false);
    }
  };

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.friendItem}
      onPress={() => setShowShareModal(false)}
    >
      <View style={styles.friendAvatarContainer}>
        <ProfileImage photo={item.photo} name={item.name} />
      </View>
      <Text style={styles.friendName}>{item.name}</Text>
      <TouchableOpacity 
        style={[styles.shareButton, { backgroundColor: selectedShareType === 'live' ? '#FF3B30' : '#4CAF50' }]}
        onPress={() => requestLocationAndShare(item.id, selectedShareType)}
      >
        <Text style={styles.shareButtonText}>
          {selectedShareType === 'live' ? 'Canlı' : 'Anlık'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderGroupItem = ({ item }) => {
    // Grup üye sayısı
    const memberCount = item.members ? item.members.length : 0;
    
    return (
      <TouchableOpacity 
        style={styles.groupItem}
        onPress={() => {
          // Grup ile konum paylaşımı
          if (selectedShareType) {
            // Tüm grup üyelerine konum paylaşımı başlatma
            item.members.forEach(memberId => {
              if (memberId !== currentUserId) {
                requestLocationAndShare(memberId, selectedShareType);
              }
            });
            Alert.alert('Başarılı', `${item.name} grubu ile konum paylaşıldı`);
            setShowShareModal(false);
          }
        }}
      >
        <View style={styles.groupIconContainer}>
          <Ionicons name={item.icon || 'people-outline'} size={24} color="#FFF" />
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMemberCount}>{memberCount} üye</Text>
        </View>
        <TouchableOpacity 
          style={[styles.shareButton, { backgroundColor: selectedShareType === 'live' ? '#FF3B30' : '#4CAF50' }]}
        >
          <Text style={styles.shareButtonText}>
            {selectedShareType === 'live' ? 'Canlı' : 'Anlık'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Arkadaş listesini çekme fonksiyonu
  const fetchFriends = async (userId) => {
    try {
      // Firestore'dan arkadaş referanslarını al
      const userDoc = await getFriendDetails(userId);
      
      if (userDoc && userDoc.friends && userDoc.friends.length > 0) {
        // Her bir arkadaş için detayları çek
        const friendDetailsPromises = userDoc.friends.map(friendId => 
          getFriendDetails(friendId)
        );
        
        const friendDetails = await Promise.all(friendDetailsPromises);
        
        // Geçerli arkadaş detaylarını filtrele ve formatla
        const formattedFriends = friendDetails
          .filter(friend => friend !== null)
          .map(friend => ({
            id: friend.id,
            name: friend.informations?.name || 'İsimsiz Kullanıcı',
            photo: friend.profilePicture || null,
            online: friend.online || false
          }));
          
        setFriends(formattedFriends);
      } else {
        // Arkadaş bulunamadı
        setFriends([]);
      }
    } catch (error) {
      console.error('Arkadaş listesi alınırken hata:', error);
      setFriends([]);
    }
  };
  
  // Grupları çekme fonksiyonu
  const fetchGroups = async (userId) => {
    try {
      // Grup bilgilerini direkt Firestore'dan al
      const groupsCollection = collection(db, 'groups');
      const q = query(groupsCollection, where('members', 'array-contains', userId));
      
      try {
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userGroups = [];
          
          querySnapshot.forEach((docSnapshot) => {
            const groupData = docSnapshot.data();
            userGroups.push({
              id: docSnapshot.id,
              name: groupData.name || 'İsimsiz Grup',
              members: groupData.members || [],
              icon: getGroupIcon(groupData.type || 'default')
            });
          });
          
          setGroups(userGroups);
        } else {
          setGroups([]);
        }
      } catch (error) {
        console.error('Grup sorgusu çalıştırılırken hata:', error);
        setGroups([]);
      }
    } catch (error) {
      console.error('Grup listesi alınırken hata:', error);
      setGroups([]);
    }
  };
  
  // Grup ikonlarını belirle
  const getGroupIcon = (groupType) => {
    switch (groupType) {
      case 'family':
        return 'people-outline';
      case 'work':
        return 'briefcase-outline';
      case 'school':
        return 'school-outline';
      case 'friends':
        return 'person-outline';
      default:
        return 'people-outline';
    }
  };

  // Ters kodlama ile koordinatları adrese dönüştürme
  const reverseGeocode = useCallback(async (latitude, longitude, shareId) => {
    if (!latitude || !longitude) return null;
    
    try {
      setLoadingAddresses(prev => ({ ...prev, [shareId]: true }));
      
      const response = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });
      
      if (response && response.length > 0) {
        const location = response[0];
        let address = '';
        
        if (location.street) {
          address += location.street;
          if (location.streetNumber) address += ' ' + location.streetNumber + ', ';
          else address += ', ';
        }
        
        if (location.district) {
          address += location.district + ', ';
        }
        
        if (location.city) {
          address += location.city;
        } else if (location.region) {
          address += location.region;
        }
        
        setLoadingAddresses(prev => ({ ...prev, [shareId]: false }));
        return address;
      }
      
      setLoadingAddresses(prev => ({ ...prev, [shareId]: false }));
      return null;
    } catch (error) {
      console.error('Ters kodlama hatası:', error);
      setLoadingAddresses(prev => ({ ...prev, [shareId]: false }));
      return null;
    }
  }, []);
  
  // Konum paylaşımları güncellendiğinde ters kodlama yap
  useEffect(() => {
    const fetchAddresses = async () => {
      const updatedShares = [...activeShares];
      let hasChanges = false;
      
      for (let i = 0; i < updatedShares.length; i++) {
        const share = updatedShares[i];
        
        // Eğer konum koordinatları var ama adres yoksa
        if (share.location && 
            share.location.latitude && 
            share.location.longitude && 
            (!share.location.address || share.location.address === 'Bilinmeyen Konum')) {
          
          // Adres yüklenmiyorsa veya yüklenmeye başlanmadıysa
          if (!loadingAddresses[share.id]) {
            const address = await reverseGeocode(
              share.location.latitude, 
              share.location.longitude,
              share.id
            );
            
            if (address) {
              updatedShares[i] = {
                ...share,
                location: {
                  ...share.location,
                  address
                }
              };
              hasChanges = true;
            }
          }
        }
      }
      
      if (hasChanges) {
        setActiveShares(updatedShares);
      }
    };
    
    if (activeShares.length > 0) {
      fetchAddresses();
    }
  }, [activeShares, reverseGeocode, loadingAddresses]);

  // useEffect içinde, aktif canlı paylaşım olup olmadığını kontrol et
  useEffect(() => {
    if (activeShares.length > 0) {
      const liveShares = activeShares.filter(share => share.type === 'live');
      setHasActiveShares(liveShares.length > 0);
    } else {
      setHasActiveShares(false);
    }
  }, [activeShares]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        backgroundColor="#252636"
        barStyle="light-content"
        translucent={Platform.OS === 'android'}
      />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Konumlar</Text>
        {isLoading && <ActivityIndicator color="#FFF" style={{marginLeft: 8}} />}
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {}}
        >
          <Ionicons name="options-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        {/* Konum Paylaşım Kartları */}
        <View style={styles.shareCardsContainer}>
          <TouchableOpacity 
            style={styles.shareCard}
            onPress={() => {
              setSelectedShareType('instant');
              setShowShareModal(true);
            }}
          >
            <LinearGradient
              colors={['#4CAF50', '#2E7D32']}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <MaterialIcons name="share-location" size={32} color="#FFF" />
              </View>
              <Text style={styles.cardTitle}>Anlık Konum</Text>
              <Text style={styles.cardDescription}>Şu anki konumunuzu paylaşın</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.shareCard}
            onPress={() => {
              setSelectedShareType('live');
              setShowShareModal(true);
            }}
          >
            <LinearGradient
              colors={['#FF3B30', '#B71C1C']}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <MaterialIcons name="location-on" size={32} color="#FFF" />
              </View>
              <Text style={styles.cardTitle}>Canlı Konum</Text>
              <Text style={styles.cardDescription}>Gerçek zamanlı takip için paylaşın</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Grup Paylaşım Seçeneği */}
        <TouchableOpacity 
          style={styles.groupShareCard}
          onPress={() => {
            // Grup seçme modalını göster
            Toast.show({
              type: 'info',
              text1: 'Grup paylaşımı yakında eklenecek',
              position: 'top'
            });
          }}
        >
          <LinearGradient
            colors={['#4A62B3', '#3949AB']}
            style={styles.groupCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.groupIconWrapper}>
              <View style={styles.cardIconContainer}>
                <MaterialIcons name="groups" size={32} color="#FFF" />
              </View>
            </View>
            <View style={styles.groupCardContent}>
              <Text style={styles.cardTitle}>Grup Paylaşımı</Text>
              <Text style={styles.cardDescription}>Birden fazla kişiyle aynı anda konum paylaşın</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Aktif Konum Paylaşımları */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aktif Paylaşımlar</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MapPage')}>
              <Text style={styles.seeAllText}>Haritada Gör</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.emptyStateContainer}>
              <ActivityIndicator size="large" color="#4A62B3" />
              <Text style={styles.emptyStateText}>Paylaşımlar yükleniyor...</Text>
            </View>
          ) : activeShares.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="location-off" size={48} color="#8E8E93" />
              <Text style={styles.emptyStateText}>Aktif paylaşım bulunmuyor</Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeSharesContainer}
            >
              {activeShares.map((share) => (
                <TouchableOpacity key={share.id} style={styles.activeShareCard}>
                  <View style={styles.shareUserInfo}>
                    <ProfileImage photo={share.userPhoto} name={share.userName} />
                    <View>
                      <Text style={styles.shareUserName}>{share.userName || 'İsimsiz'}</Text>
                      <View style={styles.shareTypeContainer}>
                        <View style={[styles.shareTypeIndicator, { 
                          backgroundColor: share.type === 'live' ? '#FF3B30' : '#4CAF50' 
                        }]} />
                        <Text style={styles.shareTypeText}>
                          {share.isSent ? 'Gönderilen ' : 'Alınan '}
                          {share.type === 'live' ? 'Canlı Konum' : 'Anlık Konum'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.shareLocationInfo}>
                    <View style={styles.shareLocationIcon}>
                      <MaterialIcons 
                        name={share.type === 'live' ? 'location-on' : 'share-location'} 
                        size={22} 
                        color="#FFF" 
                      />
                    </View>
                    <View style={styles.shareLocationText}>
                      {loadingAddresses[share.id] ? (
                        <View style={styles.addressLoading}>
                          <ActivityIndicator size="small" color="#B0B0B8" />
                          <Text style={styles.addressLoadingText}>Adres alınıyor...</Text>
                        </View>
                      ) : (
                        <Text style={styles.shareAddress}>
                          {share.location?.address || 'Bilinmeyen Konum'}
                        </Text>
                      )}
                      <View style={styles.shareTimeWrapper}>
                        <Text style={styles.shareTime}>
                          {formatDateTime(share.startTime || share.metadata?.createdAt)}
                        </Text>
                        <Text style={styles.shareDuration}>
                          ({formatShareTime(share.startTime || share.metadata?.createdAt)})
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.shareActions}>
                    <TouchableOpacity 
                      style={styles.shareAction}
                      onPress={() => navigation.navigate('MapPage', { sharedLocation: share })}
                    >
                      <MaterialIcons name="directions" size={22} color="#4A62B3" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.shareAction}
                      onPress={() => handleStopShare(share.id)}
                    >
                      <MaterialIcons name="close" size={22} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Harita Görünümü */}
        <TouchableOpacity 
          style={styles.mapViewButton}
          onPress={() => navigation.navigate('MapPage')}
        >
          <LinearGradient
            colors={['#4A62B3', '#3949AB']}
            style={styles.mapViewGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <FontAwesome5 name="map-marked-alt" size={24} color="#FFF" />
            <Text style={styles.mapViewText}>Harita Görünümüne Geç</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Arkadaş Seçme Modalı */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showShareModal}
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedShareType === 'live' ? 'Canlı Konum Paylaşımı' : 'Anlık Konum Paylaşımı'}
              </Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowShareModal(false)}
              >
                <Ionicons name="close" size={24} color="#252636" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              {selectedShareType === 'live' 
                ? 'Canlı konumunuz sürekli güncellenecek ve seçtiğiniz kişi tarafından takip edilebilecektir.'
                : 'Şu anki konumunuz tek seferlik olarak paylaşılacaktır.'}
            </Text>
            
            {/* Tab Seçiciler */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'friends' && styles.activeTab]} 
                onPress={() => setActiveTab('friends')}
              >
                <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>Arkadaşlar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'groups' && styles.activeTab]} 
                onPress={() => setActiveTab('groups')}
              >
                <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>Gruplar</Text>
              </TouchableOpacity>
            </View>
            
            {activeTab === 'friends' ? (
              <>
                <Text style={styles.friendsListTitle}>Paylaşılacak kişiyi seçin</Text>
                {friends.length === 0 ? (
                  <View style={styles.emptyFriendsContainer}>
                    <MaterialIcons name="people-outline" size={48} color="#8E8E93" />
                    <Text style={styles.emptyStateText}>Arkadaş listeniz boş</Text>
                  </View>
                ) : (
                  <FlatList
                    data={friends}
                    renderItem={renderFriendItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.friendsListContainer}
                  />
                )}
              </>
            ) : (
              <>
                <Text style={styles.friendsListTitle}>Paylaşılacak grubu seçin</Text>
                {groups.length === 0 ? (
                  <View style={styles.emptyFriendsContainer}>
                    <MaterialIcons name="groups" size={48} color="#8E8E93" />
                    <Text style={styles.emptyStateText}>Henüz oluşturulmuş grup yok</Text>
                  </View>
                ) : (
                  <FlatList
                    data={groups}
                    renderItem={renderGroupItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.friendsListContainer}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#252636',
    paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#252636',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#363748',
    paddingTop: Platform.OS === 'android' ? 0 : 0,
    marginTop: Platform.OS === 'android' ? 0 : 0,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    padding: 8,
  },
  // Paylaşım Kartları Stilleri
  shareCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  shareCard: {
    width: (width - 40) / 2,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 'auto',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'left',
  },
  cardDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'left',
  },
  // Grup Paylaşım Kartı
  groupShareCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  groupCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  groupIconWrapper: {
    marginRight: 16,
  },
  groupCardContent: {
    flex: 1,
  },
  // Bölüm Stilleri
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4A62B3',
  },
  // Boş Durum Stili
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D2E42',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  // Aktif Paylaşımlar Stilleri
  activeSharesContainer: {
    paddingBottom: 8,
  },
  activeShareCard: {
    width: width * 0.85,
    backgroundColor: '#2D2E42',
    borderRadius: 16,
    padding: 16,
    marginRight: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  shareUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareUserPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  shareUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
    marginLeft: 12,
  },
  shareTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareTypeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  shareTypeText: {
    fontSize: 13,
    color: '#B0B0B8',
  },
  shareLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#363748',
    borderRadius: 12,
    padding: 12,
  },
  shareLocationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A62B3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shareLocationText: {
    flex: 1,
  },
  shareAddress: {
    fontSize: 14,
    color: '#FFF',
    marginBottom: 4,
  },
  shareTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  shareTime: {
    fontSize: 12,
    color: '#B0B0B8',
  },
  shareDuration: {
    fontSize: 11,
    color: '#B0B0B8',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  shareActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  shareAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#363748',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  // Harita Görünümü Butonu
  mapViewButton: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapViewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  mapViewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 12,
  },
  // Modal Stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#252636',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4A62B3',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#4A62B3',
    fontWeight: '600',
  },
  friendsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#252636',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  friendsListContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  friendAvatarContainer: {
    position: 'relative',
    marginRight: 12, // Profil resmi ile isim arasına boşluk ekledim
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 16,
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    color: '#252636',
    marginLeft: 4, // İsim ile profil resmi arasına ek boşluk
  },
  shareButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Grup öğesi stilleri
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  groupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A62B3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#252636',
    marginBottom: 4,
  },
  groupMemberCount: {
    fontSize: 13,
    color: '#666',
  },
  emptyFriendsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  initialContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  initialText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 22,
  },
  addressLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressLoadingText: {
    fontSize: 12,
    color: '#B0B0B8',
    marginLeft: 6,
  },
});

export default LocationsScreen; 
