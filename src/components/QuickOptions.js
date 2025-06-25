import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { translate } from '../i18n/i18n';
import styles from '../styles/QuickOptionsStyles';
import { getFriendRequests, acceptFriendRequest, rejectFriendRequest, getCurrentUserUid } from '../services/friendFunctions';
import { fetchUserGroups } from '../services/groupService';
import UserSearch from './UserSearch';

const QuickOptions = () => {
  const navigation = useNavigation();
  const [friendRequests, setFriendRequests] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  useEffect(() => {
    fetchFriendRequests();
    fetchGroups();
  }, []);

  const fetchFriendRequests = async () => {
    try {
      setLoading(true);
      const requests = await getFriendRequests();
      setFriendRequests(requests);
    } catch (error) {
      console.error(translate('error_loading_friend_requests'), error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const uid = await getCurrentUserUid();
      if (!uid) return;
      
      const groups = await fetchUserGroups(uid);
      setUserGroups(groups);
    } catch (error) {
      console.error(translate('error_loading_groups'), error);
    }
  };

  const handleAcceptRequest = async (friendId) => {
    try {
      setLoading(true);
      const result = await acceptFriendRequest(friendId);
      if (result.success) {
        setFriendRequests(prev => prev.filter(request => request.id !== friendId));
        alert(translate('success_friend_request_accepted'));
      }
    } catch (error) {
      console.error(translate('error_accepting_request'), error);
      alert(translate('error_accepting_request'));
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (friendId) => {
    try {
      setLoading(true);
      const result = await rejectFriendRequest(friendId);
      if (result.success) {
        setFriendRequests(prev => prev.filter(request => request.id !== friendId));
        alert(translate('success_friend_request_rejected'));
      }
    } catch (error) {
      console.error(translate('error_rejecting_request'), error);
      alert(translate('error_rejecting_request'));
    } finally {
      setLoading(false);
    }
  };

  const options = [
    { 
      id: 1, 
      title: translate('quick_options_add_friend'), 
      icon: 'user-plus', 
      iconType: 'FontAwesome5',
      gradientColors: ['#FF416C', '#FF4B2B'],
      action: () => setSearchModalVisible(true)
    },
    { 
      id: 2, 
      title: translate('quick_options_groups'), 
      icon: 'account-group', 
      iconType: 'MaterialCommunityIcons',
      gradientColors: ['#2980B9', '#6DD5FA'],
      badge: userGroups.length > 0 ? userGroups.length.toString() : null,
      badgeColor: '#2980B9',
      borderColor: '#252636',
      action: () => navigation.navigate('GroupsList')
    },
    { 
      id: 3, 
      title: translate('quick_options_events'), 
      icon: 'calendar-star', 
      iconType: 'MaterialCommunityIcons',
      gradientColors: ['#F2994A', '#F2C94C'],
      badge: '2',
      badgeColor: '#F2994A',
      borderColor: '#252636',
      action: () => navigation.navigate('AllMeetings')
    },
    { 
      id: 4, 
      title: translate('quick_options_locations'), 
      icon: 'map-marker-alt', 
      iconType: 'FontAwesome5',
      gradientColors: ['#8E2DE2', '#4A00E0'],
      badge: '3',
      badgeColor: '#8E2DE2',
      borderColor: '#252636',
      action: () => navigation.navigate('Locations')
    },
    {
      id: 7,
      title: translate('quick_options_all_friends'),
      icon: 'users',
      iconType: 'FontAwesome5', 
      gradientColors: ['#4A62B3', '#3949AB'],
      badge: null,
      badgeColor: '#4A62B3',
      borderColor: '#252636',
      action: () => navigation.navigate('AllFriends')
    },
    { 
      id: 6, 
      title: translate('quick_options_requests'), 
      icon: 'user-friends', 
      iconType: 'FontAwesome5',
      gradientColors: ['#FF8008', '#FFC837'],
      badge: friendRequests.length > 0 ? friendRequests.length.toString() : null,
      isHighlighted: friendRequests.length > 0,
      badgeColor: '#FF3B30',
      borderColor: '#FFFFFF',
      action: () => navigation.navigate('FriendRequests')
    }
  ];

  const renderIcon = (option) => {
    const { iconType, icon } = option;
    const iconColor = "rgba(255, 255, 255, 0.95)";
    
    switch (iconType) {
      case 'Ionicons':
        return <Ionicons name={icon} size={28} color={iconColor} />;
      case 'MaterialCommunityIcons':
        return <MaterialCommunityIcons name={icon} size={28} color={iconColor} />;
      case 'FontAwesome5':
        return <FontAwesome5 name={icon} size={26} color={iconColor} />;
      default:
        return <Ionicons name={icon} size={28} color={iconColor} />;
    }
  };

  return (
    <View style={styles.containerWrapper}>
      <View style={styles.optionsGrid}>
        {options.map((option) => (
          <TouchableOpacity 
            key={option.id} 
            style={[
              styles.optionItem,
              option.isHighlighted && { transform: [{scale: 1.05}] }
            ]}
            onPress={option.action}
          >
            <View style={styles.iconWrapper}>
              <LinearGradient
                colors={option.gradientColors}
                start={{ x: 0.0, y: 0.25 }}
                end={{ x: 1.0, y: 0.75 }}
                style={styles.iconContainer}
              >
                {renderIcon(option)}
              </LinearGradient>
              
              {option.badge && (
                <View style={[
                  styles.badgeContainer,
                  { 
                    backgroundColor: option.badgeColor || '#FF3B30',
                    top: option.id === 6 ? -8 : -6,
                    right: option.id === 6 ? -8 : -6,
                    borderColor: option.borderColor || '#252636'
                  }
                ]}>
                  <Text style={styles.badgeText}>{option.badge}</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.optionText}>
              {option.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translate('modal_friend_requests_title')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#AE63E4" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#AE63E4" style={styles.loader} />
            ) : friendRequests.length > 0 ? (
              <FlatList
                data={friendRequests}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.requestCard}>
                    <View style={styles.userInfo}>
                      {item.profilePicture ? (
                        <FastImage 
                          source={{ uri: item.profilePicture }} 
                          style={styles.userAvatar}
                          resizeMode={FastImage.resizeMode.cover}
                        />
                      ) : (
                        <View style={styles.userAvatar}>
                          <Text style={styles.avatarText}>{item.name?.charAt(0) || "?"}</Text>
                        </View>
                      )}
                      <Text style={styles.userName}>{item.name || translate('modal_unnamed_user')}</Text>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleRejectRequest(item.id)}
                        disabled={loading}
                      >
                        <Ionicons name="close" size={20} color="#FF6B78" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => handleAcceptRequest(item.id)}
                        disabled={loading}
                      >
                        <Ionicons name="checkmark" size={20} color="#44D7B6" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                style={styles.requestsList}
              />
            ) : (
              <Text style={styles.emptyText}>{translate('modal_no_pending_requests')}</Text>
            )}
          </View>
        </View>
      </Modal>

      <UserSearch 
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        refreshData={() => {
          fetchFriendRequests();
          fetchGroups();
        }}
      />
    </View>
  );
};

export default QuickOptions; 