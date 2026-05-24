
const STORAGE_KEY = 'kingSpinConfigV2';
const AUDIT_KEY = 'kingSpinAuditV1';
const DEFAULT_CONFIG = {
  singleKing: [
    { label: 'No Prize', weight: 45 },
    { label: 'Win Your Bet', weight: 45 },
    { label: '2x Your Bet', weight: 8 },
    { label: '3x Your Bet', weight: 2 }
  ],
  doubleKing: [
    { label: '$25 Promo Chips', weight: 38 },
    { label: '$50 Points', weight: 14 },
    { label: '$50 Promo Chips', weight: 12 },
    { label: '$75 Points', weight: 10 },
    { label: '$100 Points', weight: 8 },
    { label: '$100 Free Play', weight: 6 },
    { label: 'Hotel Night', weight: 8 },
    { label: '$150 Cash', weight: 3 },
    { label: '$300 Cash', weight: 1 }
  ]
};

const WHEEL_LABELS = {
  singleKing: 'Blackjack with 1 King',
  doubleKing: 'Win with 2 Kings'
};

const WHEEL_CARD_IMAGES = {
  singleKing: 'cards-king-ace.png',
  doubleKing: 'cards-two-kings.png'
};

const wheelImageCache = {};

function preloadWheelImages(onLoad) {
  Object.entries(WHEEL_CARD_IMAGES).forEach(([type, src]) => {
    const image = new Image();
    image.onload = () => {
      wheelImageCache[type] = image;
      if (typeof onLoad === 'function') onLoad();
    };
    image.src = src;
  });
}

function drawWheelCardImage(ctx, cx, cy, radius, wheelType) {
  const image = wheelImageCache[wheelType];
  if (!image) return;

  // Cards are intentionally drawn BEFORE the wheel face so they sit behind the wheel,
  // with only the top of the cards showing like the promotion artwork.
  const maxWidth = radius * 1.16;
  const scale = Math.min(maxWidth / image.width, (radius * 0.68) / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = cx - width / 2;
  const y = cy - radius - 2;

  ctx.save();
  ctx.globalAlpha = 0.98;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.50)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 12;
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
}

function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.singleKing && saved.doubleKing) return saved;
  } catch (e) {}
  return structuredClone(DEFAULT_CONFIG);
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function getAudit() {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveAudit(entries) {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
}

function addAuditEntry(entry) {
  const entries = getAudit();
  entries.unshift(entry);
  saveAudit(entries);
}

function weightedPick(items) {
  const valid = items.filter(item => item.label && Number(item.weight) > 0);
  const total = valid.reduce((sum, item) => sum + Number(item.weight), 0);
  let roll = Math.random() * total;
  for (const item of valid) {
    roll -= Number(item.weight);
    if (roll <= 0) return item;
  }
  return valid[valid.length - 1];
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mixColor(hex, targetHex, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(targetHex);
  const r = Math.round(a.r + (b.r - a.r) * amount);
  const g = Math.round(a.g + (b.g - a.g) * amount);
  const bl = Math.round(a.b + (b.b - a.b) * amount);
  return `rgb(${r}, ${g}, ${bl})`;
}

function buildSliceMap(items) {
  const valid = items.filter(item => item.label && Number(item.weight) > 0);
  const totalWeight = valid.reduce((sum, item) => sum + Number(item.weight), 0);
  let cursor = -Math.PI / 2;
  return valid.map(item => {
    const slice = (Number(item.weight) / totalWeight) * Math.PI * 2;
    const start = cursor;
    const end = cursor + slice;
    cursor = end;
    return { ...item, start, end, mid: start + slice / 2 };
  });
}

function normalizeAngle(angle) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function drawRimLights(ctx, cx, cy, radius, rotation) {
  const bulbs = 28;
  for (let i = 0; i < bulbs; i++) {
    const angle = (Math.PI * 2 * i / bulbs) + rotation * 0.12;
    const x = cx + Math.cos(angle) * (radius + 8);
    const y = cy + Math.sin(angle) * (radius + 8);
    const lit = i % 2 === 0;
    const bulb = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, lit ? 14 : 10);
    bulb.addColorStop(0, lit ? 'rgba(255, 246, 223, 0.98)' : 'rgba(255, 233, 184, 0.74)');
    bulb.addColorStop(0.5, lit ? 'rgba(243, 194, 108, 0.92)' : 'rgba(201, 154, 61, 0.70)');
    bulb.addColorStop(1, 'rgba(199, 154, 61, 0)');
    ctx.fillStyle = bulb;
    ctx.beginPath();
    ctx.arc(x, y, lit ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, lit ? 4.8 : 4, 0, Math.PI * 2);
    ctx.fillStyle = lit ? '#fff0c8' : '#c79a3d';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#6f4812';
    ctx.stroke();
  }
}

function wrapTextOnWheel(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  const offset = ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => {
    ctx.strokeText(l, x, y + (i * lineHeight) - offset);
    ctx.fillText(l, x, y + (i * lineHeight) - offset);
  });
}

