import React, { useState, useEffect } from 'react';
import {
    View,
    TextInput,
    FlatList,
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { searchTracks, getPopularTracks } from '../services/musicService';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import debounce from 'lodash/debounce';
import { LinearGradient } from 'expo-linear-gradient';

const MusicPicker = ({ onSelect, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null);

    // Ses ayarlarını başlat
    useEffect(() => {
        const setupAudio = async () => {
            try {
                await Audio.setAudioModeAsync({
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: true,
                });
            } catch (error) {
                console.error('Ses ayarları yapılamadı:', error);
            }
        };

        setupAudio();
    }, []);

    // Ses kaynağını temizle
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    // Başlangıçta popüler şarkıları yükle
    useEffect(() => {
        const loadPopularTracks = async () => {
            setIsLoading(true);
            try {
                const results = await getPopularTracks();
                setSearchResults(results);
            } catch (error) {
                console.error('Popüler şarkılar yüklenemedi:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadPopularTracks();
    }, []);

    const debouncedSearch = debounce(async (query) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const results = await searchTracks(query);
            setSearchResults(results);
        } catch (error) {
            console.error('Müzik arama hatası:', error);
            Alert.alert('Hata', 'Müzik aranırken bir sorun oluştu.');
        } finally {
            setIsLoading(false);
        }
    }, 300);

    useEffect(() => {
        return () => {
            debouncedSearch.cancel();
        };
    }, []);

    const handleSearch = (query) => {
        setSearchQuery(query);
        debouncedSearch(query);
    };

    const handleSelect = async (track) => {
        setSelectedTrack(track);
        onSelect(track);

        // Çalan müziği durdur
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
            setIsPlaying(false);
            setCurrentlyPlayingId(null);
        }
    };

    const handlePlayPreview = async (track) => {
        try {
            // Eğer aynı şarkı çalıyorsa durdur
            if (currentlyPlayingId === track.id && sound && isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
                return;
            }

            // Eğer başka bir şarkı çalıyorsa onu durdur
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
                setIsPlaying(false);
            }

            if (!track.previewUrl) {
                Alert.alert('Uyarı', 'Bu şarkı için önizleme mevcut değil.');
                return;
            }

            // Yeni şarkıyı yükle ve çal
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: track.previewUrl },
                { shouldPlay: true },
                onPlaybackStatusUpdate
            );

            setSound(newSound);
            setIsPlaying(true);
            setCurrentlyPlayingId(track.id);
        } catch (error) {
            console.error('Müzik çalma hatası:', error);
            Alert.alert('Hata', 'Müzik çalınırken bir sorun oluştu. Lütfen internet bağlantınızı kontrol edin.');
        }
    };

    // Çalma durumunu takip et
    const onPlaybackStatusUpdate = (status) => {
        if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentlyPlayingId(null);
        }
    };

    const formatDuration = (ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const renderTrackItem = ({ item }) => (
        <View style={[
            styles.trackItem,
            selectedTrack?.id === item.id && styles.selectedTrackItem
        ]}>
            <TouchableOpacity
                style={[
                    styles.playButton,
                    currentlyPlayingId === item.id && isPlaying && styles.playingButton
                ]}
                onPress={() => handlePlayPreview(item)}
            >
                <LinearGradient
                    colors={currentlyPlayingId === item.id && isPlaying ?
                        ['#FF6B6B', '#FF8E53'] :
                        ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                    style={styles.playButtonGradient}
                >
                    <Ionicons
                        name={currentlyPlayingId === item.id && isPlaying ? 'pause' : 'play'}
                        size={22}
                        color="#FFF"
                    />
                </LinearGradient>
            </TouchableOpacity>

            <FastImage
                source={{ uri: item.imageUrl }}
                style={styles.trackImage}
                resizeMode={FastImage.resizeMode.cover}
            />

            <TouchableOpacity
                style={styles.trackInfo}
                onPress={() => handleSelect(item)}
            >
                <Text style={styles.trackName} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                    {item.artist}
                </Text>
            </TouchableOpacity>

            <Text style={styles.duration}>
                {formatDuration(item.duration)}
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.title}>
                    {searchQuery ? 'Arama Sonuçları' : 'Popüler Şarkılar'}
                </Text>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Şarkı veya sanatçı ara..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoFocus
                />
            </View>

            {isLoading ? (
                <ActivityIndicator style={styles.loader} color="#25D220" />
            ) : (
                <FlatList
                    data={searchResults}
                    renderItem={renderTrackItem}
                    keyExtractor={(item) => item.id.toString()}
                    style={styles.list}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#333',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
    },
    closeButton: {
        padding: 8,
    },
    title: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        paddingHorizontal: 16,
        backgroundColor: '#444',
        borderRadius: 8,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 40,
        color: '#FFF',
    },
    loader: {
        marginTop: 20,
    },
    list: {
        flex: 1,
    },
    trackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    selectedTrackItem: {
        backgroundColor: '#444',
    },
    playButton: {
        width: 36,
        height: 36,
        marginRight: 12,
        borderRadius: 18,
        overflow: 'hidden',
    },
    playButtonGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playingButton: {
        transform: [{ scale: 1.05 }],
    },
    trackImage: {
        width: 50,
        height: 50,
        borderRadius: 4,
    },
    trackInfo: {
        flex: 1,
        marginLeft: 12,
    },
    trackName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    artistName: {
        color: '#999',
        fontSize: 14,
        marginTop: 2,
    },
    duration: {
        color: '#999',
        fontSize: 14,
        marginLeft: 12,
    },
    separator: {
        height: 1,
        backgroundColor: '#444',
        marginLeft: 64,
    },
});

export { MusicPicker }; 