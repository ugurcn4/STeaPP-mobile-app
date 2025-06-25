import React, { useEffect, useState } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    Text
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import NotificationItem from '../components/NotificationItem';
import { fetchNotifications, markNotificationAsRead } from '../redux/slices/notificationSlice';
import { useNavigation } from '@react-navigation/native';

const NotificationsListScreen = () => {
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const [refreshing, setRefreshing] = useState(false);

    const {
        notifications,
        loading,
        error
    } = useSelector(state => state.notifications);
    const userId = useSelector(state => state.auth.user?.id);

    useEffect(() => {
        if (userId) {
            loadNotifications();
        }
    }, [userId]);

    const loadNotifications = async () => {
        if (userId) {
            dispatch(fetchNotifications(userId));
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        setRefreshing(false);
    };

    const handleNotificationPress = async (notification) => {
        // Önce okundu olarak işaretle
        if (notification.status === 'unread') {
            dispatch(markNotificationAsRead(notification._id));
        }

        // Bildirim tipine göre yönlendirme yap
        switch (notification.type) {
            case 'friendRequest':
                navigation.navigate('FriendRequests', {
                    userId: notification.data.senderId
                });
                break;
            case 'message':
                navigation.navigate('Chat', {
                    conversationId: notification.data.conversationId
                });
                break;
            case 'activity':
                navigation.navigate('ActivityDetails', {
                    activityId: notification.data.activityId
                });
                break;
            default:
                // Varsayılan davranış
                break;
        }
    };

    const renderNotification = ({ item }) => (
        <NotificationItem
            notification={item}
            onPress={() => handleNotificationPress(item)}
        />
    );

    if (loading && !refreshing && notifications.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#25D220" />
            </View>
        );
    }

    if (error && !refreshing && notifications.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={item => item._id}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#4CAF50']}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            Henüz bildiriminiz bulunmuyor
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        margin: 20
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center'
    }
});

export default NotificationsListScreen; 