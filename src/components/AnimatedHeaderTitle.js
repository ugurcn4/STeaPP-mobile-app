import React, { useState, useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

const AnimatedHeaderTitle = ({ messages = [], style = {} }) => {
  // Metin animasyonu değerleri - native driver kullanacak
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  // Renk animasyonu için değerler - native driver kullanmayacak
  const colorAnim = useRef(new Animated.Value(0)).current;
  
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentTextColor, setCurrentTextColor] = useState('#AE63E4');
  
  // Renkler arasında geçiş için interpolasyon
  const textColor = colorAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    outputRange: [
      '#AE63E4', // Mor
      '#FF8A80', // Kırmızı
      '#4DB6AC', // Yeşil
      '#FFB74D', // Turuncu
      '#64B5F6', // Mavi
      '#F48FB1', // Pembe
      '#B39DDB', // Lavanta
      '#4FC3F7', // Turkuaz
      '#AE63E4'  // Tekrar başa dön
    ]
  });
  
  // Renk değişikliklerini izle ve state'i güncelle
  useEffect(() => {
    const listener = textColor.addListener(({ value }) => {
      // value, animasyondaki anlık renk değeridir
      setCurrentTextColor(value);
    });
    
    return () => {
      textColor.removeListener(listener);
    };
  }, []);
  
  // Mesaj değiştirme animasyonu
  const changeWelcomeMessage = () => {
    // Önce mevcut mesajı soluklaştır
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: -10,
        duration: 500,
        useNativeDriver: true
      })
    ]).start(() => {
      // Ardından mesajı değiştir ve yeni mesajı görünür yap
      setCurrentMessageIndex((prevIndex) => 
        (prevIndex + 1) % messages.length
      );
      translateY.setValue(10);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        })
      ]).start();
    });
  };
  
  // Renk animasyonu - ayrı bir animation loop
  const animateColors = () => {
    // Renk değerini sıfırla
    colorAnim.setValue(0);
    
    // Sonsuz renk döngüsü
    Animated.timing(colorAnim, {
      toValue: 8,
      duration: 20000, // 20 saniye boyunca tüm renkleri döngü yap
      useNativeDriver: false
    }).start((finished) => {
      if (finished) {
        // Animasyon tamamlandı, tekrar başlat
        animateColors();
      }
    });
  };
  
  // Animasyonları başlat ve interval oluştur
  useEffect(() => {
    // Renk animasyonunu başlat
    animateColors();
    
    // 5 saniyede bir mesajı değiştir
    const messageIntervalId = setInterval(changeWelcomeMessage, 5000);
    
    return () => {
      clearInterval(messageIntervalId);
    };
  }, []);
  
  return (
    <View>
      <Animated.Text 
        style={[
          styles.titleText,
          {
            opacity: fadeAnim,
            transform: [{ translateY: translateY }],
            color: currentTextColor
          },
          style
        ]}
      >
        {messages[currentMessageIndex]}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  titleText: {
    fontSize: 24, 
    fontWeight: 'bold',
    marginRight: 'auto'
  }
});

export default AnimatedHeaderTitle; 