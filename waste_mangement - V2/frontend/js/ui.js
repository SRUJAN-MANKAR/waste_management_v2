/* ═══════════════════════════════════════════════
   FRONTEND — UI Rendering & Event Handlers
   Handles all DOM manipulation, navigation,
   rendering, and user interactions.
   Depends on: backend/config.js, backend/data.js, backend/api.js
   ═══════════════════════════════════════════════ */

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  setupStartPage();
  setupNavigation();
  setupSmartBin();
  setupCollector();
  setupSimClock();
  renderDashboard();
  renderTracking();
  startFlowAnimation();
  addLog('System initialized. Households begin filling bins.');
});

// ═══════════════════════════════════════════════
// START SCREEN LOGIC
// ═══════════════════════════════════════════════

let startCvInterval = null;

function setupStartPage() {
  const btnStart = document.getElementById('btnStartPlatform');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      enterPlatform('dashboard');
    });
  }

  // Direct jump links
  document.querySelectorAll('.btn-direct').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.jump || 'dashboard';
      enterPlatform(target);
    });
  });

  // Return to Start Page buttons in sidebar
  const btnReturn = document.getElementById('btnReturnStart');
  if (btnReturn) {
    btnReturn.addEventListener('click', showStartScreen);
  }
  const sidebarLogo = document.getElementById('sidebarLogo');
  if (sidebarLogo) {
    sidebarLogo.addEventListener('click', showStartScreen);
  }

  // Start continuous CV Bin Scanner animation on Start Screen
  initStartCvScanner();
}

function enterPlatform(targetPage = 'dashboard') {
  const startScreen = document.getElementById('startScreen');
  if (!startScreen) return;

  // Visual leaving transition
  startScreen.classList.add('leaving');

  // Switch to target view
  switchPage(targetPage);

  setTimeout(() => {
    startScreen.classList.remove('active');
    startScreen.classList.remove('leaving');
    showToast('success', '🚀 Welcome to EcoSync! Smart Waste & CV Bin Digital Twin is live.');
  }, 480);
}

function showStartScreen() {
  const startScreen = document.getElementById('startScreen');
  if (!startScreen) return;
  startScreen.classList.remove('leaving');
  startScreen.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initStartCvScanner() {
  const cvItems = [
    { icon: '🥤', cat: 'PLASTIC BOTTLE', conf: '97.8% RECYCLABLE', chamber: 'DRY RECYCLABLE', color: '#34D399' },
    { icon: '🍏', cat: 'ORGANIC WASTE', conf: '99.1% BIODEGRADABLE', chamber: 'WET COMPOST', color: '#22C55E' },
    { icon: '🔋', cat: 'LITHIUM CELL', conf: '98.5% HAZARDOUS', chamber: 'HAZARDOUS E-WASTE', color: '#EF4444' },
    { icon: '📦', cat: 'CARDBOARD BOX', conf: '96.4% RECYCLABLE', chamber: 'DRY RECYCLABLE', color: '#34D399' },
    { icon: '☕', cat: 'CERAMIC CUP', conf: '94.2% NON-RECYCLABLE', chamber: 'NON-RECYCLABLE INERT', color: '#94A3B8' }
  ];

  let idx = 0;
  const iconEl = document.getElementById('startCvIcon');
  const tagEl = document.getElementById('startCvTag');
  const tickerEl = document.getElementById('startCvTicker');

  if (!iconEl || !tagEl || !tickerEl) return;

  if (startCvInterval) clearInterval(startCvInterval);

  startCvInterval = setInterval(() => {
    idx = (idx + 1) % cvItems.length;
    const item = cvItems[idx];

    // Fade effect
    iconEl.style.opacity = '0';
    tagEl.style.opacity = '0';

    setTimeout(() => {
      iconEl.textContent = item.icon;
      tagEl.innerHTML = `
        <span class="tag-cat" style="color:#FFFFFF">${item.cat}</span>
        <span class="tag-conf" style="color:${item.color}">${item.conf}</span>
      `;
      tickerEl.textContent = `AUTO-SORTING INTO [${item.chamber}] CHAMBER`;
      iconEl.style.opacity = '1';
      tagEl.style.opacity = '1';
    }, 200);
  }, 3000);
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchPage(link.dataset.page);
    });
  });
}

function switchPage(page) {
  STATE.currentPage = page;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const targetLink = document.querySelector(`[data-page="${page}"]`);
  if (targetLink) targetLink.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPageEl = document.getElementById(`page-${page}`);
  if (targetPageEl) targetPageEl.classList.add('active');

  // Ensure real map renders smoothly upon tab activation
  if (page === 'dashboard') {
    setTimeout(() => {
      renderLocalityMap();
    }, 60);
  }

  // Ensure 3D Three.js canvas dynamically calculates viewport size
  if (page === 'smartbin') {
    setTimeout(() => {
      if (typeof BinTwin3D !== 'undefined') {
        BinTwin3D.resize();
      }
    }, 80);
  }
}

// ═══════════════════════════════════════════════
// SIMULATION CLOCK
// ═══════════════════════════════════════════════

function setupSimClock() {
  document.getElementById('btnAdvanceTime').addEventListener('click', advanceHour);
}

function advanceHour() {
  STATE.simHour++;
  if (STATE.simHour > 23) STATE.simHour = 0;
  updateClockDisplay();

  // Run backend simulation
  const result = simulateHour();
  addLog(result.msg);
  if (result.toast) showToast(result.toast.type, result.toast.text);
  updateTimeline(result.action);

  // Check alerts
  const alertResult = checkAlerts();
  if (alertResult.alert) {
    addLog(alertResult.msg);
    showToast('warning', '🔔 Full bin alert sent to registered waste pickers!');
  }

  // Reset at midnight
  if (STATE.simHour === 0) {
    midnightReset();
    addLog('🌙 New day begins. Collection status reset.');
  }

  // Tweak score
  tweakScore();

  // Re-render all views
  renderDashboard();
  renderSmartBinFills();
  renderTracking();
}

function updateClockDisplay() {
  const h = STATE.simHour;
  const suffix = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  document.getElementById('simTime').textContent = `${String(display).padStart(2, '0')}:00 ${suffix}`;
}

// ═══════════════════════════════════════════════
// DASHBOARD RENDERING
// ═══════════════════════════════════════════════

function renderDashboard() {
  document.getElementById('valSegScore').textContent = STATE.segregationScore + '%';
  document.getElementById('valAlerts').textContent = STATE.alerts;
  document.getElementById('valRecycled').textContent = STATE.recycledPct + '%';

  // Alert card pulse
  const alertCard = document.getElementById('statAlerts');
  if (STATE.alerts > 0) alertCard.classList.add('alert-active');
  else alertCard.classList.remove('alert-active');

  // Leaderboard
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = '';
  const sorted = [...STATE.localities].sort((a, b) => b.score - a.score);
  sorted.forEach((loc, i) => {
    const tr = document.createElement('tr');
    const trendColor = loc.trend === '↑' ? '#059669' : loc.trend === '↓' ? '#EF4444' : '#F59E0B';
    tr.innerHTML = `
      <td style="font-weight:700; color:${i < 3 ? '#059669' : 'inherit'}">${i + 1}</td>
      <td>${loc.name}</td>
      <td><strong>${loc.score}%</strong></td>
      <td style="color:${trendColor}; font-weight:700">${loc.trend} ${loc.score - loc.prev > 0 ? '+' : ''}${loc.score - loc.prev}</td>
    `;
    tbody.appendChild(tr);
  });

  renderLocalityMap();
  renderUnits();
}

// ═══════════════════════════════════════════════
// REAL 100% OFFLINE BENGALURU DIGITAL TWIN MAP
// (Zero API Keys · Zero External CDN · Zero Network Calls)
// ═══════════════════════════════════════════════

let blrMapFilter = 'all';
let blrZoomLevel = 1;
let blrPanX = 0;
let blrPanY = 0;
let blrSelectedBin = null;

// Real geographic projection for Greater Bengaluru Urban coordinates
function blrGeoToSvg(lat, lng) {
  const minLat = 12.8200, maxLat = 13.0600;
  const minLng = 77.4900, maxLng = 77.7700;
  const x = 50 + ((lng - minLng) / (maxLng - minLng)) * 900;
  const y = 35 + ((maxLat - lat) / (maxLat - minLat)) * 570;
  return { x: Math.round(x), y: Math.round(y) };
}

