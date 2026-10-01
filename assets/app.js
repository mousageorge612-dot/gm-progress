/* GM Progress — simple end-of-day check-in for George Mousa Online Coaching clients.
   Data stays on the device (localStorage). Reports go to the coach on WhatsApp. */
(function () {
  'use strict';

  var COACH_WA = '963987461750';
  var KEY = 'gm_progress_v2';
  var IS_ANDROID_APP = typeof window.GMAndroid !== 'undefined';
  var QUOTE_HTML = '<section class="quote"><p class="ar">«كل ما يُقاس يتحسّن»</p><p class="en" dir="ltr">"What gets measured gets improved."</p><span>بيتر دراكر · Peter Drucker</span></section>';

  /* ---------------- storage ---------------- */
  function blank() { return { profile: null, days: {}, challenges: [] }; }
  var S = load();
  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && typeof d === 'object') return Object.assign(blank(), d); } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('تعذّر الحفظ'); } }

  /* ---------------- helpers ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return dstr(new Date()); }
  function parseD(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); }
  var MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
  var WDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  function fmtDate(s) { var d = parseD(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function fmtDay(s) { return WDAYS[parseD(s).getDay()] + ' ' + fmtDate(s); }
  function fmtShort(s) { var d = parseD(s); return d.getDate() + '/' + (d.getMonth() + 1); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function num(v) { return '<span class="num">' + v + '</span>'; }
  function signed(n) { n = r1(n); return (n > 0 ? '+' : '') + n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  var GOALS = { cut: 'خسارة دهون', bulk: 'بناء عضل', recomp: 'شد وتنشيف', health: 'لياقة وصحة' };
  var PLANS = { m1: 'باقة شهر', m3: 'باقة 3 أشهر', m6: 'باقة 6 أشهر', other: 'أخرى' };
  var TRAIN = { yes: 'نعم', no: 'لا', rest: 'يوم راحة' };
  var SLEEPQ = { bad: 'سيئة', ok: 'متوسطة', good: 'جيدة' };
  var ENERGY = { low: 'منخفضة', mid: 'متوسطة', high: 'عالية' };
  var MOOD = { bad: 'سيء', mid: 'متوسط', good: 'ممتاز' };
  var LEVEL = { low: 0, bad: 0, mid: 0.5, ok: 0.5, high: 1, good: 1 };

  /* Score out of 100: training 20, cardio 10, nutrition 25, no relapse 10, water 10, sleep 10, energy 7.5, mood 7.5 */
  function score(d) {
    if (!d) return 0;
    var s = (d.train === 'yes' || d.train === 'rest' ? 20 : 0) +
      (d.cardio ? 10 : 0) +
      (d.nutrition || 0) * 0.25 +
      (d.relapse ? 0 : 10) +
      Math.min(1, (d.water || 0) / waterTarget()) * 10 +
      Math.min(1, (+d.sleep || 0) / 7) * 10 +
      (LEVEL[d.energy] || 0) * 7.5 +
      (LEVEL[d.mood] || 0) * 7.5;
    return Math.round(s);
  }
  function waterTarget() { return (S.profile && S.profile.waterTarget) || 3; }
  function scoreClass(s) { return s >= 80 ? 'good' : s >= 55 ? 'mid' : 'low'; }
  function streak() {
    var n = 0, d = todayStr();
    if (!S.days[d]) d = addDays(d, -1);
    while (S.days[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function range(days) {
    var out = [], t = todayStr();
    for (var i = days - 1; i >= 0; i--) out.push(addDays(t, -i));
    return out;
  }
  function blankDay() { return { train: null, cardio: null, cardioMin: '', nutrition: null, relapse: null, relapseNote: '', water: null, sleep: '', sleepQ: null, energy: null, mood: null, weight: '', note: '' }; }

  /* ---------------- icons ---------------- */
  var I = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="m9 15 2 2 4-4"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h4"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };

  /* ---------------- shell ---------------- */
  var tab = 'today';
  var editDate = todayStr();
  var reportKind = 'day';
  var reportDate = todayStr();

  function render() {
    var app = $('#app');
    if (!S.profile) { app.innerHTML = onboardView(); bindOnboard(); return; }
    var titles = { today: 'تسجيل اليوم', challenges: 'التحديات', history: 'السجل', report: 'التقارير' };
    app.innerHTML =
      '<div class="shell">' +
      '<header class="topbar"><div class="t"><img src="assets/img/logo.png" alt=""><div>' + titles[tab] + '<small>GM Progress</small></div></div>' +
      '<button class="iconbtn" data-act="settings" aria-label="الإعدادات">' + I.gear + '</button></header>' +
      '<main class="page" id="page"></main>' +
      '<nav class="tabbar">' + tabBtn('today', 'اليوم', I.today) + tabBtn('challenges', 'التحديات', I.target) + tabBtn('history', 'السجل', I.history) + tabBtn('report', 'التقارير', I.report) + '</nav></div>';
    ({ today: todayView, challenges: challengesView, history: historyView, report: reportView })[tab]($('#page'));
  }
  function tabBtn(k, t, ic) { return '<button class="tab' + (tab === k ? ' on' : '') + '" data-tab="' + k + '">' + ic + '<span>' + t + '</span></button>'; }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (t) { tab = t.getAttribute('data-tab'); if (tab === 'today') editDate = todayStr(); render(); window.scrollTo(0, 0); return; }
    var a = e.target.closest('[data-act]');
    if (a) { var fn = ACTIONS[a.getAttribute('data-act')]; if (fn) fn(a); return; }
    if (e.target.closest('[data-close]')) closeSheet();
  });

  function field(l, inner) { return '<div class="field"><label>' + l + '</label>' + inner + '</div>'; }
  function chip(v, t, on) { return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-v="' + v + '">' + t + '</button>'; }
  function chips(name, map, val) {
    return '<div class="chips" data-chips="' + name + '">' + Object.keys(map).map(function (k) { return chip(k, map[k], val != null && String(val) === String(k)); }).join('') + '</div>';
  }
  function bindChips(root, onChange) {
    $$('[data-chips]', root).forEach(function (g) {
      g.addEventListener('click', function (e) {
        var c = e.target.closest('.chip'); if (!c) return;
        $$('.chip', g).forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        if (onChange) onChange(g.getAttribute('data-chips'));
      });
    });
  }
  function chipVal(root, name) { var c = $('[data-chips="' + name + '"] .chip.on', root); return c ? c.getAttribute('data-v') : null; }

  /* ---------------- onboarding ---------------- */
  function onboardView() {
    return '<div class="onboard"><div class="onboard-bg"></div><div class="onboard-inner">' +
      '<div class="brand"><img src="assets/img/logo.png" alt="George Mousa"></div>' +
      '<h1>التزامك اليومي<br>مع <span>George Mousa</span></h1>' +
      '<p class="lead">دقيقة وحدة آخر كل يوم: سجّل التزامك وابعت تقريرك للكوتش.</p>' +
      QUOTE_HTML +
      '<form class="form" id="onb" style="margin-top:16px">' +
      field('الاسم', '<input name="name" required placeholder="اسمك">') +
      '<div class="field"><label>الهدف</label>' + chips('goal', GOALS, 'cut') + '</div>' +
      '<div class="row2">' + field('هدف الماء اليومي (لتر)', '<input name="waterTarget" type="number" inputmode="decimal" step="0.5" min="1" max="6" value="3" required>') +
      field('الباقة', '<select name="plan">' + Object.keys(PLANS).map(function (k) { return '<option value="' + k + '"' + (k === 'm3' ? ' selected' : '') + '>' + PLANS[k] + '</option>'; }).join('') + '</select>') + '</div>' +
      '<button class="btn" type="submit">ابدأ</button>' +
      '<button class="btn ghost" type="button" data-act="import">عندي نسخة احتياطية، استرجعها</button>' +
      '</form></div></div>';
  }
  function bindOnboard() {
    var f = $('#onb'); bindChips(f);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      S.profile = { name: f.name.value.trim(), goal: chipVal(f, 'goal') || 'cut', waterTarget: parseFloat(f.waterTarget.value) || 3, plan: f.plan.value, start: todayStr() };
      save(); tab = 'today'; editDate = todayStr(); render(); toast('أهلاً ' + S.profile.name + ' 💪');
    });
  }

  /* ---------------- today (check-in form) ---------------- */
  function ring(pct, size) {
    var r = 36, c = 2 * Math.PI * r;
    return '<svg viewBox="0 0 86 86" style="width:' + (size || 86) + 'px;height:' + (size || 86) + 'px;flex:none"><circle cx="43" cy="43" r="' + r + '" stroke="#222" stroke-width="9" fill="none"/>' +
      '<circle cx="43" cy="43" r="' + r + '" stroke="#ffb800" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * pct / 100) + ' ' + c + '" transform="rotate(-90 43 43)"/>' +
      '<text x="43" y="50" text-anchor="middle" fill="#fff" font-size="19" font-weight="900" font-family="Cairo">' + pct + '%</text></svg>';
  }

  function todayView(page) {
    var isToday = editDate === todayStr();
    var saved = S.days[editDate];
    var d = Object.assign(blankDay(), saved || {});
    var q = function (icon, title, inner, hint) { return '<section class="card q"><h3><span>' + icon + ' ' + title + '</span>' + (hint ? '<span class="sub">' + hint + '</span>' : '') + '</h3>' + inner + '</section>'; };
    page.innerHTML =
      installHint() +
      '<section class="hero" style="min-height:210px"><div class="hero-bg"></div><div class="hero-c">' +
      '<span class="pill">🔥 ' + num(streak()) + ' يوم متتالي</span>' +
      '<div class="hi">أهلاً ' + esc(S.profile.name) + ' 👋</div>' +
      '<h2>' + (isToday ? 'كيف كان يومك؟' : 'تعديل يوم ' + fmtDay(editDate)) + '</h2></div></section>' +
      QUOTE_HTML +
      chTodayCard(editDate) +
      (saved && isToday ? '<div class="install ok">✅ سجّلت يومك. فيك تعدّل وتبعت من جديد.</div>' : '') +
      '<form class="form" id="day">' +
      '<div class="card" style="padding:12px 16px">' + field('التاريخ', '<input name="date" type="date" value="' + editDate + '" max="' + todayStr() + '">') + '</div>' +
      q('🏋️', 'التمرين', chips('train', TRAIN, d.train)) +
      q('🚶', 'الكارديو', chips('cardio', { 1: 'نعم', 0: 'لا' }, d.cardio == null ? null : (d.cardio ? 1 : 0)) +
        '<div class="field" id="cardioMinWrap" style="margin-top:10px' + (d.cardio ? '' : ';display:none') + '"><label>كم دقيقة؟</label><input name="cardioMin" type="number" inputmode="numeric" min="0" max="300" value="' + esc(d.cardioMin) + '" placeholder="30"></div>') +
      q('🍽️', 'الالتزام بالتغذية', chips('nutrition', { 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }, d.nutrition)) +
      q('🔄', 'انتكاس', chips('relapse', { 0: 'لا', 1: 'نعم' }, d.relapse == null ? null : (d.relapse ? 1 : 0)) +
        '<div class="field" id="relapseWrap" style="margin-top:10px' + (d.relapse ? '' : ';display:none') + '"><label>شو صار؟</label><input name="relapseNote" maxlength="80" value="' + esc(d.relapseNote) + '" placeholder="مثلاً: أكلت حلو بعزومة"></div>', 'أكل خارج النظام') +
      q('💧', 'الماء', chips('water', { 1: '1', 1.5: '1.5', 2: '2', 2.5: '2.5', 3: '3', 3.5: '3.5', 4: '4+' }, d.water), 'لتر · الهدف ' + num(waterTarget())) +
      q('🛌', 'النوم', field('عدد الساعات', '<input name="sleep" type="number" inputmode="decimal" step="0.5" min="0" max="16" value="' + esc(d.sleep) + '" placeholder="7">') +
        '<div class="field" style="margin-top:10px"><label>الجودة</label>' + chips('sleepQ', SLEEPQ, d.sleepQ) + '</div>') +
      q('⚡', 'الطاقة', chips('energy', ENERGY, d.energy)) +
      q('😊', 'المزاج', chips('mood', MOOD, d.mood)) +
      '<section class="card q"><h3><span>⚖️ الوزن</span><span class="sub">اختياري</span></h3>' +
        '<div class="field"><input name="weight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="' + esc(d.weight) + '" placeholder="كغ"></div>' +
        '<div class="field" style="margin-top:10px"><label>ملاحظة للكوتش (اختياري)</label><textarea name="note" rows="2" maxlength="300" placeholder="أي شي بدك تخبرني فيه">' + esc(d.note) + '</textarea></div></section>' +
      '<section class="card scorebar"><div class="ring" id="ringWrap"></div>' +
      '<button class="btn wa" type="submit" data-send="1">احفظ وابعت التقرير على واتساب</button>' +
      '<button class="btn ghost" type="submit">احفظ بدون إرسال</button></section>' +
      '</form>';

    var f = $('#day');
    var upd = function () {
      var cur = readForm(f), miss = requiredMissing(cur);
      $('#ringWrap').innerHTML = ring(score(cur), 70) + '<div><b>نتيجة اليوم</b><div class="muted" style="font-size:12.5px">' +
        (miss.length ? 'باقي: ' + miss.join('، ') : 'كل شي جاهز ✅') + '</div></div>';
      $('#cardioMinWrap').style.display = cur.cardio ? '' : 'none';
      $('#relapseWrap').style.display = cur.relapse ? '' : 'none';
    };
    bindChips(f, upd);
    f.addEventListener('input', upd);
    f.date.addEventListener('change', function () { if (f.date.value) { editDate = f.date.value; render(); } });
    var sendFlag = false;
    $$('button[type=submit]', f).forEach(function (b) { b.addEventListener('click', function () { sendFlag = b.hasAttribute('data-send'); }); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var cur = readForm(f), miss = requiredMissing(cur);
      if (miss.length) { toast('كمّل: ' + miss[0]); return; }
      cur.saved = new Date().toISOString();
      S.days[editDate] = cur; save();
      if (sendFlag) openExternal(waLink(dailyReport(editDate)));
      toast(score(cur) >= 80 ? 'يوم ممتاز! 🔥' : 'تم الحفظ ✅');
      render(); window.scrollTo(0, 0);
    });
    upd();
  }

  function readForm(f) {
    var c = function (n) { return chipVal(f, n); };
    var cardio = c('cardio'), relapse = c('relapse'), water = c('water'), nut = c('nutrition');
    return {
      train: c('train'),
      cardio: cardio == null ? null : cardio === '1',
      cardioMin: cardio === '1' ? f.cardioMin.value : '',
      nutrition: nut == null ? null : +nut,
      relapse: relapse == null ? null : relapse === '1',
      relapseNote: relapse === '1' ? f.relapseNote.value.trim() : '',
      water: water == null ? null : +water,
      sleep: f.sleep.value,
      sleepQ: c('sleepQ'),
      energy: c('energy'),
      mood: c('mood'),
      weight: f.weight.value,
      note: f.note.value.trim()
    };
  }
  function requiredMissing(d) {
    var m = [];
    if (!d.train) m.push('التمرين');
    if (d.cardio == null) m.push('الكارديو');
    if (d.nutrition == null) m.push('التغذية');
    if (d.relapse == null) m.push('الانتكاس');
    if (d.water == null) m.push('الماء');
    if (d.sleep === '' || !d.sleepQ) m.push('النوم');
    if (!d.energy) m.push('الطاقة');
    if (!d.mood) m.push('المزاج');
    return m;
  }

  function installHint() {
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    if (!ios || standalone || IS_ANDROID_APP) return '';
    return '<div class="install"><span style="font-size:22px">📲</span><div><b>ثبّت التطبيق على الآيفون:</b> اضغط زر المشاركة <b>⬆︎</b> بأسفل Safari ثم اختر <b>إضافة إلى الشاشة الرئيسية</b>.</div></div>';
  }

  /* ---------------- history ---------------- */
  function historyView(page) {
    var last7 = range(7), last30 = range(30);
    var logged7 = last7.filter(function (d) { return S.days[d]; });
    var a7 = logged7.length ? Math.round(logged7.reduce(function (a, d) { return a + score(S.days[d]); }, 0) / logged7.length) : null;
    var logged30 = last30.filter(function (d) { return S.days[d]; }).length;
    var chart = range(14).map(function (d) {
      var s = S.days[d] ? score(S.days[d]) : 0;
      return '<div class="bar"><em>' + (S.days[d] ? s : '') + '</em><i class="' + (S.days[d] ? scoreClass(s) : 'none') + '" style="height:' + Math.max(3, s) + '%"></i><span>' + parseD(d).getDate() + '</span></div>';
    }).join('');
    var list = Object.keys(S.days).sort().reverse();
    page.innerHTML =
      '<section class="hero" style="min-height:180px"><div class="hero-bg mirror"></div><div class="hero-c"><span class="pill">الاستمرارية</span><h2>يوم ورا يوم، بتوصل</h2></div></section>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + num(streak()) + '</b><span>يوم متتالي 🔥</span></div>' +
      '<div class="stat"><b>' + (a7 == null ? '—' : num(a7 + '%')) + '</b><span>معدل آخر 7 أيام</span></div>' +
      '<div class="stat"><b>' + num(logged30 + '/30') + '</b><span>أيام مسجّلة</span></div></div>' +
      '<section class="card"><h3>نتيجتك آخر 14 يوم</h3><div class="bars" dir="ltr">' + chart + '</div></section>' +
      '<section class="card"><h3>كل الأيام <span class="sub">اضغط على يوم لتعدّله</span></h3><div class="list">' +
      (list.length ? list.map(function (d) {
        var x = S.days[d], s = score(x);
        return '<button class="li dayrow" data-act="editDay" data-d="' + d + '"><div><div class="v">' + fmtDay(d) + '</div><div class="d">' +
          (x.train === 'yes' ? '🏋️ تمرين' : x.train === 'rest' ? '😌 راحة' : '✖️ بدون تمرين') + ' · 🍽️ ' + num(x.nutrition + '%') + ' · 💧 ' + num(x.water) + ' · 🛌 ' + num(x.sleep) + (x.relapse ? ' · 🔄' : '') +
          '</div></div><span class="score ' + scoreClass(s) + '">' + num(s + '%') + '</span></button>';
      }).join('') : '<div class="empty">لسا ما سجّلت أي يوم. ابدأ من تبويب "اليوم".</div>') + '</div></section>';
  }

  /* ---------------- reports ---------------- */
  function yn(b) { return b ? 'نعم' : 'لا'; }
  function dailyReport(date) {
    var d = S.days[date]; if (!d) return '';
    var L = [];
    L.push('📊 تقرير المتابعة اليومية – GM Progress');
    L.push('👤 ' + S.profile.name);
    L.push('📅 التاريخ: ' + date + ' (' + WDAYS[parseD(date).getDay()] + ')');
    L.push('');
    L.push('🏋️ التمرين: ' + TRAIN[d.train]);
    L.push('🚶 الكارديو: ' + yn(d.cardio) + ' (' + (d.cardio ? (+d.cardioMin || 0) : 0) + ' دقيقة)');
    L.push('🍽️ التغذية: ' + d.nutrition + '%');
    L.push('🔄 انتكاس: ' + (d.relapse ? 'نعم' + (d.relapseNote ? ' – ' + d.relapseNote : '') : '—'));
    L.push('💧 الماء: ' + d.water + ' لتر (الهدف: ' + yn(d.water >= waterTarget()) + ')');
    L.push('🛌 النوم: ' + d.sleep + ' ساعة (' + SLEEPQ[d.sleepQ] + ')');
    L.push('⚡ الطاقة: ' + ENERGY[d.energy]);
    L.push('😊 المزاج: ' + MOOD[d.mood]);
    if (d.weight) L.push('⚖️ الوزن: ' + d.weight + ' كغ');
    if (d.note) L.push('📝 ملاحظة: ' + d.note);
    var cl = chReportLines(date); if (cl.length) { L.push(''); cl.forEach(function (x) { L.push(x); }); }
    L.push('');
    L.push('⭐ النتيجة: ' + score(d) + '%');
    return L.join('\n');
  }
  function periodReport(n) {
    var ds = range(n), logged = ds.filter(function (d) { return S.days[d]; }), X = logged.map(function (d) { return S.days[d]; });
    var L = ['📊 ' + (n === 7 ? 'التقرير الأسبوعي' : 'التقرير الشهري') + ' – GM Progress', '👤 ' + S.profile.name, '📅 من ' + ds[0] + ' إلى ' + ds[ds.length - 1], ''];
    if (!X.length) { L.push('ما في أيام مسجّلة بهالفترة.'); var cp0 = chPeriodLines(ds); if (cp0.length) { L.push(''); cp0.forEach(function (x) { L.push(x); }); } return L.join('\n'); }
    var cnt = function (fn) { return X.filter(fn).length; };
    var mean = function (fn) { return X.reduce(function (a, x) { return a + fn(x); }, 0) / X.length; };
    var dist = function (k, map) { return Object.keys(map).slice().reverse().map(function (v) { return map[v] + ' ' + cnt(function (x) { return x[k] === v; }); }).join(' · '); };
    var cardioMin = X.reduce(function (a, x) { return a + (x.cardio ? (+x.cardioMin || 0) : 0); }, 0);
    L.push('📝 أيام التسجيل: ' + X.length + '/' + n);
    L.push('🏋️ التمرين: ' + cnt(function (x) { return x.train === 'yes'; }) + ' تمرين · ' + cnt(function (x) { return x.train === 'rest'; }) + ' راحة · ' + cnt(function (x) { return x.train === 'no'; }) + ' تفويت');
    L.push('🚶 الكارديو: ' + cnt(function (x) { return x.cardio; }) + ' يوم (' + cardioMin + ' دقيقة)');
    L.push('🍽️ متوسط التغذية: ' + Math.round(mean(function (x) { return x.nutrition || 0; })) + '%');
    L.push('🔄 الانتكاسات: ' + cnt(function (x) { return x.relapse; }));
    L.push('💧 الماء: الهدف تحقق ' + cnt(function (x) { return x.water >= waterTarget(); }) + ' يوم · المتوسط ' + r1(mean(function (x) { return x.water || 0; })) + ' لتر');
    L.push('🛌 متوسط النوم: ' + r1(mean(function (x) { return +x.sleep || 0; })) + ' ساعة');
    L.push('⚡ الطاقة: ' + dist('energy', ENERGY));
    L.push('😊 المزاج: ' + dist('mood', MOOD));
    var w = logged.filter(function (d) { return S.days[d].weight; });
    if (w.length) {
      var w0 = +S.days[w[0]].weight, w1 = +S.days[w[w.length - 1]].weight;
      L.push('⚖️ الوزن: ' + (w.length > 1 ? w0 + ' ← ' + w1 + ' كغ (' + signed(w1 - w0) + ')' : w1 + ' كغ'));
    }
    L.push('');
    var cp = chPeriodLines(ds); if (cp.length) { cp.forEach(function (x) { L.push(x); }); L.push(''); }
    L.push('⭐ متوسط النتيجة: ' + Math.round(mean(score)) + '%');
    L.push('');
    if (n === 7) {
      ds.forEach(function (d) { L.push('• ' + WDAYS[parseD(d).getDay()] + ' ' + fmtShort(d) + ': ' + (S.days[d] ? score(S.days[d]) + '%' : 'غير مسجّل')); });
    } else {
      var best = logged.reduce(function (b, d) { return score(S.days[d]) > score(S.days[b]) ? d : b; }, logged[0]);
      L.push('🏆 أفضل يوم: ' + fmtShort(best) + ' (' + score(S.days[best]) + '%)');
      // Four week buckets, oldest first; the first bucket absorbs the extra days beyond 28.
      var bounds = [0, n - 21, n - 14, n - 7, n];
      for (var i = 0; i < 4; i++) {
        var wk = ds.slice(bounds[i], bounds[i + 1]).filter(function (d) { return S.days[d]; });
        L.push('• الأسبوع ' + (i + 1) + ': ' + (wk.length ? Math.round(wk.reduce(function (a, d) { return a + score(S.days[d]); }, 0) / wk.length) + '% (' + wk.length + ' أيام)' : 'غير مسجّل'));
      }
    }
    L.push('');
    L.push('«كل ما يُقاس يتحسّن» – بيتر دراكر');
    return L.join('\n');
  }
  function currentReport() {
    if (reportKind === 'day') return dailyReport(reportDate);
    return periodReport(reportKind === 'week' ? 7 : 30);
  }
  function reportView(page) {
    page.innerHTML =
      '<section class="hero" style="min-height:190px"><div class="hero-bg outdoor"></div><div class="hero-c"><span class="pill">يومي · أسبوعي · شهري</span><h2>ابعت تقريرك للكوتش جورج</h2></div></section>' +
      '<div class="seg" id="kind">' + [['day', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري']].map(function (k) { return '<button data-k="' + k[0] + '" class="' + (reportKind === k[0] ? 'on' : '') + '">' + k[1] + '</button>'; }).join('') + '</div>' +
      (reportKind === 'day' ? '<div class="card" style="padding:12px 16px">' + field('اليوم', '<input id="rdate" type="date" value="' + reportDate + '" max="' + todayStr() + '">') + '</div>' : '') +
      '<section class="card"><h3>معاينة التقرير <span class="sub">' + (reportKind === 'week' ? 'آخر 7 أيام' : reportKind === 'month' ? 'آخر 30 يوم' : '') + '</span></h3><div class="report" id="rep"></div></section>' +
      '<button class="btn wa" data-act="sendWa">ابعت على واتساب</button>' +
      '<button class="btn ghost" data-act="copyReport">انسخ التقرير</button>';
    $('#rep').textContent = currentReport() || 'ما سجّلت هاد اليوم لسا.';
    $('#kind').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; reportKind = b.getAttribute('data-k'); render(); });
    if ($('#rdate')) $('#rdate').addEventListener('change', function (e) { if (e.target.value) { reportDate = e.target.value; render(); } });
  }

  /* ---------------- sheets & platform helpers ---------------- */
  function openSheet(html, onMount) {
    $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; document.body.style.overflow = 'hidden';
    if (onMount) onMount($('#sheet-body'));
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; document.body.style.overflow = ''; }
  function waLink(text) { return 'https://wa.me/' + COACH_WA + '?text=' + encodeURIComponent(text); }
  function openExternal(url) {
    if (IS_ANDROID_APP && window.GMAndroid.openUrl) { window.GMAndroid.openUrl(url); return; }
    var w = window.open(url, '_blank'); if (!w) location.href = url;
  }
  function downloadText(name, text) {
    if (IS_ANDROID_APP && window.GMAndroid.saveFile) {
      var where = window.GMAndroid.saveFile(name, text);
      toast(where ? 'انحفظ الملف في: ' + where : 'تعذّر حفظ الملف'); return;
    }
    var blob = new Blob([text], { type: 'application/json' });
    if (navigator.canShare && navigator.share) {
      try { var file = new File([blob], name, { type: blob.type }); if (navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: name }).catch(function () {}); return; } } catch (e) {}
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }
  function pickFile(accept, cb) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', function () { cb(inp.files && inp.files[0]); inp.remove(); }); inp.click();
  }

  /* ---------------- challenges (built on Atomic Habits, James Clear) ---------------- */
  function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 864e5); }
  var CH_PRESETS = [
    { icon: '🍬', title: 'بدون سكر مضاف', kind: 'quit', days: 30, identity: 'أنا شخص ما بياكل سكر', plan: 'لما بدّي شي حلو، باكل فاكهة أو تمر', tip: 'خلّي الإغراء غير مرئي: شيل الحلويات من البيت ومن مكتبك.' },
    { icon: '🍞', title: 'بدون خبز أبيض', kind: 'quit', days: 30, identity: 'أنا شخص بيختار الكربوهيدرات الصح', plan: 'باستبدل الخبز الأبيض بخبز أسمر أو شوفان', tip: 'سهّل البديل: اشتري الخبز الأسمر وحطه بمكان الخبز الأبيض.' },
    { icon: '🥤', title: 'بدون مشروبات غازية', kind: 'quit', days: 30, identity: 'أنا شخص بيشرب مي مش سكر', plan: 'لما بدّي شي بارد، بشرب مي باردة أو صودا بدون سكر', tip: 'خلّي قنينة مي باردة دايماً بالبراد بمكان الغازيات.' },
    { icon: '🍔', title: 'بدون أكل سريع', kind: 'quit', days: 30, identity: 'أنا شخص بيحضّر أكله', plan: 'بحضّر وجباتي يوم الجمعة للأسبوع كله', tip: 'امسح تطبيقات التوصيل من موبايلك خلال التحدي.' },
    { icon: '🌙', title: 'ما في أكل بعد 10 بالليل', kind: 'quit', days: 21, identity: 'أنا شخص مطبخه بيسكّر بكير', plan: 'بعد العشا بنضّف سناني، وهي إشارة إنه خلص الأكل', tip: 'تكديس العادات: بعد ما تنظف سنانك، المطبخ مسكّر.' },
    { icon: '🍫', title: 'بدون حلويات وسناكات', kind: 'quit', days: 21, identity: 'أنا شخص بياكل لأنه جوعان مش لأنه زهقان', plan: 'لما بحس بالجوع بين الوجبات، باكل بروتين أو خضار', tip: 'جهّز سناك صحي جاهز بمكان واضح.' },
    { icon: '👟', title: '10,000 خطوة يومياً', kind: 'build', days: 30, identity: 'أنا شخص نشيط بيتحرك كل يوم', plan: 'بعد الغدا بطلع أمشي 20 دقيقة', tip: 'قاعدة الدقيقتين: إذا ما في وقت، البس صباطك واطلع 5 دقايق بس.' },
    { icon: '💧', title: '3 لتر مي يومياً', kind: 'build', days: 30, identity: 'أنا شخص بيهتم بجسمه', plan: 'بشرب كاسة مي بعد كل وجبة وكل ما بفوت عالحمام', tip: 'حط قنينة مي كبيرة على مكتبك قدام عينك.' },
    { icon: '🥩', title: 'هدف البروتين كل يوم', kind: 'build', days: 30, identity: 'أنا رياضي بيغذّي عضلاته', plan: 'بكل وجبة بحط مصدر بروتين أول شي بالصحن', tip: 'ابدأ وجبتك بالبروتين، وبعدين كمّل الباقي.' },
    { icon: '🏋️', title: 'ولا تمرين بيتفوّت', kind: 'build', days: 30, identity: 'أنا شخص ما بيفوّت تمرينه', plan: 'بتمرن بنفس الساعة كل يوم، وشنطتي جاهزة من الليل', tip: 'جهّز شنطة الجيم من الليلة يلي قبل وحطها جنب الباب.' },
    { icon: '😴', title: '7 ساعات نوم', kind: 'build', days: 21, identity: 'أنا شخص بيحترم نومه', plan: 'الساعة 11 بحط الموبايل برا غرفة النوم', tip: 'خلّي غرفة النوم للنوم بس: الموبايل بيشحن برا.' },
    { icon: '🥗', title: 'خضار بكل وجبة', kind: 'build', days: 21, identity: 'أنا شخص بياكل أكل حقيقي', plan: 'نص صحني دايماً خضار', tip: 'اغسل وقطّع الخضار مرة بالأسبوع لتكون جاهزة.' }
  ];
  var CH_DURATIONS = { 7: '7', 14: '14', 21: '21', 30: '30', 60: '60', 90: '90' };
  var CH_ICONS = ['🎯', '🍬', '🍞', '🥤', '🍔', '🌙', '🍫', '👟', '💧', '🥩', '🏋️', '😴', '🥗', '🚭', '☕', '📵', '📖', '🧘'];
  var HABIT_LAWS = [
    ['👀', 'خلّيها واضحة', 'حدّد متى ووين: "رح أعمل كذا، الساعة كذا، بمكان كذا". وللعادة السيئة: خلّيها مخفية.'],
    ['✨', 'خلّيها جذابة', 'اربطها بشي بتحبه، ومحيطك بيفرق: كون مع ناس العادة الجديدة طبيعية عندهم.'],
    ['⚡', 'خلّيها سهلة', 'قاعدة الدقيقتين: ابدأ بنسخة صغيرة كتير. وللعادة السيئة: صعّبها وزيد العقبات.'],
    ['🏆', 'خلّيها مُرضية', 'كل ✅ هون مكافأة فورية. لا تكسر السلسلة، وإذا كسرتها لا تفوّت مرتين.']
  ];

  function chList() { S.challenges = S.challenges || []; return S.challenges; }
  function chEnd(c) { return addDays(c.start, c.days - 1); }
  function chActive(c, date) { date = date || todayStr(); return !c.archived && date >= c.start && date <= chEnd(c); }
  function chDayNum(c, date) { return daysBetween(c.start, date || todayStr()) + 1; }
  function chStats(c) {
    var today = todayStr(), last = today < chEnd(c) ? today : chEnd(c);
    var elapsed = Math.max(0, daysBetween(c.start, last) + 1), wins = 0, best = 0, run = 0, d;
    for (var i = 0; i < elapsed; i++) {
      d = addDays(c.start, i);
      if (c.log[d] === 1) { wins++; run++; best = Math.max(best, run); } else if (c.log[d] === 0 || d < today) run = 0;
    }
    var streakNow = 0; d = last;
    if (c.log[d] !== 1 && c.log[d] !== 0) d = addDays(d, -1);
    while (d >= c.start && c.log[d] === 1) { streakNow++; d = addDays(d, -1); }
    var y = addDays(today, -1);
    var missedYesterday = y >= c.start && c.log[y] !== 1 && today <= chEnd(c);
    return { elapsed: elapsed, wins: wins, rate: elapsed ? Math.round(wins / elapsed * 100) : 0, best: best, streak: streakNow, done: today > chEnd(c), left: Math.max(0, daysBetween(today, chEnd(c))), missedYesterday: missedYesterday };
  }
  function chChain(c, small) {
    var today = todayStr(), cells = '';
    for (var i = 0; i < c.days; i++) {
      var d = addDays(c.start, i), v = c.log[d];
      var cls = v === 1 ? 'win' : v === 0 ? 'miss' : d < today ? 'skip' : d === today ? 'now' : '';
      cells += '<i class="' + cls + '" title="' + fmtDate(d) + '"></i>';
    }
    return '<div class="chain' + (small ? ' sm' : '') + '" style="--n:' + Math.min(c.days, small ? 15 : 10) + '">' + cells + '</div>';
  }

  // Today card: quick yes/no per active challenge for the date being edited.
  function chTodayCard(date) {
    var act = chList().filter(function (c) { return chActive(c, date); });
    if (!act.length) return '<button class="card chcta" data-tab="challenges"><span>🎯</span><div><b>ابدأ تحدّي جديد</b><small>شهر بدون سكر؟ بدون خبز أبيض؟ اختار تحدّيك وتابعه كل يوم.</small></div></button>';
    return '<section class="card" id="chToday"><h3><span>🎯 تحدّياتك اليوم</span><span class="sub">التزمت؟</span></h3><div class="list">' +
      act.map(function (c) {
        var v = c.log[date];
        return '<div class="chrow"><div class="chname"><span class="chic">' + c.icon + '</span><div><b>' + esc(c.title) + '</b><small>اليوم ' + num(chDayNum(c, date)) + ' من ' + num(c.days) + '</small></div></div>' +
          '<div class="yn"><button type="button" class="' + (v === 1 ? 'on yes' : '') + '" data-act="chMark" data-id="' + c.id + '" data-d="' + date + '" data-v="1">✓</button>' +
          '<button type="button" class="' + (v === 0 ? 'on no' : '') + '" data-act="chMark" data-id="' + c.id + '" data-d="' + date + '" data-v="0">✗</button></div></div>';
      }).join('') + '</div></section>';
  }
  function chReportLines(date) {
    var act = chList().filter(function (c) { return chActive(c, date); });
    if (!act.length) return [];
    return ['🎯 التحديات:'].concat(act.map(function (c) {
      var v = c.log[date];
      return '• ' + c.title + ' (يوم ' + chDayNum(c, date) + '/' + c.days + '): ' + (v === 1 ? '✅' : v === 0 ? '❌' : 'غير مسجّل');
    }));
  }
  function chPeriodLines(ds) {
    var from = ds[0], to = ds[ds.length - 1];
    var cs = chList().filter(function (c) { return !c.archived && c.start <= to && chEnd(c) >= from; });
    if (!cs.length) return [];
    return ['🎯 التحديات:'].concat(cs.map(function (c) {
      var inRange = ds.filter(function (d) { return d >= c.start && d <= chEnd(c) && d <= todayStr(); });
      var wins = inRange.filter(function (d) { return c.log[d] === 1; }).length;
      return '• ' + c.title + ': ' + wins + '/' + inRange.length + ' يوم' + (todayStr() > chEnd(c) ? ' (خلص التحدي)' : ' · يوم ' + Math.min(chDayNum(c), c.days) + '/' + c.days);
    }));
  }

  function challengesView(page) {
    var cs = chList().filter(function (c) { return !c.archived; });
    var active = cs.filter(function (c) { return todayStr() <= chEnd(c); });
    var done = cs.filter(function (c) { return todayStr() > chEnd(c); });
    page.innerHTML =
      '<section class="hero" style="min-height:190px"><div class="hero-bg outdoor"></div><div class="hero-c"><span class="pill">1% أحسن كل يوم</span><h2>التحديات</h2><div class="hi">العادات الصغيرة بتعمل نتائج كبيرة</div></div></section>' +
      '<button class="btn" data-act="chNew">+ تحدّي جديد</button>' +
      (active.length ? active.map(chCard).join('') : '<div class="card empty">ما عندك تحدّي شغّال. اختار تحدّي جاهز أو اعمل تحدّي خاص فيك.</div>') +
      (done.length ? '<section class="card"><h3>تحديات خلصت 🏁</h3><div class="list">' + done.map(function (c) {
        var s = chStats(c);
        return '<button class="li dayrow" data-act="chOpen" data-id="' + c.id + '"><div><div class="v">' + c.icon + ' ' + esc(c.title) + '</div><div class="d">' + fmtDate(c.start) + ' · ' + num(c.days) + ' يوم</div></div><span class="score ' + scoreClass(s.rate) + '">' + num(s.rate + '%') + '</span></button>';
      }).join('') + '</div></section>' : '') +
      '<section class="card"><h3>📘 قوانين العادات الأربعة <span class="sub">من كتاب العادات الذرية</span></h3><div class="laws">' +
      HABIT_LAWS.map(function (l) { return '<div class="law"><span>' + l[0] + '</span><div><b>' + l[1] + '</b><small>' + l[2] + '</small></div></div>'; }).join('') +
      '</div><p class="muted" style="font-size:12px;margin:10px 0 0">مستوحاة من كتاب "العادات الذرية" لجيمس كلير.</p></section>';
  }
  function chCard(c) {
    var s = chStats(c), today = todayStr(), started = today >= c.start, v = c.log[today];
    return '<section class="card chcard">' +
      '<button class="chhead" data-act="chOpen" data-id="' + c.id + '"><span class="chic big">' + c.icon + '</span><div><b>' + esc(c.title) + '</b><small>' +
      (started ? 'اليوم ' + num(chDayNum(c)) + ' من ' + num(c.days) + ' · باقي ' + num(s.left) + ' يوم' : 'بيبلش ' + fmtDate(c.start)) + '</small></div><span class="streak">🔥 ' + num(s.streak) + '</span></button>' +
      (s.missedYesterday && started ? '<div class="warn">⚠️ فوّتت مبارح. القاعدة الذهبية: <b>لا تفوّت مرتين</b>. اليوم بترجع عالطريق.</div>' : '') +
      chChain(c) +
      '<div class="chstats"><span>نسبة الالتزام <b>' + num(s.rate + '%') + '</b></span><span>أطول سلسلة <b>' + num(s.best) + '</b></span><span>أيام ناجحة <b>' + num(s.wins) + '</b></span></div>' +
      (started ? '<div class="yn wide"><button type="button" class="' + (v === 1 ? 'on yes' : '') + '" data-act="chMark" data-id="' + c.id + '" data-d="' + today + '" data-v="1">✓ التزمت اليوم</button>' +
        '<button type="button" class="' + (v === 0 ? 'on no' : '') + '" data-act="chMark" data-id="' + c.id + '" data-d="' + today + '" data-v="0">✗ ما التزمت</button></div>' : '') +
      '</section>';
  }

  function chForm(p) {
    p = p || {};
    openSheet('<h2>' + (p.id ? 'تعديل التحدي' : 'تحدّي جديد') + '</h2><form class="form" id="chf">' +
      '<div class="field"><label>الأيقونة</label><div class="chips icons" data-chips="icon">' + CH_ICONS.map(function (i) { return chip(i, i, i === (p.icon || '🎯')); }).join('') + '</div></div>' +
      field('اسم التحدي', '<input name="title" required maxlength="40" value="' + esc(p.title || '') + '" placeholder="مثلاً: شهر بدون سكر">') +
      '<div class="field"><label>نوع التحدي</label>' + chips('kind', { quit: 'بدّي أترك عادة', build: 'بدّي أبني عادة' }, p.kind || 'quit') + '</div>' +
      '<div class="field"><label>المدة (أيام)</label>' + chips('days', CH_DURATIONS, p.days || 30) + '</div>' +
      field('هويتك الجديدة', '<input name="identity" maxlength="80" value="' + esc(p.identity || '') + '" placeholder="أنا شخص ...">') +
      '<p class="hint">💡 كل مرة بتلتزم، عم تعطي صوت للشخص يلي بدك تصيره. ركّز على مين بدك تكون، مش بس على النتيجة.</p>' +
      field('خطتك: إمتى ووين وكيف؟', '<textarea name="plan" rows="2" maxlength="160" placeholder="لما ... رح ...">' + esc(p.plan || '') + '</textarea>') +
      '<p class="hint">💡 الناس يلي بيكتبوا خطة واضحة (رح أعمل كذا، إمتى، ووين) احتمال التزامهم أعلى بكتير.</p>' +
      field('تاريخ البداية', '<input name="start" type="date" required value="' + (p.start || todayStr()) + '">') +
      '<button class="btn" type="submit">' + (p.id ? 'حفظ' : 'ابدأ التحدي 🚀') + '</button></form>', function (b) {
      var f = $('#chf', b); bindChips(f);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = { icon: chipVal(f, 'icon') || '🎯', title: f.title.value.trim(), kind: chipVal(f, 'kind') || 'quit', days: +(chipVal(f, 'days') || 30), identity: f.identity.value.trim(), plan: f.plan.value.trim(), start: f.start.value || todayStr(), tip: p.tip || '' };
        if (!data.title) return;
        if (p.id) { var c = chList().filter(function (x) { return x.id === p.id; })[0]; Object.assign(c, data); }
        else chList().push(Object.assign({ id: Date.now().toString(36), log: {} }, data));
        save(); closeSheet(); tab = 'challenges'; render(); toast(p.id ? 'تم الحفظ ✅' : 'بلّش التحدي! 💪');
      });
    });
  }
  function chById(id) { return chList().filter(function (x) { return x.id === id; })[0]; }

  var CH_ACTIONS = {
    chNew: function () {
      openSheet('<h2>اختار تحدّي</h2><div class="presets">' +
        CH_PRESETS.map(function (p, i) { return '<button class="preset" data-act="chPreset" data-i="' + i + '"><span>' + p.icon + '</span><b>' + p.title + '</b><small>' + p.days + ' يوم</small></button>'; }).join('') +
        '<button class="preset custom" data-act="chCustom"><span>✍️</span><b>تحدّي خاص فيك</b><small>اكتبه بنفسك</small></button></div>');
    },
    chPreset: function (el) { var p = CH_PRESETS[+el.getAttribute('data-i')]; chForm({ icon: p.icon, title: p.title, kind: p.kind, days: p.days, identity: p.identity, plan: p.plan, tip: p.tip }); },
    chCustom: function () { chForm({}); },
    chMark: function (el) {
      var c = chById(el.getAttribute('data-id')); if (!c) return;
      var d = el.getAttribute('data-d'), v = +el.getAttribute('data-v');
      if (c.log[d] === v) delete c.log[d]; else c.log[d] = v;
      save();
      var s = chStats(c);
      if (c.log[d] === 1) toast(s.streak > 1 && s.streak % 7 === 0 ? '🔥 ' + s.streak + ' يوم ورا بعض! كمّل' : 'صوت جديد لهويتك الجديدة ✅');
      else if (c.log[d] === 0) toast('مش مشكلة. المهم لا تفوّت مرتين 💪');
      if (d === chEnd(c) && c.log[d] === 1) toast('🏁 خلّصت التحدي! نسبة التزامك ' + s.rate + '%');
      if (tab === 'today' && $('#chToday')) { $('#chToday').outerHTML = chTodayCard(d); return; }
      var y = window.scrollY; render(); window.scrollTo(0, y);
    },
    chOpen: function (el) {
      var c = chById(el.getAttribute('data-id')); if (!c) return;
      var s = chStats(c);
      openSheet('<h2>' + c.icon + ' ' + esc(c.title) + '</h2>' +
        '<div class="chstats big"><span>نسبة الالتزام<b>' + num(s.rate + '%') + '</b></span><span>السلسلة الحالية<b>' + num(s.streak) + '</b></span><span>أطول سلسلة<b>' + num(s.best) + '</b></span></div>' +
        chChain(c) +
        '<p class="muted" style="font-size:12px;margin:6px 0 12px">من ' + fmtDate(c.start) + ' إلى ' + fmtDate(chEnd(c)) + ' · 🟩 التزمت · 🟥 ما التزمت · ⬛ ما سجّلت</p>' +
        (c.identity ? '<div class="idbox"><small>هويتك</small><b>' + esc(c.identity) + '</b></div>' : '') +
        (c.plan ? '<div class="idbox"><small>خطتك</small><b>' + esc(c.plan) + '</b></div>' : '') +
        (c.tip ? '<div class="idbox tip"><small>نصيحة</small><b>' + esc(c.tip) + '</b></div>' : '') +
        '<div class="actions2"><button class="btn ghost" data-act="chEdit" data-id="' + c.id + '">تعديل</button><button class="btn ghost" data-act="chShare" data-id="' + c.id + '">ابعت للكوتش</button></div>' +
        '<button class="btn danger" data-act="chDelete" data-id="' + c.id + '">حذف التحدي</button>');
    },
    chEdit: function (el) { var c = chById(el.getAttribute('data-id')); if (c) chForm(c); },
    chShare: function (el) {
      var c = chById(el.getAttribute('data-id')); if (!c) return; var s = chStats(c);
      openExternal(waLink(['🎯 تحدّي: ' + c.title, '👤 ' + S.profile.name, '📅 اليوم ' + Math.min(chDayNum(c), c.days) + ' من ' + c.days, '✅ أيام ناجحة: ' + s.wins + '/' + s.elapsed + ' (' + s.rate + '%)', '🔥 السلسلة الحالية: ' + s.streak + ' · الأطول: ' + s.best, c.identity ? '🪪 ' + c.identity : ''].filter(Boolean).join('\n')));
    },
    chDelete: function (el) {
      if (!confirm('حذف التحدي وكل سجله؟')) return;
      var id = el.getAttribute('data-id'); S.challenges = chList().filter(function (x) { return x.id !== id; }); save(); closeSheet(); render();
    }
  };

  var ACTIONS = {
    editDay: function (el) { editDate = el.getAttribute('data-d'); tab = 'today'; render(); window.scrollTo(0, 0); },
    sendWa: function () {
      var t = currentReport(); if (!t) return toast('سجّل هاد اليوم أول');
      openExternal(waLink(t));
    },
    copyReport: function () {
      var t = currentReport(); if (!t) return toast('ما في تقرير لهاد اليوم');
      var done = function () { toast('تم النسخ ✅'); };
      var fallback = function () { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
    },
    settings: function () {
      var p = S.profile;
      openSheet('<h2>الإعدادات</h2><form class="form" id="sf">' +
        field('الاسم', '<input name="name" required value="' + esc(p.name) + '">') +
        '<div class="field"><label>الهدف</label>' + chips('goal', GOALS, p.goal) + '</div>' +
        '<div class="row2">' + field('هدف الماء (لتر)', '<input name="waterTarget" type="number" step="0.5" min="1" max="6" required value="' + p.waterTarget + '">') +
        field('الباقة', '<select name="plan">' + Object.keys(PLANS).map(function (k) { return '<option value="' + k + '"' + (k === p.plan ? ' selected' : '') + '>' + PLANS[k] + '</option>'; }).join('') + '</select>') + '</div>' +
        '<button class="btn" type="submit">حفظ</button>' +
        '<div class="actions2"><button class="btn ghost" type="button" data-act="export">نسخة احتياطية</button><button class="btn ghost" type="button" data-act="import">استرجاع نسخة</button></div>' +
        '<button class="btn ghost" type="button" data-act="contact">تواصل مع الكوتش جورج</button>' +
        '<button class="btn danger" type="button" data-act="reset">مسح كل البيانات</button>' +
        '<p class="muted" style="margin:0;font-size:12px;text-align:center">بياناتك محفوظة على هاد الجهاز فقط.<br>GM Progress v1.2 · George Mousa Online Coaching</p></form>', function (b) {
        var f = $('#sf', b); bindChips(f);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          p.name = f.name.value.trim(); p.goal = chipVal(f, 'goal') || p.goal; p.waterTarget = parseFloat(f.waterTarget.value) || 3; p.plan = f.plan.value;
          save(); closeSheet(); render(); toast('تم الحفظ ✅');
        });
      });
    },
    contact: function () { openExternal(waLink('مرحبا كوتش جورج، أنا ' + (S.profile ? S.profile.name : '') + ' من تطبيق GM Progress')); },
    export: function () { downloadText('GM_Progress_' + todayStr() + '.json', JSON.stringify({ app: 'gm-progress', v: 2, exported: new Date().toISOString(), state: S })); },
    import: function () {
      pickFile('application/json,.json', function (file) {
        if (!file) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var d = JSON.parse(r.result); if (!d || d.app !== 'gm-progress' || !d.state || !d.state.days) throw 0;
            S = Object.assign(blank(), d.state); save(); closeSheet(); tab = 'today'; render(); toast('تم استرجاع بياناتك ✅');
          } catch (e) { toast('الملف غير صالح'); }
        };
        r.readAsText(file);
      });
    },
    reset: function () {
      if (!confirm('متأكد؟ رح ينمسح كل سجلك.')) return;
      S = blank(); save(); closeSheet(); render();
    }
  };

  Object.assign(ACTIONS, CH_ACTIONS);

  // Android hardware back button: close sheet first, then go back to the Today tab.
  window.gmBack = function () {
    if (!$('#sheet').hidden) { closeSheet(); return true; }
    if (S.profile && (tab !== 'today' || editDate !== todayStr())) { tab = 'today'; editDate = todayStr(); render(); return true; }
    return false;
  };

  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !IS_ANDROID_APP) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
