/* Supabase data layer. The UI calls Auth and ListingStore only.
   Photos are uploaded to the public bucket `listing-photos` at `<uid>/...`
   and listings.photos stores those storage paths (first path is the cover). */
const SB_URL = 'https://pcrrcyopnzcszlopmmtg.supabase.co';
const SB_KEY = 'sb_publishable_ULArPJ33URATevUZBgUaHQ_omVbqNOY';

/* Read before the client starts, so a failed OAuth redirect is not mistaken for a route. */
const bootSearch = location.search;
const bootHash = location.hash;
function oauthProviderName(provider, description) {
  const p = String(provider || '').toLowerCase();
  if (p === 'google' || /google/i.test(description || '')) return 'Google';
  if (p === 'apple' || /apple/i.test(description || '')) return 'Apple';
  return '';
}
function oauthFailText(description, provider) {
  const desc = String(description || '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
  const name = oauthProviderName(provider, desc);
  const head = name ? name + " sign-in didn't work" : "Sign-in didn't work";
  return (desc ? head + ': ' + desc : head) + '. Try again.';
}
function consumeOAuthError(search, hash) {
  const query = new URLSearchParams(search);
  const hashRaw = hash.startsWith('#') ? hash.slice(1) : hash;
  const hashIsError = /(^|&)error=/.test(hashRaw) || /(^|&)error_description=/.test(hashRaw);
  const hashParams = hashIsError ? new URLSearchParams(hashRaw) : null;
  const error = query.get('error') || (hashParams && hashParams.get('error')) || '';
  const description = query.get('error_description') || (hashParams && hashParams.get('error_description')) || '';
  if (!error && !description) return '';
  let provider = '';
  try { provider = sessionStorage.getItem('imdrivn_oauth') || ''; sessionStorage.removeItem('imdrivn_oauth'); } catch (e) {}
  query.delete('error'); query.delete('error_description'); query.delete('error_code');
  const appHash = !hashIsError && hash.startsWith('#/') ? hash : '#/join';
  const nextSearch = query.toString();
  history.replaceState(null, '', location.pathname + (nextSearch ? '?' + nextSearch : '') + appHash);
  return oauthFailText(description || (error === 'access_denied' ? 'Access was denied' : ''), provider);
}
const oauthErrorMessage = consumeOAuthError(bootSearch, bootHash);

const sb = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SB_URL, SB_KEY, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
    })
  : null;

