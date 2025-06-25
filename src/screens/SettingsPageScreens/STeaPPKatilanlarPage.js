import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    Platform, 
    SafeAreaView,
    TextInput,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { lightTheme, darkTheme } from '../../themes';
import { translate } from '../../i18n/i18n';
import { db } from '../../../firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import FastImage from 'react-native-fast-image';

const STeaPPKatilanlarPage = ({ navigation }) => {
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;
    
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const auth = getAuth();
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const usersData = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const informations = data.informations || {};
                return {
                    id: doc.id,
                    name: informations.name || data.name || translate('unnamed_user'),
                    profilePicture: informations.profilePicture || data.profilePicture,
                    createdAt: data.createdAt?.toDate() || new Date()
                };
            });
            
            setUsers(usersData);
        } catch (error) {
            console.error('Kullanıcılar yüklenirken hata:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchUsers();
    };

    const filteredUsers = () => {
        if (!searchQuery.trim()) return users;
        
        return users.filter(user => 
            user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            user.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    const renderHeader = () => (
        <View style={[styles.header, { backgroundColor: currentTheme.background }]}>
            <View style={styles.headerTopRow}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: currentTheme.text }]}>
                    {translate('steapp_participants')}
                </Text>
                <View style={styles.headerRight} />
            </View>

            <View style={[styles.searchContainer, { backgroundColor: currentTheme.cardBackground }]}>
                <Ionicons name="search" size={20} color={currentTheme.text} style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: currentTheme.text }]}
                    placeholder={translate('search_users')}
                    placeholderTextColor={currentTheme.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={currentTheme.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderUser = ({ item }) => {
        const formattedDate = item.createdAt.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const getInitial = (name) => {
            if (!name) return '?';
            return name.charAt(0).toUpperCase();
        };

        const getRandomColor = (text) => {
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'];
            const index = text.charCodeAt(0) % colors.length;
            return colors[index];
        };

        const initial = getInitial(item.name);
        const backgroundColor = getRandomColor(initial);

        return (
            <View style={[styles.userCard, { backgroundColor: currentTheme.cardBackground }]}>
                {item.profilePicture ? (
                    <FastImage 
                        source={{ uri: item.profilePicture }} 
                        style={styles.avatarImage}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                ) : (
                    <View style={[styles.avatarContainer, { backgroundColor }]}>
                        <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                )}
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: currentTheme.text }]}>
                        {item.name || translate('unnamed_user')}
                    </Text>
                    <Text style={[styles.joinDate, { color: currentTheme.textSecondary }]}>
                        {formattedDate}
                    </Text>
                </View>
            </View>
        );
    };

    const renderEmptyList = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="people" size={60} color="#ccc" />
            <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>
                {searchQuery.length > 0 
                    ? translate('no_search_results') 
                    : translate('no_users')}
            </Text>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
                {renderHeader()}
                <View style={styles.loadingContent}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
                        {translate('loading_users')}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
            <FlatList
                data={filteredUsers()}
                renderItem={renderUser}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmptyList}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#2196F3']}
                        tintColor="#2196F3"
                    />
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
    },
    loadingContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
    },
    header: {
        padding: 16,
        paddingTop: Platform.OS === 'android' ? 16 : 0,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    headerRight: {
        width: 40,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
        borderRadius: 12,
        padding: 10,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
        fontWeight: '400',
        paddingVertical: 4,
    },
    listContainer: {
        padding: 16,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    joinDate: {
        fontSize: 14,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    }
});

export default STeaPPKatilanlarPage; 