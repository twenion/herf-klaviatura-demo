// Case colour, switch type, cart drawer and checkout. Everything stays in this browser; nothing is sent.
import { CASES, SWITCHES } from './theme.js';

const PRICE = 329;
const KEYCAP_PRICE = 19;
const KEY = 'herf-cart-v1';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => `${n} AZN`;
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
function save(lines) { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) { /* private mode */ } }

export function initShop({ onChange } = {}) {
  const state = { caseC: 'qrafit', sw: 'red', lines: load(), view: 'cart', lastFocus: null, form: null };
  const cart = $('#cart');
  const body = $('[data-cart-body]');
  const title = $('[data-cart-title]');
  const count = $('[data-cart-count]');

  function setCase(k) {
    state.caseC = k;
    $$('[data-case]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.case === k)));
    $('[data-case-name]').textContent = CASES[k].name;
    onChange && onChange(state);
  }
  function setSw(k) {
    state.sw = k;
    $$('[data-sw]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sw === k)));
    $('[data-sw-name]').textContent = `${SWITCHES[k].name} · ${SWITCHES[k].kind}`;
    onChange && onChange(state);
  }
  $$('[data-case]').forEach((b) => b.addEventListener('click', () => setCase(b.dataset.case)));
  $$('[data-sw]').forEach((b) => b.addEventListener('click', () => setSw(b.dataset.sw)));
  radioKeys($('.swatches'), '[data-case]', (b) => setCase(b.dataset.case));
  radioKeys($('.switches'), '[data-sw]', (b) => setSw(b.dataset.sw));

  function add(line) {
    const same = state.lines.find((l) => l.id === line.id);
    if (same) same.qty += 1; else state.lines.push({ ...line, qty: 1 });
    save(state.lines);
    updateCount(true);
    state.view = 'cart';
    open();
  }
  $('[data-add]').addEventListener('click', () => add({
    id: `e75-${state.caseC}-${state.sw}`, kind: state.caseC, name: 'Ə75',
    sub: `${CASES[state.caseC].name} korpus · ${SWITCHES[state.sw].name} switch`, price: PRICE,
  }));
  $('[data-add-cap]').addEventListener('click', () => add({ id: 'cap-schwa', kind: 'cap', name: 'Tək Ə düyməsi', sub: 'Kobalt · PBT · iki rəngli tökmə', price: KEYCAP_PRICE }));

  function updateCount(bump) {
    const n = state.lines.reduce((a, l) => a + l.qty, 0);
    count.textContent = n;
    if (bump) { count.classList.add('bump'); setTimeout(() => count.classList.remove('bump'), 380); }
  }
  updateCount(false);
  const subtotal = () => state.lines.reduce((a, l) => a + l.price * l.qty, 0);

  function render() {
    if (state.view === 'done') return;
    if (state.view === 'form') return renderForm();
    title.textContent = 'Səbət';
    if (!state.lines.length) { body.innerHTML = '<p class="empty">Səbət hələ boşdur.</p>'; return; }
    const st = subtotal();
    body.innerHTML = state.lines.map((l, i) => `
      <div class="line">
        <span class="line__chip line__chip--${l.kind}" aria-hidden="true"></span>
        <div><p class="line__t">${l.name}</p><p class="line__s">${l.sub}</p>
          <div class="qty" role="group" aria-label="${l.name}, say"><button type="button" data-q="${i}" data-d="-1" aria-label="Azalt">−</button><span>${l.qty}</span><button type="button" data-q="${i}" data-d="1" aria-label="Artır">+</button></div>
        </div>
        <div><p class="line__p">${money(l.price * l.qty)}</p><button type="button" class="line__rm" data-rm="${i}">Sil</button></div>
      </div>`).join('') + `
      <div class="sum"><p><span>Məhsullar</span><span>${money(st)}</span></p><p><span>Çatdırılma</span><span>növbəti addımda</span></p><p class="sum__total"><span>Cəmi</span><span>${money(st)}</span></p></div>
      <button class="btn btn--solid" type="button" data-checkout>Sifarişə keç</button>`;
  }

  function renderForm(errors = {}) {
    title.textContent = 'Sifariş';
    const st = subtotal();
    const d = state.form || { name: '', phone: '', addr: '', ship: 'kuryer' };
    body.innerHTML = `
      <form class="form" novalidate>
        <button class="back" type="button" data-back>← Səbətə qayıt</button>
        <label>Ad, soyad<input name="name" autocomplete="name" value="${esc(d.name)}" required>${errors.name ? `<span class="err">${errors.name}</span>` : ''}</label>
        <label>Telefon<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+994 50 000 00 00" value="${esc(d.phone)}" required>${errors.phone ? `<span class="err">${errors.phone}</span>` : ''}</label>
        <div class="radios" role="radiogroup" aria-label="Çatdırılma">
          <label><input type="radio" name="ship" value="kuryer" ${d.ship !== 'poct' ? 'checked' : ''}> Bakı daxili kuryer <small>${st >= 150 ? 'pulsuz' : '5 AZN'}</small></label>
          <label><input type="radio" name="ship" value="poct" ${d.ship === 'poct' ? 'checked' : ''}> Rayonlara poçt <small>8 AZN</small></label>
        </div>
        <label>Ünvan<textarea name="addr" rows="2" autocomplete="street-address" required>${esc(d.addr)}</textarea>${errors.addr ? `<span class="err">${errors.addr}</span>` : ''}</label>
        <div class="radios" role="radiogroup" aria-label="Ödəniş">
          <label><input type="radio" name="pay" value="cash" checked> Qapıda nağd və ya kartla</label>
          <label class="off"><input type="radio" name="pay" value="online" disabled> Onlayn kartla <small>real saytda bank qoşulur</small></label>
        </div>
        <div class="sum" data-sum></div>
        <button class="btn btn--solid" type="submit">Sifarişi təsdiqlə</button>
      </form>`;
    const f = $('form', body);
    const sum = () => {
      const sh = read(f).ship === 'poct' ? 8 : st >= 150 ? 0 : 5;
      $('[data-sum]', f).innerHTML = `<p><span>Məhsullar</span><span>${money(st)}</span></p><p><span>Çatdırılma</span><span>${sh ? money(sh) : 'pulsuz'}</span></p><p class="sum__total"><span>Cəmi</span><span>${money(st + sh)}</span></p>`;
    };
    sum();
    f.addEventListener('change', (e) => { if (e.target.name === 'ship') sum(); });
    f.addEventListener('input', (e) => {
      state.form = read(f);
      const err = e.target.parentElement.querySelector('.err');
      if (err) err.remove();
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = read(f);
      state.form = v;
      const err = {};
      if (v.name.trim().length < 2) err.name = 'Adınızı yazın.';
      if (v.phone.replace(/\D/g, '').length < 9) err.phone = 'Nömrə ən azı 9 rəqəm olmalıdır.';
      if (v.addr.trim().length < 5) err.addr = 'Ünvanı yazın.';
      if (Object.keys(err).length) { renderForm(err); const first = $(`[name="${Object.keys(err)[0]}"]`, body); first && first.focus(); return; }
      const ref = 'HRF-' + String(Math.floor(10000 + Math.random() * 89999));
      state.lines = []; save(state.lines); updateCount(false);
      state.view = 'done'; state.form = null;
      title.textContent = 'Təşəkkürlər';
      body.innerHTML = `<div class="done" role="status"><svg viewBox="0 0 84 84"><rect x="10" y="10" width="64" height="64" rx="12"/><path d="M27 43 L38 54 L58 31"/></svg>
        <h3>Sifariş qəbul olundu</h3><p class="ref">${ref}</p><p>Bu nümunə saytdır: sifariş heç yerə göndərilmədi, məlumatlarınız saxlanmadı.</p>
        <button class="btn btn--line" type="button" data-close-cart style="margin-top:26px">Sayta qayıt</button></div>`;
    });
  }
  const read = (f) => ({ name: f.name.value, phone: f.phone.value, addr: f.addr.value, ship: (f.querySelector('[name="ship"]:checked') || {}).value || 'kuryer' });

  body.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) {
      const l = state.lines[+q.dataset.q];
      l.qty += +q.dataset.d;
      if (l.qty <= 0) state.lines.splice(+q.dataset.q, 1);
      save(state.lines); updateCount(false); render(); return;
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) { state.lines.splice(+rm.dataset.rm, 1); save(state.lines); updateCount(false); render(); return; }
    if (e.target.closest('[data-checkout]')) { state.view = 'form'; render(); const n = $('[name="name"]', body); n && n.focus(); return; }
    if (e.target.closest('[data-back]')) { state.view = 'cart'; render(); }
  });

  function open() {
    if (!cart.hidden && cart.classList.contains('is-open')) { render(); return; }
    state.lastFocus = document.activeElement;
    if (state.view === 'done') state.view = 'cart';
    render();
    cart.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => cart.classList.add('is-open')));
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => $('.cart__x').focus(), 60);
  }
  function close() {
    cart.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    setTimeout(() => { cart.hidden = true; if (state.view === 'done') state.view = 'cart'; }, 450);
    state.lastFocus && state.lastFocus.focus && state.lastFocus.focus();
  }
  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', open));
  cart.addEventListener('click', (e) => { if (e.target.closest('[data-close-cart]')) close(); });
  document.addEventListener('keydown', (e) => {
    if (cart.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = $$('button, input, textarea, a[href]', cart).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  setCase('qrafit'); setSw('red');
  return {
    get caseC() { return state.caseC; },
    get sw() { return state.sw; },
    get open() { return !cart.hidden; },
  };
}

function radioKeys(group, sel, act) {
  group.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const items = $$(sel, group);
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    e.stopPropagation();
    const n = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
    n.focus(); act(n);
  });
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
