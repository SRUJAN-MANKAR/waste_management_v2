/* ═══════════════════════════════════════════════
   BACKEND — Data Store & Simulation Engine
   All state, business logic, and simulation lives here.
   This file does NOT touch the DOM.
   ═══════════════════════════════════════════════ */

// ─── APPLICATION STATE (the "database") ───
const STATE = {
  currentPage: 'dashboard',
  simHour: 6, // 6 AM start
  loggedIn: false,
  workerRole: 'official',
  workerName: '',
  workerId: '',
  pickups: [],
  scans: [],
  drops: [
    { id: 1, time: '06:12 AM', itemName: 'Organic Banana Peel', itemIcon: '🍌', declared: 'wet', seen: 'wet', correct: true, score: 92, locality: 'Indiranagar' },
    { id: 2, time: '06:28 AM', itemName: 'PET Water Bottle', itemIcon: '🥤', declared: 'dry', seen: 'dry', correct: true, score: 94, locality: 'Indiranagar' },
    { id: 3, time: '06:45 AM', itemName: 'Lithium AA Battery', itemIcon: '🔋', declared: 'wet', seen: 'hazardous', correct: false, score: 92, locality: 'Indiranagar' }
  ],
  eventLog: [],

  // 4 waste categories with fill levels
  bins: {
    wet:           { fill: 35, trend: 'up', collected: false },
    dry:           { fill: 50, trend: 'up', collected: false },
    hazardous:     { fill: 20, trend: 'up', collected: false },
    nonrecyclable: { fill: 45, trend: 'up', collected: false }
  },

  // Locality scores for Bengaluru Leaderboard
  localities: [
    { name: 'Indiranagar',      score: 95, trend: '↑', prev: 92 },
    { name: 'Koramangala',      score: 91, trend: '↑', prev: 88 },
    { name: 'HSR Layout',       score: 88, trend: '↑', prev: 85 },
    { name: 'Jayanagar',        score: 84, trend: '→', prev: 84 },
    { name: 'Malleshwaram',     score: 79, trend: '↓', prev: 81 },
    { name: 'Whitefield',       score: 74, trend: '↓', prev: 77 },
    { name: 'Electronic City',  score: 69, trend: '↑', prev: 65 }
  ],

  segregationScore: 92,
  alerts: 0,
  recycledPct: 78,

  // 4 destination facilities (NOT one dump yard)
  destinations: {
    compost:  { capacity: 62, name: 'Compost Facility',  icon: '🌱', color: 'compost' },
    recycle:  { capacity: 45, name: 'Recycling Yard',    icon: '📦', color: 'recycle' },
    hazard:   { capacity: 18, name: 'Safe Disposal',     icon: '☣️', color: 'hazard' },
    landfill: { capacity: 73, name: 'Landfill',          icon: '🏗️', color: 'landfill' }
  },

  // Registered workers & waste pickers in Bengaluru wards
  workers: [
    { id: 'WK-1001', name: 'Ravi Kumar',   role: 'official', status: 'online',  task: 'ORR East Route',       loc: 'Indiranagar' },
    { id: 'WK-1002', name: 'Priya Sharma', role: 'official', status: 'online',  task: 'South-East Corridor',  loc: 'HSR Layout' },
    { id: 'WK-2001', name: 'Anil Yadav',   role: 'picker',   status: 'online',  task: 'Sorting Recyclables',  loc: 'Koramangala' },
    { id: 'WK-2002', name: 'Sunita Devi',  role: 'picker',   status: 'offline', task: 'Standby for Alerts',   loc: 'Whitefield' }
  ],

  // 12 Smart Bin locations across Bengaluru City (Real GPS Coordinates)
  mapBins: [
    { id: 'B1',  lat: 13.0358, lng: 77.5970, x: 48, y: 15, label: 'Hebbal',          ward: 'Ward 7 (Byatarayanapura)',  fill: 42, zone: 'North' },
    { id: 'B2',  lat: 12.9982, lng: 77.5703, x: 34, y: 28, label: 'Malleshwaram',    ward: 'Ward 45 (Malleshwaram)',    fill: 36, zone: 'West' },
    { id: 'B3',  lat: 12.9982, lng: 77.5530, x: 23, y: 40, label: 'Rajajinagar',     ward: 'Ward 108 (Rajajinagar)',    fill: 54, zone: 'West' },
    { id: 'B4',  lat: 12.9756, lng: 77.6066, x: 50, y: 42, label: 'MG Road (CBD)',   ward: 'Ward 111 (Shantalanagar)',  fill: 84, zone: 'Central' },
    { id: 'B5',  lat: 12.9784, lng: 77.6408, x: 65, y: 39, label: 'Indiranagar',     ward: 'Ward 89 (Jogupalya)',       fill: 30, zone: 'East' },
    { id: 'B6',  lat: 12.9591, lng: 77.6974, x: 77, y: 48, label: 'Marathahalli',    ward: 'Ward 85 (Doddanekkundi)',   fill: 78, zone: 'East' },
    { id: 'B7',  lat: 12.9698, lng: 77.7499, x: 88, y: 43, label: 'Whitefield',      ward: 'Ward 84 (Hagadur)',         fill: 68, zone: 'East' },
    { id: 'B8',  lat: 12.9352, lng: 77.6245, x: 58, y: 56, label: 'Koramangala',     ward: 'Ward 151 (Koramangala)',    fill: 48, zone: 'South-East' },
    { id: 'B9',  lat: 12.9308, lng: 77.5838, x: 42, y: 63, label: 'Jayanagar',       ward: 'Ward 153 (Jayanagar)',      fill: 26, zone: 'South' },
    { id: 'B10', lat: 12.9121, lng: 77.6446, x: 67, y: 68, label: 'HSR Layout',      ward: 'Ward 174 (HSR Layout)',     fill: 52, zone: 'South-East' },
    { id: 'B11', lat: 12.9166, lng: 77.6101, x: 51, y: 74, label: 'BTM Layout',      ward: 'Ward 176 (BTM Layout)',     fill: 86, zone: 'South' },
    { id: 'B12', lat: 12.8452, lng: 77.6602, x: 74, y: 88, label: 'Electronic City', ward: 'Phase 1 Tech Corridor',     fill: 46, zone: 'South' }
  ]
};

