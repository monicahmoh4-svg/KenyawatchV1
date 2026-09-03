// Backend/utils/riskEngine.js
// A single, transparent scoring function used everywhere a contract's risk
// score is computed (seed data, manual "Scan Contract" tool, and live OCDS
// ingestion) so the platform never shows two different scores for the same
// kind of contract.

const VAGUE_TERMS = ['consultancy', 'miscellaneous', 'general supplies', 'sundry', 'emergency'];

function monthsBetween(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return null;
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

function scoreContract({ bid_type, value, description, supplier_reg_date, awarded_date }) {
  let score = 0;
  const flags = [];
  const val = Number(value) || 0;

  if (bid_type === 'single_source') {
    score += 35;
    flags.push('Single-source (non-competitive) award');
  } else if (bid_type === 'restricted') {
    score += 15;
    flags.push('Restricted tendering — limited bidder pool');
  } else {
    flags.push('Open competitive bidding');
  }

  if (val >= 500_000_000 && bid_type === 'single_source') {
    score += 20;
    flags.push('High-value contract (≥ KES 500M) awarded without competition');
  }

  const gap = monthsBetween(supplier_reg_date, awarded_date);
  if (gap !== null && gap >= 0 && gap < 6) {
    score += 25;
    flags.push('Winning supplier was registered less than 6 months before award');
  }

  const desc = (description || '').toLowerCase();
  if (VAGUE_TERMS.some(t => desc.includes(t))) {
    score += 10;
    flags.push('Vague or non-specific scope of work in contract description');
  }

  score = Math.max(0, Math.min(100, score));
  const risk_level = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  if (risk_level === 'LOW' && flags.length === 1) flags.push('No red flags detected in available data');

  return { risk_score: score, risk_level, flags };
}

module.exports = { scoreContract };