/* Static make/model list, plus names already used on live listings. */
const VehicleNames = (() => {
  const acronyms = new Set(['BMW','HSV','FPV','GMC','MG','GWM','BYD','RAM','TVR','AMG','GT','GTI','GTR','WRX','STI','RS','SS','XR','SRT','SVR']);
  const baseMakes = [];
  const baseModels = {};
  const extras = new Map();
  let readyP = null;
  const byName = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
  function fold(s) {
    return String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function harvest(name) {
    String(name || '').split(/[\s/]+/).forEach(word => {
      word.split('-').forEach(part => { if (/^[A-Z0-9]{2,5}$/.test(part)) acronyms.add(part); });
    });
  }
  function knownMake(raw) {
    const key = fold(raw);
    if (!key) return '';
    const base = baseMakes.find(m => fold(m) === key);
    if (base) return base;
    const extra = extras.get(key);
    return extra ? extra.name : '';
  }
  function knownModel(make, raw) {
    const mk = knownMake(make);
    const key = fold(raw);
    if (!mk || !key) return '';
    const listed = (baseModels[mk] || []).find(m => fold(m) === key);
    if (listed) return listed;
    const extra = extras.get(fold(mk));
    return extra && extra.models.has(key) ? extra.models.get(key) : '';
  }
  function junk(raw, known) {
    const key = fold(raw).replace(/\s/g, '');
    if (!key || key.length < 2) return true;
    if (/^\d+$/.test(key) && !known) return true;
    return false;
  }
  function display(raw) {
    const cleaned = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    const hit = knownMake(cleaned);
    if (hit) return hit;
    return cleaned.split(' ').map(word => word.split('-').map(part => {
      const letters = part.replace(/[^A-Za-z0-9]/g, '');
      const upper = letters.toUpperCase();
      if (letters && acronyms.has(upper) && letters.length >= 2 && letters.length <= 5) return upper;
      if (/^[A-Z0-9]{2,5}$/.test(part)) return part;
      const lower = part.toLowerCase();
      if (/^mc[a-z]/.test(lower) && lower.length > 3) return 'Mc' + lower.charAt(2).toUpperCase() + lower.slice(3);
      return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : part;
    }).join('-')).join(' ');
  }
  function remember(make, model) {
    const mkRaw = String(make || '').trim();
    if (junk(mkRaw, knownMake(mkRaw))) return;
    const mk = knownMake(mkRaw) || display(mkRaw);
    if (!mk || junk(mk, knownMake(mk))) return;
    const key = fold(mk);
    if (!extras.has(key)) extras.set(key, { name: mk, models: new Map() });
    const slot = extras.get(key);
    if (knownMake(mk)) slot.name = knownMake(mk);
    const mdRaw = String(model || '').trim();
    const already = knownModel(slot.name, mdRaw);
    if (!mdRaw || junk(mdRaw, already)) return;
    const md = already || display(mdRaw);
    if (!md || junk(md, already)) return;
    slot.models.set(fold(md), already || md);
  }
  function makes() {
    const names = baseMakes.slice();
    const seen = new Set(names.map(fold));
    extras.forEach(slot => {
      if (!seen.has(fold(slot.name))) { seen.add(fold(slot.name)); names.push(slot.name); }
    });
    return names.sort(byName);
  }
  function models(make) {
    const mk = knownMake(make) || display(make);
    const listed = (baseModels[mk] || []).slice();
    const seen = new Set(listed.map(fold));
    const extra = extras.get(fold(mk));
    if (extra) extra.models.forEach(model => {
      if (!seen.has(fold(model))) { seen.add(fold(model)); listed.push(model); }
    });
    return listed.sort(byName);
  }
  function listingMakes() {
    const out = [];
    extras.forEach(slot => { if (!baseMakes.some(m => fold(m) === fold(slot.name))) out.push(slot.name); });
    return out.sort(byName);
  }
  async function ready() {
    if (!readyP) {
      readyP = (async () => {
        try {
          const res = await fetch('data/models.json?v=26');
          if (res.ok) {
            const data = await res.json();
            (Array.isArray(data.makes) ? data.makes : []).forEach(name => {
              harvest(name);
              if (name && !baseMakes.some(m => fold(m) === fold(name))) baseMakes.push(name);
            });
            const groups = data.models && typeof data.models === 'object' ? data.models : {};
            Object.keys(groups).forEach(make => {
              harvest(make);
              baseModels[make] = Array.isArray(groups[make]) ? groups[make].slice() : [];
              baseModels[make].forEach(harvest);
            });
          }
        } catch (e) {}
        if (sb) {
          try {
            let from = 0;
            for (let page = 0; page < 8; page++) {
              const { data, error } = await sb.from('listings').select('make,model').eq('status', 'active').range(from, from + 999);
              if (error || !data) break;
              data.forEach(row => remember(row.make, row.model));
              if (data.length < 1000) break;
              from += 1000;
            }
          } catch (e) {}
        }
        return true;
      })().catch(err => { readyP = null; throw err; });
    }
    return readyP;
  }
  return { ready, makes, models, remember, display, fold, listingMakes };
})();
function noteVehicleName(make, model) {
  VehicleNames.remember(make, model);
  if (typeof paintSearch === 'function') {
    try { paintSearch(); } catch (e) {}
  }
}

const Presence = {
  ONLINE_MS: 120000,
  BEAT_MS: 60000,
  NUDGE_MS: 30000,
  column: false,
  timer: 0,
  lastNudge: 0,
  selfSeen: '',
  onSelf: null,
  online(seen) {
    const t = Date.parse(seen || '');
    return Number.isFinite(t) && Date.now() - t < this.ONLINE_MS;
  },
  dot(seen) {
    if (!this.online(seen)) return '';
    const stamp = String(seen || '').replace(/[^0-9TZ:+.\-]/g, '');
    return `<span class="online" data-seen="${stamp}" title="Online" aria-label="Online"></span>`;
  },
  async ping(force) {
    if (!sb || !Auth.user || document.visibilityState === 'hidden') return;
    const now = Date.now();
    if (!force && now - this.lastNudge < this.NUDGE_MS) return;
    this.lastNudge = now;
    try {
      const res = await sb.rpc('touch_presence');
      if (res && res.error) return;
      const stamp = res && typeof res.data === 'string' && res.data ? res.data : new Date().toISOString();
      this.selfSeen = stamp;
      if (Auth.profile) Auth.profile.last_seen_at = stamp;
      if (this.onSelf) this.onSelf();
    } catch (e) {}
  },
  nudge() { this.ping(false); },
  start() {
    if (!Auth.user || document.visibilityState === 'hidden') { this.stop(); return; }
    if (this.timer) return;
    this.ping(true);
    this.timer = setInterval(() => { this.ping(true); }, this.BEAT_MS);
  },
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
  }
};
Presence.ready = (async () => {
  if (!sb) return false;
  try {
    const res = await sb.from('profiles').select('last_seen_at').limit(1);
    Presence.column = !res.error;
  } catch (e) { Presence.column = false; }
  return Presence.column;
})();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') Presence.stop();
  else Presence.start();
});
function ownProfileCols() {
  return 'id,username,display_name,avatar_url,is_admin' + (Presence.column ? ',last_seen_at' : '');
}
const Auth = {
  user: null,
  profile: null,
  likes: new Set(),
  saves: new Set(),
  recovery: /type=recovery/.test(bootSearch) || /type=recovery/.test(bootHash),
  oauthError: oauthErrorMessage,
  listeners: new Set(),
  needsHandle() { return !!(this.user && !(this.profile && String(this.profile.username || '').trim())); },
  emit() { this.listeners.forEach(fn => { try { fn(); } catch (e) {} }); },
  async sync() {
    if (!this.user) { this.profile = null; this.likes = new Set(); this.saves = new Set(); return; }
    await Presence.ready;
    const [profile, likes, saves] = await Promise.all([
      sb.from('profiles').select(ownProfileCols()).eq('id', this.user.id).maybeSingle(),
      sb.from('likes').select('listing_id').eq('user_id', this.user.id),
      sb.from('saves').select('listing_id').eq('user_id', this.user.id)
    ]);
    this.profile = profile.error ? null : profile.data;
    this.likes = new Set(likes.error ? [] : (likes.data || []).map(r => r.listing_id));
    this.saves = new Set(saves.error ? [] : (saves.data || []).map(r => r.listing_id));
  },
  async init() {
    if (!sb) return;
    try {
      const { data, error } = await sb.auth.getSession();
      if (!error) this.user = data.session?.user || null;
    } catch (e) {}
    sb.auth.onAuthStateChange((event, session) => {
      this.user = session?.user || null;
      if (event === 'PASSWORD_RECOVERY') this.recovery = true;
      if (event === 'SIGNED_OUT') { this.profile = null; this.likes = new Set(); this.saves = new Set(); this.recovery = false; }
      if (event === 'INITIAL_SESSION') return;
      this.sync().then(() => this.emit());
    });
    await this.sync();
  },
  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(authMessage(error));
    await this.refreshUser();
  },
  async signUp(email, password) {
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { emailRedirectTo: location.origin + location.pathname }
    });
    if (error) throw new Error(authMessage(error));
    if (data.session) { await this.refreshUser(); return { confirmed: true }; }
    return { confirmed: false };
  },
  async forgot(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(authMessage(error));
  },
  async oauth(provider) {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: location.origin + location.pathname, skipBrowserRedirect: true }
    });
    if (error) throw new Error(authMessage(error, provider));
    try { sessionStorage.setItem('imdrivn_oauth', provider); } catch (e) {}
    if (!data || !data.url) throw new Error('Could not start that sign-in.');
    // Probe first so a disabled provider shows a message instead of leaving the page.
    let res;
    try { res = await fetch(data.url, { headers: { apikey: SB_KEY }, redirect: 'manual' }); }
    catch (e) {
      try { sessionStorage.removeItem('imdrivn_oauth'); } catch (err) {}
      throw new Error('Could not reach the sign-in service. Try again.');
    }
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) { location.assign(data.url); return; }
    let body = {};
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) {
      try { sessionStorage.removeItem('imdrivn_oauth'); } catch (e) {}
      throw new Error(authMessage({ message: body.msg || body.message || body.error_description || '' }, provider));
    }
    location.assign(data.url);
  },
  async updatePassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(authMessage(error));
    this.recovery = false;
    await this.refreshUser();
  },
  cleanHandle(raw) {
    return String(raw || '').trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);
  },
  handleOk(username) { return /^[a-z0-9._]{3,20}$/.test(username); },
  async handleFree(raw) {
    const username = this.cleanHandle(raw);
    if (!this.handleOk(username) || !sb) return false;
    const pattern = username.replace(/[\\%_]/g, ch => '\\' + ch);
    const { data, error } = await sb.from('profiles').select('id,username').ilike('username', pattern).limit(5);
    if (error) throw error;
    const mine = this.user && this.user.id;
    return !(data || []).some(row => String(row.username || '').toLowerCase() === username && row.id !== mine);
  },
  async setHandle(raw) {
    if (this.profile && String(this.profile.username || '').trim()) {
      throw new Error('Handle cannot be changed once set.');
    }
    const username = this.cleanHandle(raw);
    if (!this.handleOk(username)) throw new Error('Use 3–20 characters: letters, numbers, dots, and underscores.');
    const id = this.user.id;
    await Presence.ready;
    let res = await sb.from('profiles').update({ username }).eq('id', id).select(ownProfileCols()).maybeSingle();
    if (res.error) throw new Error(handleError(res.error));
    if (!res.data) {
      res = await sb.from('profiles').insert({ id, username }).select(ownProfileCols()).single();
      if (res.error) throw new Error(handleError(res.error));
    }
    this.profile = res.data;
    return res.data;
  },
  async signOut() {
    if (sb) await sb.auth.signOut();
    this.user = null; this.profile = null; this.likes = new Set(); this.saves = new Set(); this.recovery = false;
    this.emit();
  },
  async refreshUser() {
    const { data } = await sb.auth.getUser();
    this.user = data.user || this.user;
    await this.sync();
    this.emit();
  }
};
Auth.ready = Auth.init();
Auth.authReturn = (/[?&]code=/.test(bootSearch) || /access_token/.test(bootHash)) && !Auth.recovery && !oauthErrorMessage;

