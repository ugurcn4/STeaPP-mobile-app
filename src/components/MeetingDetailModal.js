import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { getCurrentUserUid } from '../services/friendFunctions';
import styles from '../styles/MeetingDetailModalStyles';
import TimeInput from './TimeInput';

const MeetingDetailModal = ({ visible, onClose, meeting, onUpdate, onDelete }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
  const [editedTime, setEditedTime] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    const checkCurrentUser = async () => {
      const uid = await getCurrentUserUid();
      setCurrentUserId(uid);
      
      if (meeting) {
        // Kulllanıcı yönetici mi kontrol et
        setIsAdmin(meeting.adminId === uid || meeting.createdBy === uid);
        
        // Düzenleme için değerleri ayarla
        setEditedTitle(meeting.title);
        setEditedLocation(meeting.location);
        setEditedTime(meeting.time);
      }
    };
    
    checkCurrentUser();
  }, [meeting]);

  if (!meeting) return null;

  // Katılımcı durumlarını kontrol et
  const getParticipantStatus = (participantId) => {
    if (!meeting.participantStatus || !meeting.participantStatus[participantId]) {
      return 'pending'; // Varsayılan durum: beklemede
    }
    return meeting.participantStatus[participantId];
  };

  // Kullanıcının katılım durumunu kontrol et
  const getCurrentUserStatus = () => {
    return getParticipantStatus(currentUserId);
  };

  const formatDate = (date) => {
    // Firebase'den gelen timestamp formatını Date objesine çevirme kontrolü
    if (date && typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
      date = date.toDate();
    }
    
    // Date kontrolü
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    return date.toLocaleDateString('tr-TR', options);
  };

  const handleUpdateMeeting = async () => {
    if (!editedTitle.trim() || !editedLocation.trim() || !editedTime.trim()) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    try {
      setLoading(true);

      // Saat formatı kontrolü (XX:XX)
      const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(editedTime)) {
        Alert.alert('Hata', 'Lütfen geçerli bir saat formatı girin (örn: 14:30)');
        setLoading(false);
        return;
      }

      const meetingRef = doc(db, 'meetings', meeting.id);
      
      // Tarih ve saati birleştir
      const [hours, minutes] = editedTime.split(':').map(Number);
      
      let updatedDate;
      // meeting.date kontrol edilir, geçerli bir Date nesnesi mi?
      if (meeting.date && meeting.date instanceof Date && !isNaN(meeting.date.getTime())) {
        updatedDate = new Date(meeting.date);
      } else {
        // Eğer date geçerli değilse bugünün tarihini kullan
        updatedDate = new Date();
      }
      
      updatedDate.setHours(hours, minutes, 0, 0);
      
      // Arayüz güncellemesi için hemen meeting nesnesini güncelle
      const updatedMeeting = {
        ...meeting,
        title: editedTitle,
        location: editedLocation,
        time: editedTime,
        date: updatedDate
      };
      
      // Hemen UI'yi güncelle
      if (onUpdate) {
        onUpdate(updatedMeeting);
      }
      
      await updateDoc(meetingRef, {
        title: editedTitle,
        location: editedLocation,
        time: editedTime,
        date: updatedDate,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId
      });

      // Güncelleme başarılı olduğu zaman düzenleme modunu kapat
      setIsEditing(false);
      
      Alert.alert('Başarılı', 'Buluşma bilgileri güncellendi');
    } catch (error) {
      console.error('Buluşma güncellenirken hata:', error);
      Alert.alert('Hata', 'Buluşma güncellenirken bir sorun oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async () => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'meetings', meeting.id));
      
      // Silme işlemi başarılı olduğunda modalı kapat
      if (onDelete) {
        onDelete(meeting.id);
      }
      
      onClose();
      Alert.alert('Başarılı', 'Buluşma silindi');
    } catch (error) {
      console.error('Buluşma silinirken hata:', error);
      Alert.alert('Hata', 'Buluşma silinirken bir sorun oluştu');
    } finally {
      setLoading(false);
      setShowConfirmDelete(false);
    }
  };

  const handleJoinMeeting = async () => {
    try {
      const isParticipant = meeting.participants?.includes(currentUserId);
      
      if (isParticipant) {
        Alert.alert('Bilgi', 'Bu buluşmaya zaten katılıyorsunuz');
        return;
      }
      
      setLoading(true);
      
      // Katılımcı listesini güncelle
      const updatedParticipants = [...(meeting.participants || []), currentUserId];
      
      // Katılımcı durumunu 'accepted' olarak ayarla
      const updatedParticipantStatus = { 
        ...(meeting.participantStatus || {}), 
        [currentUserId]: 'accepted' 
      };
      
      // Arayüz güncellemesi için hemen meeting nesnesini güncelle
      const updatedMeeting = {
        ...meeting,
        participants: updatedParticipants,
        participantStatus: updatedParticipantStatus
      };
      
      // Hemen UI'yi güncelle
      if (onUpdate) {
        onUpdate(updatedMeeting);
      }
      
      const meetingRef = doc(db, 'meetings', meeting.id);
      await updateDoc(meetingRef, {
        participants: updatedParticipants,
        participantStatus: updatedParticipantStatus
      });
      
      // Güncel buluşma verisini al
      const updatedMeetingDoc = await getDoc(meetingRef);
      if (updatedMeetingDoc.exists() && onUpdate) {
        const updatedData = updatedMeetingDoc.data();
        let date = updatedData.date;
        
        // Firebase timestamp'i Date nesnesine çevir
        if (date && typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
          date = date.toDate();
        }
        
        const updatedMeetingData = {
          id: meeting.id,
          ...updatedData,
          date: date,
          // Katılımcı verilerini koru veya boş dizi olarak ayarla
          participantsData: meeting.participantsData || []
        };
        
        onUpdate(updatedMeetingData);
      }
      
      Alert.alert('Başarılı', 'Buluşmaya katıldınız');
    } catch (error) {
      console.error('Buluşmaya katılırken hata:', error);
      Alert.alert('Hata', 'Buluşmaya katılırken bir sorun oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Katılım durumunu güncelle
  const updateParticipationStatus = async (status) => {
    try {
      setLoading(true);
      
      // Katılımcı durumunu güncelle
      const updatedParticipantStatus = { 
        ...(meeting.participantStatus || {}), 
        [currentUserId]: status 
      };
      
      // Arayüz güncellemesi için hemen meeting nesnesini güncelle
      const updatedMeeting = {
        ...meeting,
        participantStatus: updatedParticipantStatus
      };
      
      // Hemen UI'yi güncelle
      if (onUpdate) {
        onUpdate(updatedMeeting);
      }
      
      const meetingRef = doc(db, 'meetings', meeting.id);
      await updateDoc(meetingRef, {
        participantStatus: updatedParticipantStatus
      });
      
      // Eğer durum 'declined' ise ve katılımcılardan çıkarılması gerekiyorsa
      if (status === 'declined') {
        // Katılımcıları güncelle (isteğe bağlı)
        // Bu örnekte declined olan kişiler listede kalacak ama durumları görünecek
      }
      
      // Güncel buluşma verisini al ve date nesnesini kontrol et
      const updatedMeetingDoc = await getDoc(meetingRef);
      if (updatedMeetingDoc.exists() && onUpdate) {
        const updatedData = updatedMeetingDoc.data();
        let date = updatedData.date;
        
        // Firebase timestamp'i Date nesnesine çevir
        if (date && typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
          date = date.toDate();
        }
        
        const updatedMeetingData = {
          id: meeting.id,
          ...updatedData,
          date: date,
          // Katılımcı verilerini koru veya boş dizi olarak ayarla
          participantsData: meeting.participantsData || []
        };
        
        onUpdate(updatedMeetingData);
      }
      
      const statusText = status === 'accepted' ? 'kabul ettiniz' : 'reddettiniz';
      Alert.alert('Başarılı', `Buluşmayı ${statusText}`);
    } catch (error) {
      console.error('Katılım durumu güncellenirken hata:', error);
      Alert.alert('Hata', 'Katılım durumu güncellenirken bir sorun oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Duruma göre badge rengini belirle
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'accepted':
        return [styles.statusBadge, styles.acceptedBadge];
      case 'declined':
        return [styles.statusBadge, styles.declinedBadge];
      case 'pending':
      default:
        return [styles.statusBadge, styles.pendingBadge];
    }
  };

  // Duruma göre metin belirle
  const getStatusText = (status) => {
    switch (status) {
      case 'accepted':
        return 'Katılıyor';
      case 'declined':
        return 'Katılmıyor';
      case 'pending':
      default:
        return 'Yanıt Bekliyor';
    }
  };

  const renderParticipants = () => {
    if (!meeting.participantsData || !Array.isArray(meeting.participantsData) || meeting.participantsData.length === 0) {
      return (
        <Text style={styles.noParticipantsText}>Henüz katılımcı yok</Text>
      );
    }

    return (
      <View style={styles.participantsList}>
        {meeting.participantsData.map((participant) => {
          const participantStatus = getParticipantStatus(participant.id);
          const isCurrentUser = participant.id === currentUserId;
          
          return (
            <View key={participant.id} style={styles.participantItem}>
              {participant.profilePicture ? (
                <FastImage 
                  source={{ uri: participant.profilePicture }} 
                  style={styles.participantAvatar}
                  resizeMode={FastImage.resizeMode.cover}
                />
              ) : (
                <View style={styles.participantAvatarPlaceholder}>
                  <Text style={styles.participantAvatarText}>
                    {participant.name && participant.name.length > 0 ? participant.name.charAt(0) : '?'}
                  </Text>
                </View>
              )}
              <View style={styles.participantInfo}>
                <View>
                  <Text style={styles.participantName}>
                    {participant.name || 'İsimsiz Kullanıcı'}
                    {isCurrentUser && ' (Sen)'}
                  </Text>
                  
                  {participant.id === meeting.adminId ? (
                    <Text style={styles.adminBadge}>Yönetici</Text>
                  ) : (
                    <Text style={getStatusBadgeStyle(participantStatus)}>
                      {getStatusText(participantStatus)}
                    </Text>
                  )}
                  
                  {/* Katılma/reddetme butonları - sadece kendi için ve admin değilse */}
                  {isCurrentUser && participant.id !== meeting.adminId && (
                    <View style={styles.participantActions}>
                      {participantStatus !== 'accepted' && (
                        <TouchableOpacity 
                          style={[styles.statusButton, styles.acceptButton]}
                          onPress={() => updateParticipationStatus('accepted')}
                        >
                          <Text style={[styles.statusButtonText, styles.acceptButtonText]}>
                            Kabul Et
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      {participantStatus !== 'declined' && (
                        <TouchableOpacity 
                          style={[styles.statusButton, styles.declineButton]}
                          onPress={() => updateParticipationStatus('declined')}
                        >
                          <Text style={[styles.statusButtonText, styles.declineButtonText]}>
                            Reddet
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
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
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="arrow-back" size={24} color="#FFAC30" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isEditing ? 'Buluşmayı Düzenle' : 'Buluşma Detayları'}
            </Text>
            {isAdmin && !isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                <MaterialIcons name="edit" size={24} color="#FFAC30" />
              </TouchableOpacity>
            )}
            {isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelButton}>
                <MaterialIcons name="close" size={24} color="#FFAC30" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFAC30" />
              <Text style={styles.loadingText}>İşlem yapılıyor...</Text>
            </View>
          ) : showConfirmDelete ? (
            <View style={styles.confirmDeleteContainer}>
              <MaterialIcons name="warning" size={64} color="#FF4136" />
              <Text style={styles.confirmDeleteTitle}>Buluşmayı Sil</Text>
              <Text style={styles.confirmDeleteText}>
                Bu buluşmayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
              </Text>
              <View style={styles.confirmButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.confirmButton, styles.cancelDeleteButton]}
                  onPress={() => setShowConfirmDelete(false)}
                >
                  <Text style={styles.cancelDeleteButtonText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmButton, styles.confirmDeleteButton]}
                  onPress={handleDeleteMeeting}
                >
                  <Text style={styles.confirmDeleteButtonText}>Evet, Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.detailsContainer}>
              {isEditing ? (
                // Düzenleme Formu
                <View style={[styles.detailsContent, styles.editForm]}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Başlık</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editedTitle}
                      onChangeText={setEditedTitle}
                      placeholder="Buluşma başlığı"
                      placeholderTextColor="#9797A9"
                    />
                  </View>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Konum</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editedLocation}
                      onChangeText={setEditedLocation}
                      placeholder="Buluşma konumu"
                      placeholderTextColor="#9797A9"
                    />
                  </View>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Tarih</Text>
                    <Text style={styles.dateText}>
                      {formatDate(meeting.date)}
                    </Text>
                    <Text style={styles.dateHint}>
                      Tarih şu an düzenlenemiyor. Bunun için yeni bir buluşma oluşturun.
                    </Text>
                  </View>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Saat (24 saat formatı)</Text>
                    <TimeInput
                      value={editedTime}
                      onChangeText={setEditedTime}
                    />
                    <Text style={styles.formHint}>Örnek: 14:30, 08:15 gibi</Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleUpdateMeeting}
                  >
                    <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>
                  </TouchableOpacity>
                  
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => setShowConfirmDelete(true)}
                    >
                      <Text style={styles.deleteButtonText}>Buluşmayı Sil</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                // Buluşma Detayları
                <>
                  <View style={styles.detailsContent}>
                    <View style={styles.meetingHeader}>
                      <View style={styles.meetingDateBadge}>
                        <Text style={styles.meetingDay}>{meeting.day}</Text>
                        <Text style={styles.meetingMonth}>{meeting.month}</Text>
                      </View>
                      <View style={styles.meetingHeaderInfo}>
                        <Text style={styles.meetingTitle}>{meeting.title}</Text>
                        <Text style={styles.meetingTime}>{meeting.time}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="calendar" size={22} color="#FFAC30" />
                      </View>
                      <View style={styles.detailInfo}>
                        <Text style={styles.detailLabel}>Tarih</Text>
                        <Text style={styles.detailText}>{formatDate(meeting.date)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="location" size={22} color="#FFAC30" />
                      </View>
                      <View style={styles.detailInfo}>
                        <Text style={styles.detailLabel}>Konum</Text>
                        <Text style={styles.detailText}>{meeting.location}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Katılımcılar</Text>
                      {renderParticipants()}
                    </View>

                    {/* Kullanıcı katılımcı değilse katılım butonu göster */}
                    {!(meeting.participants && Array.isArray(meeting.participants) && meeting.participants.includes(currentUserId)) && (
                      <TouchableOpacity
                        style={styles.joinButton}
                        onPress={handleJoinMeeting}
                      >
                        <Ionicons name="person-add" size={20} color="#FFFFFF" />
                        <Text style={styles.joinButtonText}>Buluşmaya Katıl</Text>
                      </TouchableOpacity>
                    )}
                    
                    {/* Kullanıcı katılımcı ise ve admin değilse, durumu 'pending' ise katılım butonları göster */}
                    {meeting.participants && Array.isArray(meeting.participants) && meeting.participants.includes(currentUserId) && 
                     !isAdmin && 
                     getCurrentUserStatus() === 'pending' && (
                      <View style={styles.participationActionsContainer}>
                        <TouchableOpacity
                          style={[styles.participationButton, styles.acceptButton]}
                          onPress={() => updateParticipationStatus('accepted')}
                        >
                          <Ionicons name="checkmark-circle" size={20} color="#44D7B6" />
                          <Text style={[styles.participationButtonText, styles.acceptButtonText]}>
                            Katılacağım
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.participationButton, styles.declineButton]}
                          onPress={() => updateParticipationStatus('declined')}
                        >
                          <Ionicons name="close-circle" size={20} color="#FF4136" />
                          <Text style={[styles.participationButtonText, styles.declineButtonText]}>
                            Katılmayacağım
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {isAdmin && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => setShowConfirmDelete(true)}
                      >
                        <Ionicons name="trash" size={20} color="#FFFFFF" />
                        <Text style={styles.deleteButtonText}>Buluşmayı Sil</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default MeetingDetailModal; 