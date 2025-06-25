import React from 'react';
import { View, Image } from 'react-native';
import { splashScreenStyles } from '../styles/SplashScreen';

const CustomSplashScreen = () => {
  return (
    <View style={splashScreenStyles.container}>
      <Image
        source={require('../../assets/images/logo.png')}
        style={splashScreenStyles.image}
      />
    </View>
  );
};

export default CustomSplashScreen; 