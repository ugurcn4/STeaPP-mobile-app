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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUserUid } from '../services/friendFunctions';
import { 
  fetchPendingGroupInvitations, 
  acceptGroupInvitation, 
  rejectGroupInvitation 
} from '../services/groupService';

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight;

const GroupInvitationsScreen = () => {
  const navigation = useNavigation();
  const [groupInvitations, setGroupInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const fetchUserId = async () => {
      const uid = await getCurrentUserUid();
      setCurrentUserId(uid);
    };
    
    fetchUserId();
    loadGroupInvitations();
  }, []);

  const loadGroupInvitations = async () => {
    try {
      setLoading(true);
      const uid = await getCurrentUserUid();
      if (!uid) return;
      
      const invitations = await fetchPendingGroupInvitations(uid);
      setGroupInvitations(invitations);
    } catch (error) {
      console.error('Grup davetleri yüklenirken hata:', error);
      Alert.alert('Hata', 'Grup davetleri yüklenirken bir sorun oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadGroupInvitations();
  };

  const handleAcceptInvitation = async (groupId) => {
    try {
      if (!currentUserId) return;
      
      await acceptGroupInvitation(groupId, currentUserId);
      setGroupInvitations(prev => prev.filter(invitation => invitation.id !== groupId));
      Alert.alert('Başarılı', 'Grup davetini kabul ettiniz');
      
      // Uygulamanın diğer bölümlerini yenilemek için
      navigation.navigate('FriendsPage', { refresh: true });
    } catch (error) {
      console.error('Grup daveti kabul edilirken hata:', error);
      Alert.alert('Hata', 'Grup daveti kabul edilirken bir sorun oluştu');
    }
  };

  const handleRejectInvitation = async (groupId) => {
    try {
      if (!currentUserId) return;
      
      await rejectGroupInvitation(groupId, currentUserId);
      setGroupInvitations(prev => prev.filter(invitation => invitation.id !== groupId));
      Alert.alert('Bilgi', 'Grup daveti reddedildi');
    } catch (error) {
      console.error('Grup daveti reddedilirken hata:', error);
      Alert.alert('Hata', 'Grup daveti reddedilirken bir sorun oluştu');
    }
  };

  const renderInvitationItem = (invitation) => {
    // Grup simgesi için rastgele bir arka plan rengi oluştur (varsayılan grup rengi yoksa)
    const backgroundColor = invitation.color || '#53B4DF';
    const iconName = invitation.icon || 'people';
    
    return (
      <View key={invitation.id} style={styles.invitationCard}>
        <View style={styles.groupInfo}>
          <View style={[styles.groupIcon, { backgroundColor }]}>
            <FontAwesome5 name={iconName} size={20} color="#FFFFFF" />
          </View>
          <View style={styles.groupDetails}>
            <Text style={styles.groupName}>{invitation.name}</Text>
            <Text style={styles.invitationText}>
              <Text style={styles.invitationTextBold}>{invitation.creatorName}</Text> seni gruba davet etti
            </Text>
            {invitation.description && (
              <Text style={styles.groupDescription} numberOfLines={2}>
                {invitation.description}
              </Text>
            )}
            <Text style={styles.groupMemberCount}>
              <Ionicons name="people" size={14} color="#9797A9" /> {invitation.memberCount} üye
            </Text>
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.rejectButton}
            onPress={() => handleRejectInvitation(invitation.id)}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Reddet</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={() => handleAcceptInvitation(invitation.id)}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Katıl</Text>
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
            <Ionicons name="arrow-back" size={24} color="#53B4DF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Grup Davetleri</Text>
          <View style={styles.actionButton} />
        </LinearGradient>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#53B4DF" />
            <Text style={styles.loadingText}>Davetler yükleniyor...</Text>
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
                colors={['#53B4DF']}
                tintColor="#53B4DF"
              />
            }
          >
            {groupInvitations.length > 0 ? (
              groupInvitations.map(invitation => renderInvitationItem(invitation))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people" size={48} color="#9797A9" />
                <Text style={styles.emptyText}>Bekleyen grup daveti yok</Text>
                <Text style={styles.emptySubText}>
                  Arkadaşlarının gönderdiği grup davetleri burada görünecek
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
    backgroundColor: '#1E1E2C',
    paddingTop: STATUSBAR_HEIGHT
  },
  container: {
    flex: 1,
    backgroundColor: '#1E1E2C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(83, 180, 223, 0.15)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actionButton: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#9797A9',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  invitationCard: {
    backgroundColor: '#252636',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  groupInfo: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  invitationText: {
    fontSize: 14,
    color: '#9797A9',
    marginBottom: 5,
  },
  invitationTextBold: {
    fontWeight: 'bold',
    color: '#BABABA',
  },
  groupDescription: {
    fontSize: 14,
    color: '#9797A9',
    marginBottom: 5,
  },
  groupMemberCount: {
    fontSize: 13,
    color: '#9797A9',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#32323E',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#53B4DF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E5E5E9',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#9797A9',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default GroupInvitationsScreen; 