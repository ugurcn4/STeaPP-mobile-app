import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CustomNavBar from '../components/CustomNavBar';
import NotificationPage from '../screens/SettingsPageScreens/NotificationPage';
import NotificationsListScreen from '../screens/NotificationsListScreen';
import PermissionsPage from '../screens/SettingsPageScreens/PermissionsPage';
import PrivacyPage from '../screens/SettingsPageScreens/PrivacyPage';
import HelpSupportPage from '../screens/SettingsPageScreens/HelpSupportPage';
import AboutPage from '../screens/SettingsPageScreens/AboutPage';
import InviteFriendsPage from '../screens/SettingsPageScreens/InviteFriendsPage';
import MaviTikSorgulamaPage from '../screens/SettingsPageScreens/MaviTikSorgulamaPage';
import STeaPPKatilanlarPage from '../screens/SettingsPageScreens/STeaPPKatilanlarPage';
import AnnouncementsPage from '../screens/SettingsPageScreens/AnnouncementsPage';
import NearbyRestaurants from '../screens/HomePageCards/NearbyRestaurants';
import NearbyHotels from '../screens/HomePageCards/NearbyHotels';
import NearbyAttractions from '../screens/HomePageCards/NearbyAttractions';
import AIRecommendationsScreen from '../screens/AIRecommendationsScreen';
import AIChatScreen from '../screens/AIChatScreen';
import StoryView from '../screens/StoryView';
import ActivitiesScreen from '../screens/ActivitiesScreen';
import ChatScreen from '../screens/ChatScreen';
import ImageViewer from '../screens/ImageViewer';
import CityExplorer from '../screens/CityExplorer';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import DirectMessagesScreen from '../screens/DirectMessagesScreen';
import StoryEditor from '../screens/StoryEditor';
import UpdatesPage from '../screens/SettingsPageScreens/UpdatesPage';
import { OnboardingScreen } from '../screens';
import CreatePostScreen from '../screens/CreatePostScreen';
import CreatePostDetails from '../screens/CreatePostDetails';
import LikedPostsScreen from '../screens/LikedPostsScreen';
import LikedByScreen from '../screens/LikedByScreen';
import ProfileModal from '../screens/ProfileModal';
import FriendProfileModal from '../modals/friendProfileModal';
import DilSecenekleriPage from '../screens/SettingsPageScreens/DilSecenekleriPage';
import NearbyToilets from '../screens/HomePageCards/NearbyToilets';
import GasStations from '../screens/HomePageCards/GasStations';
import Pharmacies from '../screens/HomePageCards/Pharmacies';
import SifremiDegistirPage from '../screens/SettingsPageScreens/SifremiDegistirPage';
import ForgotPasswordPage from '../screens/forgotPassword';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetail from '../screens/GroupDetailScreen';
import GroupsList from '../components/GroupsList';
import FriendRequestsScreen from "../screens/FriendRequestsScreen";
import AllMeetingsScreen from "../screens/AllMeetingsScreen";
import GroupInvitationsScreen from '../screens/GroupInvitationsScreen';
import LocationsScreen from '../screens/LocationsScreen';
import AllFriends from '../screens/AllFriends';


const Stack = createNativeStackNavigator();

const MessagesStack = createStackNavigator();

const MessagesNavigator = () => {
    return (
        <MessagesStack.Navigator
            screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: '#fff' },
                presentation: 'card',
                gestureEnabled: false,
            }}
        >
            <MessagesStack.Screen
                name="MessagesHome"
                component={DirectMessagesScreen}
            />
            <MessagesStack.Screen
                name="Chat"
                component={ChatScreen}
                options={{
                    presentation: 'card',
                    animationEnabled: true,
                    gestureEnabled: false,
                    cardStyle: { backgroundColor: '#EEE7DD' },
                    fullScreenGestureEnabled: false,
                }}
            />
        </MessagesStack.Navigator>
    );
};

// SettingsPageScreens Stack Navigator
const SettingsPageStack = createStackNavigator();

const SettingsPageScreensNavigator = () => {
    return (
        <SettingsPageStack.Navigator
            screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: '#fff' },
                presentation: 'card',
            }}
        >
            <SettingsPageStack.Screen name="Bildirimler" component={NotificationPage} />
            <SettingsPageStack.Screen name="Izinler" component={PermissionsPage} />
            <SettingsPageStack.Screen name="Gizlilik" component={PrivacyPage} />
            <SettingsPageStack.Screen name="YardimDestek" component={HelpSupportPage} />
            <SettingsPageStack.Screen name="Hakkinda" component={AboutPage} />
            <SettingsPageStack.Screen name="Arkadaşlarımı Davet Et" component={InviteFriendsPage} />
            <SettingsPageStack.Screen name="MaviTikSorgulama" component={MaviTikSorgulamaPage} />
            <SettingsPageStack.Screen name="Updates" component={UpdatesPage} />
            <SettingsPageStack.Screen name="DilSecenekleri" component={DilSecenekleriPage} />
            <SettingsPageStack.Screen name="SifremiDegistir" component={SifremiDegistirPage} />
            <SettingsPageStack.Screen name="STeaPPKatilanlar" component={STeaPPKatilanlarPage} />
            <SettingsPageStack.Screen name="Duyurular" component={AnnouncementsPage} />
        </SettingsPageStack.Navigator>
    );
};

