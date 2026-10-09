const STORAGE_KEY = "time_calculator_v3";

const app = document.getElementById("app");

const modal = document.getElementById("timeModal");
const timeForm = document.getElementById("timeForm");

const startTimeInput = document.getElementById("startTime");
const endTimeInput = document.getElementById("endTime");

const durationPreview = document.getElementById("durationPreview");
const modalTitle = document.getElementById("modalTitle");
const saveTimeBtn = document.getElementById("saveTimeBtn");

let calculations = loadCalculations();

let currentCalculationId = null;
let editingIntervalId = null;

/* ==========================
   STORAGE
========================== */

function loadCalculations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCalculations() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(calculations)
  );
}

/* ==========================
   HELPERS
========================== */

function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ==========================
   TIME CALCULATIONS
========================== */

function timeToMinutes(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return 0;
  }

  const [hours, minutes] = time
    .split(":")
    .map(Number);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 0;
  }

  return hours * 60 + minutes;
}

function calculateDuration(start, end) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  let difference = endMinutes - startMinutes;

  // Handle overnight intervals
  if (difference < 0) {
    difference += 24 * 60;
  }

  return difference;
}

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0")
  );
}

function getTotalMinutes(calculation) {
  return calculation.intervals.reduce(
    (total, interval) => {
      return total + calculateDuration(
        interval.start,
        interval.end
      );
    },
    0
  );
}

function getCalculationTitle(calculation) {
  const title = calculation.title?.trim();

  if (title) return title;

  const first = calculation.intervals[0];

  if (first) {
    return `${first.start} → ${first.end}`;
  }

  return "Untitled Calculation";
}

/* ==========================
   ROUTING
========================== */

function navigate(path) {
  history.pushState({}, "", path);

  render();
}

function getRouteId() {
  const path = window.location.pathname;

  const parts = path.split("/").filter(Boolean);

  return parts[0] || null;
}

window.addEventListener("popstate", render);

/* ==========================
   CREATE CALCULATION
========================== */

function createCalculation() {
  const calculation = {
    id: generateId(),
    title: "",
    intervals: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  calculations.unshift(calculation);

  saveCalculations();

  navigate(`/${calculation.id}`);
}

function getCurrentCalculation() {
  return calculations.find(
    item => item.id === currentCalculationId
  );
}

/* ==========================
   HOME VIEW
========================== */

function renderHome() {
  currentCalculationId = null;

  const sorted = [...calculations].sort(
    (a, b) => b.updatedAt - a.updatedAt
  );

  app.innerHTML = `
    <header class="header">

      <div>
        <h1>Time Calculator</h1>

        <p class="subtitle">
          Calculate and save your time durations
        </p>
      </div>

    </header>

    <div class="section-header">

      <h2 class="section-title">
        Your Calculations
      </h2>

      <button
        class="btn btn-primary"
        id="newCalculationBtn"
      >
        + Calculate
      </button>

    </div>

    <div class="calculation-list">

      ${
        sorted.length === 0
          ? `
            <div class="empty-state">

              <div class="empty-icon">⏱️</div>

              <h3>No calculations yet</h3>

              <p>
                Create your first calculation to
                start tracking time durations.
              </p>

              <button
                class="btn btn-primary"
                id="emptyCreateBtn"
              >
                + New Calculation
              </button>

            </div>
          `
          : sorted.map(calculation => {

              const total = formatDuration(
                getTotalMinutes(calculation)
              );

              const title = escapeHTML(
                getCalculationTitle(calculation)
              );

              const count = calculation.intervals.length;

              return `
                <div class="calculation-card">

                  <div
                    class="calculation-info"
                    data-open="${calculation.id}"
                    role="button"
                    tabindex="0"
                  >

                    <div class="calculation-title">
                      ${title}
                    </div>

                    <div class="calculation-meta">
                      ${count} time interval${count !== 1 ? "s" : ""}
                    </div>

                  </div>

                  <div class="calculation-total">
                    ${total}
                  </div>

                  <button
                    class="delete-btn"
                    data-delete="${calculation.id}"
                    aria-label="Delete calculation"
                  >
                    &times;
                  </button>

                </div>
              `;
            }).join("")
      }

    </div>
  `;

  document
    .getElementById("newCalculationBtn")
    ?.addEventListener("click", createCalculation);

  document
    .getElementById("emptyCreateBtn")
    ?.addEventListener("click", createCalculation);

  app.querySelectorAll("[data-open]").forEach(element => {
    const open = () => {
      navigate(`/${element.dataset.open}`);
    };

    element.addEventListener("click", open);

    element.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  app.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deleteCalculation(button.dataset.delete);
    });
  });
}

