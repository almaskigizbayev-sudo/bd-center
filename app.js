/* BD COMMAND CENTER — PWA client. Vanilla JS, no build step. */
'use strict';

/* =================== state =================== */
const LS = {
  get: (k, d = null) => { try { const v = localStorage.getItem('bd_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem('bd_' + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
  del: (k) => { try { localStorage.removeItem('bd_' + k); } catch (e) { /* ignore */ } },
};
const S = {
  api: LS.get('api') || window.BD_API_URL || '',
  token: LS.get('token') || '',
  meta: LS.get('meta'),
  dir: LS.get('dir') || '',
  theme: LS.get('theme') || 'auto',
  refCache: {},
};

/* =================== navigation model =================== */
const DIR_SHORT = { FDY: 'Литейка', AGR: 'Агро', WHL: 'Склады', WLF: 'Федерация' };
const DIR_VAR = { FDY: 'var(--fdy)', AGR: 'var(--agr)', WHL: 'var(--whl)', WLF: 'var(--wlf)' };
const NAV = [
  { title: null, items: [['Tasks', 'Задачи'], ['Meetings', 'Встречи'], ['Agreements', 'Договорённости'], ['Opportunities', 'Сделки'], ['Projects', 'Проекты']] },
  { title: 'База', items: [['Companies', 'Компании'], ['Contacts', 'Контакты'], ['Customers', 'Заказчики'], ['Suppliers', 'Поставщики'], ['Documents', 'Документы'], ['Notes', 'Заметки']] },
  { dir: 'FDY', title: 'Литейный завод', items: [['F_RFQ', 'Запросы RFQ'], ['F_Quotes', 'Коммерческие предложения'], ['F_Costing', 'Расчёты'], ['F_Orders', 'Заказы'], ['F_Products', 'Номенклатура'], ['F_Capacity', 'Мощности']] },
  { dir: 'AGR', title: 'Агробизнес', items: [['A_Assets', 'Активы'], ['A_Deals', 'Закупки и продажи'], ['A_Finance', 'Финансы']] },
  { dir: 'WHL', title: 'Склады и логистика', items: [['W_Facilities', 'Склады'], ['W_Units', 'Блоки'], ['W_Leases', 'Аренда'], ['W_Requests', 'Запросы площади'], ['W_Opex', 'Расходы'], ['W_Routes', 'Маршруты']] },
  { dir: 'WLF', title: 'Федерация', items: [['S_Events', 'Календарь событий'], ['S_Athletes', 'Спортсмены'], ['S_Coaches', 'Тренеры'], ['S_Clubs', 'Клубы и школы'], ['S_Results', 'Результаты'], ['S_Sponsorships', 'Спонсоры'], ['S_Budget', 'Бюджет'], ['S_Media', 'Медиаплан']] },
];
const TNAME = {}; const TDIR = {};
NAV.forEach(g => g.items.forEach(([t, n]) => { TNAME[t] = n; if (g.dir) TDIR[t] = g.dir; }));

const ONE = { Tasks: 'задачу', Meetings: 'встречу', Agreements: 'договорённость', Opportunities: 'сделку', Projects: 'проект', Companies: 'компанию', Contacts: 'контакт', Notes: 'заметку', Documents: 'документ', Customers: 'заказчика', Suppliers: 'поставщика',
  F_RFQ: 'запрос RFQ', F_Quotes: 'КП', F_Costing: 'расчёт', F_Orders: 'заказ', F_Products: 'позицию', F_Capacity: 'мощность',
  A_Assets: 'актив', A_Deals: 'сделку купли-продажи', A_Finance: 'показатель', W_Facilities: 'склад', W_Units: 'блок', W_Leases: 'договор аренды',
  W_Requests: 'запрос площади', W_Opex: 'расход', W_Routes: 'маршрут', S_Events: 'событие', S_Athletes: 'спортсмена', S_Coaches: 'тренера',
  S_Clubs: 'клуб', S_Results: 'результат', S_Sponsorships: 'спонсорство', S_Budget: 'статью бюджета', S_Media: 'публикацию' };

const LIST_COLS = {
  Tasks: ['title', 'due_at', 'priority', 'company_id', 'status'],
  Meetings: ['title', 'start_at', 'company_id', 'status'],
  Agreements: ['description', 'who_owes', 'due_at', 'company_id', 'status'],
  Opportunities: ['title', 'company_id', 'stage', 'amount', 'status'],
  Projects: ['name', 'priority', 'due_date', 'health', 'status'],
  Companies: ['name', 'country', 'industry', 'roles', 'status'],
  Contacts: ['full_name', 'position', 'company_id', 'phone', 'status'],
  F_Quotes: ['quote_number', 'company_id', 'sent_at', 'total_amount', 'status'],
  W_Facilities: ['name', 'city', 'usable_area_m2', 'wh_class', 'status'],
  S_Athletes: ['full_name', 'weight_category', 'region', 'sport_rank', 'status'],
  S_Events: ['name', 'start_date', 'level', 'city', 'status'],
};
const LIST_SORT = { Tasks: 'due_at', Meetings: '-start_at', Agreements: 'due_at', S_Events: 'start_date', Companies: 'name', Contacts: 'full_name' };
const LABEL_FIELDS = ['name', 'title', 'full_name', 'quote_number', 'item_name', 'description', 'body', 'period'];
const HIDDEN_IN_FORM = new Set(['id', 'created_at', 'updated_at', 'rev', 'deleted_at', 'source', 'name_norm', 'owner',
  'drive_folder_id', 'last_touch_at', 'calendar_event_id', 'reminder_sent_at', 'protocol_doc_id', 'athletes_count',
  'best_total_kg', 'followup_count', 'followup_due_at']);
const FIELD_LABELS = { priority: 'Приоритет', decision_role: 'Роль в решении', task_type: 'Тип', meeting_type: 'Тип встречи', who_owes: 'Кто должен выполнить',
  verification: 'Данные проверены', health: 'Состояние', doc_type: 'Тип документа', asset_type: 'Тип актива', deal_side: 'Покупка или продажа', flow: 'Доход или расход',
  wh_class: 'Класс', wh_type: 'Тип склада', temp_mode: 'Режим', mode: 'Вид транспорта', club_type: 'Тип', gender: 'Пол', event_type: 'Тип события', level: 'Уровень',
  medal: 'Медаль', funding_source: 'Источник финансирования', channel: 'Канал', format: 'Формат', payment_status: 'Оплата', roles: 'Роли', rating: 'Оценка',
  sport_rank: 'Разряд', industry: 'Отрасль', code: 'Код', id: 'ID', created_at: 'Создано', updated_at: 'Изменено', status: 'Статус', direction: 'Направление', owner: 'Ответственный', source: 'Источник', rev: 'Версия', deleted_at: 'В архиве с' };
const DONE_STATUS = new Set(['done', 'cancelled', 'fulfilled', 'won', 'lost', 'closed', 'archived', 'delivered', 'published']);
const TONE = {
  ok: ['done', 'won', 'active', 'signed', 'paid', 'fulfilled', 'accepted', 'delivered', 'published', 'official', 'operating', 'confirmed', 'approved', 'qualified', 'green', 'occupied'],
  warn: ['waiting', 'on_hold', 'negotiation', 'expiring', 'reserved', 'yellow', 'clarifying', 'costing', 'in_progress', 'rescheduled', 'injured', 'maintenance'],
  crit: ['lost', 'broken', 'overdue', 'cancelled', 'rejected', 'failed', 'expired', 'declined', 'red', 'blocked', 'terminated', 'disqualified', 'do_not_contact'],
};
const STATUS_RU = {
  active: 'Активна', prospect: 'Потенциальная', inactive: 'Неактивна', archived: 'В архиве', left_company: 'Ушёл из компании', do_not_contact: 'Не беспокоить',
  idea: 'Идея', planning: 'Планирование', on_hold: 'На паузе', done: 'Готово', cancelled: 'Отменено', todo: 'К выполнению', in_progress: 'В работе', waiting: 'Ждём',
  planned: 'Запланировано', confirmed: 'Подтверждено', rescheduled: 'Перенесено', open: 'Открыто', fulfilled: 'Выполнено', overdue: 'Просрочено', broken: 'Нарушено',
  won: 'Выиграно', lost: 'Проиграно', qualified: 'Квалифицирован', candidate: 'Кандидат', blocked: 'Заблокирован', first_contact: 'Первый контакт',
  draft: 'Черновик', final: 'Финальный', sent: 'Отправлено', signed: 'Подписано', superseded: 'Заменён', new: 'Новый', clarifying: 'Уточнение', costing: 'Расчёт',
  quoted: 'КП отправлено', no_bid: 'Не участвуем', approved: 'Утверждено', negotiation: 'Переговоры', accepted: 'Принято', rejected: 'Отклонено', expired: 'Истекло',
  contracted: 'Договор', in_production: 'В производстве', ready: 'Готов', shipped: 'Отгружен', delivered: 'Доставлен', closed: 'Закрыт', plan: 'План', actual: 'Факт',
  development: 'В разработке', discontinued: 'Снято', owned: 'В собственности', leased: 'В аренде', sold: 'Продано', agreed: 'Согласовано', in_delivery: 'Поставка',
  operating: 'Работает', construction: 'Строится', for_sale: 'Продаётся', free: 'Свободен', reserved: 'Бронь', occupied: 'Занят', maintenance: 'Ремонт',
  expiring: 'Истекает', terminated: 'Расторгнут', matching: 'Подбор', offered: 'Предложено', viewing: 'Просмотр', quoted_rate: 'Котировка',
  injured: 'Травма', retired: 'Завершил карьеру', in_production_media: 'В работе', official: 'Официальный', unofficial: 'Неофициальный', disqualified: 'Дисквалификация',
  proposal: 'Предложение', ended: 'Завершено', declined: 'Отказ', published: 'Опубликовано',
};

/* =================== utils =================== */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const ICON = {
  search: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  menu: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4 10-10"/></svg>',
  cal: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  org: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V7l6-3v17M10 9h10v12M14 13h2M14 17h2M6 11h1M6 15h1"/></svg>',
};

function fieldDef(table, name) { return S.meta.schema[table].fields.find(f => f.name === name); }
function fieldLabel(table, name) {
  if (FIELD_LABELS[name]) return FIELD_LABELS[name];
  const f = fieldDef(table, name); if (!f) return name;
  if (table === 'S_Athletes' && name === 'national_team') return 'Сборная';
  return f.desc.split(/\s[(—]|,\s|:\s/)[0].trim();
}
function labelOf(rec) { for (const f of LABEL_FIELDS) if (rec[f] !== '' && rec[f] !== undefined && rec[f] !== null) return String(rec[f]); return rec.id; }
function refLabel(code, list, direction) {
  const items = (S.meta.reference[list] || []);
  const it = items.find(x => x.code === String(code) && (!direction || !x.direction || x.direction === direction)) || items.find(x => x.code === String(code));
  return it ? it.label : code;
}
function tone(status) { for (const k of Object.keys(TONE)) if (TONE[k].includes(status)) return k; return ''; }
function statusPill(s) { return s ? `<span class="pill ${tone(s)}">${esc(STATUS_RU[s] || s)}</span>` : ''; }
function firstDir(rec, table) { return TDIR[table] || String(rec.direction || '').split(',')[0].trim(); }

const fmtNum = (n) => (n === '' || n === null || n === undefined) ? '' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(n));
function fmtDate(v, withTime) {
  if (!v) return '';
  const d = new Date(v); if (isNaN(d)) return String(v);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  if (!withTime) return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric', timeZone: 'UTC' });
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric', hour: '2-digit', minute: '2-digit' });
}
function isLate(rec, field) {
  const v = rec[field]; if (!v || DONE_STATUS.has(rec.status)) return false;
  return new Date(v).getTime() < Date.now();
}

/** Value → display HTML for a field */
function displayValue(table, name, rec, labels, opts = {}) {
  const v = rec[name]; if (v === '' || v === null || v === undefined) return '';
  const f = fieldDef(table, name); const type = f ? f.type : 'text';
  const dir = firstDir(rec, table);
  if (name === 'status') return statusPill(v);
  if (name === 'direction') return String(v).split(',').filter(Boolean).map(c => `<span class="chip"><span class="dot" style="background:${DIR_VAR[c.trim()] || 'var(--ink-3)'}"></span>${esc(DIR_SHORT[c.trim()] || c)}</span>`).join('');
  if (type === 'date') return esc(fmtDate(v, false));
  if (type === 'datetime') return esc(fmtDate(v, true));
  if (type === 'money') return esc(fmtNum(v) + (rec.currency ? ' ' + rec.currency : ''));
  if (type === 'percent') return esc(fmtNum(v) + '%');
  if (type === 'number') return esc(fmtNum(v));
  if (type === 'bool') return (v === true || v === 'true') ? 'Да' : 'Нет';
  if (type === 'url') return opts.plain ? esc(v) : `<a href="${esc(/^https?:/i.test(v) ? v : 'https://' + v)}" target="_blank" rel="noopener">${esc(v)}</a>`;
  if (type === 'email') return opts.plain ? esc(v) : `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
  if (type === 'phone') return opts.plain ? esc(v) : `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}">${esc(v)}</a>`;
  let m = type.match(/^(enum|multi):(.+)$/);
  if (m) return esc(String(v).split(',').map(c => refLabel(c.trim(), m[2], dir)).join(', '));
  m = type.match(/^refs?:(.+)$/);
  if (m) {
    const map = (labels && labels[name]) || {};
    return String(v).split(',').map(id => id.trim()).filter(Boolean).map(id =>
      opts.plain ? esc(map[id] || id) : `<a href="#/r/${m[1]}/${encodeURIComponent(id)}" data-open="${m[1]}|${esc(id)}">${esc(map[id] || id)}</a>`).join(', ');
  }
  return esc(v);
}

/* =================== API =================== */
class ApiError extends Error { constructor(code, msg, details) { super(msg); this.code = code; this.details = details; } }
async function api(action, payload = {}) {
  if (!S.api) throw new ApiError('NO_API', 'Не указан адрес сервера');
  let res;
  try {
    res = await fetch(S.api, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload, token: S.token }) });
  } catch (e) {
    throw new ApiError('NETWORK', navigator.onLine ? 'Сервер не отвечает. Проверьте адрес сервера в настройках.' : 'Нет сети. Показаны последние сохранённые данные.');
  }
  let body;
  try { body = await res.json(); } catch (e) { throw new ApiError('BAD_RESPONSE', 'Сервер вернул не JSON. Проверьте, что адрес заканчивается на /exec и доступ к веб-приложению: «Все».'); }
  if (!body.ok) {
    const err = body.error || {};
    if (err.code === 'AUTH_REQUIRED' && action !== 'auth.verify') { S.token = ''; LS.del('token'); renderLogin(err.message); }
    throw new ApiError(err.code || 'ERROR', err.message || 'Ошибка', err.details);
  }
  return body.data;
}

