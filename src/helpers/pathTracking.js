import { haversine } from './locationUtils';

// Sabit değerler
export const TRACKING_CONSTANTS = {
    MIN_ACCURACY: 20,    // metre
    MODE_SWITCH_SPEED: 9, // m/s (32.4 km/h) - bu hızın üstünde araç moduna geçer
    PEDESTRIAN: {
        MIN_SPEED: 0.5,      // m/s (1.8 km/h)
        MAX_SPEED: 8.3,      // m/s (30 km/h)
        SAMPLING_INTERVAL: 3000, // ms
    },
    VEHICLE: {
        MIN_SPEED: 2.7,      // m/s (10 km/h)
        MAX_SPEED: 50,       // m/s (180 km/h)
        SAMPLING_INTERVAL: 2000, // ms
    },
    PATH_COLLECTION: {
        MIN_BEARING_CHANGE: 10,     // derece (dönüş açısı değişimi - daha hassas algılama için düşürüldü)
        STRAIGHT_PATH_INTERVAL: 20,  // metre (düz yolda nokta toplama aralığı - yüksek hızlar için artırıldı)
        TURNING_PATH_INTERVAL: 8,    // metre (dönüşlerde nokta toplama aralığı - daha yumuşak dönüşler için artırıldı)
        MIN_DISTANCE: 5,            // metre (minimum nokta toplama mesafesi - daha stabil için artırıldı)
        MAX_DISTANCE: 100,          // metre (maksimum nokta toplama mesafesi - yüksek hızlar için artırıldı)
        HIGH_SPEED_THRESHOLD: 80,   // km/sa (yüksek hız eşiği)
        CURVE_SPEED_THRESHOLD: 50   // km/sa (viraj hız eşiği)
    }
};

// Mevcut TRACKING_CONSTANTS'ı koruyoruz ve GPS_ACCURACY'yi ekliyoruz
export const GPS_ACCURACY = {
    OPTIMAL: 10,           // Optimal doğruluk eşiği
    ACCEPTABLE: 20,        // Kabul edilebilir doğruluk eşiği
    MAX_ACCEPTABLE: 40,    // Maksimum kabul edilebilir doğruluk
    CALIBRATION_TIME: 3000, // 3 saniye kalibrasyon süresi (daha hızlı)
    STABILITY_THRESHOLD: 5, // Daha esnek stabilite eşiği
    SAMPLE_SIZE: 3,        // Daha az örnek sayısı (daha hızlı kalibrasyon)
    MIN_SATELLITES: 4      // Minimum uydu sayısı
};

// Hareket sabitlerini güncelleyelim - daha hassas algılama için
export const MOVEMENT_CONSTANTS = {
    STATIONARY_SPEED: 0.3,      // m/s (1.08 km/h) - daha düşük eşik (durağan algılama için)
    MIN_MOVEMENT_DISTANCE: 5,    // metre - daha düşük mesafe eşiği
    STATIONARY_CHECK_COUNT: 3,   // Daha fazla örnek (daha güvenilir)
    MOVEMENT_CHECK_INTERVAL: 1000, // ms - daha sık hareket kontrolü
    STATIONARY_TIME_THRESHOLD: 3000 // ms - durağan kabul edilmek için gereken minimum süre
};

/**
 * Hıza göre hareket modunu belirler
 */
export const detectMode = (speed) => {
    return speed > TRACKING_CONSTANTS.MODE_SWITCH_SPEED ? 'VEHICLE' : 'PEDESTRIAN';
};

/**
 * İki nokta arasındaki açıyı hesaplar (derece cinsinden)
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = (degree) => degree * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360; // 0-360 derece arasında normalize et
};

/**
 * Dönüş yapılıp yapılmadığını kontrol eder
 */
export const isTurning = (lastBearing, currentBearing, speed) => {
    if (lastBearing === null) return false;

    let diff = Math.abs(currentBearing - lastBearing);
    // 360 derece etrafındaki dönüşleri de kontrol et
    if (diff > 180) diff = 360 - diff;

    // Hıza bağlı olarak dönüş hassasiyetini ayarla
    const speedKmh = speed * 3.6;
    let minBearingChange = TRACKING_CONSTANTS.PATH_COLLECTION.MIN_BEARING_CHANGE;

    // Yüksek hızlarda daha az hassas dönüş algılama
    if (speedKmh > TRACKING_CONSTANTS.PATH_COLLECTION.CURVE_SPEED_THRESHOLD) {
        minBearingChange *= 1.5; // Dönüş hassasiyetini azalt
    }

    return diff >= minBearingChange;
};

