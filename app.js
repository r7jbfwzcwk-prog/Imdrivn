const $=(s,r=document)=>r.querySelector(s),main=$('#main');
const aud=n=>'$'+Number(n).toLocaleString('en-AU'),kms=n=>Number(n).toLocaleString('en-AU')+' km';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mine=()=>ListingStore.list();
const all=()=>[...mine(),...DEMO];
const I={tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',up:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 16V8m-4 4 4-4 4 4"/>',
shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',gauge:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 15 4-5"/><path d="M6 13h1m10 0h1M12 8v1"/>',
lock:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11"/>',head:'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="5" rx="1"/><rect x="17" y="14" width="4" height="5" rx="1"/><path d="M19 19c0 1.5-2 2-5 2"/>'};
const ico=k=>`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const FALLBACK="this.onerror=null;this.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 16 10&quot;><rect width=&quot;16&quot; height=&quot;10&quot; fill=&quot;%231b1b1e&quot;/><text x=&quot;8&quot; y=&quot;5.6&quot; font-size=&quot;1&quot; fill=&quot;%23777&quot; text-anchor=&quot;middle&quot;>PHOTO</text></svg>')";

function home(){main.innerHTML=`
<section class="hero"><div class="wrap"><div class="eyebrow">IM DRIVN</div>
<h1>The high<br><span class="grey">performance</span><br>marketplace</h1><hr><p><em>Australia's premium marketplace for high performance cars.</em> Free to list. Always.</p></div></section>
<div class="wrap"><div class="paths">
<a class="path" href="#/buy">${ico('tag')}<span class="wide">IM BUYIN</span><span class="tag">Find your next machine.</span><span class="muted">Browse premium high performance cars available now.</span><span class="btn">Browse cars →</span></a>
<a class="path" href="#/sell">${ico('up')}<span class="wide">IM SELLIN</span><span class="tag">List with confidence.</span><span class="muted">List free, or get a wholesale offer from dealers.</span><span class="btn">Sell your car →</span></a></div></div>
<section class="wrap feats" id="how"><div class="eyebrow">Built for enthusiasts. Driven by performance.</div><div class="row4">
${[['shield','Verified vehicles','Every car is checked for quality and authenticity.'],['gauge','Serious buyers','Connect with genuine high performance buyers.'],['lock','Secure & safe','Safe transactions from start to finish.'],['head','Expert support','Real people, real support when you need it.']].map(f=>`<div class="feat">${ico(f[0])}<h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div></section>
<section class="wrap"><div class="eyebrow">Fresh in the feed</div><div class="feed" style="padding:0;margin-top:var(--s-4)">${all().filter(l=>l.sec===m2s(MODE)).slice(0,3).map(post).join('')}</div></section>
${about()}`;}
const about=()=>`<section class="about" id="about"><div class="img" role="img" aria-label="Taillight of a dark car"></div><div class="txt"><div class="eyebrow">About IM DRIVN</div>
<h2>More than a marketplace.<br>It's a community.</h2><p class="muted">IM DRIVN connects Australia's car community — from supercars to performance weapons to the daily drive. Buy. Sell. Drive. All in one place. Listing is 100% free.</p><a class="btn" href="#/how">Learn more</a></div><div class="water" aria-hidden="true">IM DRIVN</div></section>`;

const SV={heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',mark:'<path d="M6 3h12v18l-6-4-6 4z"/>',pin:'<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
check:'<circle cx="12" cy="12" r="9" class="fillc"/><path d="m8 12 3 3 5-6" stroke="#000"/>'};
const sv=(k,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${SV[k]}</svg>`;
const st=()=>JSON.parse(localStorage.getItem('imdrivn_social')||'{}');
function post(l){const S=st()[l.id]||{},lk=(l.likes||0)+(S.like?1:0),cm=(l.comments||0),title=l.heading||(l.year+' '+l.make+' '+l.model);
return`<article class="post s-${l.sec}"><a class="car" href="#/car/${l.id}"><img src="${esc(l.photos[0])}" alt="${esc(title)}" loading="lazy" onerror="${FALLBACK}">
<span class="new">NEW</span><span class="ago">${l.ago?l.ago+'h ago':'Just now'}</span>${l.demo?'<span class="dm">Demo</span>':''}</a>
<div class="b"><a href="#/car/${l.id}" class="ttl">${esc(title)}</a><div class="price">${aud(l.price)}</div>
<div class="row"><span class="loc">${sv('pin')}${esc(l.suburb)}, ${l.state}</span><span class="handle">${sv('pin','sm')}@${esc((l.handle||'you').replace(/^@/,''))}${sv('check','ck')}</span></div>
<div class="acts"><button data-act="like" data-id="${l.id}" aria-pressed="${!!S.like}" aria-label="Like">${sv('heart')}<span>${lk}</span></button>
<button data-act="cmt" data-id="${l.id}" aria-label="Comments">${sv('chat')}<span>${cm}</span></button>
<button class="bm" data-act="save" data-id="${l.id}" aria-pressed="${!!S.save}" aria-label="Save">${sv('mark')}</button></div>
</div></article>`;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b||b.closest('.ask-preview'))return;const s=st(),o=s[b.dataset.id]||(s[b.dataset.id]={});
if(b.dataset.act==='cmt'){location.hash='#/car/'+b.dataset.id;return}
const k=b.dataset.act;o[k]=!o[k];localStorage.setItem('imdrivn_social',JSON.stringify(s));b.setAttribute('aria-pressed',o[k]);
if(k==='like'){const n=b.querySelector('span');n.textContent=+n.textContent+(o[k]?1:-1)}});

/* ===== MODES (like a drive-mode selector) ===== */
const MODES=['daily','performance','supercar'],m2s=m=>m==='supercar'?'supercars':m;
let MODE=localStorage.getItem('imdrivn_mode');if(!MODES.includes(MODE))MODE='daily';
function setMode(m){MODE=m;localStorage.setItem('imdrivn_mode',m);document.body.dataset.mode=m;
document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.m===m));}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{setMode(b.dataset.m);if(location.hash.startsWith('#/buy')||location.hash.startsWith('#/saved'))route();});
setMode(MODE);
$('#sbtn').onclick=()=>{const p=$('#spanel');p.hidden=!p.hidden;$('#sbtn').setAttribute('aria-expanded',!p.hidden);if(!p.hidden)p.querySelector('input').focus()};
$('#bell').onclick=()=>alert('Notifications are coming soon (prototype).');

let F={make:'',model:'',year:'',km:''},io,SAVED=false;
$('#qs').onsubmit=e=>{e.preventDefault();Object.assign(F,Object.fromEntries(new FormData(e.target)));$('#spanel').hidden=true;location.hash==='#/buy'?route():location.hash='#/buy';};
$('#qs').onreset=()=>{F={make:'',model:'',year:'',km:''};setTimeout(()=>location.hash==='#/buy'?route():location.hash='#/buy')};
function buy(saved){SAVED=!!saved;const f=[F.make,F.model,F.year&&F.year+'+',F.km&&'≤'+F.km+' km'].filter(Boolean);
main.innerHTML=`${saved?'<h1 class="feed-title">Saved</h1>':''}${f.length?`<div class="filt">Search: ${esc(f.join(' · '))} <button onclick="$('#qs').reset()">Clear</button></div>`:''}<div class="feed" id="feed"></div><div class="loader" id="more">Loading more machines…</div>`;reset();}
const match=()=>all().filter(l=>l.sec===m2s(MODE)&&(!SAVED||(st()[l.id]||{}).save)&&(!F.make||l.make.toLowerCase().includes(F.make.toLowerCase()))&&(!F.model||l.model.toLowerCase().includes(F.model.toLowerCase()))&&(!F.year||l.year>=+F.year)&&(!F.km||l.km<=+F.km));
function reset(){$('#feed').innerHTML='';const m=match();if(!m.length){$('#feed').innerHTML=`<p class="muted">${SAVED?'Nothing saved in this mode yet. Tap the bookmark on a car.':'No machines match. Try fewer words.'}</p>`;$('#more').hidden=true;return}
$('#feed').innerHTML=m.map(post).join('');if(SAVED){$('#more').hidden=true;return}
io&&io.disconnect();io=new IntersectionObserver(e=>e[0].isIntersecting&&more(),{rootMargin:'600px'});io.observe($('#more'));}
// infinite feel: re-cycles the demo data shuffled (demo only)
function more(){const m=match();if(!m.length||!$('#feed'))return;$('#feed').insertAdjacentHTML('beforeend',[...m].sort(()=>Math.random()-.5).map(post).join(''));}

function car(id){const l=all().find(x=>x.id===id);if(!l){main.innerHTML='<div class="wrap"><h2>Listing not found</h2><a class="btn" href="#/buy">Back to feed</a></div>';return}
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

function list(){ListFlow.start(main,{async publish(d){
  const handle=(d.name||'you').trim().toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'')||'you';
  const saved=await ListingStore.create({sec:d.sec,make:d.make.trim(),model:d.model.trim(),year:+d.year,km:+d.km,price:+d.price,suburb:d.suburb.trim(),state:d.state,heading:d.heading.trim(),desc:d.desc.trim(),photos:d.photos.slice(),name:d.name.trim(),phone:d.phone.trim(),email:d.email.trim(),handle,likes:0,comments:0});
  setMode(saved.sec==='supercars'?'supercar':saved.sec);
  location.hash='#/car/'+saved.id;
}});}

function valuation(){const yn=(n,q)=>`<p style="margin:var(--s-4) 0 var(--s-2)">${q}</p><div class="choice c3"><label><input type="radio" name="${n}" value="yes" checked> Yes</label><label><input type="radio" name="${n}" value="no"> No</label><label><input type="radio" name="${n}" value="unsure"> Not sure</label></div>`;
wizard('Get a <span class="grey">wholesale</span> valuation',[['Vehicle details',vehicle()],['Condition',`<label>Overall condition<select name="cond"><option>Excellent</option><option>Good</option><option>Fair</option><option>Needs work</option></select></label>${yn('hist','Full service history?')}${yn('acc','Free of accident damage?')}${yn('fin','Paid off (no finance owing)?')}<label style="margin-top:var(--s-4)">Anything else dealers should know?<textarea name="notes" rows="3"></textarea></label>`],['Photos',photos()],['Contact',contact()]],(d)=>{
main.innerHTML=`<div class="wrap form"><div class="ok" role="status">${ico('shield')}<h1 style="font-size:1.4rem;margin-top:var(--s-4)">Valuation request in</h1><p>Thanks ${esc(d.name)}. Your ${esc(d.year+' '+d.make+' '+d.model)} has gone to our network of verified dealers in ${esc(d.state)}. Expect offers within 24 hours by SMS and email.</p><p class="meta">Prototype: nothing was really submitted.</p><a class="btn" href="#/">Back home</a></div></div>`;});}

function how(){main.innerHTML=`<section class="wrap feats"><div class="eyebrow">How it works</div><h1 style="font-size:clamp(1.3rem,4vw,2.2rem)">Simple. <span class="grey">Free.</span> Fast.</h1><div class="row4">
${[['tag','1. Snap & list','Photos, price, done. Listing is 100% free.'],['gauge','2. Hit the feed','Your ad lands in a scroll-first feed buyers love.'],['head','3. Chat direct','Buyers message you. No middleman.'],['up','4. Or go wholesale','Want it gone? Dealers make an offer.']].map(f=>`<div class="feat">${ico(f[0])}<h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div><a class="btn solid" href="#/sell" style="margin-top:var(--s-5)">Sell your car →</a></section>${about()}`;}
function join(){main.innerHTML=`<div class="wrap form"><h1 style="font-size:1.6rem">Join / Sign in</h1><form class="panel" onsubmit="event.preventDefault();this.innerHTML='<p>Accounts are coming soon — this is a prototype.</p>'"><label>Email<input type="email" required autocomplete="email"></label><button class="btn solid">Continue</button></form></div>`;}

function msgs(){main.innerHTML=`<div class="wrap form"><h1 style="font-size:1.4rem">Messages</h1><div class="panel"><p class="muted">No messages yet. When buyers or sellers message you, chats land here. (Prototype)</p><a class="btn" href="#/buy">Back to the feed</a></div></div>`}
function route(){document.body.classList.remove('menu-open');const [,p,a]=location.hash.slice(1).split('/');io&&io.disconnect();
({'':home,buy:()=>buy(),saved:()=>buy(1),msgs,car:()=>car(a),sell,list,valuation,how,about:()=>{home();$('#about').scrollIntoView()},join}[p||'']||home)();
if(p!=='about')scrollTo(0,0);main.focus({preventScroll:true});
document.querySelectorAll('.bnav a').forEach(x=>x.setAttribute('aria-current',x.dataset.r===(p||'')||(x.dataset.r==='buy'&&p==='car')?'page':'false'));}
addEventListener('hashchange',route);route();
