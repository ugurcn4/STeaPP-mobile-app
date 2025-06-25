import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity, StyleSheet,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getCurrentUserUid } from '../services/friendFunctions';
import MeetingDetailModal from '../components/MeetingDetailModal';
import { translate } from '../i18n/i18n';

const AllMeetingsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [userMeetings, setUserMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showMeetingDetailModal, setShowMeetingDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' veya 'past'

  // Sayfa açıldığında etkinlikleri yükle
  useEffect(() => {
    loadMeetings();
  }, []);

  // Türkçe ay adını al
  const getTurkishMonth = (date) => {
    return translate('calendar_months_short')[date.getMonth()];
  };

  // Etkinlikleri yükle
  const loadMeetings = async () => {
    try {
      setLoading(true);
      const uid = await getCurrentUserUid();
      if (!uid) return;

      // Kullanıcının katıldığı etkinlikleri çek
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('participants', 'array-contains', uid)
      );

      const meetingsSnapshot = await getDocs(meetingsQuery);
      const meetingsData = [];

      for (const meetingDoc of meetingsSnapshot.docs) {
        const meetingData = meetingDoc.data();
        
        // Her katılımcının bilgilerini al
        const participantsData = await Promise.all(
          meetingData.participants.map(async (participantId) => {
            const userDoc = await getDoc(doc(db, 'users', participantId));
            if (userDoc.exists()) {
              return {
                id: participantId,
                name: userDoc.data().informations?.name || translate('all_meetings_unnamed_user'),
                profilePicture: userDoc.data().profilePicture || null
              };
            }
            return null;
          })
        );
        
        const validParticipants = participantsData.filter(p => p !== null);
        
        // Tarih objesi oluştur
        const meetingDate = meetingData.date?.toDate() || new Date();
        
        meetingsData.push({
          id: meetingDoc.id,
          ...meetingData,
          date: meetingDate,
          participantsData: validParticipants,
          month: getTurkishMonth(meetingDate),
          day: meetingDate.getDate(),
          isPast: meetingDate < new Date() // Geçmiş etkinlik mi kontrol et
        });
      }
      
      // Tarihe göre sırala (yaklaşan etkinlikler için artan, geçmiş etkinlikler için azalan)
      meetingsData.sort((a, b) => {
        if (a.isPast && b.isPast) {
          return b.date - a.date; // Geçmiş etkinlikler için en son olan en üstte
        } else if (!a.isPast && !b.isPast) {
          return a.date - b.date; // Yaklaşan etkinlikler için en yakın olan en üstte
        } else {
          return a.isPast ? 1 : -1; // Yaklaşan etkinlikler önce gösterilir
        }
      });
      
      setUserMeetings(meetingsData);
    } catch (error) {
      console.error(translate('all_meetings_error_loading'), error);
    } finally {
      setLoading(false);
    }
  };

  // Etkinlik detayını aç
  const handleOpenMeetingDetail = (meeting) => {
    setSelectedMeeting(meeting);
    setShowMeetingDetailModal(true);
  };

  // Etkinlik güncellendiğinde
  const handleUpdateMeeting = (updatedMeeting) => {
    setUserMeetings(prevMeetings => 
      prevMeetings.map(meeting => 
        meeting.id === updatedMeeting.id ? updatedMeeting : meeting
      )
    );
    
    // Güncel etkinliği seçili olarak ayarla
    setSelectedMeeting(updatedMeeting);
  };

  // Etkinlik silindiğinde
  const handleDeleteMeeting = (meetingId) => {
    setUserMeetings(prevMeetings => 
      prevMeetings.filter(meeting => meeting.id !== meetingId)
    );
    setShowMeetingDetailModal(false);
  };

  // Katılımcı avatarlarını render et
  const renderParticipantsData = (participantsData) => {
    return (
      <View style={styles.avatarsContainer}>
        {participantsData.slice(0, 3).map((participant, index) => (
          <View key={index} style={[styles.participantAvatar, { zIndex: participantsData.length - index }]}>
            {participant.profilePicture ? (
              <FastImage 
                source={{ uri: participant.profilePicture }} 
                style={{ width: '100%', height: '100%', borderRadius: 16 }}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <View style={{ 
                width: '100%', 
                height: '100%', 
                borderRadius: 16,
                backgroundColor: '#FFAC30',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                  {participant.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>
        ))}
        
        {participantsData.length > 3 && (
          <View style={styles.moreParticipants}>
            <Text style={styles.moreParticipantsText}>+{participantsData.length - 3}</Text>
          </View>
        )}
      </View>
    );
  };

  // Tarih formatını düzenle ve Türkçe gün adını döndür
  const formatDateToTurkish = (date) => {
    const days = translate('days_full');
    const months = translate('months_full');
    
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Etkinlik kartını render et
  const renderMeetingItem = ({ item }) => {
    // Filtreleme - sadece aktif sekmeye uygun etkinlikleri göster
    if ((activeTab === 'upcoming' && item.isPast) || (activeTab === 'past' && !item.isPast)) {
      return null;
    }
    
    return (
      <TouchableOpacity 
        style={styles.meetingCard}
        onPress={() => handleOpenMeetingDetail(item)}
      >
        <View style={styles.meetingHeader}>
          <View style={styles.dateContainer}>
            <LinearGradient
              colors={item.isPast ? ['#9797A9', '#52525E'] : ['#FFAC30', '#FF8E2B']}
              style={styles.dateBadge}
            >
              <Text style={styles.dateDay}>{item.day}</Text>
              <Text style={styles.dateMonth}>{item.month}</Text>
            </LinearGradient>
            <Text style={styles.fullDate}>{formatDateToTurkish(item.date)}</Text>
          </View>
          {item.isPast && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{translate('all_meetings_completed')}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.meetingContent}>
          <Text style={styles.meetingTitle}>{item.title}</Text>
          <View style={styles.meetingTimeLocation}>
            <View style={styles.meetingInfoItem}>
              <Ionicons name="time-outline" size={16} color="#9797A9" />
              <Text style={styles.meetingInfoText}>{item.time}</Text>
            </View>
            <View style={styles.meetingInfoItem}>
              <Ionicons name="location-outline" size={16} color="#9797A9" />
              <Text style={styles.meetingInfoText} numberOfLines={1}>{item.location}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.meetingFooter}>
          {renderParticipantsData(item.participantsData)}
          <TouchableOpacity 
            style={styles.detailButton}
            onPress={() => handleOpenMeetingDetail(item)}
          >
            <Text style={styles.detailButtonText}>{translate('all_meetings_details')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Filtrelenmiş etkinlik sayısını hesapla
  const getFilteredMeetingsCount = (isPast) => {
    return userMeetings.filter(meeting => meeting.isPast === isPast).length;
  };

  // Ekranın üst kısmındaki sekmeler
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
        onPress={() => setActiveTab('upcoming')}
      >
        <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
          {translate('all_meetings_tab_upcoming')} ({getFilteredMeetingsCount(false)})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'past' && styles.activeTab]}
        onPress={() => setActiveTab('past')}
      >
        <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
          {translate('all_meetings_tab_past')} ({getFilteredMeetingsCount(true)})
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      
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
          <Ionicons name="arrow-back" size={24} color="#FFAC30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{translate('all_meetings_title')}</Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Meetings')}
        >
          <Ionicons name="add" size={24} color="#FFAC30" />
        </TouchableOpacity>
      </LinearGradient>
      
      {/* Sekmeler */}
      {renderTabs()}
      
      {/* Etkinlik Listesi */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFAC30" />
          <Text style={styles.loadingText}>{translate('all_meetings_loading')}</Text>
        </View>
      ) : userMeetings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="calendar-blank" size={80} color="#9797A9" />
          <Text style={styles.emptyText}>{translate('all_meetings_empty')}</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => navigation.navigate('FriendsPage')}
          >
            <Text style={styles.createButtonText}>{translate('all_meetings_create')}</Text>
          </TouchableOpacity>
        </View>
      ) : getFilteredMeetingsCount(activeTab === 'past') === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons 
            name={activeTab === 'upcoming' ? 'calendar-clock' : 'calendar-check'} 
            size={80} 
            color="#9797A9" 
          />
          <Text style={styles.emptyText}>
            {translate(activeTab === 'upcoming' ? 'all_meetings_empty_upcoming' : 'all_meetings_empty_past')}
          </Text>
          {activeTab === 'upcoming' && (
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => navigation.navigate('FriendsPage')}
            >
              <Text style={styles.createButtonText}>{translate('all_meetings_create')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={userMeetings}
          renderItem={renderMeetingItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      {/* Etkinlik Detay Modalı */}
      <MeetingDetailModal
        visible={showMeetingDetailModal}
        onClose={() => setShowMeetingDetailModal(false)}
        meeting={selectedMeeting}
        onUpdate={handleUpdateMeeting}
        onDelete={handleDeleteMeeting}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E2C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#252636',
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#252636',
  },
  activeTab: {
    backgroundColor: '#FFAC30',
  },
  tabText: {
    color: '#9797A9',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#9797A9',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyText: {
    color: '#9797A9',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  createButton: {
    backgroundColor: '#FFAC30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  meetingCard: {
    backgroundColor: '#252636',
    borderRadius: 12,
    marginBottom: 16,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateBadge: {
    width: 45,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateDay: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateMonth: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  fullDate: {
    color: '#E5E5E9',
    fontSize: 14,
  },
  statusBadge: {
    backgroundColor: 'rgba(151, 151, 169, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#9797A9',
    fontSize: 12,
    fontWeight: '500',
  },
  meetingContent: {
    marginBottom: 12,
  },
  meetingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  meetingTimeLocation: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  meetingInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  meetingInfoText: {
    color: '#9797A9',
    fontSize: 14,
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(151, 151, 169, 0.2)',
    marginVertical: 12,
  },
  meetingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarsContainer: {
    flexDirection: 'row',
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: -10,
    borderWidth: 2,
    borderColor: '#252636',
    overflow: 'hidden',
  },
  moreParticipants: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#32323E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#252636',
  },
  moreParticipantsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  detailButton: {
    backgroundColor: 'rgba(255, 172, 48, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  detailButtonText: {
    color: '#FFAC30',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AllMeetingsScreen; 