async function loadMeta(force) {
  if (S.meta && !force) { api('meta.get').then(m => { S.meta = m; LS.set('meta', m); }).catch(() => {}); return S.meta; }
  S.meta = await api('meta.get'); LS.set('meta', S.meta); return S.meta;
}

/* =================== toast =================== */
let toastTimer;
function toast(msg, kind) {
  let el = $('.toast'); if (!el) { el = h('<div class="toast" role="status" aria-live="polite"></div>'); document.body.append(el); }
  el.className = 'toast' + (kind ? ' ' + kind : ''); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'crit' ? 6000 : 2600);
}

/* =================== theme =================== */
function applyTheme() {
  if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', S.theme);
  const dark = S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#0A0B0C' : '#24272C'));
}

/* =================== login =================== */
const brandMark = `<span class="brand-mark" aria-hidden="true"><i style="background:#8E96A3"></i><i style="background:#6E9A5B"></i><i style="background:#7088B5"></i><i style="background:#B07A63"></i></span>`;

function renderLogin(message) {
  const root = $('#root');
  const deviceGuess = /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : /Mac/.test(navigator.userAgent) ? 'MacBook' : 'Компьютер';
  const step = S.api ? 'request' : 'server';
  root.innerHTML = `
  <main class="login">
    <div class="login-card">
      <div class="brand">${brandMark}<span class="brand-name">BD Command Center</span></div>
      <div id="login-step"></div>
    </div>
  </main>`;
  const box = $('#login-step');

  const showServer = (err) => {
    box.innerHTML = `
      <h1>Подключение к серверу</h1>
      <p>Вставьте адрес веб-приложения Apps Script. Он заканчивается на <b>/exec</b>.</p>
      ${err ? `<div class="notice crit">${esc(err)}</div>` : ''}
      <form class="form" id="f-server">
        <input class="input" name="url" type="url" required placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.api)}" autocomplete="off">
        <button class="btn btn-primary" type="submit">Подключиться</button>
      </form>`;
    $('#f-server').onsubmit = async (e) => {
      e.preventDefault();
      const url = e.target.url.value.trim();
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(url)) return showServer('Адрес должен начинаться с https://script.google.com/ и заканчиваться на /exec');
      S.api = url; LS.set('api', url); showRequest();
    };
  };
  const showRequest = (err) => {
    box.innerHTML = `
      <h1>Вход</h1>
      <p>Код придёт на почту владельца системы. Пароль не нужен.</p>
      ${err || message ? `<div class="notice ${err ? 'crit' : ''}">${esc(err || message)}</div>` : ''}
      <form class="form" id="f-req">
        <button class="btn btn-primary" type="submit">Получить код на почту</button>
        <button class="btn btn-ghost" type="button" id="b-server">Изменить адрес сервера</button>
      </form>`;
    message = '';
    $('#b-server').onclick = () => showServer();
    $('#f-req').onsubmit = async (e) => {
      e.preventDefault(); const b = e.submitter || e.target.querySelector('button'); b.disabled = true; b.textContent = 'Отправляю…';
      try { const r = await api('auth.requestCode'); showVerify(r.sentTo); }
      catch (er) { showRequest(er.message); }
    };
  };
  const showVerify = (sentTo, err) => {
    box.innerHTML = `
      <h1>Введите код</h1>
      <p>Отправили 6 цифр на ${esc(sentTo)}. Код действует 10 минут.</p>
      ${err ? `<div class="notice crit">${esc(err)}</div>` : ''}
      <form class="form" id="f-ver">
        <input class="input code-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" required aria-label="Код из письма">
        <input class="input" name="device" value="${esc(deviceGuess)}" aria-label="Название устройства" maxlength="60">
        <button class="btn btn-primary" type="submit">Войти</button>
        <button class="btn btn-ghost" type="button" id="b-again">Отправить код ещё раз</button>
      </form>`;
    const f = $('#f-ver'); f.code.focus();
    $('#b-again').onclick = () => showRequest();
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('.btn-primary'); b.disabled = true; b.textContent = 'Проверяю…';
      try {
        const r = await api('auth.verify', { code: f.code.value, device: f.device.value });
        S.token = r.token; LS.set('token', r.token);
        await loadMeta(true); renderShell(); route();
      } catch (er) { showVerify(sentTo, er.message); }
    };
  };
  if (step === 'server') showServer(); else showRequest();
}