function authMessage(error, provider) {
  const msg = error.message || error.msg || 'Something went wrong. Try again.';
  if (/weak_password|at least 6/i.test(msg)) return 'Password needs at least 6 characters.';
  if (/invalid login/i.test(msg)) return 'That email and password do not match.';
  if (/already registered|already been registered/i.test(msg)) return 'That email already has an account. Sign in instead.';
  if (/provider|not enabled|unsupported/i.test(msg)) {
    const name = provider === 'apple' ? 'Apple' : 'Google';
    return name + ' sign-in is not switched on yet. Use email and a password for now.';
  }
  if (/redirect/i.test(msg)) return 'This site is not on the sign-in allow list yet. Try email, or add this URL in Supabase.';
  return msg;
}
function handleError(error) {
  const msg = (error && error.message) || '';
  if (/cannot be changed once set/i.test(msg)) return 'Handle cannot be changed once set.';
  if ((error && error.code === '23505') || /duplicate key|unique constraint/i.test(msg)) return "That handle's taken, try another";
  return dbMessage(error);
}
function dbMessage(error) {
  const msg = error.message || 'Something went wrong.';
  if (/cannot be changed once set/i.test(msg)) return 'Handle cannot be changed once set.';
  if (error.code === '23505' || /duplicate|unique/i.test(msg)) return "That handle's taken, try another";
  if (/row-level security/i.test(msg)) return 'You need to be signed in to do that.';
  if (/jwt|session/i.test(msg)) return 'Your session expired. Sign in again.';
  return msg;
}
function storageMessage(error) {
  const msg = (error && (error.message || error.error)) || '';
  if (/bucket/i.test(msg) && /not found/i.test(msg)) return 'Photo storage is not ready yet. Try again shortly.';
  if (/policy|unauthorized|403|row-level/i.test(msg)) return 'Those photos were blocked. Sign in and try again.';
  return msg || 'The photo upload failed. Try a smaller JPG.';
}

function listingSelect() {
  const who = Presence.column ? 'username,display_name,last_seen_at' : 'username,display_name';
  return 'id,user_id,mode,make,model,year,kms,price,suburb,state,postcode,heading,description,engine,cylinders,turbo,supercharged,induction,transmission,rego,vin,photos,status,created_at,profiles!listings_user_id_fkey(' + who + '),likes(count),saves(count)';
}

