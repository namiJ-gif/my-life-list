'use strict';

/* ══════════════════════════════════════════════════════════
   My Life Bucket List
   ══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'bucketListItems_v2';   // 既存データをそのまま引き継ぐ
const BIRTH_KEY   = 'birthDate';
const MIGRATE_KEY = 'blMigratedV3';
const DEFAULT_BIRTH = '1993-09-01';
const ORDER_STEP  = 15;                     // 「叶える順」の一覧をこの件数ずつ見せる

/* ── 年代（バケツ）の定義 ───────────────────────────── */
const DECADES = [
  { id:'30f', label:'30代前半', range:'〜34歳',   min:  0, max: 34, img:'images/bucket-30f.png' },
  { id:'30b', label:'30代後半', range:'35〜39歳', min: 35, max: 39, img:'images/bucket-30b.png' },
  { id:'40',  label:'40代',     range:'40〜49歳', min: 40, max: 49, img:'images/bucket-40.png'  },
  { id:'50',  label:'50代',     range:'50〜59歳', min: 50, max: 59, img:'images/bucket-50.png'  },
  { id:'60',  label:'60代〜',   range:'60歳〜',   min: 60, max:999, img:'images/bucket-60.png'  },
];
const decadeById = id => DECADES.find(d => d.id === id) || null;
const decadeRank = id => { const i = DECADES.findIndex(d => d.id === id); return i < 0 ? 99 : i; };


/* ══════════ 年齢の計算（誕生日を考慮した正確な計算） ══════════ */
let birthDate = parseBirth(localStorage.getItem(BIRTH_KEY) || DEFAULT_BIRTH);

function parseBirth(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
  if (!m) return new Date(1993, 8, 1);
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
function birthStr() {
  const p = n => String(n).padStart(2, '0');
  return `${birthDate.getFullYear()}-${p(birthDate.getMonth() + 1)}-${p(birthDate.getDate())}`;
}
function ageOn(date) {
  let age = date.getFullYear() - birthDate.getFullYear();
  const m = date.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && date.getDate() < birthDate.getDate())) age--;
  return age;
}
const currentAge = () => ageOn(new Date());
const ageInYear  = year => year - birthDate.getFullYear();
const yearForAge = age  => birthDate.getFullYear() + age;

function decadeFromAge(age) {
  if (age === null || age === undefined || isNaN(age)) return null;
  const d = DECADES.find(d => age >= d.min && age <= d.max);
  return d ? d.id : null;
}
function decadeOf(item) {
  if (item.deadlineAge != null) return decadeFromAge(item.deadlineAge);
  return item.decade || null;
}


/* ══════════ データ ══════════ */
let items = [];
let currentSort   = 'age';
let openDecadeId  = null;   // 展開中のバケツ（null = 閉じている）
let editingId     = null;
let formDecade    = null;
let orderShown    = ORDER_STEP;

