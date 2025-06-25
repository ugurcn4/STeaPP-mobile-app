import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { lightTheme, darkTheme } from '../themes';

const NotificationItem = ({ notification, onPress }) => {
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

    const getNotificationIcon = () => {
        switch (notification.type) {
            case 'friendRequest':
                return 'person-add';
            case 'message':
                return 'chatbubble';
            case 'activity':
                return 'walk';
            default:
                return 'notifications';
        }
    };

    const getNotificationColor = () => {
        switch (notification.type) {
            case 'friendRequest':
                return '#FF6B6B';
            case 'message':
                return '#4CAF50';
            case 'activity':
                return '#2196F3';
            default:
                return '#FFA726';
        }
    };

    const formatTime = (date) => {
        return formatDistanceToNow(new Date(date), {
            addSuffix: true,
            locale: tr
        });
    };

    const notificationColor = getNotificationColor();

    return (
        <TouchableOpacity
            style={[
                styles.container,
                {
                    backgroundColor: notification.status === 'unread'
                        ? `${notificationColor}10`
                        : currentTheme.background,
                    borderLeftWidth: notification.status === 'unread' ? 4 : 0,
                    borderLeftColor: notification.status === 'unread' ? notificationColor : 'transparent'
                }
            ]}
            onPress={onPress}
        >
            <View style={[styles.iconContainer, { backgroundColor: `${notificationColor}20` }]}>
                <Ionicons
                    name={getNotificationIcon()}
                    size={22}
                    color={notificationColor}
                />
            </View>
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: currentTheme.text }]}>
                        {notification.title}
                    </Text>
                    <Text style={[styles.time, { color: currentTheme.textTertiary }]}>
                        {formatTime(notification.createdAt)}
                    </Text>
                </View>
                <Text style={[styles.body, { color: currentTheme.textSecondary }]}>
                    {notification.body}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    content: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    body: {
        fontSize: 14,
        lineHeight: 20,
    },
    time: {
        fontSize: 12,
        fontWeight: '500',
    }
});

export default NotificationItem; 