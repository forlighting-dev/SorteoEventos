const participantsTextarea = document.getElementById('participants');
const drawButton = document.getElementById('drawButton');

const setupScreen = document.getElementById('setupScreen');
const drawScreen = document.getElementById('drawScreen');
const backButton = document.getElementById('backButton');

const rouletteViewport = document.getElementById('rouletteViewport');
const rouletteListEl = document.getElementById('rouletteList');

const selectWinnerButton = document.getElementById('selectWinnerButton');

const winnerOverlay = document.getElementById('winnerOverlay');
const winnerOverlayName = document.getElementById('winnerOverlayName');
const closeWinnerBtn = document.getElementById('closeWinnerBtn');
const attendedCheckbox = document.getElementById('attendedCheckbox');

const downloadExcelBtn = document.getElementById('downloadExcelBtn');

const eventModal = document.getElementById('eventModal');
const eventSelect = document.getElementById('eventSelect');
const eventDateInput = document.getElementById('eventDate');
const acceptEventBtn = document.getElementById('acceptEventBtn');
const closeEventModalBtn = document.getElementById('closeEventModalBtn');

let selectedEvent = "";
let selectedDate = ""; 

let allParticipants = [];
let remainingParticipants = [];
let winnersHistory = [];
let isSelecting = false;
let currentWinner = null;

const rouletteSound = new Audio('Resources/Ruleta.mp3');
const winnerSound = new Audio('Resources/Ganador.mp3');
winnerSound.loop = true;

const LS_KEY_WINNERS = "raffle_winners_v1";

function loadWinnersFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY_WINNERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("No se pudo leer localStorage winners:", e);
    return [];
  }
}

function saveWinnersToStorage(list) {
  try {
    localStorage.setItem(LS_KEY_WINNERS, JSON.stringify(list));
  } catch (e) {
    console.warn("No se pudo guardar localStorage winners:", e);
  }
}

function clearWinnersStorage() {
  try {
    localStorage.removeItem(LS_KEY_WINNERS);
  } catch (e) {
    console.warn("No se pudo limpiar localStorage winners:", e);
  }
}

