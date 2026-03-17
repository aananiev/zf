// ─── CONFIG ────────────────────────────────────────────────────────────────
// Replace these with your values after following SETUP.md
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNqTCwAU0C9LlGEM7C6lvtdM9wuaH5FFSRiNg3hWBaOVkn3llrLsLQ9PXntCfeK0ebWw/exec";
const SHARED_SECRET   = "himitsudesu";

// ─── DATA ──────────────────────────────────────────────────────────────────
const FEELINGS = [
  "Joyful","Grateful","Inspired","Excited","Peaceful","Curious","Connected",
  "Proud","Relieved","Hopeful","Amused","Content","Energised","Moved","Safe",
  "Anxious","Overwhelmed","Confused","Frustrated","Sad","Lonely","Bored",
  "Disconnected","Irritated","Exhausted","Numb","Embarrassed","Angry","Scared","Disappointed",
];

// CSS fruit class names - each maps to a unique fruit shape
const FRUIT_CLASSES = [
  "fruit-apple",      // Joyful
  "fruit-banana",     // Grateful
  "fruit-strawberry", // Inspired
  "fruit-orange",     // Excited
  "fruit-grapes",     // Peaceful
  "fruit-cherry",     // Curious
  "fruit-pineapple",  // Connected
  "fruit-kiwi",       // Proud
  "fruit-mango",      // Relieved
  "fruit-pear",       // Hopeful
  "fruit-peach",      // Amused
  "fruit-watermelon", // Content
  "fruit-lemon",      // Energised
  "fruit-coconut",    // Moved
  "fruit-blueberry",  // Safe
  "fruit-raspberry",  // Anxious
  "fruit-avocado",    // Overwhelmed
  "fruit-dragonfruit",// Confused
  "fruit-pomegranate",// Frustrated
  "fruit-fig",        // Sad
  "fruit-papaya",     // Lonely
  "fruit-passionfruit",// Bored
  "fruit-cantaloupe", // Disconnected
  "fruit-honeydew",   // Irritated
  "fruit-starfruit",  // Exhausted
  "fruit-persimmon",  // Numb
  "fruit-plum",       // Embarrassed
  "fruit-apricot",    // Angry
  "fruit-nectarine",  // Scared
  "fruit-cranberry",  // Disappointed
];

const NEEDS = [
  "Belonging","Autonomy","Safety","Recognition","Rest","Clarity",
  "Connection","Meaning","Play","Fairness","Support","Learning",
  "Creativity","Contribution","Trust","Respect",
];

const NEED_STATES = { MET: "met", UNMET: "unmet", NONE: null };
const SCREEN = { FEELINGS: "feelings", NEEDS: "needs", DONE: "done" };

// ─── STATE ────────────────────────────────────────────────────────────────
let state = {
  screen: SCREEN.FEELINGS,
  feelings: new Set(),
  needStates: {},
  submitting: false,
  error: null,
  fruitPositions: [] // Store computed positions for random layout
};

// ─── DOM ───────────────────────────────────────────────────────────────────
const app = document.getElementById("app");

// ─── HELPERS ────────────────────────────────────────────────────────────────
function toggle(set, item) {
  const next = new Set(set);
  next.has(item) ? next.delete(item) : next.add(item);
  return next;
}

// Calculate random non-overlapping positions for fruits
function calculateFruitPositions(containerWidth, containerHeight, isMobile, isTablet) {
  const padding = 20; // Space from container edges
  const fruitWrapperWidth = 75; // Approximate width + margin
  const fruitWrapperHeight = 85; // Approximate height + margin
  
  // On mobile: use a nice responsive grid
  if (isMobile || containerWidth < 500) {
    return { type: 'grid', positions: null };
  }
  
  // On tablet and desktop: use random positions with collision detection
  const positions = [];
  const maxAttempts = 500; // Max attempts to find non-overlapping position
  const minDistance = 65; // Minimum distance between fruit centers
  
  // Generate random positions with collision detection
  for (let i = 0; i < FEELINGS.length; i++) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < maxAttempts) {
      // Generate random position within container bounds
      const x = padding + Math.random() * (containerWidth - fruitWrapperWidth - padding * 2);
      const y = padding + Math.random() * (containerHeight - fruitWrapperHeight - padding * 2);
      
      // Check for overlap with existing fruits
      let overlaps = false;
      for (const pos of positions) {
        const dx = x - pos.x;
        const dy = y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        positions.push({ x, y });
        placed = true;
      }
      
      attempts++;
    }
    
    // If we couldn't find a non-overlapping position, use grid fallback
    if (!placed) {
      const cols = Math.floor(containerWidth / fruitWrapperWidth);
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: padding + col * fruitWrapperWidth + fruitWrapperWidth / 2 - 35,
        y: padding + row * fruitWrapperHeight + fruitWrapperHeight / 2 - 40
      });
    }
  }
  
  return { type: 'random', positions };
}

function render() {
  if (state.screen === SCREEN.FEELINGS) {
    renderFeelingsScreen();
  } else if (state.screen === SCREEN.NEEDS) {
    renderNeedsScreen();
  } else if (state.screen === SCREEN.DONE) {
    renderDoneScreen();
  }
}

