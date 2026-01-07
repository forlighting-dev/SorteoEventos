const participantsTextarea = document.getElementById('participants');
const drawButton = document.getElementById('drawButton');

const setupScreen = document.getElementById('setupScreen');
const drawScreen = document.getElementById('drawScreen');
const backButton = document.getElementById('backButton');

const rouletteViewport = document.getElementById('rouletteViewport');
const rouletteListEl = document.getElementById('rouletteList');

const selectWinnerButton = document.getElementById('selectWinnerButton');
const drawHelperText = document.getElementById('drawHelperText');

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
  winnerSound.play().catch(e => {
    console.log("No se pudo reproducir el audio del ganador:", e);
  });
}

function closeWinnerOverlay() {
  winnerOverlay.classList.remove('show');
  winnerOverlay.setAttribute('aria-hidden', 'true');
  
  winnerSound.pause();
  winnerSound.currentTime = 0;
  
  if (currentWinner && attendedCheckbox.checked) {
    winnersHistory.push({
      id: currentWinner.id,
      name: currentWinner.name,
      department: currentWinner.department,
      timestamp: (new Date()).toLocaleString(),
      attended: true
    });
    
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
    
    const fileName = `ganadores_${stamp}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    showToast('Archivo Excel generado exitosamente', '📊');
    
  } catch (error) {
    console.error("Error al generar el archivo Excel:", error);
    showToast('Error al generar el archivo Excel', '❌');
    
    showToast('Intentando generar archivo CSV como alternativa...', '⚠️');
    downloadWinnersCSV();
  }
}

// Función alternativa CSV (por si acaso)
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
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\r\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-');
  link.download = `ganadores_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function showConfettiBurst() {
  const colors = ['#f97316', '#facc15', '#22c55e', '#38bdf8', '#a855f7', '#ec4899'];
  const pieces = 120;
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

  const rowHeight = items[0].offsetHeight;
  const viewportHeight = rouletteViewport.clientHeight;
  const highlightOffset = viewportHeight / 2 - rowHeight / 2;

  const baseIndex = remainingParticipants.findIndex(p => p.id === winnerObj.id);
  const perLoop = remainingParticipants.length;
  const targetIndex = (loops - 1) * perLoop + baseIndex;
  const finalTranslate = -(targetIndex * rowHeight - highlightOffset);

  const spinDurationMs = 10000;
  rouletteListEl.style.transition = 'none';
  rouletteListEl.style.transform = 'translateY(0px)';

  await sleep(10);

  // Reproducir sonido de ruleta
  rouletteSound.currentTime = 0;
  rouletteSound.play().catch(e => {
    console.log("No se pudo reproducir el audio de ruleta:", e);
  });
  
  rouletteListEl.style.transition = `transform ${spinDurationMs}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
  rouletteListEl.style.transform = `translateY(${finalTranslate}px)`;

  await sleep(spinDurationMs + 500);

  // Detener sonido de ruleta
  rouletteSound.pause();
  rouletteSound.currentTime = 0;

  openWinnerOverlay(winnerObj);
  await showConfettiBurst();
  setTimeout(showConfettiBurst, 550);

  remainingParticipants.splice(randomIndex, 1);
}

function startDraw() {
  winnersHistory = [];
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

    return {
      id: index + 1,
      name,
      department: dept
    };
  });

  remainingParticipants = shuffle([...allParticipants]);
  
  updateStatus();
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
  
  // Detener todos los sonidos al volver
  rouletteSound.pause();
  rouletteSound.currentTime = 0;
  winnerSound.pause();
  winnerSound.currentTime = 0;
  
  updateStatus();
  drawScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
  
  winnerOverlay.classList.remove('show');
  
  document.body.classList.remove('draw-mode');
  document.body.classList.add('setup-mode');
}

document.body.classList.add('setup-mode');

drawButton.addEventListener('click', () => {
  startDraw();
});

selectWinnerButton.addEventListener('click', () => {
  selectRandomWinner().catch(err => { 
    console.error(err); 
    isSelecting = false; 
    selectWinnerButton.disabled = false; 
    showToast("Error seleccionando ganador","💥"); 
  });
});

backButton.addEventListener('click', () => {
  resetToSetup();
});

attendedCheckbox.addEventListener('change', (e) => {
  if (currentWinner) {
    const status = e.target.checked ? 'marcado' : 'desmarcado';
  }
});

closeWinnerBtn.addEventListener('click', () => {
  closeWinnerOverlay();
});

// Cambiar a la nueva función de Excel
downloadExcelBtn.addEventListener('click', () => {
  downloadWinnersExcel();
});

updateStatus();