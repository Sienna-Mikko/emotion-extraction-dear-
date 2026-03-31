const STORAGE_KEY = 'sienna_mikkohub_data_v1';
const WEIGHT_KEY = 'sienna_weight_data_v1';
const QUOTE_SESSION_KEY = 'sienna_home_quote_v1';
const MAX_BOOK_CHARS = 100000;

const quotePool = [
  '你留在这里的每一个字，都在替今天轻轻发光。',
  '有些情绪不必立刻解决，先被好好看见就很好。',
  '慢一点也没关系，心是需要被温柔等待的。',
  '如果今天很重，那就先把一小块放在我这里。',
  '你写下的不是脆弱，是正在长出力量的证据。',
  '你一直都在前进，只是步伐刚好和心跳同步。',
  '每一次诚实记录，都会让明天更理解今天的你。',
  '愿你在翻开这一页时，先对自己说一声辛苦了。',
  '所有未说出口的话，都可以在这里慢慢落地。',
  '你不是在重复日子，你是在一笔一划地生活。',
  '今天也许不完美，但你已经足够认真地拥抱它。',
  '请相信，温柔不是退让，而是有力量的选择。',
  '这本小小的卷册，会替你记得那些细碎的勇敢。',
  '别急着给情绪命名，先让它在纸上呼吸一会儿。',
  '每一段低潮，都会在日后变成你理解他人的光。',
];

const state = {
  books: [],
  selectedBookId: null,
  searchQuery: '',
  jumpRequest: null,
};

const tabBtns = [...document.querySelectorAll('.tab-btn')];
const tabPanels = [...document.querySelectorAll('.tab-panel')];
const homeQuoteEl = document.getElementById('homeQuote');

const bookGridEl = document.getElementById('bookGrid');
const bookDetailEl = document.getElementById('bookDetail');
const createBookBtn = document.getElementById('createBookBtn');
const bookTitleInput = document.getElementById('bookTitleInput');
const readOnlyToggle = document.getElementById('readOnlyToggle');
const coverInput = document.getElementById('coverInput');
const charCountEl = document.getElementById('charCount');
const coverPreviewEl = document.getElementById('coverPreview');
const bookCreatedAtEl = document.getElementById('bookCreatedAt');
const bookContentEl = document.getElementById('bookContent');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResultsEl = document.getElementById('searchResults');

const weightInput = document.getElementById('weightInput');
const saveWeightBtn = document.getElementById('saveWeightBtn');
const weightStatus = document.getElementById('weightStatus');
const chartCanvas = document.getElementById('weightChart');

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

function getSessionQuote() {
  const cached = sessionStorage.getItem(QUOTE_SESSION_KEY);
  if (cached) return cached;
  const quote = quotePool[Math.floor(Math.random() * quotePool.length)];
  sessionStorage.setItem(QUOTE_SESSION_KEY, quote);
  return quote;
}

function switchTab(nextTab) {
  tabBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === nextTab));
  tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === nextTab));
}

function persistBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.books));
}

function loadBooks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    state.books = Array.isArray(raw) ? raw : [];
  } catch {
    state.books = [];
  }
  if (state.books.length) {
    state.selectedBookId = state.books[0].id;
  }
}

function makeBook() {
  const now = new Date();
  return {
    id: uid(),
    title: `第 ${state.books.length + 1} 卷`,
    coverDataUrl: '',
    createdAt: now.toISOString(),
    content: '',
    readOnly: false,
    isFullPrompted: false,
  };
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未知日期';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getSelectedBook() {
  return state.books.find((book) => book.id === state.selectedBookId) || null;
}

function renderBooks() {
  bookGridEl.innerHTML = '';
  state.books.forEach((book) => {
    const card = document.createElement('article');
    card.className = `book-card ${book.id === state.selectedBookId ? 'active' : ''}`;
    card.innerHTML = `
      <div class="book-cover" style="background-image:url('${book.coverDataUrl || ''}')"></div>
      <strong>${book.title}</strong>
      <div class="book-meta">创建于 ${formatDate(book.createdAt)}</div>
      <div class="book-meta">${book.content.length.toLocaleString()} 字${book.content.length >= MAX_BOOK_CHARS ? ' · 已很厚' : ''}</div>
    `;
    card.addEventListener('click', () => {
      state.selectedBookId = book.id;
      renderBooks();
      renderBookDetail();
    });
    bookGridEl.appendChild(card);
  });

  if (!state.books.length) {
    const tip = document.createElement('p');
    tip.className = 'muted';
    tip.textContent = '还没有卷册，点击“新建一卷”开始吧。';
    bookGridEl.appendChild(tip);
  }
}

