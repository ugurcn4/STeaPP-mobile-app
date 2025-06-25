import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  Platform,
  SafeAreaView
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUserUid } from '../services/friendFunctions';
import { fetchUserGroups, fetchPendingGroupInvitations } from '../services/groupService';
import { translate } from '../i18n/i18n';


// Mor renk kodu
const PURPLE_COLOR = '#8A56AC';

const GroupsList = ({ onCreateGroup }) => {
  const navigation = useNavigation();
  const [userGroups, setUserGroups] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      
      const uid = await getCurrentUserUid();
      if (!uid) return;
      
      // Kullanıcının gruplarını getir
      const groups = await fetchUserGroups(uid);
      setUserGroups(groups);
      
      // Bekleyen grup davetlerini getir
      const invitations = await fetchPendingGroupInvitations(uid);
      setPendingInvitations(invitations);
    } catch (error) {
      console.error(translate('error_loading_groups'), error);
      Alert.alert(translate('error'), translate('error_loading_groups'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };
  
  const handleGroupPress = (group) => {
    navigation.navigate('GroupDetail', { groupId: group.id });
  };
  
  const handleInvitationsPress = () => {
    navigation.navigate('GroupInvitations');
  };
  
  // Yeni grup oluşturma sayfasına yönlendirme
  const handleCreateGroup = () => {
    navigation.navigate('CreateGroupScreen');
  };
  
  // Grupta aktif etkinlik var mı kontrol et
  const hasActiveEvents = (group) => {
    if (!group.events || !Array.isArray(group.events)) return false;
    
    const now = new Date();
    return group.events.some(event => new Date(event.date) >= now);
  };
  
  // Grup durumunu belirle
  const getGroupStatus = (group) => {
    if (hasActiveEvents(group)) {
      return {
        text: translate('group_status_active'),
        color: '#4CAF50'
      };
    }
    
    if (group.isActive) {
      return {
        text: translate('group_status_quiet'),
        color: '#FFAC30'
      };
    }
    
    return {
      text: translate('group_status_passive'),
      color: '#9797A9'
    };
  };
  
  const renderGroupCard = (group) => {
    const status = getGroupStatus(group);
    
    return (
      <TouchableOpacity 
        key={group.id} 
        style={styles.groupCard}
        onPress={() => handleGroupPress(group)}
      >
        <View style={[styles.groupIcon, { backgroundColor: group.color || '#53B4DF' }]}>
          <FontAwesome5 
            name={group.icon || 'users'} 
            size={20} 
            color="#FFFFFF" 
          />
        </View>
        
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          
          <View style={styles.groupMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="people" size={14} color="#9797A9" />
              <Text style={styles.metaText}>{group.members?.length || 0} {translate('group_meta_members')}</Text>
            </View>
            
            {group.events && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar" size={14} color="#9797A9" />
                <Text style={styles.metaText}>{group.events.length} {translate('group_meta_events')}</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.groupStatus}>
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9797A9" />
        </View>
      </TouchableOpacity>
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
        {/* Header */}
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
            <Ionicons name="arrow-back" size={24} color={PURPLE_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{translate('groups_page_title')}</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleCreateGroup}
          >
            <Ionicons name="add" size={24} color={PURPLE_COLOR} />
          </TouchableOpacity>
        </LinearGradient>
        
        {/* Davet Bildirimi - Yalnızca davet varsa göster */}
        {pendingInvitations.length > 0 && (
          <TouchableOpacity 
            style={styles.invitationsButton}
            onPress={handleInvitationsPress}
          >
            <Text style={styles.invitationsText}>
              {pendingInvitations.length} {translate('groups_invites')}
            </Text>
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>{pendingInvitations.length}</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PURPLE_COLOR} />
            <Text style={styles.loadingText}>{translate('groups_loading')}</Text>
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
                colors={[PURPLE_COLOR]}
                tintColor={PURPLE_COLOR}
              />
            }
          >
            {/* Grup Kartları */}
            {userGroups.length > 0 ? (
              <View style={styles.groupsContainer}>
                {userGroups.map(group => renderGroupCard(group))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people" size={48} color="#9797A9" />
                <Text style={styles.emptyText}>{translate('groups_no_groups')}</Text>
                <Text style={styles.emptySubText}>
                  {translate('groups_create_prompt')}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#252636',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight / 2 : 0 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#1E1E2C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 10 : 10,
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
  },
  invitationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138, 86, 172, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginTop: 15,
  },
  invitationsText: {
    color: PURPLE_COLOR,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  notificationBadge: {
    backgroundColor: '#FF4136',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
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
    marginTop: 16,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  groupsContainer: {
    marginTop: 8,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252636',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metaText: {
    color: '#9797A9',
    fontSize: 12,
    marginLeft: 4,
  },
  groupStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    marginTop: 40,
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

export default GroupsList; 