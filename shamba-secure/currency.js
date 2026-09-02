// A practical starting set, not exhaustive — add more as real farms in new
// regions actually sign up (see STORE_SUBMISSION.md / SCALING.md).
const CURRENCIES = {
  KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
  UGX: { symbol: 'USh', name: 'Ugandan Shilling' },
  TZS: { symbol: 'TSh', name: 'Tanzanian Shilling' },
  NGN: { symbol: '\u20a6', name: 'Nigerian Naira' },
  GHS: { symbol: 'GH\u20b5', name: 'Ghanaian Cedi' },
  ZAR: { symbol: 'R', name: 'South African Rand' },
  INR: { symbol: '\u20b9', name: 'Indian Rupee' },
  PHP: { symbol: '\u20b1', name: 'Philippine Peso' },
  USD: { symbol: '$', name: 'US Dollar' },
  GBP: { symbol: '\u00a3', name: 'British Pound' },
  EUR: { symbol: '\u20ac', name: 'Euro' }
};

function formatMoney(amount, currencyCode) {
  const info = CURRENCIES[currencyCode] || CURRENCIES.KES;
  const rounded = Math.round(Number(amount) || 0).toLocaleString();
  return `${info.symbol} ${rounded}`;
}

module.exports = { CURRENCIES, formatMoney };
