'use strict';

/* ══════════════════════════════════════════════════════════
   My Life Bucket List
   ══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'bucketListItems_v2';   // 既存データをそのまま引き継ぐ
const BIRTH_KEY   = 'birthDate';
const MIGRATE_KEY = 'blMigratedV3';
const DEFAULT_BIRTH = '1993-09-01';
const VERSION = '2026-11-26 版';

/* ── 年代（バケツ） ─────────────────────────────────── */
const DECADES = [
  { id:'30f', label:'30代前半', range:'〜34歳',   min:  0, max: 34, img:'images/bucket-30f.png' },
  { id:'30b', label:'30代後半', range:'35〜39歳', min: 35, max: 39, img:'images/bucket-30b.png' },
  { id:'40',  label:'40代',     range:'40〜49歳', min: 40, max: 49, img:'images/bucket-40.png'  },
  { id:'50',  label:'50代',     range:'50〜59歳', min: 50, max: 59, img:'images/bucket-50.png'  },
  { id:'60',  label:'60代〜',   range:'60歳〜',   min: 60, max:999, img:'images/bucket-60.png'  },
];
const decadeById = id => DECADES.find(d => d.id === id) || null;
const decadeRank = id => { const i = DECADES.findIndex(d => d.id === id); return i < 0 ? 99 : i; };

/* ── なかま分け（大項目） ───────────────────────────── */
const CATS = [
  { id:'family', label:'家族', emoji:'👪' },
  { id:'work',   label:'仕事', emoji:'💻' },
  { id:'self',   label:'自分', emoji:'🌱' },
];
const CAT_ORDER = ['family', 'work', 'self', null];
const catById = id => CATS.find(c => c.id === id) || null;

/** 昔のカテゴリ → 新しい大項目 */
const OLD_CAT_MAP = {
  family:'family', relations:'family', travel:'family',
  career:'work',   money:'work',
  health:'self',   hobby:'self',
};


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
const catOf = item => (item.cat && catById(item.cat)) ? item.cat : null;


/* ══════════ データ ══════════ */
let items = [];
let openDecadeId = null;
let editingId    = null;
let formDecade   = null;
let formCat      = null;

