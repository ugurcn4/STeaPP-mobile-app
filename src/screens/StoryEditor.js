import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Text,
    TextInput,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { PinchGestureHandler, PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedGestureHandler,
    useAnimatedStyle,
    useSharedValue,
    runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Modal from 'react-native-modal';
import { uploadStory } from '../services/storyService';
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MusicPicker } from '../components/MusicPicker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getCurrentUserUid } from '../services/friendFunctions';
import LocationPicker from '../components/LocationPicker';
import ViewShot from "react-native-view-shot";
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const StoryEditor = ({ route, navigation }) => {
    const { imageUri } = route.params;
    const [text, setText] = useState('');
    const [textColor, setTextColor] = useState('#FFFFFF');
    const [fontSize, setFontSize] = useState(20);
    const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
    const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [isMusicPickerVisible, setIsMusicPickerVisible] = useState(false);
    const [selectedMusic, setSelectedMusic] = useState(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const viewShotRef = useRef();
    const [storySound, setStorySound] = useState(null);

    // Tüm animasyon değerlerini useSharedValue olarak tanımla
    const imageScale = useSharedValue(1);
    const imageTranslateX = useSharedValue(0);
    const imageTranslateY = useSharedValue(0);
    const textPosition = useSharedValue({
        x: SCREEN_WIDTH / 2 - 50,
        y: SCREEN_HEIGHT / 2 - 20
    });

    // Konum kartı için pozisyon değeri
    const locationPosition = useSharedValue({
        x: 0,
        y: 0
    });

    // Müzik kartı için pozisyon değeri
    const musicPosition = useSharedValue({
        x: 0,
        y: 0
    });

    // Bottom sheet ref
    const bottomSheetModalRef = useRef(null);

    // Çöp kovası için state
    const [isTrashActive, setIsTrashActive] = useState(false);

    // Status bar yüksekliğini al
    const STATUS_BAR_HEIGHT = StatusBar.currentHeight || (Platform.OS === 'ios' ? 44 : 0);
    const HEADER_PADDING_TOP = Platform.OS === 'ios' ? 50 : 20;
    const TOTAL_TOP_HEIGHT = STATUS_BAR_HEIGHT + HEADER_PADDING_TOP;

    // Çöp kovası alanını kontrol eden fonksiyon
    const checkTrashArea = (x, y) => {
        'worklet';
        const trashArea = {
            minX: 100, // Çöp kovası butonunun başlangıç x koordinatı
            maxX: 160, // Çöp kovası butonunun bitiş x koordinatı
            minY: 0,   // En üstten başla
            maxY: 120  // Yeterince aşağıya kadar devam et
        };

        return (
            x >= trashArea.minX &&
            x <= trashArea.maxX &&
            y >= trashArea.minY &&
            y <= trashArea.maxY
        );
    };

    // Görsel için pan gesture handler
    const imagePanHandler = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startX = imageTranslateX.value;
            ctx.startY = imageTranslateY.value;
        },
        onActive: (event, ctx) => {
            imageTranslateX.value = ctx.startX + event.translationX;
            imageTranslateY.value = ctx.startY + event.translationY;
        },
    });

    // Görsel için pinch gesture handler
    const imagePinchHandler = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startScale = imageScale.value;
        },
        onActive: (event, ctx) => {
            imageScale.value = Math.max(0.5, Math.min(ctx.startScale * event.scale, 3));
        },
    });

    // Görsel için animated style
    const animatedImageStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: imageScale.value },
                { translateX: imageTranslateX.value },
                { translateY: imageTranslateY.value },
            ],
        };
    });

    // Konum kartı için gesture handler'ı basitleştir
    const locationPanHandler = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startX = locationPosition.value.x;
            ctx.startY = locationPosition.value.y;
        },
        onActive: (event, ctx) => {
            locationPosition.value = {
                x: ctx.startX + event.translationX,
                y: ctx.startY + event.translationY,
            };

            // Çöp kovası kontrolü
            if (
                event.absoluteX >= 150 &&
                event.absoluteX <= 200 &&
                event.absoluteY <= 100
            ) {
                runOnJS(setIsTrashActive)(true);
            } else {
                runOnJS(setIsTrashActive)(false);
            }
        },
        onEnd: (event) => {
            if (
                event.absoluteX >= 150 &&
                event.absoluteX <= 200 &&
                event.absoluteY <= 100
            ) {
                runOnJS(setSelectedLocation)(null);
            }
            runOnJS(setIsTrashActive)(false);
        },
    });

    // Metin için gesture handler'ı basitleştir
    const panGestureHandler = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startX = textPosition.value.x;
            ctx.startY = textPosition.value.y;
        },
        onActive: (event, ctx) => {
            textPosition.value = {
                x: ctx.startX + event.translationX,
                y: ctx.startY + event.translationY,
            };

            // Çöp kovası kontrolü
            if (
                event.absoluteX >= 150 &&
                event.absoluteX <= 200 &&
                event.absoluteY <= 100
            ) {
                runOnJS(setIsTrashActive)(true);
            } else {
                runOnJS(setIsTrashActive)(false);
            }
        },
        onEnd: (event) => {
            if (
                event.absoluteX >= 150 &&
                event.absoluteX <= 200 &&
                event.absoluteY <= 100
            ) {
                runOnJS(setText)('');
            }
            runOnJS(setIsTrashActive)(false);
        },
    });

    // Görsel için animated style
    const textStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: textPosition.value.x },
                { translateY: textPosition.value.y },
            ],
        };
    });

    // Konum kartı için animated style
    const locationStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: locationPosition.value.x },
            { translateY: locationPosition.value.y }
        ]
    }));

    // Müzik kartı için gesture handler
    const musicPanHandler = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startX = musicPosition.value.x;
            ctx.startY = musicPosition.value.y;
        },
        onActive: (event, ctx) => {
            musicPosition.value = {
                x: ctx.startX + event.translationX,
                y: ctx.startY + event.translationY,
            };

            // Çöp kovası kontrolü
            if (
                event.absoluteX >= 150 &&
                event.absoluteX <= 200 &&
                event.absoluteY <= 100
            ) {
                runOnJS(setIsTrashActive)(true);
            } else {
                runOnJS(setIsTrashActive)(false);
            }
        },
        onEnd: (event) => {
            if (
                event.absoluteX >= 150 &&
                event.absoluteX <= 200 &&
                event.absoluteY <= 100
            ) {
                runOnJS(setSelectedMusic)(null);
            }
            runOnJS(setIsTrashActive)(false);
        },
    });

    // Müzik kartı için animated style
    const musicStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: musicPosition.value.x },
            { translateY: musicPosition.value.y }
        ]
    }));

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    const handleTextInputBlur = () => {
        Keyboard.dismiss();
    };

    // Hikayeyi paylaş
    const shareStory = async () => {
        try {
            const userId = await getCurrentUserUid();
            if (!userId) {
                Alert.alert('Hata', 'Kullanıcı bulunamadı');
                return;
            }

            // Tüm içeriği tek bir görüntüde yakala
            const uri = await viewShotRef.current.capture();

            // Görüntü boyutlarını Promise olarak al
            const getImageSize = () => {
                return new Promise((resolve, reject) => {
                    Image.getSize(uri, (width, height) => {
                        resolve({ width, height });
                    }, reject);
                });
            };

            const imageInfo = await getImageSize();

            // Maksimum boyutlar (1080p'yi geçmesin)
            const MAX_WIDTH = 1080;
            const MAX_HEIGHT = 1920;

            // En-boy oranını koru
            let targetWidth = imageInfo.width;
            let targetHeight = imageInfo.height;

            if (targetWidth > MAX_WIDTH) {
                const ratio = MAX_WIDTH / targetWidth;
                targetWidth = MAX_WIDTH;
                targetHeight = Math.floor(targetHeight * ratio);
            }

            if (targetHeight > MAX_HEIGHT) {
                const ratio = MAX_HEIGHT / targetHeight;
                targetHeight = MAX_HEIGHT;
                targetWidth = Math.floor(targetWidth * ratio);
            }

            // Görüntüyü optimize et
            const manipulateResult = await manipulateAsync(
                uri,
                [
                    {
                        resize: {
                            width: targetWidth,
                            height: targetHeight
                        }
                    }
                ],
                {
                    compress: 0.8, // %80 kalite
                    format: SaveFormat.JPEG
                }
            );

            const response = await fetch(manipulateResult.uri);
            const blob = await response.blob();

            // Hikaye verilerini hazırla
            const storyData = {
                text,
                textPosition: textPosition.value,
                textColor,
                fontSize,
                location: selectedLocation,
                music: selectedMusic,
                originalWidth: imageInfo.width,
                originalHeight: imageInfo.height,
                width: targetWidth,
                height: targetHeight
            };

            const uploadResult = await uploadStory(userId, blob, storyData);

            if (uploadResult.success) {
                Alert.alert('Başarılı', 'Hikayen paylaşıldı!');
                navigation.goBack();
            } else {
                Alert.alert('Hata', 'Hikaye paylaşılırken bir sorun oluştu.');
            }
        } catch (error) {
            console.error('Hikaye paylaşma hatası:', error);
            Alert.alert('Hata', 'Hikaye paylaşılırken bir sorun oluştu.');
        }
    };

    // LocationPicker için handler fonksiyonu
    const handleLocationSelect = (location) => {
        setSelectedLocation(location);
        setIsLocationPickerVisible(false);
        // Konum seçildiğinde başlangıç pozisyonunu ayarla
        locationPosition.value = {
            x: 0,
            y: 0
        };
    };

    // Müzik çalma fonksiyonu
    const playStoryMusic = async (track) => {
        try {
            if (storySound) {
                await storySound.unloadAsync();
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: track.previewUrl },
                {
                    isLooping: true,
                    shouldPlay: true,
                    volume: 0.5
                }
            );

            setStorySound(newSound);
        } catch (error) {
            console.error('Müzik çalma hatası:', error);
        }
    };

    // Müzik seçildiğinde
    const handleMusicSelect = (track) => {
        setSelectedMusic(track);
        setIsMusicPickerVisible(false);
        playStoryMusic(track);
        musicPosition.value = {
            x: 0,
            y: SCREEN_HEIGHT / 2 - 150
        };
    };

    // Müzik kaynağını temizle
    useEffect(() => {
        return () => {
            if (storySound) {
                storySound.unloadAsync();
            }
        };
    }, [storySound]);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <BottomSheetModalProvider>
                {/* Ana içerik */}
                <ViewShot
                    ref={viewShotRef}
                    options={{ format: "jpg", quality: 1 }}
                    style={styles.content}
                >
                    <View style={styles.imageWrapper}>
                        <PinchGestureHandler onGestureEvent={imagePinchHandler}>
                            <Animated.View style={styles.imageContainer}>
                                <PanGestureHandler onGestureEvent={imagePanHandler}>
                                    <Animated.View style={[styles.imageContainer, animatedImageStyle]}>
                                        <FastImage
                                            source={{ uri: imageUri }}
                                            style={styles.image}
                                            resizeMode={FastImage.resizeMode.cover}
                                        />
                                    </Animated.View>
                                </PanGestureHandler>
                            </Animated.View>
                        </PinchGestureHandler>
                    </View>

                    {text && (
                        <PanGestureHandler onGestureEvent={panGestureHandler}>
                            <Animated.View style={[styles.textContainer, textStyle]}>
                                <Text style={[styles.storyText, { color: textColor, fontSize }]}>
                                    {text}
                                </Text>
                            </Animated.View>
                        </PanGestureHandler>
                    )}

                    {/* Seçili müzik göstergesi */}
                    {selectedMusic && (
                        <PanGestureHandler onGestureEvent={musicPanHandler}>
                            <Animated.View style={[styles.musicCard, musicStyle]}>
                                <View style={styles.musicContent}>
                                    <FastImage
                                        source={{ uri: selectedMusic.imageUrl }}
                                        style={styles.musicImage}
                                        resizeMode={FastImage.resizeMode.cover}
                                    />
                                    <View style={styles.musicInfo}>
                                        <Text style={styles.musicTitle} numberOfLines={1}>
                                            {selectedMusic.name}
                                        </Text>
                                        <Text style={styles.musicArtist} numberOfLines={1}>
                                            {selectedMusic.artist}
                                        </Text>
                                    </View>
                                </View>
                            </Animated.View>
                        </PanGestureHandler>
                    )}

                    {/* Sürüklenebilir konum kartı */}
                    {selectedLocation && (
                        <PanGestureHandler onGestureEvent={locationPanHandler}>
                            <Animated.View style={[styles.locationContainer, locationStyle]}>
                                <LinearGradient
                                    colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.locationGradient}
                                >
                                    <View style={styles.locationIconContainer}>
                                        <Ionicons name="location" size={20} color="#2196F3" />
                                    </View>
                                    <View style={styles.locationTextContainer}>
                                        <Text style={styles.locationName} numberOfLines={1}>
                                            {selectedLocation.name}
                                        </Text>
                                        <Text style={styles.locationAddress} numberOfLines={1}>
                                            {selectedLocation.address}
                                        </Text>
                                    </View>
                                </LinearGradient>
                            </Animated.View>
                        </PanGestureHandler>
                    )}
                </ViewShot>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="close" size={24} color="#FFF" />
                    </TouchableOpacity>

                    <View style={styles.headerTools}>
                        <TouchableOpacity
                            style={[
                                styles.headerButton,
                                isTrashActive && styles.headerButtonActive
                            ]}
                        >
                            <Ionicons
                                name="trash"
                                size={24}
                                color={isTrashActive ? "#FF3B30" : "#FFF"}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => bottomSheetModalRef.current?.present()}
                        >
                            <Ionicons name="text" size={24} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setIsLocationPickerVisible(true)}
                        >
                            <Ionicons name="location" size={24} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setIsMusicPickerVisible(true)}
                        >
                            <Ionicons name="musical-notes" size={24} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setIsColorPickerVisible(true)}
                        >
                            <Ionicons name="color-palette" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Alt kısımdaki siyah alan ve butonlar */}
                <View style={styles.bottomBar}>
                    <View style={styles.bottomBarContent}>
                        <TouchableOpacity style={styles.bottomBarButton}>
                            <Ionicons name="images-outline" size={24} color="#FFF" />
                            <Text style={styles.bottomBarButtonText}>Hikayen</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.bottomBarButton}>
                            <Ionicons name="star-outline" size={24} color="#FFF" />
                            <Text style={styles.bottomBarButtonText}>Yakın Arkadaşlar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.bottomBarButton} onPress={shareStory}>
                            <Ionicons name="arrow-forward" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Metin düzenleme bottom sheet */}
                <BottomSheetModal
                    ref={bottomSheetModalRef}
                    index={1}
                    snapPoints={['25%', '50%']}
                    backgroundStyle={styles.bottomSheet}
                    keyboardBehavior="extend"
                    android_keyboardInputMode="adjustResize"
                >
                    <View style={styles.bottomSheetContent}>
                        <TextInput
                            style={styles.textInput}
                            value={text}
                            onChangeText={setText}
                            placeholder="Metin ekle..."
                            placeholderTextColor="#999"
                            multiline
                            returnKeyType="done"
                            blurOnSubmit={true}
                            onBlur={handleTextInputBlur}
                            autoFocus={true}
                        />
                        <Slider
                            style={styles.slider}
                            minimumValue={12}
                            maximumValue={48}
                            value={fontSize}
                            onValueChange={setFontSize}
                        />
                    </View>
                </BottomSheetModal>

                {/* Renk seçici modal */}
                <Modal
                    isVisible={isColorPickerVisible}
                    onBackdropPress={() => setIsColorPickerVisible(false)}
                    style={styles.modal}
                >
                    <View style={styles.colorPicker}>
                        {['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF'].map((color) => (
                            <TouchableOpacity
                                key={color}
                                style={[styles.colorOption, { backgroundColor: color }]}
                                onPress={() => {
                                    setTextColor(color);
                                    setIsColorPickerVisible(false);
                                }}
                            />
                        ))}
                    </View>
                </Modal>

                {/* Konum seçici modal */}
                <Modal
                    isVisible={isLocationPickerVisible}
                    onBackdropPress={() => setIsLocationPickerVisible(false)}
                    style={styles.modal}
                >
                    <View style={styles.locationPickerContainer}>
                        <LocationPicker
                            onSelect={handleLocationSelect}
                            onClose={() => setIsLocationPickerVisible(false)}
                        />
                    </View>
                </Modal>

                {/* Müzik seçici modal */}
                <Modal
                    isVisible={isMusicPickerVisible}
                    onBackdropPress={() => setIsMusicPickerVisible(false)}
                    style={styles.modal}
                >
                    <View style={styles.musicPickerContainer}>
                        <MusicPicker
                            onSelect={handleMusicSelect}
                            onClose={() => setIsMusicPickerVisible(false)}
                        />
                    </View>
                </Modal>
            </BottomSheetModalProvider>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 15,
        paddingBottom: 15,
    },
    headerTools: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerButtonActive: {
        backgroundColor: 'rgba(255, 59, 48, 0.2)', // iOS kırmızı rengi
    },
    content: {
        flex: 1,
        backgroundColor: '#000',
    },
    imageWrapper: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT - 100, // Alt kısım için 100 piksel boşluk bırak
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    imageContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT - 100,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        position: 'absolute',
        padding: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 5,
    },
    storyText: {
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
        textAlign: 'center',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        backgroundColor: '#000',
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    bottomBarContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        flex: 1,
    },
    bottomBarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    bottomBarButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '500',
    },
    bottomSheet: {
        backgroundColor: '#333',
    },
    bottomSheetContent: {
        padding: 16,
    },
    textInput: {
        backgroundColor: '#444',
        color: '#FFF',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    slider: {
        width: '100%',
    },
    modal: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorPicker: {
        flexDirection: 'row',
        backgroundColor: '#333',
        padding: 16,
        borderRadius: 8,
    },
    colorOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginHorizontal: 8,
        borderWidth: 2,
        borderColor: '#FFF',
    },
    locationPickerContainer: {
        flex: 1,
        backgroundColor: '#333',
        borderRadius: 12,
        overflow: 'hidden',
        maxHeight: SCREEN_HEIGHT * 0.7,
        width: '90%',
    },
    locationContainer: {
        position: 'absolute',
        top: SCREEN_HEIGHT / 2, // Ekranın ortasından başla
        left: SCREEN_WIDTH / 2 - 75, // Kartın genişliğinin yarısı kadar sola kaydır
        maxWidth: '90%',
        minWidth: 150,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 100, // Diğer elementlerin üzerinde görünmesi için
    },
    locationGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        flexWrap: 'nowrap',
    },
    locationIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        flexShrink: 0,
    },
    locationTextContainer: {
        flex: 1,
        flexShrink: 1,
    },
    locationName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    locationAddress: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    musicPickerContainer: {
        flex: 1,
        backgroundColor: '#333',
        borderRadius: 12,
        overflow: 'hidden',
        maxHeight: SCREEN_HEIGHT * 0.7,
        width: '90%',
    },
    musicCard: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 12,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: 250,
        left: SCREEN_WIDTH / 2 - 125, // Kartın genişliğinin yarısı kadar sola kaydır
    },
    musicContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    musicImage: {
        width: 40,
        height: 40,
        borderRadius: 6,
    },
    musicInfo: {
        marginLeft: 10,
        flex: 1,
    },
    musicTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    musicArtist: {
        color: '#CCC',
        fontSize: 12,
        marginTop: 2,
    },
});

export default StoryEditor; 