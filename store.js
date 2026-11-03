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
    const [profile, likes, saves] = await Promise.all([
      sb.from('profiles').select('id,username,display_name,avatar_url').eq('id', this.user.id).maybeSingle(),
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
    let res = await sb.from('profiles').update({ username }).eq('id', id).select('id,username,display_name,avatar_url').maybeSingle();
    if (res.error) throw new Error(handleError(res.error));
    if (!res.data) {
      res = await sb.from('profiles').insert({ id, username }).select('id,username,display_name,avatar_url').single();
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

const LISTING_SELECT = 'id,user_id,mode,make,model,year,kms,price,suburb,state,postcode,heading,description,photos,status,created_at,profiles!listings_user_id_fkey(username,display_name),likes(count),saves(count)';

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
    photos: (row.photos && row.photos.length ? row.photos.map(photoUrl) : ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7']),
    status: row.status,
    handle: (profile && profile.username) || 'you',
    when: whenLabel(row.created_at),
    likeCount: countOf(row.likes),
    liked: Auth.likes.has(row.id),
    saved: Auth.saves.has(row.id),
    likes: countOf(row.likes),
    comments: 0,
    user_id: row.user_id,
    created_at: row.created_at
  };
}
function likePattern(value) {
  return '%' + String(value || '').replace(/[%_,]/g, '') + '%';
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

const ListingStore = {
  cache: new Map(),
  remember(rows) { rows.forEach(l => this.cache.set(l.id, l)); return rows; },
  async page({ mode, from, to, saved, filters }) {
    if (!sb) return [];
    await Auth.ready;
    let q = sb.from('listings').select(LISTING_SELECT).eq('mode', mode).eq('status', 'active').order('created_at', { ascending: false });
    if (saved) {
      if (!Auth.user) return [];
      const ids = [...Auth.saves];
      if (!ids.length) return [];
      q = q.in('id', ids);
    }
    const f = filters || {};
    if (f.make) q = q.ilike('make', likePattern(f.make));
    if (f.model) q = q.ilike('model', likePattern(f.model));
    if (f.year) q = q.gte('year', +f.year);
    if (f.km) q = q.lte('kms', +f.km);
    const { data, error } = await q.range(from, to);
    if (error) throw new Error(dbMessage(error));
    return this.remember((data || []).map(mapListing));
  },
  async get(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    await Auth.ready;
    const { data, error } = await sb.from('listings').select(LISTING_SELECT).eq('id', id).maybeSingle();
    if (error || !data) return null;
    return this.remember([mapListing(data)])[0];
  },
  async mine() {
    if (!sb || !Auth.user) return [];
    const { data, error } = await sb.from('listings').select(LISTING_SELECT).eq('user_id', Auth.user.id).order('created_at', { ascending: false });
    if (error) throw new Error(dbMessage(error));
    return this.remember((data || []).map(mapListing));
  },
  async create(listing) {
    if (!sb) throw new Error('Accounts are offline right now. Try again in a moment.');
    await Auth.ready;
    if (!Auth.user) throw new Error('Sign in before you post.');
    const uid = Auth.user.id;
    const paths = await uploadPaths(uid, listing.photos);
    const mode = listing.sec === 'supercars' ? 'supercar' : listing.sec;
    const row = {
      user_id: uid, mode,
      make: listing.make, model: listing.model, year: listing.year, kms: listing.km,
      price: listing.price, suburb: listing.suburb, state: listing.state, postcode: listing.postcode || null,
      heading: listing.heading, description: listing.desc, photos: paths, status: 'active'
    };
    const inserted = await sb.from('listings').insert(row).select('id').single();
    if (inserted.error) {
      if (paths.length) await sb.storage.from('listing-photos').remove(paths);
      throw new Error(dbMessage(inserted.error));
    }
    if (listing.name && Auth.profile && !String(Auth.profile.display_name || '').trim()) {
      const named = await sb.from('profiles').update({ display_name: listing.name }).eq('id', uid).select('id,username,display_name,avatar_url').maybeSingle();
      if (!named.error && named.data) Auth.profile = named.data;
    }
    return this.get(inserted.data.id);
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
  async valuation(d, imgs) {
    if (!sb) throw new Error('Accounts are offline right now. Try again in a moment.');
    await Auth.ready;
    if (!Auth.user) throw new Error('Sign in so dealers know who the offer is for.');
    const paths = await uploadPaths(Auth.user.id, imgs, 'valuations');
    const rego = String(d.rego || '').trim();
    const looksVin = /^[A-HJ-NPR-Z0-9]{17}$/i.test(rego);
    const condition = [d.cond, d.hist && ('service history: ' + d.hist), d.acc && ('accident damage: ' + d.acc), d.fin && ('finance owing: ' + d.fin), d.notes].filter(Boolean).join(' · ');
    const { error } = await sb.from('valuations').insert({
      user_id: Auth.user.id,
      make: d.make, model: d.model, year: d.year ? +d.year : null, kms: d.km === '' || d.km == null ? null : +d.km,
      suburb: d.suburb || null, state: d.state || null,
      rego: looksVin ? null : (rego || null),
      vin: looksVin ? rego.toUpperCase() : null,
      condition: condition || null,
      contact_name: d.name || null,
      contact_email: d.email || null,
      contact_phone: d.phone || null,
      photos: paths
    });
    if (error) {
      if (paths.length) await sb.storage.from('listing-photos').remove(paths);
      throw new Error(dbMessage(error));
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
    const { data, error } = await sb.from('forum_threads')
      .select('id, title, created_at, last_activity_at, reply_count, author_id, profiles(username)')
      .eq('category_id', categoryId)
      .order('last_activity_at', { ascending: false });
    if (error) throw new Error(forumErr(error));
    return data || [];
  },
  async thread(id) {
    if (!/^[0-9a-f-]{8,}$/i.test(String(id)) && !/^\d+$/.test(String(id))) return null;
    const thread = await sb.from('forum_threads')
      .select('id, category_id, author_id, title, body, created_at, last_activity_at, reply_count, profiles(username), forum_categories(slug, name)')
      .eq('id', id).maybeSingle();
    if (thread.error) {
      if (/invalid input syntax|22P02/i.test(thread.error.message || '')) return null;
      throw new Error(forumErr(thread.error));
    }
    if (!thread.data) return null;
    const replies = await sb.from('forum_replies')
      .select('id, thread_id, author_id, body, created_at, profiles(username)')
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
    const { error } = await sb.from('forum_replies').insert({ thread_id: threadId, author_id: Auth.user.id, body });
    if (error) throw new Error(forumErr(error));
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
