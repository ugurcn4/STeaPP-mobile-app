import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet, 
  ScrollView, 
  Platform,
  KeyboardAvoidingView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TimeInput from './TimeInput';

const CreateEventModal = ({ visible, onClose, onCreate, groupId }) => {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState('12:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const resetForm = () => {
    setTitle('');
    setLocation('');
    setDescription('');
    setDate(new Date());
    setTime('12:00');
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  const handleCreateEvent = () => {
    // Form doğrulama
    if (!title.trim()) {
      Alert.alert('Hata', 'Lütfen etkinlik başlığı girin');
      return;
    }
    
    if (!location.trim()) {
      Alert.alert('Hata', 'Lütfen etkinlik konumu girin');
      return;
    }
    
    // Saat formatı kontrolü (XX:XX)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(time)) {
      Alert.alert('Hata', 'Lütfen geçerli bir saat formatı girin (örn: 14:30)');
      return;
    }
    
    // Etkinlik verisi oluştur
    const eventData = {
      title,
      location,
      description,
      date,
      time
    };
    
    // Etkinlik oluşturma fonksiyonunu çağır
    onCreate(eventData);
    
    // Formu sıfırla
    resetForm();
  };
  
  const formatDate = (date) => {
    return date.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.centeredView}
      >
        <View style={styles.modalView}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Yeni Etkinlik</Text>
            <TouchableOpacity 
              style={styles.createButton} 
              onPress={handleCreateEvent}
            >
              <Text style={styles.createButtonText}>Oluştur</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.formContainer}>
            {/* Etkinlik Başlığı */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Etkinlik Başlığı</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: Kahve Buluşması"
                placeholderTextColor="#9797A9"
                value={title}
                onChangeText={setTitle}
              />
            </View>
            
            {/* Etkinlik Konumu */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Konum</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: Starbucks Kadıköy"
                placeholderTextColor="#9797A9"
                value={location}
                onChangeText={setLocation}
              />
            </View>
            
            {/* Etkinlik Tarihi */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tarih</Text>
              <TouchableOpacity 
                style={styles.datePickerButton} 
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.datePickerText}>{formatDate(date)}</Text>
                <Ionicons name="calendar" size={20} color="#53B4DF" />
              </TouchableOpacity>
              
              
            </View>
            
            {/* Etkinlik Saati */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Saat</Text>
              <TimeInput
                value={time}
                onChangeText={setTime}
                containerStyle={styles.timeInputContainer}
              />
            </View>
            
            {/* Etkinlik Açıklaması */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Açıklama (İsteğe Bağlı)</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                placeholder="Etkinlik hakkında detaylı bilgi..."
                placeholderTextColor="#9797A9"
                value={description}
                onChangeText={setDescription}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    backgroundColor: '#252636',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#53B4DF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  formContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#32323E',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    paddingTop: 12,
  },
  datePickerButton: {
    backgroundColor: '#32323E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  datePickerText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  timeInputContainer: {
    backgroundColor: '#32323E',
    borderRadius: 8,
    padding: 4,
  },
});

export default CreateEventModal; 