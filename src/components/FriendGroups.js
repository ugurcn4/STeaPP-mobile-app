import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { translate } from '../i18n/i18n';
import styles from '../styles/FriendGroupsStyles';
import { getCurrentUserUid, getFriendRequests } from '../services/friendFunctions';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { fetchUserGroups, fetchPendingGroupInvitations } from '../services/groupService';
import { useNavigation } from '@react-navigation/native';

const FriendGroups = ({ refreshKey }) => {
  const navigation = useNavigation();
  const [userFriends, setUserFriends] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingGroupInvites, setPendingGroupInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastLoadTimeRef = useRef(0); // Son yükleme zamanını saklamak için ref
  const dataLoadedRef = useRef(false); // Verilerin yüklenip yüklenmediğini takip etmek için

  const loadGroups = useCallback(async (forceReload = false) => {
    // Son yüklemeden bu yana 1 dakikadan az zaman geçti ve veriler zaten yüklendiyse yükleme işlemini atla
    const currentTime = Date.now();
    const timeElapsed = currentTime - lastLoadTimeRef.current;
    
    if (!forceReload && dataLoadedRef.current && timeElapsed < 60000) {
      return; // 1 dakikadan az zaman geçmişse ve zorla yenileme istenmediyse yükleme yapma
    }
    
    setLoading(true);
    try {
      const uid = await getCurrentUserUid();
      if (!uid) return;
      
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) return;
      
      const userData = userDoc.data();
      const friends = userData.friends || [];
      
      const requests = await getFriendRequests();
      setPendingRequests(requests);
      
      if (friends.length > 0) {
        const friendDetails = await Promise.all(
          friends.map(async (friendId) => {
            const friendDoc = await getDoc(doc(db, 'users', friendId));
            if (friendDoc.exists()) {
              return {
                id: friendId,
                ...friendDoc.data(),
                name: friendDoc.data().informations?.name || translate('error_unnamed_user'),
                profilePicture: friendDoc.data().profilePicture || null,
              };
            }
            return null;
          })
        );
        
        setUserFriends(friendDetails.filter(friend => friend !== null));
      }

      const groups = await fetchUserGroups(uid);
      setUserGroups(groups);

      const groupInvitations = await fetchPendingGroupInvitations(uid);
      setPendingGroupInvites(groupInvitations);
      
      // Yükleme zamanını ve durumunu güncelle
      lastLoadTimeRef.current = currentTime;
      dataLoadedRef.current = true;
    } catch (error) {
      console.error('Arkadaş grupları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // refreshKey değiştiğinde zorla yeniden yükleme yap
    const forceReload = refreshKey > 0;
    loadGroups(forceReload);
  }, [refreshKey, loadGroups]);

  const handleCreateGroup = () => {
    navigation.navigate('CreateGroupScreen');
  };

  const handleViewGroup = (groupId) => {
    navigation.navigate('GroupDetail', { groupId });
  };

  const handleGroupInvitations = () => {
    navigation.navigate('GroupInvitations');
  };

  const renderGroupAvatars = (membersData) => {
    if (!membersData || membersData.length === 0) return null;

    return (
      <View style={styles.avatarsContainer}>
        {membersData.slice(0, 3).map((member, index) => (
          <View key={index} style={[styles.avatar, { zIndex: membersData.length - index }]}>
            {member.profilePicture ? (
              <FastImage 
                source={{ uri: member.profilePicture }} 
                style={{ width: '100%', height: '100%', borderRadius: 15 }}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <View style={{ 
                width: '100%', 
                height: '100%', 
                borderRadius: 15,
                backgroundColor: '#AE63E4',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                  {member.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>
        ))}
        
        {membersData.length > 3 && (
          <View style={styles.moreAvatars}>
            <Text style={styles.moreAvatarsText}>+{membersData.length - 3}</Text>
          </View>
        )}
      </View>
    );
  };

  const groupCards = useMemo(() => {
    return userGroups.map((group) => (
      <TouchableOpacity 
        key={group.id} 
        style={[styles.groupCard, {borderLeftColor: group.color}]}
        onPress={() => handleViewGroup(group.id)}
      >
        <View style={[styles.groupIcon, { backgroundColor: group.color }]}>
          <FontAwesome5 name={group.icon} size={18} color="#FFFFFF" />
        </View>
        
        <Text style={styles.groupName}>{group.name}</Text>
        
        <View style={styles.statusPill}>
          <Ionicons name="people" size={12} color="#AE63E4" />
          <Text style={styles.statusText}>
            {group.members.length} {translate('friend_groups_members_count')}
          </Text>
        </View>
        
        <Text style={styles.groupMembers}>
          {group.membersData?.length > 0 
            ? `${group.membersData.length} ${translate('friend_groups_members_count')}` 
            : translate('friend_groups_no_members')}
        </Text>
        
        <View style={styles.groupDivider} />
        
        <View style={styles.groupFooter}>
          {renderGroupAvatars(group.membersData)}
          <TouchableOpacity style={styles.viewButton}>
            <Text style={styles.viewButtonText}>{translate('friend_groups_view')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    ));
  }, [userGroups, handleViewGroup, renderGroupAvatars]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{translate('friend_groups_title')}</Text>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.navigate('GroupsList')}
        >
          <Text style={styles.headerButtonText}>{translate('friend_groups_see_all')}</Text>
          <Ionicons name="chevron-forward" size={14} color="#AE63E4" />
        </TouchableOpacity>
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.groupsScrollContainer}
      >
        {loading ? (
          <View style={styles.emptyStateCard}>
            <ActivityIndicator size="large" color="#AE63E4" />
            <Text style={[styles.emptyStateText, {marginTop: 16}]}>
              {translate('friend_groups_loading')}
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity 
              style={styles.createGroupCard}
              onPress={handleCreateGroup}
            >
              <View style={styles.createGroupIcon}>
                <Ionicons name="people" size={24} color="#FFFFFF" />
                <View style={styles.plusBadge}>
                  <Text style={styles.plusBadgeText}>+</Text>
                </View>
              </View>
              <Text style={styles.createGroupText}>{translate('friend_groups_new_group')}</Text>
            </TouchableOpacity>
            
            {pendingGroupInvites.length > 0 && (
              <TouchableOpacity 
                style={[styles.groupCard, {borderLeftColor: '#4CAF50'}]}
                onPress={handleGroupInvitations}
              >
                <View style={[styles.groupIcon, { backgroundColor: '#4CAF50' }]}>
                  <Ionicons name="people" size={18} color="#FFFFFF" />
                  <View style={[styles.notificationBadge, {backgroundColor: '#4CAF50'}]}>
                    <Text style={styles.notificationText}>{pendingGroupInvites.length}</Text>
                  </View>
                </View>
                
                <Text style={styles.groupName}>{translate('friend_groups_invites')}</Text>
                
                <View style={[styles.statusPill, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                  <Ionicons name="time" size={12} color="#4CAF50" />
                  <Text style={[styles.statusText, { color: '#4CAF50' }]}>
                    {translate('friend_groups_new')}
                  </Text>
                </View>
                
                <Text style={styles.groupMembers}>
                  {pendingGroupInvites.length} {translate('friend_groups_invites_count')}
                </Text>
                
                <View style={styles.groupDivider} />
                
                <View style={styles.groupFooter}>
                  <Text style={{ color: '#9797A9', fontSize: 12 }}>
                    {translate('friend_groups_invite_text')}
                  </Text>
                  <TouchableOpacity style={styles.viewButton}>
                    <Text style={styles.viewButtonText}>{translate('friend_groups_view')}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
            
            {groupCards}
            
            {userGroups.length === 0 && pendingGroupInvites.length === 0 && (
              <View style={styles.emptyStateCard}>
                <Ionicons name="people" size={48} color="#9797A9" />
                <Text style={styles.emptyStateText}>
                  {translate('friend_groups_empty_title')}
                </Text>
                <Text style={styles.emptyStateSubText}>
                  {translate('friend_groups_empty_subtitle')}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default React.memo(FriendGroups); 