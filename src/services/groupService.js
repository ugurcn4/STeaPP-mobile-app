import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// Grup oluştur
export const createGroup = async (groupData, creatorId) => {
  try {
    // Grup koleksiyonuna yeni belge ekle
    const groupRef = await addDoc(collection(db, 'groups'), {
      name: groupData.name,
      description: groupData.description || '',
      icon: groupData.icon || 'users',
      color: groupData.color || '#53B4DF',
      createdBy: creatorId,
      adminId: creatorId,
      members: [creatorId],
      pendingMembers: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      events: []
    });

    // Oluşturulan grup bilgilerini döndür
    return {
      id: groupRef.id,
      ...groupData,
      createdBy: creatorId,
      adminId: creatorId,
      members: [creatorId]
    };
  } catch (error) {
    console.error('Grup oluşturma hatası:', error);
    throw error;
  }
};

// Kullanıcının gruplarını getir
export const fetchUserGroups = async (userId) => {
  try {
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('members', 'array-contains', userId));
    const querySnapshot = await getDocs(q);

    const groups = [];
    for (const groupDoc of querySnapshot.docs) {
      const groupData = groupDoc.data();
      
      // Grup üyelerinin bilgilerini çek
      const membersData = await Promise.all(
        groupData.members.map(async (memberId) => {
          const userDoc = await getDoc(doc(db, 'users', memberId));
          if (userDoc.exists()) {
            return {
              id: memberId,
              name: userDoc.data().informations?.name || 'İsimsiz Kullanıcı',
              profilePicture: userDoc.data().profilePicture || null
            };
          }
          return null;
        })
      );

      const validMembers = membersData.filter(member => member !== null);
      
      groups.push({
        id: groupDoc.id,
        ...groupData,
        createdAt: groupData.createdAt?.toDate() || new Date(),
        membersData: validMembers,
        isAdmin: groupData.adminId === userId,
        isCreator: groupData.createdBy === userId
      });
    }
    
    return groups;
  } catch (error) {
    console.error('Kullanıcı grupları getirme hatası:', error);
    throw error;
  }
};

// Grubu güncelle
export const updateGroup = async (groupId, groupData, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const currentGroupData = groupDoc.data();
    
    // Sadece admin veya oluşturucu güncelleme yapabilir
    if (currentGroupData.adminId !== userId && currentGroupData.createdBy !== userId) {
      throw new Error('Bu işlem için yetkiniz yok');
    }
    
    await updateDoc(groupRef, {
      ...groupData,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });
    
    return {
      id: groupId,
      ...currentGroupData,
      ...groupData
    };
  } catch (error) {
    console.error('Grup güncelleme hatası:', error);
    throw error;
  }
};

// Grubu sil
export const deleteGroup = async (groupId, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Sadece admin veya oluşturucu silebilir
    if (groupData.adminId !== userId && groupData.createdBy !== userId) {
      throw new Error('Bu işlem için yetkiniz yok');
    }
    
    await deleteDoc(groupRef);
    return true;
  } catch (error) {
    console.error('Grup silme hatası:', error);
    throw error;
  }
};

// Gruba üye ekle
export const inviteToGroup = async (groupId, invitedUserId, inviterId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Davet eden kişi admin veya grup üyesi olmalı
    if (!groupData.members.includes(inviterId)) {
      throw new Error('Bu işlem için yetkiniz yok');
    }
    
    // Kullanıcı zaten üye mi kontrol et
    if (groupData.members.includes(invitedUserId)) {
      throw new Error('Bu kullanıcı zaten grubun üyesi');
    }
    
    // Kullanıcı zaten davetli mi kontrol et
    if (groupData.pendingMembers && groupData.pendingMembers.includes(invitedUserId)) {
      throw new Error('Bu kullanıcı zaten gruba davet edilmiş');
    }
    
    // Bekleyen üyelere ekle
    await updateDoc(groupRef, {
      pendingMembers: arrayUnion(invitedUserId)
    });
    
    return true;
  } catch (error) {
    console.error('Gruba davet hatası:', error);
    throw error;
  }
};

// Grup davetini kabul et
export const acceptGroupInvitation = async (groupId, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Kullanıcı davetli mi kontrol et
    if (!groupData.pendingMembers || !groupData.pendingMembers.includes(userId)) {
      throw new Error('Bu grup için aktif bir davetiniz bulunmamaktadır');
    }
    
    // Üyelere ekle ve bekleyen üyelerden çıkar
    await updateDoc(groupRef, {
      members: arrayUnion(userId),
      pendingMembers: groupData.pendingMembers.filter(id => id !== userId)
    });
    
    return true;
  } catch (error) {
    console.error('Grup davetini kabul hatası:', error);
    throw error;
  }
};

