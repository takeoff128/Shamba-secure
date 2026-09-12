# Shamba Secure

A private, multi-user web app for tracking farm finances (income, expenses,
who-owes-who), livestock, and broiler production cycles. Runs on your own
server — no third party sees your farm's data.

## Running it locally

```bash
npm install
cp .env.example .env
# open .env and set JWT_SECRET to a long random string, e.g.:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm start
```

Then open http://localhost:3000 — register a farm and start using it.

## Accounts, roles, and password reset

Each **farm** is its own account. The person who registers becomes the
**owner** and can add **workers** (Team tab) who log in with their own
phone + password. Logging in accepts either the phone number or the
email address on the account, whichever's easier to remember at the
moment.

**Worker permissions:** workers can add transactions, debts, animals,
broiler lots, and reminders — but only the owner can delete or remove any
of these. Marking a debt settled or updating an animal/lot's status is not
a delete, so workers can still do that day-to-day upkeep. Only the owner
can add or remove people from the farm, or trigger an immediate reminder
send. Removing someone from the Team tab takes effect immediately — their
current session is checked against the database on every request, not
just at login, so a removed worker can't keep using an old session.

**Forgot password:** every account requires an email address at
registration specifically to support this. From the login screen, "Forgot
your password?" sends a one-time reset link valid for 1 hour. The link
lands on `/reset.html`, where a new password can be set. Requesting a
reset for an email that isn't registered returns the same generic message
as a real one, so this can't be used to check who has an account.

To actually send these emails (not just log them to the console), set
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` in `.env` — works with Gmail (using
an app password), SendGrid, Mailgun, Postmark, or any SMTP relay. Leave
them blank to develop locally without an email account; reset links get
printed to the server log instead.

## Multi-currency

Set at registration, changeable later by the owner in Team → Farm
settings. All amounts across the app format using the farm's chosen
currency.

## Broiler & layer cycle tracking

Starting a lot in the **Broilers** tab now starts with a **Type**
dropdown — Broilers or Layers — since they need completely different
schedules:

- **Broilers** (28-day cycle to market): day 0 (brooder setup), day 7
  (first vaccination), day 14 (mid-cycle check), day 21 (finisher feed &
  booster), day 28 (market-ready).
- **Layers** (reared to point of lay, ~140 days, then ongoing egg
  production): a longer vaccination and feed-transition schedule —
  Newcastle/Gumboro doses, fowl typhoid, fowl pox, the switch from chick
  mash → grower mash → layer mash, ending at point of lay around day 140
  when egg collection begins. Laying itself continues for many months
  past that point; the reminders cover the rearing stretch where timing
  matters most.

These are general guidelines — confirm actual vaccine timing with your
vet, since programs vary by disease, hatchery, and region. The "Default
schedule" reference card updates to match whichever type is selected in
the dropdown.

**Tracking losses:** open a lot and use "Record a loss" to log deaths
over time. The lot card shows a running "X of Y birds remaining" count,
for either type.

## Web push notifications

A second, optional channel alongside SMS — an in-app notification for
anyone who's installed the app (added it to their home screen). On the
Reminders tab, "Enable notifications on this device" requests permission
and subscribes that specific browser/device. Whenever a farm-wide
reminder fires, it's sent as both an SMS and a push notification;
debtor-targeted reminders (money owed *to* the farm) remain SMS-only,
since the debtor isn't a user of the app.

To turn this on, generate a VAPID keypair once:
```
node -e "console.log(require('web-push').generateVAPIDKeys())"
```
and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
(a `mailto:` address) in your environment variables. Leave them blank to
run without push — SMS reminders work exactly the same either way.

Subscriptions that go stale (browser data cleared, app uninstalled) are
cleaned up automatically the next time a push to them fails permanently.

## SMS reminders

A daily job (7am Africa/Nairobi time) texts due reminders via Africa's
Talking. Debts with a due date auto-generate a reminder — if it's money
*owed to the farm* and a phone number was given, the text goes straight to
the debtor; money the farm owes never auto-texts the other party. Leave
`AT_USERNAME`/`AT_API_KEY` blank to log reminders to the console instead
of sending them.

## Deploying

See `STORE_SUBMISSION.md` for wrapping this as an installable app
(Capacitor, app store submission). For hosting, a managed platform
(Railway, Render, Fly.io) works well — deploy from a connected GitHub
repo, and be sure to:

1. Set `JWT_SECRET`, `NODE_ENV=production`, and `DATA_DIR` (pointing at
   your persistent volume's mount path, e.g. `/data`) as environment
   variables.
2. **Attach a persistent volume/disk** mounted at that same path. Without
   this, your database gets wiped on every redeploy — the app's own
   filesystem doesn't survive deploys on these platforms.
3. Confirm the Root Directory setting points at the folder containing
   `package.json`, if your repo has the code nested in a subfolder.

## Security notes

- Passwords are hashed with bcrypt.
- Sessions are signed, httpOnly JWT cookies, re-validated against the
  database on every request (so removing a user revokes access
  immediately, not just at their next login).
- All data queries are scoped by `farm_id` — one farm's users can never
  see another farm's records.
- Password reset tokens are single-use, expire after 1 hour, and the
  forgot-password endpoint never reveals whether an email is registered.
- Change `JWT_SECRET` to a real random value before going live.

## Extending it

Ideas that fit naturally into the existing schema:
- CSV export of transactions/animal events
- Photos attached to animal records
- Basic charts on the dashboard (income vs. expense over time)
- Recurring reminders (e.g. "every 30 days") instead of one-off dates
