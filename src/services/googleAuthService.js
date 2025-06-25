import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { socialLogin } from '../redux/userSlice';
import { Platform } from 'react-native';

// Google kimlik doğrulama konfigürasyonu ve hook'u
export const useGoogleAuth = () => {
    // Platform'a göre yönlendirme URI'sini belirle
    const redirectUriBase = 'https://auth.expo.io/@ugurrucr/steapp';
    // iOS için scheme, Google Console'da kayıtlı olması gereken URL
    const iosScheme = 'com.googleusercontent.apps.54620040129-glhj2871msevbkcd3iklvdte1ebinc0c';
    const iosRedirectUri = `${iosScheme}:/oauth2redirect/google`;

    const platformRedirectUri = Platform.OS === 'ios' ? iosRedirectUri : redirectUriBase;

    // Google auth konfigürasyonu
    const config = {
        expoClientId: '54620040129-9cvtj7tf0ip5cvn2hep20npkbfsoot22.apps.googleusercontent.com',
        iosClientId: '54620040129-glhj2871msevbkcd3iklvdte1ebinc0c.apps.googleusercontent.com',
        androidClientId: '54620040129-4ut099hugsmt28pbcfe35cbhek0ss4hp.apps.googleusercontent.com',
        webClientId: '54620040129-46rosg3tqonq5srhh1dbd8v1j9dec21o.apps.googleusercontent.com',
        redirectUri: platformRedirectUri,
        scopes: ['profile', 'email'],
        responseType: ResponseType.Code,
        useProxy: Platform.OS !== 'ios' // iOS'ta proxy kullanma
    };

    // Hook'u çağır ve sonucu döndür
    const [request, response, promptAsync] = Google.useAuthRequest(config);

    return {
        request,
        response,
        promptAsync
    };
};

// Google ile giriş yapma fonksiyonu
export const handleGoogleLogin = async (token, dispatch) => {

    try {
        const auth = getAuth();

        const credential = GoogleAuthProvider.credential(null, token);

        const userCredential = await signInWithCredential(auth, credential);

        const firebaseToken = await userCredential.user.getIdToken();

        const userDataToStore = {
            token: firebaseToken,
            user: {
                uid: userCredential.user.uid,
                email: userCredential.user.email,
                emailVerified: userCredential.user.emailVerified,
                username: userCredential.user.displayName || userCredential.user.email?.split('@')[0]
            }
        };

        await AsyncStorage.setItem('userToken', firebaseToken);
        await AsyncStorage.setItem('userData', JSON.stringify(userDataToStore));

        // Redux action'ı çağırma
        await dispatch(socialLogin(userDataToStore)).unwrap();

        Toast.show({
            type: 'success',
            text1: 'Başarılı',
            text2: 'Google hesabınız ile giriş yapıldı',
            position: 'top',
        });

        return userDataToStore;
    } catch (error) {
        console.error('Google giriş hatası:', error);

        Toast.show({
            type: 'error',
            text1: 'Giriş Başarısız',
            text2: 'Google ile giriş yapılırken bir hata oluştu',
            position: 'top',
        });

        throw error;
    }
}; 