function showToast(message, icon = "⚠️") {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span>${message}</span>
    <span class="toast-close">✕</span>
  `;
  document.body.appendChild(toast);
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function updateStatus() {
  selectWinnerButton.disabled = isSelecting;
  downloadExcelBtn.disabled = winnersHistory.length === 0;
}

function renderBaseRouletteList() {
  rouletteListEl.innerHTML = '';
  remainingParticipants.forEach(p => {
    const item = document.createElement('div');
    item.className = 'roulette-item';
    item.dataset.id = p.id.toString();
    item.textContent = p.name;
    rouletteListEl.appendChild(item);
  });
  rouletteListEl.style.transition = 'none';
  rouletteListEl.style.transform = 'translateY(0px)';
}

function openWinnerOverlay(winnerObj) {
  currentWinner = winnerObj;
  winnerOverlayName.innerHTML = `
    <div class="winner-name">${winnerObj.name}</div>
    <div class="winner-department">${winnerObj.department || 'Sin departamento'}</div>
  `;
  winnerOverlay.classList.add('show');
  winnerOverlay.setAttribute('aria-hidden', 'false');
  attendedCheckbox.checked = false;

  const winnerNameElement = winnerOverlayName.querySelector('.winner-name');
  winnerNameElement.classList.remove('animate');
  void winnerNameElement.offsetWidth;
  winnerNameElement.classList.add('animate');

  winnerSound.currentTime = 0;
  winnerSound.play().catch(() => { });
}

function closeWinnerOverlay() {
  winnerOverlay.classList.remove('show');
  winnerOverlay.setAttribute('aria-hidden', 'true');

  winnerSound.pause();
  winnerSound.currentTime = 0;

  if (currentWinner && attendedCheckbox.checked) {
    const entry = {
      id: currentWinner.id,
      name: currentWinner.name,
      department: currentWinner.department,
      timestamp: (new Date()).toLocaleString(),
      attended: true
    };

    winnersHistory.push(entry);
    saveWinnersToStorage(winnersHistory);
    showToast(`${currentWinner.name} guardado como ganador`, "✅");
  }

  currentWinner = null;
  attendedCheckbox.checked = false;

  renderBaseRouletteList();
  updateStatus();

  isSelecting = false;
  selectWinnerButton.disabled = false;
}

function formatDateDDMMYYYY(iso) {
  if (!iso || typeof iso !== "string") return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}


async function downloadWinnersExcel() {
  if (winnersHistory.length === 0) {
    showToast('No hay ganadores para exportar.', 'ℹ️');
    return;
  }

  try {
    if (!window.ExcelJS) {
      showToast("No se cargó ExcelJS. Revisa el script CDN en index.html", "⚠️");
      return;
    }

    const ev = (typeof selectedEvent !== "undefined" && selectedEvent) ? selectedEvent : "";
    const dtRaw = (typeof selectedDate !== "undefined" && selectedDate) ? selectedDate : "";
    const dt = formatDateDDMMYYYY(dtRaw);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Ganadores");

    ws.columns = [
      { width: 30 }, 
      { width: 25 }, 
      { width: 15 },
    ];

    const COLOR_EVENTO = "FF1F4E9B"; 
    const COLOR_HEADER = "FF7F93A0";

    const styleEventoFecha = {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_EVENTO } },
      alignment: { vertical: "middle", horizontal: "left" },
    };

    const styleHeader = {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER } },
      alignment: { vertical: "middle", horizontal: "center" },
    };

    ws.getCell("A1").value = `Evento: ${ev}`;
    ws.getCell("B1").value = `Fecha: ${dt}`;
    ws.getCell("C1").value = ""; 

    ws.mergeCells("B1:C1");

    ws.getCell("A1").style = styleEventoFecha;
    ws.getCell("B1").style = styleEventoFecha;
    ws.getCell("C1").style = styleEventoFecha;

    ws.getRow(1).height = 22;

    ws.getCell("A2").value = "Nombre";
    ws.getCell("B2").value = "Departamento";
    ws.getCell("C2").value = "Ganador";

    ws.getCell("A2").style = styleHeader;
    ws.getCell("B2").style = styleHeader;
    ws.getCell("C2").style = styleHeader;

    ws.getRow(2).height = 20;

    let r = 3;
    for (const w of winnersHistory) {
      ws.getCell(`A${r}`).value = w.name || "";
      ws.getCell(`B${r}`).value = w.department || "";
      ws.getCell(`C${r}`).value = w.attended ? "Sí" : "No";
      r++;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const stamp = new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
    const filename = `ganadores_${stamp}.xlsx`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast("Archivo Excel generado exitosamente", "📊");
  } catch (error) {
    console.error("Error al generar el archivo Excel (ExcelJS):", error);
    showToast("Error al generar el archivo Excel", "❌");
    showToast("Intentando generar CSV...", "⚠️");
    downloadWinnersCSV();
  }
}


function downloadWinnersCSV() {
  if (winnersHistory.length === 0) return;

  const ev = selectedEvent || "";
  const dt = selectedDate || "";

  const csvData = [
    [`Evento: ${ev}`, `Fecha: ${dt}`, ""],
    ["Nombre", "Departamento", "Ganador"],
    ...winnersHistory.map(w => [
      w.name || '',
      w.department || '',
      w.attended ? 'Sí' : 'No'
    ])
  ];

  const csvContent = csvData.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\r\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  link.download = `ganadores_${stamp}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


async function showConfettiBurst() {
  const colors = ['#f97316', '#facc15', '#22c55e', '#38bdf8', '#a855f7', '#ec4899'];
  const pieces = 150;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size = 8 + Math.random() * 6;
    const left = Math.random() * 100;
    const duration = 2.4 + Math.random() * 1.8;
    piece.style.left = left + 'vw';
    piece.style.width = size + 'px';
    piece.style.height = (size + 4) + 'px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = duration + 's';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), duration * 1000);
  }
}

function advanceTape({ rowHeight, offsetRef, px }) {
  let offset = offsetRef.value - px;

  while (offset <= -rowHeight) {
    offset += rowHeight;

    const first = rouletteListEl.firstElementChild;
    if (first) rouletteListEl.appendChild(first);

    if (offsetRef.order && offsetRef.order.length > 0) {
      offsetRef.order.push(offsetRef.order.shift());
    }
  }

  offsetRef.value = offset;
  rouletteListEl.style.transform = `translateY(${offset}px)`;
}

function getTranslateY(el) {
  const tr = getComputedStyle(el).transform;
  if (!tr || tr === "none") return 0;
  const m = new DOMMatrixReadOnly(tr);
  return m.m42; 
}

