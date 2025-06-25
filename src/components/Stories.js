import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity, StyleSheet,
    Text,
    Alert
} from 'react-native';
import { getStories, clearStoryCache } from '../services/storyService';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUserUid } from '../services/friendFunctions';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import FastImage from 'react-native-fast-image';

const Stories = ({ friends, navigation }) => {
    const [stories, setStories] = useState([]);
    const [viewedStories, setViewedStories] = useState(new Set());
    const [currentUser, setCurrentUser] = useState(null);
    const [myStories, setMyStories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Profil fotoğrafı için yardımcı fonksiyon - memoized
    const getProfilePicture = useCallback((user) => {
        if (!user) return null;
        if (user.profilePicture && user.profilePicture.startsWith('http')) {
            return user.profilePicture;
        }
        const name = user.informations?.name || '';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200&color=fff&bold=true&font-size=0.33`;
    }, []);

    const fetchStories = useCallback(async () => {
        try {
            setIsLoading(true);
            const friendIds = friends.map(friend => friend.id);

            if (friendIds.length === 0) {
                setStories({});
                setIsLoading(false);
                return;
            }

            // Sadece ilk 10 arkadaşın hikayelerini yükle
            const initialFriendIds = friendIds.slice(0, 10);
            const fetchedStories = await getStories(initialFriendIds);

            const groupedStories = fetchedStories.reduce((acc, story) => {
                if (!acc[story.userId]) {
                    acc[story.userId] = [];
                }
                acc[story.userId].push(story);
                return acc;
            }, {});

            setStories(groupedStories);

            // Kalan arkadaşların hikayelerini arka planda yükle
            if (friendIds.length > 10) {
                setTimeout(async () => {
                    const remainingFriendIds = friendIds.slice(10);
                    const remainingStories = await getStories(remainingFriendIds);

                    const updatedStories = { ...groupedStories };
                    remainingStories.forEach(story => {
                        if (!updatedStories[story.userId]) {
                            updatedStories[story.userId] = [];
                        }
                        updatedStories[story.userId].push(story);
                    });

                    setStories(updatedStories);
                }, 1000); // 1 saniye sonra kalan hikayeleri yükle
            }
        } catch (error) {
            console.error('Hikayeler yüklenirken hata:', error);
            setStories({});
        } finally {
            setIsLoading(false);
        }
    }, [friends]);

    const fetchCurrentUser = useCallback(async () => {
        try {
            const userId = await getCurrentUserUid();
            if (userId) {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setCurrentUser({
                        id: userId,
                        ...userData,
                        name: userData.informations?.name || 'Ben'
                    });
                }
            }
        } catch (error) {
            console.error('Kullanıcı bilgileri alınamadı:', error);
        }
    }, []);

    const fetchMyStories = useCallback(async () => {
        try {
            const userId = await getCurrentUserUid();
            if (userId) {
                const myStoriesData = await getStories([userId]);
                setMyStories(myStoriesData);
            }
        } catch (error) {
            console.error('Kişisel hikayeler yüklenirken hata:', error);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            // Kullanıcı bilgilerini ve kendi hikayelerini önce yükle
            await Promise.all([
                fetchCurrentUser(),
                fetchMyStories()
            ]);

            // Sonra arkadaş hikayelerini yükle
            fetchStories();
        };

        loadData();

        // Komponentin unmount olduğunda önbelleği temizle
        return () => {
            clearStoryCache();
        };
    }, [friends]);

    // Arkadaşları hikayesi olanlar ve olmayanlar olarak ayır - memoized
    const sortedFriends = useMemo(() => {
        return friends
            .sort((a, b) => {
                const aHasStory = stories[a.id]?.length > 0;
                const bHasStory = stories[b.id]?.length > 0;
                const aViewed = viewedStories.has(a.id);
                const bViewed = viewedStories.has(b.id);

                if (aHasStory && !bHasStory) return -1;
                if (!aHasStory && bHasStory) return 1;
                if (aViewed && !bViewed) return 1;
                if (!aViewed && bViewed) return -1;
                return 0;
            })
            .filter(friend => stories[friend.id]?.length > 0);
    }, [friends, stories, viewedStories]);

    const handleStoryPress = useCallback((userId, userStories) => {
        const user = friends.find(friend => friend.id === userId);
        setViewedStories(prev => new Set(prev).add(userId));
        navigation.navigate('StoryView', {
            userId,
            stories: userStories,
            user: user,
            updateStories: (updatedStories) => {
                setStories(prev => ({
                    ...prev,
                    [userId]: updatedStories
                }));
            }
        });
    }, [friends, navigation]);

    const handleAddStory = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('İzin Gerekli', 'Hikaye paylaşmak için galeri izni gerekiyor.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 1,
                aspect: undefined,
                allowsMultipleSelection: false,
                presentationStyle: 'fullScreen',
            });

            if (!result.canceled) {
                const imageUri = result.assets[0].uri;
                navigation.navigate('StoryEditor', { imageUri });
            }
        } catch (error) {
            console.error('Hikaye ekleme hatası:', error);
            Alert.alert('Hata', 'Hikaye eklenirken bir sorun oluştu.');
        }
    };

    const handleAddStoryPress = () => {
        if (myStories.length > 0) {
            Alert.alert(
                'Hikaye',
                'Ne yapmak istersiniz?',
                [
                    {
                        text: 'Hikayemi Gör',
                        onPress: () => navigation.navigate('StoryView', {
                            userId: currentUser?.id,
                            stories: myStories,
                            user: currentUser,
                            isOwnStory: true
                        })
                    },
                    {
                        text: 'Yeni Hikaye Ekle',
                        onPress: handleAddStory
                    },
                    {
                        text: 'İptal',
                        style: 'cancel'
                    }
                ]
            );
        } else {
            handleAddStory();
        }
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            removeClippedSubviews={true} // Performans iyileştirmesi
            initialNumToRender={10} // Başlangıçta render edilecek öğe sayısı
            maxToRenderPerBatch={5} // Her batch'te render edilecek maksimum öğe sayısı
            windowSize={5} // Render penceresi boyutu
            updateCellsBatchingPeriod={50} // Batch güncelleme periyodu
        >
            {/* Hikaye Ekleme/Görüntüleme Butonu */}
            <TouchableOpacity
                onPress={handleAddStoryPress}
                style={styles.storyItem}
            >
                <View style={styles.addStoryButton}>
                    <View style={[
                        styles.storyRing,
                        myStories.length > 0 ? styles.activeStoryRing : styles.inactiveStoryRing
                    ]}>
                        <FastImage
                            source={{
                                uri: getProfilePicture(currentUser),
                                priority: FastImage.priority.high,
                                cache: FastImage.cacheControl.immutable
                            }}
                            style={styles.storyImage}
                        />
                        <View style={styles.plusIconContainer}>
                            <Ionicons name="add-circle" size={30} color="#2196F3" />
                        </View>
                    </View>
                </View>
                <Text style={styles.storyText}>
                    {myStories.length > 0 ? 'Hikayem' : 'Hikaye Ekle'}
                </Text>
            </TouchableOpacity>

            {/* Arkadaş Hikayeleri */}
            {isLoading ? (
                // Yükleme durumunda placeholder göster
                Array(5).fill(0).map((_, index) => (
                    <View key={`placeholder-${index}`} style={styles.storyItem}>
                        <View style={[styles.storyRing, styles.placeholderRing]} />
                        <View style={styles.placeholderText} />
                    </View>
                ))
            ) : (
                sortedFriends.map((friend) => {
                    return (
                        <TouchableOpacity
                            key={friend.id}
                            style={styles.storyItem}
                            onPress={() => handleStoryPress(friend.id, stories[friend.id])}
                        >
                            <View style={[
                                styles.storyRing,
                                viewedStories.has(friend.id) ? styles.viewedStoryRing : styles.activeStoryRing
                            ]}>
                                <FastImage
                                    source={{
                                        uri: getProfilePicture(friend),
                                        priority: FastImage.priority.normal,
                                        cache: FastImage.cacheControl.immutable
                                    }}
                                    style={styles.storyImage}
                                />
                            </View>
                            <Text style={styles.storyText} numberOfLines={1} ellipsizeMode="tail">
                                {friend.informations?.name || friend.name || 'Kullanıcı'}
                            </Text>
                        </TouchableOpacity>
                    );
                })
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 5,
        backgroundColor: '#fff',
    },
    scrollContent: {
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    storyItem: {
        alignItems: 'center',
        marginRight: 22,
        width: 100,
    },
    storyRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeStoryRing: {
        borderWidth: 3,
        borderColor: '#2196F3',
    },
    viewedStoryRing: {
        borderWidth: 3,
        borderColor: '#DBDBDB',
    },
    inactiveStoryRing: {
        borderWidth: 3,
        borderColor: '#DBDBDB',
    },
    storyImage: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#f0f0f0',
    },
    storyText: {
        marginTop: 8,
        fontSize: 14,
        textAlign: 'center',
        width: 100,
    },
    addStoryButton: {
        position: 'relative',
    },
    plusIconContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderRing: {
        backgroundColor: '#f0f0f0',
        borderWidth: 3,
        borderColor: '#e0e0e0',
    },
    placeholderText: {
        marginTop: 8,
        height: 14,
        width: 70,
        backgroundColor: '#f0f0f0',
        borderRadius: 7,
    }
});

export default Stories; 