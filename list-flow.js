/* Typeform-style "list your car free" flow.
   One question per screen. New ads go through ListingStore.create().
   Edits pass opts.draft and opts.submitLabel and save with ListingStore.update().
   This file never touches localStorage. */
const ListFlow = (() => {
  const SECS = [['daily','Daily','The every-day cars'],['performance','Performance','The fun ones'],['supercars','Supercar','The loud ones']];
  const YEAR_MIN = 1950, YEAR_MAX = 2027, KM_MAX = 2000000, PRICE_MAX = 20000000, PHOTO_MAX = 8;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const digits = s => String(s ?? '').replace(/[^\d]/g, '');
  const suggested = d => [d.year, d.make, d.model].map(v => String(v || '').trim()).filter(Boolean).join(' ');
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
  let catalog = { makes: [], models: {} };
  let catalogLoad = null;
  function loadCatalog() {
    if (!catalogLoad) {
      catalogLoad = fetch('data/models.json?v=26').then(res => {
        if (!res.ok) throw new Error('load');
        return res.json();
      }).then(data => {
        catalog = {
          makes: Array.isArray(data.makes) ? data.makes : [],
          models: data.models && typeof data.models === 'object' ? data.models : {}
        };
        return catalog;
      }).catch(err => { catalogLoad = null; throw err; });
    }
    return catalogLoad;
  }
  function foldName(s) {
    return String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function titleName(raw) {
    return String(raw || '').trim().replace(/\s+/g, ' ').split(' ').map(word => word.split('-').map(part => {
      if (!part) return part;
      const lower = part.toLowerCase();
      if (/^mc[a-z]/.test(lower) && lower.length > 3) return 'Mc' + lower.charAt(2).toUpperCase() + lower.slice(3);
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join('-')).join(' ');
  }
  function namesFor(kind, make) {
    if (kind === 'make') return catalog.makes || [];
    const hit = (catalog.makes || []).find(m => foldName(m) === foldName(make));
    return hit ? (catalog.models[hit] || []) : [];
  }
  function canonicalName(list, raw) {
    const key = foldName(raw);
    if (!key) return '';
    return list.find(m => foldName(m) === key) || titleName(raw);
  }
  function rankNames(list, q) {
    return list.filter(m => foldName(m).includes(q)).sort((a, b) => {
      const as = foldName(a).startsWith(q) ? 0 : 1;
      const bs = foldName(b).startsWith(q) ? 0 : 1;
      return as - bs || a.localeCompare(b, 'en', { sensitivity: 'base' });
    }).slice(0, 8);
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
  // Accepts 12000, 12,000, "12 000 km", "$189000". Rejects negatives and words.
  function parseLoose(raw, suffix) {
    let t = String(raw ?? '').trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
    if (suffix && t.endsWith(suffix)) t = t.slice(0, -suffix.length);
    if (t.startsWith('$')) t = t.slice(1);
    if (!/^\d+$/.test(t)) return null;
    return Number(t);
  }

  function compress(file) {
    return preparePhoto(file);
  }

  function field(id, opts) {
    const o = opts || {};
    return `<input class="ask-input" id="${id}" data-autofocus ${o.extra || ''} aria-labelledby="ask-q" aria-describedby="ask-hint ask-err" value="${esc(o.value)}" placeholder="${esc(o.placeholder || '')}" autocomplete="${o.auto || 'off'}" inputmode="${o.mode || 'text'}" enterkeyhint="next" ${o.maxlength ? `maxlength="${o.maxlength}"` : ''}>`;
  }

  function start(root, opts) {
    const seed = (opts && opts.draft) || {};
    const draft = {sec:'', make:'', model:'', year:'', km:'', price:'', suburb:'', state:'', postcode:'', tagline:'', heading:'', desc:'', engine:'', cylinders:'', turbo:null, supercharged:null, photos:[], name:'', phone:'', email:''};
    Object.keys(draft).forEach(key => { if (seed[key] !== undefined && seed[key] !== null) draft[key] = seed[key]; });
    if (seed.turbo === null) draft.turbo = null;
    if (seed.supercharged === null) draft.supercharged = null;
    draft.photos = Array.isArray(draft.photos) ? draft.photos.slice(0, PHOTO_MAX) : [];
    draft.year = draft.year == null ? '' : String(draft.year);
    draft.km = draft.km == null ? '' : String(draft.km);
    draft.price = draft.price == null ? '' : String(draft.price);
    const submitLabel = (opts && opts.submitLabel) || 'Post it';
    const editing = !!(opts && opts.editing);
    const photoNeed = editing ? 'Add at least one photo before you update. The first one is the cover.' : 'Add at least one photo before you post. The first one is the cover.';
    let i = 0, busy = false, suggestOn = false, steps = [];
    const POWER_NOTE = 'Electric/rotary';
    function boosted() { return draft.sec === 'performance' || draft.sec === 'supercars'; }
    function rebuildSteps() {
      steps = allSteps.filter(step => !step.boost || boosted());
      if (i >= steps.length) i = Math.max(0, steps.length - 1);
    }
    function notePower(on) {
      const suffix = ' · ' + POWER_NOTE;
      const text = draft.engine || '';
      if (on) {
        if (!text.trim()) draft.engine = POWER_NOTE;
        else if (text !== POWER_NOTE && !text.endsWith(suffix) && !/electric|rotary/i.test(text)) draft.engine = text.trim() + suffix;
        return;
      }
      if (text === POWER_NOTE) draft.engine = '';
      else if (text.endsWith(suffix)) draft.engine = text.slice(0, -suffix.length).trim();
    }
    function mountPicks(body, spec) {
      const cur = spec.get();
      body.innerHTML = `<div class="ask-states ask-picks" role="group" aria-labelledby="ask-q">${spec.options.map(([v, label]) =>
        `<button type="button" data-choice="${spec.choice}" data-value="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(label)}</button>`).join('')}</div>`;
      const current = body.querySelector('[aria-pressed="true"]');
      if (current) current.setAttribute('data-autofocus', '');
      body.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          spec.set(btn.dataset.value);
          body.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === btn));
          setTimeout(() => { if (steps[i] && steps[i].id === spec.id && !busy) go(1); }, 140);
        };
      });
    }

    const allSteps = [
      {
        id: 'section',
        question: 'Which category?',
        hint: 'This is where the ad is shown. Not whichever tab you had open.',
        mount(body) {
          body.innerHTML = `<div class="ask-choices sec-pick" role="group" aria-labelledby="ask-q">${SECS.map(([v, label, sub]) =>
            `<button type="button" class="ask-choice sec-${v}" data-choice="sec" data-value="${v}" aria-pressed="${draft.sec === v}"><span class="ask-choice-k">${label}</span><span class="ask-choice-s">${sub}</span></button>`).join('')}</div>`;
          const current = body.querySelector('[aria-pressed="true"]');
          if (current) { body.querySelector('[data-autofocus]')?.removeAttribute('data-autofocus'); current.setAttribute('data-autofocus',''); }
          body.querySelectorAll('[data-choice="sec"]').forEach(btn => {
            btn.onclick = () => {
              draft.sec = btn.dataset.value;
              rebuildSteps();
              body.querySelectorAll('[data-choice="sec"]').forEach(b => b.setAttribute('aria-pressed', b === btn));
              setTimeout(() => { if (steps[i] && steps[i].id === 'section' && !busy) go(1); }, 140);
            };
          });
        },
        read() {
          const on = document.querySelector('.ask [data-choice="sec"][aria-pressed="true"]');
          if (on) draft.sec = on.dataset.value;
          rebuildSteps();
        },
        validate: () => ['daily','performance','supercars'].includes(draft.sec) ? '' : 'Pick a lane first — Daily, Performance, or Supercar.'
      },
      {
        question: "What's the make?",
        hint: 'Start typing. Pick a make, or choose Use if yours is not listed.',
        mount: body => mountName(body, {id:'ask-make', listId:'ask-makes', kind:'make', value: draft.make, placeholder:'e.g. Porsche', min:2}),
        read() {
          const el = document.getElementById('ask-make');
          if (!el) return;
          const next = canonicalName(namesFor('make'), el.value);
          if (foldName(next) !== foldName(draft.make)) draft.model = '';
          draft.make = next;
          el.value = next;
        },
        validate() {
          if (draft.make.length < 2) return draft.make ? 'Make needs at least 2 letters.' : "What's the make? Even a weird badge counts.";
          return '';
        }
      },
      {
        question: 'Now tell me the model?',
        hint: 'The model name, not the badge. Civic, not Civic Type R. Type your own if it is not listed.',
        mount: body => mountName(body, {id:'ask-model', listId:'ask-models', kind:'model', value: draft.model, placeholder:'e.g. Civic', min:1}),
        read() {
          const el = document.getElementById('ask-model');
          if (!el) return;
          draft.model = canonicalName(namesFor('model', draft.make), el.value);
          el.value = draft.model;
        },
        validate: () => draft.model ? '' : 'Add the model. Civic, CX-5, 720S…'
      },
      {
        question: 'What year?',
        hint: 'The year it was built.',
        mount: body => { body.innerHTML = field('ask-year', {value: draft.year, placeholder: '2019', mode: 'numeric', maxlength: 4, extra: 'spellcheck="false"'}); },
        read() { const el = document.getElementById('ask-year'); if (el) draft.year = digits(el.value).slice(0, 4); },
        validate() {
          if (!/^\d{4}$/.test(draft.year)) return 'Year has to be 4 digits, like 2021.';
          const y = +draft.year;
          if (y < YEAR_MIN || y > YEAR_MAX) return `That year is outside ${YEAR_MIN}–${YEAR_MAX}. Try again.`;
          return '';
        }
      },
      {
        id: 'engine',
        question: 'What engine you running?',
        hint: 'Optional. 2JZ-GTE 3.0L, LS3, or leave it blank.',
        mount(body) { body.innerHTML = field('ask-engine', {value: draft.engine, placeholder: '2JZ-GTE 3.0L', maxlength: 80, extra: 'spellcheck="false"'}); },
        read() { const el = document.getElementById('ask-engine'); if (el) draft.engine = el.value.trim().slice(0, 80); },
        validate: () => ''
      },
      {
        id: 'cylinders',
        question: 'How many cylinders?',
        hint: 'Count the pots. Electric or rotary has none.',
        mount(body) {
          mountPicks(body, {
            id: 'cylinders', choice: 'cyl',
            options: [['3','3'],['4','4'],['5','5'],['6','6'],['8','8'],['10','10'],['12','12'],['electric','Electric/rotary']],
            get: () => draft.cylinders,
            set(v) { draft.cylinders = v; notePower(v === 'electric'); }
          });
        },
        read() {
          const on = document.querySelector('.ask [data-choice="cyl"][aria-pressed="true"]');
          if (on) { draft.cylinders = on.dataset.value; notePower(draft.cylinders === 'electric'); }
        },
        validate: () => draft.cylinders ? '' : 'Pick a cylinder count, or Electric/rotary.'
      },
      {
        id: 'turbo',
        boost: true,
        question: 'Is it turbo?',
        hint: 'Forced induction. You can say yes to this and supercharged.',
        mount(body) {
          mountPicks(body, {
            id: 'turbo', choice: 'turbo',
            options: [['yes','Yes'],['no','No']],
            get: () => draft.turbo === true ? 'yes' : draft.turbo === false ? 'no' : '',
            set(v) { draft.turbo = v === 'yes'; }
          });
        },
        read() {
          const on = document.querySelector('.ask [data-choice="turbo"][aria-pressed="true"]');
          if (on) draft.turbo = on.dataset.value === 'yes';
        },
        validate: () => draft.turbo === true || draft.turbo === false ? '' : 'Yes or no — is it turbo?'
      },
      {
        id: 'supercharged',
        boost: true,
        question: 'Is it supercharged?',
        hint: 'Yes to both means twincharged.',
        mount(body) {
          mountPicks(body, {
            id: 'supercharged', choice: 'blown',
            options: [['yes','Yes'],['no','No']],
            get: () => draft.supercharged === true ? 'yes' : draft.supercharged === false ? 'no' : '',
            set(v) { draft.supercharged = v === 'yes'; }
          });
        },
        read() {
          const on = document.querySelector('.ask [data-choice="blown"][aria-pressed="true"]');
          if (on) draft.supercharged = on.dataset.value === 'yes';
        },
        validate: () => draft.supercharged === true || draft.supercharged === false ? '' : 'Yes or no — is it supercharged?'
      },
      {
        question: 'How many kms?',
        hint: 'Odometer reading. A rough number is fine.',
        mount: body => { body.innerHTML = `<div class="ask-affix"><input class="ask-input" id="ask-km" data-autofocus aria-labelledby="ask-q" aria-describedby="ask-hint ask-err" value="${esc(draft.km)}" placeholder="45000" inputmode="numeric" enterkeyhint="next" autocomplete="off" spellcheck="false"><span class="ask-suffix">km</span></div>`; },
        read() { const el = document.getElementById('ask-km'); if (el) draft.km = el.value.trim(); },
        validate() {
          const n = parseLoose(draft.km, 'km');
          if (n == null) return 'Kms need to be a number. Zero is allowed if it is literally new.';
          if (n > KM_MAX) return 'That odometer is giving fictional. Check it?';
          draft.km = String(n);
          return '';
        }
      },
      {
        question: "What's your asking price?",
        hint: 'What you actually want for it. Aussie dollars.',
        mount: body => { body.innerHTML = `<div class="ask-affix"><span class="ask-prefix">$</span><input class="ask-input" id="ask-price" data-autofocus aria-labelledby="ask-q" aria-describedby="ask-hint ask-err" value="${esc(draft.price)}" placeholder="67900" inputmode="numeric" enterkeyhint="next" autocomplete="off" spellcheck="false"></div>`; },
        read() { const el = document.getElementById('ask-price'); if (el) draft.price = el.value.trim(); },
        validate() {
          const n = parseLoose(draft.price);
          if (n == null || n < 1) return 'Price has to be more than $0.';
          if (n > PRICE_MAX) return 'That price looks like a typo. Dial it back?';
          draft.price = String(n);
          return '';
        }
      },
      {
        question: "Where's the car located?",
        hint: 'Suburb or postcode. Pick one from the list. No street address.',
        mount(body) { mountPlace(body); },
        read() {
          const el = document.getElementById('ask-place');
          const label = draft.suburb && draft.state && draft.postcode ? draft.suburb + ' ' + draft.state + ' ' + draft.postcode : '';
          if (el && el.value.trim() !== label) { draft.suburb = ''; draft.state = ''; draft.postcode = ''; }
        },
        validate() {
          if (!draft.suburb || !draft.state || !draft.postcode) return 'Pick a suburb from the list. Street addresses do not count.';
          return '';
        }
      },
      {
        question: 'What should the heading be?',
        hint: 'The car name stays put. Add a tagline if you want.',
        mount(body) { mountHeading(body); },
        read() {
          const el = document.getElementById('ask-tagline');
          if (el) draft.tagline = el.value.trim().slice(0, 60);
          const prefix = suggested(draft);
          draft.heading = draft.tagline ? prefix + ' ' + draft.tagline : prefix;
        },
        validate() {
          if (!suggested(draft)) return 'Need the year, make and model before a heading.';
          if ((draft.tagline || '').length > 60) return 'Keep the tagline to 60 characters.';
          return '';
        }
      },
      {
        question: 'Give me a brief description',
        hint: 'One or two real sentences. History, mods, why it is for sale.',
        mount(body) {
          body.innerHTML = `<textarea class="ask-input ask-area" id="ask-desc" data-autofocus aria-labelledby="ask-q" aria-describedby="ask-hint ask-err" rows="4" maxlength="800" enterkeyhint="next" placeholder="One owner, full service history, always garaged.">${esc(draft.desc)}</textarea>`;
        },
        read() { const el = document.getElementById('ask-desc'); if (el) draft.desc = el.value.trim(); },
        validate() {
          if (draft.desc.length < 12) return draft.desc ? 'Give it a proper sentence — buyers scroll past one-word captions.' : 'Write a sentence or two. Buyers can tell when it is empty.';
          return '';
        }
      },
      {
        question: 'Add your photos',
        hint: 'First photo is the cover. Drag to reorder. Space adds more, Enter continues.',
        mount: body => mountPhotos(body),
        validate: () => draft.photos.length ? '' : photoNeed
      },
      {
        question: 'Your email and mobile',
        hint: 'Both are required. We filled in the email on your account if we have it.',
        mount(body) {
          if (!draft.email && typeof Auth !== 'undefined' && Auth.user && Auth.user.email) draft.email = Auth.user.email;
          body.innerHTML = `<div class="ask-stack">
            <label class="ask-lab">Name${field('ask-name', {value: draft.name, placeholder: 'Your name', auto: 'name'})}</label>
            <label class="ask-lab">Email${field('ask-email', {value: draft.email, placeholder: 'you@email.com', auto: 'email', mode: 'email'})}</label>
            <label class="ask-lab">Mobile${field('ask-phone', {value: draft.phone, placeholder: '0412 345 678', auto: 'tel', mode: 'tel'})}</label>
          </div>
          <p class="ask-private">Kept private. Buyers contact you through IM DRIVN messages.</p>`;
          const name = document.getElementById('ask-name');
          name.setAttribute('data-autofocus','');
          document.getElementById('ask-email').removeAttribute('data-autofocus');
          document.getElementById('ask-phone').removeAttribute('data-autofocus');
        },
        read() {
          const name = document.getElementById('ask-name');
          const phone = document.getElementById('ask-phone');
          const email = document.getElementById('ask-email');
          if (name) draft.name = name.value.trim();
          if (email) draft.email = email.value.trim();
          if (phone) {
            const norm = auMobile(phone.value);
            draft.phone = norm || phone.value.trim();
            if (norm) phone.value = norm;
          }
        },
        validate() {
          if (draft.name.length < 2) return 'What should people call you?';
          if (!draft.email) return 'Add your email. Buyers will not see it.';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) return 'That email looks off. Mind checking it?';
          if (!draft.phone) return 'Add your mobile. Buyers will not see it.';
          if (!auMobile(draft.phone)) return 'Use an Australian mobile, like 0412 345 678 or +61 412 345 678.';
          draft.phone = auMobile(draft.phone);
          return '';
        },
        invalid() {
          if (draft.name.length < 2) document.getElementById('ask-name')?.focus();
          else if (!draft.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) document.getElementById('ask-email')?.focus();
          else document.getElementById('ask-phone')?.focus();
        }
      },
      {
        question: "How's this looking?",
        hint: 'This is the card people will scroll past. Or stop on.',
        focusOk: true,
        validate: () => draft.photos.length ? '' : photoNeed,
        mount(body) {
          const handle = (draft.name || 'you').trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'you';
          const listing = {
            id: 'preview', sec: draft.sec, year: +draft.year, make: draft.make, model: draft.model,
            heading: draft.heading, price: +draft.price, suburb: draft.suburb, state: draft.state,
            engine: draft.engine, cylinders: draft.cylinders === 'electric' ? null : (draft.cylinders ? +draft.cylinders : null),
            turbo: boosted() ? draft.turbo : null, supercharged: boosted() ? draft.supercharged : null,
            handle, photos: draft.photos.slice(), likes: 0, ago: 0
          };
          body.innerHTML = `<div class="feed ask-preview">${post(listing)}</div>`;
        }
      }
    ];

    function syncPlaceNext() {
      const ok = document.getElementById('ask-ok');
      if (ok && steps[i] && steps[i].question.startsWith("Where's the car")) ok.disabled = !(draft.suburb && draft.state && draft.postcode);
    }
    function mountPlace(body) {
      const picked = draft.suburb && draft.state && draft.postcode ? draft.suburb + ' ' + draft.state + ' ' + draft.postcode : '';
      body.innerHTML = `<div class="ask-combo"><input class="ask-input" id="ask-place" data-autofocus role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ask-places" aria-labelledby="ask-q" aria-describedby="ask-hint ask-err" value="${esc(picked)}" placeholder="Loading suburbs…" autocomplete="off" enterkeyhint="next" disabled><ul class="ask-list" id="ask-places" role="listbox" hidden></ul></div>`;
      const input = document.getElementById('ask-place');
      const list = document.getElementById('ask-places');
      let rows = null, items = [], active = -1;
      const close = () => { suggestOn = false; active = -1; list.hidden = true; list.innerHTML = ''; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
      const paint = () => {
        list.querySelectorAll('button').forEach((btn, n) => btn.setAttribute('aria-selected', n === active));
        if (active >= 0) input.setAttribute('aria-activedescendant', 'ask-opt-' + active);
        const current = list.querySelector('[aria-selected="true"]');
        if (current) current.scrollIntoView({ block: 'nearest' });
      };
      const choose = n => {
        const row = items[n];
        if (!row) return;
        draft.suburb = row[0]; draft.state = row[1]; draft.postcode = row[2];
        input.value = placeLabel(row);
        close();
        syncPlaceNext();
        input.focus();
      };
      const open = matches => {
        items = matches;
        active = matches.length ? 0 : -1;
        suggestOn = matches.length > 0;
        list.hidden = !suggestOn;
        input.setAttribute('aria-expanded', suggestOn ? 'true' : 'false');
        list.innerHTML = matches.map((row, n) => `<li role="presentation"><button type="button" role="option" id="ask-opt-${n}" aria-selected="${n === active}">${esc(placeLabel(row))}</button></li>`).join('');
        if (active >= 0) input.setAttribute('aria-activedescendant', 'ask-opt-' + active);
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
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (!suggestOn) return;
          e.preventDefault(); e.stopPropagation();
          active = e.key === 'ArrowDown' ? (active + 1) % items.length : (active - 1 + items.length) % items.length;
          paint();
        } else if (e.key === 'Enter' && suggestOn && active >= 0) {
          e.preventDefault(); e.stopPropagation();
          choose(active);
        } else if (e.key === 'Escape') {
          if (!suggestOn) return;
          e.preventDefault(); e.stopPropagation();
          close();
        }
      });
      syncPlaceNext();
      loadSuburbs().then(data => {
        if (!input.isConnected) return;
        rows = data;
        input.disabled = false;
        input.placeholder = 'Paddington or 4064';
        input.focus();
      }).catch(() => { if (input.isConnected) setErr('Could not load the suburb list. Check your connection and try again.'); });
    }
    function mountHeading(body) {
      const prefix = suggested(draft);
      body.innerHTML = `<div class="ask-headfield"><span class="ask-prefix-chip" id="ask-prefix"></span><input class="ask-input" id="ask-tagline" data-autofocus maxlength="60" aria-labelledby="ask-q" aria-describedby="ask-hint ask-err" placeholder="GR | Low kms | Full history" autocomplete="off" enterkeyhint="next" value="${esc(draft.tagline || '')}"></div><p class="ask-live-label">On the card</p><article class="post ask-card-preview"><div class="b"><span class="ttl" id="ask-head-live"></span><div class="price" id="ask-head-price"></div><div class="row"><span class="loc" id="ask-head-loc"></span></div></div></article>`;
      const chip = document.getElementById('ask-prefix');
      const input = document.getElementById('ask-tagline');
      const live = document.getElementById('ask-head-live');
      chip.textContent = prefix;
      document.getElementById('ask-head-price').textContent = draft.price ? '$' + Number(draft.price).toLocaleString('en-AU') : '';
      document.getElementById('ask-head-loc').textContent = [draft.suburb, draft.state].filter(Boolean).join(' ');
      const paint = () => {
        const tag = input.value.trim().slice(0, 60);
        live.textContent = tag ? prefix + ' ' + tag : prefix;
      };
      input.addEventListener('input', () => { if (input.value.length > 60) input.value = input.value.slice(0, 60); draft.tagline = input.value; paint(); });
      paint();
    }

    function mountName(body, opts) {
      body.innerHTML = `<div class="ask-combo">${field(opts.id, {value: opts.value, placeholder: 'Loading…', extra: 'disabled'})}<ul class="ask-list" id="${opts.listId}" role="listbox" hidden></ul></div>`;
      const input = document.getElementById(opts.id);
      const list = document.getElementById(opts.listId);
      let items = [], active = -1, justChose = false;
      const close = () => { suggestOn = false; active = -1; list.hidden = true; list.innerHTML = ''; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); };
      const open = rows => {
        items = rows;
        active = rows.length ? 0 : -1;
        suggestOn = rows.length > 0;
        list.hidden = !suggestOn;
        input.setAttribute('aria-expanded', suggestOn ? 'true' : 'false');
        list.innerHTML = rows.map((row, n) => `<li role="presentation"><button type="button" role="option" id="ask-opt-${n}" class="${row.custom ? 'is-custom' : ''}" aria-selected="${n === active}">${esc(row.label)}</button></li>`).join('');
        if (active >= 0) input.setAttribute('aria-activedescendant', 'ask-opt-' + active);
        list.querySelectorAll('button').forEach((btn, n) => { btn.onmousedown = ev => ev.preventDefault(); btn.onclick = () => choose(n); });
      };
      const paint = () => {
        list.querySelectorAll('button').forEach((btn, n) => btn.setAttribute('aria-selected', n === active));
        if (active >= 0) input.setAttribute('aria-activedescendant', 'ask-opt-' + active);
        const current = list.querySelector('[aria-selected="true"]');
        if (current) current.scrollIntoView({ block: 'nearest' });
      };
      const choose = n => {
        const row = items[n];
        if (!row) return;
        input.value = row.value;
        justChose = true;
        close();
        input.focus();
      };
      const refresh = () => {
        const raw = input.value.trim();
        const q = foldName(raw);
        if (!q) { close(); return; }
        const options = opts.kind === 'make' ? (catalog.makes || []) : namesFor('model', draft.make);
        const exact = options.find(m => foldName(m) === q);
        const rows = rankNames(options, q).map(m => ({label: m, value: m}));
        if (!exact && foldName(raw).length >= opts.min) {
          const custom = canonicalName(options, raw);
          rows.push({label: 'Use "' + custom + '"', value: custom, custom: true});
        }
        if (!rows.length) { close(); return; }
        open(rows);
      };
      input.setAttribute('role','combobox');
      input.setAttribute('aria-autocomplete','list');
      input.setAttribute('aria-expanded','false');
      input.setAttribute('aria-controls', opts.listId);
      input.addEventListener('input', () => { justChose = false; refresh(); });
      input.addEventListener('focus', () => { if (justChose) { justChose = false; return; } refresh(); });
      input.addEventListener('blur', () => setTimeout(close, 150));
      input.addEventListener('keydown', e => {
        if (!suggestOn) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); e.stopPropagation();
          active = e.key === 'ArrowDown' ? (active + 1) % items.length : (active - 1 + items.length) % items.length;
          paint();
        } else if (e.key === 'Enter' && active >= 0) {
          e.preventDefault(); e.stopPropagation();
          choose(active);
        } else if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          close();
        }
      });
      const ready = () => {
        if (!input.isConnected) return;
        input.disabled = false;
        input.placeholder = opts.placeholder;
        if (input.value) refresh();
        input.focus();
      };
      if ((catalog.makes || []).length) ready();
      else loadCatalog().then(ready).catch(() => { if (input.isConnected) { input.disabled = false; input.placeholder = opts.placeholder; setErr('Could not load the list. You can still type your own.'); input.focus(); } });
    }

    function mountPhotos(body) {
      body.innerHTML = `<p class="ask-tip">Vehicles sell better with good photos. Don't chop your car off, let us see it!</p>
        <p class="ask-photo-count" id="ask-photo-count" aria-live="polite">0/${PHOTO_MAX}</p>
        <button type="button" class="ask-drop" id="ask-drop" data-autofocus>Add photos</button>
        <input class="ask-file" id="ask-files" type="file" accept="image/*" multiple tabindex="-1" aria-hidden="true">
        <p class="ask-photo-note" id="ask-photo-note"></p>
        <div class="ask-photos" id="ask-photos"></div>`;
      const host = document.getElementById('ask-photos');
      const input = document.getElementById('ask-files');
      const drop = document.getElementById('ask-drop');
      const countEl = document.getElementById('ask-photo-count');
      const noteEl = document.getElementById('ask-photo-note');
      let drag = null;

      const draw = () => {
        const full = draft.photos.length >= PHOTO_MAX;
        if (countEl) countEl.textContent = draft.photos.length + '/' + PHOTO_MAX;
        if (drop) { drop.hidden = full; drop.disabled = full; }
        if (input) input.disabled = full;
        if (noteEl && !full) noteEl.textContent = '';
        host.innerHTML = draft.photos.map((src, n) => `<div class="ask-photo${n === 0 ? ' is-cover' : ''}" data-i="${n}" tabindex="0" role="group" aria-label="${n === 0 ? 'Cover photo' : 'Photo ' + (n + 1)}. Use arrow keys to reorder">
          <img src="${src}" alt="">
          ${n === 0 ? '<span class="ask-cover">Cover</span>' : ''}
          <button type="button" class="ask-x" data-remove="${n}" aria-label="Remove photo ${n + 1}">×</button>
        </div>`).join('');
      };
      const move = (from, to) => {
        if (to < 0 || to >= draft.photos.length || from === to) return;
        const [item] = draft.photos.splice(from, 1);
        draft.photos.splice(to, 0, item);
        draw();
        host.querySelector(`[data-i="${to}"]`)?.focus();
      };
      const add = async files => {
        const images = [...files].filter(f => /^image\//.test(f.type));
        const room = PHOTO_MAX - draft.photos.length;
        if (!images.length) { setErr('Those files are not giving photo. Use a JPG or PNG.'); return; }
        if (room <= 0) { if (noteEl) noteEl.textContent = '8 is the max.'; setErr(''); return; }
        const keep = images.slice(0, room);
        const truncated = images.length > room;
        setErr('');
        for (const file of keep) {
          try { draft.photos.push(await compress(file)); }
          catch (e) { setErr('One of those would not load. Try a JPG or PNG.'); }
        }
        if (draft.photos.length > PHOTO_MAX) draft.photos.length = PHOTO_MAX;
        draw();
        if (noteEl && truncated) noteEl.textContent = '8 is the max. Kept the first photos that fit.';
      };

      drop.onclick = () => input.click();
      input.onchange = () => { add(input.files); input.value = ''; };
      body.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
      body.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      body.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('is-over'); if (e.dataTransfer?.files) add(e.dataTransfer.files); });
      host.addEventListener('click', e => {
        const btn = e.target.closest('[data-remove]');
        if (!btn) return;
        draft.photos.splice(+btn.dataset.remove, 1);
        draw();
      });
      host.addEventListener('keydown', e => {
        const photo = e.target.closest('.ask-photo');
        if (!photo) return;
        const n = +photo.dataset.i;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(n, n - 1); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(n, n + 1); }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); draft.photos.splice(n, 1); draw(); }
      });
      host.addEventListener('pointerdown', e => {
        const photo = e.target.closest('.ask-photo');
        if (!photo || e.target.closest('.ask-x')) return;
        drag = {from: +photo.dataset.i, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId};
        host.setPointerCapture(e.pointerId);
      });
      host.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
        drag.moved = true;
        host.querySelector(`[data-i="${drag.from}"]`)?.classList.add('is-dragging');
        let to = -1;
        host.querySelectorAll('.ask-photo').forEach(el => {
          if (+el.dataset.i === drag.from) return;
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) to = +el.dataset.i;
        });
        if (to < 0 || to === drag.from) return;
        const [item] = draft.photos.splice(drag.from, 1);
        draft.photos.splice(to, 0, item);
        drag.from = to;
        draw();
        host.querySelector(`[data-i="${to}"]`)?.classList.add('is-dragging');
      });
      host.addEventListener('pointerup', e => {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        host.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
      });
      host.addEventListener('pointercancel', () => { drag = null; });
      draw();
    }

    function setErr(msg) {
      const el = document.getElementById('ask-err');
      if (el) el.textContent = msg || '';
      document.querySelectorAll('.ask [aria-labelledby="ask-q"]').forEach(el => el.setAttribute('aria-invalid', msg ? 'true' : 'false'));
    }

    function render(dir) {
      const step = steps[i];
      const bar = root.querySelector('.ask-bar');
      bar.setAttribute('aria-valuenow', String(i + 1));
      bar.setAttribute('aria-valuemax', String(steps.length));
      bar.setAttribute('aria-valuetext', `Step ${i + 1} of ${steps.length}`);
      bar.firstElementChild.style.width = ((i + 1) / steps.length * 100) + '%';
      const stage = root.querySelector('.ask-stage');
      stage.innerHTML = `<div class="ask-slide${dir > 0 ? ' from-right' : dir < 0 ? ' from-left' : ''}" role="group" aria-labelledby="ask-q">
        <p class="ask-count">Step ${i + 1} of ${steps.length}</p>
        <h2 class="ask-q" id="ask-q">${step.question}</h2>
        <p class="ask-hint" id="ask-hint">${step.hint || ''}</p>
        <div class="ask-body" id="ask-body"></div>
        <p class="ask-err" id="ask-err" role="alert"></p>
        <div class="ask-nav">
          <button type="button" class="btn" id="ask-back" ${i === 0 ? 'hidden' : ''}>Back</button>
          <button type="button" class="btn solid" id="ask-ok">${i === steps.length - 1 ? submitLabel : 'OK'}</button>
        </div>
        ${i === steps.length - 1 ? '' : '<p class="ask-key">Enter ↵</p>'}
      </div>`;
      step.mount(document.getElementById('ask-body'));
      document.getElementById('ask-ok').onclick = () => { ok(); };
      document.getElementById('ask-back').onclick = () => { back(); };
      const focusEl = step.focusOk ? document.getElementById('ask-ok') : stage.querySelector('[data-autofocus]');
      if (focusEl) {
        focusEl.focus({preventScroll: true});
        if (typeof focusEl.setSelectionRange === 'function' && focusEl.value) {
          const n = focusEl.value.length;
          try { focusEl.setSelectionRange(n, n); } catch (e) {}
        }
      }
    }

    function back() {
      if (busy || i === 0) return;
      steps[i].read?.();
      go(-1);
    }

    function go(delta) {
      const next = i + delta;
      if (next < 0 || next >= steps.length) return;
      i = next;
      render(delta);
    }

    async function ok() {
      if (busy) return;
      const step = steps[i];
      step.read?.();
      const msg = step.validate();
      if (msg) { setErr(msg); (step.invalid || (() => document.querySelector('.ask [data-autofocus]')?.focus()))(); return; }
      setErr('');
      if (i < steps.length - 1) { go(1); return; }
      busy = true;
      const btn = document.getElementById('ask-ok');
      if (btn) btn.disabled = true;
      try {
        await opts.publish({...draft, photos: draft.photos.slice()});
      } catch (e) {
        busy = false;
        if (btn) btn.disabled = false;
        setErr(e && e.message ? e.message : 'Could not save that. Try again in a moment.');
      }
    }

    function onKey(e) {
      const ask = document.querySelector('.ask');
      if (!ask || !ask.isConnected || e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing || e.repeat) return;
      if (!e.target.closest || !e.target.closest('.ask')) return;
      if (e.target.closest('#ask-back') || e.target.closest('[data-choice="sec"]') || e.target.closest('[data-choice="cyl"]') || e.target.closest('[data-choice="turbo"]') || e.target.closest('[data-choice="blown"]')) return;
      if (e.target.closest('#ask-makes') || e.target.closest('#ask-models') || e.target.closest('#ask-places')) return;
      const stateBtn = e.target.closest('[data-choice="state"]');
      if (stateBtn) stateBtn.parentElement.querySelectorAll('[data-choice="state"]').forEach(b => b.setAttribute('aria-pressed', b === stateBtn));
      e.preventDefault();
      ok();
    }

    if (ListFlow._key) document.removeEventListener('keydown', ListFlow._key);
    ListFlow._key = onKey;
    document.addEventListener('keydown', onKey);

    rebuildSteps();
    root.innerHTML = `<div class="ask">
      <div class="ask-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="1" aria-label="Listing progress"><span></span></div>
      <div class="ask-stage"></div>
    </div>`;
    render(0);
  }

  loadCatalog();
  return {start, _key: null};
})();
