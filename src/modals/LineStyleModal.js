import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { translate } from '../i18n/i18n';

// Çizgi tasarım şablonları
const LINE_STYLE_TEMPLATES = [
    { id: 'default', name: translate('line_style_default'), color: '#4CAF50', width: 6, pattern: 'solid' },
    { id: 'blue', name: translate('line_style_blue'), color: '#2196F3', width: 6, pattern: 'solid' },
    { id: 'orange', name: translate('line_style_orange'), color: '#FF9800', width: 6, pattern: 'solid' },
    { id: 'red', name: translate('line_style_red'), color: '#F44336', width: 6, pattern: 'solid' },
    { id: 'purple', name: translate('line_style_purple'), color: '#9C27B0', width: 6, pattern: 'solid' },
    { id: 'thin-black', name: translate('line_style_thin_black'), color: '#212121', width: 3, pattern: 'solid' },
    { id: 'dotted-black', name: translate('line_style_dotted_black'), color: '#212121', width: 4, pattern: 'dotted' },
    { id: 'dashed-blue', name: translate('line_style_dashed_blue'), color: '#2196F3', width: 5, pattern: 'dashed' },
    { id: 'gradient-red', name: translate('line_style_gradient_red'), color: 'gradient-red', width: 6, pattern: 'solid' },
    { id: 'gradient-blue', name: translate('line_style_gradient_blue'), color: 'gradient-blue', width: 6, pattern: 'solid' },
];