/* =================== shell =================== */
function renderShell() {
  const root = $('#root');
  const groups = NAV.map(g => `
    <div class="rail-group">
      ${g.title ? `<div class="rail-group-title">${g.dir ? `<span class="dot" style="background:${DIR_VAR[g.dir]}"></span>` : ''}${esc(g.title)}</div>` : ''}
      ${g.items.map(([t, n]) => `<a href="#/t/${t}" data-nav="${t}">${esc(n)}</a>`).join('')}
    </div>`).join('');
  root.innerHTML = `
  <div class="app" id="app">
    <nav class="rail" aria-label="Разделы">
      <div class="brand">${brandMark}<span class="brand-name">BD Command Center</span></div>
      <button class="rail-search" type="button" data-act="search">${ICON.search}<span>Поиск</span><kbd class="hide-mobile">⌘K</kbd></button>
      ${groups}
      <div class="rail-foot"><a href="#/settings" data-nav="settings">Настройки</a></div>
    </nav>
    <div class="main">
      <div class="offline-bar" id="offline" ${navigator.onLine ? 'hidden' : ''}>Нет сети. Видны последние загруженные данные, изменения сохранить нельзя.</div>
      <header class="topbar" id="topbar"></header>
      <main class="content" id="content"></main>
    </div>
    <nav class="tabbar" aria-label="Быстрые разделы">
      <a href="#/t/Tasks" data-nav="Tasks">${ICON.check}Задачи</a>
      <a href="#/t/Meetings" data-nav="Meetings">${ICON.cal}Встречи</a>
      <a href="#/t/Companies" data-nav="Companies">${ICON.org}Компании</a>
      <button type="button" data-act="search">${ICON.search}Поиск</button>
      <button type="button" data-act="menu">${ICON.menu}Меню</button>
    </nav>
  </div>`;
  const app = $('#app');
  app.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act === 'search') openSearch();
    if (a && a.dataset.act === 'menu') app.classList.toggle('nav-open');
    if (e.target.closest('.rail a')) app.classList.remove('nav-open');
    if (app.classList.contains('nav-open') && !e.target.closest('.rail') && !e.target.closest('[data-act="menu"]')) app.classList.remove('nav-open');
  });
}

