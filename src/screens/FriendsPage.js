import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StatusBar, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { translate } from '../i18n/i18n';

// Oluşturduğumuz bileşenleri import edelim
import QuickOptions from '../components/QuickOptions';
import FriendGroups from '../components/FriendGroups';
import Meetings from '../components/Meetings';
import AnimatedHeaderTitle from '../components/AnimatedHeaderTitle';
import { getFriendRequests, getCurrentUserUid } from '../services/friendFunctions';
import { fetchPendingGroupInvitations } from '../services/groupService';
import styles from '../styles/FriendsPageStyles';

const FriendsPage = ({ navigation, route }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [friendRequests, setFriendRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [meetingsRefreshKey, setMeetingsRefreshKey] = useState(0);
  const [groupInvites, setGroupInvites] = useState([]);
  const [meetingInvites, setMeetingInvites] = useState([]);
  
  // Değişen karşılama mesajları
  const welcomeMessages = [
    translate('friends_page_title'),
    translate('friends_page_social_circle'),
    translate('friends_page_meetings'),
    translate('friends_page_activities'),
    translate('friends_page_groups'),
    translate('friends_page_connections'),
    translate('friends_page_social_network'),
    translate('friends_page_friend_list')
  ];

  // Arkadaş isteklerini yükle - useCallback ile optimize edilmiş
  const loadFriendRequests = useCallback(async () => {
    try {
      const requests = await getFriendRequests();
      setFriendRequests(requests);
    } catch (error) {
      console.error(translate('error_friend_requests'), error);
    }
  }, []);

  // Grup davetlerini yükle - useCallback ile optimize edilmiş
  const loadGroupInvites = useCallback(async () => {
    try {
      const uid = await getCurrentUserUid();
      if (!uid) return;
      
      const invitations = await fetchPendingGroupInvitations(uid);
      setGroupInvites(invitations);
    } catch (error) {
      console.error(translate('error_group_invites'), error);
    }
  }, []);

  // Buluşma davetlerini yükle - useCallback ile optimize edilmiş
  const loadMeetingInvites = useCallback(async () => {
    try {
      const uid = await getCurrentUserUid();
      if (!uid) return;
      
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('participants', 'array-contains', uid)
      );
      
      const meetingsSnapshot = await getDocs(meetingsQuery);
      const pendingMeetings = [];
      
      meetingsSnapshot.docs.forEach(meetingDoc => {
        const meetingData = meetingDoc.data();
        if (meetingData.participantStatus && 
            meetingData.participantStatus[uid] === 'pending') {
          pendingMeetings.push({
            id: meetingDoc.id,
            ...meetingData
          });
        }
      });
      
      setMeetingInvites(pendingMeetings);
    } catch (error) {
      console.error(translate('error_meeting_invites'), error);
    }
  }, []);

  // Çekme yenileme işlemi - useCallback ile optimize edilmiş
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Verileri yenile
      await loadFriendRequests();
      await loadGroupInvites();
      await loadMeetingInvites();
      setRefreshKey(prev => prev + 1);
      setMeetingsRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Yenileme hatası:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadFriendRequests, loadGroupInvites, loadMeetingInvites]);

  // useEffect - navigation odak dinleyicisi
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Burada gerçekten gerekli olmadıkça refreshKey'i güncellemiyoruz
      // Örnek olarak, belirli bir durum olduğunda güncelleyelim
      const needsRefresh = route.params?.forceFreshData || false;
      
      if (needsRefresh) {
        setRefreshKey(prev => prev + 1);
        setMeetingsRefreshKey(prev => prev + 1);
      }
      
      loadFriendRequests();
      loadGroupInvites();
      loadMeetingInvites();
    });

    return unsubscribe;
  }, [navigation, loadFriendRequests, loadGroupInvites, loadMeetingInvites]);

  // useEffect - route params değişikliği
  useEffect(() => {
    if (route.params?.refresh) {
      setRefreshKey(prev => prev + 1);
      setMeetingsRefreshKey(prev => prev + 1);
      loadFriendRequests();
      loadGroupInvites();
      loadMeetingInvites();
      navigation.setParams({ refresh: null });
    }
  }, [route.params?.refresh, loadFriendRequests, loadGroupInvites, loadMeetingInvites, navigation]);

  // İlk yüklemede istekleri getir
  useEffect(() => {
    loadFriendRequests();
    loadGroupInvites();
    loadMeetingInvites();
  }, [loadFriendRequests, loadGroupInvites, loadMeetingInvites]);

  // Bekleyen istekler bölümünü render et - useMemo ile optimize edilmiş
  const pendingRequestsSection = useMemo(() => {
    if (friendRequests.length === 0) return null;
    
    return (
      <View style={styles.pendingRequestsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{translate('friends_page_pending_requests')}</Text>
          <TouchableOpacity 
            style={styles.seeAllButton}
            onPress={() => navigation.navigate('FriendRequests')}
          >
            <Text style={styles.seeAllText}>{translate('friends_page_see_all')}</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.pendingRequestsCard}
          onPress={() => navigation.navigate('FriendRequests')}
        >
          <View style={styles.pendingRequestsInfo}>
            <View style={styles.pendingRequestsIcon}>
              <Ionicons name="mail" size={22} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.pendingRequestsTitle}>
                {friendRequests.length} {translate('friends_page_new_friend_requests')}
              </Text>
              <Text style={styles.pendingRequestsSubtitle}>
                {translate('friends_page_view_pending_requests')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9797A9" />
        </TouchableOpacity>
      </View>
    );
  }, [friendRequests, navigation]);

  // Bekleyen grup davetleri bölümünü render et - useMemo ile optimize edilmiş
  const pendingGroupInvitesSection = useMemo(() => {
    if (groupInvites.length === 0) return null;
    
    return (
      <View style={styles.pendingRequestsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{translate('friends_page_group_invites')}</Text>
          <TouchableOpacity 
            style={styles.seeAllButton}
            onPress={() => navigation.navigate('GroupInvitations')}
          >
            <Text style={styles.seeAllText}>{translate('friends_page_see_all')}</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.pendingRequestsCard}
          onPress={() => navigation.navigate('GroupInvitations')}
        >
          <View style={styles.pendingRequestsInfo}>
            <View style={[styles.pendingRequestsIcon, {backgroundColor: '#53B4DF'}]}>
              <Ionicons name="people" size={22} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.pendingRequestsTitle}>
                {groupInvites.length} {translate('friends_page_new_group_invites')}
              </Text>
              <Text style={styles.pendingRequestsSubtitle}>
                {translate('friends_page_view_group_invites')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9797A9" />
        </TouchableOpacity>
      </View>
    );
  }, [groupInvites, navigation]);

  // Bekleyen buluşma davetleri bölümünü render et - useMemo ile optimize edilmiş
  const pendingMeetingInvitesSection = useMemo(() => {
    if (meetingInvites.length === 0) return null;
    
    return (
      <View style={styles.pendingRequestsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{translate('friends_page_meeting_invites')}</Text>
          <TouchableOpacity 
            style={styles.seeAllButton}
            onPress={() => navigation.navigate('AllMeetings')}
          >
            <Text style={styles.seeAllText}>{translate('friends_page_see_all')}</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.pendingRequestsCard}
          onPress={() => navigation.navigate('AllMeetings')}
        >
          <View style={styles.pendingRequestsInfo}>
            <View style={[styles.pendingRequestsIcon, {backgroundColor: '#FFAC30'}]}>
              <Ionicons name="calendar" size={22} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.pendingRequestsTitle}>
                {meetingInvites.length} {translate('friends_page_new_meeting_invites')}
              </Text>
              <Text style={styles.pendingRequestsSubtitle}>
                {translate('friends_page_view_meeting_invites')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9797A9" />
        </TouchableOpacity>
      </View>
    );
  }, [meetingInvites, navigation]);

  // Aktif paylaşımlar bölümü için navigasyon işlevselliği
  const handleViewOnMap = () => {
    // Haritada aktif paylaşımları görüntüle
    navigation.navigate('MapPage', { 
      showActiveShares: true,
      initialSource: 'friendsPage'
    });
  };

  // Harita görünümüne geç butonu için işlevsellik
  const handleMapView = () => {
    navigation.navigate('MapPage');
  };

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#AE63E4"
            colors={["#AE63E4"]}
            progressBackgroundColor="#232333"
          />
        }
      >
        {/* Header Bölümü */}
        <LinearGradient 
          colors={['#252636', '#292A3E']} 
          start={{x: 0, y: 0}} 
          end={{x: 0, y: 1}}
          style={styles.header}
        >
          <View>
            <AnimatedHeaderTitle messages={welcomeMessages} />
          </View>
        </LinearGradient>
        
        {/* Hızlı Erişim Bölümü */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{translate('friends_page_quick_access')}</Text>
        </View>
        <View style={styles.quickOptionsSection}>
          <QuickOptions navigation={navigation} />
        </View>
        
        {/* Bekleyen İstekler Bölümü */}
        {pendingRequestsSection}
        
        {/* Bekleyen Grup Davetleri Bölümü */}
        {pendingGroupInvitesSection}
        
        {/* Bekleyen Buluşma Davetleri Bölümü */}
        {pendingMeetingInvitesSection}
        
        {/* Arkadaş Grupları Bölümü */}
        <View style={styles.friendGroupsSection}>
          <FriendGroups refreshKey={refreshKey} />
        </View>
        
        {/* Buluşmalar Bölümü */}
        <View style={styles.meetingsSection}>
          <Meetings navigation={navigation} refreshTrigger={meetingsRefreshKey} />
        </View>

        {/* Alt boşluk */}
        <View style={{ height: 20 }} />
      </ScrollView>

    </View>
  );
};

export default FriendsPage;