import axios from 'axios';

const DEEZER_API_URL = 'https://api.deezer.com';

export const refreshTrackPreview = async (trackId) => {
    try {
        const response = await axios.get(`${DEEZER_API_URL}/track/${trackId}`);
        return {
            previewUrl: response.data.preview,
            success: true
        };
    } catch (error) {
        console.error('Önizleme URL yenileme hatası:', error);
        return {
            previewUrl: null,
            success: false
        };
    }
};

export const searchTracks = async (query) => {
    try {
        const response = await axios.get(`${DEEZER_API_URL}/search`, {
            params: {
                q: query,
                limit: 10
            }
        });
        return response.data.data.map(track => ({
            id: track.id,
            name: track.title,
            artist: track.artist.name,
            album: track.album.title,
            previewUrl: track.preview, // Deezer her zaman 30 saniyelik önizleme sağlar
            imageUrl: track.album.cover_medium,
            duration: track.duration * 1000, // Deezer saniye cinsinden veriyor, ms'ye çeviriyoruz
            uri: track.link
        }));
    } catch (error) {
        console.error('Müzik arama hatası:', error);
        return [];
    }
};

export const getTrackDetails = async (trackId) => {
    try {
        const response = await axios.get(`${DEEZER_API_URL}/track/${trackId}`);
        const track = response.data;

        return {
            id: track.id,
            name: track.title,
            artist: track.artist.name,
            album: track.album.title,
            previewUrl: track.preview,
            imageUrl: track.album.cover_medium,
            duration: track.duration * 1000,
            uri: track.link
        };
    } catch (error) {
        console.error('Şarkı detayları alınamadı:', error);
        return null;
    }
};

export const getPopularTracks = async () => {
    try {
        const response = await axios.get(`${DEEZER_API_URL}/chart/tr/tracks`, {
            params: {
                limit: 30
            }
        });

        return response.data.data.map(track => ({
            id: track.id,
            name: track.title,
            artist: track.artist.name,
            album: track.album.title,
            previewUrl: track.preview,
            imageUrl: track.album.cover_medium,
            duration: track.duration * 1000,
            uri: track.link
        }));
    } catch (error) {
        console.error('Popüler şarkılar alınamadı:', error);
        return [];
    }
}; 