# Getting Shamba Secure onto the Play Store and App Store

This is a separate project from running the app itself — read this fully
before starting, since the iOS build step needs a Mac.

## What's already done for you

- `public/manifest.json` + `public/sw.js` — makes the app installable as a
  PWA (works today, right after deployment, no store needed).
- `public/icons/` — app icons in the sizes both stores expect.
- `public/privacy.html` — a privacy policy template. **Fill in the
  bracketed placeholders** (your contact info, hosting provider, update
  date) before using it anywhere public — both stores require a real,
  working privacy policy URL.

## Step 0 — Deploy first

Both wrapping tools below need a real public HTTPS URL. Deploy Shamba
Secure to a managed platform (see the main README) before continuing.
Confirm `https://yourdomain.com/privacy.html` loads correctly.

## Step 1 — Create your developer accounts

- **Google Play Console:** https://play.google.com/console/signup — $25
  one-time fee.
- **Apple Developer Program:** https://developer.apple.com/programs —
  $99/year.

## Step 2 — Wrap the app with Capacitor

Capacitor takes your existing web app and produces native Android and iOS
projects from the same code, and lets you add real native features —
important for Apple, which rejects apps that are "just a website" with no
native functionality (Guideline 4.2).

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Shamba Secure" "com.yourname.shambasecure" --web-dir=public
npx cap add android
npx cap add ios
```

Since Shamba Secure is a server-rendered app, point Capacitor's config at
your live URL instead of bundling files locally — edit
`capacitor.config.json`:

```json
{
  "appId": "com.yourname.shambasecure",
  "appName": "Shamba Secure",
  "webDir": "public",
  "server": {
    "url": "https://yourdomain.com",
    "cleartext": false
  }
}
```

### Add at least one native feature (for Apple review)

The easiest option: **push notifications** for reminders, via
`@capacitor/push-notifications`. Worth doing as a follow-up project once
basic wrapping works — it meaningfully strengthens an App Store
submission.

## Step 3 — Android build (can be done on Linux/Windows)

```bash
npx cap sync android
cd android
./gradlew bundleRelease
```

Produces an `.aab` file — sign it, then upload in Play Console under
"Production" along with screenshots, description, and the privacy policy
URL.

## Step 4 — iOS build (needs a Mac)

```bash
npx cap sync ios
npx cap open ios
```

Opens the project in Xcode. From there: configure signing, then use
Archive → Distribute App to upload to App Store Connect. Without a Mac:
borrow one, use a cloud Mac CI service (Codemagic, MacStadium, GitHub
Actions macOS runners), or a Mac-rental-by-the-hour service.

## Step 5 — Store listing requirements (both platforms)

- App icon, screenshots, short description, privacy policy URL.
- **Google Play "Data safety" form** and **Apple "App Privacy" labels** —
  declare what's collected: financial info (transactions/debts) and
  personal info (name, phone, email), tied to the account, not shared for
  advertising, used only to operate the app.
- Apple reviews manually and may reject the first submission with
  specific feedback — normal, not a sign something's broken.

## Realistic timeline

Wrapping + first Android submission: a few days of focused work. Apple:
budget 1–3 weeks including at least one review round-trip.
