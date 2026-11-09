/* Typeform-style wholesale valuation. Answers live in localStorage so they
   survive the sign-in redirect. Submit goes through ListingStore.valuation. */
const ValueFlow = (() => {
  const KEY = 'imdrivn_valuation';
  const MAKES = ['Alfa Romeo','Aston Martin','Audi','Bentley','BMW','BYD','Chevrolet','Cupra','Ferrari','Ford','Genesis','GWM','Holden','Honda','HSV','Hyundai','Isuzu','Jaguar','Jeep','Kia','Lamborghini','Land Rover','Lexus','Lotus','Maserati','Mazda','McLaren','Mercedes-Benz','MG','Mini','Mitsubishi','Nissan','Peugeot','Porsche','Ram','Renault','Rolls-Royce','Skoda','Subaru','Suzuki','Tesla','Toyota','Volkswagen','Volvo'];
  const STATES = ['QLD','NSW','VIC','WA','SA','TAS','ACT','NT'];
  const YEAR_MIN = 1950, YEAR_MAX = 2027, KM_MAX = 2000000, PRICE_MAX = 20000000, PHOTO_MAX = 8;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const digits = s => String(s ?? '').replace(/[^\d]/g, '');
  let suburbLoad = null;
  function loadSuburbs() {
    if (!suburbLoad) {
      suburbLoad = fetch('data/suburbs.json').then(res => {
        if (!res.ok) throw new Error('load');
        return res.json();
      }).catch(err => { suburbLoad = null; throw err; });
    }
    return suburbLoad;
  }
  function placeLabel(row) { return row[0] + ' ' + row[1] + ' ' + row[2]; }
  function searchPlaces(rows, raw) {
    const q = String(raw || '').trim().toLowerCase();
    if (!q || !rows) return [];
    if (/^\d+$/.test(q)) {
      const hits = [];
      for (const row of rows) {
        const pc = row[2];
        if (pc.startsWith(q) || (pc.startsWith('0') && !q.startsWith('0') && pc.slice(1).startsWith(q))) hits.push(row);
        if (hits.length === 8) break;
      }
      return hits;
    }
    const prefix = [], contains = [];
    for (const row of rows) {
      const name = row[0].toLowerCase();
      if (name.startsWith(q)) prefix.push(row);
      else if (name.includes(q)) contains.push(row);
      if (prefix.length >= 8) break;
    }
    return prefix.concat(contains).slice(0, 8);
  }
  function parseLoose(raw, suffix) {
    let t = String(raw ?? '').trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
    if (suffix && t.endsWith(suffix)) t = t.slice(0, -suffix.length);
    if (t.startsWith('$')) t = t.slice(1);
    if (!/^\d+$/.test(t)) return null;
    return Number(t);
  }
  function compress(file) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      const url = URL.createObjectURL(file);
      im.onload = () => {
        const w = Math.min(900, im.width || 1);
        const h = Math.max(1, Math.round((im.height || 1) * w / (im.width || 1)));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', .72));
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      im.src = url;
    });
  }
  const RATINGS = ['Excellent','Good','Fair','Needs work'];
  function blank() {
    return {make:'',model:'',year:'',variant:'',kms:'',rego:'',regoState:'',vin:'',suburb:'',state:'',postcode:'',overall:'',exterior:'',interior:'',accident:'',service:'',finance:'',keys:'',mods:'',modsNote:'',photos:[],expected:'',name:'',email:'',phone:'',photosDropped:false};
  }
  function loadDraft() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object') return null;
      return raw;
    } catch (e) { return null; }
  }
  function saveDraft(draft, step) {
    const payload = Object.assign({}, draft, {photos: (draft.photos || []).slice(), step});
    try { localStorage.setItem(KEY, JSON.stringify(payload)); }
    catch (e) {
      try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, payload, {photos: [], photosDropped: true}))); } catch (err) {}
    }
  }
  function clearDraft() { try { localStorage.removeItem(KEY); } catch (e) {} }

  function start(root) {
    const saved = loadDraft() || {};
    const draft = Object.assign(blank(), saved);
    if (!Array.isArray(draft.photos)) draft.photos = [];
    if (!RATINGS.includes(draft.exterior) && RATINGS.includes(draft.overall)) draft.exterior = draft.overall;
    if (!RATINGS.includes(draft.interior)) draft.interior = '';
    if (!STATES.includes(draft.regoState)) draft.regoState = '';
    let i = Number.isInteger(saved.step) ? saved.step : 0;
    let busy = false, suggestOn = false;
    const steps = [
      {id:'make', q:'What\'s the make?', intro:'Alright, tell us what you\u2019ve got ..', hint:'Start typing. Pick a suggestion, or write your own.'},
      {id:'model', q:'Now the model?', hint:'Golf R, CX-5, 720S — whatever is on the back.'},
      {id:'year', q:'What year?', hint:'The year it was built.'},
      {id:'variant', q:'Variant or badge?', hint:'Optional. GT, SR5, Competition — skip it if it is just the base car.'},
      {id:'kms', q:'How many kms?', hint:'Odometer reading. A rough number is fine.'},
      {id:'rego', q:'Rego and VIN?', hint:'Optional. Rego plus the state on the plate, and the VIN if you have it.'},
      {id:'place', q:'Where\'s the car?', hint:'Suburb or postcode. Pick one from the list. No street address.'},
      {id:'condition', q:'How is it sitting?', hint:'Tap each one. Dealers price off this.'},
      {id:'photos', q:'Add photos', hint:'Optional. Up to 8. We resize them before they upload.'},
      {id:'price', q:'What are you hoping to get?', hint:'Optional. A wholesale number, not the ad price. Leave it blank if you want the dealers to open.'},
      {id:'contact', q:'How do dealers reach you?', hint:'Name, email, and phone. We filled in what your account already has.'},
      {id:'review', q:'Get me a price.', hint:'Check it, then submit. We will ask you to sign in if you are not already.'}
    ];
    if (i < 0 || i >= steps.length) i = 0;

    function setErr(msg) { const el = document.getElementById('ask-err'); if (el) el.textContent = msg || ''; }
    function field(id, value, placeholder, mode) {
      return `<input class="ask-input" id="${id}" data-autofocus maxlength="60" aria-labelledby="ask-q" aria-describedby="ask-hint ask-err" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" inputmode="${mode || 'text'}" enterkeyhint="next" spellcheck="false">`;
    }
    function persist() { saveDraft(draft, i); }

    function mountMake(body) {
      body.innerHTML = `<div class="ask-combo">${field('v-make', draft.make, 'e.g. Porsche')}<ul class="ask-list" id="v-makes" role="listbox" hidden></ul></div>`;
      const input = document.getElementById('v-make');
      const list = document.getElementById('v-makes');
      let items = [], active = -1;
      const close = () => { suggestOn = false; active = -1; list.hidden = true; list.innerHTML = ''; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); };
      const paint = () => { list.querySelectorAll('button').forEach((btn, n) => btn.setAttribute('aria-selected', n === active)); if (active >= 0) input.setAttribute('aria-activedescendant', 'v-opt-' + active); };
      const choose = n => { input.value = items[n]; draft.make = items[n]; close(); input.focus(); };
      const open = matches => {
        items = matches; active = matches.length ? 0 : -1; suggestOn = matches.length > 0;
        list.hidden = !suggestOn; input.setAttribute('aria-expanded', suggestOn ? 'true' : 'false');
        list.innerHTML = matches.map((m, n) => `<li role="presentation"><button type="button" role="option" id="v-opt-${n}" aria-selected="${n === active}">${esc(m)}</button></li>`).join('');
        if (active >= 0) input.setAttribute('aria-activedescendant', 'v-opt-' + active);
        list.querySelectorAll('button').forEach((btn, n) => { btn.onmousedown = ev => ev.preventDefault(); btn.onclick = () => choose(n); });
      };
      const refresh = () => {
        const q = input.value.trim().toLowerCase();
        if (!q) { close(); return; }
        const matches = MAKES.filter(m => m.toLowerCase().includes(q)).sort((a, b) => a.toLowerCase().indexOf(q) - b.toLowerCase().indexOf(q) || a.localeCompare(b)).slice(0, 6);
        if (!matches.length) { close(); return; }
        open(matches);
      };
      input.setAttribute('role','combobox'); input.setAttribute('aria-autocomplete','list'); input.setAttribute('aria-expanded','false'); input.setAttribute('aria-controls','v-makes');
      input.addEventListener('input', () => { draft.make = input.value; refresh(); });
      input.addEventListener('focus', refresh);
      input.addEventListener('blur', () => setTimeout(close, 150));
      input.addEventListener('keydown', e => {
        if (!suggestOn) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); active = e.key === 'ArrowDown' ? (active + 1) % items.length : (active - 1 + items.length) % items.length; paint(); }
        else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); e.stopPropagation(); choose(active); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      });
    }
    function mountPlace(body) {
      const picked = draft.suburb && draft.state && draft.postcode ? draft.suburb + ' ' + draft.state + ' ' + draft.postcode : '';
      body.innerHTML = `<div class="ask-combo"><input class="ask-input" id="v-place" data-autofocus role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="v-places" aria-labelledby="ask-q" aria-describedby="ask-hint ask-err" value="${esc(picked)}" placeholder="Loading suburbs…" autocomplete="off" enterkeyhint="next" disabled><ul class="ask-list" id="v-places" role="listbox" hidden></ul></div>`;
      const input = document.getElementById('v-place');
      const list = document.getElementById('v-places');
      let rows = null, items = [], active = -1;
      const close = () => { suggestOn = false; active = -1; list.hidden = true; list.innerHTML = ''; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); };
      const paint = () => { list.querySelectorAll('button').forEach((btn, n) => btn.setAttribute('aria-selected', n === active)); if (active >= 0) input.setAttribute('aria-activedescendant', 'v-popt-' + active); const current = list.querySelector('[aria-selected="true"]'); if (current) current.scrollIntoView({block:'nearest'}); };
      const choose = n => { const row = items[n]; if (!row) return; draft.suburb = row[0]; draft.state = row[1]; draft.postcode = row[2]; input.value = placeLabel(row); close(); syncPlaceNext(); input.focus(); };
      const open = matches => {
        items = matches; active = matches.length ? 0 : -1; suggestOn = matches.length > 0;
        list.hidden = !suggestOn; input.setAttribute('aria-expanded', suggestOn ? 'true' : 'false');
        list.innerHTML = matches.map((row, n) => `<li role="presentation"><button type="button" role="option" id="v-popt-${n}" aria-selected="${n === active}">${esc(placeLabel(row))}</button></li>`).join('');
        if (active >= 0) input.setAttribute('aria-activedescendant', 'v-popt-' + active);
        list.querySelectorAll('button').forEach((btn, n) => { btn.onmousedown = ev => ev.preventDefault(); btn.onclick = () => choose(n); });
      };
      const refresh = () => {
        if (!rows) return;
        const label = draft.suburb && draft.state && draft.postcode ? draft.suburb + ' ' + draft.state + ' ' + draft.postcode : '';
        if (label && input.value.trim() === label) { close(); return; }
        const matches = searchPlaces(rows, input.value);
        if (!matches.length) { close(); return; }
        open(matches);
      };
      input.addEventListener('input', () => {
        const label = draft.suburb && draft.state && draft.postcode ? draft.suburb + ' ' + draft.state + ' ' + draft.postcode : '';
        if (input.value.trim() !== label) { draft.suburb = ''; draft.state = ''; draft.postcode = ''; syncPlaceNext(); }
        refresh();
      });
      input.addEventListener('focus', refresh);
      input.addEventListener('blur', () => setTimeout(close, 180));
      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!suggestOn) return; e.preventDefault(); e.stopPropagation(); active = e.key === 'ArrowDown' ? (active + 1) % items.length : (active - 1 + items.length) % items.length; paint(); }
        else if (e.key === 'Enter' && suggestOn && active >= 0) { e.preventDefault(); e.stopPropagation(); choose(active); }
        else if (e.key === 'Escape' && suggestOn) { e.preventDefault(); e.stopPropagation(); close(); }
      });
      syncPlaceNext();
      loadSuburbs().then(data => { if (!input.isConnected) return; rows = data; input.disabled = false; input.placeholder = 'Paddington or 4064'; input.focus(); }).catch(() => { if (input.isConnected) setErr('Could not load the suburb list. Check your connection and try again.'); });
    }
    function syncPlaceNext() {
      const ok = document.getElementById('ask-ok');
      if (ok && steps[i] && steps[i].id === 'place') ok.disabled = !(draft.suburb && draft.state && draft.postcode);
    }
    function chipRow(group, label, options, caption) {
      return `<div class="vgroup"><p>${esc(label)}</p><div class="ask-states" role="group" aria-label="${esc(label)}">${options.map(opt => `<button type="button" data-group="${group}" data-value="${esc(opt[0])}" aria-pressed="${draft[group] === opt[0]}">${esc(opt[1])}</button>`).join('')}</div>${caption ? `<p class="vcap">${esc(caption)}</p>` : ''}</div>`;
    }
    function mountCondition(body) {
      const rating = [['Excellent','Excellent'],['Good','Good'],['Fair','Fair'],['Needs work','Needs work']];
      body.innerHTML = `<div class="vcond">${chipRow('exterior','Exterior',rating)}${chipRow('interior','Interior',rating)}${chipRow('accident','Accident history',[['no','No'],['yes','Yes']])}${chipRow('service','Service history',[['Full','Full'],['Partial','Partial'],['None','None']])}${chipRow('finance','Finance owing',[['no','No'],['yes','Yes']],'It doesn\u2019t matter if there\u2019s finance owing.')}${chipRow('keys','Keys',[['1','1'],['2+','2+']])}${chipRow('mods','Mods',[['no','No'],['yes','Yes']])}<label class="ask-lab" id="v-mods-wrap" ${draft.mods === 'yes' ? '' : 'hidden'}>Mods note<input class="ask-input" id="v-mods-note" maxlength="160" aria-label="Mods note" value="${esc(draft.modsNote)}" placeholder="Exhaust, wheels, tune" autocomplete="off"></label></div>`;
      body.querySelectorAll('[data-group]').forEach(btn => {
        btn.onclick = () => {
          draft[btn.dataset.group] = btn.dataset.value;
          body.querySelectorAll(`[data-group="${btn.dataset.group}"]`).forEach(b => b.setAttribute('aria-pressed', b === btn));
          const wrap = document.getElementById('v-mods-wrap');
          if (wrap) wrap.hidden = draft.mods !== 'yes';
        };
      });
    }
    function mountPhotos(body) {
      const note = draft.photosDropped ? '<p class="ask-hint">Photos did not survive sign-in. Add them again.</p>' : '';
      body.innerHTML = `${note}<button type="button" class="ask-drop" id="v-drop" data-autofocus>Add photos</button><input class="ask-file" id="v-files" type="file" accept="image/*" multiple tabindex="-1" aria-hidden="true"><div class="ask-photos" id="v-photos"></div>`;
      const host = document.getElementById('v-photos');
      const input = document.getElementById('v-files');
      const draw = () => {
        let count = document.getElementById('v-photo-count');
        if (!count) {
          count = document.createElement('p');
          count.id = 'v-photo-count';
          count.className = 'ask-photo-count';
          count.setAttribute('aria-live', 'polite');
          host.before(count);
        }
        count.textContent = draft.photos.length + '/' + PHOTO_MAX;
        host.innerHTML = draft.photos.map((src, n) => `<div class="ask-photo shot"><img src="${src}" alt="">${photoMark()}<button type="button" class="ask-x" data-remove="${n}" aria-label="Remove photo ${n + 1}">×</button></div>`).join('');
      };
      const add = async files => {
        const images = [...files].filter(f => /^image\//.test(f.type));
        const room = PHOTO_MAX - draft.photos.length;
        if (!images.length) { setErr('Those files are not a photo. Use a JPG or PNG.'); return; }
        if (room <= 0) { setErr('Eight is the max.'); return; }
        setErr('');
        for (const file of images.slice(0, room)) {
          try { draft.photos.push(await compress(file)); draft.photosDropped = false; }
          catch (e) { setErr('One of those would not load. Try a JPG or PNG.'); }
        }
        draw();
      };
      document.getElementById('v-drop').onclick = () => input.click();
      input.onchange = () => { add(input.files); input.value = ''; };
      host.addEventListener('click', e => { const btn = e.target.closest('[data-remove]'); if (!btn) return; draft.photos.splice(+btn.dataset.remove, 1); draw(); });
      draw();
    }
    function mountRego(body) {
      const state = STATES.includes(draft.regoState) ? draft.regoState : '';
      body.innerHTML = `<div class="ask-stack"><label class="ask-lab">Rego<input class="ask-input" id="v-rego" data-autofocus maxlength="10" value="${esc(draft.rego)}" placeholder="ABC123" autocomplete="off" spellcheck="false"></label><label class="ask-lab" for="v-rego-state">Plate state<select class="ask-select" id="v-rego-state" aria-label="Plate state"><option value=""></option>${STATES.map(s => `<option value="${s}"${state === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label><label class="ask-lab">VIN<input class="ask-input" id="v-vin" maxlength="17" value="${esc(draft.vin)}" placeholder="17 characters" autocomplete="off" spellcheck="false"></label></div>`;
      document.getElementById('v-rego-state').addEventListener('change', e => { draft.regoState = STATES.includes(e.target.value) ? e.target.value : ''; });
    }
    function reviewLine(label, value) { return `<div><span>${esc(label)}</span><b>${esc(value || '—')}</b></div>`; }
    function mountReview(body) {
      const place = [draft.suburb, draft.state, draft.postcode].filter(Boolean).join(' ');
      const money = draft.expected ? '$' + Number(draft.expected).toLocaleString('en-AU') : '';
      const accident = draft.accident === 'yes' ? 'Yes' : draft.accident === 'no' ? 'No' : '';
      const finance = draft.finance === 'yes' ? 'Yes' : draft.finance === 'no' ? 'No' : '';
      const mods = draft.mods === 'yes' ? ('Yes' + (draft.modsNote ? ': ' + draft.modsNote : '')) : draft.mods === 'no' ? 'No' : '';
      body.innerHTML = `<div class="vreview">${reviewLine('Car', [draft.year, draft.make, draft.model, draft.variant].filter(Boolean).join(' '))}${reviewLine('Kms', draft.kms ? Number(draft.kms).toLocaleString('en-AU') + ' km' : '')}${reviewLine('Rego', [draft.rego, draft.regoState].filter(Boolean).join(' '))}${reviewLine('VIN', draft.vin)}${reviewLine('Location', place)}${reviewLine('Exterior', draft.exterior)}${reviewLine('Interior', draft.interior)}${reviewLine('Accident history', accident)}${reviewLine('Service history', draft.service)}${reviewLine('Finance owing', finance)}${reviewLine('Keys', draft.keys)}${reviewLine('Mods', mods)}${reviewLine('Photos', String(draft.photos.length))}${reviewLine('Hoping for', money)}${reviewLine('Contact', [draft.name, draft.email, draft.phone].filter(Boolean).join(' · '))}</div>`;
    }

    function read() {
      const step = steps[i].id;
      const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
      if (step === 'make' && val('v-make') != null) draft.make = val('v-make');
      if (step === 'model' && val('v-model') != null) draft.model = val('v-model');
      if (step === 'year' && val('v-year') != null) draft.year = digits(val('v-year')).slice(0, 4);
      if (step === 'variant' && val('v-variant') != null) draft.variant = val('v-variant').slice(0, 40);
      if (step === 'kms' && val('v-kms') != null) draft.kms = val('v-kms');
      if (step === 'rego') {
        if (val('v-rego') != null) draft.rego = val('v-rego').replace(/\s+/g, '').toUpperCase().slice(0, 10);
        const plate = document.getElementById('v-rego-state');
        if (plate) draft.regoState = STATES.includes(plate.value) ? plate.value : '';
        if (val('v-vin') != null) draft.vin = val('v-vin').replace(/\s+/g, '').toUpperCase().slice(0, 17);
      }
      if (step === 'place') {
        const el = document.getElementById('v-place');
        const label = draft.suburb && draft.state && draft.postcode ? draft.suburb + ' ' + draft.state + ' ' + draft.postcode : '';
        if (el && el.value.trim() !== label) { draft.suburb = ''; draft.state = ''; draft.postcode = ''; }
      }
      if (step === 'condition') { const note = document.getElementById('v-mods-note'); if (note) draft.modsNote = note.value.trim().slice(0, 160); if (draft.mods !== 'yes') draft.modsNote = ''; }
      if (step === 'price' && val('v-price') != null) draft.expected = val('v-price');
      if (step === 'contact') {
        if (val('v-name') != null) draft.name = val('v-name');
        if (val('v-email') != null) draft.email = val('v-email');
        if (val('v-phone') != null) draft.phone = val('v-phone');
      }
    }
    function validate() {
      const step = steps[i].id;
      if (step === 'make') return draft.make.length >= 2 ? '' : (draft.make ? 'Make needs at least 2 letters.' : 'What\'s the make? Even a weird badge counts.');
      if (step === 'model') return draft.model ? '' : 'Don\'t ghost the model. Golf R, CX-5, 720S…';
      if (step === 'year') {
        if (!/^\d{4}$/.test(draft.year)) return 'Year has to be 4 digits, like 2021.';
        const y = +draft.year;
        if (y < YEAR_MIN || y > YEAR_MAX) return `That year is outside ${YEAR_MIN}–${YEAR_MAX}. Try again.`;
        return '';
      }
      if (step === 'kms') {
        const n = parseLoose(draft.kms, 'km');
        if (n == null) return 'Kms need to be a number. Zero is allowed if it is literally new.';
        if (n > KM_MAX) return 'That odometer is giving fictional. Check it?';
        draft.kms = String(n);
        return '';
      }
      if (step === 'rego') {
        if (draft.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(draft.vin)) return 'A VIN is 17 characters, no I, O, or Q. Or leave it blank.';
        return '';
      }
      if (step === 'place') return draft.suburb && draft.state && draft.postcode ? '' : 'Pick a suburb from the list. Street addresses do not count.';
      if (step === 'condition') {
        if (!RATINGS.includes(draft.exterior) || !RATINGS.includes(draft.interior) || !draft.accident || !draft.service || !draft.finance || !draft.keys || !draft.mods) return 'Tap each row. Dealers need the full picture.';
        return '';
      }
      if (step === 'photos') return draft.photos.length <= PHOTO_MAX ? '' : 'Eight photos is the cap.';
      if (step === 'price') {
        if (!String(draft.expected || '').trim()) { draft.expected = ''; return ''; }
        const n = parseLoose(draft.expected);
        if (n == null || n < 1) return 'That price needs to be a number, or leave it blank.';
        if (n > PRICE_MAX) return 'That price looks like a typo. Dial it back?';
        draft.expected = String(n);
        return '';
      }
      if (step === 'contact') {
        if (draft.name.length < 2) return 'What should dealers call you?';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) return 'That email looks off. Mind checking it?';
        const phoneDigits = digits(draft.phone);
        if (phoneDigits.length < 8 || phoneDigits.length > 15) return 'That phone number looks off. Check the digits?';
        return '';
      }
      return '';
    }

    function render(dir) {
      const step = steps[i];
      const bar = root.querySelector('.ask-bar');
      bar.setAttribute('aria-valuenow', String(i + 1));
      bar.setAttribute('aria-valuemax', String(steps.length));
      bar.setAttribute('aria-valuetext', `Step ${i + 1} of ${steps.length}`);
      bar.firstElementChild.style.width = ((i + 1) / steps.length * 100) + '%';
      const stage = root.querySelector('.ask-stage');
      stage.innerHTML = `<div class="ask-slide${dir > 0 ? ' from-right' : dir < 0 ? ' from-left' : ''}" role="group" aria-labelledby="ask-q"><p class="ask-count">Step ${i + 1} of ${steps.length}</p>${step.intro ? `<p class="ask-intro">${esc(step.intro)}</p>` : ''}<h2 class="ask-q" id="ask-q">${step.q}</h2><p class="ask-hint" id="ask-hint">${step.hint}</p><div class="ask-body" id="ask-body"></div><p class="ask-err" id="ask-err" role="alert"></p><div class="ask-nav"><button type="button" class="btn" id="ask-back" ${i ? '' : 'hidden'}>Back</button><button type="button" class="btn solid" id="ask-ok">${i === steps.length - 1 ? 'Submit' : 'OK'}</button></div>${i === steps.length - 1 ? '' : '<p class="ask-key">Enter ↵</p>'}</div>`;
      const body = document.getElementById('ask-body');
      if (step.id === 'make') mountMake(body);
      else if (step.id === 'model') body.innerHTML = field('v-model', draft.model, 'e.g. Civic Type R');
      else if (step.id === 'year') body.innerHTML = field('v-year', draft.year, '2019', 'numeric');
      else if (step.id === 'variant') body.innerHTML = field('v-variant', draft.variant, 'GT, SR5, or leave blank');
      else if (step.id === 'kms') body.innerHTML = `<div class="ask-affix">${field('v-kms', draft.kms, '45000', 'numeric')}<span class="ask-suffix">km</span></div>`;
      else if (step.id === 'rego') mountRego(body);
      else if (step.id === 'place') mountPlace(body);
      else if (step.id === 'condition') mountCondition(body);
      else if (step.id === 'photos') mountPhotos(body);
      else if (step.id === 'price') body.innerHTML = `<div class="ask-affix"><span class="ask-prefix">$</span><input class="ask-input" id="v-price" data-autofocus inputmode="numeric" enterkeyhint="next" autocomplete="off" spellcheck="false" aria-labelledby="ask-q" value="${esc(draft.expected)}" placeholder="45000"></div>`;
      else if (step.id === 'contact') body.innerHTML = `<div class="ask-stack"><label class="ask-lab">Name${field('v-name', draft.name, 'Your name')}</label><label class="ask-lab">Email<input class="ask-input" id="v-email" type="email" inputmode="email" autocomplete="email" maxlength="120" aria-labelledby="ask-q" value="${esc(draft.email)}" placeholder="you@email.com"></label><label class="ask-lab">Phone<input class="ask-input" id="v-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" aria-labelledby="ask-q" value="${esc(draft.phone)}" placeholder="04xx xxx xxx"></label></div>`;
      else mountReview(body);
      document.getElementById('ask-ok').onclick = () => { ok(); };
      document.getElementById('ask-back').onclick = () => { back(); };
      const focusEl = stage.querySelector('[data-autofocus]');
      if (focusEl) focusEl.focus({preventScroll: true});
    }
    function back() { if (busy || i === 0) return; read(); i -= 1; persist(); render(-1); }
    async function ok() {
      if (busy) return;
      read();
      const msg = validate();
      if (msg) { setErr(msg); return; }
      setErr('');
      if (i < steps.length - 1) { i += 1; persist(); render(1); return; }
      persist();
      try { await Auth.ready; } catch (e) {}
      if (!Auth.user) { sessionStorage.setItem('imdrivn_next', 'valuation'); location.hash = '#/join'; return; }
      busy = true;
      const btn = document.getElementById('ask-ok');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      try {
        await ListingStore.valuation(draft);
        clearDraft();
        if (ValueFlow._key) { document.removeEventListener('keydown', ValueFlow._key); ValueFlow._key = null; }
        root.innerHTML = `<div class="wrap form"><div class="eyebrow">Wholesale</div><aside class="verify-card" role="status"><p>Thanks for the submission. We have sent this to our extensive dealer network and will reach out directly with a price.</p></aside><a class="btn" href="#/">Back home</a></div>`;
      } catch (e) {
        busy = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
        setErr(e && e.message ? e.message : 'Could not send that. Try again in a moment.');
      }
    }
    function onKey(e) {
      const ask = document.querySelector('.vask');
      if (!ask || !ask.isConnected || e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing || e.repeat) return;
      if (!e.target.closest || !e.target.closest('.vask')) return;
      if (e.target.closest('#ask-back') || e.target.closest('#v-makes') || e.target.closest('#v-places')) return;
      e.preventDefault();
      ok();
    }
    if (ListFlow._key) { document.removeEventListener('keydown', ListFlow._key); ListFlow._key = null; }
    if (ValueFlow._key) document.removeEventListener('keydown', ValueFlow._key);
    ValueFlow._key = onKey;
    document.addEventListener('keydown', onKey);
    root.innerHTML = `<div class="ask vask"><div class="ask-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="1" aria-label="Valuation progress"><span></span></div><div class="ask-stage"></div></div>`;
    render(0);
    prefill();
    async function prefill() {
      try { await Auth.ready; } catch (e) { return; }
      if (!Auth.user || !sb) return;
      let changed = false;
      if (!draft.email && Auth.user.email) { draft.email = Auth.user.email; changed = true; }
      try {
        const { data } = await sb.from('profiles').select('display_name,phone').eq('id', Auth.user.id).maybeSingle();
        if (data) {
          if (!draft.name && data.display_name) { draft.name = data.display_name; changed = true; }
          if (!draft.phone && data.phone) { draft.phone = data.phone; changed = true; }
        }
      } catch (e) {}
      if (changed && steps[i] && steps[i].id === 'contact' && document.querySelector('.vask')) render(0);
    }
  }

  return {start, _key: null};
})();
