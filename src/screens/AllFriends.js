import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  StatusBar,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { getCurrentUserUid } from '../services/friendFunctions';
import { getFriends } from '../services/friendService';
import FriendProfileModal from '../modals/friendProfileModal';
import UserSearch from '../components/UserSearch';
import { translate } from '../i18n/i18n';

const AllFriends = ({ navigation }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendModalVisible, setFriendModalVisible] = useState(false);
  const [userSearchVisible, setUserSearchVisible] = useState(false);

  // Arkadaşları yükle
  const loadFriends = async () => {
    try {
      setLoading(true);
      const uid = await getCurrentUserUid();
      if (!uid) {
        setLoading(false);
        return;
      }

      const friendsList = await getFriends(uid);
      setFriends(friendsList);
    } catch (error) {
      console.error(translate('all_friends_loading'), error);
    } finally {
      setLoading(false);
    }
  };

  // Arama sonuçlarını filtrele
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFriends(friends);
    } else {
      const query = searchQuery.toLowerCase().trim();
      const filtered = friends.filter(
        friend => 
          friend.name?.toLowerCase().includes(query) || 
          friend.username?.toLowerCase().includes(query)
      );
      setFilteredFriends(filtered);
    }
  }, [searchQuery, friends]);

  // İlk yükleme ve yenileme
  useEffect(() => {
    loadFriends();
  }, []);

  // Yenileme fonksiyonu
  const onRefresh = async () => {
    setRefreshing(true);
    await loadFriends();
    setRefreshing(false);
  };

  // Arkadaş profilini görüntüle
  const handleViewProfile = (friend) => {
    const friendData = {
      id: friend.id,
      name: friend.name || translate('all_friends_unnamed'),
      profilePicture: friend.profilePicture || null,
      friends: friend.friends || [],
      informations: {
        name: friend.name || translate('all_friends_unnamed'),
        username: friend.username || friend.name?.toLowerCase().replace(/\s+/g, '_') || 'kullanici',
        email: friend.email
      }
    };
    
    setSelectedFriend(friendData);
    setFriendModalVisible(true);
  };

  const handleAddFriend = () => {
    setUserSearchVisible(true);
  };

  const handleUserSearchClose = () => {
    setUserSearchVisible(false);
    // Arkadaş listesini yenile
    loadFriends();
  };

  // Arkadaş öğesini render et
  const renderFriendItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.friendItem}
      onPress={() => handleViewProfile(item)}
    >
      <View style={styles.friendItemContent}>
        <View style={styles.profileImageContainer}>
          {item.profilePicture ? (
            <FastImage 
              source={{ uri: item.profilePicture }} 
              style={styles.profileImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[styles.profileImage, styles.defaultProfileImage]}>
              <Text style={styles.profileInitial}>
                {item.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.name}</Text>
          {item.username && (
            <Text style={styles.friendUsername}>
              {translate('all_friends_username_prefix')}{item.username}
            </Text>
          )}
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#9797A9" />
    </TouchableOpacity>
  );

  // Boş liste durumu
  const renderEmptyComponent = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people" size={70} color="#DADADA" />
        <Text style={styles.emptyText}>
          {searchQuery.trim() !== '' 
            ? translate('all_friends_no_results')
            : translate('all_friends_empty')}
        </Text>
        <TouchableOpacity 
          style={styles.addFriendButton}
          onPress={handleAddFriend}
        >
          <Text style={styles.addFriendButtonText}>{translate('all_friends_add')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar barStyle="light-content" backgroundColor="#252636" />
      
      <View style={styles.safeAreaPadding} />
      
      {/* Başlık Çubuğu */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#E5E5E9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{translate('all_friends_title')}</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddFriend}
        >
          <Ionicons name="person-add" size={24} color="#AE63E4" />
        </TouchableOpacity>
      </View>
      
      {/* Arama Çubuğu */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9797A9" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={translate('all_friends_search')}
            placeholderTextColor="#9797A9"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Ionicons name="close-circle" size={20} color="#9797A9" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Arkadaş Listesi */}
      {loading && friends.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#AE63E4" />
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#AE63E4']}
              tintColor="#AE63E4"
            />
          }
          initialNumToRender={17}
          maxToRenderPerBatch={17}
          windowSize={5}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={true}
        />
      )}

      {/* FriendProfileModal */}
      <FriendProfileModal
        visible={friendModalVisible}
        onClose={() => setFriendModalVisible(false)}
        friend={selectedFriend}
        navigation={navigation}
      />

      <UserSearch
        visible={userSearchVisible}
        onClose={handleUserSearchClose}
        refreshData={loadFriends}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E2C',
  },
  safeAreaPadding: {
    height: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    backgroundColor: '#252636',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#252636',
    borderBottomWidth: 1,
    borderBottomColor: '#32323E',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E5E5E9',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#252636',
    borderBottomWidth: 1,
    borderBottomColor: '#32323E',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#32323E',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#E5E5E9',
  },
  clearButton: {
    padding: 6,
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: 20,
    paddingTop: 10,
    minHeight: '100%'
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#252636',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#32323E',
  },
  friendItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultProfileImage: {
    backgroundColor: '#32323E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#9797A9',
  },
  friendInfo: {
    marginLeft: 16,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E5E9',
    marginBottom: 4,
  },
  friendUsername: {
    fontSize: 14,
    color: '#9797A9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9797A9',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  addFriendButton: {
    backgroundColor: '#AE63E4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFriendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AllFriends; 