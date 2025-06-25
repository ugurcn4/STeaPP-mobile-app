import { I18n } from 'i18n-js';
import * as RNLocalize from 'react-native-localize';
import { store } from '../redux/store';

// Dil dosyalarını import et
import tr from './locales/tr';
import en from './locales/en';
import de from './locales/de';
import es from './locales/es';

// Kullanılabilir dilleri tanımla
const translations = {
    tr,
    en,
    de,
    es,
};

// Varsayılan dil ayarları
const fallback = { languageTag: 'tr', isRTL: false };

// Kullanıcının cihaz dilini al
const getDeviceLocale = () => {
    const locales = RNLocalize.getLocales();
    const defaultLocale = locales[0];

    if (defaultLocale) {
        const languageCode = defaultLocale.languageTag.split('-')[0]; // 'en-US' -> 'en'

        // Eğer desteklenen bir dil ise kullan, değilse varsayılan dil
        if (translations[languageCode]) {
            return { languageTag: languageCode, isRTL: defaultLocale.isRTL };
        }
    }

    return fallback;
};

// i18n örneği oluştur
const i18n = new I18n(translations);

// Dil yükle fonksiyonu
export const loadI18nLanguage = (forceLang = null) => {
    // Redux store'dan dil ayarını al veya force edilen dili kullan
    const state = store.getState();
    const storedLang = state?.language?.language;

    // Kullanılacak dil: 1. Force edilen, 2. Redux'ta saklanmış, 3. Cihaz dili
    const langToUse = forceLang || storedLang || getDeviceLocale().languageTag;

    // i18n ayarlarını güncelle
    i18n.locale = langToUse;
    i18n.enableFallback = true;
    i18n.defaultLocale = 'tr';

    return langToUse;
};

// Mevcut aktif dili getiren fonksiyon
export const getCurrentLanguage = () => {
    // Redux store'dan mevcut dil ayarını al
    const state = store.getState();
    const storedLang = state?.language?.language;
    
    // Eğer Redux'ta dil ayarı varsa onu kullan, yoksa i18n'in mevcut dilini veya varsayılan dili kullan
    return storedLang || i18n.locale || 'tr';
};

// Dili hemen yükle
loadI18nLanguage();

// Çeviri fonksiyonunu export et
export const translate = (key, params = {}) => {
    return i18n.t(key, params);
};

export default i18n; 