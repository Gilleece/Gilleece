(()=>{
'use strict';

/* ───────────────────────── helpers / env ───────────────────────── */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fine=matchMedia('(pointer:fine)').matches;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU=Math.PI*2;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const pad2=n=>String(n).padStart(2,'0');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const W={x:innerWidth,y:innerHeight};

/* ───────────────────────── element refs ───────────────────────── */
const nav=$('#menu'), links=$$('.menu-link');
const lens=$('#lens'), ring=$('#curRing'), dot=$('#curDot'), bgn=$('#bgnum');
const wipe=$('#wipe'), wRed=$('#wRed'), wInk=$('#wInk');
const wLab=$('#wLab'), wName=$('#wName'), wSub=$('#wSub');

/* ───────────────────────── state ───────────────────────── */
let hotLink=null, busyWipe=false;
let px=W.x/2, py=W.y*.42, lastMove=-1e9, now=0;
let gx=px, gy=py;                 // "ghost" attractor — cursor when active, wanderer when idle
let cdx=px, cdy=py, crx=px, cry=py;

/* ───────────────────────── audio (off until toggled) ───────────────────────── */
let AC=null, sndOn=false, lastTick=0;
function ac(){
  if(!AC){const C=window.AudioContext||window.webkitAudioContext; if(C)AC=new C;}
  if(AC&&AC.state==='suspended')AC.resume();
  return AC;
}
function tick(){
  if(!sndOn||!ac())return;
  const t=AC.currentTime; if(t-lastTick<.05)return; lastTick=t;
  const o=AC.createOscillator(),g=AC.createGain();
  o.type='square'; o.frequency.value=rand(1400,2400);
  g.gain.setValueAtTime(.035,t); g.gain.exponentialRampToValueAtTime(.0001,t+.06);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t+.07);
}
function thunk(){
  if(!sndOn||!ac())return;
  const t=AC.currentTime;
  const o=AC.createOscillator(),g=AC.createGain();
  o.type='square';
  o.frequency.setValueAtTime(150,t);
  o.frequency.exponentialRampToValueAtTime(46,t+.22);
  g.gain.setValueAtTime(.16,t); g.gain.exponentialRampToValueAtTime(.0001,t+.26);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t+.3);
  const o2=AC.createOscillator(),g2=AC.createGain();
  o2.type='sawtooth'; o2.frequency.value=rand(700,900);
  g2.gain.setValueAtTime(.05,t); g2.gain.exponentialRampToValueAtTime(.0001,t+.09);
  o2.connect(g2).connect(AC.destination); o2.start(t); o2.stop(t+.1);
}
$('#snd').addEventListener('click',e=>{
  sndOn=!sndOn;
  e.currentTarget.textContent=sndOn?'SND:ON':'SND:OFF';
  e.currentTarget.setAttribute('aria-pressed',String(sndOn));
  if(sndOn){ac();tick();}
});