/**
 * Hıza ve dönüşe göre toplama aralığını ayarlar
 */
export const adjustCollectionInterval = (speed, isTurningNow) => {
    const speedKmh = speed * 3.6;
    let interval;

    // Yüksek hız durumu
    if (speedKmh > TRACKING_CONSTANTS.PATH_COLLECTION.HIGH_SPEED_THRESHOLD) {
        interval = isTurningNow ?
            TRACKING_CONSTANTS.PATH_COLLECTION.TURNING_PATH_INTERVAL * 2 : // Virajda daha sık nokta
            TRACKING_CONSTANTS.PATH_COLLECTION.STRAIGHT_PATH_INTERVAL * 1.5; // Düz yolda daha seyrek nokta
    }
    // Normal hız durumu
    else {
        interval = isTurningNow ?
            TRACKING_CONSTANTS.PATH_COLLECTION.TURNING_PATH_INTERVAL :
            TRACKING_CONSTANTS.PATH_COLLECTION.STRAIGHT_PATH_INTERVAL;
    }

    // Hıza göre aralığı ölçekle
    const speedFactor = Math.max(1, speedKmh / 50); // 50 km/sa baz hız
    interval *= speedFactor;

    // Minimum ve maksimum mesafe kontrolü
    return Math.min(
        Math.max(interval, TRACKING_CONSTANTS.PATH_COLLECTION.MIN_DISTANCE),
        TRACKING_CONSTANTS.PATH_COLLECTION.MAX_DISTANCE
    );
};

/**
 * Yeni bir noktanın toplanıp toplanmayacağını kontrol eder
 */
export const shouldCollectPoint = (newLocation, lastLocation) => {
    // GPS doğruluğu kontrolü
    if (newLocation.coords.accuracy > TRACKING_CONSTANTS.MIN_ACCURACY) {
        return false;
    }

    // İlk nokta ise topla
    if (!lastLocation) {
        return true;
    }

    // Hız kontrolü
    const speedMs = newLocation.coords.speed || 0;
    const speedKmh = speedMs * 3.6;

    // Hız limiti kontrolü - 180 km/sa üstünde ise toplama
    if (speedKmh > TRACKING_CONSTANTS.VEHICLE.MAX_SPEED) {
        return false;
    }

    // İki nokta arası mesafeyi hesapla
    const distance = haversine(
        lastLocation.latitude,
        lastLocation.longitude,
        newLocation.coords.latitude,
        newLocation.coords.longitude
    );

    // Zaman farkını hesapla
    const timeDiff = newLocation.timestamp - lastLocation.timestamp;

    // Dönüş kontrolü
    const currentBearing = calculateBearing(
        lastLocation.latitude,
        lastLocation.longitude,
        newLocation.coords.latitude,
        newLocation.coords.longitude
    );

    const turning = isTurning(lastLocation.bearing || null, currentBearing, speedMs);

    // Hıza ve dönüşe göre toplama aralığını hesapla
    const collectionInterval = adjustCollectionInterval(speedMs, turning);

    // Yüksek hızda mesafe kontrolünü ayarla
    let maxDistance = TRACKING_CONSTANTS.PATH_COLLECTION.MAX_DISTANCE;
    if (speedKmh > 120) {
        maxDistance = Math.min(200, speedKmh); // Hıza göre dinamik maksimum mesafe
    }

    // Mesafe yeterliyse ve diğer kriterler uygunsa topla
    return distance >= collectionInterval && distance <= maxDistance;
};

/**
 * İki nokta arasındaki hızı hesaplar
 */
export const calculateSpeed = (newLocation, lastLocation) => {
    return newLocation.coords.speed ||
        haversine(
            lastLocation.coords.latitude,
            lastLocation.coords.longitude,
            newLocation.coords.latitude,
            newLocation.coords.longitude
        ) / ((newLocation.timestamp - lastLocation.timestamp) / 1000);
};

/**
 * Hızın geçerli aralıkta olup olmadığını kontrol eder
 */
