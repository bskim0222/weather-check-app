# Friend Web Test Guide

Use this while Android APK testing is blocked or inconvenient.

## Local Same-Wi-Fi Test

From the PC:

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기\mobile-app
node scripts/serve-dist-phone.mjs
```

From a phone on the same Wi-Fi:

```text
http://192.168.0.31:8792
```

If the PC Wi-Fi IP changes, run `ipconfig` and use the IPv4 address under `Wireless LAN adapter Wi-Fi`.

## What To Ask Testers

Ask testers to check:

- App opens without a blank screen.
- Search works with `잠실운동장 지금 비 와?`.
- Decision tab card is readable.
- Map tab opens and shows a map.
- Report tab can select a request and submit an answer.
- Compare tab can switch hourly/daily and scroll sideways.

## iPhone Home Screen Test

In Safari:

1. Open the test URL.
2. Tap Share.
3. Tap Add to Home Screen.
4. Open the home screen icon.

This checks the PWA-style shell before native iOS/TestFlight work starts.

## Android Browser Test

In Chrome:

1. Open the test URL.
2. Tap the browser menu.
3. Tap Add to Home screen or Install app if shown.

This is not the same as an APK, but it is enough for early design and user-flow feedback.
