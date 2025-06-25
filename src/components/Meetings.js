import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { translate } from '../i18n/i18n';
import styles from '../styles/MeetingsStyles';
import { getCurrentUserUid } from '../services/friendFunctions';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import TimeInput from './TimeInput';
import MeetingDetailModal from './MeetingDetailModal';

const Meetings = ({ navigation, refreshTrigger = 0 }) => {
  const [userMeetings, setUserMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [userFriends, setUserFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date());
  const [meetingTime, setMeetingTime] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchFriendQuery, setSearchFriendQuery] = useState('');
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showMeetingDetailModal, setShowMeetingDetailModal] = useState(false);

  // Haftanın günleri
  const weekDays = translate('calendar_weekdays');
  
  // Şu anki tarih
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  
  // Sonraki 14 gün için tarih oluşturma
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  useEffect(() => {
    loadMeetings();
    loadFriends();
  }, []);

  useEffect(() => {
    if (refreshTrigger > 0) {
      loadMeetings();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    // Arkadaşları filtrele
    if (!searchFriendQuery.trim()) {
      setFilteredFriends(userFriends.filter(friend => !selectedFriends.some(f => f.id === friend.id)));
    } else {
      const query = searchFriendQuery.toLowerCase().trim();
      setFilteredFriends(
        userFriends
          .filter(friend => !selectedFriends.some(f => f.id === friend.id))
          .filter(friend => friend.name.toLowerCase().includes(query))
      );
    }
  }, [searchFriendQuery, userFriends, selectedFriends]);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const uid = await getCurrentUserUid();
      if (!uid) return;

      // Kullanıcının katıldığı etkinlikleri çek
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('participants', 'array-contains', uid),
        orderBy('createdAt', 'desc') // En yeni buluşmalar önce gelsin
      );

      const meetingsSnapshot = await getDocs(meetingsQuery);
      const meetingsPromises = meetingsSnapshot.docs.map(async (meetingDoc) => {
        const meetingData = meetingDoc.data();
        
        // Her katılımcının bilgilerini al
        const participantsData = await Promise.all(
          meetingData.participants.map(async (participantId) => {
            const userDoc = await getDoc(doc(db, 'users', participantId));
            if (userDoc.exists()) {
              return {
                id: participantId,
                name: userDoc.data().informations?.name || translate('meetings_unnamed_user'),
                profilePicture: userDoc.data().profilePicture || null
              };
            }
            return null;
          })
        );
        
        const validParticipants = participantsData.filter(p => p !== null);
        
        const meetingDate = meetingData.date?.toDate() || new Date();
        
        return {
          id: meetingDoc.id,
          ...meetingData,
          date: meetingDate,
          participantsData: validParticipants,
          // Ay adını Türkçeye çevir
          month: translate('calendar_months_short')[meetingDate.getMonth()],
          day: meetingDate.getDate()
        };
      });
      
      const meetingsData = await Promise.all(meetingsPromises);
      setUserMeetings(meetingsData);
    } catch (error) {
      console.error(translate('meetings_error_loading'), error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      setLoadingFriends(true);
      const uid = await getCurrentUserUid();
      if (!uid) return;

      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const friends = userData.friends || [];

      // Arkadaş detaylarını al
      if (friends.length > 0) {
        const friendDetails = await Promise.all(
          friends.map(async (friendId) => {
            const friendDoc = await getDoc(doc(db, 'users', friendId));
            if (friendDoc.exists()) {
              return {
                id: friendId,
                name: friendDoc.data().informations?.name || translate('meetings_unnamed_user'),
                profilePicture: friendDoc.data().profilePicture || null
              };
            }
            return null;
          })
        );
        
        setUserFriends(friendDetails.filter(friend => friend !== null));
      }
    } catch (error) {
      console.error(translate('meetings_error_friends_loading'), error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const createNewMeeting = async () => {
    try {
      if (!meetingTitle.trim() || !meetingLocation.trim() || !meetingTime.trim() || selectedFriends.length === 0) {
        alert(translate('meetings_error_validation'));
        return;
      }

      // Saat formatı kontrolü (XX:XX)
      const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(meetingTime)) {
        alert(translate('meetings_error_time_format'));
        return;
      }

      setLoading(true);
      
      const uid = await getCurrentUserUid();
      if (!uid) return;

      // Tüm katılımcıların listesini oluştur (kullanıcı + seçilen arkadaşlar)
      const participants = [uid, ...selectedFriends.map(friend => friend.id)];

      // Tarih ve saati birleştir
      const [hours, minutes] = meetingTime.split(':').map(Number);
      const meetingDateTime = new Date(meetingDate);
      meetingDateTime.setHours(hours, minutes, 0, 0);

      // Katılımcı durumlarını ayarla
      const participantStatus = {};
      participants.forEach(participantId => {
        // Oluşturan kişi otomatik olarak kabul etmiş sayılır
        participantStatus[participantId] = participantId === uid ? 'accepted' : 'pending';
      });

      // Yeni etkinlik belgesi oluştur
      await addDoc(collection(db, 'meetings'), {
        title: meetingTitle,
        location: meetingLocation,
        date: meetingDateTime,
        time: meetingTime,
        createdBy: uid,  // Bu kullanıcı yönetici olarak işaretlendi
        participants,
        participantStatus, // Katılımcı durumları
        createdAt: serverTimestamp(),
        status: 'active',
        adminId: uid     // Yönetici ID'sini ekliyoruz
      });

      // Modalı kapat ve formu temizle
      setShowNewMeetingModal(false);
      setMeetingTitle('');
      setMeetingLocation('');
      setMeetingTime('');
      setSelectedFriends([]);

      // Etkinlikleri hemen yeniden yükle
      await loadMeetings();
      
      alert(translate('meetings_success_created'));
    } catch (error) {
      console.error(translate('meetings_error_creating'), error);
      alert(translate('meetings_error_creating'));
    } finally {
      setLoading(false);
    }
  };

  // Seçili tarihi kontrol etme
  const isSameDay = (date1, date2) => {
    return date1.getDate() === date2.getDate() && 
           date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
  };
  
  // Etkinlik olup olmadığını kontrol etme
  const hasEvent = (date) => {
    return userMeetings.some(meeting => isSameDay(meeting.date, date));
  };

  // Türkçe ay adını al
  const getTurkishMonth = (date) => {
    const months = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
    return months[date.getMonth()];
  };

  // Türkçe ay adları - tam hali
  const turkishMonths = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  // Ayın ilk gününü hesapla
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  // Ayın kaç gün olduğunu hesapla
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Takvim günlerini oluştur
  const generateCalendarDays = () => {
    const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    
    // Pazarı haftanın ilk günü yapacak şekilde ayarla (0=Pazar, 1=Pazartesi, ...)
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    
    const days = [];
    
    // Önceki ayın günleri
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, isCurrentMonth: false });
    }
    
    // Mevcut ayın günleri
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(selectedYear, selectedMonth, i);
      days.push({ 
        day: i, 
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
        hasEvent: hasEvent(date),
        date: date
      });
    }
    
    // Satırları tamamlamak için sonraki ayın günleri
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        days.push({ day: i, isCurrentMonth: false });
      }
    }
    
    return days;
  };

  // Ay değiştirme fonksiyonları
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const selectDate = (date) => {
    if (date) {
      setMeetingDate(date);
      setShowCalendar(false);
    }
  };

  const toggleFriendSelection = (friend) => {
    if (selectedFriends.some(f => f.id === friend.id)) {
      setSelectedFriends(prev => prev.filter(f => f.id !== friend.id));
    } else {
      setSelectedFriends(prev => [...prev, friend]);
    }
  };

  const renderParticipants = (participants, totalParticipants) => {
    return (
      <View style={styles.avatarsContainer}>
        {participants.slice(0, 3).map((avatar, index) => (
          <FastImage
            key={index}
            source={{ uri: avatar }}
            style={[
              styles.participantAvatar,
              { zIndex: participants.length - index }
            ]}
            resizeMode={FastImage.resizeMode.cover}
          />
        ))}
        
        {totalParticipants > 3 && (
          <View style={styles.moreParticipants}>
            <Text style={styles.moreParticipantsText}>+{totalParticipants - 3}</Text>
          </View>
        )}
      </View>
    );
  };

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

  const handleOpenMeetingDetail = (meeting) => {
    setSelectedMeeting(meeting);
    setShowMeetingDetailModal(true);
  };

  const handleUpdateMeeting = (updatedMeeting) => {
    setUserMeetings(prevMeetings => 
      prevMeetings.map(meeting => 
        meeting.id === updatedMeeting.id ? updatedMeeting : meeting
      )
    );
    
    // Güncel toplantıyı seçili olarak ayarlayalım
    setSelectedMeeting(updatedMeeting);
  };

  const handleDeleteMeeting = (meetingId) => {
    setUserMeetings(prevMeetings => 
      prevMeetings.filter(meeting => meeting.id !== meetingId)
    );
    setShowMeetingDetailModal(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{translate('meetings_upcoming')}</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => navigation.navigate('AllMeetings')}
        >
          <Text style={styles.filterButtonText}>{translate('meetings_see_all')}</Text>
          <Ionicons name="chevron-forward" size={14} color="#FFAC30" />
        </TouchableOpacity>
      </View>
      
      {/* Takvim Görünümü */}
      <View style={styles.calendarContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarScrollContent}
        >
          {dates.map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, today);
            const hasEventForDate = hasEvent(date);
            
            return (
              <TouchableOpacity 
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.selectedDateItem
                ]}
                onPress={() => setSelectedDate(date)}
              >
                {/* Haftanın günü */}
                <Text style={[
                  styles.weekDay,
                  isSelected && styles.selectedWeekDay
                ]}>
                  {weekDays[date.getDay()]}
                </Text>

                {/* Tarih dairesi */}
                <View style={[
                  styles.dateCircle,
                  isSelected && styles.selectedDateCircle,
                  isToday && styles.todayCircle
                ]}>
                  <Text style={[
                    styles.dateNumber,
                    isSelected && styles.selectedDateNumber,
                    isToday && styles.todayNumber
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>

                {/* Etkinlik göstergesi */}
                {hasEventForDate && (
                  <View style={[
                    styles.eventDot,
                    isSelected && styles.selectedEventDot
                  ]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FFAC30" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.eventsScrollContainer}
        >
          <TouchableOpacity 
            style={styles.createEventCard}
            onPress={() => setShowNewMeetingModal(true)}
          >
            <View style={styles.createEventIcon}>
              <MaterialCommunityIcons name="calendar-plus" size={24} color="#FFFFFF" />
              <View style={styles.plusBadge}>
                <Text style={styles.plusBadgeText}>+</Text>
              </View>
            </View>
            <Text style={styles.createEventText}>{translate('meetings_create')}</Text>
          </TouchableOpacity>
          
          {userMeetings.length > 0 ? (
            userMeetings.map((meeting) => (
              <TouchableOpacity 
                key={meeting.id} 
                style={styles.eventCard}
                onPress={() => handleOpenMeetingDetail(meeting)}
              >
                <View style={styles.eventDateBadge}>
                  <Text style={styles.eventDay}>{meeting.day}</Text>
                  <Text style={styles.eventMonth}>{meeting.month}</Text>
                </View>
                
                <Text style={styles.eventTitle}>{meeting.title}</Text>
                <Text style={styles.eventTime}>{meeting.time}</Text>
                
                <View style={styles.eventLocation}>
                  <Ionicons name="location" size={14} color="#9797A9" />
                  <Text style={styles.eventLocationText} numberOfLines={1}>
                    {meeting.location}
                  </Text>
                </View>
                
                <View style={styles.eventDivider} />
                
                <View style={styles.eventFooter}>
                  {renderParticipantsData(meeting.participantsData)}
                  <TouchableOpacity 
                    style={styles.joinButton}
                    onPress={(e) => {
                      e.stopPropagation(); // Tıklamanın üst bileşene geçmesini engelle
                      handleOpenMeetingDetail(meeting);
                    }}
                  >
                    <Text style={styles.joinButtonText}>{translate('meetings_detail')}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyMeetingsContainer}>
              <MaterialCommunityIcons name="calendar-remove" size={48} color="#9797A9" />
              <Text style={styles.emptyMeetingsText}>{translate('meetings_empty')}</Text>
              <Text style={styles.emptyMeetingsSubText}>{translate('meetings_empty_subtitle')}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Yeni Etkinlik Oluşturma Modalı */}
      <Modal
        visible={showNewMeetingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewMeetingModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translate('meetings_new')}</Text>
              <TouchableOpacity onPress={() => setShowNewMeetingModal(false)}>
                <Ionicons name="close" size={24} color="#FFAC30" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContainer}
            >
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{translate('meetings_title_label')}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={translate('meetings_title_placeholder')}
                  placeholderTextColor="#9797A9"
                  value={meetingTitle}
                  onChangeText={setMeetingTitle}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{translate('meetings_location_label')}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={translate('meetings_location_placeholder')}
                  placeholderTextColor="#9797A9"
                  value={meetingLocation}
                  onChangeText={setMeetingLocation}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{translate('meetings_date_label')}</Text>
                <TouchableOpacity 
                  style={styles.datePickerButton}
                  onPress={() => setShowCalendar(!showCalendar)}
                >
                  <Text style={styles.datePickerButtonText}>
                    {meetingDate.getDate()} {translate('calendar_months')[meetingDate.getMonth()]} {meetingDate.getFullYear()}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#FFAC30" />
                </TouchableOpacity>

                {showCalendar && (
                  <View style={styles.calendarWrapper}>
                    <View style={styles.calendarHeader}>
                      <TouchableOpacity onPress={goToPreviousMonth}>
                        <Ionicons name="chevron-back" size={24} color="#FFAC30" />
                      </TouchableOpacity>
                      <Text style={styles.calendarTitle}>
                        {turkishMonths[selectedMonth]} {selectedYear}
                      </Text>
                      <TouchableOpacity onPress={goToNextMonth}>
                        <Ionicons name="chevron-forward" size={24} color="#FFAC30" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.weekDaysHeader}>
                      {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'].map((day, index) => (
                        <Text key={index} style={styles.weekDayText}>{day}</Text>
                      ))}
                    </View>

                    <View style={styles.calendarGrid}>
                      {generateCalendarDays().map((day, index) => (
                        <TouchableOpacity 
                          key={index}
                          style={[
                            styles.calendarDay,
                            !day.isCurrentMonth && styles.calendarDayDisabled,
                            day.isToday && styles.calendarDayToday,
                            day.date && isSameDay(day.date, meetingDate) && styles.calendarDaySelected,
                          ]}
                          disabled={!day.isCurrentMonth}
                          onPress={() => day.date && selectDate(day.date)}
                        >
                          <Text style={[
                            styles.calendarDayText,
                            !day.isCurrentMonth && styles.calendarDayTextDisabled,
                            day.isToday && styles.calendarDayTextToday,
                            day.date && isSameDay(day.date, meetingDate) && styles.calendarDayTextSelected,
                          ]}>
                            {day.day}
                          </Text>
                          {day.hasEvent && <View style={styles.calendarEventDot} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{translate('meetings_time_label')}</Text>
                <TimeInput 
                  value={meetingTime}
                  onChangeText={setMeetingTime}
                />
                <Text style={styles.formHint}>{translate('meetings_time_hint')}</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{translate('meetings_participants_label')}</Text>
                <Text style={styles.formInfo}>
                  <Ionicons name="information-circle-outline" size={14} color="#FFAC30" /> {translate('meetings_participants_info')}
                </Text>
                {loadingFriends ? (
                  <ActivityIndicator size="small" color="#FFAC30" />
                ) : (
                  <>
                    <View style={styles.selectedFriendsContainer}>
                      {selectedFriends.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {selectedFriends.map(friend => (
                            <View key={friend.id} style={styles.selectedFriendChip}>
                              {friend.profilePicture ? (
                                <FastImage 
                                  source={{ uri: friend.profilePicture }} 
                                  style={styles.selectedFriendAvatar}
                                  resizeMode={FastImage.resizeMode.cover}
                                />
                              ) : (
                                <View style={styles.selectedFriendAvatarPlaceholder}>
                                  <Text style={styles.selectedFriendAvatarText}>{friend.name.charAt(0)}</Text>
                                </View>
                              )}
                              <Text style={styles.selectedFriendName} numberOfLines={1}>
                                {friend.name}
                              </Text>
                              <TouchableOpacity 
                                style={styles.removeSelectedFriendButton}
                                onPress={() => toggleFriendSelection(friend)}
                              >
                                <Ionicons name="close-circle" size={18} color="#FFAC30" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={styles.noSelectedFriendsText}>{translate('meetings_no_selected_friends')}</Text>
                      )}
                    </View>

                    <Text style={styles.friendsSelectionLabel}>{translate('meetings_friends_label')}</Text>
                    
                    <View style={styles.searchFriendContainer}>
                      <TextInput
                        style={styles.searchFriendInput}
                        placeholder={translate('meetings_search_friends')}
                        placeholderTextColor="#9797A9"
                        value={searchFriendQuery}
                        onChangeText={setSearchFriendQuery}
                      />
                      {searchFriendQuery.length > 0 && (
                        <TouchableOpacity 
                          style={styles.clearSearchButton}
                          onPress={() => setSearchFriendQuery('')}
                        >
                          <Ionicons name="close-circle" size={20} color="#9797A9" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {userFriends.length > 0 ? (
                      filteredFriends.length > 0 ? (
                        <View style={styles.friendsListContainer}>
                          <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={true}>
                            {filteredFriends.map(item => (
                              <TouchableOpacity 
                                key={item.id}
                                style={styles.friendItem}
                                onPress={() => toggleFriendSelection(item)}
                              >
                                {item.profilePicture ? (
                                  <FastImage 
                                    source={{ uri: item.profilePicture }} 
                                    style={styles.friendAvatar}
                                    resizeMode={FastImage.resizeMode.cover}
                                  />
                                ) : (
                                  <View style={styles.friendAvatarPlaceholder}>
                                    <Text style={styles.friendAvatarText}>{item.name.charAt(0)}</Text>
                                  </View>
                                )}
                                <Text style={styles.friendName} numberOfLines={1}>
                                  {item.name}
                                </Text>
                                <Ionicons name="add-circle" size={22} color="#44D7B6" />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      ) : (
                        <Text style={styles.noSearchResultsText}>
                          "{searchFriendQuery}" {translate('meetings_no_search_results')}
                        </Text>
                      )
                    ) : (
                      <Text style={styles.noFriendsText}>{translate('meetings_no_friends')}</Text>
                    )}
                  </>
                )}
              </View>

              <View style={styles.spacer}></View>
            </ScrollView>
            
            <TouchableOpacity 
              style={[styles.createButton, { position: 'absolute', bottom: 20, left: 20, right: 20 }]}
              onPress={createNewMeeting}
            >
              <Text style={styles.createButtonText}>{translate('meetings_create_button')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Buluşma Detay Modalı */}
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

export default Meetings; 