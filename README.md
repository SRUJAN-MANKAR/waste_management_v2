# Smart Waste Management Digital Twin

> Collect only what's full, verify only what's wrong, and prove where every kilo ends up.

Built for **Problem Statement 01, SMART WASTE MANAGEMENT DIGITAL TWIN** of our hackathon.

## What is this project?
Cities collect garbage every day, but most of it arrives mixed together. Wet food waste, plastic, paper and medicines end up in the same bin. This makes separation, recycling hard, and harms waste workers and leads to filling of landfills.

The project is a **software system** that:
1. **Checks** whether households sorted their waste correctly (using Computer Vision).
2. **Tracks** where every kilo of waste goes, from the bin to a compost unit or recycler (using a Digital Twin).
3. **Alerts** when the bin is full for the waste collection.
4. **Explains** what is happening and what to improve (using GenAI).

**What is a digital twin?** Think of it as a live "video game version" of the real waste system. It shows bins, localities and the dumping yard on a map, so we can see problems and test ideas without touching the real world.

## How it works (simple flow)

1. A household drops waste into a **smart bin**.
2. A photo of the waste is checked by **Computer Vision**. It sorts the waste into 4 groups:
   - **Wet** (food, garden waste)
   - **Dry recyclable** (paper, plastic, metal)
   - **Hazardous** (medicines, batteries, chemicals)
   - **Non-recyclable** (sanitary waste, mixed items)
3. If the sorting is wrong, the household gets an **alert** and the locality score drops a little.
4. Trucks and **waste pickers** are sent only to bins that are **full and verified**, which saves fuel.
5. The **digital twin** shows each locality's score and where waste ends up: compost, recycling or safe disposal.
6. **GenAI** writes simple reports, answers "what if we add one more truck?" and creates messages for citizens.

## Key features

- **Source verification:** CV checks sorting at the bin, not after collection.
- **Smart pickups:** collect only from full, verified bins.
- **End-to-end tracking:** the dumping yard twin follows waste to compost, recyclers and hazardous disposal.
- **Locality scoreboard:** segregation scores and a leaderboard to encourage good habits.
- **Waste pickers as partners:** registered, tracked and paid per kilo.
- **GenAI insights:** reports, scenarios and citizen messages.

## Important note: this is a simulation

The hackathon needs a software-only demo, so:
- **Bins, pickers and weights are simulated.** They are labelled "simulated" in the app.
- **The CV step is real.** You upload a waste photo and the model classifies it.
- The design is **hardware-ready**. Real sensors and cameras could replace the simulator later without changing the rest of the system.

## System architecture

The system has five layers:

| Layer | What it does |
|---|---|
| Simulated inputs | Virtual bins, waste photo upload, simulated pickers |
| Processing core | CV classifier, rules engine, route planner |
| Database | Bins, pickups, weights, scores |
| Digital twin + GenAI | City and bin map, dumping yard view, AI reports |
| User views | Municipal, picker and citizen screens |

## Tech stack

- **Python** and **Streamlit** (app and screens)
- **Folium** or **Plotly** (map and charts)
- **Pandas / CSV** (simple data storage)
- **Vision AI model** (Gemini or Claude API) or **Teachable Machine** for waste classification
- **Gemini or Claude API** for reports and messages
- **Streamlit Community Cloud** for hosting
- **Matplotlib** for the architecture diagram

## How to run

```bash
# 1. Install the libraries
pip install streamlit pandas folium streamlit-folium plotly matplotlib

# 2. Run the app
streamlit run app.py

# 3. (Optional) Generate the architecture diagram
python architecture.py
```

Add your API key as an environment variable before running the GenAI features:

```bash
export GEMINI_API_KEY="your-key-here"
```

## Project structure

```
├── app.py               # Main Streamlit app
├── architecture.py      # Generates the architecture diagram
├── data/                # Simulated bins, pickers and weights (CSV)
├── assets/              # Sample waste photos
└── README.md
```

## Impact

- **Environment:** less landfill waste, less methane, more compost and recycling, fewer truck trips and lower fuel use.
- **Health:** workers handle pre-sorted waste, so there is less contact with sharp, infectious and toxic items.
- **Society:** pickers get recognition and fair pay, and localities get a clear, visible score.

## Limitations and next steps

- CV accuracy drops with messy, mixed waste, so human spot-checks are recommended.
- Next step: a one-ward hardware pilot with real fill sensors and cameras.
- Impact numbers shown in the demo are **estimates from the simulation**.

## Team
Visionary Twins. | CMR Institute of Technology.
Sneha S Hebbal
Soumya
Srujan Mankar
Thanmayi P
