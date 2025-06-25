import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFriends } from '../services/friendService';
import { getCurrentUserUid } from '../services/friendFunctions';
import FastImage from 'react-native-fast-image';

const NewChatModal = ({ visible, onClose, onSelectFriend }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [friends, setFriends] = useState([]);
    const [filteredFriends, setFilteredFriends] = useState([]);

    useEffect(() => {
        loadFriends();
    }, []);

    useEffect(() => {
        filterFriends();
    }, [searchQuery, friends]);

    const loadFriends = async () => {
        try {
            const userId = await getCurrentUserUid();
            const friendsList = await getFriends(userId);
            setFriends(friendsList);
            setFilteredFriends(friendsList);
        } catch (error) {
            console.error('Arkadaşlar yüklenirken hata:', error);
        }
    };

    const filterFriends = () => {
        const filtered = friends.filter(friend =>
            friend.informations?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            friend.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredFriends(filtered);
    };

    const renderFriendItem = ({ item }) => (
        <TouchableOpacity
            style={styles.friendItem}
            onPress={() => onSelectFriend(item)}
        >
            <FastImage
                source={
                    item.profilePicture
                        ? {
                            uri: item.profilePicture,
                            priority: FastImage.priority.normal,
                            cache: FastImage.cacheControl.immutable
                        }
                        : {
                            uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.informations?.name || '')}&background=random`,
                            priority: FastImage.priority.normal,
                            cache: FastImage.cacheControl.web
                        }
                }
                style={styles.avatar}
                resizeMode={FastImage.resizeMode.cover}
            />
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>
                    {item.informations?.name || item.name || 'İsimsiz'}
                </Text>
                {item.isOnline && <View style={styles.onlineIndicator} />}
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#FF3B30" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Yeni Sohbet</Text>
                    <View style={styles.placeholder} />
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Arkadaşlarında ara..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#666"
                    />
                </View>

                <FlatList
                    data={filteredFriends}
                    renderItem={renderFriendItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'Sonuç bulunamadı' : 'Henüz arkadaşın yok'}
                            </Text>
                        </View>
                    )}
                />
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        color: '#FF3B30',
        fontSize: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
    },
    placeholder: {
        width: 50,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        margin: 16,
        borderRadius: 10,
        padding: 8,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    listContainer: {
        flexGrow: 1,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    friendInfo: {
        flex: 1,
        marginLeft: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    friendName: {
        fontSize: 16,
        color: '#000',
    },
    onlineIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
        marginLeft: 8,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
});

export default NewChatModal; 