function loadItems() {
  try { items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { items = []; }
}
function saveItems() { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

function normalize(it, i) {
  return {
    id: Number(it.id) || (Date.now() + i),
    text: String(it.text || '').slice(0, 120),
    done: !!it.done,
    memo: String(it.memo || '').slice(0, 200),
    deadlineAge:  it.deadlineAge  != null ? Number(it.deadlineAge)  : null,
    deadlineYear: it.deadlineYear != null ? Number(it.deadlineYear) : null,
    decade: decadeById(it.decade) ? it.decade : null,
    cat: catById(it.cat) ? it.cat : null,
  };
}

function recalcAges() {
  items.forEach(it => {
    if (it.deadlineYear) it.deadlineAge = ageInYear(it.deadlineYear);
    else if (it.deadlineAge != null) it.deadlineYear = yearForAge(it.deadlineAge);
    it.decade = decadeOf(it);
  });
}
function migrate() {
  if (localStorage.getItem(MIGRATE_KEY)) return;
  // すでに新しい名前（family / work / self）のものは触らない
  items.forEach(it => { if (!catById(it.cat)) it.cat = OLD_CAT_MAP[it.cat] || null; });
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
const panelBody   = $('panelBody');
const panelEmpty  = $('panelEmpty');
const panelDoneBlock = $('panelDoneBlock');
const panelDoneList  = $('panelDoneList');

const formOverlay = $('formOverlay');
const formTitle   = $('formTitle');
const fText       = $('fText');
const fDecade     = $('fDecade');
const fCat        = $('fCat');
const fAge        = $('fAge');
const fYearHint   = $('fYearHint');
const fMemo       = $('fMemo');

const setOverlay  = $('setOverlay');
const fBirth      = $('fBirth');
const ageHint     = $('ageHint');
const ioBox       = $('ioBox');
const ioMsg       = $('ioMsg');


/* ══════════ 並び順 ══════════ */
/** あいうえお順（YouTube など同じ言葉で始まるものが自然にまとまる） */
const byName = (a, b) => a.text.localeCompare(b.text, 'ja', { numeric: true });

/** 大項目でまとめる。各グループの中はあいうえお順 */
function groupByCat(list) {
  return CAT_ORDER
    .map(id => ({ cat: id, list: list.filter(i => catOf(i) === id).sort(byName) }))
    .filter(g => g.list.length > 0);
}


/* ══════════ 全体を描きなおす ══════════ */
function renderAll() {
  renderBuckets();
  renderPanel();
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


/* ══════════ 大項目のかたまり ══════════ */
function catGroup(catId, list) {
  const c = catById(catId);
  const wrap = document.createElement('div');
  wrap.className = 'cat-group';
  wrap.dataset.cat = catId || 'none';

  const head = document.createElement('p');
  head.className = 'cat-head';
  head.innerHTML = `${c ? `${c.emoji} ${c.label}` : '🫧 なかま分けなし'}<span class="cat-num">${list.length}</span>`;
  wrap.appendChild(head);

  const ul = document.createElement('ul');
  ul.className = 'dreams';
  list.forEach(it => ul.appendChild(dreamCard(it)));
  wrap.appendChild(ul);
  return wrap;
}


/* ══════════ 展開パネル（選んだ年代の夢） ══════════ */
function renderPanel() {
  if (!openDecadeId) { panel.hidden = true; return; }
  panel.hidden = false;

  const d = decadeById(openDecadeId);
  const all    = items.filter(i => decadeOf(i) === (openDecadeId === 'none' ? null : openDecadeId));
  const undone = all.filter(i => !i.done);
  const done   = all.filter(i =>  i.done).sort(byName);

  if (d) { panelBucket.src = d.img; panelBucket.hidden = false; }
  else   { panelBucket.hidden = true; }
  panelTitle.textContent = d ? d.label : '年代が決まっていない夢';
  panelSub.textContent   = `まだの夢 ${undone.length}こ　叶えた夢 ${done.length}こ`;

  panelBody.innerHTML = '';
  groupByCat(undone).forEach(g => panelBody.appendChild(catGroup(g.cat, g.list)));
  panelEmpty.hidden = all.length > 0;

  panelDoneList.innerHTML = '';
  done.forEach(it => panelDoneList.appendChild(dreamCard(it)));
  panelDoneBlock.hidden = done.length === 0;
}


/* ══════════ 夢カード（やることを1行だけ） ══════════ */
function dreamCard(item) {
  const dec = decadeOf(item);
  const li = document.createElement('li');
  li.className = 'dream' + (item.done ? ' done' : '');
  if (dec) li.dataset.decade = dec;

  li.innerHTML = `
    <button class="check" aria-label="${item.done ? '未達成にもどす' : '達成にする'}">${item.done ? '✓' : ''}</button>
    <span class="dream-title">${escHtml(item.text)}</span>
    <span class="dream-acts">
      <button class="icon-btn edit" aria-label="編集">✏️</button>
      <button class="icon-btn del"  aria-label="削除">🗑️</button>
    </span>`;

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

async function removeItem(id, li) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!await ask(`「${item.text}」\nをバケツから出しますか？`, '出す')) return;
  li.classList.add('removing');
  li.addEventListener('animationend', () => {
    items = items.filter(i => i.id !== id);
    saveItems();
    renderAll();
  }, { once: true });
}


/* ══════════ 追加・編集シート ══════════ */
function syncSheetClass() {
  const any = [...document.querySelectorAll('.sheet-overlay')].some(o => !o.hidden);
  document.body.classList.toggle('sheet-open', any);
}
function openSheet(el)  { el.hidden = false; syncSheetClass(); }
function closeSheet(el) { el.hidden = true;  syncSheetClass(); }

/* 画面の中でたずねる（ブラウザの確認ダイアログは使わない） */
let askResolve = null;
function ask(message, yesLabel) {
  $('askText').textContent = message;
  $('askYes').textContent = yesLabel || 'はい';
  openSheet($('askOverlay'));
  return new Promise(res => { askResolve = res; });
}
function answerAsk(v) {
  closeSheet($('askOverlay'));
  const r = askResolve; askResolve = null;
  if (r) r(v);
}

function buildPickers() {
  fDecade.innerHTML = '';
  DECADES.forEach(d => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dchip'; b.dataset.decade = d.id; b.textContent = d.label;
    b.addEventListener('click', () => {
      formDecade = d.id;
      const a = parseInt(fAge.value, 10);
      if (!isNaN(a) && decadeFromAge(a) !== d.id) fAge.value = '';
      syncPickers();
    });
    fDecade.appendChild(b);
  });

  fCat.innerHTML = '';
  CATS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cchip'; b.dataset.cat = c.id;
    b.textContent = `${c.emoji} ${c.label}`;
    b.addEventListener('click', () => { formCat = (formCat === c.id) ? null : c.id; syncPickers(); });
    fCat.appendChild(b);
  });
}
function syncPickers() {
  fDecade.querySelectorAll('.dchip').forEach(c => c.classList.toggle('on', c.dataset.decade === formDecade));
  fCat.querySelectorAll('.cchip').forEach(c => c.classList.toggle('on', c.dataset.cat === formCat));
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
  formCat     = item ? catOf(item) : null;

  syncPickers();
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
    item.cat = formCat;
  } else {
    items.unshift({
      id: Date.now(), text, done: false,
      memo: fMemo.value.trim(),
      deadlineAge: age,
      deadlineYear: age != null ? yearForAge(age) : null,
      decade: dec,
      cat: formCat,
    });
    if (dec) openDecadeId = dec;
  }
  saveItems();
  closeForm();
  renderAll();
}


