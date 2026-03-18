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
  containerSize: null  // Store container dimensions for position calculation
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
// Uses spiral/packed placement with jitter for better distribution
function calculateFruitPositions(containerWidth, containerHeight, isMobile, isTablet) {
  const padding = 25;
  const fruitWidth = 75;
  const fruitHeight = 85;
  
  // On mobile: use a responsive grid
  if (isMobile || containerWidth < 500) {
    return { type: 'grid', positions: null };
  }
  
  // Available space
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;
  
  // Calculate grid dimensions based on fruit count and container size
  const fruitCount = FEELINGS.length;
  const cols = Math.max(4, Math.floor(availableWidth / fruitWidth));
  const rows = Math.ceil(fruitCount / cols);
  
  // Calculate cell size
  const cellWidth = availableWidth / cols;
  const cellHeight = Math.min(fruitHeight * 1.3, availableHeight / Math.max(rows, 3));
  
  // Generate positions using grid with random offset (jitter)
  const positions = [];
  const jitterRange = Math.min(15, cellWidth * 0.15);
  
  for (let i = 0; i < fruitCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    // Base position from grid
    const baseX = padding + col * cellWidth + cellWidth / 2 - fruitWidth / 2;
    const baseY = padding + row * cellHeight + cellHeight / 2 - fruitHeight / 2;
    
    // Add random jitter within cell bounds
    const jitterX = (Math.random() - 0.5) * jitterRange * 2;
    const jitterY = (Math.random() - 0.5) * jitterRange * 2;
    
    // Clamp to container bounds
    const x = Math.max(padding, Math.min(containerWidth - fruitWidth - padding, baseX + jitterX));
    const y = Math.max(padding, Math.min(containerHeight - fruitHeight - padding, baseY + jitterY));
    
    positions.push({ x, y });
  }
  
  // Apply collision resolution pass
  const minDistance = Math.min(fruitWidth, fruitHeight) * 0.9;
  resolveCollisions(positions, minDistance, containerWidth, containerHeight, padding, fruitWidth, fruitHeight);
  
  return { type: 'random', positions };
}

// Resolve any remaining overlaps using iterative separation
function resolveCollisions(positions, minDistance, containerWidth, containerHeight, padding, fruitWidth, fruitHeight) {
  const maxIterations = 50;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let hasCollision = false;
    
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i];
        const p2 = positions[j];
        
        // Center points
        const c1x = p1.x + fruitWidth / 2;
        const c1y = p1.y + fruitHeight / 2;
        const c2x = p2.x + fruitWidth / 2;
        const c2y = p2.y + fruitHeight / 2;
        
        // Distance between centers
        const dx = c2x - c1x;
        const dy = c2y - c1y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < minDistance && dist > 0) {
          hasCollision = true;
          
          // Push apart based on overlap
          const overlap = minDistance - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          
          // Move each fruit half the overlap distance
          const moveX = nx * overlap * 0.5;
          const moveY = ny * overlap * 0.5;
          
          p1.x -= moveX;
          p1.y -= moveY;
          p2.x += moveX;
          p2.y += moveY;
          
          // Clamp to bounds
          p1.x = Math.max(padding, Math.min(containerWidth - fruitWidth - padding, p1.x));
          p1.y = Math.max(padding, Math.min(containerHeight - fruitHeight - padding, p1.y));
          p2.x = Math.max(padding, Math.min(containerWidth - fruitWidth - padding, p2.x));
          p2.y = Math.max(padding, Math.min(containerHeight - fruitHeight - padding, p2.y));
        }
      }
    }
    
    if (!hasCollision) break;
  }
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
      // Mobile/tablet grid layout
      const cols = isMobile ? 4 : (isTablet ? 5 : 6);
      const cellWidth = width / cols;
      const cellHeight = 90;
      
      wrappers.forEach((wrapper, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        const x = col * cellWidth + cellWidth / 2 - 35;
        const y = row * cellHeight + cellHeight / 2 - 40;
        
        wrapper.style.left = `${Math.max(10, x)}px`;
        wrapper.style.top = `${Math.max(10, y)}px`;
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
    
    // Add click handlers (only once, not on re-renders)
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
