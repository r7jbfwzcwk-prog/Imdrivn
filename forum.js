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
  if (!fMine(authorId)) return null;
  const row = fEl('div', { class: 'factions' });
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
  return row;
}

async function forumIndex() {
  const token = ++viewToken;
  main.innerHTML = '';
  const wrap = fEl('div', { class: 'wrap forum' });
  wrap.append(fEl('div', { class: 'eyebrow' }, 'The crew'), fEl('h1', null, 'The forum'));
  wrap.append(fEl('p', { class: 'muted' }, 'Ask the dumb question. Someone has already broken that part. No gatekeeping.'));
  const list = fEl('div', { class: 'fcats' });
  list.append(fEl('p', { class: 'muted' }, 'Loading the boards…'));
  wrap.append(list);
  main.append(wrap);
  let cats = [];
  try { cats = await Forum.categories(); } catch (e) {
    if (token !== viewToken) return;
    list.textContent = '';
    list.append(fEl('p', { class: 'err' }, e.message || 'Could not load the forum.'));
    return;
  }
  if (token !== viewToken) return;
  list.textContent = '';
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
  await Auth.ready;
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
  tools.append(fComposer(cat));
  let threads = [];
  try { threads = await Forum.threads(cat.id); }
  catch (e) {
    if (token !== viewToken) return;
    list.append(fEl('p', { class: 'err' }, e.message || 'Could not load threads.'));
    return;
  }
  if (token !== viewToken) return;
  if (!threads.length) list.append(fEl('p', { class: 'fempty' }, 'Quiet in here. Be the one who asks.'));
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

function fComposer(cat) {
  const box = fEl('div', { class: 'fcomposer' });
  if (!fCanPost()) { box.append(fGateButton()); return box; }
  const open = fEl('button', { class: 'btn solid', type: 'button' }, 'New thread');
  const form = fEl('form', { class: 'panel', hidden: 'hidden' });
  const title = fEl('input', { name: 'title', maxlength: '140', required: 'required', placeholder: 'What is the car doing?', 'aria-label': 'Thread title' });
  const body = fEl('textarea', { name: 'body', rows: '5', maxlength: '8000', required: 'required', placeholder: 'Year, make, what you already tried. The useful stuff.', 'aria-label': 'Thread details' });
  const err = fEl('p', { class: 'err', role: 'alert' });
  const row = fEl('div', { class: 'auth-row' });
  const post = fEl('button', { class: 'btn solid', type: 'submit' }, 'Post thread');
  const cancel = fEl('button', { class: 'btn', type: 'button' }, 'Cancel');
  row.append(post, cancel);
  form.append(fEl('label', null, 'Title'), title, fEl('label', null, 'Details'), body, err, row);
  open.addEventListener('click', () => { form.hidden = false; open.hidden = true; title.focus(); });
  cancel.addEventListener('click', () => { form.hidden = true; open.hidden = false; err.textContent = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const t = title.value.trim(), b = body.value.trim();
    if (t.length < 3 || t.length > 140) { err.textContent = 'Title needs 3–140 characters. Say what the car is doing.'; return; }
    if (!b) { err.textContent = 'Write the actual question. One sentence is enough.'; return; }
    post.disabled = true; err.textContent = '';
    try {
      const created = await Forum.createThread(cat.id, t, b);
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
  await Auth.ready;
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
  const actions = fActions(row.author_id, () => fEdit(article, row, isThread, body, title), async () => {
    if (isThread) await Forum.deleteThread(row.id);
    else await Forum.deleteReply(row.id);
    afterDelete();
  });
  if (actions) article.append(actions);
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
      if (title) title.textContent = nextTitle;
      body.textContent = nextBody;
      row.title = nextTitle;
      row.body = nextBody;
      form.remove();
    } catch (e) { err.textContent = e.message || 'Could not save that.'; save.disabled = false; }
  });
  body.after(form);
}

function fReplyBox(threadId) {
  const box = fEl('div', { class: 'fcomposer' });
  box.append(fEl('h2', null, 'Reply'));
  if (!fCanPost()) { box.append(fGateButton()); return box; }
  const form = fEl('form', { class: 'panel' });
  const area = fEl('textarea', { rows: '4', maxlength: '8000', required: 'required', placeholder: 'What would you tell them?', 'aria-label': 'Reply' });
  const err = fEl('p', { class: 'err', role: 'alert' });
  const post = fEl('button', { class: 'btn solid', type: 'submit' }, 'Reply');
  form.append(area, err, post);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = area.value.trim();
    if (!text) { err.textContent = 'Say something first.'; return; }
    post.disabled = true; err.textContent = '';
    try { await Forum.reply(threadId, text); forumThread(threadId); }
    catch (e) { err.textContent = e.message || 'Could not post that.'; post.disabled = false; }
  });
  box.append(form);
  return box;
}