/* =================== router =================== */
function route() {
  if (!S.token) return renderLogin();
  if (!$('#app')) renderShell();
  const hash = location.hash || '#/t/Tasks';
  const parts = hash.slice(2).split('/').map(decodeURIComponent);
  closeSheet(true);
  let navKey;
  if (parts[0] === 'settings') { navKey = 'settings'; renderSettings(); }
  else if (parts[0] === 'r' && S.meta.schema[parts[1]]) { navKey = parts[1]; renderList(parts[1]); openRecord(parts[1], parts[2], true); }
  else { const t = S.meta.schema[parts[1]] ? parts[1] : 'Tasks'; navKey = t; renderList(t); }
  document.querySelectorAll('[data-nav]').forEach(a => a.removeAttribute('aria-current'));
  document.querySelectorAll(`[data-nav="${navKey}"]`).forEach(a => a.setAttribute('aria-current', 'page'));
}
window.addEventListener('hashchange', route);

/* =================== list =================== */
let listReq = 0;
function listCols(table) {
  if (LIST_COLS[table]) return LIST_COLS[table];
  const fields = S.meta.schema[table].fields.map(f => f.name);
  const primary = LABEL_FIELDS.find(f => fields.includes(f)) || 'id';
  const extras = fields.filter(f => !HIDDEN_IN_FORM.has(f) && f !== primary && !['status', 'direction', 'notes', 'description', 'currency'].includes(f) && !/longtext|json/.test(fieldDef(table, f).type)).slice(0, 3);
  return [primary, ...extras, 'status'];
}

function renderList(table) {
  const def = S.meta.schema[table];
  const tdir = TDIR[table];
  const top = $('#topbar');
  top.innerHTML = `
    <button class="btn btn-ghost show-mobile" type="button" data-act="menu" aria-label="Меню">${ICON.menu}</button>
    <div>
      <h1 class="page-title">${esc(TNAME[table] || table)}</h1>
      ${tdir ? `<div class="page-sub"><span class="chip"><span class="dot" style="background:${DIR_VAR[tdir]}"></span>${esc(S.meta.directions.find(d => d.code === tdir).name)}</span></div>` : ''}
    </div>
    <span class="spacer"></span>
    <button class="btn btn-primary" type="button" id="b-new" aria-label="${esc(ONE[table] ? 'Добавить ' + ONE[table] : 'Добавить')}">${ICON.plus}<span class="hide-mobile">${ONE[table] ? 'Добавить ' + ONE[table] : 'Добавить'}</span></button>`;
  $('#b-new').onclick = () => openForm(table, null, tdir ? { direction: tdir } : (S.dir ? { direction: S.dir } : {}));

  const c = $('#content');
  const dirSeg = tdir ? '' : `
    <div class="seg" role="group" aria-label="Направление">
      <button type="button" data-dir="" aria-pressed="${!S.dir}">Все</button>
      ${S.meta.directions.map(d => `<button type="button" data-dir="${d.code}" aria-pressed="${S.dir === d.code}"><span class="dot" style="background:${DIR_VAR[d.code]}"></span>${esc(DIR_SHORT[d.code])}</button>`).join('')}
    </div>`;
  const statusOpts = def.statuses.filter(s => s !== 'archived').map(s => `<option value="${s}">${esc(STATUS_RU[s] || s)}</option>`).join('');
  c.innerHTML = `
    <div class="toolbar">
      <input class="input" type="search" id="q" placeholder="Найти в разделе" aria-label="Найти в разделе">
      ${dirSeg}
      <select class="select" id="st" style="width:auto;min-height:34px" aria-label="Статус">
        <option value="">Все статусы</option>${statusOpts}<option value="__arch">Архив</option>
      </select>
    </div>
    <div class="panel" id="list"><div class="loading">Загрузка…</div></div>`;

  c.querySelectorAll('[data-dir]').forEach(b => b.onclick = () => { S.dir = b.dataset.dir; LS.set('dir', S.dir); renderList(table); });
  let qt; $('#q').oninput = () => { clearTimeout(qt); qt = setTimeout(() => loadList(table), 300); };
  $('#st').onchange = () => loadList(table);
  loadList(table);
}

async function loadList(table) {
  const my = ++listReq;
  const q = ($('#q') || {}).value || '';
  const st = ($('#st') || {}).value || '';
  const dir = TDIR[table] ? '' : S.dir;
  const payload = { table, q, direction: dir, limit: 300, sort: LIST_SORT[table] || '-updated_at' };
  if (st === '__arch') { payload.includeArchived = true; payload.status = 'archived'; } else if (st) payload.status = st;
  const cacheKey = 'list_' + table + '_' + dir;
  const plain = !q && !st;
  if (plain) { const cached = LS.get(cacheKey); if (cached) drawList(table, cached, true); }
  try {
    const data = await api('records.list', payload);
    if (my !== listReq) return;
    if (plain) LS.set(cacheKey, data);
    drawList(table, data);
  } catch (e) {
    if (my !== listReq) return;
    if (e.code === 'AUTH_REQUIRED') return;
    const box = $('#list');
    if (box && !box.querySelector('.row')) box.innerHTML = `<div class="empty"><h3>Не удалось загрузить</h3><p>${esc(e.message)}</p><button class="btn" type="button" id="b-retry">Повторить</button></div>`;
    const r = $('#b-retry'); if (r) r.onclick = () => loadList(table);
    if (box && box.querySelector('.row')) toast(e.message, 'crit');
  }
}