function renderLocalityMap() {
  const container = document.getElementById('localityMap');
  if (!container) return;

  // Filter bins according to selected filter
  const visibleBins = STATE.mapBins.filter(bin => {
    if (blrMapFilter === 'critical') return bin.fill >= 80;
    if (blrMapFilter === 'orr') return ['Hebbal', 'Marathahalli', 'HSR Layout', 'BTM Layout', 'Koramangala'].includes(bin.label);
    return true; // 'all' or 'eco'
  });

  // Build the complete 100% offline Bengaluru Digital Twin Map
  container.innerHTML = `
    <div class="offline-blr-map-wrapper">
      
      <!-- Interactive Top Toolbar -->
      <div class="blr-map-toolbar">
        <div class="blr-filter-group">
          <button class="btn-map-filter ${blrMapFilter === 'all' ? 'active' : ''}" onclick="setBlrMapFilter('all')">
            📍 All Nodes (${STATE.mapBins.length})
          </button>
          <button class="btn-map-filter ${blrMapFilter === 'critical' ? 'active' : ''}" onclick="setBlrMapFilter('critical')">
            ⚠️ Critical (&gt;80%)
          </button>
          <button class="btn-map-filter ${blrMapFilter === 'orr' ? 'active' : ''}" onclick="setBlrMapFilter('orr')">
            🚛 ORR Transit Corridor
          </button>
          <button class="btn-map-filter ${blrMapFilter === 'eco' ? 'active' : ''}" onclick="setBlrMapFilter('eco')">
            💧 Lakes &amp; Parks
          </button>
        </div>

        <div class="blr-view-controls">
          <button class="btn-map-zoom" onclick="zoomBlrMap(0.2)" title="Zoom In">+</button>
          <button class="btn-map-zoom" onclick="zoomBlrMap(-0.2)" title="Zoom Out">−</button>
          <button class="btn-map-zoom" onclick="resetBlrMapView()" title="Reset View">⟲</button>
        </div>
      </div>

      <!-- Real Vector SVG Stage -->
      <div class="blr-svg-stage-container" id="blrSvgStage">
        <svg viewBox="0 0 1000 640" class="blr-vector-map-svg" id="blrSvgMap">
          <defs>
            <!-- Boundary Gradient -->
            <radialGradient id="bbmpCityGrad" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stop-color="#F0FDF4" stop-opacity="0.95" />
              <stop offset="60%" stop-color="#DCFCE7" stop-opacity="0.80" />
              <stop offset="100%" stop-color="#BBF7D0" stop-opacity="0.55" />
            </radialGradient>

            <!-- Lake Water Gradient -->
            <linearGradient id="lakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#38BDF8" />
              <stop offset="100%" stop-color="#0284C7" />
            </linearGradient>

            <!-- Park Canopy Gradient -->
            <linearGradient id="parkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#4ADE80" />
              <stop offset="100%" stop-color="#16A34A" />
            </linearGradient>

            <!-- Glow Filter for Highways -->
            <filter id="corridorGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <!-- Scalable & Pannable Group -->
          <g id="blrMapRootGroup" transform="translate(${blrPanX}, ${blrPanY}) scale(${blrZoomLevel})">
            
            <!-- 1. Coordinate Grid Lines (100% accurate Bengaluru Lat/Lng) -->
            <g class="carto-grid" opacity="0.35">
              <!-- Latitudes -->
              <line x1="50" y1="92" x2="950" y2="92" stroke="#94A3B8" stroke-dasharray="3,3" />
              <text x="58" y="88" class="grid-coord-label">13.03° N (Hebbal Corridor)</text>

              <line x1="50" y1="235" x2="950" y2="235" stroke="#94A3B8" stroke-dasharray="3,3" />
              <text x="58" y="231" class="grid-coord-label">12.97° N (Central CBD / MG Road)</text>

              <line x1="50" y1="375" x2="950" y2="375" stroke="#94A3B8" stroke-dasharray="3,3" />
              <text x="58" y="371" class="grid-coord-label">12.91° N (Silk Board / BTM)</text>

              <line x1="50" y1="545" x2="950" y2="545" stroke="#94A3B8" stroke-dasharray="3,3" />
              <text x="58" y="541" class="grid-coord-label">12.84° N (Electronic City Expressway)</text>

              <!-- Longitudes -->
              <line x1="250" y1="40" x2="250" y2="600" stroke="#94A3B8" stroke-dasharray="3,3" />
              <text x="254" y="595" class="grid-coord-label">77.55° E (West BBMP)</text>

              <line x1="425" y1="40" x2="425" y2="600" stroke="#94A3B8" stroke-dasharray="3,3" />
              <text x="429" y="595" class="grid-coord-label">77.60° E (CBD Axis)</text>

              <line x1="715" y1="40" x2="715" y2="600" stroke="#94A3B8" stroke-dasharray="3,3" />
              <text x="719" y="595" class="grid-coord-label">77.70° E (East Tech Corridor)</text>
            </g>

            <!-- 2. Greater Bengaluru Municipal (BBMP) Geographical Boundary Polygon -->
            <path d="M 390 40 
                     C 480 45, 580 70, 640 100 
                     C 700 130, 800 160, 870 210 
                     C 930 250, 960 300, 940 360 
                     C 910 420, 840 460, 770 500 
                     C 710 540, 660 610, 580 620 
                     C 500 630, 430 590, 370 550 
                     C 300 510, 220 480, 150 430 
                     C 80 380, 50 320, 60 250 
                     C 70 180, 130 130, 190 90 
                     C 260 55, 330 40, 390 40 Z" 
                  fill="url(#bbmpCityGrad)" 
                  stroke="#10B981" 
                  stroke-width="2.5" 
                  class="bbmp-boundary" />

            <!-- BBMP Administrative Zones Watermarks -->
            <g class="zone-labels" opacity="0.32" font-family="'Montserrat', sans-serif" font-weight="800" font-size="14" fill="#047857" letter-spacing="2">
              <text x="360" y="70" text-anchor="middle">BBMP NORTH (YELAHANKA / HEBBAL)</text>
              <text x="760" y="220" text-anchor="middle">BBMP EAST (WHITEFIELD)</text>
              <text x="400" y="275" text-anchor="middle">BBMP CENTRAL (CBD)</text>
              <text x="170" y="240" text-anchor="middle">BBMP WEST (RAJAJINAGAR)</text>
              <text x="400" y="450" text-anchor="middle">BBMP SOUTH (JAYANAGAR / BTM)</text>
              <text x="640" y="580" text-anchor="middle">BOMMANAHALLI / E-CITY</text>
            </g>

            <!-- 3. Real Bengaluru Arterial Highways -->
            <g class="blr-highways">
              <!-- NH 44 North: Bellary Road / Kempegowda International Airport Highway -->
              <path d="M 394 15 L 394 235" stroke="#94A3B8" stroke-width="4" stroke-linecap="round" />
              <path d="M 394 15 L 394 235" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="6,4" />

              <!-- NH 44 South: Hosur Road Elevated Expressway to Electronic City -->
              <path d="M 477 374 Q 540 460 597 545 L 620 615" stroke="#94A3B8" stroke-width="4.5" stroke-linecap="round" />
              <path d="M 477 374 Q 540 460 597 545 L 620 615" stroke="#FDE047" stroke-width="1.8" stroke-dasharray="6,4" />

              <!-- Old Airport Road / HAL Highway to Whitefield -->
              <path d="M 425 235 Q 560 250 717 275 L 885 250" stroke="#94A3B8" stroke-width="3.5" />
              <path d="M 425 235 Q 560 250 717 275 L 885 250" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="5,4" />

              <!-- Mysore Road (South-West Corridor) -->
              <path d="M 425 235 Q 260 270 142 311 L 60 380" stroke="#94A3B8" stroke-width="3.5" />

              <!-- Tumkur Road NH 48 (North-West Corridor) -->
              <path d="M 213 110 L 80 40" stroke="#94A3B8" stroke-width="3.5" />

              <!-- Namma Metro Purple & Green Transit Intersect -->
              <line x1="80" y1="235" x2="900" y2="235" stroke="#A855F7" stroke-width="2.5" stroke-dasharray="8,5" opacity="0.6" title="Namma Metro Purple Line" />
              <line x1="394" y1="40" x2="394" y2="580" stroke="#22C55E" stroke-width="2.5" stroke-dasharray="8,5" opacity="0.6" title="Namma Metro Green Line" />
            </g>

            <!-- 4. Real Bengaluru Water Bodies & Lakes (High Cartographic Fidelity) -->
            <g class="blr-lakes">
              <!-- Hebbal Lake (North) -->
              <g class="lake-group" onclick="showBlrFeature('Hebbal Lake', '💧 150-Acre North Bengaluru Wetland &amp; Bird Sanctuary', 'Eco-Zone: Clean · Zero Dumping Zone')">
                <ellipse cx="378" cy="80" rx="26" ry="14" fill="url(#lakeGrad)" stroke="#0284C7" stroke-width="1.5" />
                <text x="378" y="83" class="lake-text">Hebbal Lake</text>
              </g>

              <!-- Sankey Tank (Malleshwaram / Sadashivanagar) -->
              <g class="lake-group" onclick="showBlrFeature('Sankey Tank', '💧 Historic 37-Acre Heritage Reservoir built in 1882', 'Eco-Zone: Maintained · Aeration Active')">
                <ellipse cx="320" cy="160" rx="16" ry="12" fill="url(#lakeGrad)" stroke="#0284C7" stroke-width="1.5" />
                <text x="320" y="163" class="lake-text">Sankey Tank</text>
              </g>

              <!-- Ulsoor Lake (Halasuru / CBD East) -->
              <g class="lake-group" onclick="showBlrFeature('Ulsoor Lake', '💧 120-Acre Central Bengaluru Lake with Heritage Islands', 'Eco-Zone: Monitored · Silt Traps Active')">
                <ellipse cx="468" cy="220" rx="24" ry="15" fill="url(#lakeGrad)" stroke="#0284C7" stroke-width="1.5" />
                <circle cx="468" cy="220" r="4" fill="#16A34A" /> <!-- Ulsoor Island -->
                <text x="468" y="223" class="lake-text">Ulsoor Lake</text>
              </g>

              <!-- Bellandur Lake (SE Tech Corridor - Bengaluru's largest lake) -->
              <g class="lake-group" onclick="showBlrFeature('Bellandur Lake', '💧 892-Acre Largest Wetland Corridor · BBMP Rejuvenated', 'Eco-Zone: Priority Monitoring · Smart Trash Booms Active')">
                <path d="M 610 330 C 630 315, 665 320, 680 332 C 690 348, 665 365, 640 355 C 625 350, 605 342, 610 330 Z" fill="url(#lakeGrad)" stroke="#0284C7" stroke-width="1.5" />
                <text x="645" y="340" class="lake-text">Bellandur Lake</text>
              </g>

              <!-- Agara Lake (HSR Layout) -->
              <g class="lake-group" onclick="showBlrFeature('Agara Lake', '💧 98-Acre Rejuvenated Ecosystem with Citizen Walking Trail', 'Eco-Zone: Protected · Solar Aerators Active')">
                <ellipse cx="570" cy="365" rx="18" ry="12" fill="url(#lakeGrad)" stroke="#0284C7" stroke-width="1.5" />
                <text x="570" y="368" class="lake-text">Agara Lake</text>
              </g>

              <!-- Madiwala Lake (BTM / Silk Board) -->
              <g class="lake-group" onclick="showBlrFeature('Madiwala Lake', '💧 270-Acre Historic Lake dating back to Chola Dynasty', 'Eco-Zone: Active Eco-Buffer · Waste Diversion 100%')">
                <ellipse cx="460" cy="380" rx="22" ry="14" fill="url(#lakeGrad)" stroke="#0284C7" stroke-width="1.5" />
                <text x="460" y="383" class="lake-text">Madiwala Lake</text>
              </g>
            </g>

            <!-- 5. Real Bengaluru Green Lung Spaces -->
            <g class="blr-parks">
              <!-- Cubbon Park (CBD) -->
              <g class="park-group" onclick="showBlrFeature('Cubbon Park', '🌳 300-Acre Historic Green Lung of Central Bengaluru', 'Zero-Plastic Heritage Zone')">
                <rect x="375" y="222" width="36" height="24" rx="8" fill="url(#parkGrad)" stroke="#15803D" stroke-width="1.5" />
                <text x="393" y="237" class="park-text">Cubbon Park 🌳</text>
              </g>

              <!-- Lalbagh Botanical Gardens (South) -->
              <g class="park-group" onclick="showBlrFeature('Lalbagh Botanical Garden', '🌺 240-Acre Botanical Garden with Glass House &amp; Lake', 'Zero-Waste Organic Composting Sanctuary')">
                <rect x="345" y="285" width="40" height="28" rx="8" fill="url(#parkGrad)" stroke="#15803D" stroke-width="1.5" />
                <circle cx="375" cy="303" r="4" fill="#38BDF8" /> <!-- Lalbagh Lake -->
                <text x="365" y="301" class="park-text">Lalbagh 🌺</text>
              </g>
            </g>

            <!-- 6. Outer Ring Road (ORR) Dedicated Waste Logistics Arterial Corridor -->
            <g class="blr-orr-loop" filter="url(#corridorGlow)">
              <path id="orrTransitRoute" 
                    d="M 394 92 
                       C 450 105, 480 120, 506 135 
                       C 540 148, 560 152, 575 159 
                       C 620 180, 635 195, 648 213 
                       C 685 240, 705 255, 717 275 
                       C 700 310, 680 330, 656 343 
                       C 580 365, 520 372, 477 374 
                       C 455 375, 445 375, 436 375 
                       C 330 375, 270 370, 233 354 
                       C 180 340, 155 330, 142 311 
                       C 150 250, 170 210, 194 182 
                       C 200 150, 205 130, 213 110 
                       C 270 95, 340 92, 394 92 Z" 
                    fill="none" 
                    stroke="#059669" 
                    stroke-width="5" 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    class="orr-pulse-path" />
              <path d="M 394 92 
                       C 450 105, 480 120, 506 135 
                       C 540 148, 560 152, 575 159 
                       C 620 180, 635 195, 648 213 
                       C 685 240, 705 255, 717 275 
                       C 700 310, 680 330, 656 343 
                       C 580 365, 520 372, 477 374 
                       C 455 375, 445 375, 436 375 
                       C 330 375, 270 370, 233 354 
                       C 180 340, 155 330, 142 311 
                       C 150 250, 170 210, 194 182 
                       C 200 150, 205 130, 213 110 
                       C 270 95, 340 92, 394 92 Z" 
                    fill="none" 
                    stroke="#ECFDF5" 
                    stroke-width="2" 
                    stroke-dasharray="10, 8" 
                    class="orr-animated-dash" />
            </g>

            <!-- Outer Ring Road Label Banner -->
            <g transform="translate(685, 230) rotate(52)">
              <rect x="-6" y="-10" width="134" height="18" rx="4" fill="rgba(6, 78, 59, 0.9)" />
              <text x="61" y="2" text-anchor="middle" font-family="'Anton', sans-serif" font-size="10" fill="#34D399" letter-spacing="1">
                OUTER RING ROAD (ORR)
              </text>
            </g>

            <!-- 7. Dynamic Moving Logistics Vehicles along ORR Corridor -->
            <g class="blr-moving-fleet">
              <!-- Waste Collection Truck 01 (Hebbal -> Marathahalli -> Silk Board) -->
              <g class="fleet-vehicle-node fleet-truck-01">
                <circle cx="0" cy="0" r="10" fill="#059669" stroke="#FFFFFF" stroke-width="2" />
                <text x="0" y="4" text-anchor="middle" font-size="11">🚛</text>
              </g>

              <!-- Waste Collection Truck 02 (West Banashankari -> Rajajinagar route) -->
              <g class="fleet-vehicle-node fleet-truck-02">
                <circle cx="0" cy="0" r="10" fill="#2563EB" stroke="#FFFFFF" stroke-width="2" />
                <text x="0" y="4" text-anchor="middle" font-size="11">🚛</text>
              </g>

              <!-- Auto-Tipper 04 (Silk Board -> Koramangala Hub) -->
              <g class="fleet-vehicle-node fleet-tipper-04">
                <circle cx="0" cy="0" r="9" fill="#F59E0B" stroke="#FFFFFF" stroke-width="1.8" />
                <text x="0" y="3" text-anchor="middle" font-size="10">🛺</text>
              </g>
            </g>

            <!-- 8. Interactive Smart Bin Nodes (The 12 Real Bengaluru Wards) -->
            <g class="blr-pins-layer">
              ${visibleBins.map(bin => {
                const pt = blrGeoToSvg(bin.lat, bin.lng);
                const color = bin.fill >= 80 ? '#EF4444' : bin.fill >= 50 ? '#F59E0B' : '#059669';
                const isCritical = bin.fill >= 80;
                const isSelected = blrSelectedBin && blrSelectedBin.id === bin.id;

                return `
                  <g class="blr-pin-group ${isCritical ? 'pin-critical' : ''} ${isSelected ? 'pin-selected' : ''}" 
                     transform="translate(${pt.x}, ${pt.y})" 
                     onclick="handleBlrPinClick('${bin.id}')"
                     data-bin-id="${bin.id}">
                    
                    <!-- Pulsing Alert Radar Ring if >80% -->
                    ${isCritical ? `
                      <circle cx="0" cy="-16" r="18" fill="none" stroke="#EF4444" stroke-width="2" class="radar-ping-ring" />
                    ` : ''}

                    <!-- Pin Shadow -->
                    <ellipse cx="0" cy="0" rx="9" ry="4" fill="rgba(0,0,0,0.18)" />

                    <!-- Pin Stem & Head -->
                    <path d="M 0 0 L -8 -16 C -12 -23, -12 -33, 0 -33 C 12 -33, 12 -23, 8 -16 Z" 
                          fill="${color}" 
                          stroke="#FFFFFF" 
                          stroke-width="1.8" 
                          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))" />
                    
                    <!-- White Inner Badge -->
                    <circle cx="0" cy="-21" r="7" fill="#FFFFFF" />
                    <text x="0" y="-18" text-anchor="middle" font-family="'Anton', sans-serif" font-size="8.5" fill="${color}">
                      ${bin.fill}%
                    </text>

                    <!-- Locality Label Pill -->
                    <g transform="translate(0, 10)">
                      <rect x="-38" y="0" width="76" height="16" rx="4" 
                            fill="rgba(255, 255, 255, 0.95)" 
                            stroke="${color}" 
                            stroke-width="1" />
                      <text x="0" y="11" text-anchor="middle" font-family="'Montserrat', sans-serif" font-weight="700" font-size="8.5" fill="#064E3B">
                        ${bin.label}
                      </text>
                    </g>
                  </g>
                `;
              }).join('')}
            </g>

          </g> <!-- End of Root Group -->

          <!-- 9. Compass Rose & Cartographic Scale -->
          <g class="carto-hud" transform="translate(930, 60)">
            <circle cx="0" cy="0" r="22" fill="rgba(255,255,255,0.92)" stroke="#10B981" stroke-width="1.5" />
            <polygon points="0,-16 5,-4 0,0 -5,-4" fill="#EF4444" />
            <polygon points="0,16 5,4 0,0 -5,4" fill="#94A3B8" />
            <text x="0" y="-18" text-anchor="middle" font-family="'Anton', sans-serif" font-size="11" fill="#064E3B">N</text>
          </g>

          <!-- Graphic Scale Bar: 5 Kilometers -->
          <g class="carto-scale" transform="translate(60, 615)">
            <rect x="0" y="0" width="120" height="4" fill="#047857" />
            <line x1="0" y1="-3" x2="0" y2="7" stroke="#047857" stroke-width="2" />
            <line x1="60" y1="-3" x2="60" y2="7" stroke="#047857" stroke-width="1" />
            <line x1="120" y1="-3" x2="120" y2="7" stroke="#047857" stroke-width="2" />
            <text x="60" y="-6" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="8.5" font-weight="700" fill="#064E3B">
              5 km BBMP Scale
            </text>
          </g>

          <!-- Status Watermark: 100% Offline Digital Twin -->
          <g transform="translate(680, 620)">
            <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="9" font-weight="600" fill="#059669">
              ● 100% OFFLINE BENGALURU URBAN TWIN · BBMP MONITORED
            </text>
          </g>
        </svg>

        <!-- Floating Interactive Inspection Card (rendered dynamically on pin click) -->
        <div id="blrMapInspector" class="blr-map-inspector ${blrSelectedBin ? 'active' : ''}">
          <!-- Filled by JS -->
        </div>
      </div>
    </div>
  `;

  // If a bin was selected, refresh its inspector view
  if (blrSelectedBin) {
    showBlrBinInspector(blrSelectedBin);
  }
}

