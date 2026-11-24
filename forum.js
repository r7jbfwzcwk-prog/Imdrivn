/* IM DRIVN forum. User text is set with textContent only. */
function forumClose() {
  const btn = fEl('button', { type: 'button', class: 'menu-close page-close', 'aria-label': 'Close' });
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';
  btn.addEventListener('click', e => {
    e.preventDefault();
    if (location.hash !== '#/') location.hash = '#/';
  });
  return btn;
}
function fEl(tag, attrs, text) {
  const node = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(key => {
    if (key === 'class') node.className = attrs[key];
    else if (attrs[key] != null) node.setAttribute(key, attrs[key]);
  });
  if (text != null) node.textContent = text;
  return node;
}
function fHandleNode(row) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const name = profile && profile.username ? String(profile.username).replace(/^@/, '') : '';
  const node = !name
    ? fEl('span', { class: 'fhandle' }, '@driver')
    : fEl('a', { class: 'fhandle', href: '#/u/' + encodeURIComponent(name) }, '@' + name);
  const fresh = bestSeen(name, profile && profile.last_seen_at);
  if (fresh.self) node.setAttribute('data-self-presence', '1');
  if (typeof ogInline === 'function') node.insertAdjacentHTML('beforeend', ogInline(profile && profile.og_number));
  if (profile && profile.member_verified === true) node.insertAdjacentHTML('beforeend', memberTick(true));
  if (Presence.online(fresh.stamp)) node.insertAdjacentHTML('beforeend', Presence.dot(fresh.stamp));
  return node;
}
function fCount(rel) {
  if (!rel) return 0;
  if (Array.isArray(rel)) return rel[0] && typeof rel[0].count === 'number' ? rel[0].count : 0;
  return typeof rel.count === 'number' ? rel.count : 0;
}
function fMine(authorId) {
  return !!(Auth.user && authorId && Auth.user.id === authorId);
}
function fSendToJoin() {
  setAuthNext( location.hash.replace(/^#\//, ''));
  location.hash = '#/join';
}
function fCanPost() {
  return !!(Auth.user && !Auth.needsHandle());
}
function fGateButton() {
  const label = Auth.user ? 'Choose your @handle to post' : 'Sign in to post';
  const button = fEl('button', { class: 'btn solid', type: 'button' }, label);
  button.addEventListener('click', fSendToJoin);
  return button;
}
function fError(parent, error) {
  const line = fEl('p', { class: 'err', role: 'alert' }, (error && error.message) || 'Could not do that.');
  parent.prepend(line);
}
function fMeta(row, whenIso) {
  const meta = fEl('div', { class: 'fmeta' });
  meta.append(fHandleNode(row), fEl('time', null, whenLabel(whenIso)));
  return meta;
}
function fActions(authorId, onEdit, onDelete) {
  if (!fMine(authorId) && !(typeof canSeeReports === 'function' && canSeeReports())) return null;
  const row = fEl('div', { class: 'factions' });
  if (fMine(authorId)) {
    const edit = fEl('button', { class: 'auth-link', type: 'button' }, 'Edit');
    const del = fEl('button', { class: 'auth-link', type: 'button' }, 'Delete');
    edit.addEventListener('click', onEdit);
    del.addEventListener('click', () => {
      if (row.querySelector('.fconfirm')) return;
      const box = fEl('div', { class: 'fconfirm' });
      box.append(fEl('p', null, 'Delete this? It is gone for good.'));
      const actions = fEl('div', { class: 'auth-row' });
      const yes = fEl('button', { class: 'btn solid', type: 'button' }, 'Delete');
      const no = fEl('button', { class: 'btn', type: 'button' }, 'Never mind');
      no.addEventListener('click', () => box.remove());
      yes.addEventListener('click', async () => { yes.disabled = true; try { await onDelete(); } catch (e) { yes.disabled = false; fError(box, e); } });
      actions.append(yes, no);
      box.append(actions);
      row.append(box);
    });
    row.append(edit, del);
  }
  return row;
}
function fAdminRemove(row, isThread, after) {
  if (!(typeof canSeeReports === 'function' && canSeeReports())) return null;
  const button = fEl('button', { class: 'btn admin-del', type: 'button' }, 'Remove');
  button.addEventListener('click', () => askRemove(isThread ? 'Remove this thread?' : 'Remove this reply?', async reason => {
    if (isThread) await AdminMod.removeThread(row.id, reason);
    else await AdminMod.removePost(row.id, reason);
    toast('Removed.');
    after();
  }));
  return button;
}

function duckText(text) {
  return String(text || '').replace(/\b(?:motherfuckers?|fuck(?:ers?|ing|ed|s)?|shit(?:ty|ting|s)?|bullshit|bitch(?:es)?|bastards?|cunts?|assholes?|dickheads?|wankers?|twats?|pricks?|bollocks|piss(?:ed|ing|es)?)\b/gi, '🦆');
}
function fHighlight(text, words) {
  const frag = document.createDocumentFragment();
  const source = duckText(text);
  const safe = (words || []).map(word => String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
  if (!safe.length) { frag.append(source); return frag; }
  const re = new RegExp(safe.join('|'), 'ig');
  let last = 0;
  source.replace(re, (match, index) => {
    if (index > last) frag.append(source.slice(last, index));
    const mark = document.createElement('mark');
    mark.textContent = match;
    frag.append(mark);
    last = index + match.length;
    return match;
  });
  if (last < source.length) frag.append(source.slice(last));
  return frag;
}
function openForumSearch() {
  const panel = document.getElementById('fspanel');
  const button = document.getElementById('forumsearch');
  if (!panel) return;
  panel.hidden = false;
  if (button) button.setAttribute('aria-expanded', 'true');
  const field = panel.querySelector('input');
  const current = hashParts().params.get('q') || '';
  if (field && !field.value) field.value = current;
  if (typeof focusSearch === 'function') focusSearch(panel);
  else if (field && window.innerWidth > 768) field.focus();
  if (typeof syncSearchLayout === 'function') syncSearchLayout();
}
function closeForumSearch() {
  const panel = document.getElementById('fspanel');
  const button = document.getElementById('forumsearch');
  const inside = panel && panel.contains(document.activeElement);
  if (panel) panel.hidden = true;
  if (button) { button.setAttribute('aria-expanded', 'false'); if (inside) button.focus(); }
  if (typeof syncSearchLayout === 'function') syncSearchLayout();
}
function forumQuery() {
  return String(hashParts().params.get('q') || '').replace(/\s+/g, ' ').trim();
}
async function forumMember(token) {
  try { await Auth.ready; } catch (e) {}
  if (token != null && token !== viewToken) return false;
  if (Auth.user && !Auth.needsHandle()) return true;
  const next = (location.hash || '#/forum').replace(/^#\//, '') || 'forum';
  try { setAuthNext( next); } catch (e) {}
  if (location.hash !== '#/join') location.hash = '#/join';
  else if (typeof join === 'function') join();
  return false;
}

const BOARD_ICON = {
  live: '<svg viewBox="0 0 24 24"><path d="M5 6.5h10a2.5 2.5 0 0 1 2.5 2.5v4.2A2.5 2.5 0 0 1 15 15.7h-3.2L8 18.8v-3.1H5A2.5 2.5 0 0 1 2.5 13.2V9A2.5 2.5 0 0 1 5 6.5z"/><path d="M17.2 8.2h1.3A2.5 2.5 0 0 1 21 10.7v3.4A2.5 2.5 0 0 1 18.5 16H18"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.4a2.6 2.6 0 1 1 2.7 2.7c-.7.2-1 .7-1 1.35"/><circle cx="12" cy="16.55" r=".85"/></svg>',
  mods: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.8"/><path d="M12 4.2l.95 1.9 2.05-.35 1.05 1.85 1.9 1.05-.35 2.05 1.9.95-1.9.95.35 2.05-1.9 1.05-1.05 1.85-2.05-.35L12 19.8l-.95-1.9-2.05.35-1.05-1.85-1.9-1.05.35-2.05-1.9-.95 1.9-.95-.35-2.05 1.9-1.05 1.05-1.85 2.05.35z"/></svg>',
  daily: '<svg viewBox="0 0 24 24"><path d="M3.8 15.2v-2.1l2.3-4.6h8.4L19.2 13v2.2"/><path d="M3.8 15.4h16.4"/><circle cx="7.1" cy="16.3" r="1.6"/><circle cx="16.7" cy="16.3" r="1.6"/><path d="M8.8 16.3h5.8"/><path d="M9.2 8.5h3.2"/></svg>',
  performance: '<svg viewBox="0 0 24 24"><path d="M5.2 17.2a8.4 8.4 0 1 1 13.6 0"/><path d="M12 13.6l4.1-4.2"/><circle cx="12" cy="13.6" r="1.15"/></svg>',
  supercars: '<svg viewBox="0 0 24 24"><path d="M3.4 14.4l2.6-3.2 2.1-2.2h5.4l3.1 2.2 3.8 1.3v2.4H3.4z"/><circle cx="7.2" cy="15.8" r="1.55"/><circle cx="16.8" cy="15.8" r="1.55"/><path d="M8.6 9l1.2-2h2.4"/></svg>',
  meets: '<svg viewBox="0 0 24 24"><path d="M12 20.4s6.4-5.1 6.4-10.1A6.4 6.4 0 0 0 5.6 10.3C5.6 15.3 12 20.4 12 20.4z"/><circle cx="12" cy="10.2" r="2.15"/></svg>',
  general: '<svg viewBox="0 0 24 24"><path d="M5 6.5h10a2.5 2.5 0 0 1 2.5 2.5v4.2A2.5 2.5 0 0 1 15 15.7h-3.2L8 18.8v-3.1H5A2.5 2.5 0 0 1 2.5 13.2V9A2.5 2.5 0 0 1 5 6.5z"/></svg>',
  'support-locals': '<svg viewBox="0 0 24 24"><path d="M4 11.4V19h16v-7.6"/><path d="M3.2 11.4L12 4.8l8.8 6.6"/><path d="M10 19v-5.2h4V19"/></svg>',
  'formals-shoots-weddings': '<svg viewBox="0 0 24 24"><path d="M8.2 8.4h7.6l1.4 2.1H20a1.4 1.4 0 0 1 1.4 1.4v7.1a1.4 1.4 0 0 1-1.4 1.4H4a1.4 1.4 0 0 1-1.4-1.4v-7.1A1.4 1.4 0 0 1 4 10.5h2.8z"/><circle cx="12" cy="14.9" r="2.9"/><path d="M9.1 8.4l.7-1.9h4.4l.7 1.9"/></svg>',
  'mind-over-motor': '<svg viewBox="0 0 24 24"><path d="M12 19.2S4.8 14.5 4.8 9.85A4.2 4.2 0 0 1 12 7.55 4.2 4.2 0 0 1 19.2 9.85C19.2 14.5 12 19.2 12 19.2z"/></svg>'
};
function fBoardIcon(slug) {
  const wrap = fEl('span', { class: 'fcat-icon', 'aria-hidden': 'true' });
  wrap.innerHTML = BOARD_ICON[slug] || BOARD_ICON.general;
  wrap.append(fEl('span', { class: 'fcat-shine' }));
  return wrap;
}
function fBoardClass(slug) {
  return 'fboard-' + String(slug || 'board').replace(/[^a-z0-9-]+/g, '');
}
function fPaintBoard(wrap, slug) {
  if (!wrap) return;
  wrap.classList.add('fboard', fBoardClass(slug));
}
function fBoardHead(cat) {
  const head = fEl('div', { class: 'fboard-head' });
  head.append(fBoardIcon(cat && cat.slug));
  const copy = fEl('div', { class: 'fboard-copy' });
  copy.append(fEl('h1', { class: 'fboard-title' }, (cat && cat.name) || ''));
  if (cat && cat.description) copy.append(fEl('p', { class: 'muted' }, cat.description));
  head.append(copy);
  return head;
}
function fFreshBadge(thread) {
  if (!thread) return null;
  const created = new Date(thread.created_at).getTime();
  const activity = new Date(thread.last_activity_at || thread.created_at).getTime();
  const now = Date.now();
  const replies = Number(thread.reply_count) || 0;
  if (replies >= 3 || (replies >= 1 && Number.isFinite(activity) && now - activity < 12 * 36e5)) {
    return fEl('span', { class: 'fbadge fbadge-hot' }, 'Hot');
  }
  if (Number.isFinite(created) && now - created < 48 * 36e5) {
    return fEl('span', { class: 'fbadge fbadge-new' }, 'New');
  }
  return null;
}
function fIndexStats(cats) {
  const row = fEl('div', { class: 'fstats' });
  const boards = cats.length;
  const threads = cats.reduce((n, cat) => n + fCount(cat.forum_threads), 0);
  const item = (value, label, klass, id) => {
    const el = fEl('div', { class: 'fstat ' + klass });
    const num = fEl('span', { class: 'fstat-n' }, String(value));
    if (id) num.id = id;
    el.append(num, fEl('span', { class: 'fstat-l' }, label));
    return el;
  };
  row.append(item(boards, boards === 1 ? 'board' : 'boards', 'fstat-boards'));
  row.append(item(threads, threads === 1 ? 'thread' : 'threads', 'fstat-threads'));
  row.append(item('0', 'online now', 'fstat-onnow', 'fstat-live'));
  return row;
}
function fMotionOk() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function fMobileTouch() {
  return window.matchMedia('(max-width:768px)').matches;
}
function fPressFx(link) {
  if (!link.querySelector('.fcat-streak')) {
    link.append(fEl('span', { class: 'fcat-streak', 'aria-hidden': 'true' }));
  }
  link.addEventListener('click', e => {
    if (e.defaultPrevented || e.button) return;
    if (!fMobileTouch() || !fMotionOk()) return;
    if (e.pointerType && e.pointerType !== 'touch') return;
    const href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return;
    e.preventDefault();
    if (link.classList.contains('is-tap')) return;
    const layer = link.querySelector('.fcat-streak') || link;
    const rect = layer.getBoundingClientRect();
    const burst = fEl('span', { class: 'fcat-burst', 'aria-hidden': 'true' });
    const x = (e.clientX || (rect.left + rect.width / 2)) - rect.left;
    const y = (e.clientY || (rect.top + rect.height / 2)) - rect.top;
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    layer.append(burst);
    link.classList.add('is-tap');
    setTimeout(() => {
      if (location.hash !== href) location.hash = href;
      else if (typeof route === 'function') route();
    }, 200);
  });
}

function fBoardCard(cat) {
  const count = fCount(cat.forum_threads);
  const latest = Array.isArray(cat.latest) ? cat.latest[0] : null;
  const link = fEl('a', { class: 'fcat fcat-' + String(cat.slug || 'board'), href: '#/forum/' + encodeURIComponent(cat.slug) });
  link.append(fBoardIcon(cat.slug));
  const copy = fEl('div', { class: 'fcat-copy' });
  const title = fEl('div', { class: 'fcat-top' });
  const name = fEl('div', { class: 'fcat-name' });
  name.append(fEl('h2', null, cat.name || ''));
  const badge = fFreshBadge(latest);
  if (badge) name.append(badge);
  title.append(name, fEl('span', { class: 'fcount' }, count === 1 ? '1 thread' : count + ' threads'));
  copy.append(title);
  if (cat.description) copy.append(fEl('p', null, cat.description));
  const foot = fEl('div', { class: 'fcat-foot' });
  foot.append(fEl('p', { class: 'flatest' }, latest ? 'Latest · ' + latest.title : 'No threads yet. Be the first.'));
  if (latest && latest.last_activity_at) foot.append(fEl('time', null, whenLabel(latest.last_activity_at)));
  copy.append(foot);
  link.append(copy);
  fPressFx(link);
  return link;
}

async function forumIndex() {
  const token = ++viewToken;
  if (!(await forumMember(token))) return;
  if (token !== viewToken) return;
  const query = forumQuery();
  main.innerHTML = '';
  const wrap = fEl('div', { class: 'wrap forum forum-hybrid' });
  main.append(forumClose(), wrap);
  wrap.append(fEl('div', { class: 'eyebrow' }, 'The Drivn Community'), fEl('h1', { class: 'forum-title' }, query ? 'Forum search' : 'The forum'));
  wrap.append(fEl('p', { class: 'muted' }, query ? '' : 'Ask the dumb question. Someone has already broken that part. No gatekeeping.'));
  const list = fEl('div', { class: query ? 'fthreads' : 'fcats' });
  list.append(fEl('p', { class: 'muted' }, query ? 'Searching…' : 'Loading the boards…'));
  wrap.append(list);
  if (query) {
    const words = query.split(' ').filter(Boolean);
    const bar = fEl('p', { class: 'filt' });
    bar.append('Search: ' + query + ' ');
    const clear = fEl('button', { type: 'button' }, 'Clear');
    clear.addEventListener('click', () => { closeForumSearch(); const field = document.querySelector('#fspanel input'); if (field) field.value = ''; location.hash = '#/forum'; });
    bar.append(clear);
    wrap.insertBefore(bar, list);
    let rows = [];
    try { rows = await Forum.search(query); } catch (e) {
      if (token !== viewToken) return;
      list.textContent = '';
      list.append(fEl('p', { class: 'err' }, e.message || 'Could not search the forum.'));
      return;
    }
    if (token !== viewToken) return;
    list.textContent = '';
    if (!rows.length) {
      const empty = fEl('p', { class: 'fempty' }, 'No threads match.');
      list.append(empty);
      return;
    }
    rows.forEach(thread => {
      const card = fEl('article', { class: 'fthread' });
      const link = fEl('a', { class: 'fthread-title', href: '#/forum/t/' + encodeURIComponent(thread.id) });
      const title = fEl('h2');
      title.append(fHighlight(thread.title || '', words));
      link.append(title);
      const cat = Array.isArray(thread.forum_categories) ? thread.forum_categories[0] : thread.forum_categories;
      const meta = fEl('div', { class: 'fmeta' });
      if (cat && cat.slug) meta.append(fEl('a', { href: '#/forum/' + encodeURIComponent(cat.slug) }, cat.name || 'Board'));
      meta.append(fEl('time', null, whenLabel(thread.last_activity_at || thread.created_at)));
      const blurb = fEl('p');
      blurb.append(fHighlight(String(thread.body || '').slice(0, 180), words));
      card.append(link, meta, blurb);
      list.append(card);
    });
    return;
  }
  let cats = [];
  try { cats = await Forum.categories(); } catch (e) {
    if (token !== viewToken) return;
    list.textContent = '';
    list.append(fEl('p', { class: 'err' }, e.message || 'Could not load the forum.'));
    return;
  }
  if (token !== viewToken) return;
  list.textContent = '';
  const stats = fIndexStats(cats);
  wrap.insertBefore(stats, list);
  wrap.insertBefore(liveBoardCard(), list);
  watchLiveCount(token);
  cats.forEach(cat => list.append(fBoardCard(cat)));
}

function fMindSupportNote() {
  const note = fEl('aside', { class: 'fmind-note', 'aria-label': 'Support contacts' });
  const line = fEl('p');
  const lifeline = fEl('a', { href: 'tel:131114' }, 'Lifeline 13 11 14');
  const beyond = fEl('a', { href: 'tel:1300224636' }, 'Beyond Blue 1300 22 4636');
  const triple = fEl('a', { href: 'tel:000' }, '000');
  line.append('Need to talk now? ', lifeline, ' (24/7) · ', beyond, ' · In danger, call ', triple);
  note.append(line);
  return note;
}
async function forumCategory(slug) {
  const token = ++viewToken;
  if (!(await forumMember(token))) return;
  if (token !== viewToken) return;
  main.innerHTML = '';
  const wrap = fEl('div', { class: 'wrap forum forum-hybrid' });
  main.append(forumClose(), wrap);
  const heading = fEl('h1', null, 'Loading…');
  wrap.append(fEl('a', { class: 'eyebrow', href: '#/forum' }, '← The forum'), heading);
  const tools = fEl('div', { class: 'ftools' });
  const list = fEl('div', { class: 'fthreads' });
  wrap.append(tools, list);
  let cat;
  let safeSlug = slug || '';
  try { safeSlug = decodeURIComponent(safeSlug); } catch (e) {}
  try { cat = await Forum.category(safeSlug); }
  catch (e) {
    if (token !== viewToken) return;
    heading.textContent = 'Board missing';
    list.append(fEl('p', { class: 'err' }, e.message || 'Could not load that board.'));
    return;
  }
  if (token !== viewToken) return;
  if (!cat) {
    heading.textContent = 'Board missing';
    list.append(fEl('p', { class: 'muted' }, 'That board is not a thing. Head back to the forum.'));
    return;
  }
  fPaintBoard(wrap, cat.slug || safeSlug);
  const head = fBoardHead(cat);
  heading.replaceWith(head);
  if ((cat.slug || safeSlug) === 'mind-over-motor') head.after(fMindSupportNote());
  const composer = fComposer(cat);
  tools.append(composer);
  const form = composer.querySelector('form');
  if (form) list.after(form);
  let threads = [];
  try { threads = await Forum.threads(cat.id); }
  catch (e) {
    if (token !== viewToken) return;
    list.append(fEl('p', { class: 'err' }, e.message || 'Could not load threads.'));
    return;
  }
  if (token !== viewToken) return;
  if (!threads.length) {
    if (form) { list.hidden = true; form.hidden = false; }
    else list.append(fEl('p', { class: 'fempty' }, 'Quiet in here. Be the one who asks.'));
  }
  threads.forEach(thread => {
    const card = fEl('article', { class: 'fthread' });
    const link = fEl('a', { class: 'fthread-title', href: '#/forum/t/' + encodeURIComponent(thread.id) });
    link.append(fEl('h2', null, thread.title || ''));
    const meta = fEl('div', { class: 'fmeta' });
    const replies = Number(thread.reply_count) || 0;
    meta.append(
      fHandleNode(thread),
      fEl('span', null, replies === 1 ? '1 reply' : replies + ' replies'),
      fEl('time', null, whenLabel(thread.last_activity_at || thread.created_at))
    );
    card.append(link, meta);
    list.append(card);
  });
}

function fPhotoPicker() {
  let blob = null;
  let url = '';
  const wrap = fEl('div', { class: 'fphoto-pick' });
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';
  input.hidden = true;
  const add = fEl('button', { type: 'button', class: 'fphoto-add' });
  add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>Add photo</span>';
  const preview = fEl('div', { class: 'fphoto-preview' });
  preview.hidden = true;
  const img = fEl('img', { alt: 'Selected photo' });
  const remove = fEl('button', { type: 'button', class: 'fphoto-x', 'aria-label': 'Remove photo' });
  remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const note = fEl('p', { class: 'err', role: 'alert' });
  preview.append(img, remove);
  wrap.append(input, add, preview, note);
  function clear() {
    blob = null;
    if (url) URL.revokeObjectURL(url);
    url = '';
    img.removeAttribute('src');
    preview.hidden = true;
    add.hidden = false;
    note.textContent = '';
  }
  add.addEventListener('click', () => input.click());
  remove.addEventListener('click', clear);
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    note.textContent = '';
    add.disabled = true;
    try {
      const next = await compressForumPhoto(file);
      if (url) URL.revokeObjectURL(url);
      blob = next;
      url = URL.createObjectURL(next);
      img.src = url;
      preview.hidden = false;
      add.hidden = true;
    } catch (e) {
      clear();
      note.textContent = e.message || 'Could not use that photo.';
    } finally { add.disabled = false; }
  });
  return { el: wrap, photo: () => blob };
}
function fPhotoNode(path) {
  if (!path) return null;
  const button = fEl('button', { type: 'button', class: 'fphoto' });
  const img = fEl('img', { alt: 'Photo on this post' });
  button.append(img);
  const open = () => {
    const src = img.getAttribute('src');
    if (!src) return;
    let view = document.getElementById('fphoto-view');
    if (!view) {
      view = document.createElement('dialog');
      view.id = 'fphoto-view';
      view.className = 'fphoto-view';
      view.addEventListener('click', () => view.close());
      document.body.appendChild(view);
    }
    view.replaceChildren(fEl('img', { src: src, alt: 'Forum photo' }));
    if (view.showModal) view.showModal();
  };
  button.addEventListener('click', open);
  const ready = typeof forumPhotoUrl === 'function' ? forumPhotoUrl(path) : '';
  Promise.resolve(ready).then(src => { if (src && button.isConnected) img.src = src; }).catch(() => {});
  return button;
}
function fThreadPrompt(slug) {
  const help = {
    title: 'What is the car doing?',
    body: 'Year, make, what you already tried. The useful stuff.',
    titleErr: 'Title needs 3-140 characters. Say what the car is doing.',
    bodyErr: 'Write the actual question. One sentence is enough.'
  };
  const map = {
    help: help,
    mods: { title: 'What are you building?', body: "Car, mod list, what you've done so far and what's next." },
    daily: { title: "What's the daily?", body: 'Year, model, servicing, fuel or running costs. Share your setup or ask away.' },
    performance: { title: "What's the setup or tune?", body: 'Engine, power goals, track times, parts or tuning details.' },
    supercars: { title: 'What did you spot or want to talk about?', body: "Model, where you saw it, specs or why it's in your dream garage." },
    meets: { title: 'Event name, date and location', body: 'When, where, start time, route and anything people need to know.' },
    general: { title: "What's on your mind?", body: 'Car news, hot takes, banter or whatever you want to talk about.' },
    'support-locals': { title: 'Business name and what you do', body: 'Services you offer, location, how to reach you and any deals for the crew.' },
    'formals-shoots-weddings': { title: 'What car do you have for hire?', body: 'Car details, areas you cover, event types, pricing and how to book.' },
    'mind-over-motor': { title: 'How are you going?', body: 'Share what is on your mind, or a few words of encouragement for someone else. This space is for the community, not just cars.' }
  };
  const prompt = map[slug] || { title: 'Thread title', body: 'Add the details for your post.' };
  return {
    title: prompt.title,
    body: prompt.body,
    titleErr: prompt.titleErr || 'Title needs 3-140 characters.',
    bodyErr: prompt.bodyErr || 'Add a few details. One sentence is enough.'
  };
}
function fComposer(cat) {
  const prompt = fThreadPrompt(cat && cat.slug);
  const box = fEl('div', { class: 'fcomposer' });
  if (!fCanPost()) { box.append(fGateButton()); return box; }
  const open = fEl('button', { class: 'btn solid', type: 'button' }, 'Post new thread');
  const form = fEl('form', { class: 'panel fnew', hidden: 'hidden' });
  const title = fEl('input', { name: 'title', maxlength: '140', required: 'required', placeholder: prompt.title, 'aria-label': 'Thread title' });
  const body = fEl('textarea', { name: 'body', rows: '5', maxlength: '8000', required: 'required', placeholder: prompt.body, 'aria-label': 'Thread details' });
  const err = fEl('p', { class: 'err', role: 'alert' });
  const photo = fPhotoPicker();
  const row = fEl('div', { class: 'auth-row' });
  const post = fEl('button', { class: 'btn solid', type: 'submit' }, 'Post thread');
  const cancel = fEl('button', { class: 'btn', type: 'button' }, 'Cancel');
  row.append(post, cancel);
  form.append(fEl('label', null, 'Title'), title, fEl('label', null, 'Details'), body, photo.el, err, row);
  open.addEventListener('click', () => { form.hidden = false; title.focus(); form.scrollIntoView({ block: 'nearest' }); });
  cancel.addEventListener('click', () => { form.hidden = true; open.hidden = false; err.textContent = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const t = title.value.trim(), b = body.value.trim();
    if (t.length < 3 || t.length > 140) { err.textContent = prompt.titleErr; return; }
    if (!b) { err.textContent = prompt.bodyErr; return; }
    post.disabled = true; err.textContent = '';
    try {
      const created = await Forum.createThread(cat.id, t, b, photo.photo());
      location.hash = '#/forum/t/' + encodeURIComponent(created.id);
    } catch (e) { err.textContent = e.message || 'Could not post that.'; post.disabled = false; }
  });
  box.append(open, form);
  return box;
}

async function forumThread(rawId, replyId) {
  const token = ++viewToken;
  let id = rawId || '';
  try { id = decodeURIComponent(id); } catch (e) {}
  if (!(await forumMember(token))) return;
  if (token !== viewToken) return;
  main.innerHTML = '';
  const wrap = fEl('div', { class: 'wrap forum forum-hybrid' });
  main.append(forumClose(), wrap);
  wrap.append(fEl('p', { class: 'muted' }, 'Loading the thread…'));
  let data;
  try { data = await Forum.thread(id); }
  catch (e) {
    if (token !== viewToken) return;
    wrap.textContent = '';
    wrap.append(fEl('p', { class: 'err' }, e.message || 'Could not load that thread.'));
    return;
  }
  if (token !== viewToken) return;
  wrap.textContent = '';
  if (!data) {
    wrap.append(fEl('a', { class: 'eyebrow', href: '#/forum' }, '← The forum'), fEl('h1', null, 'Thread gone'), fEl('p', { class: 'muted' }, 'That thread is not here anymore.'));
    return;
  }
  const thread = data.thread;
  const cat = Array.isArray(thread.forum_categories) ? thread.forum_categories[0] : thread.forum_categories;
  const back = fEl('a', { class: 'eyebrow', href: cat && cat.slug ? '#/forum/' + encodeURIComponent(cat.slug) : '#/forum' }, cat && cat.name ? '← ' + cat.name : '← The forum');
  if (cat && cat.slug) {
    fPaintBoard(wrap, cat.slug);
    const lead = fEl('div', { class: 'fthread-lead' });
    lead.append(fBoardIcon(cat.slug), back);
    wrap.append(lead);
  } else {
    wrap.append(back);
  }
  wrap.append(fPost(thread, true, () => { if (cat && cat.slug) location.hash = '#/forum/' + encodeURIComponent(cat.slug); else location.hash = '#/forum'; }));
  const replies = fEl('div', { class: 'freplies' });
  if (!data.replies.length) replies.append(fEl('p', { class: 'fempty' }, 'No replies yet. If you know, say it.'));
  data.replies.forEach(reply => replies.append(fPost(reply, false, () => forumThread(id))));
  wrap.append(replies, fReplyBox(id));
  if (replyId) {
    const target = document.getElementById('reply-' + replyId);
    if (target) {
      target.classList.add('is-target');
      requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    Notes.markReadForReply(replyId).then(() => refreshUnread()).catch(() => {});
  }
}

function fPost(row, isThread, afterDelete) {
  const article = fEl('article', { class: isThread ? 'fpost fop' : 'fpost', id: isThread ? null : 'reply-' + row.id });
  article.append(fMeta(row, row.created_at));
  const title = isThread ? fEl('h1', null, row.title || '') : null;
  const body = fEl('div', { class: 'fbody' }, row.body || '');
  if (title) article.append(title);
  article.append(body);
  const shot = fPhotoNode(row.photo_path);
  if (shot) article.append(shot);
  const actions = fActions(row.author_id, () => fEdit(article, row, isThread, body, title), async () => {
    if (isThread) await Forum.deleteThread(row.id);
    else await Forum.deleteReply(row.id);
    afterDelete();
  }) || fEl('div', { class: 'factions' });
  const adminBtn = fAdminRemove(row, isThread, afterDelete);
  if (adminBtn) actions.append(adminBtn);
  if (actions.childNodes.length) article.append(actions);
  if (row.edited_at) article.append(fEl('p', { class: 'fedited' }, 'Edited'));
  return article;
}

function fEdit(article, row, isThread, body, title) {
  if (article.querySelector('.fedit')) return;
  const form = fEl('form', { class: 'panel fedit' });
  const titleInput = isThread ? fEl('input', { maxlength: '140', 'aria-label': 'Title' }) : null;
  if (titleInput) titleInput.value = row.title || '';
  const area = fEl('textarea', { rows: '5', maxlength: '8000', 'aria-label': 'Post' });
  area.value = row.body || '';
  const err = fEl('p', { class: 'err', role: 'alert' });
  const rowBtns = fEl('div', { class: 'auth-row' });
  const save = fEl('button', { class: 'btn solid', type: 'submit' }, 'Save');
  const cancel = fEl('button', { class: 'btn', type: 'button' }, 'Cancel');
  cancel.addEventListener('click', () => form.remove());
  rowBtns.append(save, cancel);
  if (titleInput) form.append(titleInput);
  form.append(area, err, rowBtns);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const nextBody = area.value.trim();
    const nextTitle = titleInput ? titleInput.value.trim() : '';
    if (isThread && (nextTitle.length < 3 || nextTitle.length > 140)) { err.textContent = 'Title needs 3-140 characters.'; return; }
    if (!nextBody) { err.textContent = 'The post cannot be empty.'; return; }
    save.disabled = true;
    try {
      if (isThread) await Forum.updateThread(row.id, nextTitle, nextBody);
      else await Forum.updateReply(row.id, nextBody);
      const changed = nextBody !== String(row.body || '') || (isThread && nextTitle !== String(row.title || ''));
      if (title) title.textContent = nextTitle;
      body.textContent = nextBody;
      row.title = nextTitle;
      row.body = nextBody;
      if (changed) {
        row.edited_at = new Date().toISOString();
        if (!article.querySelector('.fedited')) article.append(fEl('p', { class: 'fedited' }, 'Edited'));
      }
      form.remove();
    } catch (e) { err.textContent = e.message || 'Could not save that.'; save.disabled = false; }
  });
  body.after(form);
}

function fReplyBox(threadId) {
  const box = fEl('div', { class: 'fcomposer' });
  box.append(fEl('h2', null, 'Reply'));
  if (!fCanPost()) { box.append(fGateButton()); return box; }
  const form = fEl('form', { class: 'panel freply' });
  const area = fEl('textarea', { rows: '4', maxlength: '8000', required: 'required', placeholder: 'Go on, throw in your 2cents…', 'aria-label': 'Reply' });
  const err = fEl('p', { class: 'err', role: 'alert' });
  const photo = fPhotoPicker();
  const post = fEl('button', { class: 'btn solid', type: 'submit' }, 'Reply');
  const bar = fEl('div', { class: 'freply-bar' });
  bar.append(photo.el, post);
  form.append(area, err, bar);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = area.value.trim();
    if (!text) { err.textContent = 'Say something first.'; return; }
    post.disabled = true; err.textContent = '';
    try { await Forum.reply(threadId, text, photo.photo()); forumThread(threadId); }
    catch (e) { err.textContent = e.message || 'Could not post that.'; post.disabled = false; }
  });
  box.append(form);
  return box;
}

