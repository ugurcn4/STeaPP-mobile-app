import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ScrollView, Clipboard, ActivityIndicator, TextInput, Alert, Modal, FlatList } from 'react-native';
import { useSelector } from 'react-redux';
import { lightTheme, darkTheme } from '../../themes';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { auth, db } from '../../../firebaseConfig';
import { doc, getDoc, setDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { translate } from '../../i18n/i18n';

const InviteFriendsPage = ({ navigation }) => {
    const theme = useSelector((state) => state.theme.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [friendCode, setFriendCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [inviteStats, setInviteStats] = useState({
        inviteCount: 0,
        totalRewards: 0
    });
    const [rewardsModalVisible, setRewardsModalVisible] = useState(false);

    // Örnek ödül listesi (Çeviri anahtarları kullanılarak güncellendi)
    const rewards = [
        {
            id: '1',
            title: translate('reward_premium_1m_title'),
            description: translate('reward_premium_1m_desc'),
            pointsRequired: 500,
            icon: 'star'
        },
        {
            id: '2',
            title: translate('reward_themes_title'),
            description: translate('reward_themes_desc'),
            pointsRequired: 300,
            icon: 'color-palette'
        },
        {
            id: '3',
            title: translate('reward_pro_features_title'),
            description: translate('reward_pro_features_desc'),
            pointsRequired: 1000,
            icon: 'diamond'
        },
        {
            id: '4',
            title: translate('reward_notification_sounds_title'),
            description: translate('reward_notification_sounds_desc'),
            pointsRequired: 200,
            icon: 'notifications'
        },
        {
            id: '5',
            title: translate('reward_discount_coupon_title'),
            description: translate('reward_discount_coupon_desc'),
            pointsRequired: 100,
            icon: 'pricetag'
        },
    ];

    useEffect(() => {
        // Kullanıcının davet kodunu al veya oluştur
        fetchOrCreateInviteCode();
        // Davet istatistiklerini al
        fetchInviteStats();
    }, []);

    const fetchOrCreateInviteCode = async () => {
        try {
            setLoading(true);
            const currentUser = auth.currentUser;

            if (!currentUser) {
                showToast('error', translate('user_info_error'));
                setLoading(false);
                return;
            }

            const userId = currentUser.uid;
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists() && userDoc.data().inviteCode) {
                // Kullanıcının zaten bir davet kodu var
                setInviteCode(userDoc.data().inviteCode);
            } else {
                // Yeni bir davet kodu oluştur
                const newInviteCode = generateInviteCode(userId);

                // Firestore'a kaydet
                await setDoc(userDocRef, { inviteCode: newInviteCode }, { merge: true });

                setInviteCode(newInviteCode);
            }
        } catch (error) {
            console.error('Davet kodu alınırken hata oluştu:', error);
            showToast('error', translate('invite_code_fetch_error'));
        } finally {
            setLoading(false);
        }
    };

    // Kullanıcı ID'sinden davet kodu oluştur
    const generateInviteCode = (userId) => {
        // Kullanıcı ID'sinin ilk 6 karakterini al
        const idPart = userId.substring(0, 6);

        // Rastgele 4 karakter oluştur
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();

        // Zaman damgası ekle (son 4 hane)
        const timestampPart = Date.now().toString().slice(-4);

        // Parçaları birleştir ve formatla
        return `${randomPart}${timestampPart}`.toUpperCase();
    };

    const shareMessage = `Hey! STeaPP uygulamasını keşfettim. Şu davet koduyla katıl: ${inviteCode}\n\nİndir: https://apps.apple.com/tr/app/steapp/id6742784316?l=tr`;

    const shareOptions = [
        {
            id: 1,
            title: translate('whatsapp'),
            icon: 'logo-whatsapp',
            color: '#25D366',
            action: () => shareGeneric()
        },
        {
            id: 2,
            title: translate('instagram'),
            icon: 'logo-instagram',
            color: '#E4405F',
            action: () => shareGeneric()
        },
        {
            id: 3,
            title: translate('twitter'),
            icon: 'logo-twitter',
            color: '#1DA1F2',
            action: () => shareGeneric()
        },
        {
            id: 4,
            title: translate('sms'),
            icon: 'chatbubble-outline',
            color: '#FF9500',
            action: () => shareGeneric()
        },
        {
            id: 5,
            title: translate('email'),
            icon: 'mail-outline',
            color: '#4CAF50',
            action: () => shareGeneric(translate('invite_friends_title'))
        }
    ];

    // Genel paylaşım fonksiyonu
    const shareGeneric = async (title = undefined) => {
        try {
            await Share.share({
                message: shareMessage,
                title: title,
            });
        } catch (error) {
            showToast('error', translate('share_failed'));
        }
    };

    const copyInviteCode = () => {
        Clipboard.setString(inviteCode);
        showToast('success', translate('invite_code_copied'));
    };

    const showToast = (type, message1) => {
        Toast.show({
            type: type,
            text1: message1,
            position: 'bottom',
        });
    };

    const submitFriendCode = async () => {
        if (!friendCode.trim()) {
            showToast('error', translate('enter_invite_code_prompt'));
            return;
        }

        if (friendCode.trim().toUpperCase() === inviteCode) {
            showToast('error', translate('cannot_use_own_code'));
            return;
        }

        setSubmitting(true);
        try {
            const currentUser = auth.currentUser;

            if (!currentUser) {
                showToast('error', translate('user_info_error'));
                return;
            }

            const userId = currentUser.uid;
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists() && userDoc.data().usedInviteCode) {
                showToast('error', translate('already_used_code'));
                return;
            }

            const formattedCode = friendCode.trim().toUpperCase();
            const usersRef = collection(db, 'users');
            const inviteCodeQuery = query(usersRef, where('inviteCode', '==', formattedCode));
            const querySnapshot = await getDocs(inviteCodeQuery);

            if (querySnapshot.empty) {
                showToast('error', translate('invalid_invite_code'));
                return;
            }

            const friendDocSnapshot = querySnapshot.docs[0];
            const inviterId = friendDocSnapshot.id;

            if (inviterId === userId) {
                showToast('error', translate('cannot_use_own_code'));
                return;
            }

            const inviterRef = doc(db, 'users', inviterId);
            const inviterSnapshot = await getDoc(inviterRef);
            const currentInviteCount = inviterSnapshot.exists() && inviterSnapshot.data().inviteCount ? inviterSnapshot.data().inviteCount : 0;
            const inviterRewardPoints = 100;
            const currentInviterPoints = inviterSnapshot.exists() && inviterSnapshot.data().rewardPoints ? inviterSnapshot.data().rewardPoints : 0;
            const inviteeRewardPoints = 50;
            const currentUserPoints = userDoc.exists() && userDoc.data().rewardPoints ? userDoc.data().rewardPoints : 0;

            // Firestore batch write
            const batch = writeBatch(db);

            // Update current user's doc
            batch.set(userDocRef, {
                usedInviteCode: formattedCode,
                inviteCodeUsedAt: new Date(),
                invitedBy: inviterId,
                rewardPoints: currentUserPoints + inviteeRewardPoints,
                rewardHistory: arrayUnion({
                    type: 'invite_bonus',
                    points: inviteeRewardPoints,
                    invitedBy: inviterId,
                    date: new Date()
                })
            }, { merge: true });

            // Update inviter's doc
            batch.set(inviterRef, {
                inviteCount: currentInviteCount + 1,
                invitedUsers: arrayUnion(userId),
                rewardPoints: currentInviterPoints + inviterRewardPoints,
                rewardHistory: arrayUnion({
                    type: 'invite_reward',
                    points: inviterRewardPoints,
                    invitedUser: userId,
                    date: new Date()
                })
            }, { merge: true });

            await batch.commit();

            showToast('success', translate('invite_code_success', { points: inviteeRewardPoints }));
            setFriendCode('');
            fetchInviteStats(); // İstatistikleri anında güncelle
        } catch (error) {
            console.error('Davet kodu kullanılırken hata oluştu:', error);
            showToast('error', translate('invite_code_use_error'));
        } finally {
            setSubmitting(false);
        }
    };

    const fetchInviteStats = async () => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            const userId = currentUser.uid;
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const inviteCount = userData.inviteCount || 0;
                const earnedPoints = userData.rewardHistory ? userData.rewardHistory.reduce((total, reward) => total + reward.points, 0) : 0;
                const spentPoints = userData.claimedRewards ? userData.claimedRewards.reduce((total, reward) => total + reward.pointsUsed, 0) : 0;
                const currentPoints = Math.max(0, earnedPoints - spentPoints);

                setInviteStats({ inviteCount, totalRewards: currentPoints });
            }
        } catch (error) {
            console.error('Davet istatistikleri alınırken hata oluştu:', error);
        }
    };

    const handleClaimReward = (reward) => {
        Alert.alert(
            translate('reward_claim_title'),
            translate('reward_claim_confirm', { rewardTitle: reward.title, pointsRequired: reward.pointsRequired }),
            [
                {
                    text: translate('cancel'),
                    style: 'cancel'
                },
                {
                    text: translate('claim_reward_button'),
                    onPress: () => processRewardClaim(reward)
                }
            ]
        );
    };

    const processRewardClaim = async (reward) => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                showToast('error', translate('user_info_error'));
                return;
            }

            const userId = currentUser.uid;
            const userDocRef = doc(db, 'users', userId);

            // Firestore batch write
            const batch = writeBatch(db);

            // Check points again before processing
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) throw new Error("User document doesn't exist");
            const userData = userDoc.data();
            const earnedPoints = userData.rewardHistory ? userData.rewardHistory.reduce((total, r) => total + r.points, 0) : 0;
            const spentPoints = userData.claimedRewards ? userData.claimedRewards.reduce((total, r) => total + r.pointsUsed, 0) : 0;
            const currentPoints = Math.max(0, earnedPoints - spentPoints);

            if (currentPoints < reward.pointsRequired) {
                showToast('error', 'Yetersiz puan'); // Add a translation key for this
                return;
            }

            // Update user document
            batch.set(userDocRef, {
                // rewardPoints field is not directly updated here, calculated from history
                claimedRewards: arrayUnion({
                    rewardId: reward.id,
                    claimedAt: new Date(),
                    title: reward.title,
                    pointsUsed: reward.pointsRequired
                })
            }, { merge: true });

            await batch.commit();

            fetchInviteStats(); // Update stats immediately

            showToast('success', translate('reward_claim_success', { rewardTitle: reward.title }));
        } catch (error) {
            console.error('Ödül talep edilirken hata oluştu:', error);
            showToast('error', translate('reward_claim_error'));
        }
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
                    {translate('invite_friends_title')}
                </Text>
            </View>

            <View style={styles.inviteCodeSection}>
                <Text style={[styles.inviteCodeTitle, { color: currentTheme.text }]}>
                    {translate('your_invite_code')}
                </Text>
                {loading ? (
                    <ActivityIndicator size="large" color="#4CAF50" />
                ) : (
                    <TouchableOpacity
                        style={styles.codeContainer}
                        onPress={copyInviteCode}
                    >
                        <Text style={styles.inviteCode}>{inviteCode}</Text>
                        <Ionicons name="copy-outline" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                )}
                <Text style={styles.tapToCopy}>
                    {translate('tap_to_copy')}
                </Text>
            </View>

            <View style={styles.shareSection}>
                <Text style={[styles.shareTitle, { color: currentTheme.text }]}>
                    {translate('invite_your_friends')}
                </Text>
                <View style={styles.shareGrid}>
                    {shareOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={[styles.shareOption, { backgroundColor: option.color + '20' }]}
                            onPress={option.action}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: option.color + '40' }]}>
                                <Ionicons name={option.icon} size={28} color={option.color} />
                            </View>
                            <Text style={[styles.optionTitle, { color: currentTheme.text }]}>
                                {option.title}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.enterCodeSection}>
                <Text style={[styles.enterCodeTitle, { color: currentTheme.text }]}>
                    {translate('use_invite_code')}
                </Text>
                <View style={styles.codeInputContainer}>
                    <TextInput
                        style={[
                            styles.codeInput,
                            {
                                color: currentTheme.text,
                                borderColor: friendCode ? '#4CAF50' : '#ddd',
                                backgroundColor: currentTheme === darkTheme
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.03)'
                            }
                        ]}
                        placeholder={translate('enter_friend_code_placeholder')}
                        placeholderTextColor={currentTheme === darkTheme ? '#999' : '#666'}
                        value={friendCode}
                        onChangeText={setFriendCode}
                        autoCapitalize="characters"
                        maxLength={12}
                    />
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            { opacity: friendCode.trim() ? 1 : 0.6 }
                        ]}
                        onPress={submitFriendCode}
                        disabled={!friendCode.trim() || submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>{translate('use_code_button')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
                <Text style={styles.enterCodeDescription}>
                    {translate('enter_code_description')}
                </Text>
            </View>

            <View style={styles.statsSection}>
                <Text style={[styles.statsTitle, { color: currentTheme.text }]}>
                    {translate('invite_stats_title')}
                </Text>
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{inviteStats.inviteCount}</Text>
                        <Text style={styles.statLabel}>{translate('total_invites')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{inviteStats.totalRewards}</Text>
                        <Text style={styles.statLabel}>{translate('earned_points')}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.viewRewardsButton}
                    onPress={() => setRewardsModalVisible(true)}
                >
                    <Text style={styles.viewRewardsButtonText}>{translate('view_rewards_button')}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#4CAF50" />
                </TouchableOpacity>
            </View>

            <View style={styles.rewardSection}>
                <View style={styles.rewardCard}>
                    <Ionicons name="gift-outline" size={40} color="#4CAF50" />
                    <Text style={[styles.rewardTitle, { color: currentTheme.text }]}>
                        {translate('invite_reward_card_title')}
                    </Text>
                    <Text style={styles.rewardDescription}>
                        {translate('invite_reward_card_desc')}
                    </Text>
                </View>
            </View>

            {/* Ödüller Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={rewardsModalVisible}
                onRequestClose={() => setRewardsModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={[
                        styles.modalContent,
                        { backgroundColor: currentTheme === darkTheme ? '#2c2c2c' : '#fff' }
                    ]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>
                                {translate('available_rewards_title')}
                            </Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setRewardsModalVisible(false)}
                            >
                                <Ionicons name="close" size={24} color={currentTheme.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalSubtitle, { color: currentTheme.text }]}>
                            {translate('rewards_modal_subtitle')}
                        </Text>

                        <FlatList
                            data={rewards}
                            keyExtractor={(item) => item.id}
                            style={styles.rewardsList}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <View style={[styles.rewardItem, { borderColor: currentTheme === darkTheme ? '#444' : '#eee' }]}>
                                    <View style={[styles.rewardIconContainer, { backgroundColor: '#4CAF5020' }]}>
                                        <Ionicons name={item.icon} size={32} color="#4CAF50" />
                                    </View>
                                    <View style={styles.rewardInfo}>
                                        <Text style={[styles.rewardItemTitle, { color: currentTheme.text }]}>
                                            {item.title}
                                        </Text>
                                        <Text style={styles.rewardItemDescription}>
                                            {item.description}
                                        </Text>
                                        <View style={styles.pointsContainer}>
                                            <Ionicons name="star" size={16} color="#FFD700" />
                                            <Text style={styles.pointsText}>
                                                {translate('points_required', { points: item.pointsRequired })}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[
                                            styles.claimButton,
                                            { opacity: inviteStats.totalRewards >= item.pointsRequired ? 1 : 0.5 }
                                        ]}
                                        disabled={inviteStats.totalRewards < item.pointsRequired}
                                        onPress={() => handleClaimReward(item)}
                                    >
                                        <Text style={styles.claimButtonText}>
                                            {inviteStats.totalRewards >= item.pointsRequired ? translate('claim_button') : translate('locked_button')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>
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
    inviteCodeSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    inviteCodeTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    inviteCode: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginRight: 15,
        letterSpacing: 2,
    },
    tapToCopy: {
        fontSize: 12,
        color: '#666',
    },
    shareSection: {
        marginBottom: 40,
    },
    shareTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 20,
        marginLeft: 10,
    },
    shareGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    shareOption: {
        width: '30%',
        alignItems: 'center',
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    optionTitle: {
        fontSize: 12,
        fontWeight: '500',
    },
    rewardSection: {
        marginBottom: 30,
    },
    rewardCard: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
    },
    rewardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginVertical: 10,
        textAlign: 'center',
    },
    rewardDescription: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    enterCodeSection: {
        marginBottom: 40,
    },
    enterCodeTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
        marginLeft: 10,
    },
    codeInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    codeInput: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        marginRight: 10,
    },
    submitButton: {
        backgroundColor: '#4CAF50',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    submitButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    enterCodeDescription: {
        fontSize: 12,
        color: '#666',
        marginLeft: 10,
    },
    statsSection: {
        marginBottom: 40,
    },
    statsTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
        marginLeft: 10,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 15,
        padding: 20,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
    },
    statDivider: {
        height: '80%',
        width: 1,
        backgroundColor: 'rgba(102, 102, 102, 0.2)',
    },
    viewRewardsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
        padding: 8,
    },
    viewRewardsButtonText: {
        color: '#4CAF50',
        fontWeight: '600',
        marginRight: 5,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 20,
        paddingBottom: 30,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    modalSubtitle: {
        fontSize: 14,
        marginBottom: 20,
        color: '#666',
    },
    rewardsList: {
        width: '100%',
    },
    rewardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
    },
    rewardIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    rewardInfo: {
        flex: 1,
    },
    rewardItemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    rewardItemDescription: {
        fontSize: 12,
        color: '#666',
        marginBottom: 6,
        lineHeight: 16,
    },
    pointsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pointsText: {
        fontSize: 11,
        color: '#666',
        marginLeft: 4,
    },
    claimButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginLeft: 10,
    },
    claimButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default InviteFriendsPage; 