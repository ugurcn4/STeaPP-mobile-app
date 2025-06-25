import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FastImage from 'react-native-fast-image';
import { Ionicons } from '@expo/vector-icons';
import { searchUsers, getCurrentUserUid } from '../services/friendFunctions';

// Harfli Avatar komponenti
const LetterAvatar = ({ name, size, style }) => {
  // İsmin ilk harfini al veya varsayılan olarak "?"
  const letter = name && name.length > 0 ? name.charAt(0).toUpperCase() : "?";
  
  // İsme göre renk oluştur (basit bir hash fonksiyonu)
  const getColor = (str) => {
    const colors = [
      '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', 
      '#1abc9c', '#d35400', '#c0392b', '#16a085', '#8e44ad'
    ];
    
    if (!str) return colors[0];
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  const avatarColor = getColor(name);
  
  return (
    <View style={[
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor,
        justifyContent: 'center',
        alignItems: 'center'
      },
      style
    ]}>
      <Text style={{
        color: '#ffffff',
        fontSize: size * 0.5,
        fontWeight: 'bold'
      }}>
        {letter}
      </Text>
    </View>
  );
};

// Arkadaş seçicisi komponenti
const RecipientSelector = ({ 
  visible, 
  onClose, 
  onSelectRecipients, 
  initialRecipients = [] 
}) => {
  // State tanımlamaları
  const [selectedUsers, setSelectedUsers] = useState(initialRecipients);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // Komponent yüklendiğinde mevcut kullanıcı ID'sini al
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const uid = await getCurrentUserUid();
        setCurrentUserId(uid);
      } catch (error) {
        console.error('Kullanıcı ID alınırken hata:', error);
      }
    };
    
    if (visible) {
      fetchCurrentUser();
    }
  }, [visible]);
  
  // Arkadaşları ara
  const searchFriends = async (query) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Firebase'den kullanıcıları ara
      const users = await searchUsers(query);
      
      // Sadece arkadaş olanları filtrele
      const filteredUsers = users.filter(user => {
        // Kendini liste dışı bırak
        if (user.id === currentUserId) return false;
        
        // Arkadaş listesinde olanları göster
        return user.friends && user.friends.includes(currentUserId);
      });
      
      // Kullanıcı verilerini düzenle
      const formattedResults = filteredUsers.map(user => ({
        id: user.id,
        name: user.informations?.name || 'İsimsiz Kullanıcı',
        username: user.informations?.username || 'kullanici',
        avatar: user.profilePicture || 'https://i.pravatar.cc/150?img=1' // Varsayılan avatar
      }));
      
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Arkadaş araması hatası:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Input değiştiğinde aramayı tetikle
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    searchFriends(text);
  };
  
  // Kullanıcı seçme/kaldırma
  const toggleUserSelection = (user) => {
    const isSelected = selectedUsers.some(u => u.id === user.id);
    
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };
  
  // Seçimi tamamla
  const handleConfirm = () => {
    onSelectRecipients(selectedUsers);
    onClose();
  };
  
  // Seçilen kullanıcıları render et
  const renderSelectedUsers = () => {
    if (selectedUsers.length === 0) return null;
    
    return (
      <View style={styles.selectedContainer}>
        <Text style={styles.sectionTitle}>Seçilen Kişiler ({selectedUsers.length})</Text>
        <FlashList
          data={selectedUsers}
          horizontal
          showsHorizontalScrollIndicator={false}
          estimatedItemSize={100}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.selectedUserChip}>
              {item.avatar ? (
                <FastImage 
                  source={{ uri: item.avatar }} 
                  style={styles.chipAvatar}
                  resizeMode={FastImage.resizeMode.cover}
                />
              ) : (
                <LetterAvatar name={item.name} size={24} style={styles.chipAvatar} />
              )}
              <Text style={styles.chipName}>{item.name}</Text>
              <TouchableOpacity 
                style={styles.chipRemove}
                onPress={() => toggleUserSelection(item)}
              >
                <Ionicons name="close-circle" size={18} color="#e74c3c" />
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Arkadaşlarını Seç</Text>
            <TouchableOpacity 
              style={styles.confirmButton} 
              onPress={handleConfirm}
              disabled={selectedUsers.length === 0}
            >
              <Text style={[
                styles.confirmText,
                selectedUsers.length === 0 && { color: '#ccc' }
              ]}>
                Tamam {selectedUsers.length > 0 && `(${selectedUsers.length})`}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Seçilen kullanıcılar */}
          {renderSelectedUsers()}
          
          {/* Arama alanı */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Arkadaşlarını ara..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Arama sonuçları */}
          <View style={styles.resultsContainer}>
            {searchQuery.length < 2 ? (
              <View style={styles.placeholderContainer}>
                <Ionicons name="search" size={40} color="#ccc" />
                <Text style={styles.placeholderText}>Arkadaşlarınızı aramak için en az 2 karakter girin</Text>
              </View>
            ) : isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Arkadaşlar aranıyor...</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.placeholderContainer}>
                <Ionicons name="person-outline" size={40} color="#ccc" />
                <Text style={styles.placeholderText}>"{searchQuery}" araması için arkadaş bulunamadı</Text>
              </View>
            ) : (
              <FlashList
                data={searchResults}
                estimatedItemSize={80}
                drawDistance={300}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const isSelected = selectedUsers.some(u => u.id === item.id);
                  
                  return (
                    <TouchableOpacity
                      style={[styles.userItem, isSelected && styles.userItemSelected]}
                      onPress={() => toggleUserSelection(item)}
                    >
                      {item.avatar ? (
                        <FastImage 
                          source={{ uri: item.avatar }} 
                          style={styles.userAvatar}
                          resizeMode={FastImage.resizeMode.cover}
                        />
                      ) : (
                        <LetterAvatar name={item.name} size={40} style={styles.userAvatar} />
                      )}
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.name}</Text>
                        <Text style={styles.userUsername}>@{item.username}</Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={24} color="#3498db" />
                      ) : (
                        <Ionicons name="add-circle-outline" size={24} color="#666" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    padding: 6,
  },
  confirmText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  selectedContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    height: 90, // FlashList için sabit yükseklik
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7fd',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#d5e8f9',
    height: 36, // FlashList için sabit yükseklik
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  chipName: {
    fontSize: 14,
    color: '#333',
    marginRight: 6,
  },
  chipRemove: {
    padding: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  resultsContainer: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    height: 80, // FlashList için sabit yükseklik
  },
  userItemSelected: {
    backgroundColor: '#f0f7fd',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
  },
});

export default RecipientSelector; 