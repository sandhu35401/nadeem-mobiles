# Deployment Notes

## GitHub Pages

Use the `docs/` directory as the Pages site source.

`docs/config.js` must contain the live backend URL.

## Backend

The Node/Express API is under `server/` and listens on `0.0.0.0` using the provider's `PORT`.

The backend requires a persistent data directory because SQLite is file based.

## Firebase

The backend uses Firebase Admin + FCM to send `LOCK`, `UNLOCK`, and `RELEASE` data messages to the enrolled Android device.

The Android app calls:
- `POST /api/device/pair`
- `POST /api/device/heartbeat`
- `POST /api/device/release-ack`

The dashboard uses authenticated customer/payment/device endpoints.

## Production checklist

- HTTPS backend URL
- Strong admin password
- Long random JWT secret
- Exact GitHub Pages CORS origin
- Firebase service account stored only on backend
- Signed release APK
- Real-phone acceptance test
- Backup/persistence plan for SQLite data
