// Tanım: isLogged değerine göre Auth veya Logged'ı görüntüleyen kod
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { autoLogin } from '../redux/userSlice';
import { loadLanguage } from '../redux/slices/languageSlice';
import Auth from './Auth';
import MainStack from './MainStack';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { loadI18nLanguage } from '../i18n/i18n';

const Stack = createStackNavigator();

const RootPage = () => {
    const [loading, setLoading] = useState(true);
    const { isAuth } = useSelector((state) => state.user);
    const language = useSelector((state) => state.language.language);
    const dispatch = useDispatch();

    // Dil değiştiğinde i18n'i güncelle
    useEffect(() => {
        if (language) {
            loadI18nLanguage(language);
        }
    }, [language]);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                // Dil ayarlarını yükle - bunu paralel olarak yap
                const loadLanguagePromise = dispatch(loadLanguage());

                // Kullanıcı giriş yapmışsa, oturumu kontrol et
                let autoLoginPromise = Promise.resolve();
                if (user) {
                    // AsyncStorage işlemlerini paralel yap
                    const [userData, userToken] = await Promise.all([
                        AsyncStorage.getItem('userData'),
                        AsyncStorage.getItem('userToken')
                    ]);

                    if (userData && userToken) {
                        try {
                            autoLoginPromise = dispatch(autoLogin()).unwrap();
                        } catch (error) {
                            console.error('AutoLogin hatası:', error);
                        }
                    }
                }

                // Tüm işlemlerin tamamlanmasını bekle
                await Promise.all([loadLanguagePromise, autoLoginPromise]);
            } catch (error) {
                console.error('Oturum kontrolü hatası:', error);
            } finally {
                // Her durumda loading'i false yap
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [dispatch]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#2196F3" />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuth ? (
                <Stack.Screen name="Auth" component={Auth} />
            ) : (
                <Stack.Screen
                    name="MainStack"
                    component={MainStack}
                />
            )}
        </Stack.Navigator>
    );
};

export default RootPage;
