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
  fruitPositions: null, // Will store { type, positions } - computed once
  containerSize: null   // Store container dimensions for position calculation
};

// Fixed item size for collision detection
const ITEM_WIDTH = 80;
const ITEM_HEIGHT = 90;

// ─── DOM ───────────────────────────────────────────────────────────────────
const app = document.getElementById("app");

// ─── HELPERS ────────────────────────────────────────────────────────────────
function toggle(set, item) {
  const next = new Set(set);
  next.has(item) ? next.delete(item) : next.add(item);
  return next;
}

// Calculate positions using a more reliable grid approach
function calculateFruitPositions(containerWidth, containerHeight, isMobile, isTablet) {
  const padding = 15; // Space from container edges
  
  // On mobile: use responsive grid
  if (isMobile || containerWidth < 500) {
    return { type: 'grid', positions: null };
  }
  
  // Available space inside padding
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;
  
  // Calculate optimal grid dimensions
  const fruitCount = FEELINGS.length;
  
  // Find the best grid that fits all items with some spacing
  let bestCols = Math.ceil(Math.sqrt(fruitCount)); // Start with square-ish
  let bestRows = Math.ceil(fruitCount / bestCols);
  
  // Try to optimize for available space
  while (bestCols > 1) {
    const testRows = Math.ceil(fruitCount / (bestCols - 1));
    const testCellWidth = availableWidth / (bestCols - 1);
    const testCellHeight = availableHeight / testRows;
    
    if (testCellWidth >= ITEM_WIDTH && testCellHeight >= ITEM_HEIGHT) {
      bestCols--;
      bestRows = testRows;
    } else {
      break;
    }
  }
  
  // Ensure we don't exceed reasonable limits
  bestCols = Math.min(bestCols, 8);
  bestCols = Math.max(bestCols, 3);
  const cols = bestCols;
  const rows = Math.ceil(fruitCount / cols);
  
  // Calculate cell dimensions - ensure items fit
  const cellWidth = Math.max(ITEM_WIDTH, availableWidth / cols);
  const cellHeight = Math.max(ITEM_HEIGHT, availableHeight / rows);
  
  // Generate positions using grid with small jitter to avoid perfect alignment
  const positions = [];
  const maxJitterX = Math.min(10, (cellWidth - ITEM_WIDTH) / 2);
  const maxJitterY = Math.min(10, (cellHeight - ITEM_HEIGHT) / 2);
  
  for (let i = 0; i < fruitCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    // Base position from grid
    const baseX = padding + col * cellWidth + (cellWidth - ITEM_WIDTH) / 2;
    const baseY = padding + row * cellHeight + (cellHeight - ITEM_HEIGHT) / 2;
    
    // Add small random jitter
    const jitterX = (Math.random() - 0.5) * maxJitterX * 0.6;
    const jitterY = (Math.random() - 0.5) * maxJitterY * 0.6;
    
    const x = baseX + jitterX;
    const y = baseY + jitterY;
    
    // Ensure we stay within bounds with some margin
    const maxX = containerWidth - padding - ITEM_WIDTH;
    const maxY = containerHeight - padding - ITEM_HEIGHT;
    
    positions.push({
      x: Math.max(padding, Math.min(maxX, x)),
      y: Math.max(padding, Math.min(maxY, y))
    });
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
    
    return `
      <div class="fruit-wrapper ${selected ? 'selected' : ''}" 
           data-feeling="${f}" 
           data-fruit-class="${fruitClass}">
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

  // Calculate and apply positions after DOM is rendered
  requestAnimationFrame(() => {
    const area = document.getElementById('feelings-area');
    if (!area) return;
    
    const rect = area.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Determine device type
    const isMobile = window.innerWidth < 600;
    const isTablet = window.innerWidth >= 600 && window.innerWidth < 1024;
    
    // Only calculate positions if container size changed or not yet calculated
    const needsRecalculation = !state.fruitPositions || 
                              !state.containerSize ||
                              state.containerSize.width !== width ||
                              state.containerSize.height !== height ||
                              state.containerSize.isMobile !== isMobile;
    
    if (needsRecalculation) {
      state.fruitPositions = calculateFruitPositions(width, height, isMobile, isTablet);
      state.containerSize = { width, height, isMobile };
    }
    
    const wrappers = area.querySelectorAll('.fruit-wrapper');
    
    if (state.fruitPositions.type === 'grid') {
      // Mobile/tablet grid layout with fixed item size
      const cols = isMobile ? 4 : (isTablet ? 5 : 6);
      const cellWidth = width / cols;
      const cellHeight = 100; // Fixed height for rows
      
      wrappers.forEach((wrapper, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        // Center item in cell
        const x = col * cellWidth + (cellWidth - ITEM_WIDTH) / 2;
        const y = row * cellHeight + (cellHeight - ITEM_HEIGHT) / 2;
        
        wrapper.style.left = `${x}px`;
        wrapper.style.top = `${y}px`;
      });
    } else {
      // Random layout - use stored positions
      state.fruitPositions.positions.forEach((pos, i) => {
        if (wrappers[i]) {
          wrappers[i].style.left = `${pos.x}px`;
          wrappers[i].style.top = `${pos.y}px`;
        }
      });
    }
    
    // Add click handlers (only once)
    const existingHandler = area.getAttribute('data-handlers-attached');
    if (!existingHandler) {
      area.setAttribute('data-handlers-attached', 'true');
      
      wrappers.forEach(wrapper => {
        wrapper.addEventListener('click', () => {
          const feeling = wrapper.dataset.feeling;
          state.feelings = toggle(state.feelings, feeling);
          render();
        });
      });
    }
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
  // Keep fruit positions and container size for consistent layout
  render();
}

// Handle window resize - only recalculate if moving between mobile/desktop
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const isMobile = window.innerWidth < 600;
    const wasMobile = state.containerSize?.isMobile;
    
    // Only clear positions if switching between mobile and desktop
    if (state.screen === SCREEN.FEELINGS && wasMobile !== isMobile) {
      state.fruitPositions = null;
      state.containerSize = null;
      render();
    }
  }, 250);
});

// ─── INIT ───────────────────────────────────────────────────────────────────
render();
