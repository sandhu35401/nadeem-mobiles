# Nadeem Mobiles — Control Center v4.0

This `docs` folder is the complete dashboard frontend for the Nadeem Mobiles platform.

## Included

- Login/session handling
- Overview dashboard and payment progress
- Customer create, edit, details and delete
- Automatic 6-digit pairing-code generation
- Pairing-code display and regeneration for pending enrollments
- Payment recording and payment deletion
- Devices view with Lock, Unlock and Release actions
- Enrollments view with pairing and re-enrollment actions
- Activity log
- Settings / API health view
- Search and filtering
- Clear success/error messages
- Mobile-responsive layout

## API

`config.js` points to the production API worker:

`https://nadeem-mobiles-api.user03174904469.workers.dev`

## Deploy

Replace the existing repository `docs` folder with this complete folder, keeping your existing `google-services.json` elsewhere under the Android app. Commit and push the repository, then refresh GitHub Pages.
