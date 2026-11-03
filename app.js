const INSTAGRAM_URL='https://instagram.com/imdrivn';
const TIKTOK_URL='https://tiktok.com/@imdrivn';
const $=(s,r=document)=>r.querySelector(s),main=$('#main');
const aud=n=>'$'+Number(n).toLocaleString('en-AU'),kms=n=>Number(n).toLocaleString('en-AU')+' km';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const passes=l=>{const km=l.km??l.kms;return(!F.make||String(l.make).toLowerCase().includes(F.make.toLowerCase()))&&(!F.model||String(l.model).toLowerCase().includes(F.model.toLowerCase()))&&(!F.year||+l.year>=+F.year)&&(!F.km||+km<=+F.km)};
const demosFor=saved=>DEMO.filter(l=>l.sec===m2s(MODE)&&passes(l)&&(!saved||(st()[l.id]||{}).save));
const I={tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',up:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 16V8m-4 4 4-4 4 4"/>',
shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',gauge:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 15 4-5"/><path d="M6 13h1m10 0h1M12 8v1"/>',
lock:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11"/>',head:'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="5" rx="1"/><rect x="17" y="14" width="4" height="5" rx="1"/><path d="M19 19c0 1.5-2 2-5 2"/>',
bag:'<path d="M6 8h12l-1 12H7z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>'};
const ico=k=>`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const FALLBACK="this.onerror=null;this.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 16 10&quot;><rect width=&quot;16&quot; height=&quot;10&quot; fill=&quot;%231b1b1e&quot;/><text x=&quot;8&quot; y=&quot;5.6&quot; font-size=&quot;1&quot; fill=&quot;%23777&quot; text-anchor=&quot;middle&quot;>PHOTO</text></svg>')";

async function home(){const token=++homeToken;main.innerHTML=`
<section class="hero"><div class="wrap"><div class="eyebrow">IM DRIVN</div>
<h1>The high<br><span class="grey">performance</span><br>marketplace</h1><hr><p><em>Australia's premium marketplace for high performance cars.</em> Free to list. Always.</p></div></section>
<div class="wrap"><div class="paths">
<a class="path" href="#/buy">${ico('tag')}<span class="wide">IM BUYIN</span><span class="tag">Find your next machine.</span><span class="muted">Browse premium high performance cars available now.</span><span class="btn">Browse cars →</span></a>
<a class="path" href="#/sell">${ico('up')}<span class="wide">IM SELLIN</span><span class="tag">List with confidence.</span><span class="muted">List free, or get a wholesale offer from dealers.</span><span class="btn">Sell your car →</span></a>
<a class="path" href="#/merch">${ico('bag')}<span class="wide">IM MERCH</span><span class="tag">Wear the drive.</span><span class="muted">Tees, hoodies, caps. The drop is close.</span><span class="btn">See the drop →</span></a>
<a class="path forum-home" href="#/forum">${ico('head')}<span class="wide">THE FORUM</span><span class="tag">Need a hand with the car?</span><span class="muted">Ask the crew. Advice, mods, meets. No gatekeeping.</span><span class="btn">Pull up a chair →</span></a></div></div>
<section class="wrap feats" id="how"><div class="eyebrow">Built for enthusiasts. Driven by performance.</div><div class="row4">
${[['shield','Verified vehicles','Every car is checked for quality and authenticity.'],['gauge','Serious buyers','Connect with genuine high performance buyers.'],['lock','Secure & safe','Safe transactions from start to finish.'],['head','Expert support','Real people, real support when you need it.']].map(f=>`<div class="feat">${ico(f[0])}<h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div></section>
<section class="wrap"><div class="eyebrow">Fresh in the feed</div><div class="feed" id="fresh" style="padding:0;margin-top:var(--s-4)"></div></section>
${about()}`;
let rows=[];try{rows=await ListingStore.page({mode:MODE,from:0,to:2,filters:F})}catch(e){rows=[]}
if(token!==homeToken||!$('#fresh'))return;
const fresh=(rows.length?rows:demosFor(false)).slice(0,3);
$('#fresh').innerHTML=fresh.map(post).join('')||'<p class="muted">Nothing in this mode yet.</p>';}
const about=()=>`<section class="about" id="about"><div class="img" role="img" aria-label="Taillight of a dark car"></div><div class="txt"><div class="eyebrow">About IM DRIVN</div>
<h2>More than a marketplace.<br>It's a community.</h2><p class="muted">IM DRIVN connects Australia's car community — from supercars to performance weapons to the daily drive. Buy. Sell. Drive. All in one place. Listing is 100% free.</p><a class="btn" href="#/how">Learn more</a></div><div class="water" aria-hidden="true">IM DRIVN</div></section>`;

const SV={heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',mark:'<path d="M6 3h12v18l-6-4-6 4z"/>',pin:'<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
check:'<circle cx="12" cy="12" r="9" class="fillc"/><path d="m8 12 3 3 5-6" stroke="#000"/>'};
const sv=(k,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${SV[k]}</svg>`;
const st=()=>JSON.parse(localStorage.getItem('imdrivn_social')||'{}');
function post(l){const demo=!!l.demo,S=demo?(st()[l.id]||{}):{like:!!l.liked,save:!!l.saved},lk=demo?(l.likes||0)+(S.like?1:0):(l.likeCount||0),cm=(l.comments||0),title=l.heading||(l.year+' '+l.make+' '+l.model);
return`<article class="post s-${l.sec}"><a class="car" href="#/car/${l.id}"><img src="${esc(l.photos[0])}" alt="${esc(title)}" loading="lazy" onerror="${FALLBACK}">
<span class="new">NEW</span><span class="ago">${esc(l.when||(l.ago?l.ago+'h ago':'Just now'))}</span>${demo?'<span class="dm">Demo</span>':''}${l.status&&l.status!=='active'?`<span class="dm">${esc(l.status)}</span>`:''}</a>
<div class="b"><a href="#/car/${l.id}" class="ttl">${esc(title)}</a><div class="price">${aud(l.price)}</div>
<div class="row"><span class="loc">${sv('pin')}${esc(l.suburb)}, ${l.state}</span><span class="handle">${sv('pin','sm')}@${esc((l.handle||'you').replace(/^@/,''))}${sv('check','ck')}</span></div>
<div class="acts"><button data-act="like" data-id="${l.id}" data-demo="${demo?1:0}" aria-pressed="${!!S.like}" aria-label="Like">${sv('heart')}<span>${lk}</span></button>
<button data-act="cmt" data-id="${l.id}" data-demo="${demo?1:0}" aria-label="Comments">${sv('chat')}<span>${cm}</span></button>
<button class="bm" data-act="save" data-id="${l.id}" data-demo="${demo?1:0}" aria-pressed="${!!S.save}" aria-label="Save">${sv('mark')}</button></div>
</div></article>`;}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b||b.closest('.ask-preview'))return;
if(b.dataset.act==='cmt'){location.hash='#/car/'+b.dataset.id;return}
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
const MODES=['daily','performance','supercar'],m2s=m=>m==='supercar'?'supercars':m;
let MODE=localStorage.getItem('imdrivn_mode');if(!MODES.includes(MODE))MODE='daily';
function setMode(m){MODE=m;localStorage.setItem('imdrivn_mode',m);document.body.dataset.mode=m;
document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.m===m));}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{setMode(b.dataset.m);const h=location.hash;if(h.startsWith('#/buy')||h.startsWith('#/saved')||h===''||h==='#/'||h.startsWith('#/about'))route();});
setMode(MODE);
$('#sbtn').onclick=()=>{const p=$('#spanel');p.hidden=!p.hidden;$('#sbtn').setAttribute('aria-expanded',!p.hidden);if(!p.hidden)p.querySelector('input').focus()};
$('#bell').onclick=()=>alert('Notifications are coming soon (prototype).');
$('#ig').href=INSTAGRAM_URL;$('#tt').href=TIKTOK_URL;
const menuBtn=$('#menubtn'),appMenu=$('#appmenu');
function closeMenu(focusBack){if(!appMenu||appMenu.hidden)return;appMenu.hidden=true;menuBtn.setAttribute('aria-expanded','false');if(focusBack)menuBtn.focus()}
function openMenu(){appMenu.hidden=false;menuBtn.setAttribute('aria-expanded','true');const first=appMenu.querySelector('a');if(first)first.focus()}
menuBtn.onclick=()=>{if(appMenu.hidden)openMenu();else closeMenu(false)};
document.addEventListener('click',e=>{if(appMenu.hidden||e.target.closest('#appmenu')||e.target.closest('#menubtn'))return;closeMenu(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!appMenu.hidden){e.preventDefault();closeMenu(true)}});
appMenu.addEventListener('keydown',e=>{const items=[...appMenu.querySelectorAll('a')];const i=items.indexOf(document.activeElement);
if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus()}
if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus()}
if(e.key==='Home'){e.preventDefault();items[0].focus()}
if(e.key==='End'){e.preventDefault();items[items.length-1].focus()}});

let F={make:'',model:'',year:'',km:''},io,SAVED=false,homeToken=0,feedToken=0,viewToken=0,feedState=null;
const PAGE=8;
$('#qs').onsubmit=e=>{e.preventDefault();Object.assign(F,Object.fromEntries(new FormData(e.target)));$('#spanel').hidden=true;location.hash==='#/buy'?route():location.hash='#/buy';};
$('#qs').onreset=()=>{F={make:'',model:'',year:'',km:''};setTimeout(()=>location.hash==='#/buy'?route():location.hash='#/buy')};
function askSignIn(message,next){sessionStorage.setItem('imdrivn_next',next);main.innerHTML=`<div class="wrap form auth"><div class="eyebrow">Account</div><h1>Sign in</h1><p class="muted">${esc(message)}</p><a class="btn solid" href="#/join">Sign in</a></div>`}
async function buy(saved){if(saved){await Auth.ready;if(!Auth.user){askSignIn('Sign in to see the cars you saved.','saved');return}}
const token=++feedToken;SAVED=!!saved;const f=[F.make,F.model,F.year&&F.year+'+',F.km&&'≤'+F.km+' km'].filter(Boolean);
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
      const page=await ListingStore.page({mode:MODE,from:state.from,to:state.from+PAGE-1,saved:SAVED,filters:F});
      if(state.token!==feedToken)return;
      state.from+=page.length;
      if(page.length<PAGE)state.remoteDone=true;
      rows.push(...page);
    }
  }
  if(state.remoteDone&&!state.demosAdded){if(!SAVED&&state.from===0)rows.push(...demosFor(false));state.demosAdded=true}
  rows=rows.filter(l=>!state.seen.has(l.id));
  rows.forEach(l=>state.seen.add(l.id));
  const feed=$('#feed'),moreEl=$('#more');
  if(!feed||state.token!==feedToken)return;
  if(!state.seen.size){feed.innerHTML=`<p class="muted">${SAVED?'Nothing saved in this mode yet. Tap the bookmark on a car.':'No machines match. Try fewer words.'}</p>`;if(moreEl)moreEl.hidden=true;return}
  if(rows.length)feed.insertAdjacentHTML('beforeend',rows.map(post).join(''));
  if(state.remoteDone&&state.demosAdded&&moreEl){moreEl.hidden=true;io&&io.disconnect()}
}catch(e){if(state.token!==feedToken)return;const feed=$('#feed'),moreEl=$('#more');
if(feed&&!state.seen.size){if(SAVED){feed.innerHTML='<p class="muted">Nothing saved in this mode yet. Tap the bookmark on a car.</p>';if(moreEl)moreEl.hidden=true;return}const demos=demosFor(false);demos.forEach(l=>state.seen.add(l.id));state.remoteDone=true;state.demosAdded=true;feed.innerHTML=demos.map(post).join('')+(demos.length?'':'<p class="muted">Live listings did not load.</p>');if(moreEl)moreEl.hidden=true;return}
if(moreEl)moreEl.textContent='Could not load more. Scroll to try again.'
}finally{state.busy=false}}

async function car(id){const token=++viewToken;let l=DEMO.find(x=>x.id===id)||ListingStore.cache.get(id);
if(!l){main.innerHTML='<div class="wrap"><p class="muted">Loading…</p></div>';try{l=await ListingStore.get(id)}catch(e){l=null}}
if(token!==viewToken)return;
if(!l){main.innerHTML='<div class="wrap"><h2>Listing not found</h2><a class="btn" href="#/buy">Back to feed</a></div>';return}
const title=l.heading||(l.year+' '+l.make+' '+l.model);
const specs=[['Year',l.year],['Kilometres',(l.km||l.km===0)?kms(l.km):''],['Body',l.body||''],['Transmission',l.trans||''],['Location',[l.suburb,l.state].filter(Boolean).join(', ')],['Rego / VIN',l.rego||'On request']].filter(s=>s[1]!==''&&s[1]!=null);
main.innerHTML=`<div class="wrap s-${l.sec}"><a href="#/buy" class="eyebrow">← Back to feed</a><div class="detail" style="margin-top:var(--s-4)"><div>
<div class="gal"><img class="main" id="big" src="${esc(l.photos[0])}" alt="${esc(title)} main photo" onerror="${FALLBACK}"><div class="thumbs">${l.photos.map((p,i)=>`<button aria-label="Show photo ${i+1}" aria-current="${i===0}" data-src="${esc(p)}"><img src="${esc(p)}" alt="" onerror="${FALLBACK}"></button>`).join('')}</div></div>
<div class="eyebrow" style="margin-top:var(--s-5);color:var(--sec)">${SECTIONS[l.sec]} ${l.demo?'· Demo data':''}</div><h1 style="font-size:clamp(1.2rem,3vw,2rem)">${esc(title)}</h1><div class="price">${aud(l.price)}</div>
<div class="specs">${specs.map(s=>`<div><span class="meta">${s[0]}</span><b>${esc(s[1])}</b></div>`).join('')}</div>
<h2 style="font-size:1rem">Description</h2><p class="muted">${esc(l.desc)}</p></div>
<form class="panel" id="contact"><h2 style="font-size:1rem">Message seller</h2><label>Name<input name="n" required autocomplete="name"></label><label>Email<input name="e" type="email" required autocomplete="email"></label><label>Phone<input name="p" type="tel" autocomplete="tel"></label>
<label>Message<textarea name="m" rows="4">Hi, is the ${esc(l.make+' '+l.model)} still available?</textarea></label><button class="btn solid">Send message</button><p class="meta">Prototype: messages aren't really sent.</p></form></div></div>`;
main.querySelectorAll('.thumbs button').forEach(b=>b.onclick=()=>{$('#big').src=b.dataset.src;main.querySelectorAll('.thumbs button').forEach(x=>x.setAttribute('aria-current',x===b))});
$('#contact').onsubmit=e=>{e.preventDefault();e.target.innerHTML='<div class="ok" role="status"><h2 style="font-size:1rem">Message sent (demo)</h2><p class="muted">In the real site the seller would get this now.</p></div>'};}

function sell(){main.innerHTML=`<div class="wrap"><div class="eyebrow">IM SELLIN</div><h1 style="font-size:clamp(1.4rem,4vw,2.4rem)">How do you<br><span class="grey">want to sell?</span></h1><div class="paths" style="margin-top:var(--s-5)">
<a class="path" href="#/list">${ico('tag')}<span class="wide" style="font-size:1.6rem">List free</span><span class="tag">100% free. No catch.</span><span class="muted">Post your ad to the feed and deal direct with buyers.</span><span class="btn">List your car free →</span></a>
<a class="path" href="#/valuation">${ico('gauge')}<span class="wide" style="font-size:1.6rem">Wholesale</span><span class="tag">Sell fast to dealers.</span><span class="muted">Answer a few questions and verified dealers make you an offer.</span><span class="btn">Get a valuation →</span></a></div></div>`;}

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
async function list(){if(!await gate('list'))return;ListFlow.start(main,{async publish(d){
  const saved=await ListingStore.create({sec:d.sec,make:d.make.trim(),model:d.model.trim(),year:+d.year,km:+d.km,price:+d.price,suburb:d.suburb.trim(),state:d.state,heading:d.heading.trim(),desc:d.desc.trim(),photos:d.photos.slice(),name:d.name.trim(),phone:d.phone.trim(),email:d.email.trim()});
  setMode(saved.mode||(saved.sec==='supercars'?'supercar':saved.sec));
  location.hash='#/car/'+saved.id;
}});}

async function valuation(){if(!await gate('valuation'))return;const yn=(n,q)=>`<p style="margin:var(--s-4) 0 var(--s-2)">${q}</p><div class="choice c3"><label><input type="radio" name="${n}" value="yes" checked> Yes</label><label><input type="radio" name="${n}" value="no"> No</label><label><input type="radio" name="${n}" value="unsure"> Not sure</label></div>`;
wizard('Get a <span class="grey">wholesale</span> valuation',[['Vehicle details',vehicle()],['Condition',`<label>Overall condition<select name="cond"><option>Excellent</option><option>Good</option><option>Fair</option><option>Needs work</option></select></label>${yn('hist','Full service history?')}${yn('acc','Free of accident damage?')}${yn('fin','Paid off (no finance owing)?')}<label style="margin-top:var(--s-4)">Anything else dealers should know?<textarea name="notes" rows="3"></textarea></label>`],['Photos',photos()],['Contact',contact()]],(d,imgs)=>{
main.innerHTML='<div class="wrap form"><p class="muted">Sending your valuation…</p></div>';
ListingStore.valuation(d,imgs).then(()=>{main.innerHTML=`<div class="wrap form"><div class="ok" role="status">${ico('shield')}<h1 style="font-size:1.4rem;margin-top:var(--s-4)">Valuation request in</h1><p>Thanks ${esc(d.name)}. Your ${esc(d.year+' '+d.make+' '+d.model)} has gone to dealers in ${esc(d.state)}. Expect offers within 24 hours by SMS and email.</p><a class="btn" href="#/">Back home</a></div></div>`}).catch(e=>{main.innerHTML=`<div class="wrap form"><p class="err" role="alert">${esc(e.message||'Could not send that.')}</p><a class="btn" href="#/valuation">Try again</a></div>`});});}

function how(){main.innerHTML=`<section class="wrap feats"><div class="eyebrow">How it works</div><h1 style="font-size:clamp(1.3rem,4vw,2.2rem)">Simple. <span class="grey">Free.</span> Fast.</h1><div class="row4">
${[['tag','1. Snap & list','Photos, price, done. Listing is 100% free.'],['gauge','2. Hit the feed','Your ad lands in a scroll-first feed buyers love.'],['head','3. Chat direct','Buyers message you. No middleman.'],['up','4. Or go wholesale','Want it gone? Dealers make an offer.']].map(f=>`<div class="feat">${ico(f[0])}<h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div><a class="btn solid" href="#/sell" style="margin-top:var(--s-5)">Sell your car →</a></section>${about()}`;}
function authLead(){const next=sessionStorage.getItem('imdrivn_next');return next==='list'?'Sign in to post your car. It only takes a minute.':next==='valuation'?'Sign in so dealers know who the offer is for.':'Buy, sell, and keep your saves in one account.'}
function showAuthErr(msg){const el=$('#auth-err');if(el)el.textContent=msg||''}
function afterAuth(){if(Auth.needsHandle()){join();return}const next=sessionStorage.getItem('imdrivn_next');if(next){sessionStorage.removeItem('imdrivn_next');location.hash='#/'+next;return}join()}
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
async function profileScreen(){const token=++viewToken;const handle=Auth.profile&&String(Auth.profile.username||'').trim();main.innerHTML=`<div class="wrap form auth"><div class="eyebrow">Profile</div><h1>${handle?'@'+esc(handle):'Your account'}</h1><p class="muted">${esc(Auth.user.email||'')}</p><div class="auth-row"><button class="btn" type="button" id="sign-out">Sign out</button></div><h2 style="font-size:1rem;margin-top:var(--s-5)">Your listings</h2><div class="feed" id="mine"></div></div>`;
$('#sign-out').onclick=async()=>{await Auth.signOut();updateNav();authScreen('in')};
let rows=[];try{rows=await ListingStore.mine()}catch(e){rows=[]}
if(token!==viewToken||!$('#mine'))return;
$('#mine').innerHTML=rows.length?rows.map(post).join(''):'<p class="muted">You have not listed a car yet. <a href="#/list">List one free</a>.</p>';}
async function join(){const token=++viewToken;main.innerHTML='<div class="wrap form"><p class="muted">Loading…</p></div>';try{await Auth.ready}catch(e){}
if(token!==viewToken)return;if(!sb){main.innerHTML='<div class="wrap form auth"><h1>Sign in</h1><p class="err">Accounts are offline right now. The demo feed still works.</p><a class="btn" href="#/buy">Browse cars</a></div>';return}
if(Auth.recovery)return recoveryScreen();if(!Auth.user)return authScreen('in');if(Auth.needsHandle())return handleScreen();return profileScreen()}

function msgs(){main.innerHTML=`<div class="wrap form"><h1 style="font-size:1.4rem">Messages</h1><div class="panel"><p class="muted">No messages yet. When buyers or sellers message you, chats land here.</p><a class="btn" href="#/buy">Back to the feed</a></div></div>`}
async function garage(){const token=++viewToken;await Auth.ready;if(token!==viewToken)return;if(!Auth.user){askSignIn('Sign in to open your garage.','garage');return}
main.innerHTML=`<div class="wrap"><div class="eyebrow">My garage</div><h1 style="font-size:clamp(1.4rem,4vw,2.2rem)">Your cars</h1><p class="muted">Everything you've listed. The ones still up, and the ones that aren't.</p><div class="feed" id="mine"></div></div>`;
let rows=[];try{rows=await ListingStore.mine()}catch(e){rows=[]}
if(token!==viewToken||!$('#mine'))return;
$('#mine').innerHTML=rows.length?rows.map(post).join(''):'<p class="muted">Garage is empty. List a car and it shows up here.</p><a class="btn" href="#/list">List your car</a>';}
function merch(){const items=[['Tee','Heavyweight. The one you actually wear.'],['Hoodie','Cold start, warm hoodie.'],['Cap','Low crown. Logo only.'],['Sticker pack','Bumper, laptop, water bottle. Your call.']];
main.innerHTML=`<div class="wrap merch"><div class="eyebrow">IM MERCH</div><h1 style="font-size:clamp(1.6rem,5vw,2.6rem)">Merch dropping soon</h1><p class="muted">We're cooking the drop. Nothing to buy yet — just the lineup.</p><div class="merch-grid">${items.map(([name,line])=>`<article class="merch-card"><div class="swatch">${esc(name)}</div><h2>${esc(name)}</h2><p>${esc(line)}</p><span class="soon">Coming soon</span></article>`).join('')}</div><a class="btn solid" href="${esc(INSTAGRAM_URL)}" target="_blank" rel="noopener">Notify me</a></div>`}
function updateNav(){const a=document.querySelector('.dnav a[href="#/join"]');if(a)a.textContent=Auth.user?(Auth.profile&&Auth.profile.username?'@'+Auth.profile.username:'Profile'):'Sign in'}
function toast(text, kind){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el);el.addEventListener('click',()=>el.remove())}
el.className='toast '+(kind==='error'?'toast-err':'toast-ok');el.textContent=text;clearTimeout(toast._t);toast._t=setTimeout(()=>{if(el.isConnected)el.remove()},8000)}
function finishAuthReturn(){updateNav();
if(Auth.oauthError){toast(Auth.oauthError,'error');Auth.oauthError='';return}
if(Auth.recovery){if(!location.hash.startsWith('#/join'))location.hash='#/join';return}
if(Auth.authReturn&&Auth.user){try{sessionStorage.removeItem('imdrivn_oauth')}catch(e){}
const who=Auth.profile&&Auth.profile.username?'@'+Auth.profile.username:(Auth.user.email||'your account');
toast('Signed in as '+who);
if(Auth.needsHandle()){if(location.hash!=='#/join')location.hash='#/join';else join();return}}
const next=sessionStorage.getItem('imdrivn_next');
if(Auth.user&&next&&!Auth.needsHandle()){sessionStorage.removeItem('imdrivn_next');location.hash='#/'+next}}
function route(){document.body.classList.remove('menu-open');closeMenu(false);const [,p,a,b]=location.hash.slice(1).split('/');io&&io.disconnect();feedToken++;homeToken++;viewToken++;
const run=({'':home,buy:()=>buy(),saved:()=>buy(1),garage,merch,msgs,car:()=>car(a),sell,list,valuation,how,about:()=>{home();$('#about').scrollIntoView()},join,forum:()=>a==='t'&&b?forumThread(b):a?forumCategory(a):forumIndex()}[p||'']||home);
Promise.resolve(run()).catch(()=>{});
if(p!=='about')scrollTo(0,0);main.focus({preventScroll:true});
const section=p==='forum'?'forum':(p||'');
document.querySelectorAll('.bnav a, .dnav a').forEach(x=>x.setAttribute('aria-current',(x.dataset.r||x.getAttribute('href'))===(section==='forum'?'#/forum':section)&&section? 'page' : (x.dataset.r===section||(x.dataset.r==='buy'&&p==='car')?'page':'false')));}
addEventListener('hashchange',route);
Auth.listeners.add(()=>{updateNav();if(location.hash.startsWith('#/join')||Auth.recovery)join()});
if(Auth.oauthError){toast(Auth.oauthError,'error');Auth.oauthError=''}
route();
Auth.ready.then(()=>finishAuthReturn());
