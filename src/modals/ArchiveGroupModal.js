import React, { useState } from 'react';
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
    FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteArchiveGroup, addPostToSharedCollection } from '../services/postService';
import SharedCollectionModal from './SharedCollectionModal';

const { height } = Dimensions.get('window');
const MODAL_HEIGHT = height * 0.7; // Sabit bir yükseklik

const EMOJIS = ["📁", "📚", "💝", "⭐️", "🌟", "💫", "🎯", "🎨", "🎭", "🎪", "🎢", "🎡", "🎠", "🎮", "🎲", "🧩", "🎸", "🎹", "🎺", "🎻", "📱", "💻", "⌚️", "📷", "🎥", "🎬", "📺", "📻", "🎙", "🎧", "📝", "📖", "📚", "🎨", "🖼", "🎭"];

const ArchiveGroupModal = ({
    visible,
    onClose,
    archiveGroups,
    selectedGroups,
    onSelectGroups,
    onCreateGroup,
    onSave,
    userId,
    onGroupsUpdated,
    postId
}) => {
    const [showNewGroupForm, setShowNewGroupForm] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupEmoji, setNewGroupEmoji] = useState('📁');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [selectedForDeletion, setSelectedForDeletion] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showSharedCollectionModal, setShowSharedCollectionModal] = useState(false);

    const handleCreateGroup = async () => {
        try {
            if (!newGroupName.trim()) return;

            const groupData = {
                name: newGroupName,
                emoji: newGroupEmoji,
                description: newGroupDesc
            };

            // onCreateGroup'un tamamlanmasını bekle
            await onCreateGroup(groupData);

            // Form state'lerini sıfırla
            setNewGroupName('');
            setNewGroupEmoji('📁');
            setNewGroupDesc('');
            setShowNewGroupForm(false);

            // Koleksiyonları yenile
            if (onGroupsUpdated) {
                await onGroupsUpdated();
            }

        } catch (error) {
            console.error('Grup oluşturma hatası:', error);
            // Burada bir hata bildirimi gösterilebilir
            Alert.alert(
                'Hata',
                'Koleksiyon oluşturulurken bir hata oluştu.'
            );
        }
    };

    const handleLongPress = (group) => {
        setSelectedForDeletion(group);
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        if (selectedForDeletion) {
            try {
                await deleteArchiveGroup(userId, selectedForDeletion.id);

                // Eğer silinen grup seçili gruplar arasındaysa, seçimden kaldır
                if (selectedGroups.includes(selectedForDeletion.id)) {
                    onSelectGroups(prev => prev.filter(id => id !== selectedForDeletion.id));
                }

                // Modal'ı kapat ve state'i temizle
                setShowDeleteConfirm(false);
                setSelectedForDeletion(null);

                // Başarılı silme mesajı gösterilebilir
                // TODO: Toast veya bildirim göster
            } catch (error) {
                console.error('Grup silme hatası:', error);
                // Hata mesajı gösterilebilir
                // TODO: Hata bildirimi göster
            }
        }
    };

    const handleCreateSharedCollection = () => {
        // Ortak koleksiyon modalını aç
        setShowSharedCollectionModal(true);
    };

    const handleSharedCollectionCreated = async () => {
        // Koleksiyonları güncelle
        if (onGroupsUpdated) {
            await onGroupsUpdated();
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

    // Form içeriğini güncelleyelim
    const renderNewGroupForm = () => (
        <View style={styles.formContainer}>
            <View style={styles.formHeader}>
                <TouchableOpacity onPress={() => setShowNewGroupForm(false)}>
                    <Ionicons name="arrow-back" size={24} color="#666" />
                </TouchableOpacity>
                <Text style={styles.formTitle}>Yeni Koleksiyon</Text>
                <TouchableOpacity onPress={handleCreateGroup}>
                    <Text style={[styles.newCollectionText, !newGroupName.trim() && styles.disabledText]}>
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
            </View>
        </View>
    );

    const renderDeleteConfirmation = () => (
        <View style={styles.deleteConfirmOverlay}>
            <View style={styles.deleteConfirmBox}>
                <Text style={styles.deleteConfirmTitle}>Koleksiyonu Sil</Text>
                <Text style={styles.deleteConfirmText}>
                    "{selectedForDeletion?.name}" koleksiyonunu silmek istediğinizden emin misiniz?
                </Text>
                <View style={styles.deleteConfirmButtons}>
                    <TouchableOpacity
                        style={[styles.deleteConfirmButton, styles.cancelButton]}
                        onPress={() => setShowDeleteConfirm(false)}
                    >
                        <Text style={styles.cancelButtonText}>Vazgeç</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.deleteConfirmButton, styles.deleteButton]}
                        onPress={handleDeleteConfirm}
                    >
                        <Text style={styles.deleteButtonText}>Sil</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderCollectionItem = (group) => (
        <TouchableOpacity
            key={group.id}
            style={styles.collectionItem}
            onPress={async () => {
                try {
                    // Yeni seçili gruplar listesini oluştur
                    const newSelectedGroups = [group.id]; // Tek bir grup seçilecek

                    // Eğer seçilen grup ortak bir koleksiyon ise, özel fonksiyonu kullan
                    if (group.isShared && postId) {
                        await addPostToSharedCollection(postId, userId, group.id);
                        onClose(); // Modalı kapat
                        return;
                    }

                    // Normal grup ise standart kaydetme işlemi
                    await onSave(newSelectedGroups);
                } catch (error) {
                    console.error('Koleksiyon seçme hatası:', error);
                    Alert.alert(
                        'Hata',
                        'Koleksiyon seçilirken bir hata oluştu.'
                    );
                }
            }}
            onLongPress={() => handleLongPress(group)}
            delayLongPress={500}
        >
            <View style={[
                styles.collectionImageContainer,
                group.isShared && styles.sharedCollectionContainer
            ]}>
                <Text style={styles.collectionEmoji}>{group.emoji}</Text>
                {group.isShared && (
                    <View style={styles.sharedBadge}>
                        <Ionicons name="people" size={12} color="#fff" />
                    </View>
                )}
            </View>
            <View style={styles.collectionInfo}>
                <View style={styles.collectionNameRow}>
                    <Text style={styles.collectionName}>{group.name}</Text>
                    {group.isShared && (
                        <Text style={styles.sharedLabel}>Ortak</Text>
                    )}
                </View>
                {group.description ? (
                    <Text style={styles.collectionDescription} numberOfLines={2}>
                        {group.description}
                    </Text>
                ) : (
                    <Text style={styles.collectionPrivacy}>Gizli</Text>
                )}
                {group.isShared && group.members && (
                    <Text style={styles.membersCount}>
                        {group.members.length} üye
                    </Text>
                )}
            </View>
            <View style={styles.addButton}>
                <Ionicons
                    name={selectedGroups.includes(group.id) ? "checkmark-circle" : "add-circle-outline"}
                    size={28}
                    color={selectedGroups.includes(group.id) ? "#2196F3" : "#666"}
                />
            </View>
        </TouchableOpacity>
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
                    {showNewGroupForm ? (
                        renderNewGroupForm()
                    ) : (
                        <>
                            <View style={styles.header}>
                                <Text style={styles.headerText}>Kaydedildi</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <View style={styles.closeButton}>
                                        <Ionicons name="close" size={20} color="#666" />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.subHeader}>
                                <Text style={styles.title}>Koleksiyonlar</Text>
                                <TouchableOpacity onPress={() => setShowNewGroupForm(true)}>
                                    <Text style={styles.newCollectionText}>Yeni koleksiyon</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.content}>
                                {archiveGroups.length > 0 ? (
                                    archiveGroups.map(group => renderCollectionItem(group))
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="folder-open-outline" size={48} color="#ccc" />
                                        <Text style={styles.emptyText}>Henüz koleksiyon oluşturmadınız</Text>
                                        <Text style={styles.emptySubText}>
                                            Gönderilerinizi düzenlemek için yeni bir koleksiyon oluşturun
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>

                            <TouchableOpacity
                                style={styles.createCollectionButton}
                                onPress={handleCreateSharedCollection}
                            >
                                <View style={styles.createCollectionContent}>
                                    <Ionicons name="people-outline" size={24} color="#666" />
                                    <View style={styles.createCollectionText}>
                                        <Text style={styles.createCollectionTitle}>
                                            Ortak bir koleksiyon oluştur
                                        </Text>
                                        <Text style={styles.createCollectionSubtitle}>
                                            Gönderileri arkadaşlarınla bir koleksiyonda topla
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={24} color="#666" />
                                </View>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {showDeleteConfirm && renderDeleteConfirmation()}
                {showEmojiPicker && renderEmojiPicker()}

                <SharedCollectionModal
                    visible={showSharedCollectionModal}
                    onClose={() => setShowSharedCollectionModal(false)}
                    userId={userId}
                    onSuccessCreate={handleSharedCollectionCreated}
                />
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
        paddingBottom: 8,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        padding: 8,
    },
    subHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
    },
    newCollectionText: {
        color: '#2196F3',
        fontSize: 16,
        fontWeight: '500',
    },
    content: {
        flex: 1,
    },
    collectionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginHorizontal: 16,
        marginVertical: 4,
    },
    collectionImageContainer: {
        width: 56,
        height: 56,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionEmoji: {
        fontSize: 28,
    },
    collectionInfo: {
        flex: 1,
        marginLeft: 12,
    },
    collectionName: {
        fontSize: 16,
        fontWeight: '500',
    },
    collectionPrivacy: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    addButton: {
        padding: 8,
    },
    createCollectionButton: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    createCollectionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    createCollectionText: {
        flex: 1,
        marginLeft: 12,
    },
    createCollectionTitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    createCollectionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    formContainer: {
        flex: 1,
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
    },
    disabledText: {
        opacity: 0.5,
    },
    deleteConfirmOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteConfirmBox: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        width: '80%',
        maxWidth: 320,
    },
    deleteConfirmTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
    },
    deleteConfirmText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
    },
    deleteConfirmButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    deleteConfirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        marginHorizontal: 6,
    },
    cancelButton: {
        backgroundColor: '#f5f5f5',
    },
    deleteButton: {
        backgroundColor: '#ff3b30',
    },
    cancelButtonText: {
        color: '#666',
        textAlign: 'center',
        fontWeight: '600',
    },
    deleteButtonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: '600',
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
    collectionDescription: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    collectionNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sharedLabel: {
        fontSize: 12,
        color: '#2196F3',
        marginLeft: 6,
        fontWeight: '500',
    },
    sharedCollectionContainer: {
        backgroundColor: '#e6f2ff',
    },
    sharedBadge: {
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
    membersCount: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
    },
});

export default ArchiveGroupModal;