export const isSpeedValid = (speed, mode) => {
    const { MIN_SPEED, MAX_SPEED } = TRACKING_CONSTANTS[mode];

    if (speed < MIN_SPEED) {
        return false;
    }

    if (speed > MAX_SPEED) {
        return false;
    }

    return true;
};

// Accuracy değerlerinin standart sapmasını hesaplama
export const calculateAccuracyStdDev = (accuracyValues) => {
    if (accuracyValues.length < 2) return 0;

    const mean = accuracyValues.reduce((sum, val) => sum + val, 0) / accuracyValues.length;
    const squareDiffs = accuracyValues.map(value => Math.pow(value - mean, 2));
    const variance = squareDiffs.reduce((sum, val) => sum + val, 0) / accuracyValues.length;

    return Math.sqrt(variance);
};

// GPS kararlılığını kontrol etme - daha esnek hale getirelim
export const isGPSStable = (accuracyValues) => {
    if (accuracyValues.length < 2) return false; // En az 2 örnek yeterli

    // Son 3 ölçümün (veya mevcut tüm ölçümlerin) ortalaması
    const recentValues = accuracyValues.slice(-3);
    const avgAccuracy = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;

    // Son değer
    const lastAccuracy = accuracyValues[accuracyValues.length - 1];

    // Ya ortalama iyi ya da son değer iyi ise stabil kabul et
    return avgAccuracy <= GPS_ACCURACY.ACCEPTABLE || lastAccuracy <= GPS_ACCURACY.OPTIMAL;
};

// GPS kalitesini değerlendirme
export const evaluateGPSQuality = (accuracy) => {
    if (accuracy <= GPS_ACCURACY.OPTIMAL) {
        return 'OPTIMAL';
    } else if (accuracy <= GPS_ACCURACY.ACCEPTABLE) {
        return 'GOOD';
    } else if (accuracy <= GPS_ACCURACY.MAX_ACCEPTABLE) {
        return 'FAIR';
    } else {
        return 'POOR';
    }
};

// GPS ölçümünün kullanılabilir olup olmadığını kontrol etme
export const isGPSUsable = (accuracy, accuracyHistory) => {
    // Eğer accuracy değeri maksimum kabul edilebilir değerin üzerindeyse
    if (accuracy > GPS_ACCURACY.MAX_ACCEPTABLE) {
        return false;
    }

    // Kalibrasyon sürecinde mi?
    if (accuracyHistory.length < GPS_ACCURACY.SAMPLE_SIZE) {
        return false;
    }

    // GPS kararlı mı?
    return isGPSStable(accuracyHistory);
};

// Durağan durumu kontrol eden fonksiyonu tamamen yeniden yazalım
export const isStationary = (speedMs, lastLocations) => {
    // 1. Hız kontrolü - çok düşük hız durağan kabul edilir
    const isLowSpeed = speedMs <= MOVEMENT_CONSTANTS.STATIONARY_SPEED;

    // Eğer hız yüksekse kesinlikle hareket halinde
    if (!isLowSpeed) {
        return false;
    }

    // 2. Son konumlar kontrolü
    if (!lastLocations || lastLocations.length < MOVEMENT_CONSTANTS.STATIONARY_CHECK_COUNT) {
        // Yeterli veri yoksa, hız düşükse durağan kabul et
        return isLowSpeed;
    }

    // 3. Zaman kontrolü - son konumlar arasında yeterli zaman geçmiş mi?
    const lastLocation = lastLocations[lastLocations.length - 1];
    const firstLocation = lastLocations[0];
    const timeElapsed = new Date(lastLocation.timestamp) - new Date(firstLocation.timestamp);

    // Yeterli zaman geçmemişse, hız düşükse durağan kabul et
    if (timeElapsed < MOVEMENT_CONSTANTS.STATIONARY_TIME_THRESHOLD) {
        return isLowSpeed;
    }

    // 4. Mesafe kontrolü - son konumlar arasındaki toplam mesafe
    const totalDistance = haversine(
        firstLocation.latitude,
        firstLocation.longitude,
        lastLocation.latitude,
        lastLocation.longitude
    );

    // Hem hız düşük hem de mesafe az ise durağan
    return isLowSpeed && totalDistance < MOVEMENT_CONSTANTS.MIN_MOVEMENT_DISTANCE;
}; 