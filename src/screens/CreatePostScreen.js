import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    FlatList,
    Dimensions,
    Platform,
    Animated,
    ActivityIndicator,
    ScrollView,
    Modal,
    StatusBar
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import * as MediaLibrary from 'expo-media-library';
import { translate } from '../i18n/i18n';

const { width, height } = Dimensions.get('window');
const THUMB_SIZE = width / 4;
const SELECTED_IMAGE_HEIGHT = width;
const HEADER_HEIGHT = 56;
const ALBUM_SELECTOR_HEIGHT = 47;
const HEADER_TOTAL_HEIGHT = HEADER_HEIGHT + ALBUM_SELECTOR_HEIGHT;
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const CreatePostScreen = ({ navigation }) => {
    const [selectedImage, setSelectedImage] = useState(null);
    const [galleryImages, setGalleryImages] = useState([]);
    const [hasMoreImages, setHasMoreImages] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [after, setAfter] = useState(null);  // Pagination için
    const scrollY = useRef(new Animated.Value(0)).current;

    // Albüm filtreleme için yeni state'ler
    const [albums, setAlbums] = useState([]);
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [showAlbumPicker, setShowAlbumPicker] = useState(false);
    const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

    // Transform için yeni interpolate değerleri
    const imageTranslateY = scrollY.interpolate({
        inputRange: [0, SELECTED_IMAGE_HEIGHT],
        outputRange: [0, -SELECTED_IMAGE_HEIGHT],
        extrapolate: 'clamp'
    });

    const imageScale = scrollY.interpolate({
        inputRange: [0, SELECTED_IMAGE_HEIGHT],
        outputRange: [1, 0.5],
        extrapolate: 'clamp'
    });

    // Seçili görsel alanının opacity değeri
    const imageAreaOpacity = scrollY.interpolate({
        inputRange: [SELECTED_IMAGE_HEIGHT / 2, SELECTED_IMAGE_HEIGHT],
        outputRange: [1, 0],
        extrapolate: 'clamp'
    });

    // Header arka planının opacity değeri - kaydırma ile görünür olacak
    const headerBgOpacity = scrollY.interpolate({
        inputRange: [0, SELECTED_IMAGE_HEIGHT / 2],
        outputRange: [0, 1],
        extrapolate: 'clamp'
    });

    // Header pozisyonu için ek bir Animated değer
    const headerPosition = useRef(new Animated.Value(0)).current;

    // Header scroll pozisyonunu güncelleyen fonksiyon
    const updateHeaderOpacity = (scrollValue) => {
        const newOpacity = Math.min(1, scrollValue / (SELECTED_IMAGE_HEIGHT / 2));
        headerPosition.setValue(newOpacity);
    };

    // ScrollY değiştiğinde header pozisyonunu güncelle
    useEffect(() => {
        const scrollListener = scrollY.addListener(({ value }) => {
            updateHeaderOpacity(value);
        });

        return () => {
            scrollY.removeListener(scrollListener);
        };
    }, []);

    useEffect(() => {
        loadGalleryImages();
        loadAlbums();
    }, []);

    // Albümleri yükleyen fonksiyon
    const loadAlbums = async () => {
        try {
            setIsLoadingAlbums(true);
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                alert(translate('gallery_permission_error'));
                return;
            }

            const albumsResult = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
            // Tüm fotoğraflar seçeneği ekleyelim
            const allPhotosOption = { id: 'all', title: translate('all_photos'), assetCount: 0 };
            setAlbums([allPhotosOption, ...albumsResult]);
        } catch (error) {
            console.error('Albüm yükleme hatası:', error);
        } finally {
            setIsLoadingAlbums(false);
        }
    };

    const loadGalleryImages = async (loadMore = false, albumId = null) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                alert(translate('gallery_permission_error'));
                return;
            }

            setIsLoadingMore(true);

            // Eğer herhangi bir albüm filtrelemesi yapılmadıysa veya "Tüm Fotoğraflar" seçildiyse
            const options = {
                mediaType: 'photo',
                sortBy: ['creationTime'],
                first: 50,  // Her seferinde 50 fotoğraf
                after: loadMore ? after : undefined
            };

            // Eğer bir albüm seçildiyse ve "Tüm Fotoğraflar" değilse, albüm ID'sini ekle
            if (albumId && albumId !== 'all') {
                options.album = albumId;
            }

            const media = await MediaLibrary.getAssetsAsync(options);

            if (!media.hasNextPage) {
                setHasMoreImages(false);
            }

            setAfter(media.endCursor);

            if (loadMore) {
                setGalleryImages(prevImages => [...prevImages, ...media.assets]);
            } else {
                setGalleryImages(media.assets);
                if (media.assets.length > 0) {
                    setSelectedImage(media.assets[0].uri);
                }
            }
        } catch (error) {
            console.error('Galeri yükleme hatası:', error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleAlbumSelect = (album) => {
        setSelectedAlbum(album);
        setShowAlbumPicker(false);
        setHasMoreImages(true);
        setAfter(null);
        loadGalleryImages(false, album.id);
    };

    const handleLoadMore = () => {
        if (!isLoadingMore && hasMoreImages) {
            loadGalleryImages(true, selectedAlbum?.id);
        }
    };

    const handleImageSelect = (uri) => {
        setSelectedImage(uri);
        // Görsel seçildiğinde scrollY'yi sıfırla
        scrollY.setValue(0);
    };

    const renderGalleryItem = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.thumbContainer,
                selectedImage === item.uri && styles.selectedThumb
            ]}
            onPress={() => handleImageSelect(item.uri)}
            activeOpacity={0.7}
        >
            <FastImage
                source={{ uri: item.uri }}
                style={styles.thumb}
                resizeMode={FastImage.resizeMode.cover}
            />
        </TouchableOpacity>
    );

    return (
        <>
            <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: STATUSBAR_HEIGHT,
                backgroundColor: '#fff',
                zIndex: 9999
            }} />
            <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={true} />
            <View style={styles.container}>
                {/* Ana İçerik - Scrollable */}
                <Animated.FlatList
                    data={galleryImages}
                    renderItem={renderGalleryItem}
                    keyExtractor={item => item.id}
                    numColumns={4}
                    showsVerticalScrollIndicator={false}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: true }
                    )}
                    scrollEventThrottle={16}
                    style={styles.gallery}
                    contentContainerStyle={[
                        styles.galleryContent,
                        {
                            paddingTop: SELECTED_IMAGE_HEIGHT + HEADER_TOTAL_HEIGHT +
                                (Platform.OS === 'ios' ? STATUSBAR_HEIGHT : 0)
                        }
                    ]}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyGallery}>
                            <Ionicons name="images-outline" size={48} color="#ccc" />
                            <Text style={styles.emptyGalleryText}>{translate('no_images_in_album')}</Text>
                        </View>
                    )}
                    ListFooterComponent={() => (
                        isLoadingMore ? (
                            <View style={styles.loadingMore}>
                                <ActivityIndicator size="small" color="#25D220" />
                            </View>
                        ) : null
                    )}
                />

                {/* Seçili Görsel - Animasyonlu */}
                <Animated.View style={[
                    styles.selectedImageContainer,
                    {
                        transform: [
                            { translateY: imageTranslateY },
                            { scale: imageScale }
                        ],
                        opacity: imageAreaOpacity,
                        top: HEADER_TOTAL_HEIGHT + (Platform.OS === 'ios' ? STATUSBAR_HEIGHT : 0)
                    }
                ]}>
                    {selectedImage ? (
                        <FastImage
                            source={{ uri: selectedImage }}
                            style={styles.selectedImage}
                            resizeMode={FastImage.resizeMode.cover}
                        />
                    ) : (
                        <View style={styles.noImagePlaceholder}>
                            <Ionicons name="images-outline" size={48} color="#666" />
                            <Text style={styles.noImageText}>{translate('select_image')}</Text>
                        </View>
                    )}
                </Animated.View>

                {/* Header - Sabit */}
                <View style={[styles.headerContainer, {
                    top: Platform.OS === 'ios' ? STATUSBAR_HEIGHT : STATUSBAR_HEIGHT
                }]}>
                    <Animated.View
                        style={[
                            styles.headerBackground,
                            { opacity: headerPosition }
                        ]}
                    />
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.headerButton}
                        >
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{translate('create_post_title')}</Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('CreatePostDetails', { image: selectedImage })}
                            disabled={!selectedImage}
                            style={[styles.nextButton, !selectedImage && styles.nextButtonDisabled]}
                        >
                            <Text style={[styles.nextButtonText, !selectedImage && styles.nextButtonTextDisabled]}>
                                {translate('next')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Albüm Seçici - Header altına sabit */}
                    <View style={styles.albumSelectorContainer}>
                        <View style={styles.albumSelectorWrapper}>
                            <Text style={styles.albumLabel}>{translate('album_label')}</Text>
                            <TouchableOpacity
                                style={styles.albumSelector}
                                onPress={() => setShowAlbumPicker(true)}
                            >
                                <Text style={styles.albumSelectorText} numberOfLines={1} ellipsizeMode="tail">
                                    {selectedAlbum ? selectedAlbum.title : translate('all_photos')}
                                </Text>
                                <MaterialIcons name="arrow-drop-down" size={24} color="#2196F3" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Albüm Seçme Modal */}
                <Modal
                    visible={showAlbumPicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowAlbumPicker(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowAlbumPicker(false)}
                    >
                        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{translate('select_album')}</Text>
                                <TouchableOpacity onPress={() => setShowAlbumPicker(false)}>
                                    <Ionicons name="close" size={24} color="#000" />
                                </TouchableOpacity>
                            </View>

                            {isLoadingAlbums ? (
                                <View style={styles.loadingAlbums}>
                                    <ActivityIndicator size="large" color="#2196F3" />
                                    <Text style={styles.loadingText}>{translate('album_loading')}</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={albums}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[
                                                styles.albumItem,
                                                selectedAlbum?.id === item.id && styles.selectedAlbumItem
                                            ]}
                                            onPress={() => handleAlbumSelect(item)}
                                        >
                                            <View style={styles.albumItemContent}>
                                                <MaterialIcons
                                                    name="photo-album"
                                                    size={24}
                                                    color={selectedAlbum?.id === item.id ? "#2196F3" : "#666"}
                                                />
                                                <View style={styles.albumTextContainer}>
                                                    <Text style={styles.albumTitle}>{item.title}</Text>
                                                    {item.id !== 'all' && (
                                                        <Text style={styles.albumCount}>{item.assetCount} {translate('photo_count')}</Text>
                                                    )}
                                                </View>
                                            </View>
                                            {selectedAlbum?.id === item.id && (
                                                <MaterialIcons name="check" size={24} color="#2196F3" />
                                            )}
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                    </TouchableOpacity>
                </Modal>
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    headerContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#fff',
    },
    headerBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HEADER_TOTAL_HEIGHT,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: HEADER_HEIGHT,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    headerButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    nextButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#2196F3',
        borderRadius: 20,
    },
    nextButtonDisabled: {
        backgroundColor: '#E0E0E0',
    },
    nextButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    nextButtonTextDisabled: {
        color: '#999',
    },
    albumSelectorContainer: {
        width: '100%',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    albumSelectorWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    albumLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#555',
        marginRight: 8,
    },
    albumSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flex: 1,
        maxWidth: width - 100,
    },
    albumSelectorText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#2196F3',
        marginRight: 4,
        flex: 1,
    },
    selectedImageContainer: {
        width: width,
        height: SELECTED_IMAGE_HEIGHT,
        backgroundColor: '#f5f5f5',
        position: 'absolute',
        zIndex: 1,
    },
    selectedImage: {
        width: '100%',
        height: '100%',
    },
    noImagePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noImageText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    gallery: {
        flex: 1,
    },
    galleryContent: {
        paddingBottom: 100, // Kaydırma için ekstra boşluk
    },
    thumbContainer: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        padding: 1,
    },
    thumb: {
        width: '100%',
        height: '100%',
    },
    selectedThumb: {
        opacity: 0.7,
    },
    loadingMore: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyGallery: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyGalleryText: {
        fontSize: 16,
        color: '#666',
        marginTop: 12,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: height * 0.7,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    albumItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    selectedAlbumItem: {
        backgroundColor: '#f0f8ff',
    },
    albumItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    albumTextContainer: {
        marginLeft: 12,
    },
    albumTitle: {
        fontSize: 16,
        color: '#333',
    },
    albumCount: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    loadingAlbums: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
        fontSize: 16,
    }
});

export default CreatePostScreen; 