function drawWheel(canvas, items, rotation = 0, wheelType = null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 42;
  ctx.clearRect(0, 0, width, height);

  const valid = items.filter(item => item.label && Number(item.weight) > 0);
  if (!valid.length) {
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('No prizes set', cx, cy);
    return;
  }

  const totalWeight = valid.reduce((sum, item) => sum + Number(item.weight), 0);

  // softer premium palette: burgundy, plum, espresso, copper
  const palette = ['#5a1519', '#3b1926', '#4a1e16', '#611f38', '#2c1a17', '#7a4b1e'];
  let start = -Math.PI / 2 + rotation;

  drawWheelCardImage(ctx, cx, cy, radius, wheelType);

  const wheelShadow = ctx.createRadialGradient(cx, cy + radius * 0.18, radius * 0.2, cx, cy, radius * 1.18);
  wheelShadow.addColorStop(0, 'rgba(0,0,0,0.05)');
  wheelShadow.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = wheelShadow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 28, 0, Math.PI * 2);
  ctx.fill();

  valid.forEach((item, index) => {
    const slice = (Number(item.weight) / totalWeight) * Math.PI * 2;
    const end = start + slice;
    const base = palette[index % palette.length];

    const seg = ctx.createRadialGradient(cx - radius * 0.28, cy - radius * 0.38, radius * 0.08, cx, cy, radius);
    seg.addColorStop(0, mixColor(base, '#ffffff', 0.20));
    seg.addColorStop(0.44, mixColor(base, '#c79a3d', 0.08));
    seg.addColorStop(1, mixColor(base, '#000000', 0.18));

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = seg;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.clip();
    const gloss = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
    gloss.addColorStop(0, 'rgba(255,255,255,0.18)');
    gloss.addColorStop(0.28, 'rgba(255,255,255,0.05)');
    gloss.addColorStop(0.55, 'rgba(255,255,255,0)');
    gloss.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius);
    ctx.strokeStyle = 'rgba(255, 232, 185, 0.88)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff7e6';
    ctx.strokeStyle = 'rgba(63, 31, 6, 0.78)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.font = `bold ${Math.max(14, Math.min(22, 220 / valid.length))}px Georgia`;
    wrapTextOnWheel(ctx, item.label, radius - 62, 0, 170, 22);
    ctx.restore();

    start = end;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 22, 0, Math.PI * 2);
  ctx.lineWidth = 28;
  ctx.strokeStyle = '#4b2f0b';
  ctx.stroke();

  const outerGold = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  outerGold.addColorStop(0, '#6d4512');
  outerGold.addColorStop(0.18, '#b7862b');
  outerGold.addColorStop(0.42, '#fff0c8');
  outerGold.addColorStop(0.62, '#c79a3d');
  outerGold.addColorStop(1, '#74460f');

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 22, 0, Math.PI * 2);
  ctx.lineWidth = 18;
  ctx.strokeStyle = outerGold;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 22, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,247,214,0.95)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ebcf8f';
  ctx.stroke();

  const faceGloss = ctx.createRadialGradient(cx, cy - radius * 0.72, 10, cx, cy, radius * 1.05);
  faceGloss.addColorStop(0, 'rgba(255,255,255,0.24)');
  faceGloss.addColorStop(0.28, 'rgba(255,255,255,0.08)');
  faceGloss.addColorStop(0.65, 'rgba(255,255,255,0.01)');
  faceGloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = faceGloss;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  drawRimLights(ctx, cx, cy, radius + 22, rotation);

  const hub = ctx.createRadialGradient(cx - 8, cy - 10, 2, cx, cy, 42);
  hub.addColorStop(0, '#fff7d0');
  hub.addColorStop(0.38, '#f0cf74');
  hub.addColorStop(0.72, '#c4901b');
  hub.addColorStop(1, '#764800');

  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#6a4300';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#fff0bc';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#b98718';
  ctx.stroke();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function createPrizeRow(item = { label: '', weight: 1 }) {
  const row = document.createElement('div');
  row.className = 'prize-row';
  row.innerHTML = `
    <div>
      <label>Prize name</label>
      <input type="text" class="prize-label" maxlength="80" value="${escapeHtml(item.label)}" />
    </div>
    <div>
      <label>Weight</label>
      <input type="number" class="prize-weight" min="0" step="0.01" value="${Number(item.weight)}" />
    </div>
    <button class="remove-btn" type="button" aria-label="Remove prize">×</button>
  `;
  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  return row;
}