/* ───────────────────────── particle field ───────────────────────── */
const cv=$('#fx'), ctx=cv.getContext('2d');
let DPR=1;
function sizeCanvas(){
  DPR=Math.min(devicePixelRatio||1,2);
  cv.width=W.x*DPR; cv.height=W.y*DPR;
  cv.style.width=W.x+'px'; cv.style.height=W.y+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
const P=[];   // ambient drifters
const SH=[];  // click shards
function newP(){
  const t=Math.random();
  return {x:rand(0,W.x),y:rand(0,W.y),vx:rand(-.25,.25),vy:rand(-.25,.25),
    s:rand(2,6.5),a:rand(0,TAU),va:rand(-.02,.02),
    kind: t<.74?'sq' : t<.86?'osq' : t<.95?'di' : 'pl'};
}
function seed(){
  P.length=0;
  if(RM)return;
  const n=Math.max(45,Math.min(130,Math.round(W.x*W.y/15000)));
  for(let i=0;i<n;i++)P.push(newP());
}
function burst(x,y,n=34){
  if(RM)return;
  for(let i=0;i<n;i++){
    const a=rand(0,TAU), sp=rand(3,11);
    SH.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,
      s:rand(4,14),w:rand(1.5,3),red:Math.random()<.45});
  }
}
function impulse(a){
  if(RM)return;
  const r=a.getBoundingClientRect(), X=r.left+r.width/2, Y=r.top+r.height/2;
  for(const p of P){
    const dx=p.x-X, dy=p.y-Y, d=Math.hypot(dx,dy)||1;
    if(d<260){const f=(1-d/260)*5; p.vx+=dx/d*f; p.vy+=dy/d*f;}
  }
}
function drawParticles(){
  ctx.clearRect(0,0,W.x,W.y);
  const ink='#0b0b0d';
  for(const p of P){
    const dx=p.x-gx, dy=p.y-gy, d=Math.hypot(dx,dy)||1;
    if(d<130){           // hard repulsion at the core
      const f=(1-d/130)*.9; p.vx+=dx/d*f; p.vy+=dy/d*f;
    }else if(d<380){     // slow orbital pull further out
      const f=(1-d/380)*.05;
      p.vx+=-dy/d*f - dx/d*f*.35;
      p.vy+= dx/d*f - dy/d*f*.35;
    }
    p.vx*=.985; p.vy*=.985; p.x+=p.vx; p.y+=p.vy; p.a+=p.va;
    if(p.x<-20)p.x=W.x+20; if(p.x>W.x+20)p.x=-20;
    if(p.y<-20)p.y=W.y+20; if(p.y>W.y+20)p.y=-20;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a);
    if(p.kind==='sq'){ctx.globalAlpha=.8;ctx.fillStyle=ink;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s);}
    else if(p.kind==='osq'){ctx.globalAlpha=.7;ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.strokeRect(-p.s/2,-p.s/2,p.s,p.s);}
    else if(p.kind==='di'){ctx.globalAlpha=.9;ctx.fillStyle='#39ff14';ctx.rotate(Math.PI/4);ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s);}
    else {ctx.globalAlpha=.6;ctx.strokeStyle=ink;ctx.lineWidth=1.4;ctx.beginPath();
      ctx.moveTo(-p.s/1.4,0);ctx.lineTo(p.s/1.4,0);ctx.moveTo(0,-p.s/1.4);ctx.lineTo(0,p.s/1.4);ctx.stroke();}
    ctx.restore();
  }
  for(let i=SH.length-1;i>=0;i--){
    const s=SH[i]; s.life-=.024;
    if(s.life<=0){SH.splice(i,1);continue;}
    s.x+=s.vx; s.y+=s.vy; s.vx*=.92; s.vy*=.92;
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.atan2(s.vy,s.vx));
    ctx.globalAlpha=Math.min(1,s.life*1.4);
    ctx.fillStyle=s.red?'#ff0030':ink;
    ctx.fillRect(0,-s.w/2,s.s+s.life*10,s.w);
    ctx.restore();
  }
  ctx.globalAlpha=1;
}

/* ───────────────────────── star wipe ───────────────────────── */
const EXPO='cubic-bezier(.85,0,.16,1)', POP='cubic-bezier(.3,1.5,.5,1)';
function starPath(cxp,cyp,jit,R){
  const n=jit.length, pts=[];
  for(let i=0;i<n;i++){
    const ang=-Math.PI/2 + i*TAU/n + (i%2?.06:-.04);
    pts.push((cxp+Math.cos(ang)*R*jit[i]).toFixed(1)+'px '+(cyp+Math.sin(ang)*R*jit[i]).toFixed(1)+'px');
  }
  return 'polygon('+pts.join(',')+')';
}
// shrink the wipe title so a long unbreakable word fits the width on one line
function fitName(){
  wName.style.fontSize='';                       // reset to the CSS-defined size
  const cs=getComputedStyle(wLab);
  const avail=wLab.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  const w=wName.scrollWidth;
  if(w>avail){
    const cur=parseFloat(getComputedStyle(wName).fontSize);
    wName.style.fontSize=(cur*avail/w*.92)+'px'; // .92 leaves room for the skew/rotate
  }
}
async function launchWipe(x,y,label,num,href){
  if(busyWipe)return; busyWipe=true;
  if(hotLink){hotLink.classList.remove('hot');nav.classList.remove('has-hot');hotLink=null;}
  ring.classList.remove('lock');
  thunk(); burst(x,y,38);
  const real=href && href!=='#' && href!=='';
  wName.textContent=label.toUpperCase();
  wSub.textContent='NODE '+num+' /// '+(real?'ESTABLISHING LINK':'LINK OK — NODE PENDING');

  if(RM){ // calm fallback: plain fade
    wRed.style.display='none'; wInk.style.clipPath='none';
    wipe.style.display='block';
    fitName();
    const f=wInk.animate({opacity:[0,1]},{duration:160,fill:'forwards'});
    const l=wLab.animate({opacity:[0,1]},{duration:160,fill:'forwards'});
    await f.finished;
    if(real){await wait(2000);location.href=href;return;}
    await wait(900);
    await wInk.animate({opacity:[1,0]},{duration:200,fill:'forwards'}).finished;
    f.cancel(); l.cancel();
    wipe.style.display='none'; wRed.style.display='';
    busyWipe=false; return;
  }

  document.body.animate(
    [{transform:'translate(0,0)'},{transform:'translate(4px,-3px)'},
     {transform:'translate(-4px,3px)'},{transform:'translate(2px,2px)'},
     {transform:'translate(0,0)'}],
    {duration:200,easing:'linear'});

  const n=26, jit=[];
  for(let i=0;i<n;i++)jit.push(i%2?rand(.4,.62):rand(.85,1.12));
  const R=Math.hypot(Math.max(x,W.x-x),Math.max(y,W.y-y))*2.6;
  const pS=starPath(x,y,jit,12), pB=starPath(x,y,jit,R);
  wRed.style.clipPath=pS; wInk.style.clipPath=pS;
  wipe.style.display='block';
  fitName();

  const anims=[];
  anims.push(wRed.animate({clipPath:[pS,pB]},{duration:460,easing:EXPO,fill:'forwards'}));
  const k=wInk.animate({clipPath:[pS,pB]},{duration:460,delay:80,easing:EXPO,fill:'forwards'});
  anims.push(k);
  anims.push(wLab.animate([{opacity:0},{opacity:1}],{duration:120,delay:380,fill:'forwards'}));
  anims.push(wName.animate(
    [{transform:'skewX(-8deg) rotate(-3.5deg) scale(1.45)',letterSpacing:'.3em'},
     {transform:'skewX(-8deg) rotate(-3.5deg) scale(1)',letterSpacing:'.005em'}],
    {duration:420,delay:380,easing:POP,fill:'both'}));
  await k.finished;

  if(real){await wait(2000); location.href=href; busyWipe=false; return;}

  await wait(1000);
  anims.push(wLab.animate({opacity:[1,0]},{duration:140,fill:'forwards'}));
  anims.push(wInk.animate({clipPath:[pB,pS]},{duration:430,easing:EXPO,fill:'forwards'}));
  anims.push(wRed.animate({clipPath:[pB,pS]},{duration:430,delay:90,easing:EXPO,fill:'forwards'}));
  await wait(560);
  anims.forEach(a=>{try{a.cancel()}catch(_){}});
  wipe.style.display='none';
  busyWipe=false;
  burst(x,y,16);
}

