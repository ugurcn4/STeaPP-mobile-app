import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { format, isBefore, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const CustomDatePicker = ({ 
  selectedDate, 
  onDateChange,
  onConfirm,
  onCancel 
}) => {
  const today = new Date();
  const startOfToday = startOfDay(today);
  const maxDate = new Date(today.getFullYear() + 10, 11, 31);
  
  // Seçilen tarih bugünden önceyse, bugünü kullan
  const initialDate = isBefore(selectedDate, startOfToday) ? today : selectedDate;
  
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [currentDate, setCurrentDate] = useState(initialDate);

  // Seçilen tarihin geçerli olup olmadığını kontrol et
  useEffect(() => {
    const tempDate = new Date(selectedYear, selectedMonth, selectedDay);
    if (isBefore(tempDate, startOfToday)) {
      // Eğer geçmiş tarih seçildiyse bugüne ayarla
      if (selectedYear < today.getFullYear() || 
          (selectedYear === today.getFullYear() && selectedMonth < today.getMonth()) ||
          (selectedYear === today.getFullYear() && selectedMonth === today.getMonth() && selectedDay < today.getDate())) {
        setSelectedDay(today.getDate());
        setSelectedMonth(today.getMonth());
        setSelectedYear(today.getFullYear());
      }
    }
    setCurrentDate(new Date(selectedYear, selectedMonth, selectedDay));
  }, [selectedDay, selectedMonth, selectedYear]);

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const years = Array.from(
    { length: maxDate.getFullYear() - today.getFullYear() + 1 },
    (_, i) => today.getFullYear() + i
  );

  const isDateValid = (day, month, year) => {
    const date = new Date(year, month, day);
    return !isBefore(date, startOfToday);
  };

  const handleDayChange = (increment) => {
    const maxDays = getDaysInMonth(selectedYear, selectedMonth);
    let newDay = selectedDay + increment;
    
    if (newDay < 1) newDay = maxDays;
    if (newDay > maxDays) newDay = 1;
    
    // Bugün veya daha sonraki bir tarihi seçtiğimizden emin ol
    if (selectedYear === today.getFullYear() && 
        selectedMonth === today.getMonth() && 
        newDay < today.getDate()) {
      newDay = today.getDate();
    }
    
    setSelectedDay(newDay);
  };

  const handleMonthChange = (increment) => {
    let newMonth = selectedMonth + increment;
    let newYear = selectedYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear = selectedYear - 1;
    }
    if (newMonth > 11) {
      newMonth = 0;
      newYear = selectedYear + 1;
    }
    
    // Yıl değişiminin sınırlar içinde olduğundan emin ol
    if (newYear < today.getFullYear()) {
      newYear = today.getFullYear();
      newMonth = 0;
    }
    if (newYear > maxDate.getFullYear()) {
      newYear = maxDate.getFullYear();
      newMonth = 11;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    
    // Ay değiştiğinde gün sayısını kontrol et
    const maxDays = getDaysInMonth(newYear, newMonth);
    if (selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
    
    // Geçmiş bir aya gidersek (bu yıl içinde), günü bugüne ayarla
    if (newYear === today.getFullYear() && newMonth === today.getMonth() && selectedDay < today.getDate()) {
      setSelectedDay(today.getDate());
    }
  };

  const handleYearChange = (increment) => {
    const newYear = selectedYear + increment;
    if (newYear >= today.getFullYear() && newYear <= maxDate.getFullYear()) {
      setSelectedYear(newYear);
      
      // Yıl değiştiğinde geçmiş tarihe düşersek ayı ve günü düzenle
      if (newYear === today.getFullYear() && selectedMonth < today.getMonth()) {
        setSelectedMonth(today.getMonth());
        setSelectedDay(today.getDate());
      } else if (newYear === today.getFullYear() && selectedMonth === today.getMonth() && selectedDay < today.getDate()) {
        setSelectedDay(today.getDate());
      }
    }
  };

  const handleConfirm = () => {
    onConfirm(currentDate);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>İptal</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tarih Seç</Text>
        <TouchableOpacity onPress={handleConfirm} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.confirmText]}>Tamam</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.selectedDateContainer}>
        <Text style={styles.selectedDateText}>
          {format(currentDate, 'd MMMM yyyy', { locale: tr })}
        </Text>
        {selectedYear === today.getFullYear() && selectedMonth === today.getMonth() && (
          <Text style={styles.minDateHint}>
            En erken bugün seçilebilir
          </Text>
        )}
      </View>

      <View style={styles.pickerContainer}>
        {/* Gün Seçici */}
        <View style={styles.pickerColumn}>
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={() => handleDayChange(1)}
          >
            <Ionicons name="chevron-up" size={24} color="#666" />
          </TouchableOpacity>
          
          <Text style={styles.valueText}>{selectedDay}</Text>
          
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={() => handleDayChange(-1)}
          >
            <Ionicons name="chevron-down" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Ay Seçici */}
        <View style={[styles.pickerColumn, styles.monthColumn]}>
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={() => handleMonthChange(1)}
          >
            <Ionicons name="chevron-up" size={24} color="#666" />
          </TouchableOpacity>
          
          <Text style={styles.valueText}>{months[selectedMonth]}</Text>
          
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={() => handleMonthChange(-1)}
          >
            <Ionicons name="chevron-down" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Yıl Seçici */}
        <View style={styles.pickerColumn}>
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={() => handleYearChange(1)}
          >
            <Ionicons name="chevron-up" size={24} color="#666" />
          </TouchableOpacity>
          
          <Text style={styles.valueText}>{selectedYear}</Text>
          
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={() => handleYearChange(-1)}
          >
            <Ionicons name="chevron-down" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#666',
  },
  confirmText: {
    color: '#333',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  selectedDateContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#f8f9fa',
  },
  selectedDateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  minDateHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerColumn: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  monthColumn: {
    minWidth: 120,
  },
  arrowButton: {
    padding: 12,
  },
  valueText: {
    fontSize: 22,
    color: '#333',
    fontWeight: '500',
    marginVertical: 8,
  },
});

export default CustomDatePicker; 