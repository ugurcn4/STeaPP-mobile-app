import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  StatusBar,
  Platform,
  SafeAreaView,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFriendRequests, acceptFriendRequest, rejectFriendRequest } from '../services/friendFunctions';
import FriendProfileModal from '../modals/friendProfileModal';

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight;

const FriendRequestsScreen = () => {
  const navigation = useNavigation();
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendModalVisible, setFriendModalVisible] = useState(false);

  useEffect(() => {
    loadFriendRequests();
  }, []);

  const loadFriendRequests = async () => {
    try {
      setLoading(true);
      const requests = await getFriendRequests();
      setFriendRequests(requests);
    } catch (error) {
      console.error('İstekler yüklenirken hata:', error);
      Alert.alert('Hata', 'Arkadaşlık istekleri yüklenirken bir sorun oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFriendRequests();
  };

  const handleAcceptRequest = async (friendId) => {
    try {
      await acceptFriendRequest(friendId);
      setFriendRequests(prev => prev.filter(request => request.id !== friendId));
      Alert.alert('Başarılı', 'Arkadaşlık isteği kabul edildi');
    } catch (error) {
      console.error('İstek kabul edilirken hata:', error);
      Alert.alert('Hata', 'Arkadaşlık isteği kabul edilirken bir sorun oluştu');
    }
  };

  const handleRejectRequest = async (friendId) => {
    try {
      await rejectFriendRequest(friendId);
      setFriendRequests(prev => prev.filter(request => request.id !== friendId));
      Alert.alert('Bilgi', 'Arkadaşlık isteği reddedildi');
    } catch (error) {
      console.error('İstek reddedilirken hata:', error);
      Alert.alert('Hata', 'Arkadaşlık isteği reddedilirken bir sorun oluştu');
    }
  };

  const handleUserPress = (request) => {
    // Kullanıcı verilerini hazırla
    const friendData = {
      id: request.id,
      name: request.name || 'İsimsiz Kullanıcı',
      profilePicture: request.profilePicture || null,
      friends: request.friends || [],  // Arkadaş listesini ekle
      informations: {
        name: request.name || 'İsimsiz Kullanıcı',
        username: request.username || request.name?.toLowerCase().replace(/\s+/g, '_') || 'kullanici'
      }
    };
    
    // Arkadaş verilerini ayarla ve modalı göster
    setSelectedFriend(friendData);
    setFriendModalVisible(true);
  };

  const renderRequestItem = (request) => {
    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={() => handleUserPress(request)}>
            {request.profilePicture ? (
              <FastImage 
                source={{ uri: request.profilePicture }} 
                style={styles.profilePicture}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <View style={styles.defaultProfilePicture}>
                <Text style={styles.profileInitial}>{request.name.charAt(0)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.userDetails}>
            <TouchableOpacity onPress={() => handleUserPress(request)}>
              <Text style={styles.userName}>{request.name}</Text>
            </TouchableOpacity>
            <Text style={styles.userSubText}>Arkadaşlık isteği gönderdi</Text>
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.rejectButton}
            onPress={() => handleRejectRequest(request.id)}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Reddet</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={() => handleAcceptRequest(request.id)}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Kabul Et</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <View style={styles.container}>
        <LinearGradient 
          colors={['#252636', '#1E1E2C']} 
          start={{x: 0, y: 0}} 
          end={{x: 0, y: 1}}
          style={styles.header}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFAC30" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Arkadaşlık İstekleri</Text>
          <View style={styles.actionButton} />
        </LinearGradient>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#AE63E4" />
            <Text style={styles.loadingText}>İstekler yükleniyor...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#AE63E4']}
                tintColor="#AE63E4"
              />
            }
          >
            {friendRequests.length > 0 ? (
              friendRequests.map(request => renderRequestItem(request))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="mail" size={48} color="#9797A9" />
                <Text style={styles.emptyText}>Bekleyen arkadaşlık isteği yok</Text>
                <Text style={styles.emptySubText}>
                  Yeni arkadaşlarınızdan gelen istekler burada görünecek
                </Text>
              </View>
            )}
          </ScrollView>
        )}
        
        {/* FriendProfileModal */}
        <FriendProfileModal
          visible={friendModalVisible}
          onClose={() => setFriendModalVisible(false)}
          friend={selectedFriend}
          navigation={navigation}
        />
      </View>
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
    backgroundColor: '#1E1E2C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButton: {
    padding: 5,
    width: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  requestCard: {
    backgroundColor: '#32323E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  defaultProfilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#AE63E4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userSubText: {
    color: '#9797A9',
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 12,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4136',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    color: '#9797A9',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default FriendRequestsScreen; 