/* ───────────────────────── build the menu ───────────────────────── */
document.documentElement.style.setProperty('--link-count',links.length);
bgn.textContent=pad2(links.length);
$('#hudl').textContent='SYS//LINK.INDEX_v'+links.length+'.0';

const letterData=[];
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
links.forEach((a,i)=>{
  const label=a.textContent.trim();
  a.dataset.label=label;
  a.draggable=false;
  const word=label.toUpperCase().split('').map((ch,j)=>
    '<span class="lt" style="--i:'+j+'"><span class="lt-in">'+(ch===' '?'&nbsp;':esc(ch))+'</span></span>'
  ).join('');
  a.innerHTML='<span class="band"></span><span class="num">'+pad2(i+1)+'</span>'
    +'<span class="word">'+word+'</span>'
    +'<span class="ghost g1" aria-hidden="true">'+esc(label.toUpperCase())+'</span>'
    +'<span class="ghost g2" aria-hidden="true">'+esc(label.toUpperCase())+'</span>';

  const hotOn=()=>{
    if(busyWipe)return;
    hotLink=a; a.classList.add('hot'); nav.classList.add('has-hot');
    links.forEach(s=>{if(s!==a)s.style.setProperty('--sx',rand(-18,18).toFixed(1)+'px');});
    ring.classList.add('lock');
    impulse(a); tick();
  };
  const hotOff=()=>{
    hotLink=null; a.classList.remove('hot'); nav.classList.remove('has-hot');
    ring.classList.remove('lock');
  };
  if(fine){
    a.addEventListener('pointerenter',hotOn);
    a.addEventListener('pointerleave',hotOff);
  }
  a.addEventListener('focus',hotOn);
  a.addEventListener('blur',hotOff);
  a.addEventListener('click',e=>{
    e.preventDefault();
    const r=a.getBoundingClientRect();
    const x=e.clientX||r.left+r.width/2, y=e.clientY||r.top+r.height/2;
    launchWipe(x,y,label,pad2(i+1),a.getAttribute('href')||'#');
  });
});

function measure(){
  letterData.length=0;
  links.forEach(a=>{
    const r=a.getBoundingClientRect();
    a.querySelectorAll('.lt').forEach(el=>{
      letterData.push({el,link:a,
        bx:r.left+el.offsetLeft+el.offsetWidth/2,
        by:r.top +el.offsetTop +el.offsetHeight/2,
        x:0,y:0,r:0,w:800,wl:0,ph:rand(0,TAU)});
    });
  });
}

/* ───────────────────────── pointer / ghost ───────────────────────── */
addEventListener('pointermove',e=>{px=e.clientX;py=e.clientY;lastMove=now;},{passive:true});
addEventListener('pointerdown',e=>{
  px=e.clientX;py=e.clientY;lastMove=now;
  if(!e.target.closest('.menu-link,#snd')){burst(px,py,12);tick();}
},{passive:true});