/* ==========================
   DELETE CALCULATION
========================== */

function deleteCalculation(id) {
  const confirmed = confirm(
    "Are you sure you want to delete this calculation?"
  );

  if (!confirmed) return;

  calculations = calculations.filter(
    item => item.id !== id
  );

  saveCalculations();

  renderHome();
}

/* ==========================
   CALCULATOR VIEW
========================== */

function renderCalculator(id) {
  const calculation = calculations.find(
    item => item.id === id
  );

  if (!calculation) {
    navigate("/");
    return;
  }

  currentCalculationId = id;

  const totalMinutes = getTotalMinutes(calculation);

  app.innerHTML = `
    <button class="back-btn" id="backBtn">
      ← Back to Calculations
    </button>

    <div class="calculator-header">

      <h1>Time Calculator</h1>

      <p class="subtitle">
        Add time intervals to calculate total duration
      </p>

    </div>

    <div class="card">

      <div class="form-group" style="margin-bottom:0">

        <label
          for="calculationTitle"
          class="form-label"
        >
          Calculation Title (Optional)
        </label>

        <input
          type="text"
          id="calculationTitle"
          class="form-input"
          placeholder="e.g. Weekly Work Hours"
          maxlength="100"
          value="${escapeHTML(calculation.title || "")}"
        />

      </div>

    </div>

    <div style="margin-top:28px">

      <div class="section-header">

        <h2 class="section-title">
          Time Intervals
        </h2>

        <button
          class="btn btn-primary"
          id="addTimeBtn"
        >
          + Add Time
        </button>

      </div>

      <div class="interval-list">

        ${
          calculation.intervals.length === 0
            ? `
              <div class="empty-state">

                <div class="empty-icon">🕒</div>

                <h3>No time intervals</h3>

                <p>
                  Add a start and end time
                  to calculate the duration.
                </p>

                <button
                  class="btn btn-primary"
                  id="emptyAddBtn"
                >
                  + Add Time
                </button>

              </div>
            `
            : calculation.intervals.map(
                (interval, index) => {

                  const duration = formatDuration(
                    calculateDuration(
                      interval.start,
                      interval.end
                    )
                  );

                  return `
                    <div class="interval-card">

                      <div class="interval-top">

                        <span class="interval-number">
                          INTERVAL ${index + 1}
                        </span>

                        <div class="interval-actions">

                          <button
                            class="action-btn"
                            data-edit="${interval.id}"
                          >
                            Edit
                          </button>

                          <button
                            class="action-btn danger"
                            data-remove="${interval.id}"
                          >
                            Delete
                          </button>

                        </div>

                      </div>

                      <div class="interval-times">

                        <div class="time-box">

                          <span class="time-label">
                            START
                          </span>

                          <span class="time-value">
                            ${escapeHTML(interval.start)}
                          </span>

                        </div>

                        <span class="time-arrow">
                          →
                        </span>

                        <div class="time-box">

                          <span class="time-label">
                            END
                          </span>

                          <span class="time-value">
                            ${escapeHTML(interval.end)}
                          </span>

                        </div>

                      </div>

                      <div class="interval-duration">

                        <span>Duration</span>

                        <strong>${duration}</strong>

                      </div>

                    </div>
                  `;
                }
              ).join("")
        }

      </div>

    </div>

    <div class="total-card">

      <div class="total-label">
        TOTAL DURATION
      </div>

      <div class="total-value">
        ${formatDuration(totalMinutes)}
      </div>

      <div class="total-caption">
        Hours : Minutes
      </div>

    </div>
  `;

  document
    .getElementById("backBtn")
    .addEventListener("click", () => navigate("/"));

  document
    .getElementById("addTimeBtn")
    .addEventListener("click", () => openTimeModal());

  document
    .getElementById("emptyAddBtn")
    ?.addEventListener("click", () => openTimeModal());

  document
    .getElementById("calculationTitle")
    .addEventListener("input", event => {
      calculation.title = event.target.value;
      calculation.updatedAt = Date.now();

      saveCalculations();
    });

  app.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      openTimeModal(button.dataset.edit);
    });
  });

  app.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      removeInterval(button.dataset.remove);
    });
  });
}