function initSpinPage() {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;

  const patronName = document.getElementById('patronName');
  const wheelType = document.getElementById('wheelType');
  const spinButton = document.getElementById('spinButton');
  const resultText = document.getElementById('resultText');
  const selectedWheelLabel = document.getElementById('selectedWheelLabel');
  const prizeCount = document.getElementById('prizeCount');
  const winnerBanner = document.getElementById('winnerBanner');

  let config = getConfig();
  let currentRotation = 0;
  let mode = 'idle'; // idle | spinning | stopping
  let freeSpinRAF = null;
  let freeSpinLastTs = null;
  let spinVelocity = Math.PI * 1.9;

  function refreshWheel() {
    const type = wheelType.value;
    selectedWheelLabel.textContent = WHEEL_LABELS[type];
    prizeCount.textContent = config[type].filter(item => item.label && Number(item.weight) > 0).length;
    drawWheel(canvas, config[type], currentRotation, type);
  }

  function setBanner(text, pulse = false) {
    winnerBanner.textContent = text;
    winnerBanner.classList.remove('show');
    if (pulse) {
      void winnerBanner.offsetWidth;
      winnerBanner.classList.add('show');
    }
  }

  function stopFreeSpinLoop() {
    if (freeSpinRAF) cancelAnimationFrame(freeSpinRAF);
    freeSpinRAF = null;
    freeSpinLastTs = null;
  }

  function startFreeSpinLoop() {
    stopFreeSpinLoop();
    mode = 'spinning';
    spinButton.textContent = 'Stop Wheel';
    resultText.textContent = 'Wheel is spinning...';
    setBanner('Click stop to land on a prize');

    const tick = (ts) => {
      if (mode !== 'spinning') return;
      if (freeSpinLastTs == null) freeSpinLastTs = ts;
      const dt = Math.min((ts - freeSpinLastTs) / 1000, 0.05);
      freeSpinLastTs = ts;
      currentRotation += spinVelocity * dt;
      drawWheel(canvas, getConfig()[wheelType.value], currentRotation, wheelType.value);
      freeSpinRAF = requestAnimationFrame(tick);
    };

    freeSpinRAF = requestAnimationFrame(tick);
  }

  function stopOnWinner() {
    const patron = patronName.value.trim();
    if (!patron) {
      alert('Please enter the patron name before starting the wheel.');
      patronName.focus();
      mode = 'idle';
      spinButton.textContent = 'Start Wheel';
      stopFreeSpinLoop();
      refreshWheel();
      return;
    }

    config = getConfig();
    const type = wheelType.value;
    const items = config[type].filter(item => item.label && Number(item.weight) > 0);
    if (!items.length) {
      alert('There are no valid prizes configured for this wheel.');
      mode = 'idle';
      spinButton.textContent = 'Start Wheel';
      stopFreeSpinLoop();
      return;
    }

    mode = 'stopping';
    stopFreeSpinLoop();
    spinButton.disabled = true;
    spinButton.textContent = 'Stopping...';
    resultText.textContent = 'Stopping wheel...';
    setBanner('Good luck…');

    const winner = weightedPick(items);
    const sliceMap = buildSliceMap(items);
    const selectedSlice = sliceMap.find(item => item.label === winner.label && Number(item.weight) === Number(winner.weight)) || sliceMap[0];

    const pointerAngle = 3 * Math.PI / 2;
    const targetRotation = pointerAngle - selectedSlice.mid;
    const extraTurns = (Math.PI * 2) * (4 + Math.floor(Math.random() * 2));
    const finalRotation = currentRotation + extraTurns + normalizeAngle(targetRotation - currentRotation);
    const duration = 3400;
    const start = performance.now();
    const initialRotation = currentRotation;

    function animate(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      currentRotation = initialRotation + (finalRotation - initialRotation) * eased;
      drawWheel(canvas, items, currentRotation, type);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        currentRotation = finalRotation;
        drawWheel(canvas, items, currentRotation, type);
        resultText.textContent = winner.label;
        setBanner(winner.label, true);

        const nowDate = new Date();
        addAuditEntry({
          timestamp: nowDate.toISOString(),
          patron,
          wheel: WHEEL_LABELS[type],
          prize: winner.label
        });

        mode = 'idle';
        spinButton.disabled = false;
        spinButton.textContent = 'Start Wheel';
      }
    }

    requestAnimationFrame(animate);
  }

  wheelType.addEventListener('change', () => {
    if (mode === 'spinning') {
      stopFreeSpinLoop();
      mode = 'idle';
      spinButton.textContent = 'Start Wheel';
    }
    resultText.textContent = 'Ready to spin';
    setBanner('Ready to spin');
    refreshWheel();
  });

  spinButton.addEventListener('click', () => {
    if (mode === 'stopping') return;

    if (mode === 'idle') {
      const patron = patronName.value.trim();
      if (!patron) {
        alert('Please enter the patron name before starting the wheel.');
        patronName.focus();
        return;
      }
      startFreeSpinLoop();
    } else if (mode === 'spinning') {
      stopOnWinner();
    }
  });

  preloadWheelImages(refreshWheel);
  setBanner('Ready to spin');
  refreshWheel();
}

