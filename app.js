'use strict';

/* ══════════════════════════════════════════════════════════
   My Life Bucket List
   ══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'bucketListItems_v2';   // 既存データをそのまま引き継ぐ
const BIRTH_KEY   = 'birthDate';
const MIGRATE_KEY = 'blMigratedV3';
const DEFAULT_BIRTH = '1993-09-01';

/* ── 年代（バケツ）の定義 ───────────────────────────── */
const DECADES = [
  { id:'30f', label:'30代前半', range:'〜34歳',   min:  0, max: 34, img:'images/bucket-30f.png' },
  { id:'30b', label:'30代後半', range:'35〜39歳', min: 35, max: 39, img:'images/bucket-30b.png' },
  { id:'40',  label:'40代',     range:'40〜49歳', min: 40, max: 49, img:'images/bucket-40.png'  },
  { id:'50',  label:'50代',     range:'50〜59歳', min: 50, max: 59, img:'images/bucket-50.png'  },
  { id:'60',  label:'60代〜',   range:'60歳〜',   min: 60, max:999, img:'images/bucket-60.png'  },
];
const decadeById = id => DECADES.find(d => d.id === id) || null;


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

/** 指定日時点の満年齢（誕生日が来ていなければ1つ引く） */
function ageOn(date) {
  let age = date.getFullYear() - birthDate.getFullYear();
  const m = date.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && date.getDate() < birthDate.getDate())) age--;
  return age;
}
/** 今日時点の満年齢 */
const currentAge = () => ageOn(new Date());

/** その年の誕生日を迎えたときの年齢 */
const ageInYear = year => year - birthDate.getFullYear();
/** その年齢の誕生日を迎える年 */
const yearForAge = age => birthDate.getFullYear() + age;

/** 年齢 → 年代バケツ */
function decadeFromAge(age) {
  if (age === null || age === undefined || isNaN(age)) return null;
  const d = DECADES.find(d => age >= d.min && age <= d.max);
  return d ? d.id : null;
}
/** 夢がどのバケツに入るか */
function decadeOf(item) {
  if (item.deadlineAge != null) return decadeFromAge(item.deadlineAge);
  return item.decade || null;
}


/* ══════════ データ ══════════ */
let items = [];
let currentSort   = 'newest';
let currentDecade = null;   // 表示中のバケツ
let editingId     = null;   // null = 新規追加
let formDecade    = null;   // シートで選択中の年代