/* ───────────────────────── main loop ───────────────────────── */
function step(t){
  now=t;
  const wander = lastMove<0 || (now-lastMove > (fine?2400:1300));
  let tx,ty;
  if(wander){ // autonomous drift — keeps the page alive on mobile & idle desktops
    tx=W.x*(.5 +.34*Math.sin(t*.00031)+.13*Math.sin(t*.00057+2.1));
    ty=W.y*(.46+.27*Math.sin(t*.00041+1.2)+.12*Math.sin(t*.00067+4));
  }else{tx=px;ty=py;}
  gx=lerp(gx,tx,wander?.035:.2);
  gy=lerp(gy,ty,wander?.035:.2);

  lens.style.transform='translate('+gx+'px,'+gy+'px) translate(-50%,-50%)';
  bgn.style.transform='translate('+((gx-W.x/2)*-.028)+'px,'+((gy-W.y/2)*-.028)+'px)';

  if(fine){
    cdx=lerp(cdx,px,.55); cdy=lerp(cdy,py,.55);
    crx=lerp(crx,px,.22); cry=lerp(cry,py,.22);
    dot.style.transform='translate('+cdx+'px,'+cdy+'px) translate(-50%,-50%)';
    ring.style.transform='translate('+crx+'px,'+cry+'px) translate(-50%,-50%) rotate('+(t*.04%360)+'deg)';
  }

  const R=fine?180:150;
  for(const L of letterData){
    const hot=L.link===hotLink;
    let txp=0,typ=0,rt=0,wgt=800;
    const dx=L.bx-gx, dy=L.by-gy, d=Math.hypot(dx,dy)||1;
    if(d<R){
      const f=1-d/R, fe=f*f, k=hot?9:26;
      txp=dx/d*fe*k; typ=dy/d*fe*k;
      rt=hot?0:fe*8*Math.sign(dx||1);
      wgt=800+f*100;
    }
    txp+=Math.sin(t*.0011+L.ph)*1.1;
    typ+=Math.cos(t*.0009+L.ph)*1.1;
    L.x=lerp(L.x,txp,.14); L.y=lerp(L.y,typ,.14); L.r=lerp(L.r,rt,.14);
    L.el.style.transform='translate('+L.x.toFixed(2)+'px,'+L.y.toFixed(2)+'px) rotate('+L.r.toFixed(2)+'deg)';
    if(!hot){
      L.w=lerp(L.w,wgt,.12);
      const wr=Math.round(L.w/4)*4;
      if(wr!==L.wl){L.wl=wr;L.el.style.fontVariationSettings="'wght' "+wr;}
    }
  }

  drawParticles();
  requestAnimationFrame(step);
}

/* ───────────────────────── furniture ───────────────────────── */
const msg=' WELCOME TO THE INDEX /// SELECT A NODE /// SIGNAL:STRONG /// REALITY:OPTIONAL /// ALL SYSTEMS NOMINAL ///';
$('#tin').innerHTML=msg.split('///').join('<b>///</b>').repeat(3);

const clk=$('#clock');
function clockTick(){
  const d=new Date();
  clk.textContent=[d.getHours(),d.getMinutes(),d.getSeconds()].map(pad2).join(':');
}
clockTick(); setInterval(clockTick,1000);

if(!RM){
  (function autoGlitch(){
    setTimeout(()=>{
      const c=links[Math.floor(Math.random()*links.length)];
      if(c!==hotLink&&!busyWipe){
        c.classList.add('auto-glitch');
        setTimeout(()=>c.classList.remove('auto-glitch'),700);
      }
      autoGlitch();
    },rand(2600,6200));
  })();
}

/* ───────────────────────── bfcache restore ─────────────────────────
   When the user navigates back, the browser may restore this page from
   its back/forward cache frozen on the final wipe frame. Reset the
   overlay + interaction state so it looks like a fresh entry again. */
addEventListener('pageshow',e=>{
  if(!e.persisted)return;
  busyWipe=false;
  wipe.style.display='none'; wRed.style.display='';
  wRed.style.clipPath=''; wInk.style.clipPath=''; wInk.style.display='';
  wLab.style.opacity='';
  if(hotLink)hotLink.classList.remove('hot');
  hotLink=null; nav.classList.remove('has-hot');
  ring.classList.remove('lock');
});

/* ───────────────────────── init / resize ───────────────────────── */
let rzT=0;
addEventListener('resize',()=>{
  clearTimeout(rzT);
  rzT=setTimeout(()=>{W.x=innerWidth;W.y=innerHeight;sizeCanvas();seed();measure();},150);
});

sizeCanvas(); seed(); measure();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(measure);
if(!RM)requestAnimationFrame(step);

})();