function renderFeelingsScreen() {
  const feelingsFruitsHtml = FEELINGS.map((f, index) => {
    const selected = state.feelings.has(f);
    const fruitClass = FRUIT_CLASSES[index % FRUIT_CLASSES.length];
    
    // Use data attributes for positioning - actual positions set by JS
    return `
      <div class="fruit-wrapper ${selected ? 'selected' : ''}" 
           data-feeling="${f}" 
           data-fruit-class="${fruitClass}"
           style="left: 0; top: 0;">
        <div class="fruit ${fruitClass}"></div>
        <div class="fruit-label">${f}</div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="screen">
      <header>
        <h1>How did this experience feel?</h1>
        <p class="subtitle">Select all that apply</p>
      </header>
      <div class="feelings-area" id="feelings-area">
        ${feelingsFruitsHtml}
      </div>
      <footer>
        <button class="btn-primary" id="btn-next" ${state.feelings.size === 0 ? 'disabled' : ''}>Next →</button>
      </footer>
    </div>
  `;

  // After DOM is rendered, calculate and apply positions
  requestAnimationFrame(() => {
    const area = document.getElementById('feelings-area');
    if (!area) return;
    
    const rect = area.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Determine device type
    const isMobile = window.innerWidth < 600;
    const isTablet = window.innerWidth >= 600 && window.innerWidth < 1024;
    
    const layout = calculateFruitPositions(width, height, isMobile, isTablet);
    
    const wrappers = area.querySelectorAll('.fruit-wrapper');
    
    if (layout.type === 'grid') {
      // Mobile/tablet grid layout - responsive columns
      const cols = isMobile ? 4 : (isTablet ? 5 : 6);
      const cellWidth = width / cols;
      const cellHeight = 90; // Approximate cell height
      
      wrappers.forEach((wrapper, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        const x = col * cellWidth + cellWidth / 2 - 35;
        const y = row * cellHeight + cellHeight / 2 - 40;
        
        wrapper.style.left = `${Math.max(10, x)}px`;
        wrapper.style.top = `${Math.max(10, y)}px`;
      });
    } else {
      // Random layout for larger screens
      layout.positions.forEach((pos, i) => {
        if (wrappers[i]) {
          wrappers[i].style.left = `${pos.x}px`;
          wrappers[i].style.top = `${pos.y}px`;
        }
      });
    }
    
    // Add click handlers after positioning
    wrappers.forEach(wrapper => {
      wrapper.addEventListener('click', () => {
        const feeling = wrapper.dataset.feeling;
        state.feelings = toggle(state.feelings, feeling);
        render();
      });
    });
  });

  app.querySelector('#btn-next').addEventListener('click', () => {
    state.screen = SCREEN.NEEDS;
    render();
  });
}

function renderNeedsScreen() {
  const needsChipsHtml = NEEDS.map(n => {
    const s = state.needStates[n];
    return `<button class="need-chip need-chip--${s || 'none'}" data-need="${n}">
      <span class="need-label">${n}</span>
      ${s === NEED_STATES.MET ? '<span class="need-badge">✓</span>' : ''}
      ${s === NEED_STATES.UNMET ? '<span class="need-badge">✗</span>' : ''}
    </button>`;
  }).join('');

  app.innerHTML = `
    <div class="screen">
      <header>
        <h1>Which needs were involved?</h1>
        <p class="subtitle">Tap once for met ✓ · twice for unmet ✗ · again to clear</p>
      </header>
      <div class="needs-grid">${needsChipsHtml}</div>
      ${state.error ? `<p class="error-msg">${state.error}</p>` : ''}
      <footer>
        <button class="btn-ghost" id="btn-back" ${state.submitting ? 'disabled' : ''}>← Back</button>
        <button class="btn-primary" id="btn-submit" ${state.submitting ? 'disabled' : ''}>
          ${state.submitting ? 'Sending…' : 'Submit'}
        </button>
      </footer>
    </div>
  `;

  app.querySelectorAll('.need-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const need = chip.dataset.need;
      const cur = state.needStates[need];
      let next;
      if (cur === NEED_STATES.NONE || cur === undefined) {
        next = NEED_STATES.MET;
      } else if (cur === NEED_STATES.MET) {
        next = NEED_STATES.UNMET;
      } else {
        next = null;
      }
      state.needStates = { ...state.needStates, [need]: next };
      render();
    });
  });

  app.querySelector('#btn-back').addEventListener('click', () => {
    state.screen = SCREEN.FEELINGS;
    render();
  });

  app.querySelector('#btn-submit').addEventListener('click', handleSubmit);
}

function renderDoneScreen() {
  app.innerHTML = `
    <div class="screen screen--centered">
      <div class="done-icon">✓</div>
      <h1>Thank you</h1>
      <p class="subtitle">Your response has been recorded anonymously.</p>
      <button class="btn-primary" id="btn-reset">Submit another response</button>
    </div>
  `;

  app.querySelector('#btn-reset').addEventListener('click', reset);
}

async function handleSubmit() {
  state.error = null;
  state.submitting = true;
  render();

  try {
    const metNeeds = NEEDS.filter(n => state.needStates[n] === NEED_STATES.MET);
    const unmetNeeds = NEEDS.filter(n => state.needStates[n] === NEED_STATES.UNMET);

    const payload = {
      secret: SHARED_SECRET,
      timestamp: new Date().toISOString(),
      feelings: [...state.feelings].join(", "),
      needs_met: metNeeds.join(", "),
      needs_unmet: unmetNeeds.join(", "),
    };

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== "ok") throw new Error(data.message || "Unknown error");

    state.screen = SCREEN.DONE;
  } catch (e) {
    state.error = "Something went wrong. Please try again.";
    console.error(e);
  } finally {
    state.submitting = false;
    render();
  }
}

function reset() {
  state.feelings = new Set();
  state.needStates = {};
  state.error = null;
  state.screen = SCREEN.FEELINGS;
  render();
}

// Handle window resize for responsive layout
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (state.screen === SCREEN.FEELINGS) {
      render();
    }
  }, 250);
});

// ─── INIT ───────────────────────────────────────────────────────────────────
render();
