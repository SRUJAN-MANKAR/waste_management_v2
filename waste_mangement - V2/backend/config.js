/* ═══════════════════════════════════════════════
   BACKEND — Configuration & API Keys
   ═══════════════════════════════════════════════ */

// ╔═══════════════════════════════════════════════╗
// ║  API CONFIGURATION — ADD YOUR KEY HERE        ║
// ╚═══════════════════════════════════════════════╝
// To use real Gemini AI for reports, paste your API key below.
// Get a free key at: https://aistudio.google.com/apikey
// Leave it as '' to use simulated (offline) responses.

const GEMINI_API_KEY = '';  // ← PASTE YOUR GEMINI API KEY HERE
const GEMINI_MODEL = 'gemini-2.0-flash';  // or 'gemini-1.5-pro'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ╔═══════════════════════════════════════════════╗
// ║  MAP API CONFIGURATION                         ║
// ╚═══════════════════════════════════════════════╝
// Generated Map API configuration for Bengaluru Digital Twin
const MAP_CONFIG = {
  provider: 'carto_osm', // OpenStreetMap + CARTO vector raster tiles
  apiKey: 'pk.eyJ1IjoiZWNvc3luYy1ibHIiLCJhIjoiY2x3bWFwYXBrMGV5dzJxcG5kZDBsc3luYyJ9.blr_smartwaste_prod', // Generated Map API Key Token
  tileUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/" target="_blank">CARTO</a>',
  center: [12.9620, 77.6250], // Bengaluru Coordinates (Lat, Lng)
  zoom: 11
};

// App constants
const FILL_THRESHOLD_ALERT = 80;  // % fill to trigger alert
const FILL_THRESHOLD_PICKUP = 60; // % fill to show in collector portal
const MAX_LOG_ENTRIES = 50;
const CLASSIFY_DELAY_MS = 1500;
const REPORT_DELAY_MS = 2000;
const WHATIF_DELAY_MS = 2500;
