# Nadeem Mobiles Platform v2.0

This is the clean handoff project for Nadeem Mobiles:

- `android-app/` — customer Android app. Customer enters only the 6-digit pairing code; backend URL is compiled into the APK and is never shown.
- `server/` — public Node/Express API, database, Firebase Admin integration, authentication and device control.
- `dashboard/` — source for the professional shop dashboard.
- `docs/` — ready-to-publish GitHub Pages dashboard copy.

## Final architecture

Shop laptop/browser → GitHub Pages dashboard → public HTTPS API → database + Firebase FCM → customer phone.

The laptop and phone do not need to share Wi-Fi.

## Dashboard sections

Overview · Customers · Payments · Devices · Enrollments · Activity · Settings

## Device lifecycle

Pending → Enrolled → Locked/Unlocked → Release pending → Released → Re-enroll (optional)

While enrolled:
- Factory Reset is blocked.
- App uninstall is blocked.
- Lock/unlock is controlled from the dashboard.

Release is acknowledged by the phone before the backend marks the enrollment as released. After release, Android's uninstall flow is opened; a silent self-uninstall is not claimed.

## Important security rule

Never commit `server/.env`, `server/firebase-service-account.json`, `server/data/`, Android `google-services.json`, keystores, or passwords.