// ─── SIMULATION ENGINE ───

// Advance simulation by 1 hour
function simulateHour() {
  const h = STATE.simHour;

  if (h >= 6 && h <= 8) {
    // Households fill bins (morning)
    addFill(8, 12);
    return { action: 'fill', msg: 'Households adding waste to bins.' };
  }
  else if (h >= 8 && h <= 10) {
    // Official morning collection
    if (!STATE.bins.wet.collected) {
      Object.keys(STATE.bins).forEach(k => {
        STATE.bins[k].fill = Math.max(5, STATE.bins[k].fill - 40);
        STATE.bins[k].collected = true;
      });
      // Increase destination capacity
      STATE.destinations.compost.capacity = Math.min(100, STATE.destinations.compost.capacity + 8);
      STATE.destinations.recycle.capacity = Math.min(100, STATE.destinations.recycle.capacity + 6);
      STATE.destinations.hazard.capacity  = Math.min(100, STATE.destinations.hazard.capacity + 3);
      STATE.destinations.landfill.capacity = Math.min(100, STATE.destinations.landfill.capacity + 5);
      // Workers go online
      STATE.workers[0].status = 'online';
      STATE.workers[0].task = 'Collecting route A';
      STATE.workers[1].status = 'online';
      STATE.workers[1].task = 'Collecting route B';
      return { action: 'collect', msg: '🚛 Official workers collecting waste from bins.', toast: { type: 'success', text: '🚛 Official workers have begun morning collection!' } };
    }
    return { action: 'collect', msg: 'Collection in progress.' };
  }
  else if (h >= 10 && h <= 17) {
    // Bins refill during the day
    addFill(5, 10);
    if (h > 10) {
      STATE.workers[0].status = 'offline';
      STATE.workers[0].task = 'Off duty';
      STATE.workers[1].status = 'offline';
      STATE.workers[1].task = 'Off duty';
    }
    return { action: 'refill', msg: 'Bins refilling during the day.' };
  }
  else if (h >= 17) {
    addFill(3, 6);
    return { action: 'refill', msg: 'Evening waste additions.' };
  }

  return { action: 'fill', msg: 'System idle.' };
}

