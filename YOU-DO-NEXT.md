# Nadeem Mobiles — What You Need To Do

The code and dashboard are already prepared. Your remaining work is deployment/configuration and real-device testing.

## 1. Create GitHub repository

Create one repository for this project and push the project contents.

Keep these files private / ignored:
- `server/.env`
- `server/firebase-service-account.json`
- `server/data/`
- `android-app/gradle.properties`
- `android-app/app/google-services.json`
- signing keystore and passwords

## 2. Put the dashboard on GitHub Pages

Publish the repository's `/docs` folder from GitHub Pages.

Before publishing, edit:

`docs/config.js`

and set:

`API_BASE_URL: "https://YOUR-LIVE-BACKEND.example"`

GitHub Pages is only the website. It does NOT run Node/Express.

## 3. Deploy the backend

Use a hosting service that can run Node.js continuously and preserve the database directory between restarts.

Deploy the `server/` folder.

Set environment variables from `server/.env.example`:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `SHOP_NAME`
- `SHOP_PHONE`
- `DATA_DIR`
- `CORS_ORIGINS` = your exact GitHub Pages origin
- `FIREBASE_SERVICE_ACCOUNT_PATH`

Open the backend's `/api/health` URL. It should return JSON with `ok: true`.

## 4. Create Firebase project

Create a Firebase project for Nadeem Mobiles and add the Android app with package name:

`com.nadeemmobile.lock`

Download the Firebase Android config file and place it locally as:

`android-app/app/google-services.json`

For the backend, create a Firebase service account and keep its private JSON on the backend host only. Never put it in GitHub Pages or the Android APK source repository.

## 5. Configure Android release build

Create local:

`android-app/gradle.properties`

Set:

`nadeemApiBaseUrl=https://YOUR-LIVE-BACKEND.example`

The customer-facing app still shows only the six-digit pairing code.

For a production APK, also configure a real release keystore.

## 6. Build the APK

Open `android-app/` in Android Studio, sync Gradle, then build a signed Release APK.

Put the final APK at:

`docs/downloads/nadeem-mobile-lock.apk`

Then the download page can be published from GitHub Pages.

## 7. Acceptance test

Test with a clean factory-reset Android device that can be provisioned as Device Owner.

Test in this order:

1. Phone on one internet connection; laptop/dashboard on another.
2. Create customer in dashboard.
3. Enter only the six-digit code on the phone.
4. Confirm `Successfully connected to Nadeem Mobiles`.
5. Confirm Factory Reset is blocked while enrolled.
6. Confirm uninstall is blocked while enrolled.
7. Lock from dashboard.
8. Power off and power on the phone; confirm the lock screen returns.
9. Unlock from dashboard.
10. Release from dashboard; confirm status changes to `Releasing` then `Released` after phone acknowledgement.
11. Confirm the app is now removable through Android's uninstall flow.
12. Use Re-enroll to generate a new six-digit code and verify a fresh installation can pair again.

## You do not need to do

- You do not need to tell the customer a server URL.
- You do not need the phone and laptop on the same Wi-Fi.
- You do not need to run the backend on the shop laptop after deployment.
