import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Dimensions,
    Alert,
    FlatList,
    ActivityIndicator
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { Ionicons } from '@expo/vector-icons';
import { getFriends } from '../services/friendService';
import { createSharedArchiveGroup } from '../services/postService';

const { height, width } = Dimensions.get('window');
const MODAL_HEIGHT = height * 0.85;

const EMOJIS = ["👥", "👫", "👬", "👭", "🫂", "🤝", "🌟", "💫", "🎯", "🎨", "🎭", "🎪", "🎢", "🎡", "🎠", "🎮", "🎲", "🧩", "🎸", "🎹", "🎺", "🎻", "📱", "💻", "⌚️", "📷", "🎥", "🎬", "📺", "📻", "🎙", "🎧", "📝", "📖", "📚", "🎨", "🖼", "🎭"];

const getInitials = (name) => {
    if (!name) return "AA";
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
        return name.substring(0, 2).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const SharedCollectionModal = ({ visible, onClose, userId, onSuccessCreate }) => {
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: arkadaş seçimi, 2: koleksiyon bilgileri
    const [searchQuery, setSearchQuery] = useState('');

    // Koleksiyon bilgileri
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupEmoji, setNewGroupEmoji] = useState('👥');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        if (visible) {
            loadFriends();
        } else {
            // Modal kapandığında state'i sıfırla
            setStep(1);
            setSelectedFriends([]);
            setNewGroupName('');
            setNewGroupEmoji('👥');
            setNewGroupDesc('');
        }
    }, [visible]);

    const loadFriends = async () => {
        try {
            setLoading(true);
            const friendsList = await getFriends(userId);
            setFriends(friendsList);
        } catch (error) {
            console.error('Arkadaşlar yüklenirken hata:', error);
            Alert.alert('Hata', 'Arkadaşlarınız yüklenirken bir sorun oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleFriendSelect = (friend) => {
        setSelectedFriends(prev => {
            if (prev.some(f => f.id === friend.id)) {
                return prev.filter(f => f.id !== friend.id);
            } else {
                return [...prev, friend];
            }
        });
    };

    const handleNext = () => {
        if (selectedFriends.length === 0) {
            Alert.alert('Uyarı', 'Lütfen en az bir arkadaş seçin.');
            return;
        }

        setStep(2);
    };

    const handleBack = () => {
        setStep(1);
    };

    const handleCreateSharedCollection = async () => {
        try {
            if (!newGroupName.trim()) {
                Alert.alert('Uyarı', 'Lütfen koleksiyon adını girin.');
                return;
            }

            setLoading(true);

            const friendIds = selectedFriends.map(friend => friend.id);
            const groupData = {
                name: newGroupName,
                emoji: newGroupEmoji,
                description: newGroupDesc
            };

            await createSharedArchiveGroup(userId, groupData, friendIds);

            // Başarılı oluşturma
            Alert.alert(
                'Başarılı',
                'Ortak koleksiyon başarıyla oluşturuldu.',
                [{
                    text: 'Tamam', onPress: () => {
                        if (onSuccessCreate) onSuccessCreate();
                        onClose();
                    }
                }]
            );
        } catch (error) {
            console.error('Ortak koleksiyon oluşturma hatası:', error);
            Alert.alert('Hata', 'Koleksiyon oluşturulurken bir sorun oluştu.');
        } finally {
            setLoading(false);
        }
    };

    // Emoji seçici modal
    const renderEmojiPicker = () => (
        <Modal
            visible={showEmojiPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowEmojiPicker(false)}
        >
            <View style={styles.emojiPickerOverlay}>
                <View style={styles.emojiPickerContainer}>
                    <View style={styles.emojiPickerHeader}>
                        <Text style={styles.emojiPickerTitle}>Emoji Seç</Text>
                        <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={EMOJIS}
                        numColumns={6}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.emojiItem}
                                onPress={() => {
                                    setNewGroupEmoji(item);
                                    setShowEmojiPicker(false);
                                }}
                            >
                                <Text style={styles.emojiText}>{item}</Text>
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item, index) => index.toString()}
                    />
                </View>
            </View>
        </Modal>
    );

    const filteredFriends = searchQuery
        ? friends.filter(friend =>
            friend.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : friends;

    const renderFriendsStep = () => (
        <>
            <View style={styles.header}>
                <Text style={styles.headerText}>Arkadaşları Seç</Text>
                <TouchableOpacity onPress={onClose}>
                    <View style={styles.closeButton}>
                        <Ionicons name="close" size={20} color="#666" />
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Arkadaş ara..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2196F3" />
                </View>
            ) : (
                <FlatList
                    data={filteredFriends}
                    keyExtractor={item => item.id}
                    style={styles.friendsList}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? 'Arama sonucu bulunamadı'
                                    : 'Henüz arkadaşınız yok'}
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.friendItem}
                            onPress={() => handleFriendSelect(item)}
                        >
                            <View style={styles.friendInfo}>
                                {item.profilePicture ? (
                                    <FastImage
                                        source={{ uri: item.profilePicture }}
                                        style={styles.friendAvatar}
                                        resizeMode={FastImage.resizeMode.cover}
                                    />
                                ) : (
                                    <View style={[styles.friendAvatar, styles.defaultAvatar]}>
                                        <Text style={styles.avatarInitial}>
                                            {getInitials(item.name)}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.friendNameContainer}>
                                    <Text style={styles.friendName}>{item.name}</Text>
                                    {item.username && (
                                        <Text style={styles.friendUsername}>@{item.username}</Text>
                                    )}
                                </View>
                            </View>
                            <View style={styles.checkboxContainer}>
                                <Ionicons
                                    name={selectedFriends.some(f => f.id === item.id)
                                        ? "checkmark-circle"
                                        : "ellipse-outline"}
                                    size={24}
                                    color={selectedFriends.some(f => f.id === item.id)
                                        ? "#2196F3"
                                        : "#ddd"}
                                />
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}

            <View style={styles.footerContainer}>
                <Text style={styles.selectedCount}>
                    {selectedFriends.length} arkadaş seçildi
                </Text>
                <TouchableOpacity
                    style={[
                        styles.nextButton,
                        selectedFriends.length === 0 && styles.disabledButton
                    ]}
                    onPress={handleNext}
                    disabled={selectedFriends.length === 0}
                >
                    <Text style={styles.nextButtonText}>İleri</Text>
                </TouchableOpacity>
            </View>
        </>
    );

    const renderCollectionDetailsStep = () => (
        <>
            <View style={styles.formHeader}>
                <TouchableOpacity onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color="#666" />
                </TouchableOpacity>
                <Text style={styles.formTitle}>Ortak Koleksiyon</Text>
                <TouchableOpacity onPress={handleCreateSharedCollection} disabled={loading}>
                    <Text
                        style={[
                            styles.createButton,
                            (!newGroupName.trim() || loading) && styles.disabledText
                        ]}
                    >
                        Oluştur
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.formContent}>
                <View style={styles.emojiSelector}>
                    <TouchableOpacity
                        style={styles.emojiButton}
                        onPress={() => setShowEmojiPicker(true)}
                    >
                        <Text style={styles.emojiText}>{newGroupEmoji}</Text>
                        <View style={styles.emojiEditBadge}>
                            <Ionicons name="pencil" size={12} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={styles.nameInput}
                    placeholder="Koleksiyon adı"
                    value={newGroupName}
                    onChangeText={setNewGroupName}
                    maxLength={50}
                />

                <TextInput
                    style={styles.descInput}
                    placeholder="Açıklama (isteğe bağlı)"
                    value={newGroupDesc}
                    onChangeText={setNewGroupDesc}
                    multiline
                    maxLength={200}
                />

                <View style={styles.friendsPreview}>
                    <Text style={styles.friendsPreviewTitle}>
                        Paylaşılacak Arkadaşlar ({selectedFriends.length})
                    </Text>
                    <View style={styles.friendsAvatarContainer}>
                        {selectedFriends.slice(0, 5).map((friend, index) => (
                            <View
                                key={friend.id}
                                style={[
                                    styles.previewAvatar,
                                    { marginLeft: index > 0 ? -10 : 0 },
                                    !friend.profilePicture && styles.defaultAvatar
                                ]}
                            >
                                {friend.profilePicture ? (
                                    <FastImage
                                        source={{ uri: friend.profilePicture }}
                                        style={styles.fullImage}
                                        resizeMode={FastImage.resizeMode.cover}
                                    />
                                ) : (
                                    <Text style={styles.smallAvatarInitial}>
                                        {getInitials(friend.name)}
                                    </Text>
                                )}
                            </View>
                        ))}
                        {selectedFriends.length > 5 && (
                            <View style={[styles.extraFriendsCounter, { marginLeft: -10 }]}>
                                <Text style={styles.extraFriendsText}>
                                    +{selectedFriends.length - 5}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#2196F3" />
                </View>
            )}
        </>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    {step === 1 ? renderFriendsStep() : renderCollectionDetailsStep()}
                </View>
                {showEmojiPicker && renderEmojiPicker()}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        height: MODAL_HEIGHT,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerText: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        padding: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 40,
        fontSize: 16,
    },
    friendsList: {
        flex: 1,
    },
    friendItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    friendAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f0f0f0',
    },
    friendNameContainer: {
        marginLeft: 12,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '500',
    },
    friendUsername: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    checkboxContainer: {
        padding: 10,
    },
    footerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
    },
    selectedCount: {
        fontSize: 14,
        color: '#666',
    },
    nextButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#2196F3',
        borderRadius: 8,
    },
    nextButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    disabledButton: {
        backgroundColor: '#b0d8f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    formTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    createButton: {
        color: '#2196F3',
        fontSize: 16,
        fontWeight: '500',
    },
    formContent: {
        padding: 16,
    },
    emojiSelector: {
        alignItems: 'center',
        marginBottom: 20,
    },
    emojiButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiText: {
        fontSize: 32,
    },
    emojiEditBadge: {
        position: 'absolute',
        right: -4,
        bottom: -4,
        backgroundColor: '#2196F3',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nameInput: {
        fontSize: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingVertical: 8,
        marginBottom: 16,
    },
    descInput: {
        fontSize: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingVertical: 8,
        minHeight: 80,
        marginBottom: 20,
    },
    disabledText: {
        opacity: 0.5,
    },
    emojiPickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    emojiPickerContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        padding: 16,
        maxHeight: '50%',
    },
    emojiPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    emojiPickerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    emojiItem: {
        flex: 1,
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    friendsPreview: {
        marginTop: 10,
    },
    friendsPreviewTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 10,
    },
    friendsAvatarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
    },
    extraFriendsCounter: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -10,
    },
    extraFriendsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    defaultAvatar: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2196F3',
    },
    avatarInitial: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    smallAvatarInitial: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    fullImage: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
    },
});

export default SharedCollectionModal; 