// Check for full bins → trigger alerts
function checkAlerts() {
  let anyFull = false;
  Object.keys(STATE.bins).forEach(k => {
    if (STATE.bins[k].fill >= FILL_THRESHOLD_ALERT) anyFull = true;
  });

  if (anyFull) {
    STATE.alerts = Object.values(STATE.bins).filter(b => b.fill >= FILL_THRESHOLD_ALERT).length;
    // Pickers go online
    STATE.workers[2].status = 'online';
    STATE.workers[2].task = 'Responding to alert';
    STATE.workers[2].loc = 'En route';
    STATE.workers[3].status = 'online';
    STATE.workers[3].task = 'Responding to alert';
    STATE.workers[3].loc = 'En route';
    return { alert: true, msg: '⚠️ Bin(s) above 80% – alerting nearby waste pickers!' };
  } else {
    STATE.alerts = 0;
    return { alert: false };
  }
}

// Add random fill to all bins
function addFill(min, max) {
  Object.keys(STATE.bins).forEach(k => {
    const add = min + Math.floor(Math.random() * (max - min));
    STATE.bins[k].fill = Math.min(100, STATE.bins[k].fill + add);
  });
}

// Reset at midnight
function midnightReset() {
  Object.keys(STATE.bins).forEach(k => STATE.bins[k].collected = false);
}

// Tweak segregation score randomly
function tweakScore() {
  const delta = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3);
  STATE.segregationScore = Math.max(40, Math.min(100, STATE.segregationScore + delta));
}

// ─── CV CLASSIFICATION (simulated) ───
function classifyImage() {
  const categories = [
    { type: 'wet',           label: 'Wet Waste',      icon: '🟢', bag: 'Green', dest: 'Compost Facility',  conf: 87 + Math.floor(Math.random() * 10) },
    { type: 'dry',           label: 'Dry Recyclable',  icon: '🔵', bag: 'Blue',  dest: 'Recycling Yard',   conf: 82 + Math.floor(Math.random() * 13) },
    { type: 'hazardous',     label: 'Hazardous Waste', icon: '🔴', bag: 'Red',   dest: 'Safe Disposal Unit', conf: 78 + Math.floor(Math.random() * 15) },
    { type: 'nonrecyclable', label: 'Non-Recyclable',  icon: '⚫', bag: 'Black', dest: 'Landfill',         conf: 80 + Math.floor(Math.random() * 15) }
  ];
  return categories[Math.floor(Math.random() * categories.length)];
}

// Check if sorting is wrong (20% chance)
function checkWrongSort(resultType) {
  return Math.random() < 0.2;
}

// Process a collection/drop-off
function processDropoff(type, weight) {
  STATE.bins[type].fill = Math.max(5, STATE.bins[type].fill - 35);
  const destMap = { wet: 'compost', dry: 'recycle', hazardous: 'hazard', nonrecyclable: 'landfill' };
  STATE.destinations[destMap[type]].capacity = Math.min(100, STATE.destinations[destMap[type]].capacity + 4);
}

// Get full bins for collector portal
function getFullBins() {
  const result = [];
  Object.entries(STATE.bins).forEach(([type, bin]) => {
    if (bin.fill >= FILL_THRESHOLD_PICKUP) {
      result.push({ type, fill: bin.fill });
    }
  });
  return result;
}