/* ==========================
   MODAL
========================== */

function openTimeModal(intervalId = null) {
  editingIntervalId = intervalId;

  timeForm.reset();

  durationPreview.textContent = "00:00";

  if (intervalId) {
    const calculation = getCurrentCalculation();

    const interval = calculation?.intervals.find(
      item => item.id === intervalId
    );

    if (!interval) return;

    startTimeInput.value = interval.start;
    endTimeInput.value = interval.end;

    modalTitle.textContent = "Edit Time";
    saveTimeBtn.textContent = "Save Changes";
  } else {
    modalTitle.textContent = "Add Time";
    saveTimeBtn.textContent = "Add Interval";
  }

  updateDurationPreview();

  modal.classList.remove("hidden");

  document.body.style.overflow = "hidden";

  startTimeInput.focus();
}

function closeTimeModal() {
  modal.classList.add("hidden");

  document.body.style.overflow = "";

  editingIntervalId = null;

  timeForm.reset();
}

function updateDurationPreview() {
  const start = startTimeInput.value;
  const end = endTimeInput.value;

  if (!start || !end) {
    durationPreview.textContent = "00:00";
    return;
  }

  const duration = calculateDuration(start, end);

  durationPreview.textContent = formatDuration(duration);
}

startTimeInput.addEventListener(
  "input",
  updateDurationPreview
);

endTimeInput.addEventListener(
  "input",
  updateDurationPreview
);

document
  .getElementById("closeModalBtn")
  .addEventListener("click", closeTimeModal);

document
  .getElementById("cancelModalBtn")
  .addEventListener("click", closeTimeModal);

modal.addEventListener("click", event => {
  if (event.target === modal) {
    closeTimeModal();
  }
});

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    !modal.classList.contains("hidden")
  ) {
    closeTimeModal();
  }
});

/* ==========================
   SAVE TIME INTERVAL
========================== */

timeForm.addEventListener("submit", event => {
  event.preventDefault();

  const start = startTimeInput.value;
  const end = endTimeInput.value;

  if (!start || !end) {
    alert("Please enter both start and end times.");
    return;
  }

  const calculation = getCurrentCalculation();

  if (!calculation) return;

  if (editingIntervalId) {
    const interval = calculation.intervals.find(
      item => item.id === editingIntervalId
    );

    if (interval) {
      interval.start = start;
      interval.end = end;
    }
  } else {
    calculation.intervals.push({
      id: generateId(),
      start,
      end
    });
  }

  calculation.updatedAt = Date.now();

  saveCalculations();

  closeTimeModal();

  renderCalculator(calculation.id);
});

/* ==========================
   REMOVE INTERVAL
========================== */

function removeInterval(intervalId) {
  const calculation = getCurrentCalculation();

  if (!calculation) return;

  const confirmed = confirm(
    "Delete this time interval?"
  );

  if (!confirmed) return;

  calculation.intervals = calculation.intervals.filter(
    interval => interval.id !== intervalId
  );

  calculation.updatedAt = Date.now();

  saveCalculations();

  renderCalculator(calculation.id);
}

/* ==========================
   MAIN RENDER
========================== */

function render() {
  const id = getRouteId();

  if (!id) {
    renderHome();
  } else {
    renderCalculator(id);
  }
}

/* ==========================
   INITIALIZE
========================== */

render();