// Grup davetini reddet
export const rejectGroupInvitation = async (groupId, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Kullanıcı davetli mi kontrol et
    if (!groupData.pendingMembers || !groupData.pendingMembers.includes(userId)) {
      throw new Error('Bu grup için aktif bir davetiniz bulunmamaktadır');
    }
    
    // Bekleyen üyelerden çıkar
    await updateDoc(groupRef, {
      pendingMembers: groupData.pendingMembers.filter(id => id !== userId)
    });
    
    return true;
  } catch (error) {
    console.error('Grup davetini reddetme hatası:', error);
    throw error;
  }
};

// Gruptan çık
export const leaveGroup = async (groupId, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Kullanıcı üye mi kontrol et
    if (!groupData.members.includes(userId)) {
      throw new Error('Bu grubun üyesi değilsiniz');
    }
    
    // Kullanıcı grup oluşturucusu mu?
    if (groupData.createdBy === userId) {
      throw new Error('Grup oluşturucusu gruptan çıkamaz. Önce başka birisini yönetici yapın veya grubu silin');
    }
    
    // Üyelerden çıkar
    await updateDoc(groupRef, {
      members: groupData.members.filter(id => id !== userId),
      // Eğer admin ayrılıyorsa, admin yetkisini de kaldır
      ...(groupData.adminId === userId ? { adminId: groupData.createdBy } : {})
    });
    
    return true;
  } catch (error) {
    console.error('Gruptan çıkma hatası:', error);
    throw error;
  }
};

// Üyeyi gruptan çıkar
export const removeMemberFromGroup = async (groupId, memberId, adminId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Yönetici veya oluşturucu değilse işlemi engelle
    if (groupData.adminId !== adminId && groupData.createdBy !== adminId) {
      throw new Error('Bu işlem için yetkiniz yok');
    }
    
    // Grup oluşturucusunu çıkarmaya çalışıyorsa engelle
    if (memberId === groupData.createdBy) {
      throw new Error('Grup oluşturucusu gruptan çıkarılamaz');
    }
    
    // Kullanıcı üye mi kontrol et
    if (!groupData.members.includes(memberId)) {
      throw new Error('Bu kullanıcı grubun üyesi değil');
    }
    
    // Üyelerden çıkar
    await updateDoc(groupRef, {
      members: groupData.members.filter(id => id !== memberId)
    });
    
    return true;
  } catch (error) {
    console.error('Üyeyi gruptan çıkarma hatası:', error);
    throw error;
  }
};

// Grup etkinliği oluştur
export const createGroupEvent = async (groupId, eventData, creatorId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Kullanıcı grup üyesi mi kontrol et
    if (!groupData.members.includes(creatorId)) {
      throw new Error('Bu işlem için yetkiniz yok');
    }
    
    // Etkinlik ID'si oluştur
    const eventId = Date.now().toString();
    
    // Katılımcı durumlarını ayarla
    const participantStatus = {};
    groupData.members.forEach(memberId => {
      // Oluşturan kişi otomatik olarak kabul etmiş sayılır
      participantStatus[memberId] = memberId === creatorId ? 'accepted' : 'pending';
    });
    
    // Yeni etkinlik verisi
    const newEvent = {
      id: eventId,
      title: eventData.title,
      description: eventData.description || '',
      location: eventData.location,
      date: eventData.date,
      time: eventData.time,
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
      participants: groupData.members,
      participantStatus: participantStatus,
      status: 'active'
    };
    
    // Grup belgesi güncellenir
    const events = groupData.events || [];
    await updateDoc(groupRef, {
      events: [...events, newEvent],
      updatedAt: serverTimestamp()
    });
    
    return newEvent;
  } catch (error) {
    console.error('Grup etkinliği oluşturma hatası:', error);
    throw error;
  }
};

// Grup etkinliklerini getir
export const fetchGroupEvents = async (groupId, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Kullanıcı grup üyesi mi kontrol et
    if (!groupData.members.includes(userId)) {
      throw new Error('Bu grubun etkinliklerini görüntüleme yetkiniz yok');
    }
    
    return groupData.events || [];
  } catch (error) {
    console.error('Grup etkinlikleri getirme hatası:', error);
    throw error;
  }
};