/* ══════════ 端末どうしの引っ越し ══════════ */
function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

/** 端末にわたす用の短い符号 */
function encodeData(list) {
  const d = list.map(i => [decadeOf(i) || '', catOf(i) || '', i.text, i.done ? 1 : 0, i.deadlineAge ?? '']);
  return toB64(JSON.stringify({ v: 1, d }));
}

/** 符号か、人が読める文章か、どちらでも読み込める */
function decodeData(input) {
  const s = String(input).trim();
  const hit = /#import=([A-Za-z0-9\-_]+)/.exec(s);
  const bare = s.replace(/\s+/g, '');
  const code = hit ? hit[1] : (/^[A-Za-z0-9\-_]{40,}$/.test(bare) ? bare : null);
  if (code) {
    const obj = JSON.parse(fromB64(code));
    const rows = Array.isArray(obj) ? obj : obj.d;
    if (!Array.isArray(rows)) throw new Error('形式がちがいます');
    if (Array.isArray(rows[0]) || rows.length === 0) {
      return rows.map(r => ({
        text: r[2], decade: r[0] || null, cat: r[1] || null,
        done: !!r[3], memo: '',
        deadlineAge: r[4] === '' || r[4] == null ? null : Number(r[4]),
        deadlineYear: null,
      }));
    }
    return rows;   // 旧い形（そのままの配列）
  }
  return fromText(s);
}

/** 「#30代前半」「家族｜やりたいこと」の形の文章を読む */
function fromText(s) {
  const out = [];
  let dec = null;
  s.split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t) return;
    if (t.startsWith('#') || t.startsWith('＃')) {
      const name = t.slice(1).trim();
      const d = DECADES.find(x => x.label === name);
      dec = d ? d.id : null;
      return;
    }
    let cat = null, text = t;
    const m = /^(.{1,6}?)\s*[｜|]\s*(.+)$/.exec(t);
    if (m) {
      const c = CATS.find(x => x.label === m[1].trim());
      if (c) { cat = c.id; text = m[2].trim(); }
    }
    if (text) out.push({ text, decade: dec, cat, done: false, memo: '', deadlineAge: null, deadlineYear: null });
  });
  if (!out.length) throw new Error('読み取れませんでした');
  return out;
}

