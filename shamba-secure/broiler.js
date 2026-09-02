const db = require('./db');

// The default 28-day broiler cycle. Day 0 = the day the lot starts (chicks arrive).
// These are general guidelines — vaccine timing varies by disease, hatchery, and
// vet program, so farmers should confirm specifics with their local vet/agrovet.
const BROILER_SCHEDULE = [
  { day: 0, title: 'Lot started', detail: 'Set up the brooder at 32-35\u00b0C, start on chick/starter feed, and ensure clean water is always available.' },
  { day: 7, title: 'First vaccination', detail: 'Vaccinate against Newcastle/Gumboro disease as per your vet\u2019s program. Watch for any birds off their feed.' },
  { day: 14, title: 'Mid-cycle check', detail: 'Weigh a sample of birds, check for a booster dose due around now, and watch mortality and feed intake closely.' },
  { day: 21, title: 'Switch to finisher feed & booster', detail: 'Move the flock onto finisher feed and give the booster vaccination dose.' },
  { day: 28, title: 'End of cycle \u2014 ready for market', detail: 'Birds should be near market weight. Plan sales or slaughter and start preparing the next lot.' }
];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Creates one reminder per schedule checkpoint, dated from the lot's start date.
function createLotReminders(lot, userId) {
  const insert = db.prepare(
    'INSERT INTO reminders (farm_id, created_by, subject_type, subject_id, remind_date, message) VALUES (?,?,?,?,?,?)'
  );
  for (const step of BROILER_SCHEDULE) {
    const remind_date = addDays(lot.start_date, step.day);
    const message = `Broiler lot "${lot.name}" \u2014 Day ${step.day}: ${step.title}. ${step.detail}`;
    insert.run(lot.farm_id, userId, 'broiler_lot', lot.id, remind_date, message);
  }
}

module.exports = { BROILER_SCHEDULE, addDays, createLotReminders };
