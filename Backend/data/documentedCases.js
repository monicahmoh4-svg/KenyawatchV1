// Backend/data/documentedCases.js
//
// These records are drawn from publicly reported, widely documented Kenyan
// procurement matters (Auditor-General reports, EACC/DPP proceedings, and
// mainstream reporting). They are seeded with data_type = 'documented' and
// carry a source_name/source_url so the platform never presents them as
// unverified. Figures are the publicly reported figures at time of writing;
// treat them as indicative, not audited financial statements.
//
// This is intentionally a curated set, not a claim of exhaustive national
// coverage — Kenya's Public Procurement Information Portal (PPIP) is not yet
// fully OCDS-compliant, so no single feed currently exposes every contract
// for every county for every year. Use "Sync Live Data" (OCDS) to pull in
// whatever the official portal currently publishes on top of this set.

const documentedContracts = [
  {
    contract_id: 'KE-DOC-ELM-2017-001',
    description: 'Engineering, Procurement & Construction of the Arror Multi-Purpose Dam',
    county: 'Elgeyo-Marakwet',
    sector: 'Water & Irrigation',
    value: 32300000000,
    supplier: 'CMC di Ravenna (Italy)',
    bid_type: 'single_source',
    awarded_date: '2017-06-15',
    procuring_entity: 'Kerio Valley Development Authority (KVDA)',
    status: 'stalled',
    data_type: 'documented',
    source_name: 'Wikipedia / Auditor-General reports / Daily Nation reporting',
    source_url: 'https://en.wikipedia.org/wiki/Arror_and_Kimwarer_Dam_scandal',
    notes: 'Roughly KES 4.3bn was advanced before any construction began; no dam has been built to date.',
  },
  {
    contract_id: 'KE-DOC-ELM-2017-002',
    description: 'Engineering, Procurement & Construction of the Kimwarer Multi-Purpose Dam',
    county: 'Elgeyo-Marakwet',
    sector: 'Water & Irrigation',
    value: 22200000000,
    supplier: 'CMC di Ravenna (Italy)',
    bid_type: 'single_source',
    awarded_date: '2017-06-15',
    procuring_entity: 'Kerio Valley Development Authority (KVDA)',
    status: 'cancelled',
    data_type: 'documented',
    source_name: 'Wikipedia / Al Jazeera / Daily Nation reporting',
    source_url: 'https://en.wikipedia.org/wiki/Arror_and_Kimwarer_Dam_scandal',
    notes: 'An advance of roughly KES 3.5bn was paid out; the project site saw no fencing, surveying or concrete works.',
  },
  {
    contract_id: 'KE-DOC-NKR-2015-001',
    description: 'Construction of the Itare Multi-Purpose Dam',
    county: 'Nakuru',
    sector: 'Water & Irrigation',
    value: 22400000000,
    supplier: 'CMC di Ravenna (Italy)',
    bid_type: 'single_source',
    awarded_date: '2015-11-10',
    procuring_entity: 'Rift Valley Water Works Development Agency',
    status: 'halted',
    data_type: 'documented',
    source_name: 'Eastleigh Voice — PAC / Auditor-General reporting, Apr 2025',
    source_url: 'https://eastleighvoice.co.ke/auditor%20general/136170/pac-clears-kimwarer-arror-itare-dam-queries-despite-gathungu-s-concern-over-sh31bn-debt',
    notes: 'Work stopped after only about 25% of construction was completed; the Auditor-General flagged over KES 31bn in related debt for review.',
  },
];

const documentedGhostProjects = [
  {
    contract_ref: 'KE-DOC-ELM-2017-001',
    project_name: 'Arror Multi-Purpose Dam',
    county: 'Elgeyo-Marakwet',
    sector: 'Water & Irrigation',
    claimed_status: 'Under construction (per original project schedule)',
    satellite_status: 'No dam structure, fencing or access works visible on site',
    amount_at_risk: 4300000000,
    detection_status: 'ghost',
    confidence_score: 90,
    latitude: 0.9421,
    longitude: 35.5623,
    data_type: 'documented',
    source_name: 'Wikipedia / Daily Nation investigative reporting',
    source_url: 'https://en.wikipedia.org/wiki/Arror_and_Kimwarer_Dam_scandal',
  },
  {
    contract_ref: 'KE-DOC-ELM-2017-002',
    project_name: 'Kimwarer Multi-Purpose Dam',
    county: 'Elgeyo-Marakwet',
    sector: 'Water & Irrigation',
    claimed_status: 'Under construction (per original project schedule)',
    satellite_status: 'Site remains undeveloped years after advance payment',
    amount_at_risk: 3500000000,
    detection_status: 'ghost',
    confidence_score: 88,
    latitude: 0.7284,
    longitude: 35.5065,
    data_type: 'documented',
    source_name: 'Wikipedia / Al Jazeera reporting',
    source_url: 'https://en.wikipedia.org/wiki/Arror_and_Kimwarer_Dam_scandal',
  },
  {
    contract_ref: 'KE-DOC-NKR-2015-001',
    project_name: 'Itare Multi-Purpose Dam',
    county: 'Nakuru',
    sector: 'Water & Irrigation',
    claimed_status: 'Substantially complete (per contractor claims)',
    satellite_status: 'Partial works only — construction confirmed halted at ~25% completion',
    amount_at_risk: 16800000000,
    detection_status: 'partial',
    confidence_score: 75,
    latitude: -0.2833,
    longitude: 35.7167,
    data_type: 'documented',
    source_name: 'Eastleigh Voice — Auditor-General reporting, Apr 2025',
    source_url: 'https://eastleighvoice.co.ke/auditor%20general/136170/pac-clears-kimwarer-arror-itare-dam-queries-despite-gathungu-s-concern-over-sh31bn-debt',
  },
];

module.exports = { documentedContracts, documentedGhostProjects };
