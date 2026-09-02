# Shamba Secure

A private, multi-user web app for tracking farm finances (income, expenses,
who-owes-who) and livestock (animals, health/breeding/production records).
Runs on your own server — no third party sees your farm's data.

## What's inside

- `server.js` — Express API (auth, transactions, debts, animals, events)
- `db.js` — SQLite schema (auto-creates `data/shamba.db` on first run)
- `auth.js` — login sessions via signed, httpOnly cookies (JWT)
- `public/` — the frontend (plain HTML/CSS/JS, no build step needed)

Each **farm** is its own account with its own private data. The person who
registers becomes the **owner** and can add **workers** (Team tab) who log
in with their own phone + password and see the same records.

**Worker permissions:** workers can add transactions, debts, animals,
broiler lots, and reminders — but only the owner can delete or remove any
of these. Marking a debt settled or updating an animal/lot's status is not
a delete, so workers can still do that day-to-day upkeep. Only the owner
can add new people to the farm or trigger an immediate reminder send.

## Running it locally (to try it out)

```bash
npm install
cp .env.example .env
# open .env and set JWT_SECRET to a long random string, e.g.:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm start
```

Then open http://localhost:3000 — register a farm and start using it.

## Deploying on HostAfrica (or any VPS with Node + DirectAdmin)

1. **Upload the project** (everything except `node_modules` and `data/*.db`)
   to your server, e.g. via `git`, `scp`, or DirectAdmin's file manager.

2. **Install Node dependencies** on the server:
   ```bash
   cd shamba-secure
   npm install --production
   ```

3. **Set environment variables.** Create a real `.env` file on the server
   (never commit this to git):
   ```
   JWT_SECRET=<a long random string, different from your dev one>
   NODE_ENV=production
   PORT=3000
   ```

4. **Run it with a process manager** so it survives reboots and crashes.
   PM2 is the simplest option:
   ```bash
   npm install -g pm2
   pm2 start server.js --name shamba-secure
   pm2 save
   pm2 startup   # follow the printed instructions to enable on boot
   ```

5. **Put it behind HTTPS.** Point an nginx reverse proxy (or DirectAdmin's
   built-in Node app + SSL support) at `localhost:3000`, with a free
   Let's Encrypt certificate — the same way you set up SSL for the
   Zen Marine Life site. This step matters: with `NODE_ENV=production`,
   login cookies are marked `secure` and **won't work over plain HTTP**,
   by design, so people's passwords and sessions aren't exposed.

6. **Back up `data/shamba.db` regularly** (e.g. a nightly cron job copying
   it somewhere safe) — it's the only copy of your farm's records.

## Broiler cycle tracking

For a standard 28-day broiler batch, the **Broilers** tab lets you start a
"lot" (a name/tag, number of birds, and a start date) and it immediately
schedules the whole cycle's reminders for you:

| Day | Checkpoint |
|---|---|
| 0 | Lot started — brooder setup, starter feed |
| 7 | First vaccination |
| 14 | Mid-cycle check (weigh sample, watch for booster) |
| 21 | Switch to finisher feed & booster vaccination |
| 28 | End of cycle — market-ready |

These are general guidelines, not a substitute for your vet's actual
vaccine program — timing varies by disease, hatchery, and region, so treat
day 7/21 as reminders to check in with your vet, not a fixed prescription.

Open any lot to add **extra reminders on top** of the default schedule
(e.g. "check litter moisture on day 10") — useful for anything specific to
that batch. Reminders for a lot go to your farm's phones, the same way
livestock and general reminders do.

## SMS reminders

Reminders live in a `reminders` table. Three ways they get created:

- **Automatic** — every debt saved with a due date gets a reminder for that
  date. If it's money *someone owes the farm* and you gave a phone number
  for them, the text goes straight to them, worded as a polite payment
  reminder. If it's money the *farm owes someone else*, the reminder texts
  your own farm's users instead — it never auto-messages a creditor.
- **From an animal** — open any animal's card and use "Remind me about this
  animal" (e.g. a vet check-up or vaccination date).
- **General** — the Reminders tab lets you add any date + message.

A cron job checks for due reminders every day at **7:00am Africa/Nairobi
time** and texts every phone number on the farm. The owner can also press
"Send due ones now" on the Reminders tab to trigger the check immediately
(useful right after setup, to confirm it's working).

To actually send SMS (not just log them to the console):

1. Sign up free at [africastalking.com](https://africastalking.com).
2. For testing, use username `sandbox` and your sandbox API key — free,
   and lets you register a test phone number to receive real texts without
   paying.
3. For production, create a live app in their dashboard to get a real
   username + API key. **Africa's Talking bills per SMS** (roughly
   KSh 0.8–1 per message at the time of writing — check their current
   pricing page, as rates change). A small farm sending a handful of
   reminders a month costs next to nothing; budget accordingly if you add
   more automated alerts later.
4. Put `AT_USERNAME` and `AT_API_KEY` in your `.env` file and restart the
   server.

Leave those two blank and the app runs exactly the same, except reminders
are printed to the server log instead of sent — handy while developing.

## Security notes

- Passwords are hashed with bcrypt (never stored in plain text).
- Sessions are signed, httpOnly cookies — not readable by JavaScript,
  reducing risk from cross-site scripting.
- All data queries are scoped by `farm_id`, so one farm's users can never
  see another farm's records, even if you host multiple farms on the same
  install.
- Change `JWT_SECRET` to a real random value before going live — never use
  the example value.

## Getting this into the App Store / Play Store

See `STORE_SUBMISSION.md` for the full walkthrough — it covers wrapping
the app with Capacitor, both developer accounts, and what each store's
review process requires. The PWA foundation (manifest, service worker,
icons, privacy policy template) needed for this is already in `public/`.

## Extending it

Ideas that fit naturally into the existing schema:
- CSV export of transactions/animal events for your accountant
- Photos attached to animal records
- Basic charts on the dashboard (income vs. expense over time)
- Recurring reminders (e.g. "every 30 days") instead of one-off dates