// Map filter handler
function setBlrMapFilter(filter) {
  blrMapFilter = filter;
  renderLocalityMap();
}

// Zoom and pan controls
function zoomBlrMap(delta) {
  blrZoomLevel = Math.max(0.8, Math.min(2.4, blrZoomLevel + delta));
  const root = document.getElementById('blrMapRootGroup');
  if (root) {
    root.setAttribute('transform', `translate(${blrPanX}, ${blrPanY}) scale(${blrZoomLevel})`);
  }
}

function resetBlrMapView() {
  blrZoomLevel = 1;
  blrPanX = 0;
  blrPanY = 0;
  blrSelectedBin = null;
  const root = document.getElementById('blrMapRootGroup');
  if (root) {
    root.setAttribute('transform', `translate(0, 0) scale(1)`);
  }
  const inspector = document.getElementById('blrMapInspector');
  if (inspector) inspector.classList.remove('active');
  renderLocalityMap();
}

// Pin click inspection
function handleBlrPinClick(binId) {
  const bin = STATE.mapBins.find(b => b.id === binId);
  if (!bin) return;
  blrSelectedBin = bin;
  showBlrBinInspector(bin);

  // Re-render map to reflect selected pin highlight
  renderLocalityMap();
}

function showBlrBinInspector(bin) {
  const inspector = document.getElementById('blrMapInspector');
  if (!inspector) return;

  const color = bin.fill >= 80 ? '#EF4444' : bin.fill >= 50 ? '#F59E0B' : '#059669';
  const statusText = bin.fill >= 80 ? 'Critical / Needs Immediate Pickup' : bin.fill >= 50 ? 'Moderate Capacity' : 'Optimal Capacity';

  inspector.innerHTML = `
    <div class="inspector-card">
      <div class="inspector-header">
        <div>
          <span class="inspector-tag">${bin.zone} Bengaluru · ${bin.id}</span>
          <h4 class="inspector-title">📍 ${bin.label} Smart Bin</h4>
        </div>
        <button class="btn-inspector-close" onclick="closeBlrInspector()">✕</button>
      </div>

      <div class="inspector-ward">${bin.ward}</div>

      <div class="inspector-fill-row">
        <span class="fill-label">Chamber Fill Level</span>
        <span class="fill-val" style="color: ${color};">${bin.fill}%</span>
      </div>
      <div class="inspector-bar">
        <div class="inspector-bar-fill" style="width: ${bin.fill}%; background: ${color};"></div>
      </div>
      <div class="inspector-status-desc">${statusText}</div>

      <div class="inspector-metrics-grid">
        <div class="metric-box">
          <span class="m-lbl">GPS Position</span>
          <span class="m-val">${bin.lat.toFixed(4)}°N, ${bin.lng.toFixed(4)}°E</span>
        </div>
        <div class="metric-box">
          <span class="m-lbl">Segregation Accuracy</span>
          <span class="m-val" style="color:#059669;">96.8%</span>
        </div>
        <div class="metric-box">
          <span class="m-lbl">Last Sensor Ping</span>
          <span class="m-val">2 mins ago (IoT)</span>
        </div>
        <div class="metric-box">
          <span class="m-lbl">Next Transit Route</span>
          <span class="m-val">ORR Fleet #01</span>
        </div>
      </div>

      <div class="inspector-chambers">
        <div class="ch-chip wet">🟢 Wet: 35%</div>
        <div class="ch-chip dry">🔵 Dry: 50%</div>
        <div class="ch-chip haz">🔴 Haz: 20%</div>
        <div class="ch-chip non">⚫ Non: 45%</div>
      </div>

      <div class="inspector-actions">
        <button class="btn btn-sm btn-primary" onclick="dispatchCollectorToBin('${bin.id}', '${bin.label}')">
          🚛 Dispatch Collector to ${bin.label}
        </button>
      </div>
    </div>
  `;
  inspector.classList.add('active');
}

