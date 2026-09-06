// Backend/data/counties.js
// Canonical list of all 47 Kenyan counties used across the platform
// (filters, seeding, sync heuristics, validation). Keep this list as the
// single source of truth — every other module should import from here
// instead of hard-coding county names.

const COUNTIES = [
  { name: 'Mombasa', code: 'MSA', region: 'Coast' },
  { name: 'Kwale', code: 'KWL', region: 'Coast' },
  { name: 'Kilifi', code: 'KLF', region: 'Coast' },
  { name: 'Tana River', code: 'TRV', region: 'Coast' },
  { name: 'Lamu', code: 'LAM', region: 'Coast' },
  { name: 'Taita Taveta', code: 'TTV', region: 'Coast' },
  { name: 'Garissa', code: 'GRS', region: 'North Eastern' },
  { name: 'Wajir', code: 'WJR', region: 'North Eastern' },
  { name: 'Mandera', code: 'MDR', region: 'North Eastern' },
  { name: 'Marsabit', code: 'MSB', region: 'Eastern' },
  { name: 'Isiolo', code: 'ISL', region: 'Eastern' },
  { name: 'Meru', code: 'MRU', region: 'Eastern' },
  { name: 'Tharaka-Nithi', code: 'THN', region: 'Eastern' },
  { name: 'Embu', code: 'EMB', region: 'Eastern' },
  { name: 'Kitui', code: 'KTI', region: 'Eastern' },
  { name: 'Machakos', code: 'MCK', region: 'Eastern' },
  { name: 'Makueni', code: 'MKN', region: 'Eastern' },
  { name: 'Nyandarua', code: 'NDR', region: 'Central' },
  { name: 'Nyeri', code: 'NYR', region: 'Central' },
  { name: 'Kirinyaga', code: 'KRG', region: 'Central' },
  { name: "Murang'a", code: 'MRG', region: 'Central' },
  { name: 'Kiambu', code: 'KMB', region: 'Central' },
  { name: 'Turkana', code: 'TKN', region: 'Rift Valley' },
  { name: 'West Pokot', code: 'WPK', region: 'Rift Valley' },
  { name: 'Samburu', code: 'SBR', region: 'Rift Valley' },
  { name: 'Trans Nzoia', code: 'TNZ', region: 'Rift Valley' },
  { name: 'Uasin Gishu', code: 'UGS', region: 'Rift Valley' },
  { name: 'Elgeyo-Marakwet', code: 'ELM', region: 'Rift Valley' },
  { name: 'Nandi', code: 'NND', region: 'Rift Valley' },
  { name: 'Baringo', code: 'BRG', region: 'Rift Valley' },
  { name: 'Laikipia', code: 'LKP', region: 'Rift Valley' },
  { name: 'Nakuru', code: 'NKR', region: 'Rift Valley' },
  { name: 'Narok', code: 'NRK', region: 'Rift Valley' },
  { name: 'Kajiado', code: 'KJD', region: 'Rift Valley' },
  { name: 'Kericho', code: 'KRC', region: 'Rift Valley' },
  { name: 'Bomet', code: 'BMT', region: 'Rift Valley' },
  { name: 'Kakamega', code: 'KKG', region: 'Western' },
  { name: 'Vihiga', code: 'VHG', region: 'Western' },
  { name: 'Bungoma', code: 'BNG', region: 'Western' },
  { name: 'Busia', code: 'BSA', region: 'Western' },
  { name: 'Siaya', code: 'SYA', region: 'Nyanza' },
  { name: 'Kisumu', code: 'KSM', region: 'Nyanza' },
  { name: 'Homa Bay', code: 'HMB', region: 'Nyanza' },
  { name: 'Migori', code: 'MGR', region: 'Nyanza' },
  { name: 'Kisii', code: 'KSI', region: 'Nyanza' },
  { name: 'Nyamira', code: 'NYM', region: 'Nyanza' },
  { name: 'Nairobi', code: 'NBI', region: 'Nairobi' },
];

const SECTORS = [
  'Roads & Infrastructure',
  'Health',
  'Water & Irrigation',
  'Education',
  'Agriculture',
  'Energy & Petroleum',
  'ICT & Digital Economy',
  'Security & Defense',
  'Housing & Urban Dev',
  'Judiciary & Governance',
  'Devolution & Planning',
  'Trade & Industry',
  'Environment & Forestry',
  'Transport & Logistics',
];

const COUNTY_NAMES = COUNTIES.map(c => c.name);

function findCounty(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  return COUNTIES.find(c => c.name.toLowerCase() === n) || null;
}

// Best-effort match of a free-text buyer/procuring-entity name to one of the
// 47 counties — used when ingesting external OCDS records that don't carry a
// clean county field.
function matchCountyInText(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const hit = COUNTIES.find(c => t.includes(c.name.toLowerCase()));
  return hit ? hit.name : null;
}

module.exports = { COUNTIES, SECTORS, COUNTY_NAMES, findCounty, matchCountyInText };
