import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput } from 'react-native';
import styles from '../styles/MeetingDetailModalStyles';

const TimeInput = ({ value, onChangeText }) => {
  // Referansları oluştur
  const hourInputRef = useRef(null);
  const minuteInputRef = useRef(null);

  // Dahili state'ler - kullanıcının göreceği değerler
  const [hourDisplay, setHourDisplay] = useState('');
  const [minuteDisplay, setMinuteDisplay] = useState('');

  // Dışarıdan gelen değer değiştiğinde
  useEffect(() => {
    if (value && typeof value === 'string') {
      const parts = value.split(':');
      if (parts.length === 2) {
        // Gösterilen değerleri güncelle, ama formatlamadan
        setHourDisplay(parts[0].replace(/^0+/, '') || '');  // Baştaki sıfırları kaldır
        setMinuteDisplay(parts[1].replace(/^0+/, '') || '');  // Baştaki sıfırları kaldır
      }
    }
  }, [value]);

  // Saat değiştiğinde
  const onHourChange = (text) => {
    // Sadece rakamları kabul et
    const filteredText = text.replace(/[^0-9]/g, '');
    
    // Değer 0-23 arasında olmalı
    const numValue = parseInt(filteredText, 10);
    if (filteredText === '' || (numValue >= 0 && numValue <= 23)) {
      // Gösterilen değeri güncelle
      setHourDisplay(filteredText);
      
      // Eğer 2 rakam girildiyse dakika inputuna geç
      if (filteredText.length === 2) {
        minuteInputRef.current?.focus();
      }
      
      // Parent bileşene bildir
      notifyParent(filteredText, minuteDisplay);
    }
  };

  // Dakika değiştiğinde
  const onMinuteChange = (text) => {
    // Sadece rakamları kabul et
    const filteredText = text.replace(/[^0-9]/g, '');
    
    // Değer 0-59 arasında olmalı
    const numValue = parseInt(filteredText, 10);
    if (filteredText === '' || (numValue >= 0 && numValue <= 59)) {
      // Gösterilen değeri güncelle
      setMinuteDisplay(filteredText);
      
      // Parent bileşene bildir
      notifyParent(hourDisplay, filteredText);
    }
  };

  // Parent bileşene formatlanmış değeri bildir
  const notifyParent = (hour, minute) => {
    // Boş değilse formatla
    let formattedTime = '';
    
    if (hour !== '' || minute !== '') {
      const hourVal = hour === '' ? '00' : hour.length === 1 ? `0${hour}` : hour;
      const minuteVal = minute === '' ? '00' : minute.length === 1 ? `0${minute}` : minute;
      formattedTime = `${hourVal}:${minuteVal}`;
      onChangeText(formattedTime);
    }
  };

  return (
    <View style={styles.timeInputContainer}>
      <TextInput
        ref={hourInputRef}
        style={styles.timeInputField}
        placeholder="00"
        placeholderTextColor="#9797A9"
        value={hourDisplay}
        onChangeText={onHourChange}
        keyboardType="numeric"
        maxLength={2}
        selectTextOnFocus
      />
      <Text style={styles.timeInputSeparator}>:</Text>
      <TextInput
        ref={minuteInputRef}
        style={styles.timeInputField}
        placeholder="00"
        placeholderTextColor="#9797A9"
        value={minuteDisplay}
        onChangeText={onMinuteChange}
        keyboardType="numeric"
        maxLength={2}
        selectTextOnFocus
      />
    </View>
  );
};

export default TimeInput; 