function closeBlrInspector() {
  blrSelectedBin = null;
  const inspector = document.getElementById('blrMapInspector');
  if (inspector) inspector.classList.remove('active');
  renderLocalityMap();
}

function showBlrFeature(name, desc, status) {
  const inspector = document.getElementById('blrMapInspector');
  if (!inspector) return;

  inspector.innerHTML = `
    <div class="inspector-card">
      <div class="inspector-header">
        <div>
          <span class="inspector-tag">Bengaluru Ecological Landmark</span>
          <h4 class="inspector-title">${name}</h4>
        </div>
        <button class="btn-inspector-close" onclick="closeBlrInspector()">✕</button>
      </div>
      <p style="font-size:0.82rem; color:var(--text-dim); margin:8px 0;">${desc}</p>
      <div style="font-size:0.75rem; color:#047857; font-weight:700; background:#DCFCE7; padding:6px 10px; border-radius:6px;">
        ${status}
      </div>
    </div>
  `;
  inspector.classList.add('active');
}

function dispatchCollectorToBin(binId, binLabel) {
  showToast('success', `🚛 Dispatched Waste Collector to ${binLabel} Smart Bin (${binId})!`);
  addLog(`🚛 Rapid dispatch: Collector assigned to ${binLabel} Smart Bin (${binId}).`);
  closeBlrInspector();
}

