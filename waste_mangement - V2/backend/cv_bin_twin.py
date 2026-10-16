"""
═══════════════════════════════════════════════════════════════
EcoSync — Smart CV Bin Digital Twin & Backend Engine (Python)
═══════════════════════════════════════════════════════════════

Merged Backend combining:
  • cv_bin_twin.py (Autonomous CV Classification & Terminal Dashboard)
  • app.py (SQLite Database, GenAI Feedback, Drop Verification, Picker Jobs)
  • Built-in Lightweight HTTP REST API Server (--serve)

Modes:
  python cv_bin_twin.py            -> Interactive Terminal Dashboard
  python cv_bin_twin.py --serve    -> Local REST API Server for Web Frontend (port 5000)
  python cv_bin_twin.py --simulate -> Full 24-hr day simulation
  python cv_bin_twin.py --export   -> Export twin state JSON
  python cv_bin_twin.py --image photo.jpg -> Real CV classification test

═══════════════════════════════════════════════════════════════
"""

import base64
import hashlib
import hmac
import io
import json
import os
import random
import secrets
import sqlite3
import sys
import time
from contextlib import closing
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ╔═══════════════════════════════════════════╗
# ║  CONFIG                                   ║
# ╚═══════════════════════════════════════════╝
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "waste_twin.db")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL = "gemini-2.0-flash"
PICKER_RATE = 6  # Rs paid per kg of dry recyclable

# ─── WASTE CATEGORIES ───
CATEGORIES = {
    "wet":           {"label": "Wet Waste",       "icon": "🟢", "bag": "Green", "dest": "Compost Facility",  "color": "\033[92m"},
    "dry":           {"label": "Dry Recyclable",  "icon": "🔵", "bag": "Blue",  "dest": "Recycling Yard",   "color": "\033[94m"},
    "hazardous":     {"label": "Hazardous",       "icon": "🔴", "bag": "Red",   "dest": "Safe Disposal",    "color": "\033[91m"},
    "nonrecyclable": {"label": "Non-Recyclable",  "icon": "⚫", "bag": "Black", "dest": "Landfill",         "color": "\033[90m"},
}

LOCALITIES = {
    "Marathahalli": (12.9569, 77.7011),
    "Indiranagar": (12.9784, 77.6408),
    "Whitefield": (12.9698, 77.7500),
    "HSR Layout": (12.9116, 77.6474),
}

TIPS = {
    "wet": "Food and garden waste can become nutrient-rich organic compost.",
    "dry": "Clean paper, plastic, metal and glass are shredded and recycled.",
    "hazardous": "Medicines, batteries and chemicals contain toxins requiring safe containment.",
    "nonrecyclable": "Sanitary and soiled items cannot be recycled and must be sealed for landfill.",
}

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
WHITE = "\033[97m"


# ═══════════════════════════════════════════
# DATABASE LAYER (Merged from app.py)
# ═══════════════════════════════════════════
def db_run(sql, params=()):
    """Run a write query on SQLite database."""
    with closing(sqlite3.connect(DB_PATH)) as con:
        cur = con.execute(sql, params)
        con.commit()
        return cur.lastrowid


def db_query(sql, params=()):
    """Run a read query on SQLite database, return list of dicts."""
    with closing(sqlite3.connect(DB_PATH)) as con:
        con.row_factory = sqlite3.Row
        cur = con.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(8)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()
    return salt, h