function loadItems() {
  try { items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { items = []; }
}
function saveItems() { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

function recalcAges() {
  items.forEach(it => {
    if (it.deadlineYear) it.deadlineAge = ageInYear(it.deadlineYear);
    else if (it.deadlineAge != null) it.deadlineYear = yearForAge(it.deadlineAge);
    it.decade = decadeOf(it);
  });
}
function migrate() {
  if (localStorage.getItem(MIGRATE_KEY)) return;
  items.forEach(it => { delete it.cat; });
  recalcAges();
  saveItems();
  localStorage.setItem(MIGRATE_KEY, '1');
}


/* ══════════ DOM ══════════ */
const $ = id => document.getElementById(id);

const bucketsEl   = $('buckets');
const unsetWrap   = $('unsetWrap');
const statDone    = $('statDone');
const statTotal   = $('statTotal');

const panel       = $('panel');
const panelBucket = $('panelBucket');
const panelTitle  = $('panelTitle');
const panelSub    = $('panelSub');
const panelList   = $('panelList');
const panelEmpty  = $('panelEmpty');
const panelDoneBlock = $('panelDoneBlock');
const panelDoneList  = $('panelDoneList');
const sortSelect  = $('sortSelect');

const orderList   = $('orderList');
const orderEmpty  = $('orderEmpty');
const moreBtn     = $('moreBtn');

const formOverlay = $('formOverlay');
const formTitle   = $('formTitle');
const fText       = $('fText');
const fDecade     = $('fDecade');
const fAge        = $('fAge');
const fYearHint   = $('fYearHint');
const fMemo       = $('fMemo');

const setOverlay  = $('setOverlay');
const fBirth      = $('fBirth');
const ageHint     = $('ageHint');


/* ══════════ 並び順 ══════════ */
/** 叶える順：目標年齢が早いものから。未設定は最後 */
function byPlan(a, b) {
  const aa = a.deadlineAge ?? 999, bb = b.deadlineAge ?? 999;
  if (aa !== bb) return aa - bb;
  const ra = decadeRank(decadeOf(a)), rb = decadeRank(decadeOf(b));
  if (ra !== rb) return ra - rb;
  return a.id - b.id;
}
function sortBy(list, how) {
  const arr = [...list];
  if (how === 'newest') arr.sort((a, b) => b.id - a.id);
  else if (how === 'oldest') arr.sort((a, b) => a.id - b.id);
  else arr.sort(byPlan);
  return arr;
}


/* ══════════ 全体を描きなおす ══════════ */
function renderAll() {
  renderBuckets();
  renderPanel();
  renderOrder();
  updateStat();
}

function updateStat() {
  statTotal.textContent = items.length;
  statDone.textContent  = items.filter(i => i.done).length;
}


/* ══════════ 年代別バケツ（横5つ） ══════════ */
function renderBuckets() {
  bucketsEl.innerHTML = '';

  DECADES.forEach(d => {
    const list = items.filter(i => decadeOf(i) === d.id);
    const done = list.filter(i => i.done).length;

    const btn = document.createElement('button');
    btn.className = 'bucket' + (openDecadeId === d.id ? ' on' : '');
    btn.dataset.decade = d.id;
    btn.setAttribute('aria-expanded', String(openDecadeId === d.id));
    btn.setAttribute('aria-label', `${d.label}（${d.range}）の夢 ${list.length}こ、うち${done}こ達成`);
    btn.innerHTML = `
      <img src="${d.img}" alt="" />
      <span class="b-name">${d.label}</span>
      <span class="b-range">${d.range}</span>
      <span class="b-count"><span class="n-done">${done}</span><span class="n-slash">/</span><span class="n-total">${list.length}</span></span>`;
    btn.addEventListener('click', () => toggleDecade(d.id));
    bucketsEl.appendChild(btn);
  });

  // 年代が決まっていない夢（データを失わないための受け皿）
  unsetWrap.innerHTML = '';
  const unset = items.filter(i => decadeOf(i) === null);
  if (unset.length) {
    const b = document.createElement('button');
    b.className = 'unset-btn';
    b.textContent = `🫧 年代が決まっていない夢（${unset.length}こ）`;
    b.addEventListener('click', () => toggleDecade('none'));
    unsetWrap.appendChild(b);
  }
}

function toggleDecade(id) {
  openDecadeId = (openDecadeId === id) ? null : id;
  renderBuckets();
  renderPanel();
  if (openDecadeId) {
    requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
}


/* ══════════ 展開パネル（選んだ年代の夢） ══════════ */
function renderPanel() {
  if (!openDecadeId) { panel.hidden = true; return; }
  panel.hidden = false;

  const d = decadeById(openDecadeId);
  const all = items.filter(i => decadeOf(i) === (openDecadeId === 'none' ? null : openDecadeId));
  const undone = sortBy(all.filter(i => !i.done), currentSort);
  const done   = sortBy(all.filter(i =>  i.done), 'age');

  if (d) { panelBucket.src = d.img; panelBucket.hidden = false; }
  else   { panelBucket.hidden = true; }
  panelTitle.textContent = d ? d.label : '年代が決まっていない夢';
  panelSub.textContent = d
    ? `${d.range}　まだの夢 ${undone.length}こ　叶えた夢 ${done.length}こ`
    : `まだの夢 ${undone.length}こ　叶えた夢 ${done.length}こ`;

  panelList.innerHTML = '';
  undone.forEach(it => panelList.appendChild(dreamCard(it)));
  panelEmpty.hidden = all.length > 0;

  panelDoneList.innerHTML = '';
  done.forEach(it => panelDoneList.appendChild(dreamCard(it)));
  panelDoneBlock.hidden = done.length === 0;
}


/* ══════════ 叶える順の一覧（未達成のみ） ══════════ */
function renderOrder() {
  const undone = items.filter(i => !i.done).sort(byPlan);
  const shown  = undone.slice(0, orderShown);

  orderList.innerHTML = '';
  shown.forEach(it => orderList.appendChild(dreamCard(it, true)));
  orderEmpty.hidden = undone.length > 0;

  const rest = undone.length - shown.length;
  moreBtn.hidden = rest <= 0;
  moreBtn.textContent = `もっと見る（あと${rest}こ）`;
}


/* ══════════ 夢カード ══════════ */
function dreamCard(item, withBucket) {
  const dec = decadeOf(item);
  const li = document.createElement('li');
  li.className = 'dream' + (item.done ? ' done' : '');
  if (dec) li.dataset.decade = dec;

  const meta = [];
  if (withBucket && dec) meta.push(`<span>🪣 ${decadeById(dec).label}</span>`);
  if (item.deadlineAge != null) {
    const overdue = item.deadlineYear && item.deadlineYear < new Date().getFullYear() && !item.done;
    meta.push(`<span class="${overdue ? 'overdue' : ''}">🗓 ${item.deadlineAge}歳までに（${item.deadlineYear}年）</span>`);
  } else if (!withBucket && dec) {
    meta.push(`<span>🪣 ${decadeById(dec).label}</span>`);
  }
  if (item.memo) meta.push(`<span>💬 ${escHtml(item.memo).slice(0, 24)}</span>`);

  li.innerHTML = `
    <button class="check" aria-label="${item.done ? '未達成にもどす' : '達成にする'}">${item.done ? '✓' : ''}</button>
    <div class="dream-body">
      <span class="dream-title">${escHtml(item.text)}</span>
      ${meta.length ? `<div class="dream-meta">${meta.join('')}</div>` : ''}
    </div>
    <div class="dream-acts">
      <button class="icon-btn edit" aria-label="編集">✏️</button>
      <button class="icon-btn del"  aria-label="削除">🗑️</button>
    </div>`;

  li.querySelector('.check').addEventListener('click', () => toggleDone(item.id));
  li.querySelector('.edit').addEventListener('click',  () => openForm(item.id));
  li.querySelector('.del').addEventListener('click',   () => removeItem(item.id, li));
  return li;
}

function toggleDone(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.done = !item.done;
  saveItems();
  if (item.done) launchConfetti();
  renderAll();
}

function removeItem(id, li) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!confirm(`「${item.text}」をバケツから出しますか？`)) return;
  li.classList.add('removing');
  li.addEventListener('animationend', () => {
    items = items.filter(i => i.id !== id);
    saveItems();
    renderAll();
  }, { once: true });
}


/* ══════════ 追加・編集シート ══════════ */
function openSheet(el)  { el.hidden = false; document.body.classList.add('sheet-open'); }
function closeSheet(el) { el.hidden = true;  document.body.classList.remove('sheet-open'); }

function buildDecadePicker() {
  fDecade.innerHTML = '';
  DECADES.forEach(d => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dchip';
    b.dataset.decade = d.id;
    b.textContent = d.label;
    b.addEventListener('click', () => {
      formDecade = d.id;
      const a = parseInt(fAge.value, 10);
      if (!isNaN(a) && decadeFromAge(a) !== d.id) fAge.value = '';
      syncPicker();
    });
    fDecade.appendChild(b);
  });
}
function syncPicker() {
  fDecade.querySelectorAll('.dchip').forEach(c => c.classList.toggle('on', c.dataset.decade === formDecade));
  const a = parseInt(fAge.value, 10);
  fYearHint.textContent = (!isNaN(a) && a > 0) ? `＝ ${yearForAge(a)}年` : '';
}

