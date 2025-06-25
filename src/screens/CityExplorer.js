import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { getCityData } from '../services/cityService';
import { getCurrentUserUid } from '../services/friendFunctions';
import { CITY_AREAS, BADGE_THRESHOLDS } from '../constants/cityAreas';
import { translate } from '../i18n/i18n';

const CityExplorer = ({ navigation }) => {
    const [cityData, setCityData] = useState(null);
    const [selectedCity, setSelectedCity] = useState(null);
    const [selectedRegion, setSelectedRegion] = useState('all');
    const [cities, setCities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBadgesModal, setShowBadgesModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showActivitiesModal, setShowActivitiesModal] = useState(false);

    const regions = [
        { id: 'explored', name: translate('waiting_to_be_explored'), icon: '⭐' },
        { id: 'all', name: translate('total'), icon: '🗺️' },
        { id: 'marmara', name: translate('region_marmara'), icon: '🌊' },
        { id: 'ege', name: translate('region_ege'), icon: '🏖️' },
        { id: 'akdeniz', name: translate('region_akdeniz'), icon: '🌅' },
        { id: 'karadeniz', name: translate('region_karadeniz'), icon: '🌲' },
        { id: 'ic_anadolu', name: translate('region_ic_anadolu'), icon: '🏔️' },
        { id: 'dogu_anadolu', name: translate('region_dogu_anadolu'), icon: '⛰️' },
        { id: 'guneydogu_anadolu', name: translate('region_guneydogu_anadolu'), icon: '🏺' },
    ];

    // Şehir verilerini yükle
    const loadCityData = useCallback(async () => {
        try {
            setLoading(true);
            const userId = await getCurrentUserUid();

            if (!userId) {
                return;
            }

            // cityService'den verileri al
            const data = await getCityData(userId);

            if (data) {
                setCityData(data);
                // Veritabanından gelen şehirleri kullan
                setCities(data.cities);

                // Keşfedilen şehirleri konsola yazdır
                const exploredCities = data.cities.filter(city => {
                    const cityStats = data.cityStats[city.name];
                    return cityStats && cityStats.pathCount > 0;
                });
            }
        } catch (error) {
            console.error(translate('cities_loading_error'), error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Bölge değiştiğinde şehirleri filtrele
    const handleRegionChange = useCallback(async (region) => {
        try {
            setLoading(true);
            setSelectedRegion(region);

            if (!cityData?.cities) return;

            let filteredCities = [];

            if (region === 'explored') {
                // Sadece keşfedilen şehirleri göster
                filteredCities = cityData.cities.filter(city => {
                    const cityStats = cityData.cityStats[city.name];
                    return cityStats && cityStats.pathCount > 0;
                });
            } else if (region === 'all') {
                // Tüm şehirleri göster
                filteredCities = cityData.cities;
            } else {
                // Bölgeye göre filtrele
                filteredCities = cityData.cities.filter(city => city.region === region);
            }

            setCities(filteredCities);
        } catch (error) {
            console.error(translate('refresh_error'), error);
        } finally {
            setLoading(false);
        }
    }, [cityData]);

    useEffect(() => {
        loadCityData();
    }, [loadCityData]);

    // İstatistikleri hesapla
    const calculateStats = useCallback(() => {
        if (!cityData?.userStats) return {
            totalCities: 0,
            totalBadges: 0,
            totalActivities: 0,
            progressPercentage: 0
        };

        // Şehir bazlı istatistikleri hesapla
        const cityStats = cities.reduce((acc, city) => {
            const completedActivities = cityData.userStats.completedActivities[city.id] || [];
            const totalPossiblePoints = 10; // Her şehir için maksimum 10 nokta
            const cityProgress = (completedActivities.length / totalPossiblePoints) * 100;

            // Rozet sayısını kontrol et (3, 6, 9 noktaya göre)
            const earnedBadgesCount =
                completedActivities.length >= 9 ? 3 :
                    completedActivities.length >= 6 ? 2 :
                        completedActivities.length >= 3 ? 1 : 0;

            return {
                totalActivities: acc.totalActivities + completedActivities.length,
                totalBadges: acc.totalBadges + earnedBadgesCount,
                totalCities: acc.totalCities + (completedActivities.length > 0 ? 1 : 0)
            };
        }, { totalActivities: 0, totalBadges: 0, totalCities: 0 });

        // Toplam ilerleme yüzdesini hesapla (her şehir için 10 nokta hedefi)
        const totalPossiblePoints = cities.length * 10;
        const stats = {
            totalCities: cityStats.totalCities,
            totalBadges: cityStats.totalBadges,
            totalActivities: cityStats.totalActivities,
            progressPercentage: totalPossiblePoints > 0
                ? (cityStats.totalActivities / totalPossiblePoints) * 100
                : 0
        };

        return stats;
    }, [cityData, cities]);

    const handleCompleteActivity = useCallback(async (cityId, activityId) => {
        try {
            const userId = await getCurrentUserUid();
            if (!userId) return;

            // Aktiviteyi tamamla
            const success = await completeActivity(userId, cityId, activityId);

            if (success) {
                // Verileri yeniden yükle
                loadCityData();

                // Kullanıcıya başarı mesajı göster
                // Burada bir Toast veya Alert kullanabiliriz
            }
        } catch (error) {
            console.error('Aktivite tamamlama hatası:', error);
        }
    }, [loadCityData]);

    const checkAndAwardBadge = useCallback(async (cityId) => {
        try {
            const userId = await getCurrentUserUid();
            if (!userId) return;

            const cityActivities = cityData?.userStats?.completedActivities[cityId] || [];
            const activityCount = cityActivities.length;

            // Rozet seviyelerini kontrol et
            if (activityCount >= 9) {
                await earnBadge(userId, cityId, 'gold');
            } else if (activityCount >= 6) {
                await earnBadge(userId, cityId, 'silver');
            } else if (activityCount >= 3) {
                await earnBadge(userId, cityId, 'bronze');
            }

            // Verileri yenile
            loadCityData();
        } catch (error) {
            console.error('Rozet kontrol hatası:', error);
        }
    }, [cityData, loadCityData]);

    const handleStartActivity = useCallback(async (cityId, activityId) => {
        try {
            const userId = await getCurrentUserUid();
            if (!userId) return;

            // Burada yeni bir fonksiyon ekleyeceğiz
            // Şimdilik sadece tamamlama işlemini yapalım
            await completeActivity(userId, cityId, activityId);

            // Rozet kontrolü yap
            await checkAndAwardBadge(cityId);

            // Verileri yenile
            loadCityData();
        } catch (error) {
            console.error('Aktivite başlatma hatası:', error);
        }
    }, [checkAndAwardBadge, loadCityData]);

    const renderHeader = () => {
        const stats = cityData || {
            citiesExplored: 0,
            badges: [],
            totalActivities: 0
        };

        // Gerçek keşfedilen şehir sayısını hesapla (Bilinmeyen Şehir hariç)
        const realExploredCities = Object.entries(stats.cityStats || {}).filter(([cityName, stats]) => {
            return cityName !== translate('unauthorized_user') && stats.pathCount > 0;
        }).length;

        // Kazanılan rozet sayısını hesapla
        const earnedBadges = [];
        if (cityData?.cityStats) {
            Object.entries(cityData.cityStats).forEach(([cityName, stats]) => {
                if (cityName === translate('unauthorized_user') || cityName === translate('unauthorized_user')) return;

                const explorationPercentage = Math.min(
                    Math.round((stats.exploredArea / stats.totalArea) * 100),
                    100
                );

                if (explorationPercentage >= BADGE_THRESHOLDS.gold) {
                    earnedBadges.push({ level: 'gold' });
                } else if (explorationPercentage >= BADGE_THRESHOLDS.silver) {
                    earnedBadges.push({ level: 'silver' });
                } else if (explorationPercentage >= BADGE_THRESHOLDS.bronze) {
                    earnedBadges.push({ level: 'bronze' });
                }
            });
        }

        return (
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={28} color="#FFF" />
                    </TouchableOpacity>

                    <Text style={styles.title}>{translate('city_points')}</Text>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <MaterialIcons name="location-city" size={24} color="#FFF" />
                        <Text style={styles.statValue}>{realExploredCities}</Text>
                        <Text style={styles.statLabel}>{translate('cities')}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.statCard}
                        onPress={() => setShowBadgesModal(true)}
                    >
                        <MaterialIcons name="emoji-events" size={24} color="#FFF" />
                        <Text style={styles.statValue}>{earnedBadges.length}</Text>
                        <Text style={styles.statLabel}>{translate('special_badges')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.statCard}
                        onPress={() => setShowActivitiesModal(true)}
                    >
                        <MaterialIcons name="directions-run" size={24} color="#FFF" />
                        <Text style={styles.statValue}>{stats.totalActivities}</Text>
                        <Text style={styles.statLabel}>{translate('attractions')}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.howItWorksContainer}>
                    <TouchableOpacity
                        onPress={() => setShowInfoModal(true)}
                        style={styles.howItWorksButton}
                    >
                        <MaterialIcons name="info-outline" size={20} color="#FFF" />
                        <Text style={styles.howItWorksText}>{translate('how_calculated')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderAchievements = () => {
        // Şehir istatistiklerinden rozetleri hesapla
        const earnedBadges = [];
        if (cityData?.cityStats) {
            Object.entries(cityData.cityStats).forEach(([cityName, stats]) => {
                if (cityName === translate('unauthorized_user') || cityName === translate('unauthorized_user')) return;

                const explorationPercentage = Math.min(
                    Math.round((stats.exploredArea / stats.totalArea) * 100),
                    100
                );

                if (explorationPercentage >= BADGE_THRESHOLDS.gold) {
                    earnedBadges.push({
                        city: cityName,
                        level: 'gold',
                        icon: '🥇',
                        name: `${cityName} ${translate('gold_master')}`,
                        earnedAt: stats.lastUpdate
                    });
                } else if (explorationPercentage >= BADGE_THRESHOLDS.silver) {
                    earnedBadges.push({
                        city: cityName,
                        level: 'silver',
                        icon: '🥈',
                        name: `${cityName} ${translate('silver_expert')}`,
                        earnedAt: stats.lastUpdate
                    });
                } else if (explorationPercentage >= BADGE_THRESHOLDS.bronze) {
                    earnedBadges.push({
                        city: cityName,
                        level: 'bronze',
                        icon: '🥉',
                        name: `${cityName} ${translate('bronze_explorer')}`,
                        earnedAt: stats.lastUpdate
                    });
                }
            });
        }

        // Rozetleri son kazanılma tarihine göre sırala
        earnedBadges.sort((a, b) => b.earnedAt - a.earnedAt);

        return (
            <View style={styles.achievementsContainer}>
                <Text style={styles.sectionTitle}>{translate('last_earned_badges')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
                    {earnedBadges.length > 0 ? (
                        earnedBadges.map((badge, index) => (
                            <View key={index} style={styles.achievementBadge}>
                                <LinearGradient
                                    colors={
                                        badge.level === 'gold' ? ['#FFD700', '#FFA500'] :
                                            badge.level === 'silver' ? ['#C0C0C0', '#A9A9A9'] :
                                                ['#CD7F32', '#8B4513']
                                    }
                                    style={styles.achievementBadgeGradient}
                                >
                                    <Text style={[styles.badgeIcon, { fontSize: 40 }]}>{badge.icon}</Text>
                                    <Text style={[styles.achievementBadgeName, { marginTop: 15 }]}>
                                        {badge.name}
                                    </Text>
                                    <Text style={styles.achievementBadgeCity}>
                                        {badge.city}
                                    </Text>
                                </LinearGradient>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyBadgesContainer}>
                            <LinearGradient
                                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                                style={styles.emptyBadgesGradient}
                            >
                                <MaterialIcons name="emoji-events" size={32} color="rgba(255,255,255,0.9)" />
                                <Text style={styles.emptyBadgesTitle}>{translate('no_badges_yet')}</Text>
                                <Text style={styles.emptyBadgesSubtitle}>
                                    {translate('explore_cities_to_earn_badges')}
                                </Text>
                            </LinearGradient>
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    };

    const renderRegionFilter = () => (
        <View style={styles.filterContainer}>
            <Text style={styles.filterTitle}>{translate('regions')}</Text>
            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={regions}
                keyExtractor={item => item.id}
                style={styles.regionList}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.regionButton,
                            selectedRegion === item.id && styles.selectedRegion
                        ]}
                        onPress={() => handleRegionChange(item.id)}
                    >
                        <Text style={styles.regionIcon}>{item.icon}</Text>
                        <Text style={[
                            styles.regionName,
                            selectedRegion === item.id && styles.selectedRegionText
                        ]}>{item.name}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );

    const renderCityCard = ({ item }) => {
        if (!cityData?.cityStats) return null;

        // Şehir istatistiklerini al
        const cityStats = cityData.cityStats[item.name] || {
            exploredArea: 0,
            totalArea: CITY_AREAS[item.name] || 0,
            pathCount: 0
        };

        const completionPercentage = Math.min(
            Math.round((cityStats.exploredArea / (CITY_AREAS[item.name] || 1)) * 100),
            100
        );

        // Rozet durumunu kontrol et
        const earnedBadges = [];
        if (completionPercentage >= BADGE_THRESHOLDS.bronze) earnedBadges.push({ type: 'bronze', icon: '🥉' });
        if (completionPercentage >= BADGE_THRESHOLDS.silver) earnedBadges.push({ type: 'silver', icon: '🥈' });
        if (completionPercentage >= BADGE_THRESHOLDS.gold) earnedBadges.push({ type: 'gold', icon: '🥇' });

        return (
            <TouchableOpacity
                style={styles.cityCard}
                onPress={() => setSelectedCity(item)}
            >
                <LinearGradient
                    colors={['#FFFFFF', '#F5F5F5']}
                    style={styles.cityCardGradient}
                >
                    <View style={styles.cityCardContent}>
                        <View style={styles.cityCardHeader}>
                            <View style={styles.cityNameContainer}>
                                <Text numberOfLines={2} style={styles.cityCardName}>
                                    {item.name}
                                </Text>
                                <View style={styles.regionContainer}>
                                    <Text style={styles.regionIcon}>
                                        {regions.find(r => r.id === item.region)?.icon || '📍'}
                                    </Text>
                                    <Text numberOfLines={1} style={styles.cityCardRegion}>
                                        {regions.find(r => r.id === item.region)?.name || item.region}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.progressBadge}>
                                <MaterialIcons name="explore" size={16} color="#2196F3" />
                                <Text style={styles.progressText}>%{completionPercentage}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.cityCardStats}>
                            <View style={styles.activityCount}>
                                <MaterialIcons name="directions-run" size={16} color="#666" />
                                <Text style={styles.activityCountText}>
                                    {cityStats.pathCount} {translate('attractions')}
                                </Text>
                            </View>
                            {earnedBadges.length > 0 && (
                                <View style={styles.badgeCount}>
                                    {earnedBadges.map((badge, index) => (
                                        <Text key={index} style={styles.badgeIcon}>
                                            {badge.icon}
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={styles.progressBarContainer}>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressBarFill, {
                                    width: `${completionPercentage}%`,
                                    backgroundColor: completionPercentage >= BADGE_THRESHOLDS.gold ? '#4CAF50' :
                                        completionPercentage >= BADGE_THRESHOLDS.silver ? '#2196F3' :
                                            completionPercentage >= BADGE_THRESHOLDS.bronze ? '#FFC107' : '#E0E0E0'
                                }]} />
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };


    const renderActivitySection = (activities, cityId) => {
        const completedActivities = cityData?.userStats?.completedActivities[cityId] || [];

        return (
            <View style={styles.activitiesContainer}>
                {activities?.map((activity, index) => (
                    <View key={activity.id} style={[
                        styles.activityCard,
                        completedActivities.includes(activity.id) && styles.completedActivityCard
                    ]}>
                        <View style={styles.activityHeader}>
                            <View style={styles.activityTitleContainer}>
                                <View style={styles.activityTitleRow}>
                                    <Text style={styles.activityTitle}>{activity.name}</Text>
                                    <Text style={styles.activityPoints}>+{activity.points} {translate('points')}</Text>
                                </View>
                                <View style={styles.activityMeta}>
                                    <MaterialIcons name="schedule" size={16} color="#666" />
                                    <Text style={styles.activityMetaText}>{activity.duration}</Text>
                                    {activity.type === 'food' && (
                                        <>
                                            <MaterialIcons name="restaurant" size={16} color="#666" />
                                            <Text style={styles.activityMetaText}>{translate('restaurants')}</Text>
                                        </>
                                    )}
                                    {activity.type === 'activity' && (
                                        <>
                                            <MaterialIcons name="directions-run" size={16} color="#666" />
                                            <Text style={styles.activityMetaText}>{translate('attractions')}</Text>
                                        </>
                                    )}
                                </View>
                            </View>
                        </View>

                        <Text style={styles.activityDescription}>{activity.description}</Text>

                        {!completedActivities.includes(activity.id) && (
                            <TouchableOpacity
                                style={[styles.startActivityButton, { backgroundColor: '#cccccc' }]}
                                disabled={true}
                            >
                                <Text style={styles.startActivityButtonText}>{translate('coming_soon')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>
        );
    };

    const renderModal = () => {
        if (!selectedCity) return null;

        const cityProgress = cityData?.userStats?.completedActivities[selectedCity.id]?.length || 0;
        const totalActivities = selectedCity.activities?.length || 0;
        const completionPercentage = (cityProgress / totalActivities) * 100;

        return (
            <Modal
                visible={!!selectedCity}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectedCity(null)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setSelectedCity(null)}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                            <View style={styles.modalTitleContainer}>
                                <Text style={styles.modalTitle}>{selectedCity.name}</Text>
                                <Text style={styles.modalSubtitle}>{selectedCity.region}</Text>
                            </View>
                        </View>

                        <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                            <FastImage
                                source={{ uri: selectedCity.imageUrl || `https://source.unsplash.com/800x600/?${encodeURIComponent(selectedCity.name)},turkey,city` }}
                                style={styles.modalImage}
                                resizeMode={FastImage.resizeMode.cover}
                            />

                            <View style={styles.cityProgressContainer}>
                                <View style={styles.cityProgressHeader}>
                                    <Text style={styles.cityProgressTitle}>{translate('city_progress')}</Text>
                                    <Text style={styles.cityProgressPercentage}>%{Math.round(completionPercentage)}</Text>
                                </View>
                                <View style={styles.cityProgressBar}>
                                    <View style={[styles.cityProgressFill, { width: `${Math.min(completionPercentage, 100)}%` }]} />
                                </View>
                                <Text style={styles.cityProgressText}>
                                    {cityProgress} / {totalActivities} {translate('completed_activities')}
                                </Text>
                            </View>

                            {/* Aktiviteler Bölümü */}
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>{translate('attractions')}</Text>
                                {renderActivitySection(selectedCity.activities, selectedCity.id)}
                            </View>

                            {/* Rozetler Bölümü */}
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>{translate('special_badges')}</Text>
                                <View style={styles.badgesContainer}>
                                    {Object.entries(selectedCity?.badges || {}).map(([level, badge]) => {
                                        const cityStats = cityData.cityStats[selectedCity.name] || {
                                            exploredArea: 0,
                                            totalArea: CITY_AREAS[selectedCity.name] || 0,
                                            pathCount: 0
                                        };

                                        const explorationPercentage = Math.min(
                                            Math.round((cityStats.exploredArea / cityStats.totalArea) * 100),
                                            100
                                        );

                                        const targetPercentage = level === 'bronze' ? BADGE_THRESHOLDS.bronze :
                                            level === 'silver' ? BADGE_THRESHOLDS.silver :
                                                BADGE_THRESHOLDS.gold;

                                        const isUnlocked = explorationPercentage >= targetPercentage;

                                        return (
                                            <View key={level} style={styles.badgeCard}>
                                                <LinearGradient
                                                    colors={isUnlocked ? ['#FFFFFF', '#F5F5F5'] : ['#E0E0E0', '#CCCCCC']}
                                                    style={styles.badgeCardGradient}
                                                >
                                                    <View style={[styles.badgeIconContainer, !isUnlocked && styles.lockedBadge]}>
                                                        <Text style={styles.badgeIcon}>{badge.icon}</Text>
                                                        {!isUnlocked && (
                                                            <View style={styles.lockOverlay}>
                                                                <MaterialIcons name="lock" size={20} color="#FFF" />
                                                            </View>
                                                        )}
                                                    </View>
                                                    <View style={styles.badgeInfo}>
                                                        <Text style={styles.badgeName}>{badge.name}</Text>
                                                        <Text style={styles.badgeDescription}>{badge.description}</Text>
                                                        <View style={styles.badgeProgress}>
                                                            <View style={styles.badgeProgressBar}>
                                                                <View
                                                                    style={[
                                                                        styles.badgeProgressFill,
                                                                        {
                                                                            width: `${Math.min((explorationPercentage / targetPercentage) * 100, 100)}%`,
                                                                            backgroundColor: isUnlocked ? '#4CAF50' : '#E0E0E0'
                                                                        }
                                                                    ]}
                                                                />
                                                            </View>
                                                            <Text style={styles.badgeProgressText}>
                                                                {isUnlocked ? translate('earned') : `%${explorationPercentage} / %${targetPercentage}`}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </LinearGradient>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderAllBadgesModal = () => {
        if (!showBadgesModal) return null;

        // Rozetleri hesapla ve kategorilere ayır
        const badgesByLevel = {
            gold: [],
            silver: [],
            bronze: []
        };

        if (cityData?.cityStats) {
            Object.entries(cityData.cityStats).forEach(([cityName, stats]) => {
                if (cityName === translate('unauthorized_user') || cityName === translate('unauthorized_user')) return;

                const explorationPercentage = Math.min(
                    Math.round((stats.exploredArea / stats.totalArea) * 100),
                    100
                );

                if (explorationPercentage >= BADGE_THRESHOLDS.gold) {
                    badgesByLevel.gold.push({
                        city: cityName,
                        icon: '🥇',
                        name: `${cityName} ${translate('gold_master')}`,
                        percentage: explorationPercentage
                    });
                } else if (explorationPercentage >= BADGE_THRESHOLDS.silver) {
                    badgesByLevel.silver.push({
                        city: cityName,
                        icon: '🥈',
                        name: `${cityName} ${translate('silver_expert')}`,
                        percentage: explorationPercentage
                    });
                } else if (explorationPercentage >= BADGE_THRESHOLDS.bronze) {
                    badgesByLevel.bronze.push({
                        city: cityName,
                        icon: '🥉',
                        name: `${cityName} ${translate('bronze_explorer')}`,
                        percentage: explorationPercentage
                    });
                }
            });
        }

        const renderBadgeSection = (title, badges, gradientColors) => {
            if (badges.length === 0) return null;

            return (
                <View style={styles.badgeSectionContainer}>
                    <Text style={styles.badgeSectionTitle}>{title}</Text>
                    <View style={styles.badgeGrid}>
                        {badges.map((badge, index) => (
                            <View key={index} style={styles.badgeGridItem}>
                                <LinearGradient
                                    colors={gradientColors}
                                    style={styles.badgeGridItemGradient}
                                >
                                    <Text style={styles.badgeGridIcon}>{badge.icon}</Text>
                                    <Text style={styles.badgeGridName}>{badge.name}</Text>
                                    <Text style={styles.badgeGridPercentage}>%{badge.percentage}</Text>
                                </LinearGradient>
                            </View>
                        ))}
                    </View>
                </View>
            );
        };

        return (
            <Modal
                visible={showBadgesModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowBadgesModal(false)}
            >
                <View style={styles.allBadgesModalContainer}>
                    <View style={styles.allBadgesModalContent}>
                        <View style={styles.allBadgesModalHeader}>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowBadgesModal(false)}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                            <Text style={styles.allBadgesModalTitle}>{translate('earned_badges')}</Text>
                        </View>

                        <ScrollView style={styles.allBadgesModalScroll}>
                            {renderBadgeSection('Altın Rozetler', badgesByLevel.gold, ['#FFD700', '#FFA500'])}
                            {renderBadgeSection('Gümüş Rozetler', badgesByLevel.silver, ['#C0C0C0', '#A9A9A9'])}
                            {renderBadgeSection('Bronz Rozetler', badgesByLevel.bronze, ['#CD7F32', '#8B4513'])}

                            {Object.values(badgesByLevel).every(badges => badges.length === 0) && (
                                <View style={styles.noBadgesContainer}>
                                    <MaterialIcons name="emoji-events" size={64} color="rgba(0,0,0,0.2)" />
                                    <Text style={styles.noBadgesText}>{translate('no_badges_yet')}</Text>
                                    <Text style={styles.noBadgesSubtext}>
                                        {translate('explore_cities_to_earn_badges')}
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderInfoModal = () => {
        if (!showInfoModal) return null;

        return (
            <Modal
                visible={showInfoModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowInfoModal(false)}
            >
                <View style={styles.infoModalContainer}>
                    <View style={styles.infoModalContent}>
                        <View style={styles.infoModalHeader}>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowInfoModal(false)}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                            <Text style={styles.infoModalTitle}>{translate('city_discovery_system')}</Text>
                        </View>

                        <ScrollView style={styles.infoModalScroll}>
                            <View style={styles.infoSection}>
                                <View style={styles.infoSectionHeader}>
                                    <MaterialIcons name="explore" size={24} color="#2196F3" />
                                    <Text style={styles.infoSectionTitle}>{translate('exploration_area_calculation')}</Text>
                                </View>
                                <View style={styles.infoSectionContent}>
                                    <Text style={styles.infoText}>{translate('info_recorded_routes')}</Text>
                                    <Text style={styles.infoText}>{translate('info_impact_area')}</Text>
                                    <Text style={styles.infoText}>{translate('info_calculated_area')}</Text>
                                    <Text style={styles.infoText}>{translate('info_every_activity_counted')}</Text>
                                </View>
                            </View>

                            <View style={styles.infoSection}>
                                <View style={styles.infoSectionHeader}>
                                    <MaterialIcons name="emoji-events" size={24} color="#FFD700" />
                                    <Text style={styles.infoSectionTitle}>{translate('special_badges_system')}</Text>
                                </View>
                                <View style={styles.infoSectionContent}>
                                    <View style={styles.badgeInfoRow}>
                                        <Text style={styles.badgeIcon}>🥉</Text>
                                        <View style={styles.badgeInfoContent}>
                                            <Text style={styles.badgeTitle}>{translate('bronze_badge')}</Text>
                                            <Text style={styles.infoText}>{translate('bronze_badge_description')}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.badgeInfoRow}>
                                        <Text style={styles.badgeIcon}>🥈</Text>
                                        <View style={styles.badgeInfoContent}>
                                            <Text style={styles.badgeTitle}>{translate('silver_badge')}</Text>
                                            <Text style={styles.infoText}>{translate('silver_badge_description')}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.badgeInfoRow}>
                                        <Text style={styles.badgeIcon}>🥇</Text>
                                        <View style={styles.badgeInfoContent}>
                                            <Text style={styles.badgeTitle}>{translate('gold_badge')}</Text>
                                            <Text style={styles.infoText}>{translate('gold_badge_description')}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>


                            <View style={styles.infoSection}>
                                <View style={styles.infoSectionHeader}>
                                    <MaterialIcons name="analytics" size={24} color="#4CAF50" />
                                    <Text style={styles.infoSectionTitle}>{translate('statistics')}</Text>
                                </View>
                                <View style={styles.infoSectionContent}>
                                    <Text style={styles.infoText}>{translate('stat_city_count')}</Text>
                                    <Text style={styles.infoText}>{translate('stat_badge_count')}</Text>
                                    <Text style={styles.infoText}>{translate('stat_activity_count')}</Text>
                                </View>
                            </View>

                            <View style={styles.infoSection}>
                                <View style={styles.infoSectionHeader}>
                                    <MaterialIcons name="tips-and-updates" size={24} color="#FF9800" />
                                    <Text style={styles.infoSectionTitle}>{translate('tips')}</Text>
                                </View>
                                <View style={styles.infoSectionContent}>
                                    <Text style={styles.infoText}>{translate('tip_explore_faster')}</Text>
                                    <Text style={styles.infoText}>{translate('tip_gps_on')}</Text>
                                    <Text style={styles.infoText}>{translate('tip_dont_forget_to_record')}</Text>
                                </View>
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderActivitiesModal = () => {
        if (!showActivitiesModal || !cityData) return null;

        // Aktiviteleri tarihe göre grupla
        const groupedActivities = {};
        Object.entries(cityData.cityStats).forEach(([cityName, stats]) => {
            if (stats.pathCount > 0) {
                if (!groupedActivities[cityName]) {
                    groupedActivities[cityName] = {
                        count: stats.pathCount,
                        exploredArea: stats.exploredArea
                    };
                }
            }
        });

        // Toplam aktivite sayısını hesapla
        const totalActivities = Object.values(groupedActivities).reduce((sum, data) => sum + data.count, 0);

        return (
            <Modal
                visible={showActivitiesModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowActivitiesModal(false)}
            >
                <View style={styles.allActivitiesModalContainer}>
                    <LinearGradient
                        colors={['rgba(255,255,255,0.95)', '#F5F5F5']}
                        style={styles.allActivitiesModalContent}
                    >
                        <View style={styles.allActivitiesModalHeader}>
                            <View style={styles.modalHeaderLeft}>
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={() => setShowActivitiesModal(false)}
                                >
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                                <Text style={styles.allActivitiesModalTitle}>{translate('my_activities')}</Text>
                            </View>
                            <View style={styles.totalActivitiesBadge}>
                                <MaterialIcons name="directions-run" size={16} color="#2196F3" />
                                <Text style={styles.totalActivitiesText}>{totalActivities} {translate('attractions')}</Text>
                            </View>
                        </View>

                        <ScrollView
                            style={styles.allActivitiesModalScroll}
                            showsVerticalScrollIndicator={false}
                        >
                            {Object.entries(groupedActivities).map(([cityName, data], index) => (
                                <View key={cityName} style={styles.activityCitySection}>
                                    <TouchableOpacity
                                        style={styles.activityCityContent}
                                        onPress={() => {
                                            setShowActivitiesModal(false);
                                            const city = cities.find(c => c.name === cityName);
                                            if (city) setSelectedCity(city);
                                        }}
                                    >
                                        <View style={styles.activityCitySectionHeader}>
                                            <View style={styles.cityNameContainer}>
                                                <Text style={styles.activityCityName}>{cityName}</Text>
                                                <View style={styles.activityCityStats}>
                                                    <MaterialIcons name="directions-run" size={16} color="#2196F3" />
                                                    <Text style={styles.activityCityCount}>{data.count} {translate('attractions')}</Text>
                                                </View>
                                            </View>
                                            <MaterialIcons name="chevron-right" size={24} color="#666" />
                                        </View>

                                        <View style={styles.activityCityDetails}>
                                            <View style={[styles.activityDetailItem, { marginRight: 0 }]}>
                                                <View style={[styles.detailIconContainer, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                                                    <MaterialIcons name="explore" size={16} color="#2196F3" />
                                                </View>
                                                <View style={styles.detailTextContainer}>
                                                    <Text style={styles.detailLabel}>Keşfedilen Alan</Text>
                                                    <Text style={styles.detailValue}>
                                                        {Math.round(data.exploredArea * 100) / 100} km²
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {Object.keys(groupedActivities).length === 0 && (
                                <View style={styles.noActivitiesContainer}>
                                    <LinearGradient
                                        colors={['rgba(33, 150, 243, 0.1)', 'rgba(33, 150, 243, 0.05)']}
                                        style={styles.noActivitiesGradient}
                                    >
                                        <MaterialIcons name="directions-run" size={64} color="#2196F3" />
                                        <Text style={styles.noActivitiesText}>Henüz aktivite yok</Text>
                                        <Text style={styles.noActivitiesSubtext}>
                                            {translate('explore_cities_to_earn_activities')}
                                        </Text>
                                    </LinearGradient>
                                </View>
                            )}
                        </ScrollView>
                    </LinearGradient>
                </View>
            </Modal>
        );
    };

    if (loading && !cities.length) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color="#FFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a2a6c', '#b21f1f', '#fdbb2d']}
                style={styles.background}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            />

            <FlatList
                data={cities}
                renderItem={renderCityCard}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.cityList}
                numColumns={2}
                showsVerticalScrollIndicator={false}
                refreshing={loading}
                onRefresh={loadCityData}
                ListHeaderComponent={
                    <>
                        {renderHeader()}
                        {renderAchievements()}
                        {renderRegionFilter()}
                    </>
                }
            />

            {renderModal()}
            {renderAllBadgesModal()}
            {renderInfoModal()}
            {renderActivitiesModal()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    header: {
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 15,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFF',
        flex: 1,
        marginLeft: 15,
        textAlign: 'left',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        marginBottom: 15,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 15,
        padding: 15,
        marginHorizontal: 5,
    },
    statValue: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '800',
        marginVertical: 5,
    },
    statLabel: {
        color: '#FFF',
        fontSize: 12,
        opacity: 0.8,
    },
    filterContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    filterTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
        opacity: 0.9,
    },
    regionList: {
        marginBottom: 5,
    },
    regionButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 25,
        marginRight: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectedRegion: {
        backgroundColor: '#FFF',
    },
    regionIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    regionName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '500',
    },
    selectedRegionText: {
        color: '#000',
    },
    cityList: {
        padding: 10,
    },
    cityCard: {
        flex: 1,
        margin: 8,
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        backgroundColor: '#FFF',
    },
    cityCardGradient: {
        flex: 1,
        padding: 12,
    },
    cityCardContent: {
        flex: 1,
    },
    cityCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cityNameContainer: {
        flex: 1,
        marginRight: 10,
    },
    cityCardName: {
        color: '#333',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
        lineHeight: 22,
    },
    regionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    cityCardRegion: {
        color: '#666',
        fontSize: 13,
    },
    progressBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    progressText: {
        color: '#2196F3',
        marginLeft: 4,
        fontSize: 13,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 8,
    },
    cityCardStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    activityCount: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityCountText: {
        color: '#666',
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 4,
    },
    lastVisitContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastVisitText: {
        color: '#666',
        fontSize: 12,
        marginLeft: 4,
    },
    activityTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    activityTypeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
    },
    activityTypeCount: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
        marginRight: 3,
    },
    activityTypeText: {
        fontSize: 12,
    },
    progressBarContainer: {
        marginTop: 'auto',
    },
    progressBar: {
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#2196F3',
        borderRadius: 2,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        flex: 1,
        marginTop: 50,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        backgroundColor: '#F5F5F5',
    },
    modalScrollContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        marginBottom: 0,
        zIndex: 1,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    closeButton: {
        padding: 10,
        backgroundColor: '#E8E8E8',
        borderRadius: 20,
    },
    modalTitleContainer: {
        flex: 1,
        marginLeft: 15,
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#333',
        marginBottom: 5,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    modalImage: {
        width: '100%',
        height: 200,
        borderRadius: 20,
        marginBottom: 20,
    },
    cityProgressContainer: {
        backgroundColor: '#F5F5F5',
        borderRadius: 15,
        padding: 15,
        marginTop: -30,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    cityProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    cityProgressTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    cityProgressPercentage: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4CAF50',
    },
    cityProgressBar: {
        height: 8,
        backgroundColor: '#E0E0E0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 5,
    },
    cityProgressFill: {
        height: '100%',
        backgroundColor: '#4CAF50',
        borderRadius: 4,
    },
    cityProgressText: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    sectionContainer: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        marginBottom: 15,
        marginTop: 10,
    },
    activityCard: {
        backgroundColor: '#FFF',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    activityTitleContainer: {
        flex: 1,
        marginRight: 10,
    },
    activityTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    activityTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    activityPoints: {
        color: '#4CAF50',
        fontWeight: '600',
        fontSize: 14,
    },
    activityMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityMetaText: {
        color: '#666',
        marginLeft: 4,
        marginRight: 10,
        fontSize: 14,
    },
    activityDescription: {
        fontSize: 15,
        color: '#666',
        lineHeight: 20,
        marginBottom: 10,
    },
    startActivityButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginTop: 5,
    },
    startActivityButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    badgesContainer: {
        gap: 15,
    },
    badgeCard: {
        marginBottom: 15,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    badgeCardGradient: {
        flexDirection: 'row',
        padding: 15,
    },
    badgeIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    badgeInfo: {
        flex: 1,
    },
    badgeIcon: {
        fontSize: 40,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    badgeName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    badgeDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    badgeProgress: {
        marginTop: 'auto',
    },
    badgeProgressBar: {
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
    },
    badgeProgressFill: {
        height: '100%',
        borderRadius: 2,
    },
    badgeProgressText: {
        fontSize: 12,
        color: '#666',
    },
    lockedBadge: {
        opacity: 0.5,
    },
    lockOverlay: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    seedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    seedButtonText: {
        color: '#FFF',
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
    },
    achievementsContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    badgeScroll: {
        flexGrow: 0,
    },
    achievementBadge: {
        width: 140,
        height: 160,
        marginRight: 15,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    achievementBadgeGradient: {
        flex: 1,
        padding: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    achievementBadgeName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        textAlign: 'center',
        marginVertical: 8,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 3,
    },
    achievementBadgeCity: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 3,
    },
    emptyBadgesContainer: {
        width: 280,
        height: 160,
        borderRadius: 20,
        overflow: 'hidden',
    },
    emptyBadgesGradient: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyBadgesTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginVertical: 10,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    emptyBadgesSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    completedActivityCard: {
        backgroundColor: '#F5F5F5',
        opacity: 0.8,
    },
    activitiesContainer: {
        marginTop: 10,
    },
    activityCard: {
        backgroundColor: '#FFF',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    activityTitleContainer: {
        flex: 1,
        marginRight: 10,
    },
    activityTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    activityTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    activityPoints: {
        color: '#4CAF50',
        fontWeight: '600',
        fontSize: 14,
    },
    activityMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityMetaText: {
        color: '#666',
        marginLeft: 4,
        marginRight: 10,
        fontSize: 14,
    },
    activityDescription: {
        fontSize: 15,
        color: '#666',
        lineHeight: 20,
        marginBottom: 10,
    },
    startActivityButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginTop: 5,
    },
    startActivityButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    allBadgesModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    allBadgesModalContent: {
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        height: '80%',
        padding: 20,
    },
    allBadgesModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    allBadgesModalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        marginLeft: 15,
    },
    allBadgesModalScroll: {
        flex: 1,
    },
    badgeSectionContainer: {
        marginBottom: 25,
    },
    badgeSectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    badgeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    badgeGridItem: {
        width: '48%',
        marginBottom: 15,
        borderRadius: 15,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    badgeGridItemGradient: {
        padding: 15,
        alignItems: 'center',
        aspectRatio: 1,
    },
    badgeGridIcon: {
        fontSize: 40,
        marginBottom: 10,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    badgeGridName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 5,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    badgeGridPercentage: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    noBadgesContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    noBadgesText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#666',
        marginTop: 20,
        textAlign: 'center',
    },
    noBadgesSubtext: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        marginTop: 10,
    },
    howItWorksContainer: {
        marginTop: 15,
        position: 'relative',
        zIndex: 9999,
        alignItems: 'flex-start',
    },
    howItWorksButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    howItWorksText: {
        color: '#FFF',
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
    },
    tooltipOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: 99999,
    },
    tooltipContainer: {
        position: 'absolute',
        top: 40,
        left: 20,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 25,
        zIndex: 99999,
        width: 280,
    },
    tooltipArrow: {
        position: 'absolute',
        top: -8,
        left: 20,
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#FFF',
        transform: [{ translateY: -1 }],
    },
    tooltipContent: {
        padding: 15,
    },
    tooltipHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    tooltipTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2C3E50',
    },
    tooltipSection: {
        marginTop: 12,
    },
    tooltipSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#34495E',
        marginBottom: 4,
    },
    tooltipText: {
        fontSize: 12,
        color: '#7F8C8D',
        marginBottom: 2,
        lineHeight: 18,
    },
    infoModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    infoModalContent: {
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        height: '80%',
        padding: 20,
    },
    infoModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    infoModalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        marginLeft: 15,
    },
    infoModalScroll: {
        flex: 1,
    },
    infoSection: {
        marginBottom: 25,
        backgroundColor: '#FFF',
        borderRadius: 15,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    infoSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    infoSectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginLeft: 10,
    },
    infoSectionContent: {
        paddingLeft: 10,
    },
    infoText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
        lineHeight: 20,
    },
    badgeInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: 'rgba(0,0,0,0.02)',
        padding: 10,
        borderRadius: 10,
    },
    badgeInfoContent: {
        flex: 1,
    },
    badgeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    allActivitiesModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    allActivitiesModalContent: {
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        height: '85%',
        paddingTop: 20,
    },
    allActivitiesModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    totalActivitiesBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    totalActivitiesText: {
        color: '#2196F3',
        fontWeight: '600',
        fontSize: 14,
        marginLeft: 6,
    },
    allActivitiesModalScroll: {
        flex: 1,
        paddingHorizontal: 20,
    },
    activityCitySection: {
        marginBottom: 15,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        backgroundColor: '#FFF',
    },
    activityCityContent: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    activityCitySectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cityNameContainer: {
        flex: 1,
    },
    activityCityName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    activityCityStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityCityCount: {
        marginLeft: 6,
        color: '#2196F3',
        fontSize: 14,
        fontWeight: '600',
    },
    activityCityDetails: {
        marginTop: 5,
    },
    activityDetailItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    detailTextContainer: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    noActivitiesContainer: {
        padding: 20,
        marginTop: 20,
    },
    noActivitiesGradient: {
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
    },
    noActivitiesText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#2196F3',
        marginTop: 20,
        textAlign: 'center',
    },
    noActivitiesSubtext: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 22,
    },
});

export default CityExplorer; 