function drawList(table, data, stale) {
  const box = $('#list'); if (!box) return;
  const cols = listCols(table);
  const tdir = TDIR[table];
  if (!data.items.length) {
    const filtered = ($('#q') && $('#q').value) || ($('#st') && $('#st').value) || (!tdir && S.dir);
    box.innerHTML = `<div class="empty"><h3>${filtered ? 'Ничего не найдено' : 'Пока пусто'}</h3>
      <p>${filtered ? 'Измените поиск или фильтр.' : 'Здесь появятся записи раздела «' + esc(TNAME[table] || table) + '».'}</p>
      ${filtered ? '' : `<button class="btn btn-primary" type="button" id="b-new-empty">${ICON.plus}${ONE[table] ? 'Добавить ' + ONE[table] : 'Добавить'}</button>`}</div>`;
    const b = $('#b-new-empty'); if (b) b.onclick = () => $('#b-new').click();
    return;
  }
  const tmpl = cols.map((c, i) => i === 0 ? 'minmax(200px,2.2fr)' : c === 'status' ? '130px' : 'minmax(90px,1fr)').join(' ');
  box.style.setProperty('--cols', tmpl);
  const dateField = cols.find(c => /^(due_at|due_date|start_at|next_step_at)$/.test(c));
  box.innerHTML = `
    <div class="list-head">${cols.map(c => `<div>${esc(c === cols[0] ? '' : fieldLabel(table, c))}</div>`).join('')}</div>
    ${data.items.map(r => {
      const d = firstDir(r, table);
      return `<button class="row" type="button" data-id="${esc(r.id)}">
        ${cols.map((c, i) => {
          if (i === 0) return `<div class="cell primary">${d ? `<span class="dirbar" style="background:${DIR_VAR[d] || 'transparent'}" title="${esc(DIR_SHORT[d] || '')}"></span>` : ''}<span style="overflow:hidden;text-overflow:ellipsis">${esc(r[c] || labelOf(r))}</span></div>`;
          const late = c === dateField && isLate(r, c);
          const cls = c === 'status' ? 'status' : (i > 2 ? 'extra' : '');
          return `<div class="cell ${cls} ${late ? 'late' : ''}">${displayValue(table, c, r, data.labels, { plain: true })}</div>`;
        }).join('')}
      </button>`;
    }).join('')}
    <div class="list-foot"><span>${data.items.length < data.total ? `Показано ${data.items.length} из ${data.total}` : `Записей: ${data.total}`}</span>${stale ? '<span>обновляю…</span>' : ''}</div>`;
  box.querySelectorAll('.row').forEach(row => row.onclick = () => { location.hash = `#/r/${table}/${encodeURIComponent(row.dataset.id)}`; });
}

/* =================== sheet (card & form) =================== */
let sheetEl = null, scrimEl = null, sheetCloseHash = null;
function openSheet(html, onClose) {
  closeSheet(true);
  scrimEl = h('<div class="scrim"></div>');
  sheetEl = h(`<aside class="sheet" role="dialog" aria-modal="true">${html}</aside>`);
  document.body.append(scrimEl, sheetEl);
  scrimEl.onclick = () => closeSheet();
  sheetEl._onClose = onClose;
  const first = sheetEl.querySelector('input,select,textarea,button'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  return sheetEl;
}
function closeSheet(silent) {
  if (!sheetEl) return;
  const cb = sheetEl._onClose; sheetEl.remove(); scrimEl.remove(); sheetEl = scrimEl = null;
  if (!silent && cb) cb();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if ($('.search-box')) closeSearch(); else closeSheet(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && S.token) { e.preventDefault(); openSearch(); }
});

async function openRecord(table, id, fromRoute) {
  const back = () => { if (location.hash.startsWith('#/r/')) location.hash = '#/t/' + table; };
  const el = openSheet(`
    <div class="sheet-head"><div class="grow"><div class="sheet-kicker">${esc(TNAME[table] || table)}</div><h2 class="sheet-title">Загрузка…</h2></div>
    <button class="btn btn-ghost" type="button" data-close aria-label="Закрыть">${ICON.close}</button></div>
    <div class="sheet-body"><div class="loading">Загрузка карточки…</div></div>`, back);
  el.querySelector('[data-close]').onclick = () => closeSheet();
  let data;
  try { data = await api('records.get', { table, id }); }
  catch (e) { if (sheetEl === el) el.querySelector('.sheet-body').innerHTML = `<div class="notice crit">${esc(e.message)}</div>`; return; }
  if (sheetEl !== el) return;
  drawRecord(el, table, data);
}