function renderUnits() {
  const row = document.getElementById('unitsRow');
  row.innerHTML = '';
  const units = [
    { icon: '🌱', name: 'Compost Facility', status: 'active', cap: STATE.destinations.compost.capacity, color: '#22C55E' },
    { icon: '📦', name: 'Recycling Yard', status: 'active', cap: STATE.destinations.recycle.capacity, color: '#3B82F6' },
    { icon: '☣️', name: 'Safe Disposal', status: 'active', cap: STATE.destinations.hazard.capacity, color: '#EF4444' },
    { icon: '🏗️', name: 'Landfill', status: 'busy', cap: STATE.destinations.landfill.capacity, color: '#6B7280' }
  ];
  units.forEach(u => {
    const div = document.createElement('div');
    div.className = 'unit-card';
    div.innerHTML = `
      <span class="unit-icon">${u.icon}</span>
      <span class="unit-name">${u.name}</span>
      <span class="unit-status ${u.status}">● ${u.status === 'active' ? 'Active' : 'Busy'}</span>
      <div class="unit-capacity">
        <div class="unit-bar"><div class="unit-bar-fill" style="width:${u.cap}%; background:${u.color}"></div></div>
        <small style="color:#9CA3AF; font-size:0.68rem">${u.cap}% capacity</small>
      </div>
    `;
    row.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
// 3D DIGITAL DUSTBIN TWIN STUDIO (Merged from app.py)
// ═══════════════════════════════════════════════

let currentSelectedCompartment = 'wet';
let currentSelectedWasteItem = null;
let customDropPhotoData = null;
let is3DTwinReady = false;

function setupSmartBin() {
  const container = document.getElementById('dustbin3DStage');
  if (!container) return;

  // Set default selected waste item from catalog
  if (typeof WASTE_SAMPLE_CATALOG !== 'undefined' && WASTE_SAMPLE_CATALOG.length) {
    currentSelectedWasteItem = WASTE_SAMPLE_CATALOG[0];
  } else {
    currentSelectedWasteItem = {
      id: 'apple',
      name: 'Organic Food Scrap',
      type: 'wet',
      icon: '🍏',
      conf: 98.4,
      bag: 'Green',
      dest: 'Compost Facility',
      tip: 'Food and organic scraps decompose into rich compost.'
    };
  }

  // 1. Initialize 3D Engine
  if (typeof BinTwin3D !== 'undefined') {
    is3DTwinReady = BinTwin3D.init('dustbin3DStage', {
      onStatus: (msg, type) => {
        const chip = document.getElementById('chip3D');
        if (chip) {
          chip.textContent = msg;
          chip.className = 'chip-3d ' + (type || 'info');
        }
      },
      onComplete: (res) => {
        // Show Floating 3D Guidance Card (matching app.py)
        const card = document.getElementById('card3D');
        const titleEl = document.getElementById('c3dTitle');
        const msgEl = document.getElementById('c3dMsg');
        const scoreEl = document.getElementById('c3dScore');

        if (card && titleEl && msgEl && scoreEl) {
          titleEl.textContent = res.isCorrect ? '✅ Correct Sorting Verified' : '⚠️ Wrong Compartment Detected';
          msgEl.textContent = res.message || (res.isCorrect ? 'Great job! Waste deposited into the designated stream.' : 'Notice: Waste auto-diverted to the correct compartment.');
          scoreEl.textContent = `Indiranagar Locality Segregation Score: ${STATE.segregationScore}%`;
          card.className = 'card-3d show ' + (res.isCorrect ? 'ok' : 'bad');

          setTimeout(() => {
            card.classList.remove('show');
          }, 8000);
        }

        // Enable replay button
        const btnReplay = document.getElementById('btn3DReplay');
        if (btnReplay) btnReplay.style.display = 'inline-flex';
      }
    });

    if (is3DTwinReady && currentSelectedWasteItem) {
      BinTwin3D.selectCompartment(currentSelectedCompartment);
    }
  }

  // 2. Render Sample Waste Items Grid
  renderSampleItemsGrid();

  // 3. Setup Compartment Selector Buttons (Wet, Dry, Hazardous, Non-Recyclable)
  const compButtons = document.querySelectorAll('#compSelectorGrid .btn-compartment');
  compButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      compButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSelectedCompartment = btn.dataset.comp;

      if (typeof BinTwin3D !== 'undefined') {
        BinTwin3D.selectCompartment(currentSelectedCompartment);
      }

      updateResultDeckDisplay(currentSelectedWasteItem, currentSelectedCompartment);
    });
  });

  // 4. Setup Tabs (Sample Library vs Upload Photo)
  const tabSamples = document.getElementById('tabBtnSamples');
  const tabPhoto = document.getElementById('tabBtnPhoto');
  const samplesDeck = document.getElementById('deckSamplesContainer');
  const photoDeck = document.getElementById('deckPhotoContainer');

  if (tabSamples && tabPhoto) {
    tabSamples.addEventListener('click', () => {
      tabSamples.className = 'btn btn-sm btn-primary';
      tabPhoto.className = 'btn btn-sm btn-ghost';
      samplesDeck.style.display = 'block';
      photoDeck.style.display = 'none';
      if (customDropPhotoData) {
        customDropPhotoData = null;
        if (typeof BinTwin3D !== 'undefined') BinTwin3D.setWasteTexture(null);
      }
    });

    tabPhoto.addEventListener('click', () => {
      tabPhoto.className = 'btn btn-sm btn-primary';
      tabSamples.className = 'btn btn-sm btn-ghost';
      samplesDeck.style.display = 'none';
      photoDeck.style.display = 'block';
    });
  }

  // 5. Setup Photo Upload Zone
  setupPhotoUploadZone();

  // 6. Setup Drop Action Trigger
  const btnTriggerDrop = document.getElementById('btnTrigger3DDrop');
  if (btnTriggerDrop) {
    btnTriggerDrop.addEventListener('click', () => {
      execute3DDrop(currentSelectedCompartment, currentSelectedWasteItem);
    });
  }

  // 7. Setup Random Drop Test
  const btnRandom = document.getElementById('btnRandom3DDrop');
  if (btnRandom) {
    btnRandom.addEventListener('click', () => {
      if (typeof WASTE_SAMPLE_CATALOG === 'undefined' || !WASTE_SAMPLE_CATALOG.length) return;
      const randItem = WASTE_SAMPLE_CATALOG[Math.floor(Math.random() * WASTE_SAMPLE_CATALOG.length)];
      // 80% correct choice, 20% wrong choice
      const compKeys = ['wet', 'dry', 'hazardous', 'nonrecyclable'];
      const targetComp = Math.random() < 0.8
        ? randItem.type
        : compKeys[Math.floor(Math.random() * compKeys.length)];

      // Highlight in UI
      selectSampleItemInUI(randItem);
      selectCompartmentInUI(targetComp);

      execute3DDrop(targetComp, randItem);
    });
  }

  // 8. Setup Wrong Sort Test (Deliberate auto-ejection & re-routing demo)
  const btnWrongTest = document.getElementById('btnWrongSortTest');
  if (btnWrongTest) {
    btnWrongTest.addEventListener('click', () => {
      if (typeof WASTE_SAMPLE_CATALOG === 'undefined' || !WASTE_SAMPLE_CATALOG.length) return;
      // Pick a dry recyclable or battery item
      const item = WASTE_SAMPLE_CATALOG.find(i => i.type === 'dry') || WASTE_SAMPLE_CATALOG[1];
      // Intentionally choose WET compartment
      const wrongTarget = 'wet';

      selectSampleItemInUI(item);
      selectCompartmentInUI(wrongTarget);

      showToast('info', '⚠️ Testing Wrong Sort: Dropping plastic into Wet bin to trigger auto-ejection & re-routing.');
      execute3DDrop(wrongTarget, item);
    });
  }

  // 9. Replay & Reset Camera Buttons
  const btnReplay = document.getElementById('btn3DReplay');
  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      if (typeof BinTwin3D !== 'undefined') BinTwin3D.replay();
    });
  }

  const btnResetCam = document.getElementById('btn3DResetCam');
  if (btnResetCam) {
    btnResetCam.addEventListener('click', () => {
      if (typeof BinTwin3D !== 'undefined') BinTwin3D.resetCamera();
    });
  }

  // 10. Initial UI Sync
  updateResultDeckDisplay(currentSelectedWasteItem, currentSelectedCompartment);
  render3DDropsHistory();
  renderSmartBinFills();

  // GenAI buttons (on dashboard)
  const btnGenRep = document.getElementById('btnGenReport');
  if (btnGenRep) btnGenRep.addEventListener('click', handleGenReport);
  const btnWIf = document.getElementById('btnWhatIf');
  if (btnWIf) btnWIf.addEventListener('click', handleWhatIf);
}

