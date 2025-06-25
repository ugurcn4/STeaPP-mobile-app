import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  FlatList
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import capsuleService from '../services/CapsuleService';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const { width } = Dimensions.get('window');

const CapsuleViewModal = ({ visible, onClose, userId }) => {
  const [activeTab, setActiveTab] = useState('sent');
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Test verileri
  const mockCapsules = [
    {
      id: '1',
      title: 'Mezuniyet Günü 2023',
      type: 'location',
      status: 'pending',
      creationDate: new Date('2023-06-15'),
      contents: [
        { type: 'image' },
        { type: 'text' },
        { type: 'video' }
      ],
      location: {
        latitude: 41.0082,
        longitude: 28.9784,
        radius: 100
      },
      recipientType: 'specific',
      recipients: ['user1', 'user2', 'user3', 'user4', 'user5']
    },
    {
      id: '2',
      title: 'Doğum Günü Anısı',
      type: 'time',
      status: 'pending',
      creationDate: new Date('2023-07-10'),
      openDate: new Date('2024-07-10'),
      contents: [
        { type: 'text' },
        { type: 'audio' }
      ],
      recipientType: 'self'
    },
    {
      id: '3',
      title: 'Tatil Hatırası',
      type: 'location',
      status: 'opened',
      creationDate: new Date('2023-05-20'),
      openedAt: new Date('2023-08-15'),
      contents: [
        { type: 'image' },
        { type: 'image' },
        { type: 'image' },
        { type: 'text' },
        { type: 'video' }
      ],
      location: {
        latitude: 36.8508,
        longitude: 30.8525,
        radius: 250
      },
      recipientType: 'public'
    },
    {
      id: '4',
      title: 'Yeni Yıl Mesajım',
      type: 'time',
      status: 'opened',
      creationDate: new Date('2022-12-25'),
      openDate: new Date('2023-01-01'),
      openedAt: new Date('2023-01-01'),
      contents: [
        { type: 'text' },
        { type: 'audio' }
      ],
      recipientType: 'specific',
      recipients: ['user1', 'user2']
    }
  ];

  const receivedMockCapsules = [
    {
      id: '5',
      title: 'Arkadaşlık Anısı',
      type: 'time',
      status: 'pending',
      creationDate: new Date('2023-06-10'),
      openDate: new Date('2024-06-10'),
      contents: [
        { type: 'text' },
        { type: 'image' },
        { type: 'image' }
      ],
      senderName: 'Ahmet Yılmaz',
      senderAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      recipientType: 'specific'
    },
    {
      id: '6',
      title: 'Üniversite Hatırası',
      type: 'location',
      status: 'opened',
      creationDate: new Date('2023-05-05'),
      openedAt: new Date('2023-09-20'),
      contents: [
        { type: 'image' },
        { type: 'text' },
        { type: 'video' }
      ],
      senderName: 'Zeynep Kaya',
      senderAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      recipientType: 'specific'
    }
  ];

  // Kapsülleri getir
  useEffect(() => {
    if (visible) {
      loadCapsules();
    }
  }, [visible, activeTab]);

  const loadCapsules = async () => {
    try {
      setLoading(true);
      // Gerçek API çağrısı şimdilik devre dışı, mock verileri kullanıyoruz
      /*
      const data = activeTab === 'sent' 
        ? await capsuleService.getUserCapsules()
        : await capsuleService.getReceivedCapsules();
      setCapsules(data);
      */
      
      // Mock verilerini kullan
      setTimeout(() => {
        setCapsules(activeTab === 'sent' ? mockCapsules : receivedMockCapsules);
        setLoading(false);
      }, 800); // Gerçekçi bir loading efekti için kısa bir gecikme
    } catch (error) {
      console.error("Kapsülleri getirme hatası:", error);
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCapsules();
    setRefreshing(false);
  };

  const renderCapsuleItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.capsuleCard}
        onPress={() => handleCapsulePress(item)}
      >
        <LinearGradient
          colors={item.status === 'opened' 
            ? ['#E3F2FD', '#BBDEFB'] 
            : ['#F0F4C3', '#DCEDC8']}
          style={styles.cardGradient}
        >
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <View style={[
                styles.capsuleTypeIndicator,
                item.type === 'location' ? styles.locationIndicator : styles.timeIndicator
              ]}>
                <Ionicons 
                  name={item.type === 'location' ? 'location' : 'time'} 
                  size={12} 
                  color="#fff" 
                />
              </View>
              <Text style={styles.capsuleTitle} numberOfLines={1}>{item.title}</Text>
            </View>
            
            <View style={[
              styles.statusBadge,
              item.status === 'opened' ? styles.openedBadge : styles.pendingBadge
            ]}>
              <Text style={[
                styles.statusText,
                item.status === 'opened' ? styles.openedStatusText : styles.pendingStatusText
              ]}>
                {item.status === 'opened' ? 'Açıldı' : 'Bekliyor'}
              </Text>
            </View>
          </View>
          
          {activeTab === 'received' && (
            <View style={styles.senderInfo}>
              <Image 
                source={{ uri: item.senderAvatar || 'https://via.placeholder.com/150' }} 
                style={styles.senderAvatar} 
              />
              <Text style={styles.senderName}>Gönderen: {item.senderName}</Text>
            </View>
          )}
          
          <View style={styles.cardContent}>
            <View style={styles.contentRow}>
              <Ionicons 
                name="calendar-outline" 
                size={16} 
                color="#555" 
                style={styles.contentIcon} 
              />
              <Text style={styles.contentText}>
                Oluşturulma: {format(item.creationDate, 'd MMM yyyy', { locale: tr })}
              </Text>
            </View>
            
            {item.openDate && (
              <View style={styles.contentRow}>
                <Ionicons 
                  name="alarm-outline" 
                  size={16} 
                  color="#555" 
                  style={styles.contentIcon} 
                />
                <Text style={styles.contentText}>
                  Açılma: {format(item.openDate, 'd MMM yyyy', { locale: tr })}
                </Text>
              </View>
            )}
            
            {item.openedAt && (
              <View style={styles.contentRow}>
                <Ionicons 
                  name="checkmark-circle-outline" 
                  size={16} 
                  color="#4CAF50" 
                  style={styles.contentIcon} 
                />
                <Text style={styles.contentText}>
                  Açıldı: {format(item.openedAt, 'd MMM yyyy', { locale: tr })}
                </Text>
              </View>
            )}
            
            {item.type === 'location' && (
              <View style={styles.contentRow}>
                <Ionicons 
                  name="navigate-outline" 
                  size={16} 
                  color="#555" 
                  style={styles.contentIcon} 
                />
                <Text style={styles.contentText}>
                  Konum yarıçapı: {item.location?.radius || 100}m
                </Text>
              </View>
            )}
            
            <View style={styles.contentRow}>
              <Ionicons 
                name="albums-outline" 
                size={16} 
                color="#555" 
                style={styles.contentIcon} 
              />
              <Text style={styles.contentText}>
                İçerik: {item.contents?.length || 0} öğe
              </Text>
            </View>
          </View>
          
          <View style={styles.contentPreview}>
            {item.contents && item.contents.map((content, index) => {
              if (index < 3) {
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.contentTypeIcon,
                      content.type === 'text' ? { backgroundColor: '#2196F3' } :
                      content.type === 'image' ? { backgroundColor: '#4CAF50' } :
                      content.type === 'video' ? { backgroundColor: '#9C27B0' } :
                      { backgroundColor: '#FF9800' }
                    ]}
                  >
                    <Ionicons 
                      name={
                        content.type === 'text' ? 'text' :
                        content.type === 'image' ? 'image' :
                        content.type === 'video' ? 'videocam' :
                        'musical-note'
                      } 
                      size={14} 
                      color="#fff" 
                    />
                  </View>
                );
              } else if (index === 3) {
                return (
                  <View key={index} style={styles.moreContent}>
                    <Text style={styles.moreContentText}>+{item.contents.length - 3}</Text>
                  </View>
                );
              }
              return null;
            })}
          </View>
          
          <View style={styles.recipientInfo}>
            <Ionicons 
              name={
                item.recipientType === 'self' ? 'person' :
                item.recipientType === 'specific' ? 'people' :
                'earth'
              } 
              size={16} 
              color="#555" 
            />
            <Text style={styles.recipientText}>
              {item.recipientType === 'self' 
                ? 'Sadece ben' 
                : item.recipientType === 'specific' 
                  ? `${item.recipients?.length || 0} kişi` 
                  : 'Herkese açık'}
            </Text>
          </View>
          
          <View style={styles.cardActions}>
            {item.status === 'opened' ? (
              <TouchableOpacity 
                style={styles.viewButton}
                onPress={() => handleViewCapsule(item)}
              >
                <Ionicons name="eye-outline" size={16} color="#2196F3" />
                <Text style={styles.viewButtonText}>İçeriği Görüntüle</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.pendingInfo}>
                <Ionicons name="lock-closed-outline" size={16} color="#FF9800" />
                <Text style={styles.pendingInfoText}>
                  {item.type === 'time' 
                    ? 'Zamanı geldiğinde açılacak' 
                    : 'Konuma ulaşıldığında açılacak'}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };




  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={10} style={styles.modalContainer}>
        <Animated.View
          entering={FadeInDown.springify()}
          exiting={FadeOutDown.springify()}
          style={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Kapsüllerim</Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={handleRefresh}
            >
              <Ionicons name="refresh" size={22} color="#4CAF50" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'sent' && styles.activeTabButton
              ]}
              onPress={() => setActiveTab('sent')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'sent' && styles.activeTabText
              ]}>
                Gönderdiğim
              </Text>
              {activeTab === 'sent' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'received' && styles.activeTabButton
              ]}
              onPress={() => setActiveTab('received')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'received' && styles.activeTabText
              ]}>
                Aldığım
              </Text>
              {activeTab === 'received' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Kapsüller yükleniyor...</Text>
            </View>
          ) : capsules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons 
                name={activeTab === 'sent' ? 'paper-plane-outline' : 'mail-outline'} 
                size={64} 
                color="#ccc" 
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'sent' 
                  ? 'Henüz kapsül göndermedin' 
                  : 'Henüz kapsül almadın'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'sent' 
                  ? 'Yeni bir kapsül oluşturmak için ana sayfaya git' 
                  : 'Arkadaşlarından gelen kapsüller burada görünecek'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={capsules}
              renderItem={renderCapsuleItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          )}
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    width: '92%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
  },
  activeTabButton: {
    backgroundColor: '#f9f9f9',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    height: 3,
    backgroundColor: '#4CAF50',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  listContent: {
    padding: 16,
  },
  capsuleCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardGradient: {
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  capsuleTypeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  locationIndicator: {
    backgroundColor: '#FF9800',
  },
  timeIndicator: {
    backgroundColor: '#2196F3',
  },
  capsuleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  openedBadge: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
  },
  pendingBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  openedStatusText: {
    color: '#2196F3',
  },
  pendingStatusText: {
    color: '#FF9800',
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 8,
    borderRadius: 8,
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  cardContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  contentIcon: {
    marginRight: 6,
  },
  contentText: {
    fontSize: 14,
    color: '#333',
  },
  contentPreview: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  contentTypeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  moreContent: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#9E9E9E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreContentText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  recipientText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  viewButtonText: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 4,
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  pendingInfoText: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '500',
    marginLeft: 4,
  }
});

export default CapsuleViewModal; 