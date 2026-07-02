# Android Test Build Guide

This guide is for the first installable Android test build.

## Current Status

Ready:

- Expo app config is valid.
- Android package is set to `com.bskim.weathercheck`.
- Android `versionCode` is set to `1`.
- Location permissions are declared.
- Native map dependency `react-native-maps` is installed for Android/iOS map rendering.
- Tablet preview keeps the app in a centered mobile-width layout instead of stretching full width.
- `.easignore` excludes local build artifacts, logs, dependencies, and env files from EAS uploads.
- The checked preview build script sets `EAS_NO_VCS=1`, so Git is not required on this PC for the first APK build.
- EAS CLI is installed locally in the project.
- `eas.json` has a `preview` profile that builds an installable APK.
- `npm run verify` passes.
- `npm run check:android-preview` checks Android preview APK settings before the real EAS build.

Blocked until user action:

- Expo/EAS account login.
- Optional Google Play Console setup for later internal testing.

## Build Profiles

### Preview APK

Purpose:

- Direct install on Android phones.
- Best for early personal and friend testing.

Command:

```powershell
npm run build:android:preview
```

This uses:

```json
{
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```

### Production AAB

Purpose:

- Later Google Play upload.

Command:

```powershell
npm run build:android:production
```

This uses:

```json
{
  "android": {
    "buildType": "app-bundle"
  }
}
```

## First-Time EAS Steps

1. Log in:

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기\mobile-app
npx eas login
```

Check login:

```powershell
npm run eas:whoami
```

2. Confirm project/build setup when EAS asks.

3. Run:

```powershell
npm run check:android-preview
npm run build:android:preview:checked
```

4. When the build finishes, EAS will provide an APK download link.

5. Open the link on an Android phone and install the APK.

## First Device Test Checklist

Test these on a real Android phone:

- App opens without blank screen.
- First screen shows the 판정 tab.
- Location permission prompt appears.
- Allowing location changes the header/status to current location confirmed.
- Denying location keeps the app usable with fallback location.
- Search question still works.
- One-line field report persists after closing and reopening the app.
- Bottom tabs work.
- Map tab renders a native map, radius area, and field report markers.
- On an Android tablet, the app remains centered and readable instead of stretching too wide.
- Compare table scrolls horizontally.

## Notes

- The first Android APK is for testing, not Play Store release.
- Play Store release later should use the production AAB profile.
- If installation is blocked, Android may require allowing installs from the browser or file manager.