def init_db():
    """Ensure database schema is up-to-date."""
    with closing(sqlite3.connect(DB_PATH)) as con:
        cur = con.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                salt TEXT NOT NULL,
                pw_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                locality TEXT,
                created TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS bins (
                id TEXT PRIMARY KEY,
                locality TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                fill INTEGER NOT NULL,
                flagged INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS drops (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                bin_id TEXT NOT NULL,
                declared TEXT NOT NULL,
                seen TEXT NOT NULL,
                correct INTEGER NOT NULL,
                ts TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS pickups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bin_id TEXT NOT NULL,
                picker_id INTEGER,
                status TEXT NOT NULL,
                kg REAL,
                wet REAL,
                dry REAL,
                haz REAL,
                non REAL,
                earned REAL,
                ts TEXT NOT NULL
            );
        """)
        con.commit()


def seed_bins():
    """Seed initial smart bins across localities if table is empty."""
    count = db_query("SELECT COUNT(*) AS c FROM bins")[0]["c"]
    if count > 0:
        return
    rng = random.Random(7)
    for loc, (lat, lon) in LOCALITIES.items():
        for i in range(5):
            db_run(
                "INSERT INTO bins(id, locality, lat, lon, fill, flagged) VALUES(?,?,?,?,?,0)",
                (
                    f"{loc[:3].upper()}-{i + 1}",
                    loc,
                    lat + rng.uniform(-0.008, 0.008),
                    lon + rng.uniform(-0.008, 0.008),
                    rng.randint(15, 85),
                ),
            )


def locality_scores():
    """Calculate segregation compliance score per locality."""
    rows = db_query("""
        SELECT b.locality AS locality,
               COUNT(d.id) AS total_drops,
               SUM(CASE WHEN d.correct = 1 THEN 1 ELSE 0 END) AS correct_drops
        FROM bins b
        LEFT JOIN drops d ON d.bin_id = b.id
        GROUP BY b.locality
    """)
    result = []
    for r in rows:
        tot = r["total_drops"] or 0
        cor = r["correct_drops"] or 0
        score = int(cor / tot * 100) if tot > 0 else 85
        result.append({"locality": r["locality"], "score": score, "drops": tot})
    result.sort(key=lambda x: x["score"], reverse=True)
    return result


def record_drop_in_db(user_id, bin_id, declared, seen):
    """Record a waste drop into SQLite and update bin fill."""
    dec_norm = declared.strip().lower()
    seen_norm = seen.strip().lower()
    is_correct = 1 if dec_norm == seen_norm else 0

    db_run(
        "INSERT INTO drops(user_id, bin_id, declared, seen, correct, ts) VALUES(?,?,?,?,?,?)",
        (user_id, bin_id, declared, seen, is_correct, now_str()),
    )
    # Increase fill by 5%
    db_run("UPDATE bins SET fill = MIN(100, fill + 5) WHERE id = ?", (bin_id,))
    return bool(is_correct)


# ═══════════════════════════════════════════
# DIGITAL TWIN — Bin State & CV Classifier
# ═══════════════════════════════════════════
class SmartBinTwin:
    """Digital twin of a 4-compartment smart waste bin."""

    def __init__(self, bin_id="BIN-ECO-001", locality="Indiranagar"):
        self.bin_id = bin_id
        self.locality = locality
        self.sim_hour = 6

        self.bins = {
            "wet":           {"fill": 35, "collected": False},
            "dry":           {"fill": 50, "collected": False},
            "hazardous":     {"fill": 20, "collected": False},
            "nonrecyclable": {"fill": 45, "collected": False},
        }

        self.destinations = {
            "compost":  {"capacity": 62, "name": "Compost Facility"},
            "recycle":  {"capacity": 45, "name": "Recycling Yard"},
            "hazard":   {"capacity": 18, "name": "Safe Disposal"},
            "landfill": {"capacity": 73, "name": "Landfill"},
        }

        self.segregation_score = 92
        self.total_scans = 0
        self.wrong_sorts = 0
        self.alerts = []
        self.event_log = []
        self.pickups_completed = 0

    def classify_waste(self, image_path=None, image_bytes=None):
        """Classify waste using Gemini Vision API if key available, or simulated CV."""
        if GEMINI_API_KEY:
            res = self._classify_with_gemini(image_path=image_path, image_bytes=image_bytes)
            if res:
                return res

        # Simulated classification
        category = random.choice(list(CATEGORIES.keys()))
        confidence = random.randint(84, 99)
        return {
            "type": category,
            "confidence": confidence,
            "source": "simulated_cv",
            **CATEGORIES[category],
        }

    def _classify_with_gemini(self, image_path=None, image_bytes=None):
        """Use Google Gemini Vision API for classification."""
        try:
            import google.generativeai as genai
            from PIL import Image

            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel(MODEL)

            if image_bytes:
                img = Image.open(io.BytesIO(image_bytes))
            elif image_path and os.path.exists(image_path):
                img = Image.open(image_path)
            else:
                return None

            prompt = (
                "Classify this waste image into exactly ONE category: wet, dry, hazardous, nonrecyclable. "
                "Respond with JSON strictly: {\"type\": \"...\", \"confidence\": 95, \"reason\": \"...\"}"
            )
            response = model.generate_content([prompt, img])
            text = response.text.strip()
            if "{" in text:
                data = json.loads(text[text.index("{"):text.rindex("}") + 1])
                cat = data.get("type", "nonrecyclable").lower()
                if cat in CATEGORIES:
                    return {
                        "type": cat,
                        "confidence": data.get("confidence", 90),
                        "reason": data.get("reason", ""),
                        "source": "gemini_cv",
                        **CATEGORIES[cat],
                    }
        except Exception as e:
            self._log(f"Gemini CV fallback: {e}")
        return None

    def deposit_waste(self, scan_result, chosen_bin=None, item_name="Waste Item"):
        """Deposit scanned waste into the bin, update fills and scores."""
        correct_bin = scan_result["type"]
        actual_bin = (chosen_bin or correct_bin).lower()

        self.total_scans += 1
        if actual_bin in self.bins:
            self.bins[actual_bin]["fill"] = min(100, self.bins[actual_bin]["fill"] + random.randint(4, 7))

        is_wrong = actual_bin != correct_bin
        if is_wrong:
            self.wrong_sorts += 1
            penalty = 2
            self.segregation_score = max(0, self.segregation_score - penalty)
            self._log(f"⚠️ WRONG SORT: {item_name} put in {CATEGORIES.get(actual_bin, {}).get('bag', 'Wrong')} bag. Score -{penalty}")
            record_drop_in_db(1, self.bin_id, actual_bin, correct_bin)
            return {"correct": False, "penalty": penalty, "re_routed_to": correct_bin}
        else:
            self.segregation_score = min(100, self.segregation_score + 2)
            self._log(f"✅ Correct sort: {item_name} -> {scan_result['label']}")
            record_drop_in_db(1, self.bin_id, actual_bin, correct_bin)
            return {"correct": True, "penalty": 0, "re_routed_to": None}

    def advance_hour(self):
        """Simulate one hour of activity."""
        self.sim_hour = (self.sim_hour + 1) % 24
        h = self.sim_hour

        if 6 <= h <= 8:
            self._add_fill(6, 12)
            self._log("🏠 Households adding waste to bins.")
        elif 8 <= h <= 10 and not self.bins["wet"]["collected"]:
            for k in self.bins:
                self.bins[k]["fill"] = max(5, self.bins[k]["fill"] - 35)
                self.bins[k]["collected"] = True
            self.destinations["compost"]["capacity"] = min(100, self.destinations["compost"]["capacity"] + 6)
            self.destinations["recycle"]["capacity"] = min(100, self.destinations["recycle"]["capacity"] + 5)
            self.destinations["hazard"]["capacity"] = min(100, self.destinations["hazard"]["capacity"] + 2)
            self.destinations["landfill"]["capacity"] = min(100, self.destinations["landfill"]["capacity"] + 4)
            self.pickups_completed += 1
            self._log("🚛 Morning municipal collection completed.")
        elif 10 <= h <= 17:
            self._add_fill(4, 8)
            self._log("📦 Bins refilling gradually during the day.")
        elif h >= 18:
            self._add_fill(2, 5)
            self._log("🌙 Evening waste generation.")

        if h == 0:
            for k in self.bins:
                self.bins[k]["collected"] = False
            self._log("🌅 New day begins — collection status reset.")

        self.alerts = [k for k, b in self.bins.items() if b["fill"] >= 80]

    def _add_fill(self, lo, hi):
        for k in self.bins:
            self.bins[k]["fill"] = min(100, self.bins[k]["fill"] + random.randint(lo, hi))

    def _log(self, msg):
        h = self.sim_hour
        suffix = "AM" if h < 12 else "PM"
        display = 12 if h == 0 else (h - 12 if h > 12 else h)
        time_str = f"{display:02d}:00 {suffix}"
        self.event_log.append(f"[{time_str}] {msg}")

    def render_dashboard(self):
        """Print full terminal dashboard."""
        os.system("cls" if os.name == "nt" else "clear")
        h = self.sim_hour
        suffix = "AM" if h < 12 else "PM"
        display = 12 if h == 0 else (h - 12 if h > 12 else h)
        time_str = f"{display:02d}:00 {suffix}"

        print(f"{GREEN}{'═' * 60}{RESET}")
        print(f"{GREEN}{BOLD}  ♻️  EcoSync — Smart CV Bin Digital Twin (Merged Backend){RESET}")
        print(f"{GREEN}{'═' * 60}{RESET}")
        print(f"{DIM}  Bin ID: {self.bin_id}  |  Locality: {self.locality}{RESET}")
        print(f"{DIM}  Simulation Time: {BOLD}{WHITE}{time_str}{RESET}")
        print(f"{GREEN}{'─' * 60}{RESET}")

        score_color = GREEN if self.segregation_score >= 80 else (YELLOW if self.segregation_score >= 60 else RED)
        print(f"  {BOLD}📊 STATS{RESET}")
        print(f"  Segregation Score: {score_color}{BOLD}{self.segregation_score}%{RESET}")
        print(f"  Total Scans: {self.total_scans}  |  Wrong Sorts: {self.wrong_sorts}  |  Pickups: {self.pickups_completed}")
        print(f"  Alerts: {RED}{BOLD}{len(self.alerts)}{RESET}" if self.alerts else f"  Alerts: {GREEN}0{RESET}")
        print()

        print(f"  {BOLD}🗑️  BIN FILL LEVELS{RESET}")
        for key, cat in CATEGORIES.items():
            fill = self.bins[key]["fill"]
            bar_len = 28
            filled = int(fill / 100 * bar_len)
            bar_color = GREEN if fill < 50 else (YELLOW if fill < 80 else RED)
            bar = f"{bar_color}{'█' * filled}{DIM}{'░' * (bar_len - filled)}{RESET}"
            status = f"{RED}⚠ FULL" if fill >= 80 else ""
            print(f"  {cat['icon']} {cat['label']:<18} [{bar}] {fill:>3}%  {status}{RESET}")
        print()

        print(f"  {BOLD}📜 RECENT EVENTS{RESET}")
        for entry in self.event_log[-5:]:
            print(f"  {DIM}{entry}{RESET}")
        print()
        print(f"{GREEN}{'═' * 60}{RESET}")

    def export_state(self):
        """Export twin state as dict/JSON."""
        return {
            "bin_id": self.bin_id,
            "locality": self.locality,
            "sim_hour": self.sim_hour,
            "bins": self.bins,
            "destinations": self.destinations,
            "segregation_score": self.segregation_score,
            "total_scans": self.total_scans,
            "wrong_sorts": self.wrong_sorts,
            "alerts": self.alerts,
            "event_log": self.event_log[-10:],
        }


# ═══════════════════════════════════════════
# BUILT-IN HTTP REST API SERVER (--serve)
# ═══════════════════════════════════════════
GLOBAL_TWIN = None


class TwinAPIHandler(BaseHTTPRequestHandler):
    """Zero-dependency HTTP REST API handler for EcoSync."""

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            self._set_headers(200)
            data = GLOBAL_TWIN.export_state()
            data["db_path"] = DB_PATH
            data["server"] = "EcoSync Python Digital Twin Backend"
            self.wfile.write(json.dumps(data).encode("utf-8"))

        elif path == "/api/bins":
            self._set_headers(200)
            bins_data = db_query("SELECT * FROM bins")
            self.wfile.write(json.dumps(bins_data).encode("utf-8"))

        elif path == "/api/scores":
            self._set_headers(200)
            scores = locality_scores()
            self.wfile.write(json.dumps(scores).encode("utf-8"))

        elif path == "/api/drops":
            self._set_headers(200)
            drops = db_query("SELECT * FROM drops ORDER BY id DESC LIMIT 25")
            self.wfile.write(json.dumps(drops).encode("utf-8"))

        elif path == "/api/pickups":
            self._set_headers(200)
            ready = db_query("SELECT * FROM bins WHERE fill >= 60")
            self.wfile.write(json.dumps(ready).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": f"Path not found: {path}"}).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        if path == "/api/drop":
            declared = payload.get("declared", "wet").lower()
            seen = payload.get("seen", declared).lower()
            item_name = payload.get("itemName", "Waste Item")
            bin_id = payload.get("bin_id", GLOBAL_TWIN.bin_id)

            # Process in twin
            scan_result = {"type": seen, "label": CATEGORIES.get(seen, {}).get("label", seen), "bag": CATEGORIES.get(seen, {}).get("bag", "Green")}
            deposit = GLOBAL_TWIN.deposit_waste(scan_result, chosen_bin=declared, item_name=item_name)

            self._set_headers(200)
            res = {
                "success": True,
                "declared": declared,
                "seen": seen,
                "isCorrect": deposit["correct"],
                "re_routed_to": deposit["re_routed_to"],
                "new_score": GLOBAL_TWIN.segregation_score,
                "bins": GLOBAL_TWIN.bins,
                "tip": TIPS.get(seen, "Sort properly at source."),
            }
            self.wfile.write(json.dumps(res).encode("utf-8"))

        elif path == "/api/advance":
            GLOBAL_TWIN.advance_hour()
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True, "sim_hour": GLOBAL_TWIN.sim_hour, "bins": GLOBAL_TWIN.bins}).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": f"Endpoint not found: {path}"}).encode("utf-8"))

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]} {args[1]}\n")


def run_server(port=5000):
    """Start local REST API server."""
    init_db()
    seed_bins()
    server_address = ("", port)
    httpd = HTTPServer(server_address, TwinAPIHandler)
    print(f"""
{GREEN}{BOLD}═══════════════════════════════════════════════════════════════{RESET}
{GREEN}{BOLD}  ♻️  EcoSync Python Digital Twin REST Server LIVE{RESET}
{GREEN}{BOLD}═══════════════════════════════════════════════════════════════{RESET}
{CYAN}  API Base URL:  http://127.0.0.1:{port}/api{RESET}
{WHITE}  Endpoints:
    GET  /api/status   - Twin state & simulation clock
    GET  /api/bins     - Real-time 12 Smart Bin locations
    GET  /api/scores   - Locality leaderboard scores
    GET  /api/drops    - Recent drops from SQLite
    POST /api/drop     - Submit 3D waste drop verification
    POST /api/advance  - Advance simulation 1 hour{RESET}
{DIM}  Press Ctrl+C to stop server.{RESET}
{GREEN}{'═' * 60}{RESET}
""")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Server stopped.{RESET}")


# ═══════════════════════════════════════════
# MAIN ENTRYPOINT
# ═══════════════════════════════════════════
def main():
    global GLOBAL_TWIN
    GLOBAL_TWIN = SmartBinTwin()
    init_db()
    seed_bins()

    if "--serve" in sys.argv:
        port = 5000
        if len(sys.argv) > 2 and sys.argv[2].isdigit():
            port = int(sys.argv[2])
        run_server(port)
        return

    if "--simulate" in sys.argv:
        print(f"{CYAN}⏩ Running full day simulation...{RESET}")
        for _ in range(18):
            GLOBAL_TWIN.advance_hour()
            GLOBAL_TWIN.render_dashboard()
            time.sleep(0.3)
        return

    if "--export" in sys.argv:
        print(json.dumps(GLOBAL_TWIN.export_state(), indent=2))
        return

    # Interactive Terminal Loop
    while True:
        GLOBAL_TWIN.render_dashboard()
        print(f"  {BOLD}COMMANDS:{RESET}")
        print(f"  {GREEN}[s]{RESET} Scan waste    {GREEN}[a]{RESET} Advance 1 hour    {GREEN}[f]{RESET} Full day simulation")
        print(f"  {GREEN}[w]{RESET} Start Web API {GREEN}[e]{RESET} Export JSON       {GREEN}[q]{RESET} Quit")
        print()
        choice = input(f"  {BOLD}>{RESET} ").strip().lower()

        if choice == "q":
            print(f"\n  {GREEN}♻️ EcoSync closed.{RESET}\n")
            break
        elif choice == "w":
            run_server(5000)
            break
        elif choice == "s":
            print(f"\n  {CYAN}📸 Optical Camera Scanning...{RESET}")
            time.sleep(0.6)
            result = GLOBAL_TWIN.classify_waste()
            print(f"\n  {BOLD}CV Classification:{RESET} {result.get('icon', '')} {result.get('label', '')} ({result.get('confidence', 95)}%)")
            print(f"  Bag: {result.get('bag', '')}  ->  {result.get('dest', '')}")
            print(f"\n  {BOLD}Choose target compartment:{RESET} [1] Wet  [2] Dry  [3] Haz  [4] Non-Rec  [Enter] Auto")
            bc = input(f"  {BOLD}>{RESET} ").strip()
            bin_map = {"1": "wet", "2": "dry", "3": "hazardous", "4": "nonrecyclable"}
            chosen = bin_map.get(bc, result["type"])
            deposit = GLOBAL_TWIN.deposit_waste(result, chosen)
            if deposit["correct"]:
                print(f"  {GREEN}✅ Correct sort!{RESET}")
            else:
                print(f"  {RED}⚠️ Wrong sort! Re-routed to {deposit['re_routed_to']}. Penalty: -{deposit['penalty']}{RESET}")
            time.sleep(1.5)
        elif choice == "a":
            GLOBAL_TWIN.advance_hour()
        elif choice == "f":
            for _ in range(18):
                GLOBAL_TWIN.advance_hour()
                GLOBAL_TWIN.render_dashboard()
                time.sleep(0.3)
        elif choice == "e":
            filename = f"bin_state_{GLOBAL_TWIN.bin_id}.json"
            with open(filename, "w") as f:
                json.dump(GLOBAL_TWIN.export_state(), f, indent=2)
            print(f"  {GREEN}📁 Exported to {filename}{RESET}")
            time.sleep(1)


if __name__ == "__main__":
    main()
