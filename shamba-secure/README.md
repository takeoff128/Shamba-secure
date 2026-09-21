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

**Email verification:** every new account gets a 6-digit code emailed to
it right after registering, confirming the email actually belongs to the
person who typed it in — this matters since that same email is what
password recovery relies on. The app stays fully usable while
unverified (nothing is blocked), but a banner stays visible at the top
until the code is entered, with a "Resend code" option if it doesn't
arrive. Existing accounts from before this feature are automatically
treated as already verified — no one gets retroactively locked out.

**Phone verification:** works the same way, but by SMS instead of email
— a separate 6-digit code, a separate banner, tracked independently from
email verification. **Note this costs one SMS credit per registration and
per resend**, unlike email verification which is free — a real ongoing
cost as signups grow, worth keeping in mind alongside Africa's Talking's
per-message pricing.

To actually send these emails (not just log them to the console), set
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` in `.env` — works with Gmail (using
an app password), SendGrid, Mailgun, Postmark, or any SMTP relay. Leave
them blank to develop locally without an email account; reset links and
verification codes get printed to the server log instead.

## Multi-currency

Set at registration, changeable later by the owner in Team → Farm
settings. All amounts across the app format using the farm's chosen
currency.

## Picking a debtor's number from contacts

On the "Add a debt" form, a "Pick from contacts" button appears next to
the phone field — **only on browsers that support the Contact Picker
API, which today means Chrome for Android**. It doesn't exist on iOS
Safari, desktop browsers, or other Android browsers; those users just
type the number in as before, no broken button shown.

This is intentionally not a persistent "allow this app to access your
contacts" permission — the browser shows its own native contact list,
the person taps one contact, and only that contact's name/number is
shared with the page. Nothing else in their address book is ever
touched or stored.

## Tracking animal sales (pieces sold)

The transaction form has an optional **Animal type** dropdown (Chicken,
Goat, Cow) — pick one and a **Pieces** field appears to record how many
were sold (or bought, if it's an expense) in that transaction. Skip it
entirely for anything non-animal, like crop sales or feed purchases.

Below the transaction list, a **Sales by animal type** card totals pieces
sold and money earned per type, adding up automatically across every
tagged transaction — so if you sell chickens in small batches over time,
the running total builds itself instead of you tracking it separately.
Only income transactions count toward this summary, since it's about
sales specifically.

**Debts carry the same tagging.** If someone buys chickens on credit,
tag the debt itself with the animal type and piece count when you create
it — **it counts toward Sales by animal type immediately**, not only
once the debt is settled. The reasoning: the animal already left the
farm at the point of sale, whether the buyer has paid yet or not — that's
a different question from whether the *cash* has actually arrived, which
the dashboard's Total in/Net balance still correctly waits for (via
settlement) before counting. Settling the debt doesn't add the pieces a
second time; it's the same sale, just now paid for.

**Clearing all transactions at once:** the owner gets a "Clear all" button
on the Recent Transactions card, instead of deleting entries one by one.
It asks for confirmation, showing exactly how many transactions will be
removed. If any of those transactions came from settling a debt, that
debt automatically reverts to unsettled — the ledger never ends up with
a debt marked "settled" pointing at a transaction that no longer exists.
Workers never see this button, and the backend rejects the request even
if they try to call it directly.

## History tab

The Finance tab's transaction and debt lists now show only the **10 most
recent** entries each, keeping the page fast to scan. Once either list
has more than 10, a "View all" link appears below it, jumping to the new
**History** tab — which shows the complete, unfiltered list for both,
with the same Edit/Settle/Delete controls as the main view.

**Clearing all debts at once** works the same way as clearing all
transactions: an owner-only "Clear all" button on the Debt ledger card,
with a confirmation showing exactly how many will be removed. Unlike
transactions, wiping debts **never deletes the real transactions** that
came from settling them — that's actual cash history and stays intact;
only the debt-tracking entries themselves are removed, along with any
reminders tied to them (so nothing is left pointing at a debt that no
longer exists).

## Editing transactions and debts

Every transaction and debt now has an **Edit** button, opening a form
pre-filled with its current values — no more delete-and-retype to fix a
typo or a wrong amount.

**Transactions** are fully editable: type, amount, description, category,
date, and animal tagging can all change freely.

**Debts** are editable too, with one safeguard: once a debt is marked
**settled**, its amount, direction, and animal details are locked (shown
greyed out in the edit form) because those numbers are already reflected
in a real transaction on the ledger — changing them here would silently
desync the two. Mark it unsettled first if the amount genuinely needs to
change. Person, phone, reason, and due date stay editable regardless of
settled status.

**Editing a debt's due date or amount also refreshes its reminder** —
the old, not-yet-sent reminder is removed and a new one is generated with
the updated details, so a pending SMS never goes out with stale
information from before the edit.

## Debt ledger

Marking a debt "settled" now does real bookkeeping, not just a status
flip: it automatically creates the matching transaction, so the money
actually shows up in **Total in/out and the net balance** on the
dashboard, not just as a checkbox in the debt list.

- **Someone owes the farm, settled** → creates an **income** transaction
  ("Debt repayment received from [person]").
- **The farm owes someone, settled** → creates an **expense** transaction
  ("Debt repayment made to [person]").

Un-settling a debt (in case it was marked settled by mistake) **reverses
this cleanly** — it deletes that exact transaction rather than leaving a
phantom entry behind, so toggling settled/unsettled back and forth never
creates duplicates or leaves orphaned records in the ledger.

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
