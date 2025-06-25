import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import LottieView from 'lottie-react-native';

const CapsuleButton = ({ onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.capsuleButton}
      onPress={onPress}
    >
      <View style={styles.animationContainer}>
        <LottieView
          source={require('../../assets/animations/bottle.json')}
          autoPlay
          loop
          style={styles.animation}
          speed={0.8}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  capsuleButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 8,
    overflow: 'hidden',
  },
  animationContainer: {
    width: 55,
    height: 55,
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 100,
    height: 100,
    marginBottom: -10,
  }
});

export default CapsuleButton; 