const LineStyleModal = ({
    visible,
    onClose,
    selectedLineStyle,
    onSelectLineStyle
}) => {
    // Gradient renklerini belirle
    const getGradientColors = (gradientType) => {
        switch (gradientType) {
            case 'gradient-red':
                return ['#FF9800', '#F44336', '#D32F2F'];
            case 'gradient-blue':
                return ['#2196F3', '#1976D2', '#0D47A1'];
            default:
                return null;
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.lineStyleModalContainer}>
                    <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
                        <ScrollView style={styles.lineStyleScrollView} showsVerticalScrollIndicator={false}>
                            <View style={styles.lineStyleModalContent}>
                                {/* Modal Handle */}
                                <View style={styles.modalHandle} />

                                {/* Modal Başlık */}
                                <Text style={styles.lineStyleModalTitle}>{translate('change_line_style')}</Text>
                                <Text style={styles.lineStyleModalSubtitle}>
                                    {translate('line_style_subtitle')}
                                </Text>

                                {/* Şablonlar */}
                                <Text style={styles.lineStyleSectionTitle}>{translate('ready_templates')}</Text>

                                <View style={styles.lineStyleTemplatesContainer}>
                                    {LINE_STYLE_TEMPLATES.map((template) => (
                                        <TouchableOpacity
                                            key={template.id}
                                            style={[
                                                styles.lineStyleTemplate,
                                                selectedLineStyle.color === template.color &&
                                                selectedLineStyle.width === template.width &&
                                                selectedLineStyle.pattern === template.pattern &&
                                                styles.lineStyleTemplateSelected
                                            ]}
                                            onPress={() => onSelectLineStyle(template)}
                                        >
                                            <View
                                                style={[
                                                    styles.lineStyleSample,
                                                    {
                                                        height: template.width,
                                                        borderStyle: template.pattern === 'dotted' ? 'dotted' :
                                                            template.pattern === 'dashed' ? 'dashed' : 'solid',
                                                        backgroundColor: template.color.startsWith('gradient') ? 'transparent' : template.color,
                                                    }
                                                ]}
                                            >
                                                {template.color.startsWith('gradient') && (
                                                    <LinearGradient
                                                        colors={getGradientColors(template.color)}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={styles.gradientOverlay}
                                                    />
                                                )}
                                            </View>
                                            <Text style={styles.lineStyleTemplateName}>{template.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Özel Renk Seçimi */}
                                <Text style={styles.lineStyleSectionTitle}>{translate('custom_color')}</Text>
                                <View style={styles.colorPickerContainer}>
                                    {['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#212121', '#7CB342', '#00BCD4', '#FFD600', '#E91E63'].map(color => (
                                        <TouchableOpacity
                                            key={color}
                                            style={[
                                                styles.colorOption,
                                                { backgroundColor: color },
                                                selectedLineStyle.color === color && styles.colorOptionSelected
                                            ]}
                                            onPress={() => onSelectLineStyle({ ...selectedLineStyle, color })}
                                        />
                                    ))}
                                </View>

                                {/* Çizgi Kalınlığı */}
                                <Text style={styles.lineStyleSectionTitle}>{translate('line_thickness')}</Text>
                                <View style={styles.widthOptionsContainer}>
                                    {[2, 4, 6, 8, 10].map(width => (
                                        <TouchableOpacity
                                            key={width}
                                            style={[
                                                styles.widthOption,
                                                selectedLineStyle.width === width && styles.widthOptionSelected
                                            ]}
                                            onPress={() => onSelectLineStyle({ ...selectedLineStyle, width })}
                                        >
                                            <View
                                                style={[
                                                    styles.widthSample,
                                                    {
                                                        height: width,
                                                        backgroundColor: selectedLineStyle.color
                                                    }
                                                ]}
                                            />
                                            <Text style={styles.patternName}>{width}px</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Stil Seçenekleri */}
                                <Text style={styles.lineStyleSectionTitle}>{translate('line_style')}</Text>
                                <View style={styles.patternOptionsContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.patternOption,
                                            selectedLineStyle.pattern === 'solid' && styles.patternOptionSelected
                                        ]}
                                        onPress={() => onSelectLineStyle({ ...selectedLineStyle, pattern: 'solid' })}
                                    >
                                        <View
                                            style={[
                                                styles.patternSample,
                                                {
                                                    backgroundColor: selectedLineStyle.color,
                                                    height: selectedLineStyle.width || 6
                                                }
                                            ]}
                                        />
                                        <Text style={styles.patternName}>{translate('solid')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.patternOption,
                                            selectedLineStyle.pattern === 'dashed' && styles.patternOptionSelected
                                        ]}
                                        onPress={() => onSelectLineStyle({ ...selectedLineStyle, pattern: 'dashed' })}
                                    >
                                        <View
                                            style={[
                                                styles.patternSample,
                                                {
                                                    backgroundColor: selectedLineStyle.color,
                                                    borderStyle: 'dashed',
                                                    height: selectedLineStyle.width || 6,
                                                    borderWidth: 1,
                                                    borderColor: selectedLineStyle.color
                                                }
                                            ]}
                                        />
                                        <Text style={styles.patternName}>{translate('dashed')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.patternOption,
                                            selectedLineStyle.pattern === 'dotted' && styles.patternOptionSelected
                                        ]}
                                        onPress={() => onSelectLineStyle({ ...selectedLineStyle, pattern: 'dotted' })}
                                    >
                                        <View
                                            style={[
                                                styles.patternSample,
                                                {
                                                    backgroundColor: selectedLineStyle.color,
                                                    borderStyle: 'dotted',
                                                    height: selectedLineStyle.width || 6,
                                                    borderWidth: 1,
                                                    borderColor: selectedLineStyle.color
                                                }
                                            ]}
                                        />
                                        <Text style={styles.patternName}>{translate('dotted')}</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Uygula Butonu */}
                                <TouchableOpacity
                                    style={styles.applyButton}
                                    onPress={() => {
                                        onSelectLineStyle(selectedLineStyle);
                                        onClose();
                                    }}
                                >
                                    <Text style={styles.applyButtonText}>{translate('apply_changes')}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    lineStyleModalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: 20, // Alt kısımda da padding olsun
    },
    lineStyleScrollView: {
        flexGrow: 0,
        width: '100%',
        maxHeight: Dimensions.get('window').height * 0.7, // Ekran yüksekliğinin %70'i
    },
    lineStyleModalContent: {
        padding: 24,
        paddingBottom: 40, // Alt kısımda daha fazla boşluk
    },
    modalHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    lineStyleModalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    lineStyleModalSubtitle: {
        fontSize: 16,
        color: '#666666',
        marginBottom: 20,
        lineHeight: 22,
    },
    lineStyleSectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginTop: 16,
        marginBottom: 12,
    },
    lineStyleTemplatesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    lineStyleTemplate: {
        width: '48%',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    lineStyleTemplateSelected: {
        borderColor: '#4CAF50',
        backgroundColor: '#E8F5E9',
    },
    lineStyleSample: {
        width: '100%',
        borderRadius: 2,
        marginBottom: 8,
        position: 'relative',
    },
    gradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 2,
    },
    lineStyleTemplateName: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    colorPickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    colorOption: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginBottom: 12,
        marginHorizontal: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorOptionSelected: {
        borderColor: '#000',
    },
    widthOptionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    widthOption: {
        width: '18%',
        height: 60, // Sabit yükseklik ekledim
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#EEEEEE',
        borderRadius: 8,
        backgroundColor: '#F9F9F9',
    },
    widthOptionSelected: {
        borderColor: '#4CAF50',
        backgroundColor: '#E8F5E9',
    },
    widthSample: {
        width: '80%',
        minHeight: 2, // Minimum yükseklik
        borderRadius: 2,
        marginBottom: 4,
    },
    patternOptionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    patternOption: {
        width: '30%',
        height: 80, // Sabit yükseklik
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#EEEEEE',
        borderRadius: 8,
        backgroundColor: '#F9F9F9',
    },
    patternOptionSelected: {
        borderColor: '#4CAF50',
        backgroundColor: '#E8F5E9',
    },
    patternSample: {
        width: '100%',
        height: 8, // Biraz daha kalın çizgi örneği
        borderRadius: 2,
        marginBottom: 12,
    },
    patternName: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    applyButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LineStyleModal; 