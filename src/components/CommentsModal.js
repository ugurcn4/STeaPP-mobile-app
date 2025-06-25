import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Keyboard
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedGestureHandler,
    useAnimatedStyle,
    withSpring,
    useSharedValue,
} from 'react-native-reanimated';
import VerificationBadge from './VerificationBadge';
import { checkUserVerification } from '../utils/verificationUtils';
import { translate } from '../i18n/i18n';



const CommentItem = ({ comment, onReply, currentUserId, postUserId, onDelete }) => {
    const canDelete = comment.userId === currentUserId || postUserId === currentUserId;
    const translateX = useSharedValue(0);
    const isOpen = useSharedValue(false);
    const [verification, setVerification] = useState({ hasBlueTick: false, hasGreenTick: false });
    const [replyVerifications, setReplyVerifications] = useState({});

    useEffect(() => {
        // Ana yorum için doğrulama durumunu kontrol et
        const checkVerification = async () => {
            try {
                const verificationStatus = await checkUserVerification(comment.userId);
                setVerification(verificationStatus);
            } catch (error) {
                console.error('Doğrulama durumu kontrolünde hata:', error);
            }
        };

        // Yanıtlar için doğrulama durumlarını kontrol et
        const checkReplyVerifications = async () => {
            if (!comment.replies || !comment.replies.length) return;

            const verificationData = {};

            for (const reply of comment.replies) {
                try {
                    const status = await checkUserVerification(reply.userId);
                    verificationData[reply.id] = status;
                } catch (error) {
                    console.error('Yanıt doğrulama durumu kontrolünde hata:', error);
                }
            }

            setReplyVerifications(verificationData);
        };

        checkVerification();
        checkReplyVerifications();
    }, [comment.userId, comment.replies]);

    const panGesture = useAnimatedGestureHandler({
        onActive: (event) => {
            if (canDelete) {
                translateX.value = Math.min(0, Math.max(-80, event.translationX));
            }
        },
        onEnd: (event) => {
            if (event.translationX < -40 && canDelete) {
                translateX.value = withSpring(-80);
                isOpen.value = true;
            } else {
                translateX.value = withSpring(0);
                isOpen.value = false;
            }
        }
    });

    const rStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }]
    }));

    const deleteIconStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, -translateX.value / 80)
    }));

    const handleDelete = () => {
        translateX.value = withSpring(0);
        isOpen.value = false;
        onDelete(comment.id);
    };

    return (
        <View style={styles.commentWrapper}>
            {canDelete && (
                <TouchableOpacity
                    style={styles.deleteBackground}
                    onPress={handleDelete}
                >
                    <Animated.View style={deleteIconStyle}>
                        <Ionicons name="trash" size={24} color="#fff" />
                    </Animated.View>
                </TouchableOpacity>
            )}
            <PanGestureHandler onGestureEvent={panGesture} enabled={canDelete}>
                <Animated.View style={[styles.commentContainer, rStyle]}>
                    <FastImage
                        source={{ uri: comment.user.avatar || 'https://via.placeholder.com/40' }}
                        style={styles.avatar}
                    />
                    <View style={styles.commentContent}>
                        <View style={styles.commentHeader}>
                            <View style={styles.usernameContainer}>
                                <Text style={styles.username}>{comment.user.name}</Text>
                                <VerificationBadge
                                    hasBlueTick={verification.hasBlueTick}
                                    hasGreenTick={verification.hasGreenTick}
                                    size={12}
                                    style={styles.verificationBadge}
                                />
                            </View>
                            <Text style={styles.timestamp}>
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: tr })}
                            </Text>
                        </View>
                        <Text style={styles.commentText}>{comment.text}</Text>
                        <View style={styles.commentActions}>
                            <TouchableOpacity
                                style={styles.replyButton}
                                onPress={() => onReply(comment)}
                            >
                                <Text style={styles.replyButtonText}>{translate('reply')}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Alt yorumlar */}
                        {comment.replies && comment.replies.length > 0 && (
                            <View style={styles.repliesContainer}>
                                {comment.replies.map((reply) => {
                                    const replyVerification = replyVerifications[reply.id] || { hasBlueTick: false, hasGreenTick: false };

                                    return (
                                        <View key={reply.id} style={styles.replyItem}>
                                            <FastImage
                                                source={{ uri: reply.user.avatar || 'https://via.placeholder.com/30' }}
                                                style={styles.replyAvatar}
                                            />
                                            <View style={styles.replyContent}>
                                                <View style={styles.replyUsernameContainer}>
                                                    <Text style={styles.username}>{reply.user.name}</Text>
                                                    <VerificationBadge
                                                        hasBlueTick={replyVerification.hasBlueTick}
                                                        hasGreenTick={replyVerification.hasGreenTick}
                                                        size={10}
                                                        style={styles.verificationBadgeReply}
                                                    />
                                                </View>
                                                <Text style={styles.replyText}>{reply.text}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </Animated.View>
            </PanGestureHandler>
        </View>
    );
};

const CommentsModal = ({ visible, onClose, comments, onAddComment, currentUserId, postUserId, onDelete }) => {
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [localComments, setLocalComments] = useState(comments);

    // Klavye olaylarını dinle
    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => setKeyboardHeight(e.endCoordinates.height)
        );
        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardHeight(0)
        );

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    useEffect(() => {
        // Yorumlar güncellendiğinde state'i güncelle
        if (comments) {
            // Yeni yorumları en üstte göster
            const sortedComments = [...comments].sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            setLocalComments(sortedComments);
        }
    }, [comments]);

    const handleSubmit = () => {
        if (!newComment.trim()) return;
        onAddComment(newComment, replyTo?.id);
        setNewComment('');
        setReplyTo(null);
    };

    const handleReply = (comment) => {
        setReplyTo(comment);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <TouchableOpacity
                    style={styles.modalContainer}
                    activeOpacity={1}
                    onPress={onClose}
                >
                    <View
                        style={styles.modalContent}
                        onStartShouldSetResponder={() => true}
                        onTouchEnd={(e) => e.stopPropagation()}
                    >
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={24} color="#000" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>{translate('comments')}</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        <FlatList
                            data={localComments}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <CommentItem
                                    comment={item}
                                    onReply={handleReply}
                                    currentUserId={currentUserId}
                                    postUserId={postUserId}
                                    onDelete={onDelete}
                                />
                            )}
                            contentContainerStyle={[
                                styles.commentsList,
                                { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 60 : 100 }
                            ]}
                            keyboardShouldPersistTaps="always"
                            showsVerticalScrollIndicator={false}
                        />

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                            style={[
                                styles.inputContainer,
                                { bottom: keyboardHeight > 0 ? keyboardHeight - 20 : 0 }
                            ]}
                        >
                            {replyTo && (
                                <View style={styles.replyingTo}>
                                    <Text style={styles.replyingToText}>
                                        {translate('replying_to')}{replyTo.user.name}
                                    </Text>
                                    <TouchableOpacity onPress={() => setReplyTo(null)}>
                                        <Ionicons name="close-circle" size={20} color="#666" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder={replyTo ? translate('write_your_reply') : translate('write_your_comment')}
                                    value={newComment}
                                    onChangeText={setNewComment}
                                    multiline
                                    blurOnSubmit={false}
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.sendButton,
                                        !newComment.trim() && styles.sendButtonDisabled
                                    ]}
                                    onPress={handleSubmit}
                                    disabled={!newComment.trim()}
                                >
                                    <Ionicons
                                        name="send"
                                        size={24}
                                        color={newComment.trim() ? "#2196F3" : "#ccc"}
                                    />
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableOpacity>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        height: '80%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        position: 'relative',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    commentsList: {
        padding: 8,
        paddingBottom: 100,
        flex: 1,
    },
    commentWrapper: {
        position: 'relative',
        marginBottom: 5,
        overflow: 'hidden',
    },
    avatar: {
        width: 35,
        height: 35,
        borderRadius: 20,
        marginRight: 3,
    },
    commentContent: {
        flex: 1,
        marginLeft: 12,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    usernameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    username: {
        fontWeight: '500',
        marginRight: 2,
    },
    timestamp: {
        fontSize: 12,
        color: '#666',
        marginLeft: 8,
    },
    commentText: {
        fontSize: 14,
        lineHeight: 18,
    },
    replyButton: {
        marginTop: 4,
    },
    replyButtonText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '500',
    },
    repliesContainer: {
        marginTop: 8,
        marginLeft: 20,
    },
    replyItem: {
        flexDirection: 'row',
        marginTop: 8,
    },
    replyAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 8,
    },
    replyContent: {
        flex: 1,
    },
    replyText: {
        fontSize: 13,
        lineHeight: 18,
    },
    inputContainer: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 5,
        marginBottom: 28,
    },
    replyingTo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 8,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        marginBottom: 8,
    },
    replyingToText: {
        fontSize: 11,
        color: '#666',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        minHeight: 36,
        maxHeight: 100,
        backgroundColor: '#f5f5f5',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        fontSize: 14,
    },
    sendButton: {
        padding: 8,
    },
    sendButtonDisabled: {
        opacity: 0.7,
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    deleteBackground: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 80,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        zIndex: 1,
    },
    commentContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        width: '100%',
        paddingVertical: 8,
        paddingHorizontal: 12,
        zIndex: 2,
    },
    deleteIcon: {
        position: 'absolute',
        right: 12,
        top: 12,
        zIndex: 1,
    },
    deleteIconStyle: {
        position: 'absolute',
        right: 12,
        top: 12,
        zIndex: 1,
    },
    verificationBadge: {
        marginLeft: 2,
    },
    replyUsernameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verificationBadgeReply: {
        marginLeft: 2,
    },
});

export default CommentsModal; 