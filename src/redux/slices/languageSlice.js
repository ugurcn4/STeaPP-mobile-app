import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'app_language';

// AsyncStorage'dan dil ayarını yükle
export const loadLanguage = createAsyncThunk(
    'language/loadLanguage',
    async () => {
        try {
            const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
            return storedLanguage || 'tr'; // Varsayılan dil Türkçe
        } catch (error) {
            console.error('Dil yüklenirken hata oluştu:', error);
            return 'tr'; // Hata durumunda varsayılan dil
        }
    }
);

// Dil ayarını değiştir ve AsyncStorage'a kaydet
export const changeLanguage = createAsyncThunk(
    'language/changeLanguage',
    async (language) => {
        try {
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
            return language;
        } catch (error) {
            console.error('Dil kaydedilirken hata oluştu:', error);
            throw error;
        }
    }
);

const initialState = {
    language: 'tr', // Varsayılan dil Türkçe
    loading: false,
    error: null,
};

const languageSlice = createSlice({
    name: 'language',
    initialState,
    reducers: {
        setLanguage: (state, action) => {
            state.language = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loadLanguage.pending, (state) => {
                state.loading = true;
            })
            .addCase(loadLanguage.fulfilled, (state, action) => {
                state.loading = false;
                state.language = action.payload;
            })
            .addCase(loadLanguage.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            })
            .addCase(changeLanguage.fulfilled, (state, action) => {
                state.language = action.payload;
            });
    },
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer; 