function openForm(id) {
  editingId = id ?? null;
  const item = id != null ? items.find(i => i.id === id) : null;

  formTitle.textContent = item ? '夢を編集する' : '新しい夢';
  $('formSave').textContent = item ? '保存する' : 'バケツに入れる';
  fText.value = item ? item.text : '';
  fMemo.value = item ? (item.memo || '') : '';
  fAge.value  = item && item.deadlineAge != null ? item.deadlineAge : '';
  formDecade  = item ? decadeOf(item) : (openDecadeId && openDecadeId !== 'none' ? openDecadeId : null);

  syncPicker();
  openSheet(formOverlay);
  setTimeout(() => fText.focus(), 60);
}
function closeForm() { closeSheet(formOverlay); editingId = null; }

function saveForm() {
  const text = fText.value.trim();
  if (!text) { fText.focus(); return; }

  const ageRaw = parseInt(fAge.value, 10);
  const age = (!isNaN(ageRaw) && ageRaw > 0 && ageRaw <= 120) ? ageRaw : null;
  const dec = age != null ? decadeFromAge(age) : formDecade;

  if (editingId != null) {
    const item = items.find(i => i.id === editingId);
    if (!item) return;
    item.text = text;
    item.memo = fMemo.value.trim();
    item.deadlineAge  = age;
    item.deadlineYear = age != null ? yearForAge(age) : null;
    item.decade = dec;
  } else {
    items.unshift({
      id: Date.now(), text, done: false,
      memo: fMemo.value.trim(),
      deadlineAge: age,
      deadlineYear: age != null ? yearForAge(age) : null,
      decade: dec,
    });
    if (dec) openDecadeId = dec;
  }
  saveItems();
  closeForm();
  renderAll();
}


