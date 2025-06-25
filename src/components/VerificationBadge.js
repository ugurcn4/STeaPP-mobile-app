import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

/**
 * Doğrulama rozeti bileşeni.
 * Mavi tik, yeşil tik veya her ikisini birden göstermek için kullanılır.
 * 
 * @param {Object} props - Bileşen özellikleri
 * @param {boolean} props.hasBlueTick - Mavi tik gösterilip gösterilmeyeceği
 * @param {boolean} props.hasGreenTick - Yeşil tik gösterilip gösterilmeyeceği
 * @param {number} props.size - Simge boyutu (varsayılan: 16)
 * @param {string} props.style - Kapsayıcı view için stil
 * @param {boolean} props.alignEnd - Simgeleri sağa yasla (varsayılan: false)
 * @param {boolean} props.showTooltip - Üzerine gelince açıklama görünsün mü (varsayılan: false)
 * @param {string} props.tooltipText - Açıklama metni (özel metin belirtilmezse, doğrulama tipine göre varsayılan metin gösterilir)
 * @returns {React.ReactElement} VerificationBadge bileşeni
 */
const VerificationBadge = ({
    hasBlueTick = false,
    hasGreenTick = false,
    size = 16,
    style,
    alignEnd = false,
    showTooltip = false,
    tooltipText = ''
}) => {
    // Her iki tik de false ise hiçbir şey gösterme
    if (!hasBlueTick && !hasGreenTick) {
        return null;
    }

    // Simgeler için varsayılan renk ve simge adları
    const blueTickProps = {
        backgroundColor: "#1E90FF",
        checkColor: "#FFFFFF",
        tooltip: "Doğrulanmış Hesap"
    };

    const greenTickProps = {
        backgroundColor: "#32CD32",
        checkColor: "#FFFFFF",
        tooltip: "Doğrulanmış Kurum"
    };

    // Her iki rozet varsa yan yana göster
    const hasBothTicks = hasBlueTick && hasGreenTick;

    // Ana rozet boyutu
    const badgeSize = size;
    // Tik simgesi boyutu
    const checkSize = size * 0.6;
    // Petal boyutu
    const petalSize = badgeSize * 1.3;

    const renderVerificationBadge = (props, withMargin = false) => {
        return (
            <View style={{ marginRight: withMargin ? 6 : 0 }}>
                {/* Çiçek yapraklarını simüle eden arka plan */}
                <View style={[
                    styles.petalContainer,
                    {
                        width: petalSize,
                        height: petalSize,
                        backgroundColor: props.backgroundColor,
                    }
                ]}>
                    {/* İç çember */}
                    <View style={[
                        styles.innerCircle,
                        {
                            width: badgeSize,
                            height: badgeSize,
                            backgroundColor: props.backgroundColor,
                        }
                    ]}>
                        <Ionicons
                            name="checkmark-sharp"
                            size={checkSize}
                            color={props.checkColor}
                            style={styles.checkIcon}
                        />
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[
            styles.container,
            alignEnd ? styles.alignEnd : styles.alignStart,
            style
        ]}>
            {hasBlueTick && renderVerificationBadge(blueTickProps, hasBothTicks)}
            {hasGreenTick && renderVerificationBadge(greenTickProps)}

            {showTooltip && (
                <Text style={styles.tooltip}>
                    {tooltipText || (hasBothTicks
                        ? "Doğrulanmış Hesap ve Kuruluş"
                        : (hasBlueTick ? blueTickProps.tooltip : greenTickProps.tooltip))}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    alignStart: {
        justifyContent: 'flex-start',
    },
    alignEnd: {
        justifyContent: 'flex-end',
    },
    petalContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 100, // Çiçek şekli için büyük bir değer
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    innerCircle: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 100,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    checkIcon: {
        fontWeight: 'bold',
    },
    tooltip: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
    }
});

export default VerificationBadge; 