// ─── HELPERS ───
function formatTime(h) {
  const suffix = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(display).padStart(2, '0')}:00 ${suffix}`;
}

// ─── 3D DIGITAL DUSTBIN SAMPLE CATALOG (Merged from app.py) ───
const WASTE_SAMPLE_CATALOG = [
  {
    id: 'apple',
    name: 'Organic Apple Core / Scrap',
    type: 'wet',
    icon: '🍏',
    conf: 98.4,
    bag: 'Green',
    dest: 'Compost Facility',
    tip: 'Food and garden waste can become nutrient-rich organic compost.'
  },
  {
    id: 'bottle',
    name: 'PET Plastic Water Bottle',
    type: 'dry',
    icon: '🥤',
    conf: 97.6,
    bag: 'Blue',
    dest: 'Recycling Yard',
    tip: 'Clean plastic bottles, containers, and jars are shredded and recycled.'
  },
  {
    id: 'box',
    name: 'Corrugated Cardboard Box',
    type: 'dry',
    icon: '📦',
    conf: 96.2,
    bag: 'Blue',
    dest: 'Recycling Yard',
    tip: 'Clean paper and corrugated cardboard go to paper recyclers.'
  },
  {
    id: 'can',
    name: 'Aluminum Beverage Can',
    type: 'dry',
    icon: '🥫',
    conf: 99.1,
    bag: 'Blue',
    dest: 'Recycling Yard',
    tip: 'Metals can be infinitely recycled without losing structural purity.'
  },
  {
    id: 'battery',
    name: 'Lithium Battery Pack',
    type: 'hazardous',
    icon: '🔋',
    conf: 98.7,
    bag: 'Red',
    dest: 'Safe Disposal Unit',
    tip: 'Batteries contain hazardous heavy metals and require specialized safe disposal.'
  },
  {
    id: 'medicine',
    name: 'Expired Pharmaceuticals',
    type: 'hazardous',
    icon: '💊',
    conf: 95.8,
    bag: 'Red',
    dest: 'Safe Disposal Unit',
    tip: 'Medicines and chemicals can poison aquifers and must never enter landfills.'
  },
  {
    id: 'ceramic',
    name: 'Broken Ceramic Coffee Mug',
    type: 'nonrecyclable',
    icon: '☕',
    conf: 94.2,
    bag: 'Black',
    dest: 'Landfill',
    tip: 'Inert ceramics and heat-treated crockery cannot be melted down and go to landfill.'
  },
  {
    id: 'sanitary',
    name: 'Soiled Sanitary Wrap',
    type: 'nonrecyclable',
    icon: '🩹',
    conf: 96.5,
    bag: 'Black',
    dest: 'Landfill',
    tip: 'Sanitary and soiled items cannot be recycled and must be sealed for landfill.'
  }
];

// Record a 3D waste drop event into application state & update digital twin
function recordDropInState(dropData) {
  const { declared, seen, isCorrect, itemName, itemIcon, imageSrc } = dropData;

  // 1. Update bin fill level
  if (STATE.bins[seen]) {
    STATE.bins[seen].fill = Math.min(100, STATE.bins[seen].fill + 5);
  }

  // 2. Update segregation score
  if (isCorrect) {
    STATE.segregationScore = Math.min(100, STATE.segregationScore + 2);
  } else {
    STATE.segregationScore = Math.max(30, STATE.segregationScore - 2);
    STATE.alerts++;
  }

  // 3. Update destination facility capacities
  const destMap = { wet: 'compost', dry: 'recycle', hazardous: 'hazard', nonrecyclable: 'landfill' };
  if (destMap[seen] && STATE.destinations[destMap[seen]]) {
    STATE.destinations[destMap[seen]].capacity = Math.min(100, STATE.destinations[destMap[seen]].capacity + 3);
  }

  // 4. Prepend to drops history
  const dropRecord = {
    id: STATE.drops.length + 1,
    time: formatTime(STATE.simHour),
    itemName: itemName || 'Waste Item',
    itemIcon: itemIcon || '📦',
    declared: declared,
    seen: seen,
    correct: isCorrect,
    score: STATE.segregationScore,
    locality: 'Indiranagar',
    imageSrc: imageSrc || ''
  };
  STATE.drops.unshift(dropRecord);

  // 5. Prepend to scans list
  const catInfo = WASTE_SAMPLE_CATALOG.find(c => c.type === seen) || { bag: 'Identified', dest: 'Designated Yard' };
  STATE.scans.unshift({
    type: itemName || catInfo.name || seen,
    icon: itemIcon || '📦',
    time: formatTime(STATE.simHour),
    img: imageSrc || '',
    conf: catInfo.conf || 95
  });

  return dropRecord;
}

