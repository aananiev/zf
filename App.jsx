import { useState, useCallback } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
// Replace this with your deployed Apps Script URL after following SETUP.md
const APPS_SCRIPT_URL = "YOUR_APPS_SCRIPT_URL_HERE";
const SHARED_SECRET   = "YOUR_SHARED_SECRET_HERE";   // must match the script

// ─── DATA ──────────────────────────────────────────────────────────────────
const FEELINGS = [
  "Joyful","Grateful","Inspired","Excited","Peaceful","Curious","Connected",
  "Proud","Relieved","Hopeful","Amused","Content","Energised","Moved","Safe",
  "Anxious","Overwhelmed","Confused","Frustrated","Sad","Lonely","Bored",
  "Disconnected","Irritated","Exhausted","Numb","Embarrassed","Angry","Scared","Disappointed",
];

const NEEDS = [
  "Belonging","Autonomy","Safety","Recognition","Rest","Clarity",
  "Connection","Meaning","Play","Fairness","Support","Learning",
  "Creativity","Contribution","Trust","Respect",
];

const NEED_STATES = { MET: "met", UNMET: "unmet", NONE: null };

// ─── SCREENS ───────────────────────────────────────────────────────────────
const SCREEN = { FEELINGS: "feelings", NEEDS: "needs", DONE: "done" };

// ─── HELPERS ───────────────────────────────────────────────────────────────
function toggle(set, item) {
  const next = new Set(set);
  next.has(item) ? next.delete(item) : next.add(item);
  return next;
}

// ─── SUBMIT ────────────────────────────────────────────────────────────────
async function submitResponse({ feelings, needStates }) {
  const metNeeds   = NEEDS.filter(n => needStates[n] === NEED_STATES.MET);
  const unmetNeeds = NEEDS.filter(n => needStates[n] === NEED_STATES.UNMET);

  const payload = {
    secret:    SHARED_SECRET,
    timestamp: new Date().toISOString(),
    feelings:  [...feelings].join(", "),
    needs_met:   metNeeds.join(", "),
    needs_unmet: unmetNeeds.join(", "),
  };

  const res = await fetch(APPS_SCRIPT_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok") throw new Error(data.message || "Unknown error");
}

// ─── COMPONENT: FEELINGS SCREEN ────────────────────────────────────────────
function FeelingsScreen({ selected, onToggle, onNext }) {
  return (
    <div className="screen">
      <header>
        <h1>How did this experience feel?</h1>
        <p className="subtitle">Select all that apply</p>
      </header>

      <div className="pill-grid">
        {FEELINGS.map(f => (
          <button
            key={f}
            className={`pill ${selected.has(f) ? "pill--selected" : ""}`}
            onClick={() => onToggle(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <footer>
        <button className="btn-primary" onClick={onNext} disabled={selected.size === 0}>
          Next →
        </button>
      </footer>
    </div>
  );
}

// ─── COMPONENT: NEEDS SCREEN ───────────────────────────────────────────────
function NeedsScreen({ needStates, onCycle, onBack, onSubmit, submitting, error }) {
  return (
    <div className="screen">
      <header>
        <h1>Which needs were involved?</h1>
        <p className="subtitle">Tap once for met ✓ · twice for unmet ✗ · again to clear</p>
      </header>

      <div className="needs-grid">
        {NEEDS.map(n => {
          const state = needStates[n];
          return (
            <button
              key={n}
              className={`need-chip need-chip--${state ?? "none"}`}
              onClick={() => onCycle(n)}
            >
              <span className="need-label">{n}</span>
              {state === NEED_STATES.MET   && <span className="need-badge">✓</span>}
              {state === NEED_STATES.UNMET && <span className="need-badge">✗</span>}
            </button>
          );
        })}
      </div>

      {error && <p className="error-msg">{error}</p>}

      <footer>
        <button className="btn-ghost" onClick={onBack} disabled={submitting}>← Back</button>
        <button className="btn-primary" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Sending…" : "Submit"}
        </button>
      </footer>
    </div>
  );
}

// ─── COMPONENT: DONE SCREEN ────────────────────────────────────────────────
function DoneScreen({ onReset }) {
  return (
    <div className="screen screen--centered">
      <div className="done-icon">✓</div>
      <h1>Thank you</h1>
      <p className="subtitle">Your response has been recorded anonymously.</p>
      <button className="btn-primary" onClick={onReset}>Submit another response</button>
    </div>
  );
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [screen,     setScreen]     = useState(SCREEN.FEELINGS);
  const [feelings,   setFeelings]   = useState(new Set());
  const [needStates, setNeedStates] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  const toggleFeeling = useCallback(f => setFeelings(prev => toggle(prev, f)), []);

  const cycleNeed = useCallback(n => {
    setNeedStates(prev => {
      const cur = prev[n];
      const next =
        cur === NEED_STATES.NONE || cur === undefined ? NEED_STATES.MET :
        cur === NEED_STATES.MET  ? NEED_STATES.UNMET  :
        null;
      return { ...prev, [n]: next };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      await submitResponse({ feelings, needStates });
      setScreen(SCREEN.DONE);
    } catch (e) {
      setError("Something went wrong. Please try again.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [feelings, needStates]);

  const reset = () => {
    setFeelings(new Set());
    setNeedStates({});
    setError(null);
    setScreen(SCREEN.FEELINGS);
  };

  return (
    <main className="app">
      {screen === SCREEN.FEELINGS && (
        <FeelingsScreen
          selected={feelings}
          onToggle={toggleFeeling}
          onNext={() => setScreen(SCREEN.NEEDS)}
        />
      )}
      {screen === SCREEN.NEEDS && (
        <NeedsScreen
          needStates={needStates}
          onCycle={cycleNeed}
          onBack={() => setScreen(SCREEN.FEELINGS)}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
        />
      )}
      {screen === SCREEN.DONE && <DoneScreen onReset={reset} />}
    </main>
  );
}
