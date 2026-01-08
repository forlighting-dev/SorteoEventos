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

function downloadWinnersExcel() {
  if (winnersHistory.length === 0) {
    showToast('No hay ganadores para exportar.', 'ℹ️');
    return;
  }

  try {
    if (!window.XLSX) {
      showToast("No se cargó XLSX. Revisa el script CDN en index.html", "⚠️");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const data = [
      ["Nombre", "Departamento", "Ganador"],
      ...winnersHistory.map(winner => [
        winner.name || "",
        winner.department || "",
        winner.attended ? "Sí" : "No"
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 25 },
      { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Ganadores");

    const stamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace('T', '_')
      .slice(0, 19);

    XLSX.writeFile(workbook, `ganadores_${stamp}.xlsx`);
    showToast('Archivo Excel generado exitosamente', '📊');

  } catch (error) {
    console.error("Error al generar el archivo Excel:", error);
    showToast('Error al generar el archivo Excel', '❌');
    showToast('Intentando generar CSV...', '⚠️');
    downloadWinnersCSV();
  }
}

function downloadWinnersCSV() {
  if (winnersHistory.length === 0) return;

  const csvData = [
    ['Nombre', 'Departamento', 'Asistió'],
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

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
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
  return m.m42; // translateY
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

  const randomIndex = Math.floor(Math.random() * remainingParticipants.length);
  const winnerObj = remainingParticipants[randomIndex];

  const targetAnimationTime = 10000;
  const minItemsPerSecond = 15;
  const minTotalItems = Math.ceil((targetAnimationTime / 1000) * minItemsPerSecond);
  const loops = Math.max(6, Math.ceil(minTotalItems / remainingParticipants.length));

  const baseOrder = [...remainingParticipants];
  const extendedList = [];

  for (let i = 0; i < loops - 1; i++) {
    extendedList.push(...shuffle([...baseOrder]));
  }

  extendedList.push(...baseOrder);

  rouletteListEl.innerHTML = '';
  extendedList.forEach(p => {
    const it = document.createElement('div');
    it.className = 'roulette-item';
    it.dataset.id = p.id.toString();
    it.textContent = p.name;
    rouletteListEl.appendChild(it);
  });

  await sleep(40);

  const items = rouletteListEl.querySelectorAll('.roulette-item');
  if (items.length === 0) {
    isSelecting = false;
    selectWinnerButton.disabled = false;
    return;
  }

  const rowHeight = items[0].getBoundingClientRect().height;
  const viewportHeight = rouletteViewport.getBoundingClientRect().height;
  const highlightOffset = (viewportHeight - rowHeight) / 2;

  const baseIndex = remainingParticipants.findIndex(p => p.id === winnerObj.id);
  const perLoop = remainingParticipants.length;
  const targetIndex = (loops - 1) * perLoop + baseIndex;
  const finalTranslate = -(targetIndex * rowHeight) + highlightOffset;


  const spinDurationMs = 10000;
  rouletteListEl.style.transition = 'none';
  rouletteListEl.style.transform = 'translateY(0px)';

  await sleep(10);


  rouletteSound.currentTime = 0;
  rouletteSound.play().catch(e => console.log("No se pudo reproducir el audio de ruleta:", e));

  rouletteListEl.style.transition = `transform ${spinDurationMs}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
  rouletteListEl.style.transform = `translateY(${finalTranslate}px)`;

  await waitTransitionEnd(rouletteListEl, spinDurationMs + 200);

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

drawButton.addEventListener('click', () => startDraw());
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


(function initSideDecor() {
  const left = document.querySelector('.side-decor.left');
  const right = document.querySelector('.side-decor.right');
  if (!left || !right) return;

  const logos = [
    "Resources/AstrosLogo.png",
    "Resources/AtlasLogo.png",
    "Resources/CharrosLogo.png",
    "Resources/ChivasLogo.png"
  ];

  const bgImg = new Image();
  bgImg.src = "Resources/eventos.png";

  function clearDecor() {
    left.innerHTML = "";
    right.innerHTML = "";
  }

  function spawnLogos(container, count) {
    for (let i = 0; i < count; i++) {
      const img = document.createElement("img");
      img.className = "team-logo";
      img.src = logos[i % logos.length];
      img.alt = "";

      const top = Math.random() * 100;
      const size = 44 + Math.random() * 46;
      const dur = 4.5 + Math.random() * 4.5;
      const delay = -(Math.random() * dur);
      const op = 0.45 + Math.random() * 0.45;

      img.style.top = `${top}%`;
      img.style.setProperty("--size", `${size}px`);
      img.style.setProperty("--dur", `${dur}s`);
      img.style.setProperty("--delay", `${delay}s`);
      img.style.setProperty("--op", `${op}`);

      container.appendChild(img);
    }
  }

  function updateSideBars() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const iw = bgImg.naturalWidth || 0;
    const ih = bgImg.naturalHeight || 0;
    if (!iw || !ih) return;

    const scale = Math.min(vw / iw, vh / ih);
    const displayedW = iw * scale;
    const bar = Math.max(0, (vw - displayedW) / 2);

    document.documentElement.style.setProperty("--side-bar", `${bar}px`);

    const active = bar >= 60;
    left.classList.toggle("is-active", active);
    right.classList.toggle("is-active", active);

    if (active) {
      if (left.childElementCount === 0 || right.childElementCount === 0) {
        clearDecor();
        const count = vh > 820 ? 7 : 5;
        spawnLogos(left, count);
        spawnLogos(right, count);
      }
    } else {
      clearDecor();
    }
  }

  bgImg.onload = () => updateSideBars();

  window.addEventListener("resize", () => {
    clearDecor();
    updateSideBars();
  });
})();
