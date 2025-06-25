import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const GroupEventCard = ({ 
  event, 
  onRespond, 
  currentUserId, 
  isAdmin, 
  isPast = false,
  onPress 
}) => {
  // Etkinlik tarihini formatla
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric', 
      month: 'long',
      weekday: 'long'
    });
  };
  
  // Kullanıcının katılım durumunu al
  const getParticipantStatus = () => {
    if (!event.participantStatus || !event.participantStatus[currentUserId]) {
      return 'pending';
    }
    return event.participantStatus[currentUserId];
  };
  
  // Katılım durumunu renkle göster
  const getStatusColor = (status) => {
    switch(status) {
      case 'accepted': return '#4CAF50';
      case 'declined': return '#FF4136';
      case 'pending': 
      default: return '#FFC107';
    }
  };
  
  // Katılım durumunu yazı ile göster
  const getStatusText = (status) => {
    switch(status) {
      case 'accepted': return 'Katılıyorum';
      case 'declined': return 'Katılmıyorum';
      case 'pending': 
      default: return 'Yanıt Bekleniyor';
    }
  };
  
  // Katılım durumunu ikon ile göster
  const getStatusIcon = (status) => {
    switch(status) {
      case 'accepted': return 'checkmark-circle';
      case 'declined': return 'close-circle';
      case 'pending': 
      default: return 'time';
    }
  };
  
  // Katılımcı sayılarını hesapla
  const calculateParticipants = () => {
    if (!event.participantStatus) return { accepted: 0, declined: 0, pending: 0 };
    
    const counts = { accepted: 0, declined: 0, pending: 0 };
    
    Object.values(event.participantStatus).forEach(status => {
      counts[status] = (counts[status] || 0) + 1;
    });
    
    return counts;
  };
  
  const participantCounts = calculateParticipants();
  const userStatus = getParticipantStatus();
  const statusColor = getStatusColor(userStatus);
  
  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        isPast && styles.pastEventContainer
      ]}
      onPress={onPress}
      disabled={isPast}
    >
      {/* Etkinlik Tarihi */}
      <View style={styles.dateSection}>
        <View style={styles.dateContainer}>
          <Text style={styles.dayText}>{new Date(event.date).getDate()}</Text>
          <Text style={styles.monthText}>
            {new Date(event.date).toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase()}
          </Text>
        </View>
      </View>
      
      {/* Etkinlik Bilgileri */}
      <View style={styles.infoSection}>
        <Text style={styles.title}>{event.title}</Text>
        
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#9797A9" />
          <Text style={styles.detailText}>{event.location}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#9797A9" />
          <Text style={styles.detailText}>{formatDate(event.date)}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#9797A9" />
          <Text style={styles.detailText}>{event.time}</Text>
        </View>
        
        {/* Katılımcı Bilgileri */}
        <View style={styles.participantsInfo}>
          <View style={styles.countItem}>
            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
            <Text style={styles.countText}>{participantCounts.accepted}</Text>
          </View>
          <View style={styles.countItem}>
            <Ionicons name="close-circle" size={14} color="#FF4136" />
            <Text style={styles.countText}>{participantCounts.declined}</Text>
          </View>
          <View style={styles.countItem}>
            <Ionicons name="time" size={14} color="#FFC107" />
            <Text style={styles.countText}>{participantCounts.pending}</Text>
          </View>
        </View>
      </View>
      
      {/* Katılım Durumu ve Butonlar */}
      <View style={styles.actionSection}>
        {!isPast && (
          <>
            {/* Kullanıcının katılım durumu */}
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Ionicons name={getStatusIcon(userStatus)} size={14} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusText(userStatus)}
              </Text>
            </View>
            
            {/* Yanıt Butonları (Beklemede ise) */}
            {userStatus === 'pending' && (
              <View style={styles.responseButtons}>
                <TouchableOpacity 
                  style={[styles.responseButton, styles.acceptButton]}
                  onPress={() => onRespond(event.id, 'accepted')}
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.responseButton, styles.declineButton]}
                  onPress={() => onRespond(event.id, 'declined')}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            
            {/* Yanıtı Değiştir (Eğer zaten cevap verilmişse) */}
            {userStatus !== 'pending' && (
              <TouchableOpacity 
                style={styles.changeButton}
                onPress={() => onRespond(event.id, 'pending')}
              >
                <Text style={styles.changeButtonText}>Değiştir</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        
        {isPast && (
          <View style={styles.completedBadge}>
            <MaterialCommunityIcons name="calendar-check" size={14} color="#9797A9" />
            <Text style={styles.completedText}>Tamamlandı</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#32323E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
  },
  pastEventContainer: {
    opacity: 0.7,
  },
  dateSection: {
    marginRight: 12,
    justifyContent: 'center',
  },
  dateContainer: {
    backgroundColor: '#53B4DF',
    borderRadius: 8,
    width: 50,
    alignItems: 'center',
    padding: 6,
  },
  dayText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  monthText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  detailText: {
    color: '#CDCDCD',
    fontSize: 12,
    marginLeft: 4,
  },
  participantsInfo: {
    flexDirection: 'row',
    marginTop: 8,
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  countText: {
    color: '#9797A9',
    fontSize: 12,
    marginLeft: 2,
  },
  actionSection: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingLeft: 8,
    minWidth: 100,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  responseButtons: {
    flexDirection: 'row',
  },
  responseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#FF4136',
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(151, 151, 169, 0.2)',
  },
  completedText: {
    color: '#9797A9',
    fontSize: 12,
    marginLeft: 4,
  }
});

export default GroupEventCard; 