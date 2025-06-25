import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { getCurrentUserUid } from '../services/friendFunctions';
import { createGroup } from '../services/groupService';
import { translate } from '../i18n/i18n';

// Grup simgeleri seçenekleri
const ICON_OPTIONS = [
  'users', 'user-friends', 'beer', 'coffee', 'utensils', 'gamepad', 
  'film', 'music', 'book', 'graduation-cap', 'plane', 'car', 'futbol', 
  'basketball-ball', 'volleyball-ball', 'running', 'hiking', 'dumbbell', 
  'home', 'building', 'briefcase', 'baby', 'heart'
];

// Grup renk seçenekleri
const COLOR_OPTIONS = [
  '#53B4DF', // Mavi
  '#4CAF50', // Yeşil
  '#FFAC30', // Turuncu
  '#FF4136', // Kırmızı
  '#AE63E4', // Mor
  '#FF5722', // Tuğla
  '#009688', // Turkuaz
  '#3F51B5', // İndigo
  '#795548', // Kahverengi
  '#607D8B', // Gri Mavi
];

const { width } = Dimensions.get('window');

const CreateGroupScreen = ({ navigation, route }) => {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('users');
  const [selectedColor, setSelectedColor] = useState('#53B4DF');
  const [loading, setLoading] = useState(false);
  
  // Route üzerinden gelen callback varsa kullan
  const onGroupCreated = route.params?.onGroupCreated;
  
  const handleCreateGroup = async () => {
    // Doğrulama
    if (!groupName.trim()) {
      Alert.alert('Hata', translate('error_empty_group_name'));
      return;
    }
    
    try {
      setLoading(true);
      
      // Kullanıcı ID'sini al
      const uid = await getCurrentUserUid();
      if (!uid) {
        Alert.alert('Hata', translate('error_user_data'));
        setLoading(false);
        return;
      }
      
      // Grup verisi
      const groupData = {
        name: groupName,
        description: groupDescription,
        icon: selectedIcon,
        color: selectedColor
      };
      
      // Grup oluştur
      const newGroup = await createGroup(groupData, uid);
      
      // Başarılı mesajı
      Alert.alert(
        translate('success'),
        translate('success_group_created'),
        [{ 
          text: translate('success_button'), 
          onPress: () => {
            // Navigation geçmişini temizleyip ana sayfaya dönüş
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs', params: { screen: 'Arkadaşlar' } }],
            });
          }
        }]
      );
    } catch (error) {
      console.error(translate('error_creating_group'), error);
      Alert.alert('Hata', translate('error_creating_group'));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1A1A25" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{translate('create_group_title')}</Text>
        <TouchableOpacity 
          style={[
            styles.createButton,
            !groupName.trim() && styles.disabledButton
          ]}
          onPress={handleCreateGroup}
          disabled={!groupName.trim() || loading}
        >
          <Text style={styles.createButtonText}>{translate('create_group_button')}</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Grup Ön İzleme */}
        <View style={styles.previewContainer}>
          <View style={[styles.groupIconPreview, { backgroundColor: selectedColor }]}>
            <FontAwesome5 name={selectedIcon} size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.previewName}>
            {groupName || translate('create_group_preview_name')}
          </Text>
          {groupDescription ? (
            <Text style={styles.previewDescription}>{groupDescription}</Text>
          ) : null}
        </View>
        
        {/* Form */}
        <View style={styles.formContainer}>
          {/* Grup Adı */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{translate('create_group_name_label')}</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder={translate('create_group_name_placeholder')}
                placeholderTextColor="#9797A9"
                value={groupName}
                onChangeText={setGroupName}
                maxLength={50}
              />
            </View>
          </View>
          
          {/* Grup Açıklaması */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{translate('create_group_description_label')}</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={translate('create_group_description_placeholder')}
                placeholderTextColor="#9797A9"
                value={groupDescription}
                onChangeText={setGroupDescription}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>
          </View>
          
          {/* Grup Simgesi */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{translate('create_group_icon_label')}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iconOptionsContainer}
            >
              {ICON_OPTIONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    { backgroundColor: selectedColor },
                    selectedIcon === icon && styles.selectedIconOption
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <FontAwesome5 name={icon} size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {/* Grup Rengi */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{translate('create_group_color_label')}</Text>
            <View style={styles.colorOptionsContainer}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    selectedColor === color && styles.selectedColorOption,
                    { backgroundColor: color }
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
          </View>
        </View>
        
        {/* Alt boşluk */}
        <View style={styles.bottomPadding} />
      </ScrollView>
      
      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={selectedColor} />
            <Text style={styles.loadingText}>{translate('create_group_loading')}</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A25',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#232333',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#53B4DF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#53B4DF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  disabledButton: {
    backgroundColor: 'rgba(83, 180, 223, 0.4)',
    shadowOpacity: 0,
    elevation: 0,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  previewContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#232333',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  groupIconPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  previewName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  previewDescription: {
    color: '#CDCDCD',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
  formContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 10,
    marginLeft: 4,
  },
  inputWrapper: {
    backgroundColor: '#232333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textInput: {
    color: '#FFFFFF',
    padding: 14,
    fontSize: 16,
    borderRadius: 12,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  iconOptionsContainer: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  selectedIconOption: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  colorOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    borderWidth: 0,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 20, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#232333',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: width * 0.7,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
});

export default CreateGroupScreen; 