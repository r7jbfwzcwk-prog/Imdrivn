/* IM DRIVN forum. User text is set with textContent only. */
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
  sessionStorage.setItem('imdrivn_next', location.hash.replace(/^#\//, ''));
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
  try { sessionStorage.setItem('imdrivn_next', next); } catch (e) {}
  if (location.hash !== '#/join') location.hash = '#/join';
  else if (typeof join === 'function') join();
  return false;
}
async function forumIndex() {
  const token = ++viewToken;
  if (!(await forumMember(token))) return;
  if (token !== viewToken) return;
  const query = forumQuery();
  main.innerHTML = '';
  const wrap = fEl('div', { class: 'wrap forum' });
  wrap.append(fEl('div', { class: 'eyebrow' }, 'The Drivn Community'), fEl('h1', null, query ? 'Forum search' : 'The forum'));
  wrap.append(fEl('p', { class: 'muted' }, query ? '' : 'Ask the dumb question. Someone has already broken that part. No gatekeeping.'));
  const list = fEl('div', { class: query ? 'fthreads' : 'fcats' });
  list.append(fEl('p', { class: 'muted' }, query ? 'Searching…' : 'Loading the boards…'));
  wrap.append(list);
  main.append(wrap);
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
  list.append(liveBoardCard());
  watchLiveCount(token);
  cats.forEach(cat => {
    const count = fCount(cat.forum_threads);
    const latest = Array.isArray(cat.latest) ? cat.latest[0] : null;
    const link = fEl('a', { class: 'fcat', href: '#/forum/' + encodeURIComponent(cat.slug) });
    const title = fEl('div', { class: 'fcat-top' });
    title.append(fEl('h2', null, cat.name || ''));
    title.append(fEl('span', { class: 'fcount' }, count === 1 ? '1 thread' : count + ' threads'));
    link.append(title);
    if (cat.description) link.append(fEl('p', null, cat.description));
    link.append(fEl('p', { class: 'flatest' }, latest ? 'Latest · ' + latest.title : 'No threads yet. Be the first.'));
    if (latest && latest.last_activity_at) link.append(fEl('time', null, whenLabel(latest.last_activity_at)));
    list.append(link);
  });
}

async function forumCategory(slug) {
  const token = ++viewToken;
  if (!(await forumMember(token))) return;
  if (token !== viewToken) return;
  main.innerHTML = '';
  const wrap = fEl('div', { class: 'wrap forum' });
  wrap.append(fEl('a', { class: 'eyebrow', href: '#/forum' }, '← The forum'));
  const heading = fEl('h1', null, 'Loading…');
  wrap.append(heading);
  const tools = fEl('div', { class: 'ftools' });
  const list = fEl('div', { class: 'fthreads' });
  wrap.append(tools, list);
  main.append(wrap);
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
  heading.textContent = cat.name || '';
  if (cat.description) heading.after(fEl('p', { class: 'muted' }, cat.description));
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
function fComposer(cat) {
  const box = fEl('div', { class: 'fcomposer' });
  if (!fCanPost()) { box.append(fGateButton()); return box; }
  const open = fEl('button', { class: 'btn solid', type: 'button' }, 'Post new thread');
  const form = fEl('form', { class: 'panel fnew', hidden: 'hidden' });
  const title = fEl('input', { name: 'title', maxlength: '140', required: 'required', placeholder: 'What is the car doing?', 'aria-label': 'Thread title' });
  const body = fEl('textarea', { name: 'body', rows: '5', maxlength: '8000', required: 'required', placeholder: 'Year, make, what you already tried. The useful stuff.', 'aria-label': 'Thread details' });
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
    if (t.length < 3 || t.length > 140) { err.textContent = 'Title needs 3–140 characters. Say what the car is doing.'; return; }
    if (!b) { err.textContent = 'Write the actual question. One sentence is enough.'; return; }
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
  const wrap = fEl('div', { class: 'wrap forum' });
  wrap.append(fEl('p', { class: 'muted' }, 'Loading the thread…'));
  main.append(wrap);
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
  wrap.append(back);
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
    if (isThread && (nextTitle.length < 3 || nextTitle.length > 140)) { err.textContent = 'Title needs 3–140 characters.'; return; }
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
  const fit = window.__liveFit;
  if (fit) {
    window.removeEventListener('resize', fit);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', fit);
      window.visualViewport.removeEventListener('scroll', fit);
    }
    window.__liveFit = null;
  }
  document.body.classList.remove('is-livechat');
}
function liveBoardCard() {
  const link = fEl('a', { class: 'fcat flive', href: '#/forum/live' });
  const title = fEl('div', { class: 'fcat-top' });
  const name = fEl('h2', { class: 'flive-title' });
  name.append(fEl('span', { class: 'flive-dot', 'aria-hidden': 'true' }));
  name.append(document.createTextNode('Live Chat'));
  title.append(name, fEl('span', { class: 'fcount', id: 'flive-count' }, '0 online'));
  link.append(title, fEl('p', null, 'One room. The people who are in it right now.'));
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
    const count = document.getElementById('flive-count');
    if (!count) return;
    const n = Object.keys(channel.presenceState() || {}).length;
    count.textContent = n === 1 ? '1 online' : n + ' online';
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
function keyboardViewport() {
  const fake = window.__kbViewport;
  if (fake && typeof fake.height === 'number') return { height: fake.height, offsetTop: fake.offsetTop || 0 };
  const vv = window.visualViewport;
  return { height: vv ? vv.height : window.innerHeight, offsetTop: vv ? vv.offsetTop : 0 };
}
function fitLive() {
  const root = document.querySelector('.livechat');
  if (!root) return;
  const header = document.querySelector('.top');
  const box = keyboardViewport();
  const viewH = box.height;
  const viewTop = box.offsetTop;
  const keyboard = Math.max(0, window.innerHeight - viewH - viewTop);
  const open = keyboard > 40 || document.body.classList.contains('kb-open');
  const nav = document.querySelector('.bnav');
  const navBox = !open && nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect() : null;
  const reserve = navBox && navBox.height > 20 ? Math.max(0, window.innerHeight - navBox.top) : 0;
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const visibleHeader = Math.max(0, Math.min(headerBottom, viewH));
  if (open) {
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.right = '0';
    root.style.zIndex = '15';
    root.style.margin = '0 auto';
    root.style.top = Math.round(viewTop + visibleHeader) + 'px';
  } else {
    root.style.position = '';
    root.style.left = '';
    root.style.right = '';
    root.style.top = '';
    root.style.zIndex = '';
    root.style.margin = '';
  }
  root.style.height = Math.max(180, Math.round(viewH - visibleHeader - reserve)) + 'px';
  root.style.transform = '';
  if (open && window.scrollY) window.scrollTo(0, 0);
}
function bindLiveFit() {
  const fit = () => fitLive();
  window.__liveFit = fit;
  window.addEventListener('resize', fit);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fit);
    window.visualViewport.addEventListener('scroll', fit);
  }
  fit();
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
  titles.append(fEl('a', { class: 'eyebrow', href: '#/forum' }, 'The forum'), name);
  const pill = fEl('button', { type: 'button', class: 'live-pill', 'aria-expanded': 'false', 'aria-controls': 'live-drawer' });
  pill.append(fEl('span', { class: 'flive-dot', 'aria-hidden': 'true' }), fEl('span', { class: 'live-pill-n' }, '0 online'));
  head.append(titles, pill);
  const summary = fEl('p', { class: 'live-now', id: 'live-now' });
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
  root.append(head, summary, drawer, shell);
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
    if (typeof canSeeReports === 'function' && canSeeReports()) {
      const del = fEl('button', { type: 'button', class: 'auth-link live-del' }, 'Delete');
      del.addEventListener('click', () => askRemove('Delete this message?', async () => { await LiveChat.remove(row.id); }));
      item.append(del);
    }
    log.append(item);
    trimLiveFeed(log, seen, follow);
    if (follow) log.scrollTop = log.scrollHeight;
  }
  function dropMessage(id) {
    const node = log.querySelector('[data-id="' + id + '"]');
    if (node) node.remove();
    seen.delete(id);
  }
  function paintPeople() {
    if (token !== viewToken) return;
    const people = livePeople(liveChannel);
    const n = people.length;
    pill.querySelector('.live-pill-n').textContent = n + ' online';
    const names = people.filter(person => person.typing && (!Auth.user || person.id !== Auth.user.id)).map(person => '@' + person.handle);
    typing.textContent = !names.length ? '' : names.length === 1 ? names[0] + ' is typing…' : names.slice(0, 2).join(' and ') + ' are typing…';
    const shown = [];
    let used = 0;
    people.forEach(person => {
      const label = '@' + person.handle;
      const add = (shown.length ? 2 : 0) + label.length;
      if (!shown.length || used + add <= 32) { shown.push(label); used += add; }
    });
    summary.textContent = '';
    summary.append(fEl('span', { class: 'live-names' }, 'Online: ' + (shown.join(', ') || 'nobody yet')));
    if (people.length > shown.length) summary.append(fEl('span', { class: 'live-more' }, '+' + (people.length - shown.length)));
    [aside, drawer].forEach(host => {
      const open = host === drawer && !host.hidden;
      host.textContent = '';
      host.append(fEl('p', { class: 'live-online-h' }, 'Online now'));
      if (!people.length) host.append(fEl('p', { class: 'muted' }, 'Nobody in the room yet.'));
      people.forEach(person => host.append(fEl('p', { class: 'live-person' }, '@' + person.handle)));
      if (host === drawer) host.hidden = !open;
    });
  }
  paintPeople();
  let markTyping = () => {};
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
      err.textContent = e.message || 'Could not send that.';
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
  dropLiveChannel();
  const gen = liveGen;
  const channel = sb.channel('room:live', { config: { presence: { key: Auth.user.id } } });
  liveChannel = channel;
  const payload = typing => ({
    handle: String((Auth.profile && Auth.profile.username) || 'driver').replace(/^@/, ''),
    avatar: (Auth.profile && /^https?:\/\//i.test(Auth.profile.avatar_url || '')) ? Auth.profile.avatar_url : '',
    typing: !!typing
  });
  let typingOn = false;
  let typingIdle = 0;
  markTyping = on => {
    if (!liveChannel || gen !== liveGen) return;
    if (on === typingOn) return;
    typingOn = on;
    liveChannel.track(payload(on)).catch(() => {});
  };
  input.addEventListener('input', () => {
    markTyping(true);
    clearTimeout(typingIdle);
    typingIdle = setTimeout(() => markTyping(false), 1600);
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
  channel.on('presence', { event: 'sync' }, paintPeople);
  channel.on('presence', { event: 'join' }, paintPeople);
  channel.on('presence', { event: 'leave' }, paintPeople);
  channel.subscribe(status => {
    if (gen !== liveGen) return;
    if (status === 'SUBSCRIBED') channel.track(payload(false)).then(paintPeople).catch(() => {});
  });
  if (window.matchMedia('(min-width:769px)').matches) input.focus();
}