// Grup etkinliğini güncelle
export const updateGroupEvent = async (groupId, eventId, eventData, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Kullanıcı grup üyesi mi kontrol et
    if (!groupData.members.includes(userId)) {
      throw new Error('Bu işlem için yetkiniz yok');
    }
    
    const events = groupData.events || [];
    const eventIndex = events.findIndex(event => event.id === eventId);
    
    if (eventIndex === -1) {
      throw new Error('Etkinlik bulunamadı');
    }
    
    const event = events[eventIndex];
    
    // Sadece etkinlik oluşturucusu, grup admini veya grup oluşturucusu güncelleyebilir
    if (event.createdBy !== userId && groupData.adminId !== userId && groupData.createdBy !== userId) {
      throw new Error('Bu etkinliği güncelleme yetkiniz yok');
    }
    
    // Etkinliği güncelle
    const updatedEvent = {
      ...event,
      ...eventData,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };
    
    events[eventIndex] = updatedEvent;
    
    await updateDoc(groupRef, {
      events: events,
      updatedAt: serverTimestamp()
    });
    
    return updatedEvent;
  } catch (error) {
    console.error('Grup etkinliği güncelleme hatası:', error);
    throw error;
  }
};

// Grup etkinliğini sil
export const deleteGroupEvent = async (groupId, eventId, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Kullanıcı grup üyesi mi kontrol et
    if (!groupData.members.includes(userId)) {
      throw new Error('Bu işlem için yetkiniz yok');
    }
    
    const events = groupData.events || [];
    const eventIndex = events.findIndex(event => event.id === eventId);
    
    if (eventIndex === -1) {
      throw new Error('Etkinlik bulunamadı');
    }
    
    const event = events[eventIndex];
    
    // Sadece etkinlik oluşturucusu, grup admini veya grup oluşturucusu silebilir
    if (event.createdBy !== userId && groupData.adminId !== userId && groupData.createdBy !== userId) {
      throw new Error('Bu etkinliği silme yetkiniz yok');
    }
    
    // Etkinliği kaldır
    const updatedEvents = events.filter(e => e.id !== eventId);
    
    await updateDoc(groupRef, {
      events: updatedEvents,
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Grup etkinliği silme hatası:', error);
    throw error;
  }
};

// Grup etkinliğine katılım durumunu güncelle
export const updateEventParticipation = async (groupId, eventId, userId, status) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grup bulunamadı');
    }
    
    const groupData = groupDoc.data();
    
    // Kullanıcı grup üyesi mi kontrol et
    if (!groupData.members.includes(userId)) {
      throw new Error('Bu işlem için yetkiniz yok');
    }
    
    const events = groupData.events || [];
    const eventIndex = events.findIndex(event => event.id === eventId);
    
    if (eventIndex === -1) {
      throw new Error('Etkinlik bulunamadı');
    }
    
    const event = events[eventIndex];
    
    // Kullanıcı etkinliğe davetli mi kontrol et
    if (!event.participants.includes(userId)) {
      throw new Error('Bu etkinliğe davetli değilsiniz');
    }
    
    // Katılım durumunu güncelle
    const updatedEvent = {
      ...event,
      participantStatus: {
        ...event.participantStatus,
        [userId]: status
      }
    };
    
    events[eventIndex] = updatedEvent;
    
    await updateDoc(groupRef, {
      events: events,
      updatedAt: serverTimestamp()
    });
    
    return updatedEvent;
  } catch (error) {
    console.error('Etkinlik katılım durumu güncelleme hatası:', error);
    throw error;
  }
};

// Kullanıcının bekleyen grup davetlerini getir
export const fetchPendingGroupInvitations = async (userId) => {
  try {
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('pendingMembers', 'array-contains', userId));
    const querySnapshot = await getDocs(q);
    
    const invitations = [];
    for (const groupDoc of querySnapshot.docs) {
      const groupData = groupDoc.data();
      
      // Grup oluşturucusunun bilgilerini al
      const creatorDoc = await getDoc(doc(db, 'users', groupData.createdBy));
      const creatorName = creatorDoc.exists() 
        ? creatorDoc.data().informations?.name || 'İsimsiz Kullanıcı' 
        : 'İsimsiz Kullanıcı';
      
      invitations.push({
        id: groupDoc.id,
        name: groupData.name,
        description: groupData.description,
        icon: groupData.icon,
        color: groupData.color,
        createdBy: groupData.createdBy,
        creatorName: creatorName,
        memberCount: groupData.members.length,
        createdAt: groupData.createdAt?.toDate() || new Date()
      });
    }
    
    return invitations;
  } catch (error) {
    console.error('Bekleyen grup davetleri getirme hatası:', error);
    throw error;
  }
}; 