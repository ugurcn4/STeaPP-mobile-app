import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { PinchGestureHandler, State, TapGestureHandler, PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedGestureHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    runOnJS,
    withSpring,
    Easing
} from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ZoomableImage = ({
    source,
    style,
    resizeMode = FastImage.resizeMode.cover,
    onSingleTap,
    onDoubleTap,
    children,
    onZoomChange
}) => {
    const scale = useSharedValue(1);
    const focalX = useSharedValue(0);
    const focalY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const lastScale = useSharedValue(1);
    const lastTranslateX = useSharedValue(0);
    const lastTranslateY = useSharedValue(0);
    const doubleTapRef = useRef(null);
    const panRef = useRef(null);
    const pinchRef = useRef(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [imageSize, setImageSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_WIDTH });

    // Animasyon konfigürasyonu
    const animConfig = {
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    };

    useEffect(() => {
        if (onZoomChange) {
            onZoomChange(isZoomed);
        }
    }, [isZoomed, onZoomChange]);

    // Pinch (sıkıştırma) hareketi işleyicisi
    const pinchHandler = useAnimatedGestureHandler({
        onStart: (event) => {
            lastScale.value = scale.value;
            lastTranslateX.value = translateX.value;
            lastTranslateY.value = translateY.value;
            focalX.value = event.focalX;
            focalY.value = event.focalY;
        },
        onActive: (event) => {
            // Daha kararlı bir zoom için hassasiyeti artır
            // Ölçeği 1 ile 5 arasında sınırla (daha geniş zoom aralığı)
            const newScale = Math.min(Math.max(lastScale.value * event.scale, 1), 5);

            // Odak noktasına göre kaydırma hesapla
            if (newScale >= 1) {
                // Odak noktasına göre kaydırma hesapla
                const pinchCenterX = event.focalX;
                const pinchCenterY = event.focalY;

                // Odak noktasına göre yeni kaydırma değerlerini hesapla
                const newTranslateX = lastTranslateX.value + event.translationX;
                const newTranslateY = lastTranslateY.value + event.translationY;

                // Ölçek değişiminden kaynaklanan ek kaydırma
                // Bu formül, yakınlaştırma sırasında odak noktasının sabit kalmasını sağlar
                const pinchOffsetX = (pinchCenterX - SCREEN_WIDTH / 2) * (newScale / lastScale.value - 1);
                const pinchOffsetY = (pinchCenterY - SCREEN_WIDTH / 2) * (newScale / lastScale.value - 1);

                // Değerleri güncelle - hafif yumuşatma uygulanabilir
                scale.value = newScale;
                translateX.value = newTranslateX - pinchOffsetX;
                translateY.value = newTranslateY - pinchOffsetY;

                if (newScale > 1.05) { // Biraz daha hassas eşik değeri
                    // Zoom aktifse durumu bildir
                    if (!isZoomed) {
                        runOnJS(setIsZoomed)(true);
                    }
                } else {
                    // Zoom aktif değilse değerleri sıfırla ve durumu bildir
                    translateX.value = withTiming(0, animConfig);
                    translateY.value = withTiming(0, animConfig);
                    if (isZoomed) {
                        runOnJS(setIsZoomed)(false);
                    }
                }
            }
        },
        onEnd: () => {
            // Kullanıcı parmaklarını bıraktığında her zaman orijinal boyuta geri dön
            scale.value = withTiming(1, animConfig);
            translateX.value = withTiming(0, animConfig);
            translateY.value = withTiming(0, animConfig);
            runOnJS(setIsZoomed)(false);
        },
    });

    // Pan (kaydırma) hareketi işleyicisi
    const panHandler = useAnimatedGestureHandler({
        onStart: (event) => {
            // Eğer yakınlaştırma yoksa, pan hareketini başlatma (ana liste scroll'un engellenmemesi için)
            if (scale.value <= 1.05) {
                // Zoom yoksa, pan hareketini iptal et ve ana scroll'a izin ver
                return false;
            }

            lastTranslateX.value = translateX.value;
            lastTranslateY.value = translateY.value;
            return true;
        },
        onActive: (event) => {
            // Sadece yakınlaştırılmışsa görüntü içinde kaydırmaya izin ver
            if (scale.value > 1.05) {
                // Kaydırma sırasında zoom durumunu aktif tut
                if (!isZoomed) {
                    runOnJS(setIsZoomed)(true);
                }

                // Kaydırma değerlerini güncelle
                translateX.value = lastTranslateX.value + event.translationX;
                translateY.value = lastTranslateY.value + event.translationY;
            }
        },
        onEnd: (event) => {
            // Kaydırma bittiğinde normal boyuta dön, ancak sadece zoom aktifse
            if (scale.value > 1.05) {
                scale.value = withTiming(1, animConfig);
                translateX.value = withTiming(0, animConfig);
                translateY.value = withTiming(0, animConfig);
                runOnJS(setIsZoomed)(false);
            }
        },
        onFail: () => {
            return false;
        },
        onCancel: () => {
            return false;
        },
    });

    // Tek tıklama işleyicisi
    const singleTapHandler = (event) => {
        if (event.nativeEvent.state === State.ACTIVE) {
            if (onSingleTap) {
                // Tek tıklama işlevini çağır
                onSingleTap(event);
            }
        }
    };

    // Çift tıklama işleyicisi - Sadece beğeni için kullanılacak
    const doubleTapHandler = (event) => {
        if (event.nativeEvent.state === State.ACTIVE) {
            if (onDoubleTap) {
                // Çift tıklama konumunu doğru şekilde ilet
                const nativeEvent = {
                    ...event.nativeEvent,
                    locationX: event.nativeEvent.x,
                    locationY: event.nativeEvent.y
                };
                onDoubleTap({ nativeEvent });
            }
        }
    };

    // Animasyonlu stil
    const animatedImageStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value }
            ]
        };
    });

    // Görüntü yüklendiğinde boyutlarını kaydet
    const onImageLoad = (e) => {
        if (e && e.nativeEvent) {
            const { width, height } = e.nativeEvent;
            setImageSize({ width, height });
        }
    };

    return (
        <PinchGestureHandler
            ref={pinchRef}
            onGestureEvent={pinchHandler}
            simultaneousHandlers={[panRef, doubleTapRef]}
        >
            <Animated.View style={[styles.container, style]}>
                <PanGestureHandler
                    ref={panRef}
                    onGestureEvent={panHandler}
                    simultaneousHandlers={[pinchRef, doubleTapRef]}
                    minPointers={1}
                    maxPointers={2}
                    avgTouches
                    enabled={true}
                    activeOffsetX={[-5, 5]}      // Daha hassas yatay algılama
                    activeOffsetY={[-5, 5]}      // Daha hassas dikey algılama
                    failOffsetY={[-10, 10]}      // Daha düşük fail eşiği
                    shouldCancelWhenOutside={true} // Dışarı çıkınca iptal et
                >
                    <Animated.View style={styles.container}>
                        <TapGestureHandler
                            onHandlerStateChange={singleTapHandler}
                            waitFor={doubleTapRef}
                        >
                            <Animated.View style={styles.container}>
                                <TapGestureHandler
                                    ref={doubleTapRef}
                                    onHandlerStateChange={doubleTapHandler}
                                    numberOfTaps={2}
                                >
                                    <Animated.View style={styles.container}>
                                        <Animated.View style={[styles.imageContainer, animatedImageStyle]}>
                                            <FastImage
                                                source={source}
                                                style={styles.image}
                                                resizeMode={resizeMode}
                                                onLoad={onImageLoad}
                                            />
                                        </Animated.View>
                                        {children}
                                    </Animated.View>
                                </TapGestureHandler>
                            </Animated.View>
                        </TapGestureHandler>
                    </Animated.View>
                </PanGestureHandler>
            </Animated.View>
        </PinchGestureHandler>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
        overflow: 'visible',
    },
    imageContainer: {
        flex: 1,
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        overflow: 'visible',
    },
    image: {
        width: '100%',
        height: '100%',
    }
});

export default ZoomableImage; 