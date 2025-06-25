import { db } from '../../firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from '../../firebaseConfig';
import { calculateCityExplorationStats } from '../helpers/cityExplorationHelpers';

// Şehir verilerini getir
export const getCityData = async (userId) => {
    try {
        const db = getFirebaseDb();

        // Şehirleri al
        const citiesRef = collection(db, 'cities');
        const citiesSnapshot = await getDocs(citiesRef);
        const cities = citiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Şehir istatistiklerini hesapla
        const stats = await calculateCityExplorationStats(userId);

        return {
            ...stats,
            cities // Şehir listesini de döndür
        };
    } catch (error) {
        console.error('Şehir verilerini getirme hatası:', error);
        return null;
    }
};

// Şehir aktivitesi tamamlandığında
export const completeActivity = async (userId, cityId, activityId) => {
    try {
        const userCityRef = doc(db, 'userCities', userId);
        const userCityDoc = await getDoc(userCityRef);

        if (!userCityDoc.exists()) {
            await updateDoc(userCityRef, {
                completedActivities: {
                    [cityId]: [activityId]
                },
                citiesExplored: 1,
                currentCity: cityId,
                lastVisited: {
                    [cityId]: Timestamp.now()
                }
            });
        } else {
            const data = userCityDoc.data();
            const cityActivities = data.completedActivities[cityId] || [];

            if (!cityActivities.includes(activityId)) {
                await updateDoc(userCityRef, {
                    [`completedActivities.${cityId}`]: arrayUnion(activityId),
                    currentCity: cityId,
                    [`lastVisited.${cityId}`]: Timestamp.now(),
                    citiesExplored: data.citiesExplored + (cityActivities.length === 0 ? 1 : 0)
                });
            }
        }

        return true;
    } catch (error) {
        console.error('Aktivite tamamlama hatası:', error);
        return false;
    }
};

// Şehir rozeti kazanıldığında
export const earnBadge = async (userId, cityId, badgeType) => {
    try {
        const userCityRef = doc(db, 'userCities', userId);
        const badge = {
            cityId,
            type: badgeType,
            earnedAt: Timestamp.now()
        };

        await updateDoc(userCityRef, {
            badges: arrayUnion(badge)
        });

        return true;
    } catch (error) {
        console.error('Rozet kazanma hatası:', error);
        return false;
    }
};

// Rozetleri hesapla
const calculateBadges = (userStats, cities) => {
    const badges = [];
    Object.entries(userStats.completedActivities).forEach(([cityId, activities]) => {
        const city = cities[cityId];
        if (!city) return;

        const totalPoints = activities.length;

        // Bronze: 3 nokta, Silver: 6 nokta, Gold: 9 nokta
        if (totalPoints >= 3) {
            badges.push({
                cityId,
                type: 'bronze',
                icon: '🥉',
                name: `${city.name} Kaşifi`,
                earnedAt: activities[2].timestamp
            });
        }
        if (totalPoints >= 6) {
            badges.push({
                cityId,
                type: 'silver',
                icon: '🥈',
                name: `${city.name} Uzmanı`,
                earnedAt: activities[5].timestamp
            });
        }
        if (totalPoints >= 9) {
            badges.push({
                cityId,
                type: 'gold',
                icon: '🥇',
                name: `${city.name} Ustası`,
                earnedAt: activities[8].timestamp
            });
        }
    });
    return badges;
};