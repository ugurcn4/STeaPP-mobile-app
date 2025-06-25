import { StyleSheet } from 'react-native';

export const splashScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '50%', // Logo boyutunu küçülttük
    height: '50%',
    resizeMode: 'contain',
    borderRadius: 20, // Kenarları yuvarlatma
  },
}); 