/* News feed and article. Markdown is escaped first, then a small safe subset is marked up. */
const NEWS_TITLE = "IM DRIVN – More than a Marketplace … It's a Community";
const NEWS_DESC = "Australia's premium marketplace for high performance cars. Built by car people, for car people. Join the crew today.";

function newsCatLabel(id) {
  const hit = News.cats.find(row => row[0] === id);
  return hit ? hit[1] : 'News';
}
function newsDate(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function newsHttp(url) {
  const raw = String(url || '').trim().replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (!/^https?:\/\//i.test(raw) || /[\s"'<>\\]/.test(raw)) return '';
  return raw;
}
function newsCover(url) {
  const src = newsImageUrl(url);
  if (!src) return '<div class="news-ph"><img src="img/logo.svg" alt=""></div>';
  return `<img src="${esc(src)}" alt="">`;
}
function newsInline(escaped) {
  return escaped
    .replace(/!\[([^\]]*)\]\((javascript:[^\n]*)\)/gi, '')
    .replace(/\[([^\]]+)\]\((javascript:[^\n]*)\)/gi, '$1')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
      const href = newsHttp(url.replace(/&amp;/g, '&'));
      return href ? `<img src="${esc(href)}" alt="${alt}" loading="lazy">` : '';
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      const href = newsHttp(url.replace(/&amp;/g, '&'));
      return href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>` : text;
    })
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}
function newsMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const inline = text => newsInline(esc(text));
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      if (i < lines.length) i += 1;
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    if (!line.trim()) { i += 1; continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.min(4, heading[1].length + 1);
      out.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
      i += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push('<li>' + inline(lines[i].replace(/^[-*]\s+/, '')) + '</li>');
        i += 1;
      }
      out.push('<ul>' + items.join('') + '</ul>');
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push('<li>' + inline(lines[i].replace(/^\d+\.\s+/, '')) + '</li>');
        i += 1;
      }
      out.push('<ol>' + items.join('') + '</ol>');
      continue;
    }
    if (/^>\s?/.test(line)) {
      const bits = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bits.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push('<blockquote><p>' + inline(bits.join(' ')) + '</p></blockquote>');
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,3}\s|[-*]\s|\d+\.\s|>\s?|```)/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push('<p>' + inline(para.join(' ')) + '</p>');
  }
  return out.join('');
}
function newsMeta(name) {
  let el = document.querySelector('meta[property="' + name + '"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', name);
    document.head.appendChild(el);
  }
  return el;
}
function resetNewsMeta() {
  document.title = NEWS_TITLE;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', NEWS_DESC);
  newsMeta('og:title').setAttribute('content', 'IM DRIVN');
  newsMeta('og:description').setAttribute('content', NEWS_DESC);
  newsMeta('og:type').setAttribute('content', 'website');
  const image = document.querySelector('meta[property="og:image"]');
  if (image && image.dataset.news) {
    image.setAttribute('content', image.dataset.news);
    delete image.dataset.news;
  }
}
function setNewsMeta(article) {
  const title = (article.title || 'News') + ' – IM DRIVN';
  const summary = article.summary || NEWS_DESC;
  document.title = title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', summary);
  newsMeta('og:title').setAttribute('content', title);
  newsMeta('og:description').setAttribute('content', summary);
  newsMeta('og:type').setAttribute('content', 'article');
  newsMeta('og:url').setAttribute('content', newsLink(article.slug));
  const image = document.querySelector('meta[property="og:image"]');
  const cover = newsImageUrl(article.cover_image_url);
  if (image && cover) {
    if (!image.dataset.news) image.dataset.news = image.getAttribute('content') || '';
    image.setAttribute('content', cover);
  }
}
function newsLink(slug) {
  return location.origin + location.pathname + location.search + '#/news/' + encodeURIComponent(slug);
}
function newsCard(row) {
  const date = newsDate(row.published_at);
  return `<article class="news-card"><a href="#/news/${encodeURIComponent(row.slug)}"><div class="news-cover">${newsCover(row.cover_image_url)}</div><div class="news-card-copy"><span class="news-chip">${esc(newsCatLabel(row.category))}</span><h2>${esc(row.title || 'Untitled')}</h2>${row.summary ? `<p>${esc(row.summary)}</p>` : ''}${date ? `<time datetime="${esc(row.published_at)}">${esc(date)}</time>` : ''}</div></a></article>`;
}
function newsFilters(active) {
  const chips = [['','All']].concat(News.cats.filter(row => row[0] !== 'general'));
  return `<div class="news-filters" role="group" aria-label="News categories">${chips.map(([id, label]) => {
    const on = (active || '') === id;
    const href = id ? '#/news?cat=' + encodeURIComponent(id) : '#/news';
    return `<a class="news-filter" href="${href}" aria-pressed="${on ? 'true' : 'false'}">${label}</a>`;
  }).join('')}</div>`;
}
async function newsFeed() {
  const token = ++viewToken;
  resetNewsMeta();
  document.title = 'News – IM DRIVN';
  const cat = (hashParts().params.get('cat') || '').toLowerCase();
  const known = News.cats.some(row => row[0] === cat && row[0] !== 'general');
  const category = known ? cat : '';
  main.innerHTML = `<div class="wrap news"><div class="eyebrow">NEWS</div><h1>What's happening</h1><p class="muted">The builds, the drops, the weekends. No filler.</p>${newsFilters(category)}<div class="news-grid" id="news-grid"><p class="muted">Loading…</p></div><p class="news-more-row"><button type="button" class="btn" id="news-more" hidden>Load more</button></p></div>`;
  let offset = 0;
  const grid = document.getElementById('news-grid');
  const more = document.getElementById('news-more');
  async function pull(replace) {
    const res = await News.list(category, offset);
    if (token !== viewToken || !grid.isConnected) return;
    if (res.failed && replace) {
      grid.innerHTML = '<p class="muted">Couldn\'t load the news just now. Give it another go in a minute.</p>';
      more.hidden = true;
      return;
    }
    const rows = res.rows || [];
    if (replace && !rows.length) {
      grid.innerHTML = '<p class="news-empty">Fresh news dropping soon.</p>';
      more.hidden = true;
      return;
    }
    const html = rows.map(newsCard).join('');
    if (replace) grid.innerHTML = html;
    else grid.insertAdjacentHTML('beforeend', html);
    offset += rows.length;
    more.hidden = rows.length < News.pageSize;
  }
  more.onclick = async () => {
    more.disabled = true;
    try { await pull(false); }
    catch (e) { if (token === viewToken) toast('Couldn\'t load more just now.'); }
    if (more.isConnected) more.disabled = false;
  };
  try { await pull(true); }
  catch (e) { if (token === viewToken && grid.isConnected) grid.innerHTML = '<p class="news-empty">Fresh news dropping soon.</p>'; }
}
async function newsArticle(raw) {
  const token = ++viewToken;
  resetNewsMeta();
  let slug = raw || '';
  try { slug = decodeURIComponent(slug); } catch (e) {}
  main.innerHTML = '<div class="wrap news"><p class="muted">Loading…</p></div>';
  let res = { row: null };
  try { res = await News.get(slug); } catch (e) { res = { failed: true }; }
  if (token !== viewToken) return;
  if (!res.row) {
    document.title = 'News – IM DRIVN';
    const line = res.failed ? 'Couldn\'t load that story just now.' : 'That story isn\'t up yet.';
    main.innerHTML = `<div class="wrap news"><a class="eyebrow" href="#/news">← News</a><h1>${esc(line)}</h1><p class="news-empty">Fresh news dropping soon.</p></div>`;
    return;
  }
  const row = res.row;
  setNewsMeta(row);
  const date = newsDate(row.published_at);
  const author = String(row.author || '').trim();
  const sourceUrl = newsHttp(row.source_url);
  const sourceName = String(row.source_name || '').trim();
  const source = sourceName && sourceUrl
    ? `<p class="news-source"><a href="${esc(sourceUrl)}" target="_blank" rel="noopener">Source: ${esc(sourceName)}</a></p>`
    : (sourceName ? `<p class="news-source">Source: ${esc(sourceName)}</p>` : '');
  const insta = newsHttp(row.instagram_post_url);
  const instaLink = insta ? `<p class="news-source"><a href="${esc(insta)}" target="_blank" rel="noopener">As seen on our Insta</a></p>` : '';
  const extras = (Array.isArray(row.image_urls) ? row.image_urls : []).map(newsImageUrl).filter(src => src && src !== newsImageUrl(row.cover_image_url));
  const gallery = extras.length ? `<div class="news-gallery">${extras.map(src => `<img src="${esc(src)}" alt="" loading="lazy">`).join('')}</div>` : '';
  main.innerHTML = `<div class="wrap news news-story"><a class="eyebrow" href="#/news">← News</a><div class="news-hero">${newsCover(row.cover_image_url)}</div><span class="news-chip">${esc(newsCatLabel(row.category))}</span><h1>${esc(row.title || 'Untitled')}</h1><p class="news-by">${[author, date].filter(Boolean).map(esc).join(' · ')}</p><div class="news-body">${newsMarkdown(row.body || '')}</div>${gallery}${source}${instaLink}<div class="news-share"><button type="button" class="btn" id="news-copy">Copy link</button><button type="button" class="btn" id="news-native">Share</button></div></div>`;
  const link = newsLink(row.slug);
  const copy = document.getElementById('news-copy');
  const native = document.getElementById('news-native');
  if (native && !navigator.share) native.hidden = true;
  if (copy) copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied.');
    } catch (e) {
      toast('Couldn\'t copy that. The address is in the bar.');
    }
  };
  if (native) native.onclick = async () => {
    try { await navigator.share({ title: row.title || 'IM DRIVN', text: row.summary || '', url: link }); }
    catch (e) {}
  };
}
