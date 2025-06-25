import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../../firebaseConfig';
import FriendProfileModal from '../modals/friendProfileModal';

const LikedByScreen = ({ route, navigation }) => {
    const { postId, likedBy } = route.params;
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        fetchLikedByUsers();
    }, []);

    const fetchLikedByUsers = async () => {
        try {
            const db = getFirebaseDb();
            const userPromises = likedBy.map(userId =>
                getDoc(doc(db, 'users', userId))
            );

            const userDocs = await Promise.all(userPromises);
            const usersData = userDocs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(user => user.informations); // Geçerli kullanıcıları filtrele

            setUsers(usersData);
        } catch (error) {
            console.error('Beğenen kullanıcılar yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserPress = (user) => {
        const completeUserData = {
            ...user,
            name: user.informations?.name || 'İsimsiz Kullanıcı',
            informations: {
                ...user.informations,
                username: user.informations?.username || user.informations?.name?.toLowerCase().replace(/\s+/g, '_') || 'kullanici'
            }
        };

        setSelectedUser(completeUserData);
        setModalVisible(true);
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleUserPress(item)}
        >
            <FastImage
                source={{
                    uri: item.profilePicture || 'https://via.placeholder.com/100',
                    priority: FastImage.priority.normal,
                }}
                style={styles.avatar}
            />
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.informations?.name || 'İsimsiz Kullanıcı'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => navigation.goBack()}
        >
            <TouchableOpacity
                activeOpacity={1}
                style={styles.modalContent}
            >
                <View style={styles.modalHeader}>
                    <View style={styles.headerBar} />
                    <Text style={styles.headerTitle}>Beğenenler</Text>
                </View>

                {loading ? (
                    <ActivityIndicator style={styles.loading} color="#2196F3" />
                ) : (
                    <FlatList
                        data={users}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </TouchableOpacity>

            <FriendProfileModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                friend={selectedUser}
                navigation={navigation}
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        minHeight: '60%',
    },
    modalHeader: {
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerBar: {
        width: 40,
        height: 4,
        backgroundColor: '#ddd',
        borderRadius: 2,
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    loading: {
        flex: 1,
        padding: 20,
    },
    listContent: {
        padding: 16,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    userInfo: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 15,
        fontWeight: '500',
    },
});

export default LikedByScreen; 