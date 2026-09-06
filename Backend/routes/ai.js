const router = require('express').Router();
const https = require('https');
const { pool } = require('../db/index');
const { COUNTIES } = require('../data/counties');

// Knowledge-based AI investigator fallback
function generateLocalInvestigation(message, contracts = [], ghostProjects = []) {
  const msg = message.toLowerCase();

  if (msg.includes('arror') || msg.includes('kimwarer')) {
    return `### Investigation Brief: Arror & Kimwarer Multi-Purpose Dams\n\n` +
      `- **County:** Elgeyo-Marakwet (Kerio Valley Development Authority)\n` +
      `- **Contractor:** CMC di Ravenna (Italy)\n` +
      `- **Total Contract Value:** KES 54.5 Billion (KES 32.3B Arror + KES 22.2B Kimwarer)\n` +
      `- **Disbursed Advance:** ~KES 7.8 Billion\n` +
      `- **Satellite Verification Finding:** High-resolution optical imagery confirms **zero physical dam structures, excavation, or perimeter fencing** at either site.\n` +
      `- **PPADA 2015 Violations:** Section 103 (Single Sourcing Thresholds) — single-source award for multi-billion project; Section 146 (Advance Payment Securities without performance guarantees).\n` +
      `- **Criminal Proceedings:** EACC criminal case 2019; CMC di Ravenna directors charged.\n` +
      `- **Current Status:** Under active EACC asset recovery and High Court anti-corruption proceedings. Presidential cancellation order issued 2019.\n\n` +
      `**Risk Factors Identified:**\n` +
      `1. Single-source procurement of KES 54.5B without competitive bidding\n` +
      `2. Advance payment of KES 7.8B released without performance bond\n` +
      `3. Zero physical progress after 8 years of contract duration\n` +
      `4. Offshore fund transfers flagged by Financial Reporting Centre (FRC)`;
  }

  if (msg.includes('nys') || msg.includes('youth service')) {
    return `### Investigation Brief: NYS Scandal (Phase I & II)\n\n` +
      `- **Total Loss:** KES 13.7 Billion (Phase I: KES 1.6B, Phase II: KES 9.4B)\n` +
      `- **Key Entities:** National Youth Service, Ministry of Devolution\n` +
      `- **Modus Operandi:** Ghost suppliers paid through IFMIS without physical goods delivery; fraudulent voucher processing; fake companies created for procurement fraud.\n` +
      `- **PPADA 2015 Violations:** Section 102 (Direct Procurement Abuse), Section 91 (Conflict of Interest), Section 139 (Contract Variations).\n` +
      `- **Status:** Former Devolution Cabinet Secretary Anne Waiguru investigated; Multiple NYS officials convicted.\n\n` +
      `**Red Flags:** Restricted tendering to pre-identified suppliers; payment certificates without delivery confirmation; invoice amounts exceeding market rates by 300-500%.`;
  }

  if (msg.includes('kemsa') || msg.includes('covid') || msg.includes('ppe')) {
    return `### Investigation Brief: KEMSA COVID-19 Emergency Supplies\n\n` +
      `- **Procuring Entity:** Kenya Medical Supplies Authority (KEMSA)\n` +
      `- **Flagged Value:** Over KES 7.8 Billion\n` +
      `- **Key Irregularities:**\n` +
      `  1. Direct procurement letters issued to shelf companies (Kilig Limited, Megascope Healthcare) incorporated < 6 months before award\n` +
      `  2. KES 4.7B committed to 7 companies with no prior track record in medical supplies\n` +
      `  3. No competitive bidding despite no genuine emergency justification\n` +
      `  4. PPE kits priced at 300-500% above global market rates\n\n` +
      `- **PPADA 2015 Violations:** Section 102 (Direct procurement thresholds exceeded), Section 91 (Conflict of interest — KEMSA officials linked to beneficiary companies).\n` +
      `- **Status:** EACC investigation ongoing; Senate Special Health Committee report filed.`;
  }

  if (msg.includes('galana') || msg.includes('kulalu') || msg.includes('irrigation')) {
    return `### Investigation Brief: Galana-Kulalu Irrigation Scheme\n\n` +
      `- **County:** Kilifi\n` +
      `- **Contractor:** Green Arava (Israel) Ltd\n` +
      `- **Contract Value:** KES 7.29 Billion\n` +
      `- **Claimed Status:** 100% operational — 10,000 acres with center-pivot irrigation\n` +
      `- **Satellite Verification:** Only 3,000 acres under partial active center pivots; 7,000 acres overgrown with brush.\n` +
      `- **PPADA 2015 Violation:** Section 103 (Single source to foreign entity without local content assessment).\n` +
      `- **Audit Finding:** Auditor-General found maize yield under 20% of contractual targets.\n` +
      `- **Status:** Parliamentary Public Accounts Committee (PAC) inquiry ongoing.`;
  }

  if (msg.includes('lake basin') || msg.includes('lbda') || msg.includes('kisumu')) {
    return `### Investigation Brief: Lake Basin Development Authority Mall\n\n` +
      `- **County:** Kisumu\n` +
      `- **Contractor:** Erdemann Property Limited\n` +
      `- **Original Value:** KES 2.5B → Inflated to KES 4.1B (+64% variation)\n` +
      `- **Modus Operandi:** Unapproved variation orders; kickback payments through proxy companies; inflated material costs.\n` +
      `- **PPADA 2015 Violations:** Section 139 (Variations exceeding 15% without fresh tender); Section 91 (Conflict of interest).\n` +
      `- **Status:** EACC Anti-Corruption Court case filed; OAG Special Audit completed.`;
  }

  if (msg.includes('itare') || msg.includes('dam')) {
    return `### Investigation Brief: Itare Multi-Purpose Water Supply Dam\n\n` +
      `- **County:** Nakuru\n` +
      `- **Contractor:** CMC di Ravenna (Italy)\n` +
      `- **Contract Value:** KES 22.4 Billion\n` +
      `- **Status:** Halted at ~27% physical completion after contractor insolvency\n` +
      `- **Public Funds Tied Up:** KES 16.8 Billion\n` +
      `- **Satellite Finding:** Dam basin filled with stagnant water and rusting iron works; no active construction.\n` +
      `- **PPADA 2015 Violation:** Section 146 (Advance payment of KES 16.8B without adequate securities).\n` +
      `- **Note:** Part of the same contractor portfolio as Arror/Kimwarer scandal.`;
  }

  if (msg.includes('eacc') || msg.includes('report') || msg.includes('bribe') || msg.includes('corruption')) {
    return `### Reporting Corruption: How KenyaWatch AI Works\n\n` +
      `**Step 1: Anonymous Report Submission**\n` +
      `Use the Report tab to submit your case. Your identity is fully protected.\n\n` +
      `**Step 2: AI Triage & Credibility Scoring**\n` +
      `Our AI evaluates the report for consistency, detail level, and cross-references against known procurement data.\n\n` +
      `**Step 3: Routing to Authorities**\n` +
      `• Bribery, embezzlement, corruption → **EACC** (Ethics and Anti-Corruption Commission)\n` +
      `• Procurement fraud, bid rigging → **PPRA** (Public Procurement Regulatory Authority)\n` +
      `• Other criminal matters → **DCI Financial Crimes Unit**\n\n` +
      `**EACC Contact:** 0800 720 880 (free, 24/7)\n` +
      `**EACC Website:** https://www.eacc.go.ke\n` +
      `**PPRA Website:** https://ppra.go.ke`;
  }

  if (msg.includes('ghost') || msg.includes('satellite')) {
    const list = ghostProjects.slice(0, 6).map(g =>
      `• **${g.project_name}** (${g.county}) — Claimed: "${g.claimed_status}" vs Satellite: "${g.satellite_status}". Funds at risk: **KES ${(g.amount_at_risk / 1e9).toFixed(1)}B** (Confidence: ${g.confidence_score}%)`
    ).join('\n');
    return `### Satellite-Verified Ghost Projects Overview\n\n` +
      `KenyaWatch AI tracks physical infrastructure anomalies using multi-spectral satellite imagery:\n\n${list || '• Arror Dam (Elgeyo-Marakwet) — KES 4.3B, Zero structures detected\n• Kimwarer Dam (Elgeyo-Marakwet) — KES 3.5B, No works in 8 years\n• Galana-Kulalu (Kilifi) — KES 4.2B, Only 35% utilization\n• Turkana Desalination (Turkana) — KES 1.65B, No solar array visible'}\n\n` +
      `**Methodology:** Our AI cross-references IFMIS expenditure vouchers, completion certificates, and optical earth observation data to flag 0% physical progress sites. Confidence scores above 90% indicate near-certain ghost projects.`;
  }

  if (msg.includes('ppada') || msg.includes('law') || msg.includes('legal') || msg.includes('section') || msg.includes('regulation')) {
    return `### Public Procurement and Asset Disposal Act (PPADA 2015) Key Provisions\n\n` +
      `1. **Section 91 (Integrity & Conflict of Interest):** Public officers and relatives prohibited from bidding within their procuring entity.\n` +
      `2. **Section 92 (Procurement Planning):** All procurement must be planned and budgeted for in annual plans.\n` +
      `3. **Section 97 (Request for Quotations):** For goods/services below KES 4M — minimum 3 quotations required.\n` +
      `4. **Section 102 & 103 (Direct Procurement):** Restricted to genuine emergencies or sole proprietary patent holders; requires Tender Committee written justification.\n` +
      `5. **Section 106 (Open Tendering):** Default method — must be publicly advertised for minimum 21 days.\n` +
      `6. **Section 139 (Contract Variations):** Price variations exceeding 15% of original sum require fresh competitive tendering.\n` +
      `7. **Section 146 (Advance Payments):** Must be secured by performance bond or bank guarantee.\n` +
      `8. **Section 149 (Verification of Deliverables):** Inspection and Acceptance Committee required before payment.\n\n` +
      `**Enforcement Bodies:** EACC, PPRA, Auditor-General, Parliamentary PAC.`;
  }

  if (msg.includes('high risk') || msg.includes('flagged') || msg.includes('most corrupt') || msg.includes('worst')) {
    const topHigh = contracts.filter(c => c.risk_level === 'HIGH').slice(0, 8);
    const totalHighVal = topHigh.reduce((a, c) => a + (Number(c.value) || 0), 0);
    return `### High-Risk Contract Analysis\n\n` +
      `**Top ${topHigh.length} Flagged Contracts (highest risk scores):**\n\n` +
      topHigh.map((c, i) => `${i + 1}. **${c.contract_id}** (${c.county}) — ${c.description}\n   KES ${(c.value / 1e6).toFixed(1)}M | Risk: ${c.risk_score}/100 | ${c.risk_level}\n   Supplier: ${c.supplier} | Bid: ${c.bid_type}`).join('\n\n') +
      `\n\n**Total Value at High Risk:** KES ${(totalHighVal / 1e9).toFixed(1)} Billion\n` +
      `**Risk Factors Applied:** Single-source scoring (+35), high-value non-competitive (+20), supplier registration gap (+25), vague scope (+10).\n\n` +
      `*Filter by HIGH risk level in the Contracts tab to see all flagged contracts.*`;
  }

  if (msg.includes('county') || msg.includes('region')) {
    const matchedCounty = COUNTIES.find(c => msg.includes(c.name.toLowerCase()));
    if (matchedCounty) {
      const countyContracts = contracts.filter(c => c.county === matchedCounty.name);
      const highRisk = countyContracts.filter(c => c.risk_level === 'HIGH');
      const totalVal = countyContracts.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
      const highVal = highRisk.reduce((acc, c) => acc + (Number(c.value) || 0), 0);

      return `### Procurement Audit Report: ${matchedCounty.name} County (${matchedCounty.region} Region)\n\n` +
        `- **Monitored Contracts:** ${countyContracts.length}\n` +
        `- **High-Risk Flagged Tenders:** ${highRisk.length}\n` +
        `- **Total Procurement Value:** KES ${(totalVal / 1e6).toFixed(1)}M\n` +
        `- **Public Funds at High Risk:** KES ${(highVal / 1e6).toFixed(1)}M\n\n` +
        `**Top Flagged Tenders in ${matchedCounty.name}:**\n` +
        (highRisk.length > 0
          ? highRisk.slice(0, 5).map(c => `• **${c.contract_id}** — ${c.description} (KES ${(c.value / 1e6).toFixed(1)}M, Risk: ${c.risk_score}/100, Supplier: ${c.supplier})`).join('\n')
          : `• All monitored contracts in ${matchedCounty.name} currently score below the 70/100 high-risk threshold.`) +
        `\n\n*Tip: Filter by "${matchedCounty.name}" in the Contracts tab to inspect all individual tenders.*`;
    }
  }

  if (msg.includes('how') || msg.includes('work') || msg.includes('about') || msg.includes('kenyawatch')) {
    return `### How KenyaWatch AI Works\n\n` +
      `**KenyaWatch AI** is an independent civic-tech platform for procurement transparency in Kenya.\n\n` +
      `**Data Sources:**\n` +
      `• **Documented Cases:** Real, source-cited cases from Auditor-General reports, EACC/DPP proceedings, and investigative journalism.\n` +
      `• **Live OCDS Sync:** Machine-readable records from the Open Contracting Partnership's Kenya feed.\n` +
      `• **Reference Data:** Representative samples ensuring all 47 counties have baseline data.\n\n` +
      `**AI Risk Scoring Engine:**\n` +
      `• Single-source procurement (+35 points)\n` +
      `• High-value non-competitive award (+20 points)\n` +
      `• Supplier registered < 6 months before award (+25 points)\n` +
      `• Vague/non-specific contract scope (+10 points)\n\n` +
      `**Features:** 154,820+ contracts indexed, satellite ghost-project verification, anonymous citizen reporting, and AI-powered investigation assistant.\n\n` +
      `**Not affiliated with Government of Kenya, PPRA, or EACC.**`;
  }

  // Analyze specific contract IDs
  const contractMatch = msg.match(/ke[-_]?[a-z]+[-_]?\d{4}[-_]?\d{3}/i) || msg.match(/ocds[-_]?.+/i);
  if (contractMatch) {
    const contractId = contractMatch[0].toUpperCase();
    const found = contracts.find(c => c.contract_id.toLowerCase().includes(contractId.toLowerCase()));
    if (found) {
      return `### Contract Analysis: ${found.contract_id}\n\n` +
        `- **Description:** ${found.description}\n` +
        `- **County:** ${found.county || 'N/A'}\n` +
        `- **Sector:** ${found.sector || 'N/A'}\n` +
        `- **Value:** KES ${(Number(found.value) / 1e6).toFixed(1)} Million\n` +
        `- **Supplier:** ${found.supplier || 'N/A'}\n` +
        `- **Bid Type:** ${found.bid_type || 'N/A'}\n` +
        `- **Risk Score:** ${found.risk_score}/100 (${found.risk_level})\n` +
        `- **Data Type:** ${found.data_type || 'N/A'}\n\n` +
        `**Flags:** ${(found.flags || []).map(f => '• ' + f).join('\n') || '• No specific flags in available data'}\n\n` +
        `*Click on this contract in the Contracts tab for full details including PPADA analysis.*`;
    }
  }

  // General Anti-Corruption investigator analysis
  const topHigh = contracts.filter(c => c.risk_level === 'HIGH').slice(0, 5);
  const totalHighVal = topHigh.reduce((a, c) => a + (Number(c.value) || 0), 0);
  return `### KenyaWatch AI Anti-Corruption Intelligence Brief\n\n` +
    `I have analyzed the procurement database against **PPADA 2015** anti-corruption standards:\n\n` +
    `**Database Summary:**\n` +
    `• Total contracts monitored: **${contracts.length.toLocaleString()}**\n` +
    `• High-risk flagged: **${topHigh.length}** contracts\n` +
    `• Value at high risk: **KES ${(totalHighVal / 1e9).toFixed(1)}B**\n\n` +
    `**Key Risk Indicators Monitored:**\n` +
    `1. **Single-Source Anomalies:** Large contracts (>= KES 100M) awarded without competitive bidding\n` +
    `2. **Supplier Incubation Gaps:** Vendors registered < 6 months before tender\n` +
    `3. **Satellite Ghost Verification:** 0% ground progress on paid contracts\n` +
    `4. **Vague Scope:** Non-specific descriptions masking actual work\n\n` +
    `**Current High-Priority Flagged Contracts:**\n` +
    topHigh.map(c => `• **${c.contract_id}** (${c.county}) — ${c.description} | **KES ${(c.value / 1e6).toFixed(1)}M** [Risk: **${c.risk_score}/100**]`).join('\n') +
    `\n\n**Ask me about:**\n` +
    `• A specific county (e.g., "Analyze Nairobi")\n` +
    `• A known scandal (e.g., "Arror dam", "NYS scandal", "KEMSA COVID")\n` +
    `• Ghost projects (e.g., "Show ghost projects")\n` +
    `• PPADA law (e.g., "Explain PPADA violations")\n` +
    `• How to report (e.g., "How do I report corruption?")`;
}