function drawRecord(el, table, data) {
  const rec = data.record;
  const archived = rec.status === 'archived' || rec.deleted_at;
  const fields = S.meta.schema[table].fields.map(f => f.name).filter(n => !['id', 'status', 'direction', 'rev', 'deleted_at', 'name_norm', 'currency'].includes(n));
  const primary = LABEL_FIELDS.find(f => rec[f] !== '' && rec[f] !== undefined && rec[f] !== null);
  const shown = fields.filter(n => n !== primary && rec[n] !== '' && rec[n] !== null && rec[n] !== undefined && !['created_at', 'updated_at', 'owner', 'source'].includes(n));
  const meta = ['created_at', 'updated_at', 'source'].filter(n => rec[n]);
  const recDirs = TDIR[table] ? [TDIR[table]] : String(rec.direction || '').split(',').map(x => x.trim()).filter(Boolean);
  const children = Object.keys(S.meta.schema).filter(t => S.meta.schema[t].fields.some(f => f.type === 'ref:' + table) && TNAME[t] &&
    (TDIR[t] ? recDirs.includes(TDIR[t]) : !(TDIR[table] && ['Customers', 'Suppliers', 'Documents'].includes(t))));

  el.innerHTML = `
    <div class="sheet-head">
      <div class="grow">
        <div class="sheet-kicker">${esc(TNAME[table] || table)} ${statusPill(rec.status)} ${displayValue(table, 'direction', rec)}</div>
        <h2 class="sheet-title">${esc(labelOf(rec))}</h2>
      </div>
      <button class="btn btn-ghost" type="button" data-close aria-label="Закрыть">${ICON.close}</button>
    </div>
    <div class="sheet-body">
      ${archived ? '<div class="notice warn">Запись в архиве. Её не видно в списках, пока не восстановите.</div>' : ''}
      ${shown.length ? `<dl class="fields">${shown.map(n => `<dt>${esc(fieldLabel(table, n))}</dt><dd>${displayValue(table, n, rec, data.labels)}</dd>`).join('')}</dl>` : '<p class="page-sub">Кроме названия, ничего не заполнено.</p>'}
      ${children.length && !archived ? `
        <div class="section-title">Добавить связанное</div>
        <div class="checks">${children.map(t => `<button class="btn btn-ghost" type="button" data-child="${t}">${ICON.plus}${esc(ONE[t] || TNAME[t])}</button>`).join('')}</div>` : ''}
      ${data.related.map(g => `
        <div class="section-title">${esc(TNAME[g.table] || g.table)} <span class="count">${g.total}</span></div>
        <div class="mini-list">${g.items.map(it => `<button type="button" data-open="${g.table}|${esc(it.id)}"><span class="lbl">${esc(it.label)}</span>${statusPill(it.status)}</button>`).join('')}</div>`).join('')}
      <div class="section-title">История</div>
      <ul class="timeline">${data.activity.length ? data.activity.map(a => `<li><time>${esc(fmtDate(a.at, true))}</time><span>${esc(activityText(table, a))}</span></li>`).join('') : '<li>Нет записей</li>'}</ul>
      <dl class="fields" style="margin-top:18px">${meta.map(n => `<dt>${esc(fieldLabel(table, n))}</dt><dd class="page-sub">${n === 'source' ? esc(({ manual: 'Вручную', ai: 'AI-ассистент', telegram: 'Telegram', calendar: 'Google Calendar' })[rec[n]] || (String(rec[n]).startsWith('import:') ? 'Импорт ' + String(rec[n]).slice(7) : rec[n])) : esc(fmtDate(rec[n], true))}</dd>`).join('')}<dt>ID</dt><dd class="page-sub">${esc(rec.id)}</dd></dl>
    </div>
    <div class="sheet-actions">
      ${archived ? `<button class="btn left" type="button" data-act="restore">Восстановить</button>` : `<button class="btn btn-ghost btn-danger left" type="button" data-act="archive">В архив</button>`}
      ${archived ? '' : `<button class="btn btn-primary" type="button" data-act="edit">Изменить</button>`}
    </div>`;

  el.querySelector('[data-close]').onclick = () => closeSheet();
  el.querySelectorAll('[data-open]').forEach(b => b.onclick = (e) => { e.preventDefault(); const [t, id] = b.dataset.open.split('|'); location.hash = `#/r/${t}/${encodeURIComponent(id)}`; });
  el.querySelectorAll('[data-child]').forEach(b => b.onclick = () => {
    const t = b.dataset.child; const f = S.meta.schema[t].fields.find(x => x.type === 'ref:' + table);
    const preset = { [f.name]: rec.id };
    if (rec.company_id && S.meta.schema[t].fields.some(x => x.name === 'company_id') && f.name !== 'company_id') preset.company_id = rec.company_id;
    const d = TDIR[t] || firstDir(rec, table); if (d) preset.direction = d;
    openForm(t, null, preset, () => openRecord(table, rec.id));
  });
  const act = (name) => el.querySelector(`[data-act="${name}"]`);
  if (act('edit')) act('edit').onclick = () => openForm(table, rec, null, () => openRecord(table, rec.id));
  if (act('archive')) act('archive').onclick = async () => {
    if (!confirm('Убрать «' + labelOf(rec) + '» в архив? Запись не удаляется, её можно восстановить.')) return;
    try { await api('records.archive', { table, id: rec.id, rev: rec.rev }); toast('Убрано в архив'); closeSheet(); loadList(table); }
    catch (e) { toast(e.message, 'crit'); }
  };
  if (act('restore')) act('restore').onclick = async () => {
    try { await api('records.restore', { table, id: rec.id, rev: rec.rev }); toast('Восстановлено'); openRecord(table, rec.id); loadList(table); }
    catch (e) { toast(e.message, 'crit'); }
  };
}

function activityText(table, a) {
  const verbs = { create: 'Создано', update: 'Изменено', archive: 'Убрано в архив', restore: 'Восстановлено', import: 'Импортировано', error: 'Ошибка' };
  let s = verbs[a.action] || a.action;
  if (a.actor && a.actor !== 'owner') s += ' (' + a.actor + ')';
  if (a.diff) { try { const d = JSON.parse(a.diff); const keys = Object.keys(d).filter(k => k !== 'status' || a.action === 'update'); if (keys.length) s += ': ' + keys.map(k => fieldLabel(table, k).toLowerCase()).join(', '); } catch (e) { /* ignore */ } }
  return s;
}

/* =================== form =================== */
async function refOptions(table) {
  if (S.refCache[table] && Date.now() - S.refCache[table].at < 60000) return S.refCache[table].items;
  const d = await api('records.list', { table, limit: 500, sort: LABEL_FIELDS.find(f => S.meta.schema[table].fields.some(x => x.name === f)) || '-updated_at' });
  S.refCache[table] = { at: Date.now(), items: d.items.map(r => ({ id: r.id, label: labelOf(r) })) };
  return S.refCache[table].items;
}

