import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';

const MembersList = ({ 
  members, 
  currentUserId, 
  isAdmin = false, 
  maxDisplay = 5,
  totalCount = 0,
  onPressMore,
  onRemoveMember
}) => {
  // Görüntülenecek üye sayısını sınırla
  const displayMembers = members.slice(0, maxDisplay);
  const hasMore = totalCount > maxDisplay;
  
  // Profil fotoğrafı yoksa baş harfler ile avatar oluştur
  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };
  
  const renderAvatar = (member) => {
    if (member.profilePicture) {
      return (
        <FastImage 
          source={{ uri: member.profilePicture }} 
          style={styles.avatarImage}
          resizeMode={FastImage.resizeMode.cover}
        />
      );
    }
    
    return (
      <View style={[styles.initialAvatar, { backgroundColor: '#53B4DF' }]}>
        <Text style={styles.initialText}>{getInitials(member.name)}</Text>
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {displayMembers.map((member) => (
        <View 
          key={member.id} 
          style={styles.memberItem}
        >
          <View style={styles.avatarContainer}>
            {renderAvatar(member)}
            {member.id === currentUserId && (
              <View style={styles.youBadge}>
                <Text style={styles.youText}>Siz</Text>
              </View>
            )}
          </View>
          
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberStatus}>
              {member.id === currentUserId ? 'Siz' : 'Üye'}
            </Text>
          </View>
          
          {isAdmin && member.id !== currentUserId && onRemoveMember && (
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => onRemoveMember(member.id)}
            >
              <Ionicons name="close-circle" size={20} color="#FF4136" />
            </TouchableOpacity>
          )}
        </View>
      ))}
      
      {hasMore && (
        <TouchableOpacity 
          style={styles.showMoreButton}
          onPress={onPressMore}
        >
          <View style={styles.moreIconContainer}>
            <MaterialIcons name="group" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.showMoreText}>
            {totalCount - maxDisplay} üye daha göster
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#53B4DF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#32323E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  initialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  youBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFAC30',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  youText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  memberStatus: {
    color: '#9797A9',
    fontSize: 12,
  },
  removeButton: {
    padding: 8,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  moreIconContainer: {
    backgroundColor: '#53B4DF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  showMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 4,
  }
});

export default MembersList; 