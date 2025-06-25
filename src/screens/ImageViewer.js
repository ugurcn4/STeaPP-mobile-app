import React from 'react';
import {
    View,
    Image,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const ImageViewer = ({ route, navigation }) => {
    const { url } = route.params;

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity
                style={styles.closeButton}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: url }}
                    style={styles.image}
                    resizeMode="contain"
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
        padding: 8,
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: width,
        height: height * 0.8,
    },
});

export default ImageViewer; 