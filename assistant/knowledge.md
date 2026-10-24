# Shamba Secure: app guide

Shamba Secure is a private farm-management app for small farms. It tracks money (income, expenses, debts), livestock (cows, goats, chickens), poultry lots (broilers and layers), reminders, and the team. Each farm is its own private account; one farm can never see another farm's records. It works on a phone browser and can be installed to the home screen like an app.

## Navigating the app
Tap the hamburger menu (three lines, top left) to open the side menu: Overview, Finance, Livestock, Poultry, Reminders, Team, History, Profile & farm settings, and Log out. Tapping the farm name or logo in the header also opens Profile & farm settings. The "Ask" assistant button sits at the bottom right of every screen.

## Getting started: registering and logging in
On the login screen choose "Start a new farm". Enter the farm name, your name, currency, phone number, email, a password (at least 6 characters), and choose how to verify: Email (SMS verification may be temporarily unavailable). A 6-digit code is sent; enter it to create the account. The person who registers becomes the Owner. The verification choice also becomes the password-reset method.
To log in, use either the phone number or the email address plus the password. The Show/Hide button on the password field reveals what you typed.
The other contact (the one you did not verify) can be verified later from the banner at the top of the app; the app stays usable meanwhile.

## Forgot password
On the login screen tap "Forgot your password?", enter the phone number or email on the account, and a 6-digit code is sent to the contact that was verified at signup (email or SMS). Enter the code with a new password. Codes expire after 15 minutes. The message is the same whether or not the account exists, for privacy. If no code arrives: check spam, wait a minute and tap "Resend code", and make sure the email or SMS service is configured on the server (see Setup for the admin).

## Roles and permissions
Owner: can do everything, including deleting records, adding or editing team members, changing farm settings (name, currency, country, icon, logo), "Clear all" buttons, and sending reminders immediately.
Worker: can add and edit transactions, debts, animals, poultry lots, losses, and reminders, mark debts settled, and update statuses. Workers cannot delete records, manage the team, or change farm-wide settings. If a worker needs something deleted or changed, ask the owner. Removing someone from the Team takes effect immediately.

## Overview (home screen)
At the top is a row of lot filter chips (see "Filtering the whole app by lot").
Cards: "Where things stand" (Net balance, Total in, Total out), "Debt balance" (Owed to you, You owe; open debts only), "Herd snapshot" (active, sold, deceased animals; becomes a "Lot snapshot" with birds started, remaining and lost when a lot is selected), and "Mortality" (every recorded bird loss).

## Filtering the whole app by lot
The row of chips at the top of the Overview (also shown on Finance and History) is the lot filter, like tabs in a chat app: All, Farm-wide, then the three newest poultry lots, with a "More..." menu for older lots. Tap a chip to filter the whole app to that lot: Overview numbers, transactions, debts, History, Mortality, Reminders, Sales by animal type, the lots list and Lot performance. "Farm-wide" shows only records not tied to any lot; "All" removes the filter. With a lot selected you also see its maturity date and a "From maturity only" tick box that hides records dated before the lot matured. The filter resets to All when you reload the page. Only records tagged with a Lot appear under that lot's chip.

## Finance: recording money
Finance tab, "Add a transaction": choose Money in (income) or Money out (expense), enter the amount, a description, a category (Crop sales, Livestock sales, Milk / produce sales, Feed, Veterinary, Seeds & fertilizer, Labor, Equipment, Transport, Other), and the date. Optional: Animal type (Chicken, Goat, Cow) with a Pieces count, so sales build up in "Sales by animal type". Optional: Lot, to tie the transaction to a specific poultry lot so it counts toward that lot's income, expenses and performance. Tap Save transaction.
Each transaction has Edit and (owner only) Remove. The owner also has "Clear all" on the Recent transactions card. Only the 10 most recent show on the Finance tab; the full list is in the History tab.
"Sales by animal type" totals pieces sold and money earned per animal type (and follows the lot filter).

## Debts
Finance tab (debt section) "Add a debt": direction is "Owed to you" (someone owes the farm) or "You owe", with the person's name, phone (optional; "Pick from contacts" works on Chrome for Android), amount, reason, due date (optional), animal type and pieces (optional), and Lot (optional).
A debt with a due date automatically creates an SMS reminder; if the money is owed to the farm and a phone number is given, the reminder goes to the debtor.
Marking a debt "settled" does real bookkeeping: it creates the matching transaction (income if someone paid you, expense if you paid someone), so Total in/out and Net balance update. A settled debt moves out of the Debt ledger into History > Settled debts. "Restore to ledger" un-settles it and removes that created transaction, with no duplicates.
Editing a debt: person, phone, reason and due date are always editable. Once settled, amount, direction and animal details are locked; restore it first to change them. Editing a due date or amount refreshes the pending reminder.
Owner only: Remove and "Clear all" (clearing debts also deletes settled ones in History; it never deletes the real transactions created by settlements).

## Livestock (cows, goats, individual animals)
Livestock tab: "Add an animal" with tag/name, species, breed, sex, date of birth, date acquired and notes. "Your herd" lists animals; tap one to open it. Inside you can edit details, change status (active, sold, deceased), and add events: Health/vet, Breeding, Production (milk/eggs), Weight, Other, each with a date, detail and optional value. Animals are not tied to poultry lots, so the lot filter does not change the Livestock tab.