function countOf(rel) {
  if (rel == null) return 0;
  if (typeof rel === 'number') return rel;
  if (Array.isArray(rel)) {
    if (!rel.length) return 0;
    if (typeof rel[0].count === 'number') return rel[0].count;
    return rel.length;
  }
  return typeof rel.count === 'number' ? rel.count : 0;
}
function photoUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  if (!sb) return path;
  const { data } = sb.storage.from('listing-photos').getPublicUrl(path);
  return data.publicUrl;
}
function whenLabel(iso) {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 36e5));
  if (!iso || Number.isNaN(h) || h < 1) return 'Just now';
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}
function mapListing(row) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const mode = row.mode;
  return {
    id: row.id,
    remote: true,
    demo: false,
    mode,
    sec: mode === 'supercar' ? 'supercars' : mode,
    make: row.make, model: row.model, year: row.year,
    km: row.kms, kms: row.kms, price: row.price,
    suburb: row.suburb, state: row.state, postcode: row.postcode || '',
    heading: row.heading,
    desc: row.description, description: row.description,
    engine: row.engine || '',
    cylinders: row.cylinders == null ? null : row.cylinders,
    turbo: row.induction === 'Turbo' || row.turbo === true,
    supercharged: row.induction === 'Supercharged' || (row.induction == null && row.supercharged === true),
    induction: row.induction || (row.supercharged === true ? 'Supercharged' : row.turbo === true ? 'Turbo' : 'N/A'),
    transmission: row.transmission || '',
    trans: row.transmission || '',
    rego: row.rego || '',
    vin: row.vin || '',
    photos: (row.photos && row.photos.length ? row.photos.map(photoUrl) : ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7']),
    photoPaths: Array.isArray(row.photos) ? row.photos.slice() : [],
    status: row.status,
    handle: (profile && profile.username) || 'you',
    last_seen_at: (profile && profile.last_seen_at) || '',
    when: whenLabel(row.created_at),
    likeCount: countOf(row.likes),
    liked: Auth.likes.has(row.id),
    saved: Auth.saves.has(row.id),
    likes: countOf(row.likes),
    user_id: row.user_id,
    created_at: row.created_at
  };
}
function applyListingSort(q, sort) {
  if (sort === 'price-asc') q = q.order('price', { ascending: true });
  else if (sort === 'price-desc') q = q.order('price', { ascending: false });
  else if (sort === 'year-desc') q = q.order('year', { ascending: false });
  else if (sort === 'year-asc') q = q.order('year', { ascending: true });
  else return q.order('created_at', { ascending: false });
  return q.order('created_at', { ascending: false });
}
function cylinderCount(value) {
  if (value == null || value === '' || value === 'electric') return null;
  const n = +value;
  return n >= 1 && n <= 16 ? n : null;
}
function powerLane(listing) {
  const sec = String((listing && (listing.sec || listing.mode)) || '').toLowerCase();
  return sec === 'performance' || sec === 'supercars' || sec === 'supercar';
}
function listingSpec(listing) {
  const rawTrans = String(listing.transmission || listing.trans || '').trim().toLowerCase();
  const transmission = rawTrans === 'manual' ? 'Manual' : (rawTrans === 'auto' || rawTrans === 'automatic' ? 'Auto' : null);
  const rego = String(listing.rego || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const vin = String(listing.vin || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
  if (!powerLane(listing)) {
    return { cylinders: null, induction: 'N/A', turbo: false, supercharged: false, transmission, rego: rego || null, vin: vin || null };
  }
  const induction = listing.induction === 'Turbo' || listing.induction === 'Supercharged' || listing.induction === 'N/A'
    ? listing.induction
    : (listing.supercharged === true ? 'Supercharged' : listing.turbo === true ? 'Turbo' : 'N/A');
  return {
    cylinders: cylinderCount(listing.cylinders),
    induction,
    turbo: induction === 'Turbo',
    supercharged: induction === 'Supercharged',
    transmission,
    rego: rego || null,
    vin: vin || null
  };
}
const VinOrders = {
  async create({ vin, email, listingId }) {
    if (!sb) throw new Error('Orders are offline right now.');
    const cleanVin = String(vin || '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVin)) throw new Error('VIN must be 17 characters and cannot include I, O, or Q.');
    const cleanEmail = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Add a valid email so we can send the report.');
    const listing_id = /^[0-9a-f-]{36}$/i.test(String(listingId || '')) ? listingId : null;
    const { error } = await sb.from('vin_check_orders').insert({
      vin: cleanVin,
      email: cleanEmail,
      listing_id,
      user_id: Auth.user ? Auth.user.id : null
    });
    if (error) throw new Error(error.message || 'Could not start that order.');
  }
};
const VinAsk = {
  async asked(listingId) {
    if (!sb || !Auth.user || !listingId) return false;
    const { data, error } = await sb.from('vin_requests').select('listing_id').eq('listing_id', listingId).eq('buyer_id', Auth.user.id).maybeSingle();
    if (error) throw new Error(error.message || 'Could not check that request.');
    return !!data;
  },
  async claim(listingId) {
    if (!sb || !Auth.user) throw new Error('Sign in to ask for the rego or VIN.');
    const { error } = await sb.from('vin_requests').insert({ listing_id: listingId, buyer_id: Auth.user.id });
    if (error) {
      if (error.code === '23505') return false;
      throw new Error(error.message || 'Could not save that request.');
    }
    return true;
  },
  async release(listingId) {
    if (!sb || !Auth.user || !listingId) return;
    await sb.from('vin_requests').delete().eq('listing_id', listingId).eq('buyer_id', Auth.user.id);
  }
};
function auMobile(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('61')) d = '0' + d.slice(2);
  return /^04\d{8}$/.test(d) ? d : '';
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image'));
    im.src = src;
  });
}
function wordmarkInk(im) {
  const w = 360;
  const h = Math.max(1, Math.round(w * (im.naturalHeight || 1) / (im.naturalWidth || 1)));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(im, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let ink = 0;
  for (let i = 0; i < data.length; i += 16) {
    if (Math.abs(data[i] - 255) + Math.abs(data[i + 2] - 255) > 40) ink++;
  }
  return ink;
}
function loadSvgWordmark() {
  return fetch('img/logo.svg').then(res => {
    if (!res.ok) throw new Error('logo');
    return res.text();
  }).then(text => {
    const sized = text.replace('<svg ', '<svg width="1760" height="200" ');
    const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml;charset=utf-8' }));
    return loadImage(url).finally(() => URL.revokeObjectURL(url));
  });
}
let wordmarkTask = null;
function wordmark() {
  if (!wordmarkTask) {
    wordmarkTask = loadSvgWordmark().then(im => wordmarkInk(im) > 30 ? im : Promise.reject(new Error('blank'))).catch(() => loadImage('img/logo-wordmark.png').then(im => {
      if (wordmarkInk(im) < 30) throw new Error('logo');
      return im;
    })).catch(err => { wordmarkTask = null; throw err; });
  }
  return wordmarkTask;
}
function stampWordmark(ctx, logo, w, h) {
  const aspect = (logo.naturalWidth || 1) / (logo.naturalHeight || 1);
  let logoW = Math.round(w * 0.2);
  let logoH = Math.max(1, Math.round(logoW / aspect));
  const maxH = Math.round(h * 0.28);
  if (logoH > maxH) {
    logoH = Math.max(1, maxH);
    logoW = Math.max(1, Math.round(logoH * aspect));
  }
  const pad = Math.round(Math.min(w, h) * 0.03);
  const x = Math.max(0, w - pad - logoW);
  const y = Math.max(0, h - pad - logoH);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = Math.max(2, Math.round(logoW * 0.05));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, Math.round(logoW * 0.018));
  ctx.drawImage(logo, x, y, logoW, logoH);
  ctx.restore();
}
function photoMark(){
  return '<span class="wm" aria-hidden="true">IM DRIVN</span>';
}
function preparePhoto(file) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    const url = URL.createObjectURL(file);
    im.onload = () => {
      const max = 2000;
      const scale = Math.min(1, max / Math.max(im.width || 1, im.height || 1));
      const w = Math.max(1, Math.round((im.width || 1) * scale));
      const h = Math.max(1, Math.round((im.height || 1) * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      wordmark().then(logo => {
        stampWordmark(ctx, logo, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      }).catch(() => reject(new Error('Could not stamp the photo. Try that one again.')));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    im.src = url;
  });
}
function keywordOr(word) {
  const safe = String(word || '').replace(/[%_"\\(),]/g, '').trim();
  if (!safe) return '';
  const pat = '"%' + safe + '%"';
  return ['make', 'model', 'heading', 'description'].map(col => col + '.ilike.' + pat).join(',');
}
async function dataUrlToBlob(url) {
  const res = await fetch(url);
  return res.blob();
}
async function uploadPaths(uid, dataUrls, folder) {
  const paths = [];
  for (const url of dataUrls || []) {
    if (!url) continue;
    const blob = await dataUrlToBlob(url);
    const path = folder ? `${uid}/${folder}/${crypto.randomUUID()}.jpg` : `${uid}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from('listing-photos').upload(path, blob, {
      contentType: blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg',
      upsert: false
    });
    if (error) {
      if (paths.length) await sb.storage.from('listing-photos').remove(paths);
      throw new Error(storageMessage(error));
    }
    paths.push(path);
  }
  return paths;
}
function listingPhotoPath(src) {
  if (!src || String(src).startsWith('data:')) return '';
  const marker = '/listing-photos/';
  const text = String(src);
  const at = text.indexOf(marker);
  const raw = (at >= 0 ? text.slice(at + marker.length) : (/^https?:/i.test(text) ? '' : text.replace(/^\/+/, ''))).split(/[?#]/)[0];
  if (!raw || raw.includes('..') || raw.includes('\\')) return '';
  try { return decodeURIComponent(raw); } catch (e) { return raw; }
}
async function resolveListingPhotos(uid, photos, existing) {
  const owned = new Set(existing || []);
  const next = [];
  const fresh = [];
  try {
    for (const src of photos || []) {
      if (!src) continue;
      if (String(src).startsWith('data:')) {
        const uploaded = await uploadPaths(uid, [src]);
        fresh.push(uploaded[0]);
        next.push(uploaded[0]);
        continue;
      }
      const path = listingPhotoPath(src);
      const known = !!path && path.split('/')[0] === uid && ([...owned].some(item => item === path || listingPhotoPath(item) === path) || [...owned].some(item => photoUrl(item) === src));
      if (!known) throw new Error('One of those photos is not on this ad. Remove it and add it again.');
      next.push(path);
    }
  } catch (err) {
    if (fresh.length) await sb.storage.from('listing-photos').remove(fresh);
    throw err;
  }
  return { next, fresh };
}
async function saveListingContact(listingId, uid, email, mobile) {
  const existing = await sb.from('listing_contacts').select('listing_id').eq('listing_id', listingId).eq('user_id', uid).maybeSingle();
  if (existing.error) throw new Error('The ad was updated, but your contact details did not save. ' + dbMessage(existing.error));
  if (existing.data) {
    const upd = await sb.from('listing_contacts').update({ email, mobile }).eq('listing_id', listingId).eq('user_id', uid).select('listing_id').maybeSingle();
    if (upd.error) throw new Error('The ad was updated, but your contact details did not save. ' + dbMessage(upd.error));
    if (!upd.data) throw new Error('The ad was updated, but your contact details did not save. You can only edit your own ad.');
    return;
  }
  const inserted = await sb.from('listing_contacts').insert({ listing_id: listingId, user_id: uid, email, mobile }).select('listing_id').maybeSingle();
  if (inserted.error || !inserted.data) throw new Error('The ad was updated, but your contact details did not save. ' + dbMessage(inserted.error || {}));
}

const ListingStore = {
  cache: new Map(),
  remember(rows) { rows.forEach(l => this.cache.set(l.id, l)); return rows; },
  async page({ mode, from, to, saved, filters, sort }) {
    if (!sb) return [];
    await Auth.ready;
    await Presence.ready;
    let q = sb.from('listings').select(listingSelect()).eq('status', 'active');
    if (mode && mode !== 'all') q = q.eq('mode', mode);
    if (saved) {
      if (!Auth.user) return [];
      const ids = [...Auth.saves];
      if (!ids.length) return [];
      q = q.in('id', ids);
    }
    const f = filters || {};
    if (f.make) q = q.ilike('make', f.make);
    if (f.model) q = q.ilike('model', f.model);
    if (f.year) q = q.gte('year', +f.year);
    if (f.yearTo) q = q.lte('year', +f.yearTo);
    if (f.km) q = q.lt('kms', +f.km);
    String(f.q || '').trim().split(/\s+/).filter(Boolean).forEach(word => {
      const clause = keywordOr(word);
      if (clause) q = q.or(clause);
    });
    q = applyListingSort(q, saved ? 'new' : sort);
    const { data, error } = await q.range(from, to);
    if (error) throw new Error(dbMessage(error));
    return this.remember((data || []).map(mapListing));
  },
  async get(id, fresh) {
    if (!fresh && this.cache.has(id)) return this.cache.get(id);
    if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    await Auth.ready;
    await Presence.ready;
    const { data, error } = await sb.from('listings').select(listingSelect()).eq('id', id).maybeSingle();
    if (error || !data) return null;
    return this.remember([mapListing(data)])[0];
  },
  async mine() {
    if (!sb || !Auth.user) return [];
    return this.bySeller(Auth.user.id, true);
  },
  async bySeller(userId, includeHidden) {
    if (!sb || !userId) return [];
    await Presence.ready;
    let q = sb.from('listings').select(listingSelect()).eq('user_id', userId).order('created_at', { ascending: false });
    if (!includeHidden) q = q.eq('status', 'active');
    const { data, error } = await q;
    if (error) throw new Error(dbMessage(error));
    return this.remember((data || []).map(mapListing));
  },
  async create(listing) {
    if (!sb) throw new Error('Accounts are offline right now. Try again in a moment.');
    await Auth.ready;
    if (!Auth.user) throw new Error('Sign in before you post.');
    const uid = Auth.user.id;
    if (!listing.photos || !listing.photos.length) throw new Error('Add at least one photo before you post. The first one is the cover.');
    const email = String(listing.email || '').trim();
    const mobile = auMobile(listing.mobile || listing.phone);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Add an email before you post.');
    if (!mobile) throw new Error('Use an Australian mobile, like 0412 345 678.');
    const spec = listingSpec(listing);
    if (!spec.transmission) throw new Error('Pick Auto or Manual.');
    if (powerLane(listing) && !spec.cylinders) throw new Error('Cylinders need to be a whole number from 1 to 16.');
    const paths = await uploadPaths(uid, listing.photos);
    const mode = listing.sec === 'supercars' ? 'supercar' : listing.sec;
    const row = {
      user_id: uid, mode,
      make: listing.make, model: listing.model, year: listing.year, kms: listing.km,
      price: listing.price, suburb: listing.suburb, state: listing.state, postcode: listing.postcode || null,
      heading: listing.heading, description: listing.desc,
      engine: listing.engine ? String(listing.engine).trim() : null,
      cylinders: spec.cylinders,
      induction: spec.induction,
      turbo: spec.turbo,
      supercharged: spec.supercharged,
      transmission: spec.transmission,
      rego: spec.rego,
      vin: spec.vin,
      photos: paths, status: 'active'
    };
    const inserted = await sb.from('listings').insert(row).select('id').single();
    if (inserted.error) {
      if (paths.length) await sb.storage.from('listing-photos').remove(paths);
      throw new Error(dbMessage(inserted.error));
    }
    const contact = await sb.from('listing_contacts').insert({
      listing_id: inserted.data.id,
      user_id: uid,
      email,
      mobile
    }).select('listing_id').maybeSingle();
    if (contact.error) {
      await sb.from('listings').delete().eq('id', inserted.data.id).eq('user_id', uid);
      if (paths.length) await sb.storage.from('listing-photos').remove(paths);
      throw new Error('Could not save your contact details, so the ad was not posted. ' + dbMessage(contact.error));
    }
    if (listing.name && Auth.profile && !String(Auth.profile.display_name || '').trim()) {
      const named = await sb.from('profiles').update({ display_name: listing.name }).eq('id', uid).select(ownProfileCols()).maybeSingle();
      if (!named.error && named.data) Auth.profile = named.data;
    }
    noteVehicleName(listing.make, listing.model);
    return this.get(inserted.data.id);
  },
  async contact(id) {
    if (!sb || !Auth.user) return null;
    await Auth.ready;
    const { data, error } = await sb.from('listing_contacts').select('email,mobile').eq('listing_id', id).eq('user_id', Auth.user.id).maybeSingle();
    if (error) throw new Error(dbMessage(error));
    return data || null;
  },
  async update(id, listing) {
    if (!sb) throw new Error('Accounts are offline right now. Try again in a moment.');
    await Auth.ready;
    if (!Auth.user) throw new Error('Sign in to update your ad.');
    const uid = Auth.user.id;
    const blank = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const incoming = (listing.photos || []).filter(src => src && src !== blank);
    if (!incoming.length) throw new Error('Add at least one photo before you update. The first one is the cover.');
    if (incoming.length > 8) throw new Error('8 is the max.');
    const email = String(listing.email || '').trim();
    const mobile = auMobile(listing.mobile || listing.phone);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Add an email before you update.');
    if (!mobile) throw new Error('Use an Australian mobile, like 0412 345 678.');
    const spec = listingSpec(listing);
    if (!spec.transmission) throw new Error('Pick Auto or Manual.');
    if (powerLane(listing) && !spec.cylinders) throw new Error('Cylinders need to be a whole number from 1 to 16.');
    const mode = listing.sec === 'supercars' ? 'supercar' : listing.sec;
    if (!['daily', 'performance', 'supercar'].includes(mode)) throw new Error('Pick a lane first. Daily, Performance, or Supercar.');
    const current = await sb.from('listings').select('id,photos,status').eq('id', id).eq('user_id', uid).maybeSingle();
    if (current.error) throw new Error(dbMessage(current.error));
    if (!current.data) throw new Error('You can only edit your own ad.');
    if (current.data.status !== 'active') throw new Error('Only live ads can be edited.');
    const existing = current.data.photos || [];
    const resolved = await resolveListingPhotos(uid, incoming, existing);
    const next = resolved.next;
    const fresh = resolved.fresh;
    if (!next.length) {
      if (fresh.length) await sb.storage.from('listing-photos').remove(fresh);
      throw new Error('Add at least one photo before you update. The first one is the cover.');
    }
    const row = {
      mode,
      make: listing.make, model: listing.model, year: listing.year, kms: listing.km,
      price: listing.price, suburb: listing.suburb, state: listing.state, postcode: listing.postcode || null,
      heading: listing.heading, description: listing.desc,
      engine: listing.engine ? String(listing.engine).trim() : null,
      cylinders: spec.cylinders,
      induction: spec.induction,
      turbo: spec.turbo,
      supercharged: spec.supercharged,
      transmission: spec.transmission,
      rego: spec.rego,
      vin: spec.vin,
      photos: next
    };
    const updated = await sb.from('listings').update(row).eq('id', id).eq('user_id', uid).eq('status', 'active').select('id').maybeSingle();
    if (updated.error || !updated.data) {
      if (fresh.length) await sb.storage.from('listing-photos').remove(fresh);
      if (updated.error) throw new Error(dbMessage(updated.error));
      throw new Error('Could not update that ad. You can only edit your own.');
    }
    const drop = existing.filter(item => item && !next.some(path => path === item || listingPhotoPath(item) === path)).map(item => {
      const path = listingPhotoPath(item);
      return path && path.split('/')[0] === uid ? path : '';
    }).filter(Boolean);
    if (drop.length) await sb.storage.from('listing-photos').remove(drop);
    await saveListingContact(id, uid, email, mobile);
    if (listing.name && Auth.profile && !String(Auth.profile.display_name || '').trim()) {
      const named = await sb.from('profiles').update({ display_name: listing.name }).eq('id', uid).select(ownProfileCols()).maybeSingle();
      if (!named.error && named.data) Auth.profile = named.data;
    }
    noteVehicleName(listing.make, listing.model);
    this.cache.delete(id);
    return this.get(id);
  },
  async markSold(id) {
    if (!sb || !Auth.user) throw new Error('Sign in to update your ad.');
    const { data, error } = await sb.from('listings').update({ status: 'sold' }).eq('id', id).eq('user_id', Auth.user.id).select('id,status').maybeSingle();
    if (error) throw new Error(dbMessage(error));
    if (!data) throw new Error('Could not mark that sold. You can only do this on your own ad.');
    const cached = this.cache.get(id);
    if (cached) cached.status = 'sold';
    return data;
  },
  async react(kind, id, on) {
    if (!sb || !Auth.user) throw new Error('Sign in to save cars to your account.');
    const table = kind === 'save' ? 'saves' : 'likes';
    const set = kind === 'save' ? Auth.saves : Auth.likes;
    if (on) {
      const { error } = await sb.from(table).insert({ user_id: Auth.user.id, listing_id: id });
      if (error && error.code !== '23505') throw new Error(dbMessage(error));
      set.add(id);
    } else {
      const { error } = await sb.from(table).delete().eq('user_id', Auth.user.id).eq('listing_id', id);
      if (error) throw new Error(dbMessage(error));
      set.delete(id);
    }
    const cached = this.cache.get(id);
    if (cached) {
      if (kind === 'save') cached.saved = on;
      else { cached.liked = on; cached.likeCount = Math.max(0, (cached.likeCount || 0) + (on ? 1 : -1)); cached.likes = cached.likeCount; }
    }
  },
  async valuation(d) {
    if (!sb) throw new Error('Accounts are offline right now. Try again in a moment.');
    await Auth.ready;
    if (!Auth.user) throw new Error('Sign in so dealers know who the offer is for.');
    const paths = await uploadPaths(Auth.user.id, d.photos || [], 'valuations');
    const rawPrice = d.expected_price != null && d.expected_price !== '' ? d.expected_price : d.expected;
    const price = rawPrice === '' || rawPrice == null ? null : +rawPrice;
    const ratings = ['Excellent', 'Good', 'Fair', 'Needs work'];
    const exterior = ratings.includes(d.exterior) ? d.exterior : (ratings.includes(d.overall) ? d.overall : '');
    const interior = ratings.includes(d.interior) ? d.interior : '';
    if (!exterior || !interior) throw new Error('Tap exterior and interior.');
    const condition = {
      overall: exterior,
      exterior,
      interior,
      accident: d.accident === 'yes',
      service: d.service,
      finance: d.finance === 'yes',
      keys: d.keys,
      mods: d.mods === 'yes',
      mods_note: d.modsNote || ''
    };
    if (d.regoState) condition.rego_state = d.regoState;
    const { error } = await sb.from('valuations').insert({
      user_id: Auth.user.id,
      make: d.make, model: d.model, year: +d.year, kms: +d.kms,
      variant: d.variant || null,
      rego: d.rego || null,
      vin: d.vin ? String(d.vin).toUpperCase() : null,
      suburb: d.suburb, state: d.state, postcode: d.postcode || null,
      condition, photos: paths,
      contact_name: d.name, contact_email: d.email, contact_phone: d.phone,
      expected_price: price,
      status: 'submitted'
    });
    if (error) {
      if (paths.length) await sb.storage.from('listing-photos').remove(paths);
      throw new Error(error.message || 'Could not send that.');
    }
  }
};

function forumErr(error) {
  const msg = (error && error.message) || '';
  if (/row-level security|permission/i.test(msg)) return 'Sign in with a handle to post.';
  if (/title/i.test(msg) && /check|140/i.test(msg)) return 'Title needs to be between 3 and 140 characters.';
  return dbMessage(error);
}
const Forum = {
  async categories() {
    if (!sb) throw new Error('Forum is offline right now.');
    const { data, error } = await sb.from('forum_categories')
      .select('id, slug, name, description, sort, forum_threads(count), latest:forum_threads(id, title, last_activity_at)')
      .order('sort', { ascending: true })
      .order('last_activity_at', { referencedTable: 'latest', ascending: false })
      .limit(1, { referencedTable: 'latest' });
    if (error) throw new Error(forumErr(error));
    return data || [];
  },
  async category(slug) {
    if (!sb) throw new Error('Forum is offline right now.');
    const { data, error } = await sb.from('forum_categories').select('id, slug, name, description').eq('slug', slug).maybeSingle();
    if (error) throw new Error(forumErr(error));
    return data;
  },
  async threads(categoryId) {
    await Presence.ready;
    const who = Presence.column ? 'profiles(username,last_seen_at)' : 'profiles(username)';
    const { data, error } = await sb.from('forum_threads')
      .select('id, title, created_at, last_activity_at, reply_count, author_id, ' + who)
      .eq('category_id', categoryId)
      .order('last_activity_at', { ascending: false });
    if (error) throw new Error(forumErr(error));
    return data || [];
  },
  async thread(id) {
    if (!/^[0-9a-f-]{8,}$/i.test(String(id)) && !/^\d+$/.test(String(id))) return null;
    await Presence.ready;
    const who = Presence.column ? 'profiles(username,last_seen_at)' : 'profiles(username)';
    const thread = await sb.from('forum_threads')
      .select('id, category_id, author_id, title, body, created_at, last_activity_at, reply_count, ' + who + ', forum_categories(slug, name)')
      .eq('id', id).maybeSingle();
    if (thread.error) {
      if (/invalid input syntax|22P02/i.test(thread.error.message || '')) return null;
      throw new Error(forumErr(thread.error));
    }
    if (!thread.data) return null;
    const replies = await sb.from('forum_replies')
      .select('id, thread_id, author_id, body, created_at, ' + who)
      .eq('thread_id', id).order('created_at', { ascending: true });
    if (replies.error) throw new Error(forumErr(replies.error));
    return { thread: thread.data, replies: replies.data || [] };
  },
  async createThread(categoryId, title, body) {
    const { data, error } = await sb.from('forum_threads')
      .insert({ category_id: categoryId, author_id: Auth.user.id, title, body })
      .select('id').single();
    if (error) throw new Error(forumErr(error));
    return data;
  },
  async updateThread(id, title, body) {
    const { error } = await sb.from('forum_threads').update({ title, body }).eq('id', id).eq('author_id', Auth.user.id);
    if (error) throw new Error(forumErr(error));
  },
  async deleteThread(id) {
    const { error } = await sb.from('forum_threads').delete().eq('id', id).eq('author_id', Auth.user.id);
    if (error) throw new Error(forumErr(error));
  },
  async reply(threadId, body) {
    const { data, error } = await sb.from('forum_replies').insert({ thread_id: threadId, author_id: Auth.user.id, body }).select('id').single();
    if (error) throw new Error(forumErr(error));
    return data;
  },
  async updateReply(id, body) {
    const { error } = await sb.from('forum_replies').update({ body }).eq('id', id).eq('author_id', Auth.user.id);
    if (error) throw new Error(forumErr(error));
  },
  async deleteReply(id) {
    const { error } = await sb.from('forum_replies').delete().eq('id', id).eq('author_id', Auth.user.id);
    if (error) throw new Error(forumErr(error));
  }
};

function garagePhotoUrl(photo) {
  if (!photo) return '';
  if (/^https?:\/\//i.test(photo) || photo.startsWith('data:')) return photo;
  if (!sb) return photo;
  const { data } = sb.storage.from('garage-photos').getPublicUrl(photo);
  return data.publicUrl;
}
function garageStoragePath(photo) {
  if (!photo) return '';
  if (!/^https?:/i.test(photo)) return String(photo).replace(/^\/+/, '');
  const mark = '/garage-photos/';
  const at = photo.indexOf(mark);
  if (at < 0) return '';
  try { return decodeURIComponent(photo.slice(at + mark.length).split('?')[0]); }
  catch (e) { return photo.slice(at + mark.length).split('?')[0]; }
}
function garageErr(error) {
  const msg = (error && error.message) || '';
  if (/row-level security|permission/i.test(msg)) return 'Sign in with a handle to change your garage.';
  if (/jwt|session/i.test(msg)) return 'Your session expired. Sign in again.';
  return msg || 'Could not update the garage.';
}
function mapGarageCar(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    make: row.make || '',
    model: row.model || '',
    photo_url: row.photo_url || '',
    src: garagePhotoUrl(row.photo_url),
    created_at: row.created_at
  };
}
const Garage = {
  async profile(handle) {
    if (!sb) return null;
    const name = Auth.cleanHandle(handle);
    if (!Auth.handleOk(name)) return null;
    const pattern = name.replace(/[\\%_]/g, ch => '\\' + ch);
    await Presence.ready;
    const cols = 'id,username,created_at' + (Presence.column ? ',last_seen_at' : '');
    const { data, error } = await sb.from('profiles').select(cols).ilike('username', pattern).limit(5);
    if (error) throw new Error(garageErr(error));
    return (data || []).find(row => String(row.username || '').toLowerCase() === name) || null;
  },
  async cars(userId) {
    if (!sb || !userId) return [];
    const { data, error } = await sb.from('garage_cars').select('id,user_id,make,model,photo_url,created_at').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(garageErr(error));
    return (data || []).map(mapGarageCar);
  },
  async add(make, model, dataUrl) {
    if (!sb || !Auth.user) throw new Error('Sign in to add a car.');
    if (Auth.needsHandle()) throw new Error('Choose a handle first.');
    const mk = String(make || '').trim();
    const md = String(model || '').trim();
    if (!mk || !md || mk.length > 40 || md.length > 40) throw new Error('Make and model need 1–40 characters.');
    const uid = Auth.user.id;
    const blob = await dataUrlToBlob(dataUrl);
    const path = uid + '/' + crypto.randomUUID() + '.jpg';
    const up = await sb.storage.from('garage-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw new Error(storageMessage(up.error));
    const ins = await sb.from('garage_cars').insert({ user_id: uid, make: mk, model: md, photo_url: path }).select('id,user_id,make,model,photo_url,created_at').single();
    if (ins.error) {
      await sb.storage.from('garage-photos').remove([path]);
      throw new Error(garageErr(ins.error));
    }
    return mapGarageCar(ins.data);
  },
  async remove(id) {
    if (!sb || !Auth.user) throw new Error('Sign in to change your garage.');
    const existing = await sb.from('garage_cars').select('photo_url').eq('id', id).eq('user_id', Auth.user.id).maybeSingle();
    const del = await sb.from('garage_cars').delete().eq('id', id).eq('user_id', Auth.user.id);
    if (del.error) throw new Error(garageErr(del.error));
    const path = garageStoragePath(existing.data && existing.data.photo_url);
    if (path && path.startsWith(Auth.user.id + '/')) await sb.storage.from('garage-photos').remove([path]);
  }
};

function chatErr(error) {
  const msg = (error && error.message) || '';
  if (/row-level security|permission/i.test(msg)) return 'You need to be signed in to do that.';
  if (/jwt|session/i.test(msg)) return 'Your session expired. Sign in again.';
  if (/2000|body/i.test(msg) && /check|length/i.test(msg)) return 'Keep the message between 1 and 2000 characters.';
  return msg || 'Could not do that.';
}
function chatUnread(row, uid) {
  if (!row || !uid) return false;
  if (!row.last_message_at && !row.last_message) return false;
  const read = row.buyer_id === uid ? row.buyer_last_read : row.seller_last_read;
  if (!read) return true;
  if (!row.last_message_at) return false;
  return Date.parse(row.last_message_at) > Date.parse(read);
}
const Chat = {
  unread: chatUnread,
  async unreadIds() {
    if (!sb || !Auth.user) return new Set();
    const { data, error } = await sb.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', Auth.user.id);
    if (error) throw new Error(chatErr(error));
    return new Set((data || []).map(row => row.conversation_id));
  },
  async inbox() {
    if (!sb || !Auth.user) return [];
    const uid = Auth.user.id;
    const { data, error } = await sb.from('conversations')
      .select('id,listing_id,buyer_id,seller_id,created_at,last_message_at,last_message,buyer_last_read,seller_last_read')
      .or('buyer_id.eq.' + uid + ',seller_id.eq.' + uid)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) throw new Error(chatErr(error));
    const rows = (data || []).slice().sort((a, b) => Date.parse(b.last_message_at || b.created_at || 0) - Date.parse(a.last_message_at || a.created_at || 0));
    const listingIds = [...new Set(rows.map(r => r.listing_id).filter(Boolean))];
    const peopleIds = [...new Set(rows.flatMap(r => [r.buyer_id, r.seller_id]).filter(Boolean))];
    await Presence.ready;
    const peopleCols = Presence.column ? 'id,username,last_seen_at' : 'id,username';
    const [listings, profiles] = await Promise.all([
      listingIds.length ? sb.from('listings').select('id,heading,year,make,model,photos,price,mode').in('id', listingIds) : { data: [] },
      peopleIds.length ? sb.from('profiles').select(peopleCols).in('id', peopleIds) : { data: [] }
    ]);
    const listingById = new Map((listings.data || []).map(l => [l.id, l]));
    const handleById = new Map((profiles.data || []).map(p => [p.id, p.username]));
    const seenById = new Map((profiles.data || []).map(p => [p.id, p.last_seen_at || '']));
    let unreadIds = null;
    try { unreadIds = await this.unreadIds(); } catch (e) { unreadIds = null; }
    return rows.map(row => {
      const listing = listingById.get(row.listing_id) || {};
      const other = row.buyer_id === uid ? row.seller_id : row.buyer_id;
      const photos = listing.photos || [];
      return {
        id: row.id,
        listingId: row.listing_id,
        buyer_id: row.buyer_id,
        seller_id: row.seller_id,
        last: row.last_message || '',
        when: whenLabel(row.last_message_at || row.created_at),
        unread: unreadIds ? unreadIds.has(row.id) : chatUnread(row, uid),
        handle: handleById.get(other) || 'member',
        last_seen_at: seenById.get(other) || '',
        heading: listing.heading || [listing.year, listing.make, listing.model].filter(Boolean).join(' ') || 'Listing',
        price: listing.price,
        mode: listing.mode || '',
        thumb: photos.length ? photoUrl(photos[0]) : ''
      };
    });
  },
  async open(listing) {
    if (!sb || !Auth.user) throw new Error('Sign in to message the seller.');
    const uid = Auth.user.id;
    const found = await sb.from('conversations').select('id').eq('listing_id', listing.id).eq('buyer_id', uid).maybeSingle();
    if (found.error) throw new Error(chatErr(found.error));
    if (found.data) return found.data;
    const inserted = await sb.from('conversations').insert({
      listing_id: listing.id,
      buyer_id: uid,
      seller_id: listing.user_id
    }).select('id').single();
    if (inserted.error) {
      if (inserted.error.code === '23505') {
        const again = await sb.from('conversations').select('id').eq('listing_id', listing.id).eq('buyer_id', uid).maybeSingle();
        if (again.data) return again.data;
      }
      throw new Error(chatErr(inserted.error));
    }
    return inserted.data;
  },
  async get(id) {
    if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data, error } = await sb.from('conversations').select('id,listing_id,buyer_id,seller_id,created_at,last_message_at,last_message,buyer_last_read,seller_last_read').eq('id', id).maybeSingle();
    if (error) throw new Error(chatErr(error));
    return data;
  },
  async messages(id) {
    const { data, error } = await sb.from('messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', id).order('created_at', { ascending: true });
    if (error) throw new Error(chatErr(error));
    return data || [];
  },
  async send(id, body) {
    const text = String(body || '').trim();
    if (!text || text.length > 2000) throw new Error('Keep the message between 1 and 2000 characters.');
    const { data, error } = await sb.from('messages').insert({
      conversation_id: id,
      sender_id: Auth.user.id,
      body: text
    }).select('id,conversation_id,sender_id,body,created_at').single();
    if (error) throw new Error(chatErr(error));
    Presence.nudge();
    return data;
  },
  async markRead(conv, stamp) {
    if (!sb || !Auth.user || !conv) return;
    const col = conv.buyer_id === Auth.user.id ? 'buyer_last_read' : 'seller_last_read';
    const when = stamp || new Date().toISOString();
    const { error } = await sb.from('conversations').update({ [col]: when }).eq('id', conv.id);
    if (error) throw new Error(chatErr(error));
    conv[col] = when;
  },
  async markOpened(conv) {
    if (!sb || !Auth.user || !conv) return;
    const when = new Date().toISOString();
    const marked = await sb.from('messages').update({ read_at: when }).eq('conversation_id', conv.id).neq('sender_id', Auth.user.id).is('read_at', null);
    if (marked.error) throw new Error(chatErr(marked.error));
    await this.markRead(conv, when);
    try { await Notes.markReadForConversation(conv.id); } catch (e) {}
  },
  async unreadCount() {
    if (!sb || !Auth.user) return 0;
    try { return (await this.unreadIds()).size; } catch (e) { return 0; }
  }
};

function noteErr(error) {
  return (error && error.message) || 'Could not load notifications.';
}
const Notes = {
  async list() {
    if (!sb || !Auth.user) return [];
    await Presence.ready;
    const { data, error } = await sb.from('notifications')
      .select('id,kind,actor_id,thread_id,reply_id,conversation_id,message_id,thread_title,preview,read_at,created_at,actor:profiles!notifications_actor_id_fkey(' + (Presence.column ? 'username,last_seen_at' : 'username') + '),thread:forum_threads!notifications_thread_id_fkey(title,author_id)')
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) throw new Error(noteErr(error));
    const uid = Auth.user.id;
    return (data || []).map(row => {
      const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
      const thread = Array.isArray(row.thread) ? row.thread[0] : row.thread;
      return {
        id: row.id,
        kind: row.kind || 'reply',
        threadId: row.thread_id,
        replyId: row.reply_id,
        conversationId: row.conversation_id,
        messageId: row.message_id,
        preview: row.preview || '',
        handle: actor && actor.username ? String(actor.username).replace(/^@/, '') : '',
        last_seen_at: (actor && actor.last_seen_at) || '',
        title: (thread && thread.title) || row.thread_title || '',
        yours: !!(thread && thread.author_id === uid),
        read: !!row.read_at,
        when: whenLabel(row.created_at)
      };
    });
  },
  async unreadCount() {
    if (!sb || !Auth.user) return 0;
    const { count, error } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    if (error) return 0;
    return count || 0;
  },
  async markRead(id) {
    if (!sb || !Auth.user || !id) return;
    const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
    if (error) throw new Error(noteErr(error));
  },
  async markReadForReply(replyId) {
    if (!sb || !Auth.user || !replyId) return;
    const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('reply_id', replyId).is('read_at', null);
    if (error) throw new Error(noteErr(error));
  },
  async markReadForConversation(conversationId) {
    if (!sb || !Auth.user || !conversationId) return;
    const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('kind', 'message').is('read_at', null);
    if (error) throw new Error(noteErr(error));
  }
};
const REPORT_REASONS = ['Scam/fake listing', 'Wrong details', 'Already sold', 'Offensive content', 'Other'];
const Reports = {
  reasons: REPORT_REASONS,
  async submit(listingId, reason, details) {
    if (!sb || !Auth.user) throw new Error('Sign in to report an ad.');
    if (!REPORT_REASONS.includes(reason)) throw new Error('Choose a reason.');
    const note = String(details || '').trim();
    if (note.length > 2000) throw new Error('Keep the details under 2000 characters.');
    const { error } = await sb.from('ad_reports').insert({
      listing_id: listingId,
      reporter_id: Auth.user.id,
      reason,
      details: note || null
    });
    if (error) {
      if (error.code === '23505') throw new Error('You already reported this ad.');
      if (/row-level security|permission/i.test(error.message || '')) throw new Error('Sign in to report an ad.');
      throw new Error(error.message || 'Could not send that report.');
    }
  },
  async open() {
    if (!sb || !Auth.user) return [];
    await Presence.ready;
    const { data, error } = await sb.from('ad_reports')
      .select('id,listing_id,reason,details,status,created_at,reporter:profiles!ad_reports_reporter_id_fkey(' + (Presence.column ? 'username,last_seen_at' : 'username') + '),listing:listings!ad_reports_listing_id_fkey(id,heading,year,make,model,user_id,status)')
      .eq('status', 'open')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message || 'Could not load reports.');
    return (data || []).map(row => {
      const reporter = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
      const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing;
      const title = listing ? (listing.heading || [listing.year, listing.make, listing.model].filter(Boolean).join(' ')) : '';
      return {
        id: row.id,
        listingId: row.listing_id,
        reason: row.reason,
        details: row.details || '',
        when: whenLabel(row.created_at),
        reporter: reporter && reporter.username ? String(reporter.username).replace(/^@/, '') : '',
        last_seen_at: (reporter && reporter.last_seen_at) || '',
        title: title || 'Listing',
        sellerId: listing && listing.user_id || '',
        status: row.status
      };
    });
  },
  async review(id) {
    if (!sb || !Auth.user) throw new Error('Sign in to review reports.');
    const { error } = await sb.from('ad_reports').update({ status: 'reviewed' }).eq('id', id).eq('status', 'open');
    if (error) throw new Error(error.message || 'Could not update that report.');
  }
};
function newsMissing(error) {
  const msg = ((error && (error.message || error.details)) || '') + ' ' + ((error && error.code) || '');
  return /PGRST205|42P01|schema cache|does not exist|news_articles/i.test(msg);
}
function newsImageUrl(path) {
  const raw = String(path || '').trim();
  if (!raw || /[\s"'<>\\]/.test(raw) || /^javascript:/i.test(raw) || raw.startsWith('data:')) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!sb) return '';
  const { data } = sb.storage.from('news-images').getPublicUrl(raw.replace(/^\/+/, ''));
  const url = (data && data.publicUrl) || '';
  return /[\s"'<>\\]/.test(url) ? '' : url;
}
const News = {
  pageSize: 12,
  cats: [['mods','Mods'],['manufacturer','Manufacturer'],['events','Events'],['reviews','Reviews'],['general','General']],
  async list(category, from) {
    if (!sb) return { rows: [], missing: true };
    const start = Math.max(0, from || 0);
    const end = start + this.pageSize - 1;
    let q = sb.from('news_articles')
      .select('id,slug,title,summary,cover_image_url,category,published_at')
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });
    if (category) q = q.eq('category', category);
    const { data, error } = await q.range(start, end);
    if (error) return newsMissing(error) ? { rows: [], missing: true } : { rows: [], failed: true };
    return { rows: data || [] };
  },
  async get(slug) {
    const clean = String(slug || '').trim();
    if (!sb || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(clean)) return { row: null };
    const { data, error } = await sb.from('news_articles')
      .select('id,slug,title,summary,body,cover_image_url,image_urls,category,tags,source_name,source_url,author,status,published_at,instagram_post_url')
      .eq('slug', clean)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .maybeSingle();
    if (error) return newsMissing(error) ? { row: null, missing: true } : { row: null, failed: true };
    return { row: data || null };
  }
};
function noteLine(note) {
  const who = '@' + (note.handle || 'driver');
  const title = note.title || 'a thread';
  return note.yours ? who + ' replied to your thread "' + title + '"' : who + ' replied in "' + title + '"';
}
