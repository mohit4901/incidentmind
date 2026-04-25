# 🔥 IncidentMind — A to Z Full Documentation (Hinglish)

Yeh documentation aapko start se end tak samajhne mein help karegi ki **IncidentMind** actual mein hai kya, yeh kaam kaise karta hai, backend mein kya architecture chal raha hai, aur kaunse synthetic tasks hum explore kar rahe hain.

---

## 1. Project Kya Hai? (The Big Picture)
**IncidentMind** asal mein ek **Gym-style Training Environment** hai, jo OpenEnv hackathon ke liye banaya gaya hai. Hamara main focus LLM banana nahi hai, balki ek **Aisa Environment banana** hai jiske andar duniya ka koi bhi LLM agent SRE (Site Reliability Engineer) ki task perform karna seekh sake!

Yani humne "Game" (Environment) banaya hai. Jo SREAgent humne banaya hai, woh sirf ek "Baseline Demo" hai taaki judges ko dikha sakein ki humara environment effectively RL (Reinforcement Learning) models ko train karwa sakta hai.

**"PagerDuty Alert Kaha Se Aayenge???"** 
Aapko real PagerDuty account ya production system set up karne ki koi zaroorat nahi hai. Yeh 100% **Synthetic Environment** hai. Yani hamare `incident_generator.py` code mein humne aise scripts likhe hain jo **fake (simulated) PagerDuty JSON alerts** banate hain. Jab bhi episode start hota hai, environment apna ek internal fake SRE alert fekhta hai jo dikhne mein bilkul real production jaisa hota hai!

---

## 2. Tech Stack (Tools & Technologies humne kya use kiye)

Project ko 3 parts mein divide kiya gaya hai—ek proper modern production-ready system:

### 🎨 Frontend (UI / Dashboard)
- **Framework:** React 18 + Vite (Fast rendering and building)
- **Styling:** Tailwind CSS (Modern Glassmorphism UI, Custom Animations)
- **State & Connection:** Socket.io-client (Real-time agent steps stream karne ke liye)
- **Charts:** Recharts (Training reward curve and live stats dikhane ke liye)

### ⚙️ Backend (Real-time Server & DB)
- **Runtime:** Node.js + Express
- **Real-time Engine:** Socket.io (Frontend aur AI service ke beech websocket bridge)
- **Database:** MongoDB (Mongoose) - Har episode ki history, JSON trajectories, aur training runs persist karne ke liye.

### 🧠 AI & Inference Engine (Brain of the System)
- **Language:** Python 3.10+
- **API Framework:** FastAPI + Uvicorn (Fast ASGI server, Node.js isse connect karta hai)
- **Inference Models:** Groq API (Qwen/Llama 3 70B models for ultra-fast, cheap inference).
- **Training Framework:** TRL (Transformer Reinforcement Learning) concepts, GRPO policy logic.
- **Data & Env:** Custom `OpenEnv`-style Gym Environment Python mein.

---

## 3. Workflow — System Kaam Kaise Karta Hai? (Step-by-Step)

Maan lijiye user frontend pe gaya aur usne **"Run Episode (Trained Agent)"** click kiya:

1. **Trigger:** React `Socket.io` ke through Node.js backend ko event bhejta hai (`start-episode`).
2. **Bridge to AI:** Node.js REST API (`POST /run-episode`) ke zariye Python FastAPI server ko call karta hai.
3. **Environment Init:** Python mein ek fresh SRE Environment (`IncidentMindEnv`) banta hai. Environment ek random dikkat/incident select karta hai (e.g., OOM Kill) aur usse related alert generate karta hai.
4. **The Resolution Loop (Agent in action):**
    - Agent (LLM) ko alert read karne ko milta hai. 
    - Agent tool use karke **logs query** karta hai (`query_logs`). FastAPI iska result lautata hai.
    - Agent socha hai: *"Shayad pod crash ho raha hai"*. Toh woh **kubectl command** laata hai (`run_kubectl`).
    - Pura data analyse karke agent ek **hypothesis (andaza)** post karta hai.
    - Phir agent ek **Remediation Action (Fix)** lagata hai `execute_fix('restart_service', 'postgres')`.
