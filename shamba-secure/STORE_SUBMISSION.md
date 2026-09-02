# Getting Shamba Secure onto the Play Store and App Store

This is a separate project from running the app itself — read this fully
before starting, since step 5 (iOS build) needs a Mac.

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
Secure to your HostAfrica server (see the main README's deployment
section) before continuing. Confirm `https://yourdomain.com/privacy.html`
loads correctly.

## Step 1 — Create your developer accounts

- **Google Play Console:** https://play.google.com/console/signup — $25
  one-time fee, approval is usually fast.
- **Apple Developer Program:** https://developer.apple.com/programs —
  $99/year, can take a day or two to verify (longer if registering as a
  business rather than an individual).

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

Since Shamba Secure is a server-rendered app (not a static site), point
Capacitor's config at your live URL instead of bundling the files locally
— edit `capacitor.config.json`:

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

The easiest, most useful option here: **push notifications** for
reminders, replacing or supplementing SMS. Capacitor has an official
plugin (`@capacitor/push-notifications`) — this is a good follow-up
project once the basic wrapping works, and meaningfully strengthens your
App Store submission.

## Step 3 — Android build (can be done on your Linux machine)

```bash
npx cap sync android
cd android
./gradlew bundleRelease
```

This produces an `.aab` file — sign it (Android Studio or `jarsigner`
walks you through generating a keystore the first time), then upload it
in Play Console under your app's "Production" release track along with
screenshots, description, and the privacy policy URL.

## Step 4 — iOS build (needs a Mac)

```bash
npx cap sync ios
npx cap open ios
```

This opens the project in Xcode. From there: set your Apple Developer
team, configure signing, and use Xcode's Archive → Distribute App flow to
upload to App Store Connect. If you don't have a Mac, options include:
borrowing one, a cloud Mac CI service (Codemagic, MacStadium, GitHub
Actions macOS runners), or a Mac-rental service by the hour.

## Step 5 — Store listing requirements (both platforms)

- App icon (already generated), a handful of screenshots of the app in
  use, a short description, and your privacy policy URL.
- **Google Play "Data safety" form** and **Apple "App Privacy" labels** —
  both ask you to declare what data you collect. Based on this app:
  financial info (transactions/debts) and personal info (name, phone
  number) are collected, tied to the user's account, not shared with
  third parties for advertising, and used only to operate the app.
- Apple in particular reviews manually and may reject the first
  submission with specific feedback — this is normal, not a sign
  something is broken; resubmitting with fixes is expected.

## Realistic timeline

Wrapping + first Android submission: a few days of focused work. Apple:
budget 1–3 weeks total including at least one review round-trip.
