import { Platform } from 'react-native';

// Android için uygulama ID'si (build.gradle'dan alınır)
export const ApplicationId = Platform.select({
    android: 'com.ugurrucr.STeaPP', // Geçici değer
    ios: 'com.ugurrucr.STeaPP'      // Geçici değer
});

// Diğer sabitler
export const APP_CONSTANTS = {
    APP_NAME: 'STeaPP',
    VERSION: '1.0.0',
    // ... diğer sabitler
}; 