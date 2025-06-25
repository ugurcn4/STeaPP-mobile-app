import { CITY_AREAS, BADGE_THRESHOLDS } from '../constants/cityAreas';
import { haversine } from './locationUtils';
import { collection, getDocs, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../../firebaseConfig';
import { getPlaceFromCoordinates } from './locationHelpers';

// Bir path'in kapladığı alanı hesapla (km²)
const calculatePathArea = (points) => {
    if (points.length < 3) return 0;

    let area = 0;
    try {
        // Her nokta arasındaki mesafeyi toplayarak bir etki alanı hesaplayalım
        const IMPACT_RADIUS = 0.5; // 500 metre etki alanı
        const BASE_AREA = Math.PI * Math.pow(IMPACT_RADIUS, 2); // Başlangıç noktası için dairesel alan

        // Başlangıç noktası için dairesel alan ekle
        area += BASE_AREA;

        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];

            // İki nokta arası mesafe
            const distance = haversine(p1.latitude, p1.longitude, p2.latitude, p2.longitude) / 1000; // km

            // Her segment için dikdörtgen alan hesabı (mesafe * etki alanı genişliği)
            // Ve bitiş noktası için yarım daire alanı
            area += (distance * IMPACT_RADIUS * 2) + (BASE_AREA / 2);
        }
    } catch (error) {
        console.error('Alan hesaplama hatası:', error);
        return 0;
    }

    // Minimum alan 0.5 km²
    return Math.max(area, 0.5);
};



// Şehir bazlı keşif istatistiklerini hesapla
export const calculateCityExplorationStats = async (userId) => {
    try {
        // Önce mevcut pathleri güncelle
        await updateExistingPaths(userId);

        const db = getFirebaseDb();
        // Paths'leri al
        const pathsRef = collection(db, `users/${userId}/paths`);
        const pathsSnapshot = await getDocs(pathsRef);
        const paths = pathsSnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));

        const cityStats = {};
        let mostRecentPath = null;
        let mostRecentDate = new Date(0);
        let totalActivities = 0;

        // Her path için
        paths.forEach(path => {
            if (!path.points || path.points.length < 2) return;

            const cityName = path.city || 'Bilinmeyen';
            totalActivities++;

            // firstDiscovery değerini normalize et
            let normalizedFirstDiscovery;
            if (path.firstDiscovery) {
                if (typeof path.firstDiscovery.toDate === 'function') {
                    normalizedFirstDiscovery = path.firstDiscovery.toDate();
                } else if (path.firstDiscovery instanceof Date) {
                    normalizedFirstDiscovery = path.firstDiscovery;
                } else if (typeof path.firstDiscovery === 'string') {
                    normalizedFirstDiscovery = new Date(path.firstDiscovery);
                } else {
                    normalizedFirstDiscovery = new Date();
                }
            } else {
                normalizedFirstDiscovery = new Date();
            }

            // En son path'i bul
            if (normalizedFirstDiscovery > mostRecentDate) {
                mostRecentDate = normalizedFirstDiscovery;
                mostRecentPath = path;
            }

            if (!cityStats[cityName]) {
                cityStats[cityName] = {
                    exploredArea: 0,
                    totalArea: CITY_AREAS[cityName] || 0,
                    pathCount: 0,
                    lastUpdate: normalizedFirstDiscovery,
                    lastPathId: path.id
                };
            }

            const pathArea = calculatePathArea(path.points);
            cityStats[cityName].exploredArea += pathArea;
            cityStats[cityName].pathCount += 1;

            if (normalizedFirstDiscovery > cityStats[cityName].lastUpdate) {
                cityStats[cityName].lastUpdate = normalizedFirstDiscovery;
                cityStats[cityName].lastPathId = path.id;
            }
        });

        // Rozetleri hesapla
        const badges = [];
        Object.entries(cityStats).forEach(([cityName, stats]) => {
            if (cityName === 'Bilinmeyen' || cityName === 'Bilinmeyen Şehir') return;  // Bilinmeyen şehirler için rozet verme

            const explorationPercentage = (stats.exploredArea / stats.totalArea) * 100;

            if (explorationPercentage >= BADGE_THRESHOLDS.gold) {
                badges.push({
                    city: cityName,
                    level: 'gold',
                    icon: '🥇',
                    name: `${cityName} Ustası`,
                    earnedAt: stats.lastUpdate
                });
            } else if (explorationPercentage >= BADGE_THRESHOLDS.silver) {
                badges.push({
                    city: cityName,
                    level: 'silver',
                    icon: '🥈',
                    name: `${cityName} Uzmanı`,
                    earnedAt: stats.lastUpdate
                });
            } else if (explorationPercentage >= BADGE_THRESHOLDS.bronze) {
                badges.push({
                    city: cityName,
                    level: 'bronze',
                    icon: '🥉',
                    name: `${cityName} Kaşifi`,
                    earnedAt: stats.lastUpdate
                });
            }
        });

        // Rozetleri son kazanılma tarihine göre sırala
        badges.sort((a, b) => b.earnedAt - a.earnedAt);

        const currentCity = mostRecentPath ? mostRecentPath.city : 'Bilinmeyen';
        const currentCityStats = cityStats[currentCity] || {
            exploredArea: 0,
            totalArea: CITY_AREAS[currentCity] || 0,
            pathCount: 0
        };

        return {
            currentCity,
            exploredArea: Math.round(currentCityStats.exploredArea * 100) / 100,
            totalArea: currentCityStats.totalArea,
            citiesExplored: Object.keys(cityStats).filter(city => city !== 'Bilinmeyen').length,
            totalActivities,
            badges,
            lastUpdate: mostRecentDate,
            cityStats
        };
    } catch (error) {
        console.error('Stats hesaplama hatası:', error);
        throw error;
    }
};

export const updateExistingPaths = async (userId) => {
    try {
        const db = getFirebaseDb();
        const pathsRef = collection(db, `users/${userId}/paths`);
        const pathsSnapshot = await getDocs(pathsRef);

        const updatePromises = pathsSnapshot.docs.map(async (doc) => {
            const path = doc.data();
            if (!path.city && path.points && path.points.length > 0) {
                const startPoint = path.points[0];
                const locationInfo = await getPlaceFromCoordinates(
                    startPoint.latitude,
                    startPoint.longitude
                );

                return updateDoc(doc.ref, {
                    city: locationInfo.city || 'Bilinmeyen',
                    district: locationInfo.district || 'Bilinmeyen'
                });
            }
            return null;
        });

        await Promise.all(updatePromises.filter(p => p !== null));

    } catch (error) {
        console.error('Path güncellenirken hata:', error);
    }
}; 