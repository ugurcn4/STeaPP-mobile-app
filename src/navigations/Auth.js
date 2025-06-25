import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignupPage, LoginPage, OnboardingScreen } from '../screens/index.js'
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ForgotPassword from '../screens/forgotPassword.js';
import PermissionsPage from '../screens/SettingsPageScreens/PermissionsPage';
import PrivacyPage from '../screens/SettingsPageScreens/PrivacyPage';
import HelpSupportPage from '../screens/SettingsPageScreens/HelpSupportPage';
import AboutPage from '../screens/SettingsPageScreens/AboutPage';
import InviteFriendsPage from '../screens/SettingsPageScreens/InviteFriendsPage';
import NearbyRestaurants from '../screens/HomePageCards/NearbyRestaurants';

const Stack = createNativeStackNavigator();

// Onboarding tamamlandı kontrolü için kullanacağımız aynı anahtar
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

const Auth = () => {
    const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkIfOnboardingCompleted();
    }, []);

    const checkIfOnboardingCompleted = async () => {
        try {
            const onboardingCompleted = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
            setIsOnboardingCompleted(onboardingCompleted === 'true');
            setLoading(false);
        } catch (error) {
            console.error('Onboarding kontrolü hatası:', error);
            setIsOnboardingCompleted(false);
            setLoading(false);
        }
    };

    if (loading) {
        return null; // Loading sırasında boş ekran göster
    }

    return (
        <Stack.Navigator
            initialRouteName={isOnboardingCompleted ? "Giriş Yap" : "Onboarding"}
            screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Giriş Yap" component={LoginPage} />
            <Stack.Screen name="Kayıt Ol" component={SignupPage} />
            <Stack.Screen name="ForgotPassword" component={ForgotPassword} options={{ title: 'Şifremi Unuttum' }} />
            <Stack.Screen
                name="Izinler"
                component={PermissionsPage}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="Gizlilik"
                component={PrivacyPage}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="YardimDestek"
                component={HelpSupportPage}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="Hakkinda"
                component={AboutPage}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="Arkadaşlarımı Davet Et"
                component={InviteFriendsPage}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="NearbyRestaurants"
                component={NearbyRestaurants}
                options={{
                    title: 'Yakındaki Restoranlar',
                    headerStyle: {
                        backgroundColor: '#fff',
                    },
                    headerTintColor: '#2C3E50',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }}
            />
        </Stack.Navigator>
    )
}

export default Auth