function renderSampleItemsGrid() {
  const grid = document.getElementById('samplesGrid');
  if (!grid || typeof WASTE_SAMPLE_CATALOG === 'undefined') return;

  grid.innerHTML = '';
  WASTE_SAMPLE_CATALOG.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'sample-chip-card ' + (i === 0 ? 'selected' : '');
    card.dataset.id = item.id;
    card.innerHTML = `
      <span class="chip-icon">${item.icon}</span>
      <span class="chip-name">${item.name}</span>
      <span class="chip-cat-badge ${item.type}">${item.type.toUpperCase()}</span>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.sample-chip-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      currentSelectedWasteItem = item;

      // Update 3D Texture / color
      if (typeof BinTwin3D !== 'undefined') {
        BinTwin3D.setWasteTexture(null);
      }

      updateResultDeckDisplay(item, currentSelectedCompartment);
    });

    grid.appendChild(card);
  });
}

function selectSampleItemInUI(item) {
  currentSelectedWasteItem = item;
  document.querySelectorAll('.sample-chip-card').forEach(c => {
    if (c.dataset.id === item.id) c.classList.add('selected');
    else c.classList.remove('selected');
  });
}

function selectCompartmentInUI(compKey) {
  currentSelectedCompartment = compKey;
  document.querySelectorAll('#compSelectorGrid .btn-compartment').forEach(btn => {
    if (btn.dataset.comp === compKey) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  if (typeof BinTwin3D !== 'undefined') {
    BinTwin3D.selectCompartment(compKey);
  }
}

function setupPhotoUploadZone() {
  const dropZone = document.getElementById('dropPhotoZone');
  const fileInput = document.getElementById('dropPhotoInput');
  const previewWrap = document.getElementById('dropPhotoPreviewWrap');
  const placeholder = document.getElementById('dropPhotoPlaceholder');
  const previewImg = document.getElementById('dropPhotoPreviewImg');
  const fileNameEl = document.getElementById('dropPhotoFileName');
  const btnRemove = document.getElementById('btnRemoveDropPhoto');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', e => {
    if (e.target !== btnRemove) fileInput.click();
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleUploadedFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleUploadedFile(fileInput.files[0]);
  });

  if (btnRemove) {
    btnRemove.addEventListener('click', e => {
      e.stopPropagation();
      customDropPhotoData = null;
      fileInput.value = '';
      previewWrap.style.display = 'none';
      placeholder.style.display = 'block';
      if (typeof BinTwin3D !== 'undefined') BinTwin3D.setWasteTexture(null);
      if (WASTE_SAMPLE_CATALOG && WASTE_SAMPLE_CATALOG.length) {
        currentSelectedWasteItem = WASTE_SAMPLE_CATALOG[0];
      }
      updateResultDeckDisplay(currentSelectedWasteItem, currentSelectedCompartment);
    });
  }

  function handleUploadedFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      customDropPhotoData = dataUrl;
      previewImg.src = dataUrl;
      fileNameEl.textContent = file.name;
      placeholder.style.display = 'none';
      previewWrap.style.display = 'flex';

      // Texture-map directly to 3D waste item
      if (typeof BinTwin3D !== 'undefined') {
        BinTwin3D.setWasteTexture(dataUrl);
      }

      currentSelectedWasteItem = {
        id: 'uploaded_photo',
        name: file.name.replace(/\.[^/.]+$/, '').slice(0, 24),
        type: currentSelectedCompartment,
        icon: '📸',
        conf: 97.2,
        bag: 'Verified Stream',
        dest: 'Autonomous Segregation',
        imageSrc: dataUrl,
        tip: 'Uploaded waste image texture-mapped onto 3D digital twin mesh.'
      };

      updateResultDeckDisplay(currentSelectedWasteItem, currentSelectedCompartment);
      showToast('success', `📸 Photo "${file.name}" texture-mapped onto 3D waste item!`);
    };
    reader.readAsDataURL(file);
  }
}

function updateResultDeckDisplay(item, declaredComp) {
  if (!item) return;
  const compNames = { wet: 'Wet Waste', dry: 'Dry Recyclable', hazardous: 'Hazardous Waste', nonrecyclable: 'Non-Recyclable' };
  const confColors = { wet: '#059669', dry: '#2563eb', hazardous: '#dc2626', nonrecyclable: '#4b5563' };

  const tagEl = document.getElementById('resTypeTag');
  const confText = document.getElementById('resConfText');
  const confFill = document.getElementById('resConfFill');
  const decEl = document.getElementById('resDeclared');
  const seenEl = document.getElementById('resSeen');
  const destEl = document.getElementById('resDest');
  const statusEl = document.getElementById('resStatus');

  if (tagEl) {
    tagEl.className = 'result-type ' + item.type;
    tagEl.textContent = `${item.icon || '📦'} ${compNames[item.type] || item.type}`;
  }
  if (confText) confText.textContent = `Classification Confidence: ${item.conf || 96.5}% (Optical Sensor)`;
  if (confFill) {
    confFill.style.width = `${item.conf || 96.5}%`;
    confFill.style.background = confColors[item.type] || '#059669';
  }
  if (decEl) decEl.textContent = compNames[declaredComp] || declaredComp;
  if (seenEl) seenEl.textContent = compNames[item.type] || item.type;
  if (destEl) destEl.textContent = item.dest || 'Compost Facility';
  if (statusEl) statusEl.textContent = 'Awaiting 3D flap drop sequence...';

  const miniScore = document.getElementById('miniSegScore');
  if (miniScore) miniScore.textContent = `${STATE.segregationScore}% Compliance`;
}

async function execute3DDrop(declared, item) {
  if (!item) return;

  const isCorrect = declared.toLowerCase() === item.type.toLowerCase();
  const compNames = { wet: 'Wet Waste', dry: 'Dry Recyclable', hazardous: 'Hazardous Waste', nonrecyclable: 'Non-Recyclable' };

  // Fetch educational guidance from backend/api.js (merged from app.py)
  const feedback = await getWasteEducationalFeedback(declared, item.type, isCorrect, item.name);

  // Update guidance UI box
  const guidanceEl = document.getElementById('genaiGuidanceText');
  if (guidanceEl) {
    guidanceEl.textContent = feedback.text;
  }

  // Record drop into application state & update stats
  const dropPayload = {
    declared,
    seen: item.type,
    isCorrect,
    itemName: item.name,
    itemIcon: item.icon || '📦',
    imageSrc: customDropPhotoData || item.imageSrc || ''
  };
  recordDropInState(dropPayload);

  // Trigger 3D Drop Physics in Three.js Engine
  if (typeof BinTwin3D !== 'undefined') {
    BinTwin3D.dropWaste({
      declared,
      seen: item.type,
      isCorrect,
      itemName: item.name,
      itemIcon: item.icon || '📦',
      imageSrc: customDropPhotoData || item.imageSrc,
      message: feedback.text
    });
  }

  // Update Status in result box
  const statusEl = document.getElementById('resStatus');
  if (statusEl) {
    statusEl.innerHTML = isCorrect
      ? `<strong style="color:#059669">✅ Correctly Sorted into ${compNames[declared]}</strong>`
      : `<strong style="color:#ef4444">⚠️ Wrong Compartment! Auto-diverted to ${compNames[item.type]}</strong>`;
  }

  // Show Toast
  if (isCorrect) {
    showToast('success', `✅ Correct Sort: ${item.name} deposited into ${compNames[declared]}. (+2 Score)`);
    addLog(`✅ 3D Twin: ${item.name} correctly deposited into ${compNames[declared]}.`);
  } else {
    showToast('error', `⚠️ Sorting Anomaly: ${item.name} belongs in ${compNames[item.type]}. Re-routed!`);
    addLog(`⚠️ 3D Twin: Sorting anomaly. ${item.name} auto-diverted from ${compNames[declared]} to ${compNames[item.type]}.`);
  }

  // Sync with Python backend if available
  syncDropWithPythonBackend({
    declared,
    seen: item.type,
    itemName: item.name,
    bin_id: 'BIN-ECO-001'
  });

  // Re-render UI components
  renderSmartBinFills();
  render3DDropsHistory();
  renderDashboard();
  renderTracking();
}

function render3DDropsHistory() {
  const tbody = document.getElementById('recentDropsTbody');
  if (!tbody || typeof STATE === 'undefined' || !STATE.drops) return;

  const compLabels = { wet: '🟢 Wet', dry: '🔵 Dry', hazardous: '🔴 Hazardous', nonrecyclable: '⚫ Non-Recyclable' };

  if (STATE.drops.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#94a3b8">No 3D drops recorded yet. Select an item and drop it into the 3D twin!</td></tr>';
    return;
  }

  tbody.innerHTML = STATE.drops.slice(0, 8).map(d => `
    <tr>
      <td style="font-size:0.8rem; color:#64748b;">${d.time}</td>
      <td>
        <span style="font-size:1.1rem; margin-right:6px;">${d.itemIcon || '📦'}</span>
        <strong>${d.itemName || 'Waste Item'}</strong>
      </td>
      <td>${compLabels[d.declared] || d.declared}</td>
      <td>${compLabels[d.seen] || d.seen}</td>
      <td>
        <span class="verdict-badge ${d.correct ? 'correct' : 'wrong'}">
          ${d.correct ? '✅ Correct' : '⚠️ Re-Routed'}
        </span>
      </td>
      <td style="font-weight:700; color:${d.correct ? '#059669' : '#ef4444'}">
        ${d.score}%
      </td>
    </tr>
  `).join('');
}


function renderSmartBinFills() {
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
  Object.entries(STATE.bins).forEach(([key, bin]) => {
    const suffix = key === 'nonrecyclable' ? 'Non' : key === 'hazardous' ? 'Haz' : key === 'dry' ? 'Dry' : 'Wet';
    const fillEl = document.getElementById('fill' + capitalize(suffix));
    const pctEl = document.getElementById('pct' + capitalize(suffix));
    if (fillEl) fillEl.style.height = bin.fill + '%';
    if (pctEl) pctEl.textContent = bin.fill + '%';

    const card = document.querySelector(`[data-type="${key}"]`);
    if (card) {
      if (bin.fill >= FILL_THRESHOLD_ALERT) card.classList.add('alert-active');
      else card.classList.remove('alert-active');
    }
  });
}

function renderScans() {
  const list = document.getElementById('scansList');
  if (STATE.scans.length === 0) {
    list.innerHTML = '<p class="placeholder">No optical scans recorded yet.</p>';
    return;
  }
  list.innerHTML = STATE.scans.slice(0, 10).map(s => `
    <div class="scan-item">
      <div class="scan-icon-bubble">${s.icon}</div>
      <div class="scan-meta">
        <div class="scan-type">${s.type}</div>
        <small style="color:var(--text-dim); display:block; font-size:0.7rem">${s.name || ''}</small>
        <span class="scan-time">${s.time} · Conf: ${s.conf || '97'}%</span>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════
// GENAI REPORT HANDLERS
// ═══════════════════════════════════════════════

async function handleGenReport() {
  const div = document.getElementById('genaiReport');
  div.innerHTML = '<div style="text-align:center; padding:20px"><span class="spinner"></span><br><small style="color:var(--text-dim)">Generating report…</small></div>';

  const result = await generateReportData(); // backend/api.js
  if (result.source === 'gemini') {
    div.innerHTML = `<strong>📋 Daily Report (Gemini AI)</strong><br><small style="color:var(--text-muted)">Generated at ${formatTime(STATE.simHour)}</small><br><br>${result.text.replace(/\n/g, '<br>')}`;
  } else {
    setTimeout(() => {
      div.innerHTML = result.text.replace(/\n/g, '<br>');
    }, REPORT_DELAY_MS);
  }
}

async function handleWhatIf() {
  const div = document.getElementById('genaiReport');
  div.innerHTML = '<div style="text-align:center; padding:20px"><span class="spinner"></span><br><small style="color:var(--text-dim)">Running scenario…</small></div>';

  const result = await whatIfData(); // backend/api.js
  if (result.source === 'gemini') {
    div.innerHTML = `<strong>🔮 What-If (Gemini AI)</strong><br><br>${result.text.replace(/\n/g, '<br>')}`;
  } else {
    setTimeout(() => {
      div.innerHTML = result.text.replace(/\n/g, '<br>');
    }, WHATIF_DELAY_MS);
  }
}

// ═══════════════════════════════════════════════
// COLLECTOR PORTAL
// ═══════════════════════════════════════════════

function setupCollector() {
  // Role toggle
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.workerRole = btn.dataset.role;
    });
  });

  // Login
  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('workerId').value.trim() || 'WK-' + Math.floor(1000 + Math.random() * 9000);
    STATE.workerId = id;
    STATE.workerName = STATE.workerRole === 'official' ? 'Municipal Worker' : 'Registered Waste Picker';
    STATE.loggedIn = true;

    document.getElementById('collectorLogin').classList.add('hidden');
    document.getElementById('collectorDashboard').classList.remove('hidden');
    document.getElementById('workerName').textContent = STATE.workerName + ' (' + id + ')';
    document.getElementById('workerRole').textContent = STATE.workerRole === 'official' ? '🏛️ Official Worker' : '♻️ Waste Picker';

    renderCollectorAlerts();
    showToast('success', `Welcome, ${STATE.workerName}!`);
    addLog(`👷 ${STATE.workerName} (${id}) logged in as ${STATE.workerRole}.`);
  });

  // Logout
  document.getElementById('btnLogout').addEventListener('click', () => {
    STATE.loggedIn = false;
    document.getElementById('collectorLogin').classList.remove('hidden');
    document.getElementById('collectorDashboard').classList.add('hidden');
    document.getElementById('loginForm').reset();
  });
}

