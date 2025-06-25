import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomePage, FriendsPage, MapPage, SettingsPage, ActivitiesScreen } from '../screens';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { translate } from '../i18n/i18n';
import { LinearGradient } from 'expo-linear-gradient';
const Tab = createBottomTabNavigator();

const CustomNavBar = () => {
    return (
        <Tab.Navigator
            initialRouteName={translate('home')}
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === translate('home')) {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === translate('map')) {
                        iconName = focused ? 'map' : 'map-outline';
                    } else if (route.name === translate('friends')) {
                        iconName = focused ? 'people' : 'people-outline';
                    } else if (route.name === translate('feed')) {
                        iconName = focused ? 'flame' : 'flame-outline';
                    } else if (route.name === translate('settings')) {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }

                    if (route.name === translate('home')) {
                        return (
                            <View style={[
                                styles.iconContainer,
                                styles.homeIconContainer,
                                focused && styles.activeHomeIconContainer
                            ]}>
                                {focused ? (
                                    <LinearGradient
                                        colors={['#9C27B0', '#673AB7']}
                                        style={styles.gradientBackground}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons 
                                            name={iconName} 
                                            size={32} 
                                            color="#FFFFFF" 
                                        />
                                    </LinearGradient>
                                ) : (
                                    <Ionicons 
                                        name={iconName} 
                                        size={28} 
                                        color="#7E57C2" 
                                    />
                                )}
                            </View>
                        );
                    }

                    return (
                        <View style={[
                            styles.iconContainer,
                            focused ? styles.activeIconContainer : null,
                        ]}>
                            <Ionicons 
                                name={iconName} 
                                size={focused ? 24 : 22} 
                                color={color} 
                            />
                            {route.name === translate('settings') && (
                                <View style={styles.newBadgeContainer}>
                                    <Text style={styles.newBadgeText}>{translate('new')}</Text>
                                </View>
                            )}
                        </View>
                    );
                },
                tabBarActiveTintColor: '#000000',
                tabBarInactiveTintColor: '#9E9E9E',
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    elevation: 8,
                    height: Platform.OS === 'ios' ? 85 : 65,
                    shadowColor: '#000',
                    shadowOffset: {
                        width: 0,
                        height: 2,
                    },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    borderTopWidth: 1,
                    borderTopColor: '#f0f0f0',
                    paddingHorizontal: 5,
                    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
                    paddingTop: 3,
                },
                tabBarItemStyle: {
                    paddingVertical: 6,
                    height: 46,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    marginTop: 2,
                    marginBottom: Platform.OS === 'ios' ? 4 : 2,
                },
                headerShown: false,
                tabBarShowLabel: true,
            })}
        >
            <Tab.Screen name={translate('friends')} component={FriendsPage} />
            <Tab.Screen name={translate('map')} component={MapPage} />
            <Tab.Screen name={translate('home')} component={HomePage} />
            <Tab.Screen name={translate('feed')} component={ActivitiesScreen} />
            <Tab.Screen name={translate('settings')} component={SettingsPage} />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 30,
        borderRadius: 15,
        marginTop: 5,
    },
    activeIconContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    homeIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginTop: -20,
        backgroundColor: '#E1BEE7',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    activeHomeIconContainer: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    gradientBackground: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newBadgeContainer: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: 'red',
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'white',
    },
    newBadgeText: {
        color: 'white',
        fontSize: 8,
        fontWeight: 'bold',
    }
});

export default CustomNavBar;