function applyImport(data) {
  items = data.map(normalize);
  saveItems();
  localStorage.setItem(MIGRATE_KEY, '1');
  renderAll();
}

function doExport() {
  const link = location.origin + location.pathname + '#import=' + encodeData(items);
  ioBox.value = link;
  ioBox.focus(); ioBox.select();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link)
      .then(() => { ioMsg.textContent = `コピーしました（${items.length}こ）。べつの端末で開くか、下の枠に貼り付けてください。`; })
      .catch(() => { ioMsg.textContent = `書き出しました（${items.length}こ）。枠の中をコピーしてください。`; });
  } else {
    ioMsg.textContent = `書き出しました（${items.length}こ）。枠の中をコピーしてください。`;
  }
}
async function doImport() {
  const v = ioBox.value.trim();
  if (!v) { ioMsg.textContent = '枠に貼り付けてから押してください。'; return; }
  let data;
  try { data = decodeData(v); }
  catch { ioMsg.textContent = '読み取れませんでした。貼り付けた内容をご確認ください。'; return; }
  if (!await ask(`${data.length}この夢を読み込みます。\nいまこの端末に入っている夢（${items.length}こ）は置きかえられます。`, '読み込む')) return;
  applyImport(data);
  ioBox.value = '';
  ioMsg.textContent = `${items.length}こ の夢を読み込みました。`;
}

/** リンクで開かれたときの読み込み */
async function importFromHash() {
  if (!location.hash.startsWith('#import=')) return;
  let data;
  try { data = decodeData(location.hash); }
  catch { return; }
  history.replaceState(null, '', location.pathname + location.search);
  const ok = await ask(`${data.length}この夢を読み込みます。\nいまこの端末に入っている夢（${items.length}こ）は置きかえられます。`, '読み込む');
  if (ok) applyImport(data);
}


/* ══════════ 設定 ══════════ */
function openSettings() {
  fBirth.value = birthStr();
  ageHint.textContent = `いまは ${currentAge()}歳です。`;
  $('verLabel').textContent = `バージョン：${VERSION}`;
  ioBox.value = ''; ioMsg.textContent = '';
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

$('formClose').addEventListener('click', closeForm);
$('formSave').addEventListener('click', saveForm);
formOverlay.addEventListener('click', e => { if (e.target === formOverlay) closeForm(); });
fText.addEventListener('keydown', e => { if (e.key === 'Enter') saveForm(); });
fAge.addEventListener('input', () => {
  const a = parseInt(fAge.value, 10);
  if (!isNaN(a)) { const d = decadeFromAge(a); if (d) formDecade = d; }
  syncPickers();
});

$('gearBtn').addEventListener('click', openSettings);
$('setClose').addEventListener('click', () => closeSheet(setOverlay));
$('setSave').addEventListener('click', saveSettings);
$('exportBtn').addEventListener('click', doExport);
$('importBtn').addEventListener('click', doImport);
setOverlay.addEventListener('click', e => { if (e.target === setOverlay) closeSheet(setOverlay); });
$('askYes').addEventListener('click', () => answerAsk(true));
$('askNo').addEventListener('click',  () => answerAsk(false));

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('askOverlay').hidden) { answerAsk(false); return; }
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

// 夢の内容はコードに持たせない（公開リポジトリに個人の内容を残さないため）
// 端末に保存ずみの夢、またはリンク／貼り付けで読み込んだ夢だけを表示する

migrate();
buildPickers();
renderAll();
importFromHash();

// 端末に残っている「オフライン保存」をすべて解除する
// （更新しても古い画面が出続ける原因になっていたため）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(rs => rs.forEach(r => r.unregister().catch(() => {})))
    .catch(() => {});
}
if (window.caches) {
  caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
}
