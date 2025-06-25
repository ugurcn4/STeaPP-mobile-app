export const LocationTypes = {
    INSTANT: 'instant',
    LIVE: 'live',
    STATIC: 'static',
    HISTORY: 'history'
};

export const LocationStatus = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    STOPPED: 'stopped',
    EXPIRED: 'expired'
};

export const LocationPermissionStatus = {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined'
};

export const LocationAccuracy = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    BEST: 'best'
};

export const LocationUpdateInterval = {
    REALTIME: 1000,      // 1 saniye
    FREQUENT: 5000,      // 5 saniye
    NORMAL: 10000,       // 10 saniye
    BATTERY_SAVING: 30000 // 30 saniye
};

export const LocationSharingDuration = {
    SHORT: 15 * 60 * 1000,     // 15 dakika
    MEDIUM: 60 * 60 * 1000,    // 1 saat
    LONG: 4 * 60 * 60 * 1000,  // 4 saat
    EXTENDED: 24 * 60 * 60 * 1000 // 24 saat
};

export const LocationErrorCodes = {
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
    TIMEOUT: 'TIMEOUT',
    PLAY_SERVICES_UNAVAILABLE: 'PLAY_SERVICES_UNAVAILABLE',
    SETTINGS_NOT_SATISFIED: 'SETTINGS_NOT_SATISFIED',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

export const LocationErrorMessages = {
    [LocationErrorCodes.PERMISSION_DENIED]: 'Konum izni reddedildi',
    [LocationErrorCodes.POSITION_UNAVAILABLE]: 'Konum bilgisi alınamıyor',
    [LocationErrorCodes.TIMEOUT]: 'Konum isteği zaman aşımına uğradı',
    [LocationErrorCodes.PLAY_SERVICES_UNAVAILABLE]: 'Google Play Servisleri kullanılamıyor',
    [LocationErrorCodes.SETTINGS_NOT_SATISFIED]: 'Konum ayarları yetersiz',
    [LocationErrorCodes.INTERNAL_ERROR]: 'Dahili bir hata oluştu'
};

export default {
    LocationTypes,
    LocationStatus,
    LocationPermissionStatus,
    LocationAccuracy,
    LocationUpdateInterval,
    LocationSharingDuration,
    LocationErrorCodes,
    LocationErrorMessages
}; 