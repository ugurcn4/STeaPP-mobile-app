import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Linking } from 'react-native';
import { useSelector } from 'react-redux';
import { lightTheme, darkTheme } from '../../themes';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { version } from '../../../package.json'; // Uygulama versiyonunu package.json'dan alıyoruz
import { translate } from '../../i18n/i18n'; // translate fonksiyonunu import et

const AboutPage = ({ navigation }) => {
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

    const legalLinks = [
        {
            id: 1,
            title: translate('terms_of_use'),
            icon: 'document-text-outline',
            action: () => Linking.openURL('https://sites.google.com/view/steapp-privacy-policy/kullan%C4%B1m-ko%C5%9Fullar%C4%B1')
        },
        {
            id: 2,
            title: translate('privacy_policy'), // Mevcut anahtarı kullanıyoruz
            icon: 'shield-checkmark-outline',
            action: () => Linking.openURL('https://sites.google.com/view/steapp-privacy-policy/gizlilik-politikas%C4%B1')
        },
        {
            id: 3,
            title: translate('license_info'),
            icon: 'information-circle-outline',
            action: () => Linking.openURL('https://sites.google.com/view/steapp-privacy-policy/lisans-bilgileri')
        }
    ];

    const socialLinks = [
        {
            id: 1,
            title: translate('instagram'),
            icon: 'logo-instagram',
            action: () => Linking.openURL('https://www.instagram.com/ugurrucr/')
        },
        {
            id: 2,
            title: translate('linkedin'),
            icon: 'logo-linkedin',
            action: () => Linking.openURL('https://www.linkedin.com/in/u%C4%9Fur-can-u%C3%A7ar-210061227/')
        },
        {
            id: 3,
            title: translate('website'),
            icon: 'globe-outline',
            action: () => Linking.openURL('https://sites.google.com/view/steapp-privacy-policy/kullan%C4%B1m-ko%C5%9Fullar%C4%B1')
        }
    ];

    return (
        <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
            <View style={styles.headerContainer}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons
                        name="arrow-back"
                        size={24}
                        color={currentTheme.text}
                    />
                </TouchableOpacity>
                <Text style={[styles.header, { color: currentTheme.text }]}>
                    {translate('about_page_title')}
                </Text>
            </View>

            <View style={styles.appInfoSection}>
                <Image
                    source={require('../../../assets/images/logo.png')}
                    style={styles.appIcon}
                />
                <Text style={[styles.appName, { color: currentTheme.text }]}>
                    STeaPP
                </Text>
                <Text style={[styles.version, { color: currentTheme.text }]}>
                    {translate('version')} {version}
                </Text>
                <Text style={styles.description}>
                    {translate('app_description')}
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                    {translate('legal')}
                </Text>
                {legalLinks.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.linkItem}
                        onPress={item.action}
                    >
                        <Ionicons name={item.icon} size={24} color={currentTheme.text} />
                        <Text style={[styles.linkText, { color: currentTheme.text }]}>
                            {item.title}
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color={currentTheme.text} />
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                    {translate('follow_us')}
                </Text>
                <View style={styles.socialLinksContainer}>
                    {socialLinks.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.socialItem}
                            onPress={item.action}
                        >
                            <Ionicons name={item.icon} size={24} color={currentTheme.text} />
                            <Text style={[styles.socialText, { color: currentTheme.text }]}>
                                {item.title}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.creditsSection}>
                <Text style={[styles.credits, { color: currentTheme.text }]}>
                    {translate('copyright')}
                </Text>
                <Text style={styles.madeWith}>
                    {translate('developed_by')}
                </Text>
                <Text style={styles.madeWith}>
                    ❤️🇹🇷
                </Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 60,
    },
    backButton: {
        padding: 10,
        marginRight: 10,
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    appInfoSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    appIcon: {
        width: 100,
        height: 100,
        borderRadius: 20,
        marginBottom: 15,
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    version: {
        fontSize: 16,
        opacity: 0.7,
        marginBottom: 10,
    },
    description: {
        textAlign: 'center',
        color: '#666',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 15,
        marginLeft: 10,
    },
    linkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        marginBottom: 10,
    },
    linkText: {
        fontSize: 16,
        marginLeft: 15,
        flex: 1,
    },
    socialLinksContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
    },
    socialItem: {
        alignItems: 'center',
        padding: 15,
        minWidth: 100,
    },
    socialText: {
        marginTop: 5,
        fontSize: 14,
    },
    creditsSection: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    credits: {
        fontSize: 14,
        marginBottom: 5,
    },
    madeWith: {
        fontSize: 14,
        color: '#666',
    },
});

export default AboutPage; 