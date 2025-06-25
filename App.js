import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { store } from './src/redux/store';
import RootPage from './src/navigations/RootPage';
import { AppState, Platform, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { updateOnlineStatus } from './src/services/onlineStatusService';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

// Native splash screen'i başlangıçta tut
SplashScreen.preventAutoHideAsync();

// Bildirim işleyicisini yapılandır
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Platform.OS === 'android' ? Notifications.AndroidNotificationPriority.MAX : undefined,
    vibrationPattern: Platform.OS === 'android' ? [0, 250, 250, 250] : undefined,
  }),
});

// Global bir değişken ile güncelleme durumunu takip edelim
global.updateDownloaded = false;

const Stack = createNativeStackNavigator();
const navigationRef = React.createRef();

// Bildirim navigasyonu için helper fonksiyon
const navigate = (screen, params) => {
  navigationRef.current?.navigate(screen, params);
};


const App = () => {
  const [appState, setAppState] = useState(AppState.currentState);
  const [isConnected, setIsConnected] = useState(true);
  const [previousUser, setPreviousUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const currentUserRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const netInfoUnsubscribeRef = useRef(null);
  const appStateUnsubscribeRef = useRef(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Online durumu güncelleme fonksiyonu
  const updateUserOnlineStatus = async (uid, status) => {
    try {
      if (uid && isAuthenticated && uid === currentUserRef.current) {
        await updateOnlineStatus(uid, status);
      }
    } catch (error) {
      console.warn('Kullanıcı durumu güncellenirken hata:', error.message);
    }
  };

  // Splash screen'i gizle
  useEffect(() => {
    async function hideSplash() {
      try {
        if (isAppReady) {
          await SplashScreen.hideAsync();
        }
      } catch (error) {
        console.warn('Splash screen gizlenirken hata:', error);
      }
    }
    hideSplash();
  }, [isAppReady]);

  // Önbellekten kullanıcı verilerini yükle
  const loadCachedUserData = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('user_data');
      if (cachedData) {
        const data = JSON.parse(cachedData);
        // Önbellek süresini kontrol et (24 saat)
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.warn('Önbellek verisi yüklenirken hata:', error);
      return false;
    }
  };

  // Kullanıcı verilerini yükle
  const fetchUserData = async (user) => {
    try {
      if (user) {
        // Kullanıcı verilerini önbelleğe kaydet
        const userData = {
          uid: user.uid,
          email: user.email,
          timestamp: Date.now()
        };
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        
        // Kullanıcı durumunu güncelle
        currentUserRef.current = user.uid;
        setPreviousUser(user.uid);
        setIsAuthenticated(true);

        // İnternet bağlantısını dinle
        netInfoUnsubscribeRef.current = NetInfo.addEventListener(async state => {
          setIsConnected(state.isConnected);
          if (appState === 'active' && isAuthenticated) {
            await updateUserOnlineStatus(user.uid, state.isConnected);
          }
        });

        // Uygulama durumunu dinle
        appStateUnsubscribeRef.current = AppState.addEventListener('change', handleAppStateChange);

        // Online durumunu güncelle
        const shouldBeOnline = appState === 'active' && isConnected;
        await updateOnlineStatus(user.uid, shouldBeOnline);
      }
    } catch (error) {
      console.error('Kullanıcı verileri yüklenirken hata:', error);
      throw error;
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUserId(user.uid);
          
          // Önce önbellekten verileri yüklemeyi dene
          await loadCachedUserData();
          
          // Verileri hemen güncelle
          await fetchUserData(user);
          
          // İzinleri iste
          await requestPermissions();
        }
      } catch (error) {
        console.error('Veri yükleme hatası:', error);
      } finally {
        // Her durumda loading'i false yap ve app'i hazır hale getir
        setLoading(false);
        setIsAppReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // İzinleri iste
  const requestPermissions = async () => {
    try {
      // Konum izni iste
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        console.warn('Konum izni verilmedi');
      }

      // Bildirim izni iste
      const { status: notificationStatus } = await Notifications.getPermissionsAsync();
      if (notificationStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Bildirim izni verilmedi');
        }
      }
    } catch (error) {
      console.warn('İzinler istenirken hata:', error);
    }
  };

  // AppState değişikliklerini işle
  const handleAppStateChange = async (nextAppState) => {
    if (!isAuthenticated || !currentUserRef.current) {
      return;
    }

    setAppState(nextAppState);
    const isActive = nextAppState === 'active';

    try {
      await updateOnlineStatus(currentUserRef.current, isActive && isConnected);
    } catch (error) {
      console.warn('Kullanıcı durumu güncellenirken hata:', error.message);
    }
  };

  // Bildirim tıklama işlemini yönetme fonksiyonu
  const handleNotificationResponse = (response) => {
    const { notification } = response;
    const data = notification.request.content.data;

    if (data && data.screen && data.openScreen) {
      if (isAuthenticated) {
        navigate(data.screen, data.params);
      } else {
        global.pendingNotificationNavigation = {
          screen: data.screen,
          params: data.params
        };
      }
    }
  };

  // Bildirimleri yapılandır
  useEffect(() => {
    let notificationResponseListener = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    
    let notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        console.log('Bildirim alındı:', notification);
      }
    );

    // Bekleyen yönlendirme varsa ve kullanıcı oturum açmışsa yönlendirme yap
    if (isAuthenticated && global.pendingNotificationNavigation) {
      const { screen, params } = global.pendingNotificationNavigation;
      navigate(screen, params);
      global.pendingNotificationNavigation = null;
    }

    return () => {
      if (notificationResponseListener) {
        Notifications.removeNotificationSubscription(notificationResponseListener);
      }
      if (notificationListener) {
        Notifications.removeNotificationSubscription(notificationListener);
      }
    };
  }, [isAuthenticated]);

  if (!isAppReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator>
            <Stack.Screen
              name="RootPage"
              component={RootPage}
              options={{
                headerShown: false,
                presentation: 'fullScreenModal'
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <Toast />
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;