function initAdminPage() {
  const singleWrap = document.getElementById('singleKingList');
  if (!singleWrap) return;
  const doubleWrap = document.getElementById('doubleKingList');
  const saveBtn = document.getElementById('saveConfig');
  const resetBtn = document.getElementById('resetDefaults');
  const saveMessage = document.getElementById('saveMessage');

  function render(config) {
    singleWrap.innerHTML = '';
    doubleWrap.innerHTML = '';
    config.singleKing.forEach(item => singleWrap.appendChild(createPrizeRow(item)));
    config.doubleKing.forEach(item => doubleWrap.appendChild(createPrizeRow(item)));
  }

  function collect(container) {
    return Array.from(container.querySelectorAll('.prize-row')).map(row => ({
      label: row.querySelector('.prize-label').value.trim(),
      weight: Number(row.querySelector('.prize-weight').value)
    })).filter(item => item.label && item.weight > 0);
  }

  document.getElementById('addSinglePrize').addEventListener('click', () => {
    singleWrap.appendChild(createPrizeRow());
  });
  document.getElementById('addDoublePrize').addEventListener('click', () => {
    doubleWrap.appendChild(createPrizeRow());
  });

  saveBtn.addEventListener('click', () => {
    const config = {
      singleKing: collect(singleWrap),
      doubleKing: collect(doubleWrap)
    };
    if (!config.singleKing.length || !config.doubleKing.length) {
      saveMessage.textContent = 'Each wheel needs at least one valid prize with a weight above 0.';
      return;
    }
    saveConfig(config);
    saveMessage.textContent = 'Prize setup saved successfully.';
  });

  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset both wheels back to the original default prizes?')) return;
    saveConfig(structuredClone(DEFAULT_CONFIG));
    render(getConfig());
    saveMessage.textContent = 'Defaults restored.';
  });

  render(getConfig());
}

function formatDate(timestamp) {
  const dt = new Date(timestamp);
  return dt.toLocaleDateString();
}

function formatTime(timestamp) {
  const dt = new Date(timestamp);
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function initAuditPage() {
  const tableBody = document.getElementById('auditTableBody');
  if (!tableBody) return;
  const empty = document.getElementById('auditEmpty');

  function render() {
    const rows = getAudit();
    tableBody.innerHTML = '';
    if (!rows.length) {
      empty.textContent = 'No spins have been logged yet.';
      return;
    }
    empty.textContent = '';
    rows.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(entry.timestamp)}</td>
        <td>${formatTime(entry.timestamp)}</td>
        <td>${escapeHtml(entry.wheel)}</td>
        <td>${escapeHtml(entry.patron)}</td>
        <td>${escapeHtml(entry.prize)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  document.getElementById('clearAudit').addEventListener('click', () => {
    if (!confirm('Clear the full audit log?')) return;
    saveAudit([]);
    render();
  });

  document.getElementById('exportAudit').addEventListener('click', () => {
    const rows = getAudit();
    if (!rows.length) {
      alert('There are no audit records to export.');
      return;
    }
    const csv = [
      ['Date', 'Time', 'Wheel', 'Patron', 'Prize'],
      ...rows.map(entry => [
        formatDate(entry.timestamp),
        formatTime(entry.timestamp),
        entry.wheel,
        entry.patron,
        entry.prize
      ])
    ].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'king-spin-audit.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  render();
}

const page = document.body.dataset.page;
if (page === 'spin') initSpinPage();
if (page === 'admin') initAdminPage();
if (page === 'audit') initAuditPage();
