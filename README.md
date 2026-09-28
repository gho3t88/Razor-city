# Razor City Android

This is a standalone offline Android version of the Razor City game. The gameplay source is copied from the Grok project; the server, login, and preview framework are excluded. Saves use WebView localStorage and remain on the device unless app data is cleared or the app is uninstalled.

## Build

Install Node.js 22+, Android Studio and Android SDK API 36. From this folder:

```sh
npm install
npm run android:sync
cd android
./gradlew assembleDebug
```

The test APK is `android/app/build/outputs/apk/debug/app-debug.apk`. For Google Play, create a private release signing key and build a signed Android App Bundle in Android Studio. Keep the keystore and passwords out of GitHub. Configure a unique final application ID before your first Play upload; changing it later creates a different app.

The optional tip button is not implemented. Add it only after choosing a payment destination and checking current Play payment policies. Review artwork rights, content rating, store listing, privacy disclosures, and test the installed game on a device before submission.

The `android` directory was generated with Capacitor 8 and targets Android API 36. This environment verified the TypeScript and web production build. It could not compile the APK because Gradle 8.14.3 is not available locally and network access to the Gradle distribution is blocked.