function loadItems() {
  try { items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { items = []; }
}
function saveItems() { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

/** 年齢と年のズレを、誕生日基準で正しく計算しなおす */
function recalcAges() {
  items.forEach(it => {
    if (it.deadlineYear) it.deadlineAge = ageInYear(it.deadlineYear);
    else if (it.deadlineAge != null) it.deadlineYear = yearForAge(it.deadlineAge);
    it.decade = decadeOf(it);
  });
}

/** 旧バージョンのデータを新形式へ（データは消さない） */
function migrate() {
  if (localStorage.getItem(MIGRATE_KEY)) return;
  items.forEach(it => { delete it.cat; });
  recalcAges();
  saveItems();
  localStorage.setItem(MIGRATE_KEY, '1');
}


/* ══════════ DOM ══════════ */
const $ = id => document.getElementById(id);

const screens     = { home: $('screenHome'), list: $('screenList'), done: $('screenDone') };
const bucketsEl   = $('buckets');
const statDone    = $('statDone');
const statTotal   = $('statTotal');
const dreamListEl = $('dreamList');
const doneListEl  = $('doneList');
const emptyState  = $('emptyState');
const doneEmpty   = $('doneEmpty');
const sortSelect  = $('sortSelect');
const listTitle   = $('listTitle');
const listSub     = $('listSub');
const listHeadBucket = $('listHeadBucket');
const doneSub     = $('doneSub');

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


/* ══════════ 画面の切り替え ══════════ */
function openSheet(el)  { el.hidden = false; document.body.classList.add('sheet-open'); }
function closeSheet(el) { el.hidden = true;  document.body.classList.remove('sheet-open'); }

function show(name) {
  Object.entries(screens).forEach(([k, el]) => { el.hidden = (k !== name); });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}


/* ══════════ ホーム（年代別バケツ） ══════════ */
function renderHome() {
  bucketsEl.innerHTML = '';

  DECADES.forEach(d => {
    const list  = items.filter(i => decadeOf(i) === d.id);
    const done  = list.filter(i => i.done).length;

    const btn = document.createElement('button');
    btn.className = 'bucket';
    btn.dataset.decade = d.id;
    btn.setAttribute('aria-label', `${d.label}（${d.range}）の夢 ${list.length}こ、うち${done}こ達成`);
    btn.innerHTML = `
      <img src="${d.img}" alt="" />
      <span class="bucket-count">
        <span class="n-done">${done}</span><span class="n-slash">/</span><span class="n-total">${list.length}</span>
      </span>`;
    btn.addEventListener('click', () => openDecade(d.id));
    bucketsEl.appendChild(btn);
  });

  // 年代が決まっていない夢（データを失わないための受け皿）
  const unset = items.filter(i => decadeOf(i) === null);
  const old = $('unsetLink');
  if (old) old.remove();
  if (unset.length) {
    const a = document.createElement('button');
    a.id = 'unsetLink';
    a.className = 'achieved-btn';
    a.style.margin = '14px auto 0';
    a.style.display = 'block';
    a.textContent = `🫧 年代が決まっていない夢（${unset.length}こ）`;
    a.addEventListener('click', () => openDecade('none'));
    bucketsEl.after(a);
  }

  updateStat();
}

function updateStat() {
  statTotal.textContent = items.length;
  statDone.textContent  = items.filter(i => i.done).length;
}


/* ══════════ バケツの中身（年代別リスト） ══════════ */
function openDecade(id) {
  currentDecade = id;
  const d = decadeById(id);

  listTitle.textContent = d ? d.label : '年代が決まっていない夢';
  if (d) {
    listHeadBucket.src = d.img;
    listHeadBucket.hidden = false;
  } else {
    listHeadBucket.hidden = true;
  }
  show('list');
  renderList();
}

function sortDreams(list) {
  const arr = [...list];
  if (currentSort === 'undone') return arr.filter(i => !i.done).sort((a, b) => b.id - a.id);
  arr.sort((a, b) => {
    switch (currentSort) {
      case 'oldest': return a.id - b.id;
      case 'age': {
        const aa = a.deadlineAge ?? 999, bb = b.deadlineAge ?? 999;
        return aa !== bb ? aa - bb : b.id - a.id;
      }
      default: return b.id - a.id;
    }
  });
  return arr;
}

function renderList() {
  const all  = items.filter(i => decadeOf(i) === (currentDecade === 'none' ? null : currentDecade));
  const done = all.filter(i => i.done).length;
  const d    = decadeById(currentDecade);

  listSub.textContent = d
    ? `${d.range}　夢 ${all.length}こ　／　叶えた ${done}こ`
    : `夢 ${all.length}こ　／　叶えた ${done}こ`;

  const shown = sortDreams(all);
  dreamListEl.innerHTML = '';
  shown.forEach(item => dreamListEl.appendChild(dreamCard(item, renderList)));
  emptyState.hidden = shown.length > 0;
}


/* ══════════ 叶えた夢 ══════════ */
function renderDone() {
  const list = items.filter(i => i.done).sort((a, b) => (a.deadlineAge ?? 999) - (b.deadlineAge ?? 999));
  doneSub.textContent = `${list.length}こ の夢を叶えました`;
  doneListEl.innerHTML = '';
  list.forEach(item => doneListEl.appendChild(dreamCard(item, renderDone)));
  doneEmpty.hidden = list.length > 0;
}


/* ══════════ 夢カード ══════════ */
function dreamCard(item, rerender) {
  const dec = decadeOf(item);
  const li = document.createElement('li');
  li.className = 'dream' + (item.done ? ' done' : '');
  if (dec) li.dataset.decade = dec;

  const meta = [];
  if (item.deadlineAge != null) {
    const overdue = item.deadlineYear && item.deadlineYear < new Date().getFullYear() && !item.done;
    meta.push(`<span class="${overdue ? 'overdue' : ''}">🗓 ${item.deadlineAge}歳までに（${item.deadlineYear}年）</span>`);
  } else if (dec) {
    meta.push(`<span>🪣 ${decadeById(dec).label}</span>`);
  }
  if (item.memo) meta.push(`<span>💬 ${escHtml(item.memo).slice(0, 28)}</span>`);

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

  li.querySelector('.check').addEventListener('click', () => toggleDone(item.id, rerender));
  li.querySelector('.edit').addEventListener('click',  () => openForm(item.id));
  li.querySelector('.del').addEventListener('click',   () => removeItem(item.id, li, rerender));
  return li;
}

function toggleDone(id, rerender) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.done = !item.done;
  saveItems();
  if (item.done) launchConfetti();
  rerender();
  updateStat();
}

function removeItem(id, li, rerender) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!confirm(`「${item.text}」をバケツから出しますか？`)) return;
  li.classList.add('removing');
  li.addEventListener('animationend', () => {
    items = items.filter(i => i.id !== id);
    saveItems();
    rerender();
    updateStat();
  }, { once: true });
}


/* ══════════ 追加・編集シート ══════════ */
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
      // 入力ずみの年齢がこの年代と合わなければ、年齢をクリアする
      const a = parseInt(fAge.value, 10);
      if (!isNaN(a) && decadeFromAge(a) !== d.id) { fAge.value = ''; }
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
  formDecade  = item ? decadeOf(item) : (currentDecade && currentDecade !== 'none' ? currentDecade : null);

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
  }
  saveItems();
  closeForm();

  if (!screens.list.hidden) {
    if (dec && dec !== currentDecade) openDecade(dec); else renderList();
  } else if (!screens.done.hidden) {
    renderDone();
  }
  renderHome();
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
    recalcAges();     // 目標年から年齢を計算しなおす
    saveItems();
  }
  closeSheet(setOverlay);
  renderHome();
  if (!screens.list.hidden) renderList();
  if (!screens.done.hidden) renderDone();
}


/* ══════════ イベント ══════════ */
$('addBtnHome').addEventListener('click', () => openForm());
$('addBtnList').addEventListener('click', () => openForm());
$('achievedBtn').addEventListener('click', () => { show('done'); renderDone(); });
[$('backBtn1'), $('backBtn2'), $('backBtn3'), $('backBtn4')].forEach(b =>
  b.addEventListener('click', () => { show('home'); renderHome(); }));

sortSelect.addEventListener('change', () => { currentSort = sortSelect.value; renderList(); });

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
renderHome();
show('home');

// ローカルでの開発中はオフライン用キャッシュを使わない（古い画面が出てしまうため）
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && !isLocal) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
