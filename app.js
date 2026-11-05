const INSTAGRAM_URL='https://instagram.com/imdrivn';
const TIKTOK_URL='https://tiktok.com/@imdrivn';
const INSPECTION_URL='#';
const FINANCE_URL='#';
const VIN_CHECK_URL='#';
const PAYMENT_URL='#';
const $=(s,r=document)=>r.querySelector(s),main=$('#main');
const aud=n=>'$'+Number(n).toLocaleString('en-AU'),kms=n=>Number(n).toLocaleString('en-AU')+' km';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const passes=l=>{if(l.status==='sold')return false;const km=l.km??l.kms;const makeOk=!F.make||fold(l.make)===fold(F.make);const modelOk=!F.model||fold(l.model)===fold(F.model);const yearOk=(!F.year||+l.year>=+F.year)&&(!F.yearTo||+l.year<=+F.yearTo);const kmOk=!F.km||+km<+F.km;const words=String(F.q||'').trim().split(/\s+/).filter(Boolean).map(fold);const hay=fold([l.make,l.model,l.heading,l.desc,l.description].filter(Boolean).join(' '));return makeOk&&modelOk&&yearOk&&kmOk&&words.every(w=>hay.includes(w))};
const demosFor=(saved,filtered=true)=>DEMO.filter(l=>l.status!=='sold'&&(saved||BUY==='all'||l.sec===m2s(BUY))&&(!filtered||passes(l))&&(!saved||(st()[l.id]||{}).save));
const I={tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',up:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 16V8m-4 4 4-4 4 4"/>',
shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',gauge:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 15 4-5"/><path d="M6 13h1m10 0h1M12 8v1"/>',
lock:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11"/>',head:'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="5" rx="1"/><rect x="17" y="14" width="4" height="5" rx="1"/><path d="M19 19c0 1.5-2 2-5 2"/>',
bag:'<path d="M6 8h12l-1 12H7z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
car:'<path d="M3 14h18"/><path d="M5 14 7 9h10l2 5"/><circle cx="7.5" cy="16.5" r="1.4"/><circle cx="16.5" cy="16.5" r="1.4"/>',
cart:'<path d="M3 5h2.2L7 14h11.2l1.5-6.5H7"/><circle cx="9" cy="18.2" r="1.4"/><circle cx="16.4" cy="18.2" r="1.4"/>',
spark:'<path d="m12 3 1.8 5.2H19l-4.2 3.1 1.6 5.2L12 13.6 7.6 16.5l1.6-5.2L5 8.2h5.2z"/>',
trophy:'<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5.4A2.4 2.4 0 0 0 8 9.6"/><path d="M16 6h2.6A2.4 2.4 0 0 1 16 9.6"/><path d="M12 14v2"/><path d="M9.2 20h5.6l-.7-4h-4.2z"/>',
note:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.25"/><circle cx="6" cy="9.2" r=".7" fill="currentColor" stroke="none"/><circle cx="18" cy="9.2" r=".7" fill="currentColor" stroke="none"/><circle cx="6" cy="14.8" r=".7" fill="currentColor" stroke="none"/><circle cx="18" cy="14.8" r=".7" fill="currentColor" stroke="none"/>'};
const ico=k=>`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const FALLBACK="this.onerror=null;this.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 16 10&quot;><rect width=&quot;16&quot; height=&quot;10&quot; fill=&quot;%231b1b1e&quot;/><text x=&quot;8&quot; y=&quot;5.6&quot; font-size=&quot;1&quot; fill=&quot;%23777&quot; text-anchor=&quot;middle&quot;>PHOTO</text></svg>')";

async function home(){const token=++homeToken;main.innerHTML=`
<section class="landing"><section class="hero"><div class="wrap"><div class="eyebrow">IM DRIVN</div>
<h1>The high<br><span class="grey">performance</span><br>marketplace</h1><hr><p><em>Australia's premium marketplace for high performance cars.</em> Why pay to sell your car when you can list it here free!</p></div></section>
<div class="wrap home-paths"><div class="paths">
<a class="path" href="#/buyin">${ico('tag')}<span class="wide">IM BUYIN</span><span class="tag">Find your next machine.</span><span class="muted">Browse cars available now on IM DRIVN.</span><span class="btn">Browse cars →</span></a>
<a class="path" href="#/sell">${ico('up')}<span class="wide">IM SELLIN</span><span class="tag">List with confidence.</span><span class="muted">List free, or get a wholesale offer from dealers.</span><span class="btn">Sell your car →</span></a></div></div></section>
<section class="wrap feats" id="how"><div class="eyebrow">Built for enthusiasts. DRIVN by performance.</div><div class="row4">
${[['shield','Verified vehicles','Every car is checked for quality and authenticity.'],['gauge','Serious buyers','Connect with genuine high performance buyers.'],['lock','Secure & safe','Safe transactions from start to finish.'],['head','Expert support','Real people, real support when you need it.']].map(f=>`<div class="feat">${ico(f[0])}<h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div></section>
<section class="wrap"><div class="eyebrow">Fresh in the feed</div><div class="feed" id="fresh" style="padding:0;margin-top:var(--s-4)"></div></section>
${about()}`;
let rows=[];try{rows=await ListingStore.page({mode:BUY,from:0,to:2})}catch(e){rows=[]}
if(token!==homeToken||!$('#fresh'))return;
const fresh=(rows.length?rows:demosFor(false,false)).slice(0,3);
$('#fresh').innerHTML=fresh.map(l=>post(l)).join('')||'<p class="muted">Nothing in this mode yet.</p>';}
const about=()=>`<section class="about" id="about"><div class="img" role="img" aria-label="Taillight of a dark car"></div><div class="txt"><div class="eyebrow">About IM DRIVN</div>
<h2>More than a marketplace.<br>It's a community.</h2><p class="muted">IM DRIVN connects Australia's car community — from supercars to performance weapons to the daily drive. Buy. Sell. Drive. All in one place. Listing is 100% free.</p><a class="btn" href="#/how">Learn more</a></div><div class="water" aria-hidden="true">IM DRIVN</div></section>`;

const SV={heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',send:'<path d="M4 7h16v10H4z"/><path d="m4 8 8 5 8-5"/>',mark:'<path d="M6 3h12v18l-6-4-6 4z"/>',pin:'<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
check:'<circle cx="12" cy="12" r="9" class="fillc"/><path d="m8 12 3 3 5-6" stroke="#000"/>'};
const sv=(k,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${SV[k]}</svg>`;
const st=()=>JSON.parse(localStorage.getItem('imdrivn_social')||'{}');
function canMessage(l){return !!(l&&!l.demo&&l.user_id&&l.status!=='sold'&&!(Auth.user&&l.user_id===Auth.user.id))}
function liveAd(l){return !!(l&&!l.demo&&(!l.status||l.status==='active'))}
function cylLabel(n){const num=+n;if(!num)return '';const v={6:'V6',8:'V8',10:'V10',12:'V12'};return v[num]||(num+' cyl')}
function inductionOf(l){const v=String((l&&l.induction)||'').trim();if(v==='Turbo'||v==='Supercharged'||v==='N/A')return v;if(l&&l.supercharged===true)return 'Supercharged';if(l&&l.turbo===true)return 'Turbo';return 'N/A'}
function transmissionOf(l){const raw=String((l&&(l.transmission||l.trans))||'').trim().toLowerCase();if(raw==='manual')return 'Manual';if(raw==='auto'||raw==='automatic')return 'Auto';return ''}
function regoVinOf(l){const rego=String((l&&l.rego)||'').trim();const vin=String((l&&l.vin)||'').trim();if(rego&&vin)return {text:rego+' · '+vin,request:false};if(rego||vin)return {text:rego||vin,request:false};return {text:'On request',request:true}}
function specGrid(l){const rows=[['Year',l.year||''],['Kilometres',(l.km||l.km===0)?kms(l.km):''],['Transmission',transmissionOf(l)],['Cylinders',cylLabel(l.cylinders)||''],['Induction',inductionOf(l)],['Location',[l.suburb,l.state,l.postcode].filter(Boolean).join(' ')]];const id=regoVinOf(l);const cells=rows.map(s=>`<div><span class="meta">${s[0]}</span><b>${esc(s[1]||'—')}</b></div>`).join('');const rego=id.request?'<button type="button" class="rego-ask" id="rego-ask">On request</button>':esc(id.text);return `<div class="specs">${cells}<div><span class="meta">Rego / VIN</span><b>${rego}</b></div></div>`}
function vinRequestText(l){const name=[l.year,l.make,l.model].filter(v=>v!=null&&String(v).trim()).join(' ')||'car';return "Hi! I'm interested in your "+name+". Could you please share the registration or VIN so I can run a VIN check on the vehicle? Thanks!"}
function vinCheckHref(listing, base){const url=base==null?VIN_CHECK_URL:base;if(!url||url==='#')return '#';const vin=String((listing&&listing.vin)||'').trim();if(!vin)return url;return url+(url.includes('?')?'&':'?')+'vin='+encodeURIComponent(vin)}
async function requestVin(listingOrId){await Auth.ready;let l=listingOrId&&typeof listingOrId==='object'?listingOrId:null;const id=l?l.id:listingOrId;if(!Auth.user||Auth.needsHandle()){sessionStorage.setItem('imdrivn_next','vin:'+id);if(location.hash!=='#/join')location.hash='#/join';else join();return}if(!l){l=ListingStore.cache.get(id);if(!l){try{l=await ListingStore.get(id)}catch(e){l=null}}}if(!l||l.demo||!l.user_id){toast('That car has no seller to ask.','error');return}if(l.user_id===Auth.user.id){toast("That's your own ad.",'error');return}let fresh=true;try{fresh=await VinAsk.claim(l.id)}catch(e){toast(e.message||'Could not send that.','error');return}try{const conv=await Chat.open(l);if(fresh)await Chat.send(conv.id,vinRequestText(l));toast(fresh?'Asked the seller for the rego or VIN.':"You've already asked the seller for the rego or VIN.");const dest='#/messages/'+conv.id;if(location.hash===dest)route();else location.hash=dest}catch(e){if(fresh){try{await VinAsk.release(l.id)}catch(err){}}toast(e.message||'Could not send that.','error')}}
function boostBadges(l){const perf=l.sec==='performance'||l.sec==='supercars';if(!perf)return '';const turbo=l.turbo===true,blown=l.supercharged===true;const bits=[];if(turbo)bits.push('Turbo');if(blown)bits.push('Supercharged');if(!bits.length&&l.turbo===false&&l.supercharged===false)bits.push('NA');if(!bits.length)return '';return `<span class="boosts">${bits.map(b=>`<span class="boost${b==='NA'?' is-na':''}">${b}</span>`).join('')}</span>`}
function powerLine(l){const text=[cylLabel(l.cylinders),String(l.engine||'').trim()].filter(Boolean).join(' · ');const badges=boostBadges(l);if(!text&&!badges)return '';return `<div class="power">${text?`<span class="power-spec">${esc(text)}</span>`:''}${badges}</div>`}
function laneOf(l){const raw=String((l&&(l.mode||l.sec))||'').toLowerCase();if(raw==='supercar'||raw==='supercars')return 'supercar';if(raw==='performance')return 'performance';return 'daily'}
function laneGroups(rows, owner){const lanes=[['daily','Daily','cart'],['performance','Performance','gauge'],['supercar','Supercar','trophy']];return lanes.map(([key,label,icon])=>{const items=rows.filter(l=>laneOf(l)===key);if(!items.length)return '';return `<section class="lane-group" data-mode="${key}"><h3 class="lane-label">${ico(icon)}<span>${label}</span></h3><div class="feed">${items.map(l=>post(l,owner===true)).join('')}</div></section>`}).join('')}
function post(l,ownerList){const demo=!!l.demo,S=demo?(st()[l.id]||{}):{like:!!l.liked,save:!!l.saved},lk=demo?(l.likes||0)+(S.like?1:0):(l.likeCount||0),title=l.heading||(l.year+' '+l.make+' '+l.model),sold=l.status==='sold';
return`<article class="post s-${l.sec}${sold?' is-sold':''}" data-mode="${laneOf(l)}"><a class="car shot" href="#/car/${l.id}"><img src="${esc(l.photos[0])}" alt="${esc(title)}" loading="lazy" onerror="${FALLBACK}">${photoMark()}
${sold?'':'<span class="new">NEW</span>'}<span class="ago">${esc(l.when||(l.ago?l.ago+'h ago':'Just now'))}</span>${demo?'<span class="dm">Demo</span>':''}${sold?'<span class="sold-badge">SOLD</span>':l.status&&l.status!=='active'?`<span class="dm">${esc(l.status)}</span>`:''}</a>
<div class="b"><a href="#/car/${l.id}" class="ttl">${esc(title)}</a><div class="price">${aud(l.price)}</div>
${powerLine(l)}
<div class="row"><span class="loc">${sv('pin')}${esc([l.suburb, l.state].filter(Boolean).join(' '))}</span>${atHandle(l.handle, true)}</div>
<div class="acts"><button data-act="like" data-id="${l.id}" data-demo="${demo?1:0}" aria-pressed="${!!S.like}" aria-label="Like">${sv('heart')}<span>${lk}</span></button>
${canMessage(l)?`<button data-act="msg" data-id="${l.id}" aria-label="Message seller">${sv('send')}</button>`:''}
<button class="bm" data-act="save" data-id="${l.id}" data-demo="${demo?1:0}" aria-pressed="${!!S.save}" aria-label="Save">${sv('mark')}</button></div>
${ownerList===true&&liveAd(l)?`<div class="owner-acts"><button type="button" class="sold-btn" data-act="sold" data-id="${esc(l.id)}">Sold</button><button type="button" class="sold-btn" data-act="edit" data-id="${esc(l.id)}">Edit</button></div>`:''}
</div></article>`;}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b||b.closest('.ask-preview'))return;
if(b.dataset.act==='msg'){messageSeller(b.dataset.id);return}
if(b.dataset.act==='sold'){if(b.closest('#mine'))markSold(b);return}
if(b.dataset.act==='edit'){if(b.closest('#mine'))editListing(b.dataset.id);return}
const demo=b.dataset.demo==='1';
if(!demo){if(!Auth.user){sessionStorage.setItem('imdrivn_next',(location.hash||'#/buy').replace(/^#\//,''));location.hash='#/join';return}
const on=b.getAttribute('aria-pressed')==='true';
try{await ListingStore.react(b.dataset.act==='save'?'save':'like',b.dataset.id,!on);b.setAttribute('aria-pressed',String(!on));
if(b.dataset.act==='like'){const n=b.querySelector('span');n.textContent=+n.textContent+(!on?1:-1)}}catch(err){alert(err.message||'Could not update that.')}
return}
const s=st(),o=s[b.dataset.id]||(s[b.dataset.id]={});
const k=b.dataset.act;o[k]=!o[k];localStorage.setItem('imdrivn_social',JSON.stringify(s));b.setAttribute('aria-pressed',o[k]);
if(k==='like'){const n=b.querySelector('span');n.textContent=+n.textContent+(o[k]?1:-1)}});

/* ===== MODES (like a drive-mode selector) ===== */
const MODES=['daily','performance','supercar'],BUY_MODES=['all',...MODES],m2s=m=>m==='supercar'?'supercars':m;
let MODE=localStorage.getItem('imdrivn_mode');if(!MODES.includes(MODE))MODE='daily';
let BUY=localStorage.getItem('imdrivn_buy');if(!BUY_MODES.includes(BUY))BUY='all';
function syncTabs(){document.querySelectorAll('.tabs button[role=tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.m===BUY));}
function setMode(m){if(!MODES.includes(m))return;MODE=m;localStorage.setItem('imdrivn_mode',m);document.body.dataset.mode=m;}
function setBuy(m){if(!BUY_MODES.includes(m))m='all';BUY=m;localStorage.setItem('imdrivn_buy',BUY);if(m!=='all')setMode(m);syncTabs();}
document.querySelectorAll('.tabs button[role=tab]').forEach(b=>b.onclick=()=>{setBuy(b.dataset.m);const h=location.hash;if(h==='#/buy'||h.startsWith('#/buy?')||h.startsWith('#/saved')||h===''||h==='#/')route();});
document.addEventListener('click',e=>{const pick=e.target.closest('[data-pick]');if(pick)setBuy(pick.dataset.pick)});
setMode(MODE);syncTabs();
function setSearchOpen(open){const panel=$('#spanel');if(!panel)return;panel.hidden=!open;document.querySelectorAll('#sbtn,#feedsearch').forEach(b=>b.setAttribute('aria-expanded',open?'true':'false'));if(open){const field=panel.querySelector('input');if(field)field.focus()}}
$('#sbtn').onclick=()=>setSearchOpen($('#spanel').hidden);
$('#feedsearch').onclick=()=>setSearchOpen($('#spanel').hidden);
function closeAlerts(){const panel=$('#alertpanel');if(!panel||panel.hidden)return;panel.hidden=true;const bell=$('#bell');if(bell)bell.setAttribute('aria-expanded','false')}
function alertCopy(n){const who='@'+(n.handle||'driver');const title=n.title||'a thread';const bit=String(n.preview||'').trim();if(n.kind==='message')return {type:'MESSAGE',text:who+': '+(bit||'New message')};if(n.kind==='mention')return {type:'MENTION',text:who+' mentioned you in "'+title+'"'+(bit?' — '+bit:'')};if(n.yours)return {type:'REPLY',text:who+' replied to your thread "'+title+'"'+(bit?' — '+bit:'')};return {type:'REPLY',text:who+' replied in "'+title+'"'+(bit?' — '+bit:'')}}
function alertRow(n){const copy=alertCopy(n);return `<button type="button" class="alert-row${n.read?'':' is-unread'}" data-alert="${esc(n.id)}">${n.read?'':unreadMark()}<span class="alert-copy"><b>${esc(copy.type)}</b><span>${esc(copy.text)}</span></span></button>`}
let alertToken=0;
async function renderAlerts(){const host=$('#alertlist');if(!host)return;const ticket=++alertToken;await Auth.ready;if(ticket!==alertToken)return;if(!Auth.user){host.innerHTML='<p class="muted">Sign in to see your alerts.</p><a class="btn" href="#/join">Sign in</a>';return}host.innerHTML='<p class="muted">Loading…</p>';let rows=[];try{rows=await Notes.list()}catch(e){if(ticket===alertToken&&$('#alertlist'))$('#alertlist').innerHTML=`<p class="err">${esc(e.message||'Could not load alerts.')}</p>`;return}if(ticket!==alertToken||!$('#alertlist')||$('#alertpanel').hidden)return;if(!rows.length){host.innerHTML='<p class="muted">No alerts yet.</p>';return}host.innerHTML=rows.map(alertRow).join('');host.querySelectorAll('[data-alert]').forEach(btn=>{btn.onclick=()=>{const n=rows.find(r=>r.id===btn.dataset.alert);if(n)openAlert(n)}})}
async function openAlert(n){try{await Notes.markRead(n.id)}catch(e){}refreshUnread();closeAlerts();const dest=n.kind==='message'&&n.conversationId?'#/messages/'+n.conversationId:'#/forum/t/'+encodeURIComponent(n.threadId||'')+(n.replyId?'?reply='+encodeURIComponent(n.replyId):'');if(location.hash===dest)route();else location.hash=dest}
async function toggleAlerts(){const panel=$('#alertpanel');if(!panel)return;if(!panel.hidden){closeAlerts();return}closeMenu(false);panel.hidden=false;$('#bell').setAttribute('aria-expanded','true');await renderAlerts()}
$('#bell').onclick=e=>{e.stopPropagation();toggleAlerts()};
$('#ig').href=INSTAGRAM_URL;$('#tt').href=TIKTOK_URL;
const menuBtn=$('#menubtn'),appMenu=$('#appmenu');
function closeMenu(focusBack){if(!appMenu||appMenu.hidden)return;appMenu.hidden=true;menuBtn.setAttribute('aria-expanded','false');if(focusBack)menuBtn.focus()}
function openMenu(){appMenu.hidden=false;menuBtn.setAttribute('aria-expanded','true');const first=appMenu.querySelector('a');if(first)first.focus()}
menuBtn.onclick=()=>{closeAlerts();if(appMenu.hidden)openMenu();else closeMenu(false)};
const myAdsLink=appMenu.querySelector('a[href="#/garage/ads"]');
if(myAdsLink)myAdsLink.addEventListener('click',()=>{if(location.hash!=='#/garage/ads')return;closeMenu(false);scrollMyAds()});
document.addEventListener('click',e=>{if(!(appMenu.hidden||e.target.closest('#appmenu')||e.target.closest('#menubtn')))closeMenu(false);const panel=$('#alertpanel');if(!panel||panel.hidden||e.target.closest('#alertpanel')||e.target.closest('#bell'))return;closeAlerts()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('#sortsheet')&&!$('#sortsheet').hidden){e.preventDefault();closeSort(true);return}const panel=$('#alertpanel');if(panel&&!panel.hidden){e.preventDefault();closeAlerts();$('#bell').focus();return}if(!appMenu.hidden){e.preventDefault();closeMenu(true)}});
appMenu.addEventListener('keydown',e=>{const items=[...appMenu.querySelectorAll('a')];const i=items.indexOf(document.activeElement);
if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus()}
if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus()}
if(e.key==='Home'){e.preventDefault();items[0].focus()}
if(e.key==='End'){e.preventDefault();items[items.length-1].focus()}});

let F={q:'',make:'',model:'',year:'',yearTo:'',km:''},io,SAVED=false,homeToken=0,feedToken=0,viewToken=0,feedState=null;
const blankSearch=()=>({q:'',make:'',model:'',year:'',yearTo:'',km:''});
const searchOn=()=>Object.values(F).some(v=>String(v||'').trim());
let searchCatalog={makes:[],models:{}};
const searchExtras=new Map();
function rememberSearchName(make, model){
  const name=String(make||'').trim();
  if(!name)return;
  const key=fold(name);
  if(!searchExtras.has(key))searchExtras.set(key,{name,models:new Set()});
  const slot=searchExtras.get(key);
  const known=(searchCatalog.makes||[]).find(m=>fold(m)===key);
  if(known)slot.name=known;
  const modelName=String(model||'').trim();
  if(modelName)slot.models.add(modelName);
}
const byName=(a,b)=>a.localeCompare(b,'en',{sensitivity:'base'});
function modelsFor(make){
  const key=fold(make);
  const canonical=(searchCatalog.makes||[]).find(m=>fold(m)===key)||make;
  const listed=((searchCatalog.models||{})[canonical]||[]).slice();
  const extra=searchExtras.get(key);
  const seen=new Set(listed.map(fold));
  if(extra)extra.models.forEach(model=>{if(!seen.has(fold(model))){seen.add(fold(model));listed.push(model)}});
  return listed.sort(byName);
}
function makesFor(){
  const names=(searchCatalog.makes||[]).slice();
  const seen=new Set(names.map(fold));
  searchExtras.forEach(slot=>{if(!seen.has(fold(slot.name))){seen.add(fold(slot.name));names.push(slot.name)}});
  return names.sort(byName);
}
function fillSearchYears(){
  ['year','yearTo'].forEach(name=>{
    const sel=$(`#qs [name="${name}"]`);
    if(!sel||sel.options.length>1)return;
    const years=[];
    for(let y=2027;y>=1950;y--)years.push(`<option value="${y}">${y}</option>`);
    sel.insertAdjacentHTML('beforeend',years.join(''));
  });
}
function fillSearchModels(make, selected){
  const sel=$('#qs [name=model]');
  if(!sel)return;
  const models=make?modelsFor(make):[];
  const keep=models.find(m=>fold(m)===fold(selected))||'';
  sel.innerHTML=`<option value="">Any</option>${models.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}`;
  sel.value=keep;
  sel.disabled=!make;
}
function paintSearch(state){
  const form=$('#qs');
  if(!form)return;
  const src=state||F;
  fillSearchYears();
  const makes=makesFor();
  const make=makes.find(m=>fold(m)===fold(src.make))||'';
  const makeSel=form.querySelector('[name=make]');
  makeSel.innerHTML=`<option value="">Any</option>${makes.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}`;
  makeSel.value=make;
  fillSearchModels(make, make?src.model:'');
  form.querySelector('[name=q]').value=src.q||'';
  form.querySelector('[name=year]').value=src.year||'';
  form.querySelector('[name=yearTo]').value=src.yearTo||'';
  form.querySelector('[name=km]').value=src.km||'';
  document.querySelectorAll('#sbtn,#feedsearch').forEach(b=>b.classList.toggle('is-on',searchOn()));
}
function readSearch(form){
  const data=Object.fromEntries(new FormData(form));
  let year=data.year||'', yearTo=data.yearTo||'';
  if(year&&yearTo&&+year>+yearTo){const swap=year;year=yearTo;yearTo=swap}
  const make=data.make||'';
  F={q:String(data.q||'').replace(/\s+/g,' ').trim(),make,model:make?(data.model||''):'',year,yearTo,km:data.km||''};
  paintSearch();
}
function searchBits(){
  const bits=[];
  if(F.q)bits.push(F.q);
  if(F.make)bits.push(F.make);
  if(F.model)bits.push(F.model);
  if(F.year&&F.yearTo)bits.push(F.year+'–'+F.yearTo);
  else if(F.year)bits.push(F.year+'+');
  else if(F.yearTo)bits.push('Up to '+F.yearTo);
  if(F.km)bits.push('Under '+Number(F.km).toLocaleString('en-AU')+' km');
  return bits;
}
async function loadSearchCatalog(){
  try{const res=await fetch('data/models.json?v=26');if(res.ok)searchCatalog=await res.json()}catch(e){}
  paintSearch(searchDraft());
  if(!sb)return;
  try{
    const {data}=await sb.from('listings').select('make,model').eq('status','active').limit(1000);
    (data||[]).forEach(row=>rememberSearchName(row.make,row.model));
    paintSearch(searchDraft());
  }catch(e){}
}
function searchDraft(){
  const form=$('#qs');
  if(!form||!form.querySelector('[name=make]').options.length)return F;
  return {q:form.querySelector('[name=q]').value,make:form.querySelector('[name=make]').value,model:form.querySelector('[name=model]').value,year:form.querySelector('[name=year]').value,yearTo:form.querySelector('[name=yearTo]').value,km:form.querySelector('[name=km]').value};
}
const PAGE=8;
const SORTS=[['new','Newest posts','Newest'],['price-asc','Price: low to high','Low–high'],['price-desc','Price: high to low','High–low'],['year-desc','Year: newest to oldest','New–old'],['year-asc','Year: oldest to newest','Old–new']];
const sortOk=id=>SORTS.some(s=>s[0]===id);
let SORT=localStorage.getItem('imdrivn_sort');if(!sortOk(SORT))SORT='new';
const sortMeta=id=>SORTS.find(s=>s[0]===id)||SORTS[0];
function buyHash(){return SORT&&SORT!=='new'?'#/buy?sort='+SORT:'#/buy'}
function hashParts(){const raw=location.hash.startsWith('#')?location.hash.slice(1):'';const q=raw.indexOf('?');const path=q<0?raw:raw.slice(0,q);const params=new URLSearchParams(q<0?'':raw.slice(q+1));const bits=path.split('/');return{p:bits[1]||'',a:bits[2],b:bits[3],params}}
function syncSortUi(){const meta=sortMeta(SORT);const btn=$('#sortbtn');if(btn){const val=btn.querySelector('.tab-tool-value');if(val)val.textContent=meta[2];btn.title=meta[1];btn.setAttribute('aria-label','Sort: '+meta[1])}
document.querySelectorAll('#sortsheet [data-sort]').forEach(b=>b.setAttribute('aria-selected',b.dataset.sort===SORT?'true':'false'))}
function placeSortSheet(){const sheet=$('#sortsheet'),btn=$('#sortbtn');if(!sheet||!btn)return;if(window.innerWidth<900){sheet.style.left='';sheet.style.right='';sheet.style.top='';return}const r=btn.getBoundingClientRect();const width=280;sheet.style.left=Math.min(Math.max(8,r.left),window.innerWidth-width-8)+'px';sheet.style.right='auto';sheet.style.top=(r.bottom+8)+'px'}
function openSort(){const back=$('#sortback'),sheet=$('#sortsheet'),btn=$('#sortbtn');if(!sheet||!btn)return;placeSortSheet();back.hidden=false;sheet.hidden=false;btn.setAttribute('aria-expanded','true');const cur=sheet.querySelector('[aria-selected=true]')||sheet.querySelector('button');if(cur)cur.focus()}
function closeSort(focusBack){const back=$('#sortback'),sheet=$('#sortsheet'),btn=$('#sortbtn');if(!sheet||sheet.hidden)return;back.hidden=true;sheet.hidden=true;btn.setAttribute('aria-expanded','false');if(focusBack)btn.focus()}
function setSort(id){if(!sortOk(id))id='new';SORT=id;localStorage.setItem('imdrivn_sort',SORT);syncSortUi();closeSort(true);const next=buyHash();if(location.hash===next)route();else location.hash=next}
function listingTime(l){if(l.created_at){const t=Date.parse(l.created_at);if(!Number.isNaN(t))return t}if(l.ago!=null&&l.ago!=='')return Date.now()-Number(l.ago)*3600000;return 0}
function sortRows(rows,sort){const list=rows.slice(),tie=(a,b)=>listingTime(b)-listingTime(a)||String(b.id).localeCompare(String(a.id));
list.sort((a,b)=>{if(sort==='price-asc')return(+a.price-+b.price)||tie(a,b);if(sort==='price-desc')return(+b.price-+a.price)||tie(a,b);if(sort==='year-desc')return(+b.year-+a.year)||tie(a,b);if(sort==='year-asc')return(+a.year-+b.year)||tie(a,b);return tie(a,b)});return list}
$('#sortbtn').onclick=()=>{$('#sortsheet').hidden?openSort():closeSort(false)};
addEventListener('resize',()=>{if($('#sortsheet')&&!$('#sortsheet').hidden)placeSortSheet()});
$('#sortback').onclick=()=>closeSort(true);
$('#sortsheet').onclick=e=>{const b=e.target.closest('[data-sort]');if(b)setSort(b.dataset.sort)};
$('#sortsheet').addEventListener('keydown',e=>{const items=[...$('#sortsheet').querySelectorAll('[data-sort]')];const i=items.indexOf(document.activeElement);
if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus()}
if(e.key==='ArrowUp'){e.preventDefault();items[(Math.max(i,0)-1+items.length)%items.length].focus()}
if(e.key==='Home'){e.preventDefault();items[0].focus()}
if(e.key==='End'){e.preventDefault();items[items.length-1].focus()}});
syncSortUi();
$('#qs [name=make]').addEventListener('change',()=>fillSearchModels($('#qs [name=make]').value,''));
$('#qs').onsubmit=e=>{e.preventDefault();readSearch(e.target);setSearchOpen(false);const next=buyHash();location.hash===next?route():location.hash=next};
$('#qs').onreset=()=>{F=blankSearch();setTimeout(()=>{paintSearch();const next=buyHash();location.hash===next?route():location.hash=next})};
loadSearchCatalog();
function askSignIn(message,next){sessionStorage.setItem('imdrivn_next',next);main.innerHTML=`<div class="wrap form auth"><div class="eyebrow">Account</div><h1>Sign in</h1><p class="muted">${esc(message)}</p><a class="btn solid" href="#/join">Sign in</a></div>`}
async function buy(saved){await Auth.ready;if(saved){if(!Auth.user){askSignIn('Sign in to see the cars you saved.','saved');return}}
const token=++feedToken;SAVED=!!saved;const f=searchBits();
main.innerHTML=`${saved?'<h1 class="feed-title">Saved cars</h1>':''}${f.length?`<div class="filt">Search: ${esc(f.join(' · '))} <button onclick="$('#qs').reset()">Clear</button></div>`:''}<div class="feed" id="feed"></div><div class="loader" id="more">Loading more machines…</div>`;
feedState={token,from:0,remoteDone:false,demosAdded:false,busy:false,seen:new Set(),note:''};
await fillFeed();
if(token!==feedToken||!$('#more')||$('#more').hidden)return;
io&&io.disconnect();io=new IntersectionObserver(es=>{if(es[0].isIntersecting)fillFeed()},{rootMargin:'640px'});io.observe($('#more'));}
async function fillFeed(){const state=feedState;if(!state||state.busy||state.token!==feedToken)return;state.busy=true;
try{
  let rows=[];
  if(!state.remoteDone){
    if(SAVED&&!Auth.user)state.remoteDone=true;
    else{
      const page=await ListingStore.page({mode:SAVED?'all':BUY,from:state.from,to:state.from+PAGE-1,saved:SAVED,filters:F,sort:SORT});
      if(state.token!==feedToken)return;
      state.from+=page.length;
      if(page.length<PAGE)state.remoteDone=true;
      rows.push(...page);
    }
  }
  if(state.remoteDone&&!state.demosAdded){if(!SAVED&&state.from===0)rows.push(...sortRows(demosFor(false),SORT));state.demosAdded=true}
  rows=rows.filter(l=>!state.seen.has(l.id));
  rows.forEach(l=>state.seen.add(l.id));
  const feed=$('#feed'),moreEl=$('#more');
  if(!feed||state.token!==feedToken)return;
  if(!state.seen.size){feed.innerHTML=`<p class="muted">${SAVED?'Nothing saved in this mode yet. Tap the bookmark on a car.':'No machines match. Try fewer words.'}</p>`;if(moreEl)moreEl.hidden=true;return}
  if(rows.length)feed.insertAdjacentHTML('beforeend',rows.map(l=>post(l)).join(''));
  if(state.remoteDone&&state.demosAdded&&moreEl){moreEl.hidden=true;io&&io.disconnect()}
}catch(e){if(state.token!==feedToken)return;const feed=$('#feed'),moreEl=$('#more');
if(feed&&!state.seen.size){if(SAVED){feed.innerHTML='<p class="muted">Nothing saved in this mode yet. Tap the bookmark on a car.</p>';if(moreEl)moreEl.hidden=true;return}const demos=sortRows(demosFor(false),SORT);demos.forEach(l=>state.seen.add(l.id));state.remoteDone=true;state.demosAdded=true;feed.innerHTML=demos.map(l=>post(l)).join('')+(demos.length?'':'<p class="muted">Live listings did not load.</p>');if(moreEl)moreEl.hidden=true;return}
if(moreEl)moreEl.textContent='Could not load more. Scroll to try again.'
}finally{state.busy=false}}