function waitTransitionEnd(el, msFallback = 0) {
  return new Promise((resolve) => {
    let done = false;
    const onEnd = (e) => {
      if (e.propertyName !== "transform") return;
      if (done) return;
      done = true;
      el.removeEventListener("transitionend", onEnd);
      resolve();
    };
    el.addEventListener("transitionend", onEnd);

    if (msFallback > 0) {
      setTimeout(() => {
        if (done) return;
        done = true;
        el.removeEventListener("transitionend", onEnd);
        resolve();
      }, msFallback);
    }
  });
}

async function selectRandomWinner() {
  if (isSelecting) return;

  isSelecting = true;
  selectWinnerButton.disabled = true;

  if (remainingParticipants.length === 0) {
    showToast("No hay participantes disponibles.", "ℹ️");
    isSelecting = false;
    selectWinnerButton.disabled = false;
    return;
  }

  shuffle(remainingParticipants);
  renderBaseRouletteList();
  await sleep(50);

  const randomIndex = Math.floor(Math.random() * remainingParticipants.length);
  const winnerObj = remainingParticipants[randomIndex];

  const targetAnimationTime = 10000;
  const minItemsPerSecond = 15;
  const minTotalItems = Math.ceil((targetAnimationTime / 1000) * minItemsPerSecond);
  const loops = Math.max(6, Math.ceil(minTotalItems / remainingParticipants.length));

  const baseOrder = [...remainingParticipants];
  const perLoop = baseOrder.length;

  const extendedList = [];
  let prevLastId = null;

  for (let i = 0; i < loops - 1; i++) {
    let chunk = shuffle([...baseOrder]);

    if (prevLastId !== null && chunk.length > 1 && chunk[0].id === prevLastId) {
      let guard = 0;
      while (guard < chunk.length && chunk[0].id === prevLastId) {
        chunk.push(chunk.shift());
        guard++;
      }
    }

    if (i === (loops - 2) && chunk.length > 1) {
      let tries = 0;
      while (tries < 25 && chunk[chunk.length - 1].id === baseOrder[0].id) {
        chunk = shuffle([...baseOrder]);

        if (prevLastId !== null && chunk.length > 1 && chunk[0].id === prevLastId) {
          let guard = 0;
          while (guard < chunk.length && chunk[0].id === prevLastId) {
            chunk.push(chunk.shift());
            guard++;
          }
        }
        tries++;
      }
    }

    extendedList.push(...chunk);
    prevLastId = chunk[chunk.length - 1].id;
  }

  extendedList.push(...baseOrder);

  rouletteListEl.innerHTML = "";
  extendedList.forEach((p) => {
    const it = document.createElement("div");
    it.className = "roulette-item";
    it.dataset.id = p.id.toString();
    it.textContent = p.name;
    rouletteListEl.appendChild(it);
  });

  await sleep(40);

  const items = rouletteListEl.querySelectorAll(".roulette-item");
  if (items.length === 0) {
    isSelecting = false;
    selectWinnerButton.disabled = false;
    return;
  }

  const rowHeight = items[0].getBoundingClientRect().height;
  const viewportHeight = rouletteViewport.getBoundingClientRect().height;
  const highlightOffset = (viewportHeight - rowHeight) / 2;

  const baseIndex = baseOrder.findIndex((p) => p.id === winnerObj.id);
  const targetIndex = (loops - 1) * perLoop + baseIndex;

  const finalTranslate = -(targetIndex * rowHeight) + highlightOffset;

  const spinDurationMs = 10000;

  rouletteListEl.style.transition = "none";
  rouletteListEl.style.transform = "translateY(0px)";
  await sleep(10);

  rouletteSound.currentTime = 0;
  rouletteSound.play().catch((e) => console.log("No se pudo reproducir el audio de ruleta:", e));

  rouletteListEl.style.transition = `transform ${spinDurationMs}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
  rouletteListEl.style.transform = `translateY(${finalTranslate}px)`;

  await waitTransitionEnd(rouletteListEl, spinDurationMs + 250);

  const winnerEl = rouletteListEl.querySelector(`.roulette-item[data-id="${winnerObj.id}"]`);
  if (winnerEl) {
    const viewportRect = rouletteViewport.getBoundingClientRect();
    const winnerRect = winnerEl.getBoundingClientRect();

    const viewportCenterY = viewportRect.top + viewportRect.height / 2;
    const winnerCenterY = winnerRect.top + winnerRect.height / 2;

    const delta = viewportCenterY - winnerCenterY;
    const currentY = getTranslateY(rouletteListEl);

    rouletteListEl.style.transition = "none";
    rouletteListEl.style.transform = `translateY(${currentY + delta}px)`;
  }

  rouletteSound.pause();
  rouletteSound.currentTime = 0;

  openWinnerOverlay(winnerObj);
  await showConfettiBurst();
  setTimeout(showConfettiBurst, 550);

  remainingParticipants.splice(randomIndex, 1);

  isSelecting = false;
  selectWinnerButton.disabled = false;
  updateStatus();
}

function openEventModal() {
  if (!eventModal) return;

  eventSelect.value = selectedEvent || "";
  eventDateInput.value = selectedDate || "";

  if (!eventDateInput.value) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    eventDateInput.value = `${y}-${m}-${d}`;
  }

  eventModal.classList.add('show');
  eventModal.setAttribute('aria-hidden', 'false');

  setTimeout(() => eventSelect.focus(), 0);
}

function closeEventModal() {
  if (!eventModal) return;
  eventModal.classList.remove('show');
  eventModal.setAttribute('aria-hidden', 'true');
}

function acceptEventAndStart() {
  const ev = (eventSelect.value || "").trim();
  const dt = (eventDateInput.value || "").trim();

  if (!ev) {
    showToast("Selecciona un evento.", "⚠️");
    return;
  }
  if (!dt) {
    showToast("Selecciona una fecha.", "⚠️");
    return;
  }

  selectedEvent = ev;
  selectedDate = dt;

  closeEventModal();
  startDraw();
}

function startDraw() {
  clearWinnersStorage();
  winnersHistory = [];
  updateStatus();
  showToast('Listado de ganadores reiniciado', '🔄');

  const lines = participantsTextarea.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    showToast("Ingresa al menos un participante para realizar el sorteo.");
    return;
  }

  allParticipants = lines.map((line, index) => {
    const parts = line.split(',').map(part => part.trim());
    const name = parts[0] || "";
    const dept = parts[1] || "";
    if (name === "" || dept === "") {
      showToast("Cada participante debe tener NOMBRE y DEPARTAMENTO.", "⚠️");
      throw new Error("Datos inválidos en participantes");
    }
    return { id: index + 1, name, department: dept };
  });

  remainingParticipants = shuffle([...allParticipants]);

  renderBaseRouletteList();

  setupScreen.classList.add('hidden');
  drawScreen.classList.remove('hidden');

  document.body.classList.remove('setup-mode');
  document.body.classList.add('draw-mode');
}

function resetToSetup() {
  allParticipants = [];
  remainingParticipants = [];
  isSelecting = false;
  rouletteListEl.innerHTML = '';
  currentWinner = null;
  attendedCheckbox.checked = false;

  rouletteSound.pause(); rouletteSound.currentTime = 0;
  winnerSound.pause(); winnerSound.currentTime = 0;

  updateStatus();
  drawScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');

  winnerOverlay.classList.remove('show');

  document.body.classList.remove('draw-mode');
  document.body.classList.add('setup-mode');
}

winnersHistory = loadWinnersFromStorage();
updateStatus();

document.body.classList.add('setup-mode');

drawButton.addEventListener('click', () => openEventModal());

selectWinnerButton.addEventListener('click', () => {
  selectRandomWinner().catch(err => {
    console.error(err);
    isSelecting = false;
    selectWinnerButton.disabled = false;
    showToast("Error seleccionando ganador", "💥");
  });
});

backButton.addEventListener('click', () => resetToSetup());
closeWinnerBtn.addEventListener('click', () => closeWinnerOverlay());
downloadExcelBtn.addEventListener('click', () => downloadWinnersExcel());

acceptEventBtn.addEventListener('click', () => acceptEventAndStart());
closeEventModalBtn.addEventListener('click', () => closeEventModal());
eventModal.addEventListener('click', (e) => {
  const target = e.target;
  if (target && target.dataset && target.dataset.close) closeEventModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && eventModal.classList.contains('show')) {
    closeEventModal();
  }
});

(function rotateEmoji() {
  const el = document.querySelector('.title .emoji') || document.querySelector('.emoji');
  if (!el) return;

  const emojis = ["⚾", "⚽", "🏀", "🎫"];
  let i = 0;

  el.textContent = emojis[i];

  setInterval(() => {
    i = (i + 1) % emojis.length;
    el.textContent = emojis[i];
  }, 1000);
})();