function toLocalInput(iso, type) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  if (type === 'date') return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function openForm(table, rec, preset, after) {
  const isNew = !rec;
  const def = S.meta.schema[table];
  const val = Object.assign({}, rec || {}, preset || {});
  const tdir = TDIR[table];
  const fields = def.fields.filter(f => !HIDDEN_IN_FORM.has(f.name) && !(tdir && f.name === 'direction'));
  const el = openSheet(`
    <div class="sheet-head"><div class="grow"><div class="sheet-kicker">${esc(TNAME[table] || table)}</div>
      <h2 class="sheet-title">${isNew ? (ONE[table] ? 'Добавить ' + ONE[table] : 'Новая запись') : esc(labelOf(rec))}</h2></div>
      <button class="btn btn-ghost" type="button" data-close aria-label="Закрыть">${ICON.close}</button></div>
    <form class="sheet-body form" id="rec-form" novalidate><div class="loading">Готовлю форму…</div></form>
    <div class="sheet-actions"><button class="btn" type="button" data-close>Отмена</button><button class="btn btn-primary" type="submit" form="rec-form">${isNew ? 'Создать' : 'Сохранить'}</button></div>`, after);
  el.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet());

  // preload referenced tables
  const refTables = [...new Set(fields.map(f => (f.type.match(/^refs?:(.+)$/) || [])[1]).filter(Boolean))];
  let refs = {};
  try { await Promise.all(refTables.map(async t => { refs[t] = await refOptions(t); })); }
  catch (e) { el.querySelector('#rec-form').innerHTML = `<div class="notice crit">${esc(e.message)}</div>`; return; }
  if (sheetEl !== el) return;

  const dirFor = () => tdir || (val.direction || '').split(',')[0];
  const ctl = (f) => {
    const v = val[f.name] === undefined || val[f.name] === null ? '' : val[f.name];
    const id = 'f_' + f.name; const req = def.required.includes(f.name);
    const lab = `<label for="${id}">${esc(fieldLabel(table, f.name))}${req ? ' <span class="req">*</span>' : ''}</label>`;
    const hint = f.desc && f.desc !== fieldLabel(table, f.name) && f.desc.length < 90 && !/[a-z_]+ \/ [a-z_]+/i.test(f.desc) && f.name !== 'status' ? `<div class="hint">${esc(f.desc)}</div>` : '';
    let input;
    const t = f.type;
    if (f.name === 'status') {
      input = `<select class="select" id="${id}" name="${f.name}">${def.statuses.filter(s => s !== 'archived').map(s => `<option value="${s}" ${s === (v || def.statuses[0]) ? 'selected' : ''}>${esc(STATUS_RU[s] || s)}</option>`).join('')}</select>`;
    } else if (t === 'longtext' || t === 'json') input = `<textarea class="textarea" id="${id}" name="${f.name}">${esc(v)}</textarea>`;
    else if (t === 'bool') input = `<div class="checks"><label><input type="checkbox" id="${id}" name="${f.name}" ${v === true || v === 'true' ? 'checked' : ''}> Да</label></div>`;
    else if (t === 'date' || t === 'datetime') input = `<input class="input" id="${id}" name="${f.name}" type="${t === 'date' ? 'date' : 'datetime-local'}" value="${esc(toLocalInput(v, t))}">`;
    else if (/^(number|money|percent)$/.test(t)) input = `<input class="input" id="${id}" name="${f.name}" inputmode="decimal" value="${esc(v)}">`;
    else if (t === 'email') input = `<input class="input" id="${id}" name="${f.name}" type="email" value="${esc(v)}" autocomplete="off">`;
    else if (t === 'phone') input = `<input class="input" id="${id}" name="${f.name}" type="tel" value="${esc(v)}">`;
    else if (t === 'url') input = `<input class="input" id="${id}" name="${f.name}" type="url" value="${esc(v)}" placeholder="https://">`;
    else if (/^enum:/.test(t)) {
      const list = t.slice(5); const dir = dirFor();
      let items = (S.meta.reference[list] || []);
      if (items.some(x => x.direction)) items = items.filter(x => !x.direction || !dir || x.direction === dir);
      const seen = new Set();
      input = `<select class="select" id="${id}" name="${f.name}"><option value="">—</option>${items.filter(x => !seen.has(x.code) && seen.add(x.code)).map(x => `<option value="${esc(x.code)}" ${x.code === String(v) ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
    } else if (/^multi:/.test(t)) {
      const list = t.slice(6); const cur = String(v).split(',').map(s => s.trim());
      input = `<div class="checks" id="${id}" role="group">${(S.meta.reference[list] || []).map(x => `<label><input type="checkbox" name="${f.name}" value="${esc(x.code)}" ${cur.includes(x.code) ? 'checked' : ''}>${esc(x.label)}</label>`).join('')}</div>`;
    } else if (/^ref:/.test(t)) {
      const rt = t.slice(4); const items = refs[rt] || [];
      input = `<select class="select" id="${id}" name="${f.name}"><option value="">—</option>${items.map(x => `<option value="${esc(x.id)}" ${x.id === String(v) ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        ${items.length ? '' : `<div class="hint">В разделе «${esc(TNAME[rt] || rt)}» пока нет записей.</div>`}`;
    } else if (/^refs:/.test(t)) {
      const rt = t.slice(5); const cur = String(v).split(',').map(s => s.trim()); const items = refs[rt] || [];
      input = items.length ? `<div class="checks" id="${id}" role="group">${items.slice(0, 80).map(x => `<label><input type="checkbox" name="${f.name}" value="${esc(x.id)}" ${cur.includes(x.id) ? 'checked' : ''}>${esc(x.label)}</label>`).join('')}</div>` : `<div class="hint">В разделе «${esc(TNAME[rt] || rt)}» пока нет записей.</div>`;
    } else input = `<input class="input" id="${id}" name="${f.name}" value="${esc(v)}" autocomplete="off">`;
    return `<div class="field" data-field="${f.name}">${lab}${input}${/^(multi|refs)/.test(t) || t === 'bool' ? '' : hint}</div>`;
  };

  const form = el.querySelector('#rec-form');
  const required = fields.filter(f => def.required.includes(f.name) || LABEL_FIELDS.includes(f.name));
  const rest = fields.filter(f => !required.includes(f));
  form.innerHTML = [...required, ...rest].map(ctl).join('') + '<div id="form-msg"></div>';

  // direction change re-filters stage options
  form.addEventListener('change', (e) => {
    if (e.target.name === 'direction' && !tdir) {
      const checked = [...form.querySelectorAll('input[name="direction"]:checked')].map(i => i.value);
      val.direction = checked.join(',');
      const stage = form.querySelector('[data-field="stage"]');
      if (stage) { const f = def.fields.find(x => x.name === 'stage'); stage.outerHTML = ctl(f); }
    }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    form.querySelectorAll('.field.has-error').forEach(x => { x.classList.remove('has-error'); const er = x.querySelector('.err'); if (er) er.remove(); });
    const out = {};
    fields.forEach(f => {
      const t = f.type;
      if (/^(multi|refs):/.test(t)) out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map(i => i.value).join(',');
      else if (t === 'bool') out[f.name] = !!form.querySelector(`[name="${f.name}"]`).checked;
      else {
        const inp = form.querySelector(`[name="${f.name}"]`); if (!inp) return;
        let v = inp.value.trim();
        if (t === 'datetime' && v) v = new Date(v).toISOString();
        out[f.name] = v;
      }
    });
    if (tdir) out.direction = tdir;
    let patch = out;
    if (!isNew) { patch = {}; Object.keys(out).forEach(k => { const before = rec[k] === undefined || rec[k] === null ? '' : rec[k]; let a = out[k], b = before;
      const t = (fieldDef(table, k) || {}).type;
      if (t === 'date' || t === 'datetime') { a = a ? new Date(a).getTime() : ''; b = b ? (t === 'date' ? new Date(toLocalInput(b, 'date')).getTime() : new Date(b).getTime()) : ''; }
      if (String(a) !== String(b)) patch[k] = out[k]; });
      if (!Object.keys(patch).length) { closeSheet(); return; }
    }
    const submit = el.querySelector('[type="submit"]'); submit.disabled = true;
    const save = async (force) => {
      try {
        const r = isNew ? await api('records.create', { table, data: patch, force }) : await api('records.update', { table, id: rec.id, rev: rec.rev, data: patch });
        delete S.refCache[table];
        toast(isNew ? 'Создано' : 'Сохранено');
        LS.del('list_' + table + '_' + (TDIR[table] ? '' : S.dir));
        const cb = sheetEl && sheetEl._onClose; closeSheet(true);
        if (cb) cb(); else location.hash = `#/r/${table}/${encodeURIComponent(r.record.id)}`;
        if (location.hash.includes('/' + table)) loadList(table);
      } catch (er) {
        submit.disabled = false;
        const msg = $('#form-msg');
        if (er.code === 'VALIDATION' && er.details && er.details.field) {
          const fld = form.querySelector(`[data-field="${er.details.field}"]`);
          if (fld) { fld.classList.add('has-error'); fld.append(h(`<div class="err">${esc(er.message)}</div>`)); fld.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        }
        if (er.code === 'DUPLICATE') {
          msg.innerHTML = `<div class="notice warn">Похоже, это уже есть: <b>${esc(er.details.label)}</b>.
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="b-open-dup">Открыть существующую</button><button class="btn" type="button" id="b-force">Всё равно создать</button></div></div>`;
          $('#b-open-dup').onclick = () => { closeSheet(true); location.hash = `#/r/${table}/${encodeURIComponent(er.details.existing.id)}`; };
          $('#b-force').onclick = () => { submit.disabled = true; save(true); };
          msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        if (er.code === 'CONFLICT') { msg.innerHTML = `<div class="notice crit">${esc(er.message)}</div>`; return; }
        msg.innerHTML = `<div class="notice crit">${esc(er.message)}</div>`;
      }
    };
    save(false);
  };
}

/* =================== search =================== */
let searchReq = 0;
function openSearch() {
  if ($('.search-box')) return;
  const scrim = h('<div class="scrim" data-search></div>');
  const box = h(`<div class="search-box" role="dialog" aria-label="Поиск">
    <input class="input" type="search" placeholder="Компании, контакты, задачи, встречи…" aria-label="Поиск по всей системе">
    <div class="search-res"><div class="none">Минимум 2 символа</div></div></div>`);
  document.body.append(scrim, box);
  scrim.onclick = closeSearch;
  const inp = box.querySelector('input'); const res = box.querySelector('.search-res');
  inp.focus();
  let t;
  inp.oninput = () => {
    clearTimeout(t);
    const q = inp.value.trim();
    if (q.length < 2) { res.innerHTML = '<div class="none">Минимум 2 символа</div>'; return; }
    t = setTimeout(async () => {
      const my = ++searchReq; res.innerHTML = '<div class="none">Ищу…</div>';
      try {
        const d = await api('search.global', { q });
        if (my !== searchReq) return;
        if (!d.results.length) { res.innerHTML = '<div class="none">Ничего не найдено</div>'; return; }
        const groups = {}; d.results.forEach(r => (groups[r.table] = groups[r.table] || []).push(r));
        res.innerHTML = Object.keys(groups).map(g => `<div class="grp">${esc(TNAME[g] || g)}</div>` + groups[g].map(r => `<button type="button" data-open="${g}|${esc(r.id)}"><span>${esc(r.label)}</span>${statusPill(r.status)}</button>`).join('')).join('');
        res.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const [tb, id] = b.dataset.open.split('|'); closeSearch(); location.hash = `#/r/${tb}/${encodeURIComponent(id)}`; });
      } catch (e) { if (my === searchReq) res.innerHTML = `<div class="none">${esc(e.message)}</div>`; }
    }, 350);
  };
}
function closeSearch() { document.querySelectorAll('.search-box, [data-search]').forEach(x => x.remove()); }

