import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { lightTheme, darkTheme } from '../../themes';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { translate } from '../../i18n/i18n';

const HelpSupportPage = ({ navigation }) => {
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

    const [expandedQuestion, setExpandedQuestion] = useState(null);

    const faqData = [
        {
            id: 1,
            question: translate('faq_add_friend_question'),
            answer: translate('faq_add_friend_answer')
        },
        {
            id: 2,
            question: translate('faq_change_password_question'),
            answer: translate('faq_change_password_answer')
        },
        {
            id: 3,
            question: translate('faq_notifications_question'),
            answer: translate('faq_notifications_answer')
        },
        {
            id: 4,
            question: translate('faq_location_sharing_question'),
            answer: translate('faq_location_sharing_answer')
        },
        {
            id: 5,
            question: translate('faq_stop_sharing_question'),
            answer: translate('faq_stop_sharing_answer')
        },
        {
            id: 6,
            question: translate('faq_delete_account_question'),
            answer: translate('faq_delete_account_answer')
        },
        {
            id: 7,
            question: translate('faq_battery_usage_question'),
            answer: translate('faq_battery_usage_answer')
        },
        {
            id: 8,
            question: translate('faq_unwanted_requests_question'),
            answer: translate('faq_unwanted_requests_answer')
        },
        {
            id: 9,
            question: translate('faq_block_user_question'),
            answer: translate('faq_block_user_answer')
        },
        {
            id: 10,
            question: translate('faq_reduce_data_question'),
            answer: translate('faq_reduce_data_answer')
        },
        {
            id: 11,
            question: translate('faq_delete_history_question'),
            answer: translate('faq_delete_history_answer')
        }
    ];

    const supportLinks = [
        {
            id: 1,
            title: translate('support_center'),
            icon: 'help-circle-outline',
            color: '#4CAF50',
            action: () => Linking.openURL('https://sites.google.com/view/steapp-privacy-policy/destek-merkezi')
        },
        {
            id: 2,
            title: translate('email_contact'),
            icon: 'mail-outline',
            color: '#2196F3',
            action: () => Linking.openURL('mailto:ucarugur57@gmail.com')
        },
        {
            id: 3,
            title: translate('quick_support'),
            icon: 'chatbubbles-outline',
            color: '#FF9800',
            action: () => Linking.openURL('https://sites.google.com/view/steapp-privacy-policy/destek-ekibi')
        }
    ];

    const toggleQuestion = (id) => {
        setExpandedQuestion(expandedQuestion === id ? null : id);
    };

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
                    {translate('help_support')}
                </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                {translate('frequently_asked_questions')}
            </Text>

            <View style={styles.faqSection}>
                {faqData.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.questionContainer}
                        onPress={() => toggleQuestion(item.id)}
                    >
                        <View style={styles.questionHeader}>
                            <Text style={[styles.question, { color: currentTheme.text }]}>
                                {item.question}
                            </Text>
                            <Ionicons
                                name={expandedQuestion === item.id ? "chevron-up" : "chevron-down"}
                                size={20}
                                color={currentTheme.text}
                            />
                        </View>
                        {expandedQuestion === item.id && (
                            <Text style={[styles.answer, { color: currentTheme.text }]}>
                                {item.answer}
                            </Text>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                {translate('support_channels')}
            </Text>

            <View style={styles.supportSection}>
                {supportLinks.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.supportOption, { backgroundColor: item.color + '10' }]}
                        onPress={item.action}
                    >
                        <View style={[styles.supportIconContainer, { backgroundColor: item.color + '20' }]}>
                            <Ionicons name={item.icon} size={24} color={item.color} />
                        </View>
                        <View style={styles.supportInfo}>
                            <Text style={[styles.supportTitle, { color: currentTheme.text }]}>
                                {item.title}
                            </Text>
                            {item.id === 1 && (
                                <Text style={[styles.supportDescription, { color: currentTheme.textSecondary }]}>
                                    {translate('support_center_desc')}
                                </Text>
                            )}
                            {item.id === 2 && (
                                <Text style={[styles.supportDescription, { color: currentTheme.textSecondary }]}>
                                    {translate('email_contact_desc')}
                                </Text>
                            )}
                            {item.id === 3 && (
                                <Text style={[styles.supportDescription, { color: currentTheme.textSecondary }]}>
                                    {translate('quick_support_desc')}
                                </Text>
                            )}
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={currentTheme.textSecondary} />
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.note}>
                {translate('support_note')}
            </Text>
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
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 15,
        marginLeft: 10,
    },
    faqSection: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 15,
        marginBottom: 30,
    },
    questionContainer: {
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
        paddingBottom: 15,
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    question: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    answer: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 22,
        opacity: 0.8,
        paddingLeft: 10,
    },
    bulletPoint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 5,
    },
    bullet: {
        fontSize: 14,
        marginRight: 5,
        color: '#666',
    },
    highlightText: {
        fontWeight: '500',
        color: '#4CAF50',
    },
    noteText: {
        fontStyle: 'italic',
        fontSize: 13,
        color: '#666',
        marginTop: 5,
    },
    supportSection: {
        marginBottom: 30,
    },
    supportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    supportIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    supportInfo: {
        flex: 1,
    },
    supportTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 5,
    },
    supportDescription: {
        fontSize: 14,
        opacity: 0.7,
    },
    note: {
        textAlign: 'center',
        fontSize: 14,
        color: '#666',
        marginBottom: 30,
        fontStyle: 'italic',
    },
});

export default HelpSupportPage; 