let liveChannel = null;
let liveGen = 0;
let liveWatch = null;
function dropLiveChannel() {
  liveGen += 1;
  const channel = liveChannel;
  liveChannel = null;
  if (channel && typeof sb !== 'undefined' && sb) {
    try { sb.removeChannel(channel); } catch (e) {}
  }
}
function closeLiveRoom() {
  dropLiveChannel();
  if (liveWatch) {
    document.removeEventListener('visibilitychange', liveWatch.vis);
    window.removeEventListener('pageshow', liveWatch.vis);
    window.removeEventListener('online', liveWatch.vis);
    if (liveWatch.poll) clearInterval(liveWatch.poll);
    if (liveWatch.typing) clearInterval(liveWatch.typing);
    if (liveWatch.retry) clearTimeout(liveWatch.retry);
    if (liveWatch.presence) clearTimeout(liveWatch.presence);
    liveWatch = null;
  }
  const fit = window.__liveFit;
  if (fit) {
    window.removeEventListener('resize', fit);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', fit);
    window.__liveFit = null;
  }
  liveFitKey = '';
  liveFitFrame = 0;
  liveScrollOnce = false;
  const names = window.__liveNames;
  if (names) {
    window.removeEventListener('resize', names);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', names);
    window.__liveNames = null;
  }
  document.documentElement.style.removeProperty('--live-h');
  document.body.classList.remove('is-livechat');
}
function liveBoardCard() {
  const link = fEl('a', { class: 'fcat flive', href: '#/forum/live' });
  link.append(fBoardIcon('live'));
  const copy = fEl('div', { class: 'fcat-copy' });
  const title = fEl('div', { class: 'fcat-top' });
  const name = fEl('h2', { class: 'flive-title' });
  name.append(fEl('span', { class: 'flive-dot', 'aria-hidden': 'true' }));
  name.append(document.createTextNode('Live Chat'));
  title.append(name, fEl('span', { class: 'fcount', id: 'flive-count' }, '0 online'));
  copy.append(title, fEl('p', null, 'One room. The people who are in it right now.'));
  copy.append(fEl('span', { class: 'flive-cta' }, 'Jump in'));
  link.append(copy);
  fPressFx(link);
  return link;
}
function watchLiveCount(token) {
  dropLiveChannel();
  if (typeof sb === 'undefined' || !sb || token !== viewToken) return;
  const gen = liveGen;
  const channel = sb.channel('room:live');
  liveChannel = channel;
  const paint = () => {
    if (gen !== liveGen || token !== viewToken) return;
    const n = Object.keys(channel.presenceState() || {}).length;
    const count = document.getElementById('flive-count');
    if (count) count.textContent = n === 1 ? '1 online' : n + ' online';
    const stat = document.getElementById('fstat-live');
    if (stat) stat.textContent = String(n);
    if (!count && !stat) return;
  };
  channel.on('presence', { event: 'sync' }, paint);
  channel.on('presence', { event: 'join' }, paint);
  channel.on('presence', { event: 'leave' }, paint);
  channel.subscribe(status => { if (status === 'SUBSCRIBED') paint(); });
}
function liveWhen(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}
const LIVE_CAR = ['🏎️', '🚗', '☕', '🏁', '🔥', '💨', '🔧', '⛽', '🛞', '💥', '🚓', '🛻', '🏍️', '🔩'];
const LIVE_FUNNY = ['💩', '🚽', '😂', '🤣', '💀', '🤡', '🙈', '🤦‍♂️', '😬', '🫠', '🤯', '🦆', '👍', '🙏', '🍺', '🌭'];
const LIVE_POPULAR = ['😂', '❤️', '🤣', '👍', '😭', '🙏', '😘', '🥰', '😍', '😊', '🎉', '😁', '💕', '🥺', '😅', '🔥', '🤦', '🤷'].filter(face => LIVE_CAR.indexOf(face) < 0 && LIVE_FUNNY.indexOf(face) < 0);
function appendLiveText(node, text) {
  node.append(document.createTextNode(String(text || '')));
}
function insertLive(input, text) {
  const start = input.selectionStart == null ? input.value.length : input.selectionStart;
  const end = input.selectionEnd == null ? start : input.selectionEnd;
  const next = input.value.slice(0, start) + text + input.value.slice(end);
  if (next.length > 500) return;
  input.value = next;
  const caret = start + text.length;
  input.focus();
  try { input.setSelectionRange(caret, caret); } catch (e) {}
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function liveEmojiButtons(tray, input) {
  function addFace(face) {
    const btn = fEl('button', { type: 'button', class: 'live-emo' }, face);
    btn.addEventListener('pointerdown', event => event.preventDefault());
    btn.addEventListener('click', () => insertLive(input, face));
    tray.append(btn);
  }
  LIVE_CAR.forEach(addFace);
  LIVE_FUNNY.forEach(addFace);
  LIVE_POPULAR.forEach(addFace);
}
function trimLiveFeed(log, seen, follow) {
  const lines = [...log.querySelectorAll('.live-line')];
  const extra = lines.length - 50;
  if (extra <= 0) return;
  const before = log.scrollHeight;
  const top = log.scrollTop;
  for (let n = 0; n < extra; n++) {
    const id = lines[n].getAttribute('data-id');
    lines[n].remove();
    if (id && seen) seen.delete(id);
  }
  if (follow) log.scrollTop = log.scrollHeight;
  else log.scrollTop = Math.max(0, top - (before - log.scrollHeight));
}
function liveFeedLine(row, mine) {
  const handle = String(row.handle || 'driver').replace(/^@/, '');
  const item = fEl('p', { class: 'live-line' + (mine ? ' is-mine' : ''), 'data-id': row.id || '' });
  const who = fEl('span', { class: 'live-who' }, '@' + handle);
  const body = fEl('span', { class: 'live-body' });
  appendLiveText(body, duckText(row.body || ''));
  item.append(who, document.createTextNode(': '), body, fEl('time', { class: 'live-time' }, liveWhen(row.created_at)));
  return item;
}
function livePeople(channel) {
  const state = (channel && channel.presenceState && channel.presenceState()) || {};
  return Object.keys(state).map(id => {
    const meta = (state[id] && state[id][0]) || {};
    return { id, handle: String(meta.handle || 'driver').replace(/^@/, ''), avatar: meta.avatar || '', typing: !!meta.typing };
  }).sort((a, b) => a.handle.localeCompare(b.handle));
}
function liveMeasure(el, text) {
  const canvas = liveMeasure.canvas || (liveMeasure.canvas = document.createElement('canvas').getContext('2d'));
  const cs = getComputedStyle(el);
  canvas.font = cs.font || ((cs.fontWeight || '500') + ' ' + (cs.fontSize || '13px') + ' ' + (cs.fontFamily || 'sans-serif'));
  return canvas.measureText(String(text || '')).width;
}
function keyboardViewport() {
  const fake = window.__kbViewport;
  if (fake && typeof fake.height === 'number') return { height: fake.height, offsetTop: fake.offsetTop || 0 };
  const vv = window.visualViewport;
  return { height: vv ? vv.height : window.innerHeight, offsetTop: vv ? vv.offsetTop : 0 };
}
let liveFitFrame = 0;
let liveFitKey = '';
let liveScrollOnce = false;
function resetLiveScroll() {
  if (liveScrollOnce || !window.scrollY) return;
  liveScrollOnce = true;
  window.scrollTo(0, 0);
}
function fitLive() {
  const root = document.querySelector('.livechat');
  if (!root || !document.body.classList.contains('is-livechat')) return;
  const viewH = Math.round(keyboardViewport().height);
  const header = document.querySelector('.top');
  const headerH = header ? header.offsetHeight : 0;
  const nav = document.querySelector('.bnav');
  const navH = nav && getComputedStyle(nav).display !== 'none' ? nav.offsetHeight : 0;
  const key = viewH + ':' + headerH + ':' + navH;
  if (key === liveFitKey) return;
  liveFitKey = key;
  const height = Math.max(180, viewH - headerH - navH);
  document.documentElement.style.setProperty('--live-h', viewH + 'px');
  root.style.position = '';
  root.style.top = '';
  root.style.transform = 'none';
  root.style.transition = 'none';
  root.style.height = height + 'px';
}
function scheduleLiveFit() {
  if (liveFitFrame) return;
  liveFitFrame = requestAnimationFrame(() => {
    liveFitFrame = 0;
    fitLive();
  });
}
function bindLiveFit() {
  window.__liveFit = scheduleLiveFit;
  liveFitKey = '';
  liveScrollOnce = false;
  window.addEventListener('resize', scheduleLiveFit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleLiveFit);
  scheduleLiveFit();
}
async function forumLive() {
  const token = ++viewToken;
  if (!(await forumMember(token))) return;
  if (token !== viewToken) return;
  document.body.classList.add('is-livechat');
  main.innerHTML = '';
  const root = fEl('section', { class: 'livechat' });
  const head = fEl('div', { class: 'live-head' });
  const titles = fEl('div', { class: 'live-titles' });
  const name = fEl('div', { class: 'live-name' });
  const vibes = fEl('p', { class: 'eyebrow live-vibes' }, "It's giving cars and coffee vibes ");
  vibes.append(fEl('span', { class: 'live-vibes-emoji' }, '☕🏁'));
  name.append(fEl('h1', null, 'Live Chat'), vibes);
  const close = fEl('button', { type: 'button', class: 'menu-close', 'aria-label': 'Close' });
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';
  close.addEventListener('click', () => { location.hash = '#/forum'; });
  titles.append(close, name);
  const pill = fEl('button', { type: 'button', class: 'live-pill', 'aria-expanded': 'false', 'aria-controls': 'live-drawer' });
  pill.append(fEl('span', { class: 'flive-dot', 'aria-hidden': 'true' }), fEl('span', { class: 'live-pill-n' }, '0 online'));
  head.append(titles, pill);
  const summary = fEl('p', { class: 'live-now', id: 'live-now' });
  const namesEl = fEl('span', { class: 'live-names' }, 'Online:');
  const moreBtn = fEl('button', { type: 'button', class: 'live-more', hidden: 'hidden', 'aria-label': 'Show everyone online' }, '…');
  summary.append(namesEl, moreBtn);
  const sheet = fEl('div', { class: 'live-sheet', hidden: 'hidden' });
  const card = fEl('div', { class: 'live-sheet-card', role: 'dialog', 'aria-label': 'Online now' });
  const sheetHead = fEl('div', { class: 'live-sheet-head' });
  const sheetClose = fEl('button', { type: 'button', class: 'menu-close', 'aria-label': 'Close' });
  sheetClose.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';
  const sheetList = fEl('div', { class: 'live-sheet-list' });
  sheetHead.append(fEl('p', { class: 'live-online-h' }, 'Online now'), sheetClose);
  card.append(sheetHead, sheetList);
  sheet.append(card);
  const drawer = fEl('div', { class: 'live-drawer', id: 'live-drawer', hidden: 'hidden' });
  const shell = fEl('div', { class: 'live-shell' });
  const mainCol = fEl('div', { class: 'live-main' });
  const log = fEl('div', { class: 'live-log', id: 'live-log', role: 'log' });
  const typing = fEl('p', { class: 'live-typing', id: 'live-typing', 'aria-live': 'polite' });
  const tray = fEl('div', { class: 'live-emoji', id: 'live-emoji', role: 'toolbar', 'aria-label': 'Emoji and stickers' });
  const form = fEl('form', { class: 'live-send' });
  const opener = fEl('button', { type: 'button', class: 'live-emoji-open', 'aria-label': 'Emoji', 'aria-expanded': 'false', 'aria-controls': 'live-emoji' }, '😊');
  const input = fEl('input', { type: 'text', maxlength: '500', placeholder: 'Type a message…', 'aria-label': 'Message', autocomplete: 'off' });
  const send = fEl('button', { class: 'btn solid', type: 'submit' }, 'Send');
  const err = fEl('p', { class: 'err', role: 'alert' });
  const aside = fEl('aside', { class: 'live-online', 'aria-label': 'Online now' });
  liveEmojiButtons(tray, input);
  opener.addEventListener('pointerdown', event => event.preventDefault());
  opener.addEventListener('click', () => {
    const open = tray.classList.toggle('is-open');
    opener.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  form.append(opener, input, send);
  mainCol.append(log, typing, tray, form, err);
  shell.append(mainCol, aside);
  root.append(head, summary, drawer, sheet, shell);
  main.append(root);
  pill.addEventListener('click', () => {
    const open = drawer.hidden;
    drawer.hidden = !open;
    pill.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  bindLiveFit();
  const seen = new Set();
  const stick = () => log.scrollHeight - log.scrollTop - log.clientHeight < 90;
  const onLiveScreen = () => {
    const here = typeof hashParts === 'function' ? hashParts() : { p: '', a: '' };
    return here.p === 'forum' && here.a === 'live' && log.isConnected;
  };
  function paintMessage(row, force) {
    if (!onLiveScreen() || !row || !row.id || seen.has(row.id)) return;
    seen.add(row.id);
    const empty = document.getElementById('live-empty');
    if (empty) empty.remove();
    const follow = force || stick();
    const mine = Auth.user && row.user_id === Auth.user.id;
    const item = liveFeedLine(row, mine);
    item.setAttribute('data-at', row.created_at || '');
    if (typeof canSeeReports === 'function' && canSeeReports()) {
      const del = fEl('button', { type: 'button', class: 'auth-link live-del' }, 'Delete');
      del.addEventListener('click', () => askRemove('Delete this message?', async () => { await LiveChat.remove(row.id); }));
      item.append(del);
    }
    const at = Date.parse(row.created_at || '') || 0;
    let before = null;
    log.querySelectorAll('.live-line').forEach(line => {
      if (before) return;
      const other = Date.parse(line.getAttribute('data-at') || '') || 0;
      if (other > at) before = line;
    });
    if (before) log.insertBefore(item, before);
    else log.append(item);
    trimLiveFeed(log, seen, follow);
    if (follow) log.scrollTop = log.scrollHeight;
  }
  function dropMessage(id) {
    const node = log.querySelector('[data-id="' + id + '"]');
    if (node) node.remove();
    seen.delete(id);
  }
  const typingState = new Map();
  function typingLabel() {
    const now = Date.now();
    const names = [];
    typingState.forEach((info, id) => {
      if (!info || info.until < now || (Auth.user && id === Auth.user.id)) typingState.delete(id);
      else names.push('@' + info.handle);
    });
    return names;
  }
  function paintPeople() {
    if (token !== viewToken) return;
    const people = livePeople(liveChannel);
    const n = people.length;
    pill.querySelector('.live-pill-n').textContent = n + ' online';
    const names = typingLabel();
    typing.textContent = !names.length ? '' : names.length === 1 ? names[0] + ' is typing…' : names.slice(0, 2).join(' and ') + ' are typing…';
    const labels = people.map(person => '@' + person.handle);
    const width = Math.max(0, summary.clientWidth - 2);
    if (width) {
      const prefix = 'Online: ';
      const comma = ', ';
      const prefixW = liveMeasure(namesEl, prefix);
      const commaW = liveMeasure(namesEl, comma);
      const moreW = liveMeasure(moreBtn, '…') + 4;
      const used = count => {
        let w = prefixW;
        for (let i = 0; i < count; i++) w += (i ? commaW : 0) + liveMeasure(namesEl, labels[i]);
        return w;
      };
      let count = labels.length;
      let more = false;
      if (labels.length && used(labels.length) > width) {
        more = true;
        count = 0;
        while (count < labels.length && used(count + 1) + 6 + moreW <= width) count++;
      }
      const text = labels.length ? prefix + labels.slice(0, count).join(comma) : prefix + 'nobody yet';
      if (namesEl.textContent !== text) namesEl.textContent = text;
      const showMore = more && count < labels.length;
      if (moreBtn.hidden === showMore) moreBtn.hidden = !showMore;
    }
    const who = people.map(person => person.id + ':' + person.handle).join('|');
    if (sheetList.dataset.who !== who) {
      sheetList.dataset.who = who;
      sheetList.textContent = '';
      if (!people.length) sheetList.append(fEl('p', { class: 'muted' }, 'Nobody in the room yet.'));
      people.forEach(person => sheetList.append(fEl('p', { class: 'live-person' }, '@' + person.handle)));
    }
    [aside, drawer].forEach(host => {
      const open = host === drawer && !host.hidden;
      host.textContent = '';
      host.append(fEl('p', { class: 'live-online-h' }, 'Online now'));
      if (!people.length) host.append(fEl('p', { class: 'muted' }, 'Nobody in the room yet.'));
      people.forEach(person => host.append(fEl('p', { class: 'live-person' }, '@' + person.handle)));
      if (host === drawer) host.hidden = !open;
    });
  }
  moreBtn.addEventListener('click', () => {
    sheet.hidden = false;
    card.style.top = Math.round(summary.getBoundingClientRect().bottom + 6) + 'px';
  });
  sheet.addEventListener('click', () => { sheet.hidden = true; });
  card.addEventListener('click', event => event.stopPropagation());
  sheetClose.addEventListener('click', () => { sheet.hidden = true; });
  const refit = () => { if (token === viewToken) paintPeople(); };
  window.__liveNames = refit;
  window.addEventListener('resize', refit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
  paintPeople();
  let markTyping = () => {};
  function setLiveStatus(text) {
    const cur = err.textContent || '';
    const ours = !cur || /^Reconnecting/.test(cur) || cur === 'Connection lost. Trying again.';
    if (!text) {
      if (ours) err.textContent = '';
      return;
    }
    if (ours) err.textContent = text;
  }
  async function catchUp() {
    if (!onLiveScreen() || token !== viewToken) return;
    let rows = [];
    try { rows = await LiveChat.recent(); }
    catch (e) { return; }
    if (!onLiveScreen() || token !== viewToken) return;
    const ids = new Set(rows.map(row => row.id));
    [...log.querySelectorAll('.live-line')].forEach(node => {
      const id = node.getAttribute('data-id');
      if (id && !ids.has(id)) dropMessage(id);
    });
    const empty = document.getElementById('live-empty');
    if (rows.length && empty) empty.remove();
    if (!rows.length && !log.querySelector('.live-line') && !document.getElementById('live-empty')) {
      log.append(fEl('p', { class: 'fempty', id: 'live-empty' }, 'No messages yet. Say g’day.'));
    }
    const follow = stick();
    rows.forEach(row => paintMessage(row, follow));
    if (follow) log.scrollTop = log.scrollHeight;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    err.textContent = '';
    const text = input.value;
    if (!livePlain(text)) { err.textContent = 'Write a message first.'; return; }
    send.disabled = true;
    markTyping(false);
    try {
      input.value = '';
      const saved = await LiveChat.send(text);
      paintMessage(saved, true);
    } catch (e) {
      input.value = text;
      const msg = (e && e.message) ? e.message : 'Could not send that.';
      const retry = /could not send|network|offline|timeout|expired|failed|fetch|session/i.test(msg);
      err.textContent = retry && !/try sending/i.test(msg) ? msg + ' Try sending it again.' : msg;
    } finally { send.disabled = false; }
  });
  let rows = [];
  try { rows = await LiveChat.recent(); }
  catch (e) {
    if (token !== viewToken) return;
    err.textContent = e.message || 'Could not load the room.';
  }
  if (token !== viewToken) return;
  if (!rows.length) log.append(fEl('p', { class: 'fempty', id: 'live-empty' }, 'No messages yet. Say g’day.'));
  rows.slice(-50).forEach(row => paintMessage(row, true));
  log.scrollTop = log.scrollHeight;
  if (token !== viewToken || typeof sb === 'undefined' || !sb) return;
  const presencePayload = () => ({
    handle: String((Auth.profile && Auth.profile.username) || 'driver').replace(/^@/, ''),
    avatar: (Auth.profile && /^https?:\/\//i.test(Auth.profile.avatar_url || '')) ? Auth.profile.avatar_url : ''
  });
  let lastPresenceAt = 0;
  function trackPresence(channel) {
    if (!channel || !Auth.user) return Promise.resolve();
    const now = Date.now();
    const wait = lastPresenceAt ? 10000 - (now - lastPresenceAt) : 0;
    if (wait > 0) {
      if (liveWatch) {
        clearTimeout(liveWatch.presence);
        liveWatch.presence = setTimeout(() => {
          if (liveWatch) liveWatch.presence = 0;
          if (liveChannel === channel && onLiveScreen() && token === viewToken) trackPresence(channel);
        }, wait + 50);
      }
      return Promise.resolve();
    }
    lastPresenceAt = now;
    return channel.track(presencePayload()).then(paintPeople).catch(() => {});
  }
  function scheduleReconnect() {
    if (!liveWatch || !onLiveScreen() || token !== viewToken) return;
    if (liveWatch.retry) return;
    setLiveStatus('Reconnecting to the room.');
    const delay = liveWatch.retryMs || 1000;
    liveWatch.retryMs = Math.min(8000, delay * 2);
    liveWatch.retry = setTimeout(() => {
      if (liveWatch) liveWatch.retry = 0;
      if (!onLiveScreen() || token !== viewToken) return;
      bindLiveChannel();
    }, delay);
  }
  function bindLiveChannel() {
    if (!onLiveScreen() || token !== viewToken || typeof sb === 'undefined' || !sb) return;
    dropLiveChannel();
    const gen = liveGen;
    const channel = sb.channel('room:live', {
      config: {
        presence: { key: Auth.user.id },
        broadcast: { ack: false, self: false }
      }
    });
    liveChannel = channel;
    let typingOn = false;
    let typingIdle = 0;
    markTyping = on => {
      if (!liveChannel || gen !== liveGen || !Auth.user) return;
      if (on === typingOn) return;
      typingOn = on;
      const handle = String((Auth.profile && Auth.profile.username) || 'driver').replace(/^@/, '');
      liveChannel.send({ type: 'broadcast', event: 'typing', payload: { id: Auth.user.id, handle, typing: !!on } }).catch(() => {});
    };
    input.oninput = () => {
      markTyping(true);
      clearTimeout(typingIdle);
      typingIdle = setTimeout(() => markTyping(false), 1600);
    };
    channel.on('broadcast', { event: 'typing' }, evt => {
      if (gen !== liveGen || token !== viewToken) return;
      const payload = (evt && evt.payload) || {};
      const id = payload.id;
      if (!id || (Auth.user && id === Auth.user.id)) return;
      if (payload.typing) {
        typingState.set(id, { handle: String(payload.handle || 'driver').replace(/^@/, ''), until: Date.now() + 2200 });
      } else {
        typingState.delete(id);
      }
      paintPeople();
    });
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payloadRow => {
      if (gen !== liveGen || token !== viewToken) return;
      const empty = document.getElementById('live-empty');
      if (empty) empty.remove();
      paintMessage(payloadRow.new || {}, false);
    });
    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, payloadRow => {
      if (gen !== liveGen) return;
      dropMessage(payloadRow.old && payloadRow.old.id);
    });
    channel.on('system', '*', payload => {
      if (gen !== liveGen || token !== viewToken) return;
      if (payload && payload.extension === 'postgres_changes' && payload.status === 'ok') catchUp();
    });
    channel.on('presence', { event: 'sync' }, paintPeople);
    channel.on('presence', { event: 'join' }, paintPeople);
    channel.on('presence', { event: 'leave' }, paintPeople);
    channel.subscribe(status => {
      if (gen !== liveGen) return;
      if (status === 'SUBSCRIBED') {
        if (liveWatch) liveWatch.retryMs = 1000;
        setLiveStatus('');
        trackPresence(channel);
        catchUp();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setLiveStatus(status === 'CLOSED' ? 'Connection lost. Trying again.' : 'Reconnecting to the room.');
        scheduleReconnect();
      }
    });
  }
  function onResume() {
    if (document.visibilityState === 'hidden') return;
    if (!onLiveScreen() || token !== viewToken) return;
    catchUp();
    const state = liveChannel && liveChannel.state;
    if (!liveChannel || state === 'closed' || state === 'errored') scheduleReconnect();
  }
  if (liveWatch) {
    document.removeEventListener('visibilitychange', liveWatch.vis);
    window.removeEventListener('pageshow', liveWatch.vis);
    window.removeEventListener('online', liveWatch.vis);
    if (liveWatch.poll) clearInterval(liveWatch.poll);
    if (liveWatch.typing) clearInterval(liveWatch.typing);
    if (liveWatch.retry) clearTimeout(liveWatch.retry);
    if (liveWatch.presence) clearTimeout(liveWatch.presence);
  }
  liveWatch = { vis: onResume, poll: 0, typing: 0, retry: 0, presence: 0, retryMs: 1000 };
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('pageshow', onResume);
  window.addEventListener('online', onResume);
  liveWatch.poll = setInterval(() => {
    if (document.visibilityState === 'hidden' || !onLiveScreen() || token !== viewToken) return;
    catchUp();
  }, 5000);
  liveWatch.typing = setInterval(() => {
    if (!onLiveScreen() || token !== viewToken || !typingState.size) return;
    const before = typingState.size;
    typingLabel();
    if (typingState.size !== before) paintPeople();
  }, 1000);
  bindLiveChannel();
  if (window.matchMedia('(min-width:769px)').matches) input.focus();
}