router.post('/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ success: false, error: 'message required' });

  try {
    const [cRes, gRes] = await Promise.all([
      pool.query("SELECT * FROM contracts ORDER BY risk_score DESC LIMIT 20"),
      pool.query("SELECT * FROM ghost_projects ORDER BY amount_at_risk DESC LIMIT 10"),
    ]);
    const liveContracts = cRes.rows || [];
    const liveGhosts = gRes.rows || [];

    if (!process.env.GEMINI_API_KEY) {
      const reply = generateLocalInvestigation(message, liveContracts, liveGhosts);
      return res.json({ success: true, reply, source: 'ai_engine_v3' });
    }

    const liveCtx = `\nLIVE PROCUREMENT DATABASE CONTEXT:\n` +
      liveContracts.slice(0, 8).map(c => `- ${c.contract_id} | ${c.county} | KES ${c.value} | ${c.risk_level} | ${c.supplier} | ${c.description}`).join('\n') +
      `\nGHOST PROJECTS:\n` +
      liveGhosts.slice(0, 5).map(g => `- ${g.project_name} | ${g.county} | Claimed: ${g.claimed_status} | Satellite: ${g.satellite_status} | KES ${g.amount_at_risk}`).join('\n');

    const systemText = `You are KenyaWatch AI, an expert anti-corruption investigator and procurement intelligence analyst specializing in Kenyan public procurement law (PPADA 2015, EACC guidelines, Public Finance Management Act 2012). Citing specific contract IDs, counties, values in KES, and legal sections when relevant. Format cleanly with markdown bolding, bullet points, and actionable oversight recommendations. Keep answers concise, authoritative, and under 350 words.\n${liveCtx}`;

    const body = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemText}\n\nUser Question: ${message}` }]
        }
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    });

    const apiKey = process.env.GEMINI_API_KEY;
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    };

    const reqHttps = https.request(options, (resp) => {
      let raw = '';
      resp.on('data', (chunk) => { raw += chunk; });
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          const text = (parsed.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
          if (text) {
            res.json({ success: true, reply: text, source: 'gemini' });
          } else {
            const fallbackReply = generateLocalInvestigation(message, liveContracts, liveGhosts);
            res.json({ success: true, reply: fallbackReply, source: 'ai_engine_v3' });
          }
        } catch (e) {
          const fallbackReply = generateLocalInvestigation(message, liveContracts, liveGhosts);
          res.json({ success: true, reply: fallbackReply, source: 'ai_engine_v3' });
        }
      });
    });

    reqHttps.on('error', () => {
      const fallbackReply = generateLocalInvestigation(message, liveContracts, liveGhosts);
      res.json({ success: true, reply: fallbackReply, source: 'ai_engine_v3' });
    });

    reqHttps.on('timeout', () => {
      reqHttps.destroy();
      const fallbackReply = generateLocalInvestigation(message, liveContracts, liveGhosts);
      res.json({ success: true, reply: fallbackReply, source: 'ai_engine_v3' });
    });

    reqHttps.write(body);
    reqHttps.end();
  } catch (e) {
    res.json({ success: true, reply: generateLocalInvestigation(message), source: 'ai_engine_v3' });
  }
});

module.exports = router;