/* ══════════ 設定 ══════════ */
function openSettings() {
  fBirth.value = birthStr();
  ageHint.textContent = `いまは ${currentAge()}歳です。`;
  openSheet(setOverlay);
}
function saveSettings() {
  if (fBirth.value) {
    birthDate = parseBirth(fBirth.value);
    localStorage.setItem(BIRTH_KEY, birthStr());
    recalcAges();
    saveItems();
  }
  closeSheet(setOverlay);
  renderAll();
}


/* ══════════ イベント ══════════ */
$('addBtn').addEventListener('click', () => openForm());
$('panelClose').addEventListener('click', () => { openDecadeId = null; renderBuckets(); renderPanel(); });
sortSelect.addEventListener('change', () => { currentSort = sortSelect.value; renderPanel(); });
moreBtn.addEventListener('click', () => { orderShown += ORDER_STEP; renderOrder(); });

$('formClose').addEventListener('click', closeForm);
$('formSave').addEventListener('click', saveForm);
formOverlay.addEventListener('click', e => { if (e.target === formOverlay) closeForm(); });
fText.addEventListener('keydown', e => { if (e.key === 'Enter') saveForm(); });
fAge.addEventListener('input', () => {
  const a = parseInt(fAge.value, 10);
  if (!isNaN(a)) { const d = decadeFromAge(a); if (d) formDecade = d; }
  syncPicker();
});

$('gearBtn').addEventListener('click', openSettings);
$('setClose').addEventListener('click', () => closeSheet(setOverlay));
$('setSave').addEventListener('click', saveSettings);
setOverlay.addEventListener('click', e => { if (e.target === setOverlay) closeSheet(setOverlay); });

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeForm();
  closeSheet(setOverlay);
});


/* ══════════ ヘルパー ══════════ */
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


/* ══════════ 紙吹雪 ══════════ */
const canvas = $('confetti');
const ctx = canvas.getContext('2d');
let particles = [];
function launchConfetti() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const colors = ['#f9a8d4','#fcd34d','#6ee7b7','#a8d8f7','#cfc2f3','#fb9fcd'];
  const was = particles.length;
  for (let i = 0; i < 90; i++) particles.push({
    x: Math.random()*canvas.width, y: -10,
    w: Math.random()*10+5, h: Math.random()*5+3,
    color: colors[Math.floor(Math.random()*colors.length)],
    vx: (Math.random()-0.5)*4, vy: Math.random()*4+2,
    rot: Math.random()*360, spin: (Math.random()-0.5)*8, alpha: 1,
  });
  if (was === 0) requestAnimationFrame(animateConfetti);
}
function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.alpha > 0.05);
  particles.forEach(p => {
    p.x+=p.vx; p.y+=p.vy; p.rot+=p.spin; p.vy+=0.12;
    if (p.y > canvas.height*0.7) p.alpha -= 0.02;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
    ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color;
    ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
  });
  if (particles.length > 0) requestAnimationFrame(animateConfetti);
  else ctx.clearRect(0, 0, canvas.width, canvas.height);
}


/* ══════════ 起動 ══════════ */
loadItems();

// サンプルの夢はコードに持たせない（公開リポジトリに個人の内容を残さないため）
// 端末に保存ずみの夢はそのまま読み込まれる

migrate();
buildDecadePicker();
sortSelect.value = currentSort;
renderAll();

// ローカルでの開発中はオフライン用キャッシュを使わない（古い画面が出てしまうため）
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && !isLocal) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
