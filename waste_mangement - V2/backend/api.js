/* ═══════════════════════════════════════════════
   BACKEND — GenAI API Layer
   Handles Gemini API calls for reports & scenarios.
   Falls back to simulated responses if no API key.
   ═══════════════════════════════════════════════ */

// ─── GENERATE DAILY REPORT ───
async function generateReportData() {
  const fullBins = Object.entries(STATE.bins).filter(([, b]) => b.fill >= FILL_THRESHOLD_ALERT).map(([k]) => k);
  const topLocality = [...STATE.localities].sort((a, b) => b.score - a.score)[0];

  // Try real Gemini API if key is set
  if (GEMINI_API_KEY) {
    try {
      const prompt = `You are a municipal waste management AI assistant. Generate a concise daily report.
Current Data:
- Segregation score: ${STATE.segregationScore}%
- Bin levels: Wet ${STATE.bins.wet.fill}%, Dry ${STATE.bins.dry.fill}%, Hazardous ${STATE.bins.hazardous.fill}%, Non-recyclable ${STATE.bins.nonrecyclable.fill}%
- Full bins needing pickup: ${fullBins.length > 0 ? fullBins.join(', ') : 'none'}
- Top locality: ${topLocality.name} (${topLocality.score}%)
- Destinations: Compost ${STATE.destinations.compost.capacity}%, Recycling ${STATE.destinations.recycle.capacity}%, Hazardous ${STATE.destinations.hazard.capacity}%, Landfill ${STATE.destinations.landfill.capacity}%

Give: 1) Summary, 2) Key issues, 3) One recommendation. Keep it under 200 words.`;

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from API.';
      return { source: 'gemini', text };
    } catch (err) {
      console.warn('Gemini API error, falling back to simulated:', err);
    }
  }

  // Fallback: simulated report
  return {
    source: 'simulated',
    text: `📋 Daily Waste Management Summary
Generated at ${formatTime(STATE.simHour)} (simulated)

Overall Status: Segregation score stands at ${STATE.segregationScore}%.

Bin Levels:
• Wet waste: ${STATE.bins.wet.fill}% → routed to Compost Facility
• Dry recyclable: ${STATE.bins.dry.fill}% → routed to Recycling Yard
• Hazardous: ${STATE.bins.hazardous.fill}% → routed to Safe Disposal
• Non-recyclable: ${STATE.bins.nonrecyclable.fill}% → routed to Landfill

${fullBins.length > 0 ? `⚠️ Alert: ${fullBins.join(', ')} bin(s) above 80%. Waste picker notification sent.` : '✅ No critical alerts. All bins within normal range.'}

Top Locality: ${topLocality.name} leads with ${topLocality.score}% score.

Destinations: Compost at ${STATE.destinations.compost.capacity}%, Recycling at ${STATE.destinations.recycle.capacity}%, Safe Disposal at ${STATE.destinations.hazard.capacity}%, Landfill at ${STATE.destinations.landfill.capacity}%.

Recommendation: ${STATE.segregationScore < 75 ? 'Segregation training needed in lower-scoring localities.' : 'Maintain current sorting standards. Consider incentive programs for top performers.'}`
  };
}

// ─── WHAT-IF SCENARIO ───
async function whatIfData() {
  if (GEMINI_API_KEY) {
    try {
      const prompt = `You are a municipal waste management analyst. The city currently has 3 collection trucks.
Current data: Bins fill to 80% by 2 PM. Average collection time per route: 4.2 hours. 5 bins stay full longer than 2 hours.
Analyze: What if we add 1 more truck? Give impact on collection time, overflow incidents, fuel costs, and citizen satisfaction. Keep under 150 words.`;

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
      return { source: 'gemini', text };
    } catch (err) {
      console.warn('Gemini API error:', err);
    }
  }

  // Fallback
  return {
    source: 'simulated',
    text: `🔮 What-If Analysis: Add 1 Truck
Scenario simulation (route planning by algorithm, not GenAI)

Current fleet: 3 trucks
Proposed fleet: 4 trucks

Impact Estimates:
• Collection time: 4.2 hours → 3.1 hours (−18% faster)
• Bins staying full longer than 2 hrs: 5 → 1
• Fuel cost increase: +₹2,400/day
• Citizen satisfaction: Expected +12% improvement
• Overflow incidents: Reduced by ~60%

Verdict: Recommended – the added truck pays for itself via reduced overflow clean-up costs (₹4,100/day savings) and improved segregation compliance.

Note: Route planning uses an algorithmic optimizer, not GenAI.`
  };
}

// ─── 3D DIGITAL DUSTBIN: EDUCATIONAL GENAI FEEDBACK (Merged from app.py) ───
const CATEGORY_TIPS = {
  wet: 'Food and organic waste decomposes into nutrient-rich compost.',
  dry: 'Clean paper, plastic, metal and glass are shredded and remanufactured.',
  hazardous: 'Medicines, batteries and e-waste contain toxins requiring safe containment.',
  nonrecyclable: 'Sanitary, soiled and inert waste must be sealed and sent to engineered landfill.'
};

const CATEGORY_NAMES = {
  wet: 'Wet Waste',
  dry: 'Dry Recyclable',
  hazardous: 'Hazardous Waste',
  nonrecyclable: 'Non-Recyclable'
};

async function getWasteEducationalFeedback(declared, seen, isCorrect, itemName = 'waste item') {
  const decName = CATEGORY_NAMES[declared] || declared;
  const seenName = CATEGORY_NAMES[seen] || seen;
  const tip = CATEGORY_TIPS[seen] || 'Ensure waste is segregated at source.';

  // Default intelligent feedback (from app.py)
  let feedback = isCorrect
    ? `Well done! ${itemName} is ${seenName.toLowerCase()} and went into the correct compartment. ${tip}`
    : `This looks like ${seenName.toLowerCase()}, not ${decName.toLowerCase()}. It was automatically re-routed to the ${seenName} compartment. ${tip}`;

  // Try real Gemini AI if key is available
  if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
    try {
      const prompt = `You are a friendly municipal waste-sorting digital twin assistant.
Citizen placed "${itemName}" into the "${decName}" compartment.
Computer Vision analysis classified it as "${seenName}".
Result: ${isCorrect ? 'CORRECT SORTING' : 'WRONG COMPARTMENT (re-routed)'}.
Write at most 2 short sentences (under 40 words) in simple, encouraging language.
Explain why it belongs in ${seenName} and the environmental benefit. No markdown, no emojis.`;

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (aiText) {
        return { text: aiText, source: 'gemini' };
      }
    } catch (err) {
      console.warn('Gemini AI feedback error, using template:', err);
    }
  }

  return { text: feedback, source: 'template' };
}

// ─── OPTIONAL PYTHON BACKEND SYNC ───
// Posts drop event to Python cv_bin_twin server if running on port 5000
async function syncDropWithPythonBackend(dropPayload) {
  try {
    const res = await fetch('http://127.0.0.1:5000/api/drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dropPayload)
    });
    if (res.ok) {
      const data = await res.json();
      console.log('[Backend Sync] Drop recorded in Python backend & SQLite:', data);
      return data;
    }
  } catch {
    // Python backend not running in background, works 100% in browser offline
  }
  return null;
}

