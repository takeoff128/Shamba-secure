const db = require('./db');

// These are general guidelines, not a substitute for your vet's actual
// program — timing varies by disease, hatchery, and region.

// Broilers: short cycle to market weight.
const BROILER_SCHEDULE = [
  { day: 0, title: 'Lot started', detail: 'Set up the brooder at 32-35\u00b0C, start on chick/starter feed, and ensure clean water is always available.' },
  { day: 7, title: 'First vaccination', detail: 'Vaccinate against Newcastle/Gumboro disease as per your vet\u2019s program. Watch for any birds off their feed.' },
  { day: 14, title: 'Mid-cycle check', detail: 'Weigh a sample of birds, check for a booster dose due around now, and watch mortality and feed intake closely.' },
  { day: 21, title: 'Switch to finisher feed & booster', detail: 'Move the flock onto finisher feed and give the booster vaccination dose.' },
  { day: 28, title: 'End of cycle \u2014 ready for market', detail: 'Birds should be near market weight. Plan sales or slaughter and start preparing the next lot.' }
];

// Layers: much longer rearing period through point of lay. Laying itself
// continues for many months beyond day 140 — this schedule covers the
// rearing/vaccination stretch where timing actually matters most.
const LAYER_SCHEDULE = [
  { day: 0, title: 'Chicks arrive', detail: 'Brooder at 32-35\u00b0C, chick mash, clean water always available. Marek\u2019s vaccine is often already given at the hatchery on day 1.' },
  { day: 9, title: 'Newcastle & Gumboro (1st dose)', detail: 'Vaccinate against Newcastle Disease and Infectious Bursal Disease (Gumboro) as per your vet\u2019s program.' },
  { day: 14, title: 'Gumboro booster', detail: 'Second Gumboro dose. Watch feed intake and droppings closely this week.' },
  { day: 28, title: 'Fowl typhoid vaccine', detail: 'Vaccinate against fowl typhoid. Deworm if this hasn\u2019t been done yet.' },
  { day: 42, title: 'Switch to grower mash', detail: 'Move off chick mash onto grower mash as the pullets mature.' },
  { day: 56, title: 'Fowl pox vaccine', detail: 'Wing-web vaccination against fowl pox.' },
  { day: 70, title: 'Newcastle booster', detail: 'Booster dose to maintain immunity through lay.' },
  { day: 98, title: 'Deworm', detail: 'Routine deworming ahead of the switch to layer feed.' },
  { day: 126, title: 'Switch to layer mash', detail: 'Move onto layer mash with higher calcium as point of lay approaches.' },
  { day: 140, title: 'Point of lay \u2014 expect first eggs', detail: 'Most breeds begin laying around now. Start daily egg collection and recording \u2014 laying continues for many months from here.' }
];

const SCHEDULES = {
  broiler: { schedule: BROILER_SCHEDULE, defaultCycleDays: 28 },
  layer: { schedule: LAYER_SCHEDULE, defaultCycleDays: 140 }
};

function getSchedule(poultryType) {
  return SCHEDULES[poultryType] || SCHEDULES.broiler;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Creates one reminder per schedule checkpoint, dated from the lot's start date.
function createLotReminders(lot, userId) {
  const { schedule } = getSchedule(lot.poultry_type);
  const insert = db.prepare(
    'INSERT INTO reminders (farm_id, created_by, subject_type, subject_id, remind_date, message) VALUES (?,?,?,?,?,?)'
  );
  for (const step of schedule) {
    const remind_date = addDays(lot.start_date, step.day);
    const message = `${lot.poultry_type === 'layer' ? 'Layer' : 'Broiler'} lot "${lot.name}" \u2014 Day ${step.day}: ${step.title}. ${step.detail}`;
    insert.run(lot.farm_id, userId, 'broiler_lot', lot.id, remind_date, message);
  }
}

module.exports = { BROILER_SCHEDULE, LAYER_SCHEDULE, SCHEDULES, getSchedule, addDays, createLotReminders };
