import axios from 'axios';

const WEATHER_API_KEY = 'c48c01ab4475dd8589ace2105704e4b8';

// Hava durumu açıklamalarının Türkçe karşılıkları
const weatherDescriptions = {
    'scattered showers': 'Ara ara yağmurlu',
    'light rain': 'Hafif yağmurlu',
    'moderate rain': 'Orta şiddetli yağmur',
    'heavy rain': 'Şiddetli yağmur',
    'thunderstorm': 'Gök gürültülü fırtına',
    'clear': 'Açık',
    'clear sky': 'Açık hava',
    'sunny': 'Güneşli',
    'partly cloudy': 'Parçalı bulutlu',
    'cloudy': 'Bulutlu',
    'overcast': 'Kapalı',
    'overcast clouds': 'Kapalı bulutlu',
    'scattered clouds': 'Parçalı bulutlu',
    'broken clouds': 'Parçalı bulutlu',
    'few clouds': 'Az bulutlu',
    'mist': 'Puslu',
    'fog': 'Sisli',
    'snow': 'Karlı',
    'light snow': 'Hafif karlı',
    'sleet': 'Karla karışık yağmur',
    'drizzle': 'Çisenti',
    'light intensity drizzle': 'Hafif çisenti',
    'shower rain': 'Sağanak yağış',
    'light intensity shower rain': 'Hafif sağanak yağış',
    'heavy intensity shower rain': 'Şiddetli sağanak yağış',
    'rain': 'Yağmurlu',
    'light intensity rain': 'Hafif yağmurlu',
    'moderate rain': 'Orta şiddetli yağmur',
    'heavy intensity rain': 'Şiddetli yağmur',
    'very heavy rain': 'Çok şiddetli yağmur',
    'extreme rain': 'Aşırı yağmur',
    'freezing rain': 'Dondurucu yağmur',
    'light intensity shower rain': 'Hafif sağanak yağış',
    'shower rain': 'Sağanak yağış',
    'heavy intensity shower rain': 'Şiddetli sağanak yağış',
    'ragged shower rain': 'Düzensiz sağanak yağış'
};

export const getWeatherInfo = async (coords) => {
    try {
        const { latitude, longitude } = coords;
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric&lang=tr`
        );

        if (response.data) {
            const condition = response.data.weather[0].main.toLowerCase();
            const description = response.data.weather[0].description.toLowerCase();

            // API'den gelen açıklamayı kontrol et ve uygun Türkçe karşılığı bul
            const turkishDescription = weatherDescriptions[description] ||
                weatherDescriptions[condition] ||
                description;

            return {
                temperature: response.data.main.temp,
                condition: condition,
                description: turkishDescription,
                icon: response.data.weather[0].icon,
                humidity: response.data.main.humidity,
                windSpeed: response.data.wind.speed
            };
        }

        return {
            condition: 'sunny',
            description: 'Güneşli'
        };
    } catch (error) {
        console.error('Hava durumu bilgisi alınamadı:', error);
        return {
            condition: 'sunny',
            description: 'Güneşli'
        };
    }
};