const MainStack = () => {

    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false
            }}
        >
            <Stack.Screen name="MainTabs" component={CustomNavBar} />
            <Stack.Screen
                name="NearbyRestaurants"
                component={NearbyRestaurants}
            />
            <Stack.Screen
                name="NearbyHotels"
                component={NearbyHotels}
            />
            <Stack.Screen
                name="NearbyAttractions"
                component={NearbyAttractions}
            />
            <Stack.Screen
                name="Bildirimler"
                component={NotificationPage}
            />
            <Stack.Screen
                name="BildirimListesi"
                component={NotificationsListScreen}
                options={{
                    headerShown: true,
                    title: 'Bildirimler',
                    headerBackTitleVisible: false,
                }}
            />
            <Stack.Screen
                name="Izinler"
                component={PermissionsPage}
            />
            <Stack.Screen
                name="Gizlilik"
                component={PrivacyPage}
            />
            <Stack.Screen
                name="YardimDestek"
                component={HelpSupportPage}
            />
            <Stack.Screen
                name="Hakkinda"
                component={AboutPage}
            />
            <Stack.Screen
                name="Arkadaşlarımı Davet Et"
                component={InviteFriendsPage}
            />
            <Stack.Screen
                name="MaviTikSorgulama"
                component={MaviTikSorgulamaPage}
            />
            <Stack.Screen
                name="AIRecommendations"
                component={AIRecommendationsScreen}
            />
            <Stack.Screen
                name="AIChat"
                component={AIChatScreen}
                options={{
                    headerShown: false
                }}
            />
            <Stack.Screen
                name="StoryView"
                component={StoryView}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Activities"
                component={ActivitiesScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="DirectMessages"
                component={MessagesNavigator}
                options={{
                    headerShown: false,
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                    transitionSpec: {
                        open: {
                            animation: 'spring',
                            config: {
                                stiffness: 1000,
                                damping: 500,
                                mass: 3,
                                overshootClamping: true,
                                restDisplacementThreshold: 0.01,
                                restSpeedThreshold: 0.01,
                            }
                        },
                        close: {
                            animation: 'spring',
                            config: {
                                stiffness: 1000,
                                damping: 500,
                                mass: 3,
                                overshootClamping: true,
                                restDisplacementThreshold: 0.01,
                                restSpeedThreshold: 0.01,
                            }
                        },
                    },
                }}
            />
            <Stack.Screen
                name="ImageViewer"
                component={ImageViewer}
                options={{
                    headerShown: false,
                    presentation: 'modal',
                    cardStyle: { backgroundColor: 'black' }
                }}
            />
            <Stack.Screen
                name="CityExplorer"
                component={CityExplorer}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="StoryEditor"
                component={StoryEditor}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Updates"
                component={UpdatesPage}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
            />
            <Stack.Screen
                name="CreatePost"
                component={CreatePostScreen}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="CreatePostDetails"
                component={CreatePostDetails}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="LikedPosts"
                component={LikedPostsScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="LikedBy"
                component={LikedByScreen}
                options={{
                    headerShown: false,
                    presentation: 'transparentModal',
                    cardStyle: { backgroundColor: 'transparent' },
                    cardOverlayEnabled: true
                }}
            />
            <Stack.Screen
                name="ProfileModal"
                component={ProfileModal}
                options={{
                    headerShown: false,
                    presentation: 'modal',
                    cardStyle: { backgroundColor: 'white' },
                    cardOverlayEnabled: true,
                    animation: 'slide_from_bottom',
                    detachPreviousScreen: false
                }}
            />
            <Stack.Screen
                name="FriendProfileModal"
                component={FriendProfileModal}
                options={{
                    headerShown: false,
                    presentation: 'modal',
                    cardStyle: { backgroundColor: 'white' },
                    cardOverlayEnabled: true,
                    animation: 'slide_from_bottom'
                }}
            />
            <Stack.Screen
                name="DilSecenekleri"
                component={DilSecenekleriPage}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="NearbyToilets"
                component={NearbyToilets}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="GasStations"
                component={GasStations}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Pharmacies"
                component={Pharmacies}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="SifremiDegistir"
                component={SifremiDegistirPage}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordPage}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="CreateGroupScreen"
                component={CreateGroupScreen}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="GroupDetail"
                component={GroupDetail}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="GroupsList"
                component={GroupsList}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="FriendRequests"
                component={FriendRequestsScreen}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="GroupInvitations"
                component={GroupInvitationsScreen}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="AllMeetings"
                component={AllMeetingsScreen}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="Locations"
                component={LocationsScreen}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="AllFriends"
                component={AllFriends}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right'
                }}
            />
            <Stack.Screen
                name="SettingsPageScreens"
                component={SettingsPageScreensNavigator}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );

};

export default MainStack; 