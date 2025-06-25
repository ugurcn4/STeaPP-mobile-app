import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, StatusBar, Image, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import { lightTheme, darkTheme } from '../../themes';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { translate } from '../../i18n/i18n';
import { db } from '../../../firebaseConfig';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';

// Örnek duyuru verileri artık kullanılmayacak
// const dummyAnnouncements = [ ... ]

const AnnouncementsPage = ({ navigation }) => {
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;
    const [activeFilter, setActiveFilter] = useState('all');
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Firestore'dan duyuruları çek
    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            
            // Firestore'dan veri çekme
            const announcementsRef = collection(db, 'announcements');
            const q = query(announcementsRef, orderBy('date', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const announcementsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Firestore'dan gelen timestamp'i JS Date'e dönüştür
                date: doc.data().date instanceof Timestamp ? 
                      formatDate(doc.data().date.toDate()) : 
                      doc.data().date
            }));
            
            setAnnouncements(announcementsData);
            setError(null);
        } catch (err) {
            console.error('Error fetching announcements:', err);
            setError('Duyurular yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    // Tarihi formatlama fonksiyonu
    const formatDate = (date) => {
        if (!date) return '';
        
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('tr-TR', options);
    };
    
    // Filtrelenmiş duyurular
    const filteredAnnouncements = activeFilter === 'all' 
        ? announcements 
        : announcements.filter(ann => ann.type === activeFilter);

    const getIconColor = (type) => {
        switch(type) {
            case 'update': return '#4CAF50';
            case 'feature': return '#2196F3';
            case 'news': return '#FFA500';
            case 'maintenance': return '#FF5722';
            default: return '#9C27B0';
        }
    };

    // Duyuru türüne göre ikon adını al
    const getIconName = (type) => {
        switch(type) {
            case 'update': return 'refresh-circle';
            case 'feature': return 'flash';
            case 'news': return 'newspaper';
            case 'maintenance': return 'construct';
            default: return 'information-circle';
        }
    };

    const openAnnouncementDetails = (announcement) => {
        setSelectedAnnouncement(announcement);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
    };

    const renderAnnouncementDetailModal = () => {
        if (!selectedAnnouncement) return null;
        
        const iconColor = getIconColor(selectedAnnouncement.type);
        const iconName = selectedAnnouncement.iconName || getIconName(selectedAnnouncement.type);
        
        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={[
                        styles.modalContent, 
                        { backgroundColor: theme === 'dark' ? '#1E1E1E' : '#FFFFFF' }
                    ]}>
                        <View style={[
                            styles.modalHeader,
                            { borderBottomColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                        ]}>
                            <TouchableOpacity 
                                style={styles.closeButton}
                                onPress={closeModal}
                            >
                                <Ionicons name="close" size={24} color={currentTheme.text} />
                            </TouchableOpacity>
                            
                            <View style={[styles.modalHeaderBadge, { backgroundColor: `${iconColor}20` }]}>
                                <Ionicons name={iconName} size={16} color={iconColor} style={{ marginRight: 6 }} />
                                <Text style={[styles.modalHeaderBadgeText, { color: iconColor }]}>
                                    {selectedAnnouncement.type === 'update' ? 'Güncelleme' : 
                                     selectedAnnouncement.type === 'feature' ? 'Yeni Özellik' :
                                     selectedAnnouncement.type === 'news' ? 'Haber' : 'Bakım'}
                                </Text>
                            </View>
                        </View>
                        
                        <ScrollView 
                            style={styles.modalBody}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>
                                {selectedAnnouncement.title}
                            </Text>
                            
                            <Text style={[styles.modalDate, { color: currentTheme.textSecondary }]}>
                                {selectedAnnouncement.date}
                            </Text>
                            
                            <View style={styles.modalDivider} />
                            
                            <Text style={[styles.modalDescription, { color: currentTheme.text }]}>
                                {selectedAnnouncement.description}
                            </Text>
                            
                            {selectedAnnouncement.details && (
                                <View>
                                    {selectedAnnouncement.detailsTitle && (
                                        <Text style={[styles.modalDescription, { color: currentTheme.text, marginTop: 15, fontWeight: '600' }]}>
                                            {selectedAnnouncement.detailsTitle}
                                        </Text>
                                    )}
                                    
                                    {selectedAnnouncement.bulletPoints && selectedAnnouncement.bulletPoints.length > 0 && (
                                        <View style={styles.bulletPointContainer}>
                                            {selectedAnnouncement.bulletPoints.map((point, index) => (
                                                <View key={index} style={styles.bulletPoint}>
                                                    <Ionicons 
                                                        name="checkmark-circle" 
                                                        size={18} 
                                                        color={iconColor} 
                                                        style={styles.bulletIcon} 
                                                    />
                                                    <Text style={[styles.bulletText, { color: currentTheme.text }]}>
                                                        {point}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                    
                                    {selectedAnnouncement.details && (
                                        <Text style={[styles.modalDescription, { color: currentTheme.text, marginTop: 15 }]}>
                                            {selectedAnnouncement.details}
                                        </Text>
                                    )}
                                </View>
                            )}
                            
                            {selectedAnnouncement.footer && (
                                <Text style={[styles.modalDescription, { color: currentTheme.text, marginTop: 15 }]}>
                                    {selectedAnnouncement.footer}
                                </Text>
                            )}
                        </ScrollView>
                        
                        <View style={[
                            styles.modalFooter,
                            { borderTopColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                        ]}>
                            <TouchableOpacity 
                                style={[styles.modalButton, { backgroundColor: iconColor }]}
                                onPress={closeModal}
                            >
                                <Text style={styles.modalButtonText}>Tamam</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };
    
    const renderAnnouncementCard = (item) => {
        const iconColor = getIconColor(item.type);
        const iconName = item.iconName || getIconName(item.type);
        
        return (
            <TouchableOpacity 
                key={item.id}
                style={[styles.announcementCard, { backgroundColor: currentTheme.cardBackground }]}
                onPress={() => openAnnouncementDetails(item)}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                        <Ionicons name={iconName} size={24} color={iconColor} />
                    </View>
                    <View style={styles.cardTitleContainer}>
                        <Text style={[styles.cardTitle, { color: currentTheme.text }]}>
                            {item.title}
                        </Text>
                        <Text style={[styles.cardDate, { color: currentTheme.textSecondary }]}>
                            {item.date}
                        </Text>
                    </View>
                    {item.isNew && (
                        <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>Yeni</Text>
                        </View>
                    )}
                </View>
                
                <Text style={[styles.cardDescription, { color: currentTheme.textSecondary }]}>
                    {item.description}
                </Text>
                
                <View style={styles.cardFooter}>
                    <TouchableOpacity 
                        style={styles.readMoreButton}
                        onPress={() => openAnnouncementDetails(item)}
                    >
                        <Text style={[styles.readMoreText, { color: iconColor }]}>
                            Devamını Oku
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={iconColor} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const renderHeader = () => (
        <SafeAreaView style={[styles.header, { backgroundColor: currentTheme.cardBackground }]}>
            <View style={styles.headerContent}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: currentTheme.text }]}>
                    {translate('announcements')}
                </Text>
                <View style={styles.rightPlaceholder} />
            </View>
            
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.filterContainer}
                contentContainerStyle={styles.filterContent}
            >
                <TouchableOpacity 
                    style={[
                        styles.filterButton, 
                        { backgroundColor: activeFilter === 'all' ? '#333333' : '#33333340' }
                    ]}
                    onPress={() => setActiveFilter('all')}
                >
                    <Ionicons 
                        name="apps" 
                        size={16} 
                        color={activeFilter === 'all' ? '#FFFFFF' : '#333333'} 
                        style={styles.filterIcon}
                    />
                    <Text style={[
                        styles.filterText, 
                        { color: activeFilter === 'all' ? '#FFFFFF' : '#333333' }
                    ]}>Tümü</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[
                        styles.filterButton, 
                        { backgroundColor: activeFilter === 'update' ? '#4CAF50' : '#4CAF5040' }
                    ]}
                    onPress={() => setActiveFilter('update')}
                >
                    <Ionicons 
                        name="refresh-circle" 
                        size={16} 
                        color={activeFilter === 'update' ? '#FFFFFF' : '#4CAF50'} 
                        style={styles.filterIcon}
                    />
                    <Text style={[
                        styles.filterText, 
                        { color: activeFilter === 'update' ? '#FFFFFF' : '#4CAF50' }
                    ]}>Güncellemeler</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[
                        styles.filterButton, 
                        { backgroundColor: activeFilter === 'feature' ? '#2196F3' : '#2196F340' }
                    ]}
                    onPress={() => setActiveFilter('feature')}
                >
                    <Ionicons 
                        name="flash" 
                        size={16} 
                        color={activeFilter === 'feature' ? '#FFFFFF' : '#2196F3'}
                        style={styles.filterIcon} 
                    />
                    <Text style={[
                        styles.filterText, 
                        { color: activeFilter === 'feature' ? '#FFFFFF' : '#2196F3' }
                    ]}>Yeni Özellikler</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[
                        styles.filterButton, 
                        { backgroundColor: activeFilter === 'news' ? '#FFA500' : '#FFA50040' }
                    ]}
                    onPress={() => setActiveFilter('news')}
                >
                    <Ionicons 
                        name="newspaper" 
                        size={16} 
                        color={activeFilter === 'news' ? '#FFFFFF' : '#FFA500'}
                        style={styles.filterIcon} 
                    />
                    <Text style={[
                        styles.filterText, 
                        { color: activeFilter === 'news' ? '#FFFFFF' : '#FFA500' }
                    ]}>Haberler</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[
                        styles.filterButton, 
                        { backgroundColor: activeFilter === 'maintenance' ? '#FF5722' : '#FF572240' }
                    ]}
                    onPress={() => setActiveFilter('maintenance')}
                >
                    <Ionicons 
                        name="construct" 
                        size={16} 
                        color={activeFilter === 'maintenance' ? '#FFFFFF' : '#FF5722'}
                        style={styles.filterIcon} 
                    />
                    <Text style={[
                        styles.filterText, 
                        { color: activeFilter === 'maintenance' ? '#FFFFFF' : '#FF5722' }
                    ]}>Bakım</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={currentTheme.primary} />
                    <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
                        Duyurular yükleniyor...
                    </Text>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={60} color="#FF3B30" />
                    <Text style={[styles.errorText, { color: currentTheme.text }]}>
                        {error}
                    </Text>
                    <TouchableOpacity 
                        style={[styles.retryButton, { backgroundColor: currentTheme.primary }]}
                        onPress={() => {
                            setLoading(true);
                            setError(null);
                            // Veriyi yeniden yükle
                            fetchAnnouncements();
                        }}
                    >
                        <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (filteredAnnouncements.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={60} color={currentTheme.textSecondary} />
                    <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>
                        Bu kategoride duyuru bulunamadı
                    </Text>
                </View>
            );
        }

        return filteredAnnouncements.map(renderAnnouncementCard);
    };

    return (
        <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
            <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
            {renderHeader()}
            
            <ScrollView 
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {renderContent()}
            </ScrollView>
            
            {renderAnnouncementDetailModal()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight + 10,
        paddingBottom: 15,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    rightPlaceholder: {
        width: 40,
    },
    filterContainer: {
        flexGrow: 0,
    },
    filterContent: {
        paddingRight: 10,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
    },
    filterIcon: {
        marginRight: 5,
    },
    filterText: {
        fontSize: 13,
        fontWeight: '500',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 15,
        paddingBottom: 30,
    },
    announcementCard: {
        borderRadius: 16,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 45,
        height: 45,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardTitleContainer: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    cardDate: {
        fontSize: 12,
    },
    newBadge: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 10,
    },
    newBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    readMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
    },
    readMoreText: {
        fontSize: 13,
        fontWeight: '600',
        marginRight: 3,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 15,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: Dimensions.get('window').width * 0.9,
        maxHeight: Dimensions.get('window').height * 0.8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHeaderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    modalHeaderBadgeText: {
        fontSize: 14,
        fontWeight: '600',
    },
    modalBody: {
        padding: 20,
        maxHeight: Dimensions.get('window').height * 0.6,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalDate: {
        fontSize: 14,
        marginBottom: 15,
    },
    modalDivider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginVertical: 15,
    },
    modalDescription: {
        fontSize: 16,
        lineHeight: 24,
    },
    bulletPointContainer: {
        marginTop: 10,
        marginBottom: 15,
    },
    bulletPoint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    bulletIcon: {
        marginRight: 10,
        marginTop: 2,
    },
    bulletText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
    },
    modalFooter: {
        padding: 15,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    modalButton: {
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 30,
        minWidth: 150,
        alignItems: 'center',
    },
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    // Loading ve Error styles
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 50,
    },
    loadingText: {
        fontSize: 16,
        marginTop: 15,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 50,
    },
    errorText: {
        fontSize: 16,
        marginTop: 15,
        marginBottom: 20,
        textAlign: 'center',
    },
    retryButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    retryButtonText: {
        color: 'white',
        fontWeight: '600',
    },
});

export default AnnouncementsPage; 