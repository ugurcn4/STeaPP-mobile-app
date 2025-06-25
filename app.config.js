const config = {
  expo: {
    name: "STeaPP",
    slug: "steapp",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      hideExponentExperience: true
    },
    extra: {
      eas: {
        projectId: "379cc6f7-cc9f-4c0c-86db-369c71ad4d70"
      }
    },
    ios: {
      supportsTablet: false,
      config: {
        googleMapsApiKey: "AIzaSyCRuie7ba6LQGd4R-RP2-7GRINossjXCr8"
      },
      bundleIdentifier: "com.ugurrucr.steapp",
      buildNumber: "1.1.0",
      icon: "./assets/images/logo.png",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription: "Bu uygulama arkadaşlarınızla konum paylaşımı için konumunuzu kullanır.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Bu uygulama arkadaşlarınızla konum paylaşımı için arka planda konumunuzu kullanır.",
        NSLocationAlwaysUsageDescription: "Bu uygulama arkadaşlarınızla konum paylaşımı için arka planda konumunuzu kullanır.",
        NSCameraUsageDescription: "Video görüşmesi yapabilmek için kamera izni gerekiyor",
        NSPhotoLibraryUsageDescription: "Galerinizdeki fotoğrafları paylaşabilmek için izin gereklidir",
        NSPhotoLibraryAddUsageDescription: "Çektiğiniz fotoğrafları galeriye kaydetmek için izin gereklidir",
        NSMicrophoneUsageDescription: "Sesli mesaj yapabilmek için mikrofon izni gerekiyor",
        NSContactsUsageDescription: "Arkadaşlarınızı bulabilmek için rehber izni gereklidir",
        NSCalendarsUsageDescription: "Etkinlikleri takviminize ekleyebilmek için takvim izni gereklidir",
        NSMotionUsageDescription: "Hareket sensörlerini kullanabilmek için izin gereklidir",
        UILaunchStoryboardName: "SplashScreen", // Bu önemli: iOS'un splash screen'i için özel storyboard adı
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "com.googleusercontent.apps.54620040129-glhj2871msevbkcd3iklvdte1ebinc0c"
            ]
          }
        ],
        UIBackgroundModes: [
          "location",
          "fetch"
        ]
      },
      splash: {
        image: "./assets/images/logo.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        imageResizeMode: "contain",
        tabletImage: "./assets/images/logo.png",
        dark: {
          image: "./assets/images/logo.png",
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      }
    },
    // ...app.json'un geri kalanı buraya eklenecek
  }
};

module.exports = config; 