function maybeHandleLimit(book) {
  if (book.content.length >= MAX_BOOK_CHARS && !book.isFullPrompted) {
    book.isFullPrompted = true;
    const openNew = window.confirm('sienna💙这本已经很厚了，要不要开新卷?');
    if (openNew) {
      const newBook = makeBook();
      state.books.unshift(newBook);
      state.selectedBookId = newBook.id;
    }
  }
}

function renderBookDetail() {
  const book = getSelectedBook();
  if (!book) {
    bookDetailEl.classList.add('hidden');
    return;
  }

  bookDetailEl.classList.remove('hidden');
  bookTitleInput.value = book.title;
  readOnlyToggle.checked = Boolean(book.readOnly);
  coverPreviewEl.style.backgroundImage = book.coverDataUrl ? `url('${book.coverDataUrl}')` : 'none';
  bookCreatedAtEl.textContent = `创建日期：${formatDate(book.createdAt)}`;
  bookContentEl.value = book.content;
  bookContentEl.readOnly = Boolean(book.readOnly);
  charCountEl.textContent = `${book.content.length} / ${MAX_BOOK_CHARS}`;

  if (state.jumpRequest && state.jumpRequest.bookId === book.id) {
    const { charIndex, query } = state.jumpRequest;
    const start = Math.max(0, charIndex);
    const end = Math.min(book.content.length, start + query.length);
    switchTab('mikkohub');
    bookContentEl.focus();
    bookContentEl.setSelectionRange(start, end);
    const approximateLineHeight = 28;
    const before = book.content.slice(0, start);
    const lineCount = (before.match(/\n/g) || []).length;
    bookContentEl.scrollTop = Math.max(0, lineCount * approximateLineHeight - 120);
    bookContentEl.classList.add('highlighted-jump');
    setTimeout(() => bookContentEl.classList.remove('highlighted-jump'), 2200);
    state.jumpRequest = null;
  }
}

function createBook() {
  const book = makeBook();
  state.books.unshift(book);
  state.selectedBookId = book.id;
  persistBooks();
  renderBooks();
  renderBookDetail();
}

function runSearch() {
  const query = searchInput.value.trim();
  searchResultsEl.innerHTML = '';
  if (!query) return;

  const results = [];
  state.books.forEach((book) => {
    const content = book.content || '';
    let fromIndex = 0;
    while (fromIndex < content.length) {
      const idx = content.indexOf(query, fromIndex);
      if (idx === -1) break;
      const start = Math.max(0, idx - 14);
      const end = Math.min(content.length, idx + query.length + 14);
      const snippet = `${start > 0 ? '...' : ''}${content.slice(start, end)}${end < content.length ? '...' : ''}`;
      results.push({ bookId: book.id, bookTitle: book.title, snippet, charIndex: idx, query });
      fromIndex = idx + query.length;
      if (results.length >= 120) break;
    }
  });

  if (!results.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = '没有找到相关片段。';
    searchResultsEl.appendChild(li);
    return;
  }

  results.forEach((result) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = `[${result.bookTitle}] ${result.snippet}`;
    btn.addEventListener('click', () => {
      state.selectedBookId = result.bookId;
      state.jumpRequest = result;
      renderBooks();
      renderBookDetail();
    });
    li.appendChild(btn);
    searchResultsEl.appendChild(li);
  });
}