5. **Reward Engine Evaluation:** 
    - Environment judge karta hai: *Kya fix sahi tha? Kya yeh wahi problem thi jo usne sochi thi?* Agar sahi tha, toh **Positive Reward (+1.2)** diya jaata hai. Varna negative penalty (-0.5).
6. **Streaming back to UI:** Python server episode ki trajectory JSON mein wapas return karta hai. Node.js backend har step ko ek artificial delay (800ms) ke sath frontend pe Socket.io ke through **stream** karta hai taaki audience agent ki "thinking" live dekh sake.
7. **Resolution:** Jab episode 50 steps poore kar leta hai, ya issue resolve ho jaata hai, episode MongoDB mein save ho jaata hai aur UI update ho jaati hai!

---

## 4. Environment & Data — Task Kaha Se Aa Rahe Hain?

Humare paas judges ko show karne ke liye **Real Production Incidents** hone chahiye the, par SRE data private hota hai. Isliye humne **Synthetic Task Generator** banaya hai.

### Synthetic Incident Tasks
Humne **20 Incident Classes** banayi hain (from Google SRE book & public github post-mortems). Example classes:
- `oom_kill_cascade` (JavaScript heap out of memory)
- `db_connection_pool` (PostgreSQL connections exhausted)
- `bad_deploy_latency` (New update N+1 query banari hai jis se speed slow hogyi)
- `certificate_expiry` (SSL certs expired lag gaye, ingress route fail)
- `disk_saturation` (/var/log disk 100% full ho chuki hai)

### Data Simulation (Log/Metric Generators)
Kyunki hamare paas asli AWS ya Kubernetes cluster demo time par lagatar run theek se nahi hoga, humne **Simulators** banaye hain:
1. `log_generator.py`: Yeh realistic logs banata hai. Isme `80% Noise` (bekar logs tyaari ke liye) aur `20% Signal` (jisme actually error chhupa hai - OOM, Timeout) hote hain.
2. `metric_generator.py`: Yeh Prometheus style "Time-Series" metrics array fake karta hai (e.g., `http_request_duration_seconds`).
3. `incident_generator.py`: Fake kubectl outputs aur Slack threads mock karta hai context ke liye.

---

## 5. The Brain — Reward System Kya Hai?

Agent bas random commands na maare, iske liye ek **Reward Engine** (OpenEnv Rubric ke according) likha gaya hai `reward_engine.py` mein.

- **Points for Good Habits (+):** 
    - Sahi service ke logs maangna (+0.3)
    - Fix apply karne se pehle hypothesis (guess) batana (+0.8)
    - SLA (30 minutes simulated time) ke andar error fix kar dena (+1.0)
- **Penalties for Bad Habits (-):**
    - Galat fix laga dena jisse database par load aur aagya (-0.5)
    - Agar fix bahut easily mil raha tha, lekin agent ne aalas me aakar "Page Human" alat use karliya (-1.0)
    - Bar bar same log fetch karna (-0.3 penalty for loops)

Yahi system make sure karta hai ki **Trained Agent** direct solution tak jaaye instead of randomly running commands (jo untrained agent karta hai).

---

## 6. Training Tab (RL Training Phase)

Jab dashboard me **Train 50 Epochs** click kiya jata hai:
1. Python mein background task chalta hai `train_grpo.py` ke zariye.
2. Yeh lagatar episodes khelega LLM ke against. 
3. Jo steps LLM ko max reward denge, policies use karke us trajectory ko master (optimize) kiya jayega.
4. UI pe **Reward Chart** mein live graph show hoga jahan starting epoch ki line neeche negative (-1, -2) aur badhte-badhte (+3, +5) par positive chali jayegi. Yeh **Learning Curve** hai—showing RL at work!

Yahi pura core system IncidenMind ko banata hai ek powerful OpenEnv submission!