function renderCollectorAlerts() {
  const list = document.getElementById('alertsList');
  const fullBins = getFullBins(); // backend/data.js

  if (fullBins.length === 0) {
    list.innerHTML = '<p class="placeholder">No bins need pickup right now. Check back later.</p>';
    return;
  }

  const labels = { wet: '🟢 Wet', dry: '🔵 Dry', hazardous: '🔴 Hazardous', nonrecyclable: '⚫ Non-Recyclable' };
  const dests = { wet: 'Compost Facility', dry: 'Recycling Yard', hazardous: 'Safe Disposal', nonrecyclable: 'Landfill' };

  list.innerHTML = fullBins.map(b => `
    <div class="alert-item ${b.fill >= FILL_THRESHOLD_ALERT ? 'urgent' : ''}">
      <div class="alert-left">
        <span class="alert-bin-icon">🗑️</span>
        <div>
          <strong>${labels[b.type]} Bin</strong>
          <small>Fill: ${b.fill}% · Destination: ${dests[b.type]}</small>
        </div>
      </div>
      <button class="btn btn-sm btn-gold" onclick="acceptPickup('${b.type}')">Accept Pickup</button>
    </div>
  `).join('');
}

function acceptPickup(type) {
  const labels = { wet: 'Wet', dry: 'Dry', hazardous: 'Hazardous', nonrecyclable: 'Non-Recyclable' };
  STATE.pickups.push({
    type,
    label: labels[type],
    status: 'in-progress',
    time: formatTime(STATE.simHour),
    weight: null
  });

  showToast('success', `📋 Pickup accepted for ${labels[type]} bin.`);
  addLog(`📋 ${STATE.workerName} accepted pickup for ${labels[type]} bin.`);
  renderPickups();
  renderCollectorAlerts();
  showQR(type);
}

function renderPickups() {
  const list = document.getElementById('pickupsList');
  if (STATE.pickups.length === 0) {
    list.innerHTML = '<p class="placeholder">No active pickups. Accept a bin alert above.</p>';
    return;
  }
  list.innerHTML = STATE.pickups.map(p => `
    <div class="pickup-item">
      <div>
        <strong>${p.label} Bin</strong>
        <small style="display:block; color:var(--text-muted)">Accepted at ${p.time}${p.weight ? ' · ' + p.weight + ' kg' : ''}</small>
      </div>
      <span class="pickup-status ${p.status}">${p.status === 'in-progress' ? '⏳ In Progress' : '✅ Completed'}</span>
    </div>
  `).join('');
}