function bindBookEvents() {
  createBookBtn.addEventListener('click', createBook);

  bookTitleInput.addEventListener('input', () => {
    const book = getSelectedBook();
    if (!book) return;
    book.title = bookTitleInput.value.trim() || '未命名卷册';
    persistBooks();
    renderBooks();
  });

  readOnlyToggle.addEventListener('change', () => {
    const book = getSelectedBook();
    if (!book) return;
    book.readOnly = readOnlyToggle.checked;
    persistBooks();
    renderBookDetail();
  });

  coverInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    const book = getSelectedBook();
    if (!file || !book) return;
    const reader = new FileReader();
    reader.onload = () => {
      book.coverDataUrl = String(reader.result || '');
      persistBooks();
      renderBooks();
      renderBookDetail();
    };
    reader.readAsDataURL(file);
  });

  bookContentEl.addEventListener('input', () => {
    const book = getSelectedBook();
    if (!book) return;
    book.content = bookContentEl.value;
    charCountEl.textContent = `${book.content.length} / ${MAX_BOOK_CHARS}`;
    maybeHandleLimit(book);
    persistBooks();
    renderBooks();
    renderBookDetail();
  });

  searchBtn.addEventListener('click', runSearch);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });
}

function getWeights() {
  try {
    const raw = JSON.parse(localStorage.getItem(WEIGHT_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveWeights(payload) {
  localStorage.setItem(WEIGHT_KEY, JSON.stringify(payload));
}

function drawWeightChart() {
  const ctx = chartCanvas.getContext('2d');
  const weights = getWeights();
  const entries = Object.entries(weights)
    .map(([date, value]) => ({ date, value: Number(value) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);

  if (!entries.length) {
    ctx.fillStyle = '#64748b';
    ctx.font = '16px sans-serif';
    ctx.fillText('还没有体重记录。', 24, 40);
    return;
  }

  const pad = { left: 52, right: 24, top: 24, bottom: 42 };
  const w = chartCanvas.width - pad.left - pad.right;
  const h = chartCanvas.height - pad.top - pad.bottom;

  const values = entries.map((x) => x.value);
  const min = Math.min(...values) - 0.6;
  const max = Math.max(...values) + 0.6;

  const startDate = new Date(entries[0].date);
  const endDate = new Date(entries[entries.length - 1].date);
  const dayCount = Math.max(1, Math.round((endDate - startDate) / 86400000));

  const xForDate = (dateStr) => {
    const day = Math.round((new Date(dateStr) - startDate) / 86400000);
    return pad.left + (day / dayCount) * w;
  };
  const yForValue = (val) => {
    const ratio = (val - min) / Math.max(0.00001, max - min);
    return pad.top + h - ratio * h;
  };

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + h);
  ctx.lineTo(pad.left + w, pad.top + h);
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + h);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '12px sans-serif';
  ctx.fillText(entries[0].date, pad.left, chartCanvas.height - 14);
  ctx.fillText(entries[entries.length - 1].date, chartCanvas.width - 96, chartCanvas.height - 14);

  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 2;
  ctx.beginPath();

  let previous = null;
  entries.forEach((entry, idx) => {
    const x = xForDate(entry.date);
    const y = yForValue(entry.value);
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      const dayGap = Math.round((new Date(entry.date) - new Date(previous.date)) / 86400000);
      if (dayGap > 1) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    previous = entry;
  });
  ctx.stroke();

  entries.forEach((entry) => {
    const x = xForDate(entry.date);
    const y = yForValue(entry.value);
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function bindCareEvents() {
  const weights = getWeights();
  if (weights[todayStr()]) {
    weightInput.value = weights[todayStr()];
  }

  saveWeightBtn.addEventListener('click', () => {
    const val = Number(weightInput.value);
    if (!Number.isFinite(val) || val <= 0) {
      weightStatus.textContent = '请输入有效体重数值。';
      return;
    }
    const next = getWeights();
    next[todayStr()] = Number(val.toFixed(1));
    saveWeights(next);
    weightStatus.textContent = `已保存 ${todayStr()} 的体重：${Number(val.toFixed(1))} kg`;
    drawWeightChart();
  });

  drawWeightChart();
}

function init() {
  homeQuoteEl.textContent = getSessionQuote();
  tabBtns.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  loadBooks();
  renderBooks();
  renderBookDetail();
  bindBookEvents();
  bindCareEvents();
}

init();