/* =================== settings =================== */
async function renderSettings() {
  $('#topbar').innerHTML = `<button class="btn btn-ghost show-mobile" type="button" data-act="menu" aria-label="Меню">${ICON.menu}</button><div><h1 class="page-title">Настройки</h1></div>`;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  $('#content').innerHTML = `
    <div class="panel" style="padding:20px;max-width:720px">
      ${!standalone ? `<div class="notice">${ios ? 'Чтобы установить на iPhone: кнопка «Поделиться» в Safari → «На экран Домой».' : 'Чтобы установить на Mac: в Chrome значок установки в адресной строке, в Safari меню «Файл» → «Добавить в Dock».'}</div>` : ''}
      <div class="section-title" style="margin-top:0">Оформление</div>
      <div class="seg" role="group" aria-label="Тема">
        ${[['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, n]) => `<button type="button" data-theme-set="${k}" aria-pressed="${S.theme === k}">${n}</button>`).join('')}
      </div>
      <div class="section-title">Сервер</div>
      <dl class="fields"><dt>Адрес API</dt><dd class="page-sub">${esc(S.api)}</dd><dt>Версия API</dt><dd class="page-sub">${esc(S.meta.apiVersion)}</dd><dt>Владелец</dt><dd class="page-sub">${esc(S.meta.owner)}</dd></dl>
      <div class="section-title">Устройства с входом</div>
      <div class="mini-list" id="sessions"><div class="loading">Загрузка…</div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <button class="btn" type="button" id="b-logout">Выйти на этом устройстве</button>
        <button class="btn btn-danger" type="button" id="b-logout-all">Выйти на всех устройствах</button>
        <button class="btn btn-ghost" type="button" id="b-reload-meta">Обновить справочники</button>
      </div>
    </div>`;
  document.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => { S.theme = b.dataset.themeSet; LS.set('theme', S.theme); applyTheme(); renderSettings(); });
  $('#b-logout').onclick = async () => { try { await api('auth.logout'); } catch (e) { /* token already gone */ } S.token = ''; LS.del('token'); renderLogin(); };
  $('#b-logout-all').onclick = async () => {
    if (!confirm('Закрыть вход на всех устройствах, включая это?')) return;
    try { await api('auth.logoutAll'); } catch (e) { toast(e.message, 'crit'); return; }
    S.token = ''; LS.del('token'); renderLogin('Вы вышли на всех устройствах.');
  };
  $('#b-reload-meta').onclick = async () => { try { await loadMeta(true); toast('Справочники обновлены'); } catch (e) { toast(e.message, 'crit'); } };
  try {
    const d = await api('auth.sessions');
    $('#sessions').innerHTML = d.sessions.map(s => `<button type="button" disabled style="cursor:default"><span class="lbl">${esc(s.device)}${s.current ? ' (это устройство)' : ''}</span><span class="page-sub">вход ${esc(fmtDate(s.created, true))}</span></button>`).join('');
  } catch (e) { const el = $('#sessions'); if (el) el.innerHTML = `<div class="loading">${esc(e.message)}</div>`; }
}

/* =================== boot =================== */
window.addEventListener('online', () => { const b = $('#offline'); if (b) b.hidden = true; });
window.addEventListener('offline', () => { const b = $('#offline'); if (b) b.hidden = false; });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

async function boot() {
  applyTheme();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!S.token || !S.api) return renderLogin();
  try { await loadMeta(false); }
  catch (e) { if (e.code === 'AUTH_REQUIRED') return; if (!S.meta) { $('#root').innerHTML = `<main class="login"><div class="login-card"><h1>Нет связи с сервером</h1><p>${esc(e.message)}</p><button class="btn btn-primary" type="button" onclick="location.reload()">Повторить</button></div></main>`; return; } }
  renderShell(); route();
}
boot();