function showQR(type) {
  const qrVisual = document.getElementById('qrVisual');
  const weighSection = document.getElementById('weighSection');

  let cells = '';
  for (let i = 0; i < 49; i++) {
    const isDark = Math.random() > 0.45;
    const row = Math.floor(i / 7), col = i % 7;
    const isCorner = (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2);
    cells += `<div class="qr-cell ${isCorner || isDark ? 'dark' : 'light'}"></div>`;
  }

  qrVisual.innerHTML = `
    <div class="qr-code-display">
      <div class="qr-grid">${cells}</div>
      <span class="qr-label">BIN-${type.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}</span>
    </div>
  `;

  weighSection.classList.remove('hidden');

  document.getElementById('btnConfirmDrop').onclick = () => {
    const weight = parseFloat(document.getElementById('weighInput').value) || 0;
    const pickup = STATE.pickups.find(p => p.type === type && p.status === 'in-progress');
    if (pickup) {
      pickup.status = 'completed';
      pickup.weight = weight;
    }

    processDropoff(type, weight); // backend/data.js

    showToast('success', `✅ Drop-off confirmed: ${weight} kg of ${type} waste.`);
    addLog(`✅ Drop-off: ${weight} kg ${type} waste delivered. Bin level reduced.`);

    renderPickups();
    renderSmartBinFills();
    renderCollectorAlerts();
    renderDashboard();
    renderTracking();

    weighSection.classList.add('hidden');
    qrVisual.innerHTML = '<div class="qr-placeholder"><span>📱</span><p>Select a pickup to scan QR</p></div>';
  };
}

// ═══════════════════════════════════════════════
// WASTE TRACKING PAGE
// ═══════════════════════════════════════════════

function renderTracking() {
  renderWorkers();
  renderDestBars();
  renderFlowData();
  updateTimelineByHour();
}

function renderWorkers() {
  const list = document.getElementById('workersList');
  list.innerHTML = STATE.workers.map(w => `
    <div class="worker-item">
      <div class="worker-left">
        <span class="worker-dot ${w.status}"></span>
        <div>
          <span class="worker-name">${w.name}</span>
          <span class="worker-task" style="display:block">${w.task}</span>
        </div>
      </div>
      <span class="worker-loc">${w.loc}</span>
    </div>
  `).join('');
}

function renderDestBars() {
  const container = document.getElementById('destBars');
  container.innerHTML = Object.values(STATE.destinations).map(d => `
    <div class="dest-bar-item">
      <label>${d.icon} ${d.name} <span>${d.capacity}%</span></label>
      <div class="dest-bar-track">
        <div class="dest-bar-fill ${d.color}" style="width:${d.capacity}%"></div>
      </div>
    </div>
  `).join('');

  // Update SVG labels
  document.getElementById('destCompost').textContent = `Capacity: ${STATE.destinations.compost.capacity}%`;
  document.getElementById('destRecycle').textContent = `Capacity: ${STATE.destinations.recycle.capacity}%`;
  document.getElementById('destHazard').textContent = `Capacity: ${STATE.destinations.hazard.capacity}%`;
  document.getElementById('destLandfill').textContent = `Capacity: ${STATE.destinations.landfill.capacity}%`;
}

function renderFlowData() {
  const housesG = document.getElementById('flowHouses');
  if (housesG) {
    housesG.innerHTML = `
      <text x="70" y="70" text-anchor="middle" font-size="28">🏠</text>
      <text x="40" y="120" text-anchor="middle" font-size="20">🏠</text>
      <text x="100" y="120" text-anchor="middle" font-size="20">🏠</text>
      <text x="70" y="170" text-anchor="middle" font-size="24">🏠</text>
      <text x="70" y="230" text-anchor="middle" font-size="20">🏠</text>
      <text x="40" y="280" text-anchor="middle" font-size="22">🏠</text>
      <text x="100" y="280" text-anchor="middle" font-size="18">🏠</text>
      <text x="70" y="330" text-anchor="middle" font-size="24">🏠</text>
    `;
  }

  const binsG = document.getElementById('flowBins');
  if (binsG) {
    const types = [
      { y: 65, emoji: '🟢', label: 'Wet', fill: STATE.bins.wet.fill },
      { y: 145, emoji: '🔵', label: 'Dry', fill: STATE.bins.dry.fill },
      { y: 225, emoji: '🔴', label: 'Haz', fill: STATE.bins.hazardous.fill },
      { y: 305, emoji: '⚫', label: 'Non', fill: STATE.bins.nonrecyclable.fill }
    ];
    binsG.innerHTML = types.map(t => `
      <g>
        <rect x="25" y="${t.y}" width="90" height="35" rx="6" fill="rgba(0,0,0,0.03)" stroke="rgba(0,0,0,0.08)"/>
        <text x="50" y="${t.y + 24}" text-anchor="middle" font-size="16">${t.emoji}</text>
        <text x="95" y="${t.y + 18}" text-anchor="middle" font-size="9" fill="#374151" font-family="Montserrat">${t.fill}%</text>
      </g>
    `).join('');
  }

  const trucksG = document.getElementById('flowTrucks');
  if (trucksG) {
    trucksG.innerHTML = `
      <text x="80" y="75" text-anchor="middle" font-size="32">🚛</text>
      <text x="50" y="120" text-anchor="middle" font-size="9" fill="#374151" font-family="Montserrat">Truck A</text>
      <text x="80" y="155" text-anchor="middle" font-size="32">🚛</text>
      <text x="110" y="195" text-anchor="middle" font-size="9" fill="#374151" font-family="Montserrat">Truck B</text>
    `;
  }
}

function updateTimeline(step) {
  const steps = document.querySelectorAll('.tl-step');
  const stepOrder = ['fill', 'collect', 'refill', 'picker', 'deliver'];
  const idx = stepOrder.indexOf(step);
  steps.forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i < idx) s.classList.add('done');
    if (i === idx) s.classList.add('active');
  });
}

function updateTimelineByHour() {
  const h = STATE.simHour;
  if (h >= 6 && h < 8) updateTimeline('fill');
  else if (h >= 8 && h < 10) updateTimeline('collect');
  else if (h >= 10 && h < 17) updateTimeline('refill');
  else if (h >= 17) updateTimeline('picker');
}

// ═══════════════════════════════════════════════
// FLOW ANIMATION (animated dots on the SVG)
// ═══════════════════════════════════════════════

function startFlowAnimation() {
  const dotsG = document.getElementById('movingDots');
  if (!dotsG) return;

  const paths = [
    { x1: 170, y1: 110, x2: 230, y2: 110, color: '#22C55E' },
    { x1: 170, y1: 190, x2: 230, y2: 190, color: '#3B82F6' },
    { x1: 170, y1: 270, x2: 230, y2: 270, color: '#EF4444' },
    { x1: 170, y1: 340, x2: 230, y2: 340, color: '#6B7280' },
  ];

  paths.forEach((p, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', p.color);
    circle.setAttribute('opacity', '0.8');
    const animX = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animX.setAttribute('attributeName', 'cx');
    animX.setAttribute('from', p.x1); animX.setAttribute('to', p.x2);
    animX.setAttribute('dur', `${1.5 + i * 0.3}s`); animX.setAttribute('repeatCount', 'indefinite');
    const animY = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animY.setAttribute('attributeName', 'cy');
    animY.setAttribute('from', p.y1); animY.setAttribute('to', p.y2);
    animY.setAttribute('dur', `${1.5 + i * 0.3}s`); animY.setAttribute('repeatCount', 'indefinite');
    circle.appendChild(animX);
    circle.appendChild(animY);
    dotsG.appendChild(circle);
  });

  const truckPaths = [
    { x1: 610, y1: 160, x2: 700, y2: 55, color: '#22C55E' },
    { x1: 610, y1: 210, x2: 700, y2: 155, color: '#3B82F6' },
    { x1: 610, y1: 260, x2: 700, y2: 255, color: '#EF4444' },
    { x1: 610, y1: 300, x2: 700, y2: 355, color: '#6B7280' },
  ];

  truckPaths.forEach((p, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', p.color);
    circle.setAttribute('opacity', '0.8');
    const animX = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animX.setAttribute('attributeName', 'cx');
    animX.setAttribute('from', p.x1); animX.setAttribute('to', p.x2);
    animX.setAttribute('dur', `${2 + i * 0.4}s`); animX.setAttribute('repeatCount', 'indefinite');
    const animY = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animY.setAttribute('attributeName', 'cy');
    animY.setAttribute('from', p.y1); animY.setAttribute('to', p.y2);
    animY.setAttribute('dur', `${2 + i * 0.4}s`); animY.setAttribute('repeatCount', 'indefinite');
    circle.appendChild(animX);
    circle.appendChild(animY);
    dotsG.appendChild(circle);
  });
}

// ═══════════════════════════════════════════════
// EVENT LOG & TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════

function addLog(msg) {
  STATE.eventLog.unshift({ time: formatTime(STATE.simHour), msg });
  const log = document.getElementById('eventLog');
  if (log) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">${formatTime(STATE.simHour)}</span><span class="log-msg">${msg}</span>`;
    log.prepend(entry);
    while (log.children.length > MAX_LOG_ENTRIES) log.removeChild(log.lastChild);
  }
}

function showToast(type, msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
