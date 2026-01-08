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


(function initSideDecorDVD() {
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

  let rafId = null;
  let spritesL = [];
  let spritesR = [];
  let running = false;
  let lastT = 0;

  function rand(min, max){ return min + Math.random() * (max - min); }
  function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  function clearDecor() {
    left.innerHTML = "";
    right.innerHTML = "";
    spritesL = [];
    spritesR = [];
  }

  function stopAnim() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function startAnim() {
    if (running) return;
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(tick);
  }

 function spawnBouncers(container, count) {
  const W = container.clientWidth;
  const H = container.clientHeight;

  const sources = [...logos];

  while (sources.length < count) {
    sources.push(pick(logos));
  }

  shuffle(sources);

  const sprites = [];

  for (let i = 0; i < count; i++) {
  
    const minSize = 53;
    const maxSize = 70;

    const hardCap = Math.max(28, Math.min(maxSize, Math.floor(Math.min(W, H) * 0.32)));
    const size = Math.round(rand(minSize, hardCap));

    const speed = rand(65, 130) * (62 / Math.max(40, size));

    const angle = rand(0, Math.PI * 2);

    const el = document.createElement("img");
    el.className = "dvd-logo";
    el.src = sources[i];  
    el.alt = "";
    el.style.setProperty("--size", `${size}px`);
    el.style.setProperty("--op", `${rand(0.55, 0.95).toFixed(2)}`);
    container.appendChild(el);

    let x = 0, y = 0;
    let placed = false;

    for (let tries = 0; tries < 120; tries++) {
      x = rand(0, Math.max(0, W - size));
      y = rand(0, Math.max(0, H - size));

      let ok = true;
      for (const s of sprites) {
        if (aabbOverlap(x, y, size, size, s.x, s.y, s.w, s.h)) {
          ok = false;
          break;
        }
      }
      if (ok) { placed = true; break; }
    }

    if (!placed) {
      x = rand(0, Math.max(0, W - size));
      y = rand(0, Math.max(0, H - size));
    }

    const s = {
      el,
      x, y,
      vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
      vy: Math.sin(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
      w: size,
      h: size
    };

    sprites.push(s);
    renderSprite(s);
  }

  return sprites;
}


  function renderSprite(s) {
    s.el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
  }

  function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function clampInside(s, W, H) {
    s.x = Math.max(0, Math.min(s.x, Math.max(0, W - s.w)));
    s.y = Math.max(0, Math.min(s.y, Math.max(0, H - s.h)));
  }

  function updateWorld(container, sprites, dt) {
    const W = container.clientWidth;
    const H = container.clientHeight;

    for (const s of sprites) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.x <= 0) { s.x = 0; s.vx = Math.abs(s.vx); }
      else if (s.x + s.w >= W) { s.x = Math.max(0, W - s.w); s.vx = -Math.abs(s.vx); }

      if (s.y <= 0) { s.y = 0; s.vy = Math.abs(s.vy); }
      else if (s.y + s.h >= H) { s.y = Math.max(0, H - s.h); s.vy = -Math.abs(s.vy); }
    }

    for (let i = 0; i < sprites.length; i++) {
      for (let j = i + 1; j < sprites.length; j++) {
        const a = sprites[i];
        const b = sprites[j];

        if (!aabbOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h)) continue;

        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

        if (overlapX < overlapY) {
          const push = overlapX / 2;
          if (a.x < b.x) { a.x -= push; b.x += push; }
          else { a.x += push; b.x -= push; }

          const tmp = a.vx; a.vx = b.vx; b.vx = tmp;
        } else {
          const push = overlapY / 2;
          if (a.y < b.y) { a.y -= push; b.y += push; }
          else { a.y += push; b.y -= push; }

          const tmp = a.vy; a.vy = b.vy; b.vy = tmp;
        }

        a.vx += rand(-8, 8);
        a.vy += rand(-8, 8);
        b.vx += rand(-8, 8);
        b.vy += rand(-8, 8);

        clampInside(a, W, H);
        clampInside(b, W, H);
      }
    }

    for (const s of sprites) renderSprite(s);
  }

  function tick(t) {
    if (!running) return;
    const dt = Math.min(0.033, (t - lastT) / 1000); 
    lastT = t;

    updateWorld(left, spritesL, dt);
    updateWorld(right, spritesR, dt);

    rafId = requestAnimationFrame(tick);
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

    if (!active) {
      stopAnim();
      clearDecor();
      return;
    }

    if (spritesL.length === 0 || spritesR.length === 0) {
      clearDecor();

      const count = Math.max(4, vh > 820 ? 8 : 6);


      void left.offsetWidth;
      void right.offsetWidth;

      spritesL = spawnBouncers(left, count);
      spritesR = spawnBouncers(right, count);

      startAnim();
    } else {
      const WL = left.clientWidth, HL = left.clientHeight;
      const WR = right.clientWidth, HR = right.clientHeight;

      for (const s of spritesL) clampInside(s, WL, HL);
      for (const s of spritesR) clampInside(s, WR, HR);
    }
  }

  bgImg.onload = updateSideBars;

  window.addEventListener("resize", () => {
    updateSideBars();
  });
})();