async function car(id){const token=++viewToken;await Auth.ready;if(token!==viewToken)return;let l=DEMO.find(x=>x.id===id)||ListingStore.cache.get(id);
if(!l){main.innerHTML='<div class="wrap"><p class="muted">Loading…</p></div>';try{l=await ListingStore.get(id)}catch(e){l=null}}
if(token!==viewToken)return;
if(!l){main.innerHTML='<div class="wrap"><h2>Listing not found</h2><a class="btn" href="#/buy">Back to feed</a></div>';return}
const title=l.heading||(l.year+' '+l.make+' '+l.model);
main.innerHTML=`<div class="wrap s-${l.sec}" data-mode="${laneOf(l)}"><a href="#/buy" class="eyebrow">← Back to feed</a><div class="detail" style="margin-top:var(--s-4)"><div>
<div class="gal"><div class="shot shot-main"><img class="main" id="big" src="${esc(l.photos[0])}" alt="${esc(title)} main photo" onerror="${FALLBACK}">${photoMark()}</div><div class="thumbs">${l.photos.map((p,i)=>`<button class="shot" aria-label="Show photo ${i+1}" aria-current="${i===0}" data-src="${esc(p)}"><img src="${esc(p)}" alt="" onerror="${FALLBACK}">${photoMark()}</button>`).join('')}</div></div>
${l.status==='sold'?'<div class="sold-banner" role="status">SOLD</div>':''}<div class="eyebrow" style="margin-top:var(--s-5);color:var(--sec)">${SECTIONS[l.sec]} ${l.demo?'· Demo data':''}</div><h1 style="font-size:clamp(1.2rem,3vw,2rem)">${esc(title)}</h1><div class="price">${aud(l.price)}</div>${boostBadges(l)?`<div class="power">${boostBadges(l)}</div>`:''}<div class="seller-line">${atHandle(l.handle, true)}</div>
${specGrid(l)}
<h2 style="font-size:1rem">Description</h2><p class="muted">${esc(l.desc)}</p>${l.status==='sold'?'':inspectionCta(l)}</div>
<div class="panel" id="contact"><h2 style="font-size:1rem">${l.user_id&&Auth.user&&l.user_id===Auth.user.id?'Your ad':'Message seller'}</h2>${sellerPanel(l)}</div></div></div>`;
main.querySelectorAll('.thumbs button').forEach(b=>b.onclick=()=>{$('#big').src=b.dataset.src;main.querySelectorAll('.thumbs button').forEach(x=>x.setAttribute('aria-current',x===b))});
const msgBtn=$('#msg-seller');if(msgBtn)msgBtn.onclick=()=>messageSeller(l.id);
bindOffer('book-inspect',INSPECTION_URL);bindOffer('need-finance',FINANCE_URL);bindReport(l);bindVinOrder(l);const regoBtn=$('#rego-ask');if(regoBtn)regoBtn.onclick=()=>requestVin(l);const vinAsk=$('#vin-ask');if(vinAsk)vinAsk.onclick=()=>requestVin(l);}
function bindOffer(id,url){const el=$('#'+id);if(el)el.onclick=e=>{if((url||'#')==='#'){e.preventDefault();toast('Coming soon')}}}
function offerLink(id,url,label){const href=url||'#';const ext=href!=='#'&&!href.startsWith('#');return `<a class="btn" id="${id}" href="${esc(href)}"${ext?' target="_blank" rel="noopener"':''}>${label}</a>`}
function reportDialog(){return `<dialog class="report-dialog" id="report-dialog"><form id="report-form"><h2>Report this ad</h2><label>Reason<select name="reason" required><option value="">Choose a reason</option>${Reports.reasons.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('')}</select></label><label>Details <span class="grey">(optional)</span><textarea name="details" maxlength="2000" placeholder="What looks off?"></textarea></label><p class="err" id="report-err" role="alert"></p><div class="auth-row"><button class="btn" type="button" id="report-cancel">Cancel</button><button class="btn solid" type="submit">Send report</button></div></form></dialog>`}
function vinOrderForm(formId, known){const email=(typeof Auth!=='undefined'&&Auth.user&&Auth.user.email)||'';const errId=formId+'-err';return `<form class="vin-order" id="${formId}"><label>VIN<input name="vin" maxlength="17" required autocomplete="off" spellcheck="false" autocapitalize="characters" value="${esc(known||'')}" aria-describedby="${errId}"></label><label>Email<input name="email" type="email" required autocomplete="email" value="${esc(email)}"></label><button class="btn" type="submit">Get PPSR report – $10</button><p class="vin-note">Official PPSR search: stolen, written-off & finance owing. Report emailed to you.</p><p class="err" id="${errId}" role="alert"></p></form>`}
function inspectionCta(l){const known=String((l&&l.vin)||'').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,'').slice(0,17);const ask=regoVinOf(l||{}).request?'<button type="button" class="btn" id="vin-ask">Ask the seller for the VIN</button>':'';const warn='<svg class="report-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.6 20.2h18.8L12 3.2z"/><path d="M12 9.2v5.2"/><path d="M12 17.2h.01"/></svg>';return `<div class="offer-stack"><aside class="inspect"><p>Check for stolen history, written-off history and encumbrances (finance owing). Best money spent to make sure you're not buying a lemon.</p>${vinOrderForm('vin-order',known)}${ask}</aside><div class="offer-row"><aside class="inspect"><p>Whether it's down the road or interstate, we can help.</p>${offerLink('book-inspect',INSPECTION_URL,'Book a pre-purchase inspection')}</aside><aside class="inspect"><p>Need help with the purchase? We got you.</p>${offerLink('need-finance',FINANCE_URL,'Need finance?')}</aside></div></div><button type="button" class="report-link" id="report-ad">${warn}Report this ad</button>${reportDialog()}`}
function bindVinOrder(listing, formId){const form=document.getElementById(formId||'vin-order');if(!form)return;const vinEl=form.querySelector('[name=vin]');const err=form.querySelector('.err');const clean=v=>String(v||'').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,'').slice(0,17);vinEl.addEventListener('input',()=>{const next=clean(vinEl.value);if(vinEl.value!==next)vinEl.value=next});form.onsubmit=async e=>{e.preventDefault();err.textContent='';const vin=clean(vinEl.value);vinEl.value=vin;const email=form.querySelector('[name=email]').value.trim();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)){err.textContent='VIN must be 17 characters and cannot include I, O, or Q.';return}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='Add a valid email so we can send the report.';return}const btn=form.querySelector('[type=submit]');btn.disabled=true;try{await VinOrders.create({vin,email,listingId:listing&&listing.id});const dialog=form.closest('dialog');if(dialog&&dialog.open)dialog.close();toast('Thanks – your report will be emailed to you shortly');if(PAYMENT_URL&&PAYMENT_URL!=='#')location.assign(PAYMENT_URL)}catch(ex){err.textContent=ex.message||'Could not start that order.';btn.disabled=false}}}
function bindReport(listing){const btn=$('#report-ad');const dialog=$('#report-dialog');const form=$('#report-form');if(!btn||!dialog||!form)return;const close=()=>{if(dialog.open)dialog.close();const err=$('#report-err');if(err)err.textContent=''};btn.onclick=async()=>{await Auth.ready;if(!Auth.user||Auth.needsHandle()){sessionStorage.setItem('imdrivn_next','car/'+listing.id);if(location.hash!=='#/join')location.hash='#/join';else join();return}if(listing.demo||!/^[0-9a-f-]{36}$/i.test(String(listing.id||''))){toast('Sample ads cannot be reported.','error');return}if(listing.user_id&&listing.user_id===Auth.user.id){toast('You cannot report your own ad.','error');return}close();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')};$('#report-cancel').onclick=close;dialog.addEventListener('click',e=>{if(e.target===dialog)close()});form.onsubmit=async e=>{e.preventDefault();const err=$('#report-err');err.textContent='';const data=Object.fromEntries(new FormData(form));const submit=form.querySelector('[type=submit]');submit.disabled=true;try{await Reports.submit(listing.id,data.reason,data.details);close();form.reset();toast('Thanks. We will take a look.')}catch(ex){err.textContent=ex.message||'Could not send that report.'}finally{submit.disabled=false}}}

function buyChooser(){main.innerHTML=`<section class="lanes"><div class="lanes-copy"><div class="lanes-head"><h1>Pick your<br><span class="grey">lane.</span></h1></div><div class="chooser-paths">
<div class="lane-col lane-daily"><a class="path pick-daily" href="#/buy" data-pick="daily">${ico('cart')}<span class="wide">Daily</span><span class="tag">Every day machines.</span><span class="btn">Browse daily →</span></a></div>
<div class="lane-col lane-performance"><a class="path pick-performance" href="#/buy" data-pick="performance">${ico('gauge')}<span class="wide">Performance</span><span class="tag">Hot metal, real pace.</span><span class="btn">Browse performance →</span></a></div>
<div class="lane-col lane-supercar"><a class="path pick-supercar" href="#/buy" data-pick="supercar">${ico('trophy')}<span class="wide">Supercar</span><span class="tag">The top shelf.</span><span class="btn">Browse supercars →</span></a></div>
</div><p class="view-all-row"><a class="view-all" href="#/buy" data-pick="all">View all</a></p></div></section>`;
main.querySelectorAll('.lane-col').forEach(col=>{const on=()=>col.classList.add('is-lit');const off=()=>col.classList.remove('is-lit');col.addEventListener('pointerdown',on);col.addEventListener('pointerup',off);col.addEventListener('pointercancel',off);col.addEventListener('pointerleave',off);});}
function sell(){main.innerHTML=`<section class="sell-lanes"><div class="sell-copy"><div class="sell-intro"><h1 style="font-size:clamp(1.4rem,4vw,2.4rem)">How do you<br><span class="grey">want to sell?</span></h1></div><div class="sell-cols">
<div class="sell-col sell-list"><a class="path" href="#/list">${ico('tag')}<span class="wide" style="font-size:1.6rem">List free</span><span class="tag">100% free. No catch.</span><span class="muted">Post your ad to the feed and deal direct with buyers.</span><span class="btn">List your car free →</span></a></div>
<div class="sell-col sell-whole"><a class="path" href="#/valuation">${ico('note')}<span class="wide" style="font-size:1.6rem">Wholesale</span><span class="tag">Sell fast to dealers.</span><span class="muted">Answer a few questions and verified dealers make you an offer.</span><span class="btn">Get a valuation →</span></a></div>
</div></div></section>`;
main.querySelectorAll('.sell-col').forEach(col=>{const on=()=>col.classList.add('is-lit');const off=()=>col.classList.remove('is-lit');col.addEventListener('pointerdown',on);col.addEventListener('pointerup',off);col.addEventListener('pointercancel',off);col.addEventListener('pointerleave',off);});}

const vehicle=()=>`<div class="grid2"><label class="full">Rego or VIN (optional)<input name="rego"></label><label>Make<input name="make" required></label><label>Model<input name="model" required></label>
<label>Year<input name="year" type="number" min="1950" max="2027" required></label><label>Kilometres<input name="km" type="number" min="0" required></label>
<label>Body<select name="body">${['Coupe','Sedan','Hatch','SUV','Ute','Wagon','Convertible'].map(o=>`<option>${o}</option>`).join('')}</select></label><label>Transmission<select name="trans"><option>Auto</option><option>Manual</option></select></label></div>`;
const photos=()=>`<label>Photos (up to 8)<input type="file" name="photos" accept="image/*" multiple id="ph"></label><div class="previews" id="pv"></div>`;
const contact=(loc=true)=>`<div class="grid2"><label>Name<input name="name" required autocomplete="name"></label><label>Phone<input name="phone" type="tel" required autocomplete="tel"></label><label class="full">Email<input name="email" type="email" required autocomplete="email"></label>
${loc?`<label>Suburb<input name="suburb" required></label><label>State<select name="state">${['QLD','NSW','VIC','WA','SA','TAS','ACT','NT'].map(s=>`<option>${s}</option>`).join('')}</select></label>`:''}</div>`;

function wizard(title,steps,onDone){let i=0,imgs=[];main.innerHTML=`<div class="wrap form"><div class="eyebrow">IM SELLIN</div><h1 style="font-size:clamp(1.2rem,3.5vw,2rem)">${title}</h1><div class="progress">${steps.map(()=>'<i></i>').join('')}</div>
<form id="wz" novalidate>${steps.map((s,k)=>`<fieldset data-k="${k}" style="border:0;padding:0;margin:0" ${k?'hidden':''}><legend class="wide" style="font-size:.9rem;margin-bottom:var(--s-4)">${k+1}. ${s[0]}</legend>${s[1]}</fieldset>`).join('')}
<p class="err" id="er" role="alert"></p><div class="actions"><button type="button" class="btn" id="bk">Back</button><button class="btn solid" id="nx">Next</button></div></form></div>`;
const f=$('#wz'),sets=[...f.querySelectorAll('fieldset')],show=()=>{sets.forEach((s,k)=>s.hidden=k!==i);main.querySelectorAll('.progress i').forEach((p,k)=>p.classList.toggle('on',k<=i));$('#bk').style.visibility=i?'visible':'hidden';$('#nx').textContent=i==sets.length-1?'Submit':'Next';};show();
const ph=$('#ph');if(ph)ph.onchange=async()=>{imgs=await Promise.all([...ph.files].slice(0,8).map(fl=>new Promise(r=>{const im=new Image(),u=URL.createObjectURL(fl);im.onload=()=>{const c=document.createElement('canvas'),w=Math.min(900,im.width);c.width=w;c.height=im.height*w/im.width;c.getContext('2d').drawImage(im,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',.7))};im.src=u})));$('#pv').innerHTML=imgs.map(s=>`<img src="${s}" alt="Upload preview">`).join('')};
$('#bk').onclick=()=>{i--;show()};
f.onsubmit=e=>{e.preventDefault();const bad=[...sets[i].querySelectorAll('[required]')].find(x=>!x.checkValidity());if(bad){$('#er').textContent='Please fill in '+bad.closest('label').firstChild.textContent.trim()+'.';bad.focus();return}$('#er').textContent='';
if(i<sets.length-1){i++;show();scrollTo(0,0);return}onDone(Object.fromEntries(new FormData(f)),imgs);};}

async function gate(next){await Auth.ready;if(!Auth.user||Auth.needsHandle()){sessionStorage.setItem('imdrivn_next',next);if(location.hash!=='#/join')location.hash='#/join';else join();return false}return true}
function posted(l){const title=l.heading||[l.year,l.make,l.model].filter(Boolean).join(' ');
main.innerHTML=`<div class="wrap form posted"><div class="eyebrow">IM SELLIN</div><h1 style="font-size:clamp(1.3rem,4vw,2rem)">You're in</h1><p class="muted">${esc(title)} is submitted.</p>
<aside class="verify-card" role="note"><p>Heads up: a member of the IM DRIVN team may contact you to verify you're a real person and not sitting in a call centre somewhere. That's how we keep our marketplace safer. Your ad will be live shortly.</p></aside>
<div class="posted-actions"><a class="btn solid" href="#/car/${esc(l.id)}">See your ad</a><a class="btn" href="#/buy">Back to the feed</a></div></div>`;
main.focus({preventScroll:true})}
async function list(){if(!await gate('list'))return;ListFlow.start(main,{async publish(d){
  const saved=await ListingStore.create({sec:d.sec,make:d.make.trim(),model:d.model.trim(),year:+d.year,km:+d.km,price:+d.price,suburb:d.suburb.trim(),state:d.state,postcode:d.postcode,heading:d.heading.trim(),desc:d.desc.trim(),engine:(d.engine||'').trim(),cylinders:d.cylinders,transmission:d.transmission,induction:d.induction,rego:d.rego,vin:d.vin,photos:d.photos.slice(),name:d.name.trim(),phone:d.phone.trim(),email:d.email.trim()});
  setMode(saved.mode||(saved.sec==='supercars'?'supercar':saved.sec));
  posted(saved);
}});}

function valuation(){ValueFlow.start(main);}

function howMarkup(){const sellTips=['Confirm the cash is actually in your account. Screenshots and "payment sent" emails are not money.','No overpayments, and no "just refund me the extra". That script is old.','Skip cash in the mail, gift cards, and crypto.','Meet in public, in the daytime, somewhere well lit. Bring a mate.','See their licence before a test drive, and ride along.','Have the rego papers, service history, and ownership docs ready.','Be straight in the ad and the photos. No fairy tales.','Once it\'s sold, lodge the notice of disposal or transfer with your state transport authority.','Cancel or transfer the rego and insurance after the sale.','Never share bank logins, passwords, or codes. Not for "verification". Not ever.','Trust your gut. Sketchy message? Report it.'];
const buyTips=[`Get a pre-purchase inspection. ${offerLink('how-inspect',INSPECTION_URL,'Book a pre-purchase inspection')}`,`Run a PPSR check for finance owing, write-offs, and stolen status. <button type="button" class="btn" id="how-vin">VIN CHECK</button>`,'Look at the car in person before you pay. Photos can lie.'];
return `<section class="wrap feats"><div class="eyebrow">How it works</div><h1 style="font-size:clamp(1.3rem,4vw,2.2rem)">Simple. <span class="grey">Free.</span> Fast.</h1><div class="row4">
${[['tag','1. Snap & list','Photos, price, done. Listing is 100% free.'],['gauge','2. Hit the feed','Your ad lands in a scroll-first feed buyers love.'],['head','3. Chat direct','Buyers message you. No middleman.'],['up','4. Or go wholesale','Want it gone? Dealers make an offer.']].map(f=>`<div class="feat">${ico(f[0])}<h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div><a class="btn solid" href="#/sell" style="margin-top:var(--s-5)">Sell your car →</a></section>
<section class="wrap smart"><div class="eyebrow">Selling smart</div><h2>Don't get played.</h2>
<aside class="golden-rule" role="note"><p class="golden-kicker">Golden rule</p><p>The car doesn't go anywhere unless the money is in the bank.</p></aside>
<h3>If you're selling</h3><ul class="smart-list">${sellTips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
<h3>If you're buying</h3><ul class="smart-list buyer">${buyTips.map(t=>`<li>${t}</li>`).join('')}</ul><dialog class="report-dialog" id="how-vin-dialog">${vinOrderForm('how-vin-order','')}</dialog></section>`}
function bindHow(){bindOffer('how-inspect',INSPECTION_URL);const howVin=$('#how-vin'),howDlg=$('#how-vin-dialog');if(howVin&&howDlg){howVin.onclick=()=>{if(howDlg.showModal)howDlg.showModal();else howDlg.setAttribute('open','')};howDlg.addEventListener('click',e=>{if(e.target===howDlg&&howDlg.close)howDlg.close()});bindVinOrder(null,'how-vin-order')}}
function aboutTabs(us){return `<div class="about-switch"><div class="about-tabs" role="tablist" aria-label="About DRIVN"><a role="tab" href="#/about" id="about-tab-works" aria-selected="${us?'false':'true'}" aria-controls="about-panel">HOW IT WORKS</a><a role="tab" href="#/about/us" id="about-tab-us" aria-selected="${us?'true':'false'}" aria-controls="about-panel">ABOUT US</a></div></div>`}
function founder(){return `<section class="founder"><figure class="founder-photo"><img src="assets/about/joey-lambo.jpg" alt="Joey Lambo beside a black car" width="2400" height="3600"><figcaption>Joey Lambo</figcaption></figure><div class="founder-copy"><div class="eyebrow">Founder</div><h2>Joey Lambo</h2><p>Joey Lambo has spent almost 20 years in the car industry. Over that time he's watched most selling platforms drift away from what makes cars special. They're cluttered with spam and scams, expensive to list on, and still hard to actually get a car sold.</p><p>Finding a car shouldn't be complicated, and selling one shouldn't cost a fortune. That's why he started IM DRIVN: a simple marketplace for enthusiasts, the community, and anyone who loves cars — whether you're new to the scene, about to get your licence, or you've been around cars for years. Everyone's welcome here.</p></div></section>`}
function aboutPage(){const us=hashParts().a==='us';main.innerHTML=`${aboutTabs(us)}<div id="about-panel" role="tabpanel" aria-labelledby="${us?'about-tab-us':'about-tab-works'}">${us?about()+founder():howMarkup()}</div>`;if(!us)bindHow()}
function authLead(){const next=sessionStorage.getItem('imdrivn_next')||'';if(next==='list')return 'Sign in to post your car. It only takes a minute.';if(next==='valuation')return 'Sign in so dealers know who the offer is for.';if(next==='join/ads')return 'Sign in to see your ads.';if(next.startsWith('msg:'))return 'Sign in to message the seller.';if(next.startsWith('car/'))return 'Sign in to report this ad.';if(next.startsWith('vin:'))return 'Sign in to ask for the rego or VIN.';return 'Buy, sell, and keep your saves in one account.'}
function showAuthErr(msg){const el=$('#auth-err');if(el)el.textContent=msg||''}
function takeNext(){const next=sessionStorage.getItem('imdrivn_next');if(!next)return false;sessionStorage.removeItem('imdrivn_next');if(next.startsWith('msg:')){messageSeller(next.slice(4));return true}if(next.startsWith('vin:')){requestVin(next.slice(4));return true}const dest='#/'+next;if(location.hash===dest){route();return true}location.hash=dest;return true}
function afterAuth(){const next=sessionStorage.getItem('imdrivn_next')||'';if(Auth.needsHandle()&&next!=='valuation'){join();return}if(takeNext())return;join()}
function authScreen(mode){mode=mode||'in';const title=mode==='up'?'Join IM DRIVN':mode==='forgot'?'Reset password':'Sign in';
main.innerHTML=`<div class="wrap form auth"><div class="eyebrow">Account</div><h1>${title}</h1><p class="muted">${mode==='forgot'?'We will email you a link to set a new password.':esc(authLead())}</p>
<form class="panel" id="auth-form">${mode==='forgot'?'':''}<label>Email<input name="email" type="email" required autocomplete="email" inputmode="email"></label>
${mode==='forgot'?'':`<label>Password<input name="password" type="password" required minlength="6" autocomplete="${mode==='up'?'new-password':'current-password'}"></label>`}
<p class="err" id="auth-err" role="alert"></p>
<div class="auth-row"><button class="btn solid" type="submit">${mode==='up'?'Create account':mode==='forgot'?'Send link':'Sign in'}</button>
${mode==='in'?'<button class="auth-link" type="button" id="forgot">Forgot password</button>':''}</div></form>
${mode==='forgot'?'':`<div class="auth-or">or</div><div class="auth-oauth"><button class="btn" type="button" id="google">Continue with Google</button><button class="btn" type="button" id="apple">Continue with Apple</button></div>`}
<p class="muted">${mode==='up'?'Already driving with us?':'New here?'} <button class="auth-link" type="button" id="swap">${mode==='up'?'Sign in':'Create an account'}</button>${mode!=='in'?' · <button class="auth-link" type="button" id="back-in">Back</button>':''}</p></div>`;
$('#swap').onclick=()=>authScreen(mode==='up'?'in':'up');
const back=$('#back-in');if(back)back.onclick=()=>authScreen('in');
const forgot=$('#forgot');if(forgot)forgot.onclick=()=>authScreen('forgot');
const google=$('#google');if(google)google.onclick=()=>oauth('google');
const apple=$('#apple');if(apple)apple.onclick=()=>oauth('apple');
$('#auth-form').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const btn=e.target.querySelector('[type=submit]');btn.disabled=true;showAuthErr('');
try{if(mode==='forgot'){await Auth.forgot(data.email);showAuthErr('');e.target.insertAdjacentHTML('beforeend','<p class="muted" role="status">Check your email for the reset link.</p>')}
else if(mode==='up'){if((data.password||'').length<6)throw new Error('Password needs at least 6 characters.');const res=await Auth.signUp(data.email,data.password);if(!res.confirmed){showAuthErr('');e.target.insertAdjacentHTML('beforeend','<p class="muted" role="status">Check your email to confirm your account, then sign in.</p>')}else afterAuth()}
else{await Auth.signIn(data.email,data.password);afterAuth()}}catch(err){showAuthErr(err.message||'Could not do that.')}finally{if(btn.isConnected)btn.disabled=false}};}
async function oauth(provider){showAuthErr('');try{await Auth.oauth(provider)}catch(err){showAuthErr(err.message||'Could not start that sign-in.')}}
function recoveryScreen(){main.innerHTML=`<div class="wrap form auth"><div class="eyebrow">Account</div><h1>Set a new password</h1><form class="panel" id="auth-form"><label>New password<input name="password" type="password" required minlength="6" autocomplete="new-password"></label><label>Confirm<input name="confirm" type="password" required minlength="6" autocomplete="new-password"></label><p class="err" id="auth-err" role="alert"></p><button class="btn solid" type="submit">Update password</button></form></div>`;
$('#auth-form').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(data.password!==data.confirm){showAuthErr('Those passwords do not match.');return}if(data.password.length<6){showAuthErr('Password needs at least 6 characters.');return}
const btn=e.target.querySelector('[type=submit]');btn.disabled=true;try{await Auth.updatePassword(data.password);afterAuth()}catch(err){showAuthErr(err.message||'Could not update that.');btn.disabled=false}};}
function handleScreen(){let seq=0,timer=0,ready='';
main.innerHTML=`<div class="wrap form auth"><div class="eyebrow">Almost there</div><h1>Choose your @handle</h1><p class="handle-warn">Choose carefully: your handle is permanent and can't be changed once it's set.</p><form class="panel" id="auth-form"><label>Handle<input class="handle-input" id="handle-input" name="handle" required minlength="3" maxlength="20" autocapitalize="none" spellcheck="false" autocomplete="off" placeholder="your.handle" aria-describedby="handle-status"></label><p class="handle-status" id="handle-status" role="status"></p><p class="err" id="auth-err" role="alert"></p><div id="handle-confirm" hidden></div><button class="btn solid" type="submit" id="lock-go" disabled>Lock it in</button></form></div>`;
const input=$('#handle-input'),status=$('#handle-status'),btn=$('#lock-go'),confirm=$('#handle-confirm');
const paint=(text,kind)=>{status.className='handle-status'+(kind?' is-'+kind:'');status.textContent=text||''};
const schedule=value=>{clearTimeout(timer);ready='';btn.disabled=true;confirm.hidden=true;
if(!value){seq++;paint('');return}
if(!Auth.handleOk(value)){seq++;paint('Use 3–20 characters: letters, numbers, dots, and underscores.','bad');return}
paint('Checking…');const ticket=++seq;
timer=setTimeout(async()=>{try{const free=await Auth.handleFree(value);if(ticket!==seq)return;ready=free?value:'';paint(free?'Available':"That handle's taken, try another",free?'ok':'bad');btn.disabled=!free}catch(e){if(ticket!==seq)return;paint('Could not check just now. You can still try to lock it in.');btn.disabled=false;ready=value}},300)};
input.addEventListener('input',()=>{const next=Auth.cleanHandle(input.value);if(input.value!==next){input.value=next;input.setSelectionRange(next.length,next.length)}showAuthErr('');schedule(next)});
$('#auth-form').onsubmit=async e=>{e.preventDefault();if(!confirm.hidden)return;const name=Auth.cleanHandle(input.value);if(!Auth.handleOk(name)||ready!==name){showAuthErr('Pick an available handle first.');return}
confirm.hidden=false;btn.hidden=true;input.readOnly=true;
confirm.innerHTML=`<p class="handle-forever">@${esc(name)} is yours forever. Lock it in?</p><div class="auth-row"><button class="btn solid" type="button" id="lock-yes">Lock it in</button><button class="btn" type="button" id="lock-back">Back</button></div>`;
$('#lock-back').onclick=()=>{confirm.hidden=true;confirm.innerHTML='';btn.hidden=false;input.readOnly=false;input.focus()};
$('#lock-yes').onclick=async()=>{const yes=$('#lock-yes');yes.disabled=true;showAuthErr('');try{await Auth.setHandle(name);afterAuth()}catch(err){showAuthErr(err.message||'Could not save that.');yes.disabled=false;if(/taken/i.test(err.message||'')){ready='';paint("That handle's taken, try another",'bad');confirm.hidden=true;btn.hidden=false;btn.disabled=true;input.readOnly=false}}}};}
function focusMyAds(){if(hashParts().p!=='join'||hashParts().a!=='ads')return;const el=document.getElementById('my-ads');if(el)el.scrollIntoView()}
function garageTitle(name){const who=String(name||'').replace(/^@/,'').trim();return (who?who.toUpperCase():'YOUR')+"'S GARAGE"}
function activeAds(rows){return (rows||[]).filter(l=>!l.status||l.status==='active')}
function profileView({handle, mine, cars, ads, signOut}){const who=String(handle||'').trim();const active=activeAds(ads);const parked=(cars||[]).length?`<div class="garage-grid" id="gcars">${cars.map(c=>garageCard(c,!!mine)).join('')}</div>`:'<p class="muted">Nothing parked here yet.</p>';return `<div class="wrap profile-page"><h1 class="gwho">@${esc(who||'you')}</h1>${signOut?'<div class="auth-row"><button class="btn" type="button" id="sign-out">Sign out</button></div>':''}<h2 class="profile-garage">${esc(garageTitle(who))}</h2>${mine?'<p><button type="button" class="btn solid" id="add-car">Add a car</button></p>':''}${parked}<h2 id="my-ads" class="profile-listings">Current listings on IM DRIVN</h2><div id="mine">${active.length?laneGroups(active,!!mine):'<p class="muted">'+(mine?'You have not listed a car yet. <a href="#/list">List one free</a>.':'No active ads.')+'</p>'}</div></div>`}
async function profileScreen(){const token=++viewToken;const handle=Auth.profile&&String(Auth.profile.username||'').trim();main.innerHTML='<div class="wrap"><p class="muted">Loading…</p></div>';let cars=[];let rows=[];try{cars=await Garage.cars(Auth.user.id)}catch(e){cars=[]}try{rows=await ListingStore.mine()}catch(e){rows=[]}
if(token!==viewToken)return;
main.innerHTML=profileView({handle,mine:true,cars,ads:rows,signOut:true});
$('#sign-out').onclick=async()=>{await Auth.signOut();updateNav();authScreen('in')};
const add=$('#add-car');if(add)add.onclick=()=>garageAdd();
bindGarageDelete($('#gcars'),()=>profileScreen());
focusMyAds()}
async function join(){const token=++viewToken;const wantAds=hashParts().a==='ads';main.innerHTML='<div class="wrap form"><p class="muted">Loading…</p></div>';try{await Auth.ready}catch(e){}
if(token!==viewToken)return;if(!sb){main.innerHTML='<div class="wrap form auth"><h1>Sign in</h1><p class="err">Accounts are offline right now. The demo feed still works.</p><a class="btn" href="#/buy">Browse cars</a></div>';return}
if(Auth.recovery)return recoveryScreen();if(!Auth.user){if(wantAds)sessionStorage.setItem('imdrivn_next','join/ads');return authScreen('in')}if(Auth.needsHandle()){if(wantAds)sessionStorage.setItem('imdrivn_next','join/ads');return handleScreen()}return profileScreen()}

function sellerPanel(l){if(l.status==='sold')return '<p class="muted">This car has been sold. The ad is off the feed.</p>';if(l.demo||!l.user_id)return '<p class="muted">Sample car. There is no seller to message.</p>';if(Auth.user&&l.user_id===Auth.user.id)return '<p class="muted">Buyers message you from this car. Replies land in Messages.</p><a class="btn" href="#/messages">Open messages</a>';return '<p class="muted">Chat in the app. Your number stays off the ad.</p><button class="btn solid" type="button" id="msg-seller">Message seller</button>'}
async function markSold(btn){if(!confirm("Mark this car as sold? This can't be undone."))return;btn.disabled=true;try{await ListingStore.markSold(btn.dataset.id);const card=btn.closest('.post');const acts=btn.closest('.owner-acts');if(acts)acts.remove();else btn.remove();if(card){const photo=card.querySelector('.car');card.classList.add('is-sold');const neu=photo&&photo.querySelector('.new');if(neu)neu.remove();if(photo&&!photo.querySelector('.sold-badge'))photo.insertAdjacentHTML('beforeend','<span class="sold-badge">SOLD</span>')}}catch(err){btn.disabled=false;toast(err.message||'Could not mark that sold.','error')}}
function listingDraft(l, contact){const sec=l.sec||(l.mode==='supercar'?'supercars':(l.mode||''));const prefix=[l.year,l.make,l.model].map(v=>String(v||'').trim()).filter(Boolean).join(' ');const heading=String(l.heading||'').trim();let tagline='';if(prefix&&heading.toLowerCase().startsWith(prefix.toLowerCase()))tagline=heading.slice(prefix.length).trim();else if(heading&&heading.toLowerCase()!==prefix.toLowerCase())tagline=heading;tagline=tagline.slice(0,60);const blank='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';const photos=(l.photos||[]).filter(p=>p&&p!==blank);const cyl=l.cylinders==null||l.cylinders===''?'':String(l.cylinders);const cylinders=/^\d+$/.test(cyl)?String(+cyl):'';const transmission=transmissionOf(l);const induction=inductionOf(l);return{sec,make:l.make||'',model:l.model||'',year:l.year==null?'':String(l.year),km:(l.km??l.kms)==null?'':String(l.km??l.kms),price:l.price==null?'':String(l.price),suburb:l.suburb||'',state:l.state||'',postcode:l.postcode?String(l.postcode):'',tagline,heading:heading||prefix,desc:String(l.desc||l.description||''),engine:l.engine||'',cylinders,transmission,induction,rego:String(l.rego||'').trim().toUpperCase(),vin:String(l.vin||'').trim().toUpperCase(),photos,name:(Auth.profile&&String(Auth.profile.display_name||'').trim())||'',phone:(contact&&contact.mobile)||'',email:(contact&&contact.email)||((Auth.user&&Auth.user.email)||'')}}
async function editListing(id){await Auth.ready;if(!Auth.user||Auth.needsHandle()){sessionStorage.setItem('imdrivn_next','garage/ads');if(location.hash!=='#/join')location.hash='#/join';else join();return}let listing=null;try{listing=await ListingStore.get(id,true)}catch(e){listing=null}if(!listing||listing.demo||listing.user_id!==Auth.user.id){toast('You can only edit your own ad.','error');return}if(listing.status&&listing.status!=='active'){toast('Only live ads can be edited.','error');return}let contact=null;try{contact=await ListingStore.contact(id)}catch(e){contact=null}const draft=listingDraft(listing,contact);scrollTo(0,0);ListFlow.start(main,{draft,editing:true,submitLabel:'Update now',async publish(d){await ListingStore.update(id,{sec:d.sec,make:d.make.trim(),model:d.model.trim(),year:+d.year,km:+d.km,price:+d.price,suburb:d.suburb.trim(),state:d.state,postcode:d.postcode,heading:d.heading.trim(),desc:d.desc.trim(),engine:(d.engine||'').trim(),cylinders:d.cylinders,transmission:d.transmission,induction:d.induction,rego:d.rego,vin:d.vin,photos:d.photos.slice(),name:d.name.trim(),phone:d.phone.trim(),email:d.email.trim()});toast('Ad updated.');const dest='#/garage/ads';if(location.hash===dest)route();else location.hash=dest}})}
async function messageSeller(listingId){await Auth.ready;if(!Auth.user){sessionStorage.setItem('imdrivn_next','msg:'+listingId);location.hash='#/join';return}if(Auth.needsHandle()){sessionStorage.setItem('imdrivn_next','msg:'+listingId);if(location.hash!=='#/join')location.hash='#/join';else join();return}let listing=ListingStore.cache.get(listingId);if(!listing){try{listing=await ListingStore.get(listingId)}catch(e){listing=null}}if(!listing||listing.demo||!listing.user_id){toast('That car has no seller to message.','error');return}if(listing.user_id===Auth.user.id)return;try{const conv=await Chat.open(listing);const dest='#/messages/'+conv.id;if(location.hash===dest)route();else location.hash=dest}catch(e){toast(e.message||'Could not open that chat.','error')}}
function paintBadge(el,n){if(!el)return;if(!n){el.hidden=true;el.textContent='';return}el.hidden=false;el.textContent=n>9?'9+':String(n)}
function setMsgBadge(n){document.querySelectorAll('[data-msg-badge]').forEach(el=>paintBadge(el,n))}
function setBellBadge(n){paintBadge(document.querySelector('[data-bell-badge]'),n);const bell=$('#bell');if(bell)bell.setAttribute('aria-label',n?('Notifications, '+n+' unread'):'Notifications')}
async function refreshUnread(){if(!sb||!Auth.user){setMsgBadge(0);setBellBadge(0);return}let messages=0,notes=0;try{messages=await Chat.unreadCount()}catch(e){}try{notes=await Notes.unreadCount()}catch(e){}setMsgBadge(messages);setBellBadge(notes)}
let chatChannel=null,inboxChannel=null,liveChat=null;
function dropChat(){liveChat=null;if(chatChannel&&sb){sb.removeChannel(chatChannel);chatChannel=null}}
function watchInbox(){if(!sb)return;if(inboxChannel){sb.removeChannel(inboxChannel);inboxChannel=null}if(!Auth.user){setMsgBadge(0);setBellBadge(0);return}refreshUnread();const ping=()=>{refreshUnread();const here=hashParts();if((here.p==='messages'||here.p==='msgs')&&!here.a)inbox();const panel=$('#alertpanel');if(panel&&!panel.hidden)renderAlerts()};inboxChannel=sb.channel('inbox:'+Auth.user.id).on('postgres_changes',{event:'*',schema:'public',table:'conversations'},ping).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>refreshUnread()).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+Auth.user.id},ping).subscribe()}
function joinedLabel(iso){const d=new Date(iso);if(!iso||Number.isNaN(d.getTime()))return '';const month=d.toLocaleString('en-AU',{month:'long',timeZone:'Australia/Sydney'});const year=d.toLocaleString('en-AU',{year:'numeric',timeZone:'Australia/Sydney'});return 'Joined '+month+' '+year}
function joinedFrom(profile, cars, ads){if(profile&&profile.created_at)return joinedLabel(profile.created_at);const stamps=[...(cars||[]),...(ads||[])].map(row=>row&&row.created_at).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b));return stamps.length?joinedLabel(stamps[0]):''}
function atHandle(name, withPin){const h=String(name||'').replace(/^@/,'').trim();const shown='@'+(h||'you');const pin=withPin?sv('pin','sm'):'';const tick=withPin?sv('check','ck'):'';const link=/^[a-z0-9._]{3,20}$/i.test(h)&&!['you','member','driver'].includes(h.toLowerCase());if(!link)return `<span class="handle">${pin}${esc(shown)}${tick}</span>`;return `<a class="handle" href="#/u/${encodeURIComponent(h.toLowerCase())}">${pin}${esc(shown)}${tick}</a>`}
function unreadMark(){return `<span class="unread-mark" aria-label="Unopened"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v11H4z"/><path d="m4 7 8 7 8-7"/></svg></span>`}
function inboxRow(c){return `<article class="inbox-row${c.unread?' is-unread':''}" data-mode="${laneOf(c)}"><a class="inbox-photo shot" href="#/messages/${esc(c.id)}"><img src="${esc(c.thumb)}" alt="" onerror="${FALLBACK}">${photoMark()}</a><span class="inbox-copy"><span class="inbox-top">${atHandle(c.handle)}<time>${esc(c.when)}</time></span><a class="inbox-car" href="#/messages/${esc(c.id)}">${esc(c.heading)}</a><a class="inbox-last" href="#/messages/${esc(c.id)}">${esc(c.last||'No messages yet')}</a></span>${c.unread?unreadMark():'<span></span>'}</article>`}
function noteRow(n){return `<button type="button" class="note-row${n.read?'':' is-unread'}" data-note="${esc(n.id)}" data-thread="${esc(n.threadId)}" data-reply="${esc(n.replyId)}">${n.read?'':unreadMark()}<span>${esc(noteLine(n))}</span><time>${esc(n.when||'')}</time></button>`}
async function openNote(id,threadId,replyId){try{await Notes.markRead(id)}catch(e){}refreshUnread();const dest='#/forum/t/'+encodeURIComponent(threadId)+'?reply='+encodeURIComponent(replyId);if(location.hash===dest)route();else location.hash=dest}
async function inbox(){const token=++viewToken;await Auth.ready;if(token!==viewToken)return;if(!Auth.user){askSignIn('Sign in to read your messages.','messages');return}if(Auth.needsHandle()){sessionStorage.setItem('imdrivn_next','messages');location.hash='#/join';return}main.innerHTML=`<div class="wrap msgs"><div class="eyebrow">Inbox</div><h1 style="font-size:clamp(1.4rem,4vw,2rem)">Messages</h1><div id="inbox"><p class="muted">Loading…</p></div></div>`;let rows=[];try{rows=await Chat.inbox()}catch(e){if(token!==viewToken||!$('#inbox'))return;$('#inbox').innerHTML=`<p class="err">${esc(e.message||'Could not load messages.')}</p>`;return}if(token!==viewToken||!$('#inbox'))return;$('#inbox').innerHTML=rows.length?`<div class="inbox">${rows.map(inboxRow).join('')}</div>`:'<p class="muted">No messages yet. Open a car and tap Message seller.</p>';refreshUnread()}
function bubbleHtml(row){const mine=Auth.user&&row.sender_id===Auth.user.id;return `<div class="bubble ${mine?'mine':'theirs'}">${esc(row.body)}</div>`}
async function chatThread(id){const token=++viewToken;await Auth.ready;if(token!==viewToken)return;if(!Auth.user){askSignIn('Sign in to read your messages.','messages/'+id);return}if(Auth.needsHandle()){sessionStorage.setItem('imdrivn_next','messages/'+id);location.hash='#/join';return}main.innerHTML='<div class="wrap"><p class="muted">Loading…</p></div>';let conv;try{conv=await Chat.get(id)}catch(e){if(token!==viewToken)return;main.innerHTML=`<div class="wrap"><p class="err">${esc(e.message||'Could not open that chat.')}</p><a class="btn" href="#/messages">Back to messages</a></div>`;return}if(token!==viewToken)return;if(!conv){main.innerHTML='<div class="wrap"><h2>Chat not found</h2><a class="btn" href="#/messages">Back to messages</a></div>';return}let listing=null;try{listing=await ListingStore.get(conv.listing_id)}catch(e){listing=null}if(token!==viewToken)return;const otherId=conv.buyer_id===Auth.user.id?conv.seller_id:conv.buyer_id;let handle='member';try{const names=await sb.from('profiles').select('username').eq('id',otherId).maybeSingle();if(names.data&&names.data.username)handle=names.data.username}catch(e){}if(token!==viewToken)return;const title=listing?(listing.heading||[listing.year,listing.make,listing.model].filter(Boolean).join(' ')):'Listing';const pin=listing?`<div class="thread-pin" data-mode="${laneOf(listing)}"><a class="shot" href="#/car/${esc(listing.id)}"><img src="${esc(listing.photos[0]||'')}" alt="" onerror="${FALLBACK}">${photoMark()}</a><span><a href="#/car/${esc(listing.id)}"><strong>${esc(title)}</strong></a><span class="muted"><span class="price">${esc(aud(listing.price))}</span> · ${atHandle(handle)}</span></span></div>`:`<div class="thread-pin"><span><strong>Listing</strong></span></div>`;main.innerHTML=`<div class="wrap thread"><a href="#/messages" class="eyebrow">← Messages</a>${pin}<div class="bubbles" id="bubbles" aria-live="polite"></div><p class="err" id="msg-err" role="alert"></p><form class="composer" id="composer"><input id="msg-body" maxlength="2000" autocomplete="off" placeholder="Write a message" aria-label="Message"><button class="btn solid" type="submit">Send</button></form></div>`;const seen=new Set();const box=$('#bubbles');function add(row){if(!row||seen.has(row.id)||liveChat!==id)return;seen.add(row.id);box.insertAdjacentHTML('beforeend',bubbleHtml(row));box.scrollTop=box.scrollHeight}if(token!==viewToken)return;liveChat=id;if(sb){chatChannel=sb.channel('chat:'+id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'conversation_id=eq.'+id},payload=>{if(liveChat!==id)return;const row=payload.new;add(row);if(row&&row.sender_id!==Auth.user.id)Chat.markOpened(conv).then(()=>refreshUnread()).catch(()=>{})}).subscribe()}let msgs=[];try{msgs=await Chat.messages(id)}catch(e){if(token!==viewToken)return;$('#msg-err').textContent=e.message||'Could not load messages.';return}if(token!==viewToken||liveChat!==id)return;msgs.forEach(add);Chat.markOpened(conv).then(()=>refreshUnread()).catch(()=>{});$('#composer').onsubmit=async e=>{e.preventDefault();const input=$('#msg-body');const body=(input.value||'').trim();$('#msg-err').textContent='';if(!body)return;input.disabled=true;try{const row=await Chat.send(id,body);input.value='';add(row);await Chat.markOpened(conv);refreshUnread()}catch(err){$('#msg-err').textContent=err.message||'Could not send that.'}finally{if(input.isConnected){input.disabled=false;input.focus()}}}}
function msgs(){const {a}=hashParts();return a?chatThread(a):inbox()}
function garageCard(car, mine){const name=[car.make,car.model].filter(Boolean).join(' ')||'Car';return `<article class="gcar"><img src="${esc(car.src)}" alt="${esc(name)}" onerror="${FALLBACK}"><b>${esc(name)}</b>${mine?`<button type="button" class="auth-link gdel" data-del="${esc(car.id)}">Remove</button>`:''}</article>`}
function garagePage(who, cars, ads, carErr){const name=String(who||'').replace(/^@/,'').trim();const active=activeAds(ads);const parked=carErr?`<p class="err">${esc(carErr)}</p>`:(cars&&cars.length?`<div class="garage-grid" id="gcars">${cars.map(c=>garageCard(c,true)).join('')}</div>`:'<p class="muted" id="gempty">Nothing parked here yet. Add the cars you actually drive.</p>');const listings=active.length?laneGroups(active,true):'<p class="muted">You have not listed a car yet. <a href="#/list">List one free</a>.</p>';return `<div class="wrap garage profile-page"><h1 style="font-size:clamp(1.4rem,4vw,2.2rem)">${esc(garageTitle(name))}</h1>${name?`<p class="muted">Public page: ${atHandle(name)}</p>`:''}<p><button type="button" class="btn solid" id="add-car">Add a car</button></p>${parked}<h2 id="my-ads" class="profile-listings">My ads</h2><div id="mine">${listings}</div></div>`}
function scrollMyAds(){const el=document.getElementById('my-ads');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}
function bindGarageDelete(host, reload){if(!host)return;host.addEventListener('click',async e=>{const btn=e.target.closest('[data-del]');if(!btn)return;if(btn.dataset.sure!=='1'){btn.dataset.sure='1';btn.textContent='Delete';return}btn.disabled=true;try{await Garage.remove(btn.dataset.del);reload()}catch(err){btn.disabled=false;btn.dataset.sure='';btn.textContent='Remove';toast(err.message||'Could not remove that.','error')}})}
async function garage(ads){const token=++viewToken;await Auth.ready;if(token!==viewToken)return;if(!Auth.user){askSignIn('Sign in to open your garage.','garage'+(ads?'/ads':''));return}if(Auth.needsHandle()){sessionStorage.setItem('imdrivn_next','garage'+(ads?'/ads':''));location.hash='#/join';return}const who=Auth.profile&&Auth.profile.username?Auth.profile.username:'';main.innerHTML='<div class="wrap"><p class="muted">Loading…</p></div>';let cars=[];let rows=[];let carErr='';try{cars=await Garage.cars(Auth.user.id)}catch(e){carErr=e.message||'Could not load the garage.'}try{rows=await ListingStore.mine()}catch(e){rows=[]}if(token!==viewToken)return;main.innerHTML=garagePage(who,cars,rows,carErr);const add=$('#add-car');if(add)add.onclick=()=>garageAdd();bindGarageDelete($('#gcars'),()=>garage(!!ads));if(ads)requestAnimationFrame(scrollMyAds)}
function compressGarage(file){return preparePhoto(file)}
function garageAdd(){if(ListFlow._key){document.removeEventListener('keydown',ListFlow._key);ListFlow._key=null}const draft={photo:'',make:'',model:''};let i=0,busy=false;const steps=[{q:'Got a photo?',hint:'One shot of the car. We will size it to about 2000px.',ok:'OK'},{q:'What make?',hint:'Audi, Honda, the badge on the nose.',ok:'OK'},{q:'And the model?',hint:'SQ5, Civic Type R, the rest of the name.',ok:'Park it'}];function paint(){const bar=document.querySelector('.gask .ask-bar');if(bar){bar.setAttribute('aria-valuenow',String(i+1));bar.firstElementChild.style.width=((i+1)/steps.length*100)+'%'}const stage=document.querySelector('.gask .ask-stage');if(!stage)return;const step=steps[i];stage.innerHTML=`<div class="ask-slide" role="group" aria-labelledby="ask-q"><p class="ask-count">${i+1} of ${steps.length}</p><h2 class="ask-q" id="ask-q">${step.q}</h2><p class="ask-hint" id="ask-hint">${step.hint}</p><div class="ask-body" id="ask-body"></div><p class="ask-err" id="ask-err" role="alert"></p><div class="ask-nav"><button type="button" class="btn" id="ask-back" ${i?'':'hidden'}>Back</button><button type="button" class="btn solid" id="ask-ok">${step.ok}</button></div>${i===steps.length-1?'':'<p class="ask-key">Enter ↵</p>'}</div>`;const body=$('#ask-body');if(i===0){body.innerHTML=`<button type="button" class="ask-drop" id="g-drop" data-autofocus>${draft.photo?'Change photo':'Add a photo'}</button><input id="g-file" class="ask-file" type="file" accept="image/*" hidden><div class="g-preview">${draft.photo?`<img src="${draft.photo}" alt="Your car">`:''}</div>`;$('#g-drop').onclick=()=>$('#g-file').click();$('#g-file').onchange=async()=>{const file=$('#g-file').files&&$('#g-file').files[0];$('#g-file').value='';if(!file)return;if(!/^image\//.test(file.type)){$('#ask-err').textContent='Use a JPG or PNG.';return}try{draft.photo=await compressGarage(file);$('#ask-err').textContent='';paint()}catch(e){$('#ask-err').textContent='That photo would not load. Try a JPG or PNG.'}}}else if(i===1){body.innerHTML=`<input class="ask-input" id="g-make" data-autofocus maxlength="40" aria-labelledby="ask-q" value="${esc(draft.make)}" placeholder="Toyota" autocomplete="off" enterkeyhint="next">`}else{body.innerHTML=`<input class="ask-input" id="g-model" data-autofocus maxlength="40" aria-labelledby="ask-q" value="${esc(draft.model)}" placeholder="GR Yaris" autocomplete="off" enterkeyhint="done">`}$('#ask-back').onclick=()=>{read();if(i){i--;paint()}};$('#ask-ok').onclick=()=>go();const focus=stage.querySelector('[data-autofocus]');if(focus)focus.focus({preventScroll:true})}function read(){if(i===1){const el=$('#g-make');if(el)draft.make=el.value}if(i===2){const el=$('#g-model');if(el)draft.model=el.value}}async function go(){if(busy)return;read();if(i===0&&!draft.photo){$('#ask-err').textContent='Add a photo first.';return}if(i===1&&!draft.make.trim()){$('#ask-err').textContent='The make is the badge on the front.';$('#g-make')&&$('#g-make').focus();return}if(i===2&&!draft.model.trim()){$('#ask-err').textContent='The model is the rest of the name.';$('#g-model')&&$('#g-model').focus();return}if(i<2){i++;paint();return}busy=true;$('#ask-ok').disabled=true;$('#ask-err').textContent='';try{await Garage.add(draft.make,draft.model,draft.photo);if(location.hash==='#/garage')garage(false);else location.hash='#/garage'}catch(e){busy=false;if($('#ask-ok'))$('#ask-ok').disabled=false;$('#ask-err').textContent=e.message||'Could not park that.'}}function onKey(e){const root=document.querySelector('.gask');if(!root||!root.isConnected||e.key!=='Enter'||e.shiftKey||e.altKey||e.isComposing||e.repeat)return;if(!e.target.closest||!e.target.closest('.gask')||e.target.closest('#ask-back'))return;e.preventDefault();go()}if(garageAdd._key)document.removeEventListener('keydown',garageAdd._key);garageAdd._key=onKey;document.addEventListener('keydown',onKey);main.innerHTML=`<div class="ask gask"><div class="ask-bar" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1" aria-label="Add a car"><span></span></div><div class="ask-stage"></div></div>`;paint()}
async function publicProfile(raw){const token=++viewToken;let handle='';try{handle=decodeURIComponent(raw||'')}catch(e){handle=raw||''}handle=Auth.cleanHandle(handle);main.innerHTML='<div class="wrap"><p class="muted">Loading…</p></div>';let profile=null;try{profile=await Garage.profile(handle)}catch(e){if(token!==viewToken)return;main.innerHTML=`<div class="wrap"><p class="err">${esc(e.message||'Could not load that profile.')}</p></div>`;return}if(token!==viewToken)return;if(!profile){main.innerHTML=`<div class="wrap"><h1 class="gwho">@${esc(handle||'unknown')}</h1><p class="muted">No one drives under that handle.</p><a class="btn" href="#/buy">Back to the feed</a></div>`;return}let cars=[];let ads=[];try{cars=await Garage.cars(profile.id)}catch(e){cars=[]}try{ads=await ListingStore.bySeller(profile.id)}catch(e){ads=[]}if(token!==viewToken)return;await Auth.ready;if(token!==viewToken)return;const mine=!!(Auth.user&&profile.id===Auth.user.id);main.innerHTML=profileView({handle:profile.username,mine,cars,ads,signOut:false});if(mine){const add=$('#add-car');if(add)add.onclick=()=>garageAdd();bindGarageDelete($('#gcars'),()=>publicProfile(profile.username))}}
function merch(){const cards=rows=>rows.map(([name,line])=>`<article class="merch-card"><div class="swatch">${esc(name)}</div><h2>${esc(name)}</h2><p>${esc(line)}</p><span class="soon">Coming soon</span></article>`).join('');
const products=[['tee','Tee','Heavyweight. The one you actually wear.'],['hoodie','Hoodie','Cold start, warm hoodie.'],['cap','Cap','Low crown. Logo only.'],['stickers','Stickers','Bumper, laptop, water bottle. Your call.']];
const productCards=products.map(([file,name,line])=>`<article class="merch-card merch-product"><img src="assets/merch/${file}.jpg" alt="${esc(name)}"><h2>${esc(name)}</h2><p>${esc(line)}</p><span class="soon">Coming soon</span></article>`).join('');
const notify=`<a class="btn solid" href="${esc(INSTAGRAM_URL)}" target="_blank" rel="noopener">Notify me</a>`;
const detail=[['Wash Pack','Bucket, mitt, soap. No swirl marks.'],['Interior Pack','Cabin reset. Smells freshly detailed.'],['Ceramic Shine Pack','Bead game loud. Paint stays protected.'],['Full Detail Kit','The whole routine. One box.']];
main.innerHTML=`<div class="wrap merch"><div class="eyebrow">MERCH</div><h1 style="font-size:clamp(1.6rem,5vw,2.6rem)">Merch dropping soon</h1><p class="muted">We're cooking the drop. Nothing to buy yet — just the lineup.</p><div class="merch-grid">${productCards}</div>${notify}<section class="detailn"><h2>IM DETAILN</h2><p class="muted">Keep it clean. Keep it DRIVN.</p><div class="merch-grid">${cards(detail)}</div>${notify}</section></div>`}
function updateNav(){const a=document.querySelector('.nav-account');if(a)a.textContent=Auth.user?(Auth.profile&&Auth.profile.username?'@'+Auth.profile.username:'Profile'):'Sign in';const reports=$('#menu-reports');if(reports)reports.hidden=!(Auth.user&&Auth.profile&&Auth.profile.is_admin)}
async function reportsPage(){const token=++viewToken;await Auth.ready;if(token!==viewToken)return;if(!Auth.user){askSignIn('Sign in to review reports.','reports');return}if(Auth.needsHandle()){sessionStorage.setItem('imdrivn_next','reports');location.hash='#/join';return}if(!Auth.profile||!Auth.profile.is_admin){main.innerHTML='<div class="wrap"><h1 style="font-size:clamp(1.4rem,4vw,2.2rem)">Reports</h1><p class="muted">That page is for IM DRIVN admins.</p></div>';return}main.innerHTML='<div class="wrap"><p class="muted">Loading…</p></div>';let rows=[];try{rows=await Reports.open()}catch(e){if(token!==viewToken)return;main.innerHTML=`<div class="wrap"><p class="err">${esc(e.message||'Could not load reports.')}</p></div>`;return}if(token!==viewToken)return;const list=rows.length?rows.map(r=>`<article class="report-row" data-id="${esc(r.id)}"><div><p class="report-reason">${esc(r.reason)}</p><p>${r.details?esc(r.details):'<span class="muted">No extra details.</span>'}</p><p class="muted">${r.reporter?atHandle(r.reporter):'Someone'} · ${esc(r.when)}</p><a href="#/car/${esc(r.listingId)}">${esc(r.title)}</a></div><div class="auth-row">${r.sellerId&&r.sellerId!==Auth.user.id?`<button type="button" class="btn" data-report-msg="${esc(r.listingId)}">Message seller</button>`:''}<button type="button" class="btn" data-report-review="${esc(r.id)}">Mark reviewed</button></div></article>`).join(''):'<p class="muted">No open reports.</p>';main.innerHTML=`<div class="wrap reports"><div class="eyebrow">Admin</div><h1 style="font-size:clamp(1.4rem,4vw,2.2rem)">Open reports</h1><div class="report-list">${list}</div></div>`;main.querySelectorAll('[data-report-msg]').forEach(b=>b.onclick=()=>messageSeller(b.dataset.reportMsg));main.querySelectorAll('[data-report-review]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await Reports.review(b.dataset.reportReview);const card=b.closest('.report-row');if(card)card.remove();if(!main.querySelector('.report-row')){const host=main.querySelector('.report-list');if(host)host.innerHTML='<p class="muted">No open reports.</p>'}toast('Marked reviewed.')}catch(e){b.disabled=false;toast(e.message||'Could not update that report.','error')}})}
function toast(text, kind){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el);el.addEventListener('click',()=>el.remove())}
el.className='toast '+(kind==='error'?'toast-err':'toast-ok');el.textContent=text;clearTimeout(toast._t);toast._t=setTimeout(()=>{if(el.isConnected)el.remove()},8000)}
function finishAuthReturn(){updateNav();
if(Auth.oauthError){toast(Auth.oauthError,'error');Auth.oauthError='';return}
if(Auth.recovery){if(!location.hash.startsWith('#/join'))location.hash='#/join';return}
if(Auth.authReturn&&Auth.user){try{sessionStorage.removeItem('imdrivn_oauth')}catch(e){}
const who=Auth.profile&&Auth.profile.username?'@'+Auth.profile.username:(Auth.user.email||'your account');
toast('Signed in as '+who);
if(Auth.needsHandle()&&(sessionStorage.getItem('imdrivn_next')||'')!=='valuation'){if(location.hash!=='#/join')location.hash='#/join';else join();return}}
if(Auth.user&&(!Auth.needsHandle()||(sessionStorage.getItem('imdrivn_next')||'')==='valuation'))takeNext()}
function route(){closeAlerts();if(hashParts().p==='how')history.replaceState(null,'',location.pathname+location.search+'#/about');document.body.classList.remove('menu-open');closeMenu(false);closeSort(false);dropChat();if(garageAdd._key){document.removeEventListener('keydown',garageAdd._key);garageAdd._key=null}if(ListFlow._key){document.removeEventListener('keydown',ListFlow._key);ListFlow._key=null}if(ValueFlow._key){document.removeEventListener('keydown',ValueFlow._key);ValueFlow._key=null}const {p,a,b,params}=hashParts();if(p==='buy'){const requested=params.get('sort');if(sortOk(requested)){SORT=requested;localStorage.setItem('imdrivn_sort',SORT)}}syncSortUi();const onFeed=p==='buy';const modebar=document.querySelector('.modebar');if(modebar)modebar.hidden=!(onFeed||p==='car');const sortBtn=$('#sortbtn');if(sortBtn)sortBtn.hidden=!onFeed;const feedSearch=$('#feedsearch');if(feedSearch)feedSearch.hidden=!onFeed;const headerSearch=$('#sbtn');if(headerSearch)headerSearch.hidden=onFeed;io&&io.disconnect();feedToken++;homeToken++;viewToken++;
const pages={'':home,buy:()=>buy(),buyin:buyChooser,saved:()=>buy(1),garage:()=>garage(a==='ads'),merch,msgs,messages:()=>a?chatThread(a):inbox(),car:()=>car(a),sell,list,valuation,how:aboutPage,about:aboutPage,join,u:()=>publicProfile(a),reports:reportsPage,forum:()=>a==='t'&&b?forumThread(b, params.get('reply')):a?forumCategory(a):forumIndex()};document.body.classList.toggle('is-home',p===''||!Object.prototype.hasOwnProperty.call(pages,p||''));document.body.classList.toggle('is-all',(p==='buy'||p==='car')&&BUY==='all');document.body.classList.toggle('is-lanes',p==='buyin');document.body.classList.toggle('is-sell',p==='sell');document.body.classList.toggle('is-list',p==='list');document.body.classList.toggle('is-wholesale',p==='valuation');const run=pages[p||'']||home;
Promise.resolve(run()).catch(()=>{});
scrollTo(0,0);main.focus({preventScroll:true});
const section=p==='forum'?'forum':(p==='messages'||p==='msgs')?'messages':(p||'');
document.querySelectorAll('.bnav a, .dnav a, .nav-account').forEach(x=>{const key=x.dataset.r||String(x.getAttribute('href')||'').replace(/^#\//,'');const on=(key===section&&!!section)||(key==='buy'&&(p==='car'||p==='buyin'));x.setAttribute('aria-current',on?'page':'false')});}
addEventListener('hashchange',route);
Auth.listeners.add(()=>{updateNav();watchInbox();if(location.hash.startsWith('#/join')||Auth.recovery)join()});
if(Auth.oauthError){toast(Auth.oauthError,'error');Auth.oauthError=''}
route();
Auth.ready.then(()=>{finishAuthReturn();watchInbox()});