## Poultry: broiler and layer lots
Poultry tab, "Start a new lot": lot name, type (Broilers, 28-day cycle to market; or Layers, reared to point of lay around day 140), number of birds, and start date (the day chicks arrive). Starting a lot automatically creates its vaccination and feed-change reminders dated from the start date.
Broiler schedule: day 0 brooder setup, day 7 first vaccination, day 14 mid-cycle check, day 21 finisher feed and booster, day 28 ready for market. Layer schedule includes Gumboro/Newcastle doses, fowl typhoid, fowl pox, deworming, feed changes (chick mash, grower mash, layer mash) and point of lay at day 140. These are general guidelines; confirm vaccine timing with your vet.
Maturity date = start date + the lot's cycle days (28 for broilers).
Tap a lot to open it: see lot finances (income, expenses, net, birds sold), edit name, number of birds and start date (changing the start date regenerates reminders not yet sent), change status (active or closed), record a loss ("Record a loss" with date, number lost and a note), and see the lot's reminders. The lot card shows "X of Y birds remaining".
To tie money to a lot, pick the Lot when saving a transaction or debt (Finance tab), or edit an existing record and choose the lot.

## Lot performance (charts)
Poultry tab > "Lot performance": choose All lots (compare) or one lot, then Bar graph or Pie chart. Figures: Income, Expenses, Net, Mortality %, Average price per bird, Cost per bird started. Bar graph with all lots compares income, expenses and net side by side; with one lot it shows three bars. Pie chart (choose Income or Expenses) shows each lot's share, or for one lot a breakdown by category (feed, vaccines, and so on), with credit sales/purchases grouped as "On credit". Only records tagged to a lot count. The card appears once at least one lot exists, and it follows the lot chips.

## History tab
Menu > History keeps older records out of the main screens. It has two views: "Settled debts" (with a count) and "Transactions" (the full list). The lot filter applies here too. Settled debts have Restore to ledger, Edit and Remove (owner).

## Reminders and notifications
Reminders tab: add a custom reminder (date and message); everyone on the farm gets an SMS on that date. Reminders also come automatically from debt due dates and from poultry lot schedules. A daily job sends due reminders at 7:00 am Africa/Nairobi time. The owner can send due reminders immediately.
"Push notifications" switch on the Reminders tab turns on in-app alerts on this device (in addition to SMS). When you log in and notifications are off, the app shows a "Stay on top of your farm" prompt; tap "Turn on notifications" and allow the browser's permission dialog. "Not now" snoozes it for a week.
If notifications are Blocked: the browser will not ask again. On Android Chrome tap the lock/settings icon beside the address bar > Permissions > Notifications > Allow. On desktop click the lock icon > Site settings > Notifications > Allow, then reload. On iPhone, notifications only work from the installed app: Share > Add to Home Screen, open it from the Home Screen, then enable; if blocked, iPhone Settings > Notifications > Shamba Secure.
Debtor reminders (money owed to the farm) are SMS only. "Send a test notification" appears once notifications are on.

## Team
Team tab (owner): add a worker with name, phone, optional email and a password; they log in with their own phone and password and see the same farm records. "People on this farm" lists everyone; Edit changes name, phone or email; removing someone cuts their access immediately. Everyone can edit their own name in Profile.

## Profile and farm settings
Menu > Profile & farm settings. Everyone can edit their own name. The owner can also change the farm name, currency (KES, UGX, TZS, NGN, GHS, ZAR, INR, PHP, USD, GBP, EUR), country, and the farm's identity: pick an icon or upload a logo photo (it is resized automatically); removing the logo returns to the default Shamba Secure shield logo.

## Installing the app
Add to Home Screen from the browser menu (Chrome: menu > Install app or Add to Home screen; Safari on iPhone: Share > Add to Home Screen). It then opens full screen like a normal app.

## How the numbers are calculated
Overview Net balance = Total in - Total out, counting recorded transactions (including the ones created when a debt is settled). Debts only affect Total in/out once they are settled.
Lot figures and "Sales by animal type" count a credit sale or credit purchase as soon as the debt is recorded (the animals have already left or arrived), and they skip "Debt settlement" transactions so nothing is counted twice.
Debt balance cards count only open (unsettled) debts.
Mortality % = birds lost / birds started. Average price per bird = lot income / birds sold. Cost per bird started = lot expenses / birds started.

## Troubleshooting
- Numbers on Overview differ from a lot's performance: the Overview waits for settlement before counting credit; lot figures count credit when recorded. Also check the lot chip: you may be viewing a single lot.
- A debt disappeared: settled debts move to Menu > History > Settled debts.
- Lot chart is empty: no transactions or debts are tagged to that lot; edit them and choose the Lot.
- Can't delete something: deleting is owner only.
- Notification switch is greyed out: blocked in device settings, unsupported browser, iPhone not installed to the Home Screen, or push not configured on the server.
- Login code or reset code never arrives: the server's email/SMS provider may not be set up; the admin can check the server log for lines starting [email:not-configured] or [sms:not-configured].
- Page looks old after an update: close and reopen the app, or reload; installed apps can take a moment to refresh.
- Session expired or "Your access has been removed": log in again; if removed, contact the farm owner.

## Privacy and data
All data is scoped to your farm; sessions are signed, httpOnly cookies and are re-checked against the database on every request. Login and code endpoints are rate limited. The assistant can only read your own farm's data and cannot change, add or delete anything.

## Setup notes for the app admin (server environment)
Required: JWT_SECRET (long random string), NODE_ENV=production when deployed, DATA_DIR pointing at a persistent volume (otherwise the database is wiped on redeploy). Email: RESEND_API_KEY (works on hosts that block SMTP) or SMTP_* settings. SMS: AT_USERNAME and AT_API_KEY (Africa's Talking). Push: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT. Assistant: ANTHROPIC_API_KEY enables the AI assistant (optional ASSISTANT_MODEL); without it the assistant runs in offline mode, answering from this guide and basic farm figures. Environment variables must be set on the hosting service itself; a local .env file is not deployed.
