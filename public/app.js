(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICON={
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  head:'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  cam:'<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10l5-3v10l-5-3"/>'
};
const ico=(n,off)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[n]+(off?'<path d="M4 4l16 16"/>':'')+'</svg>';
function btnUI(sel,live,ic,noun,rec){
  const b=$(sel);b.innerHTML=ico(ic,!live)+(live?'ปิด':'เปิด')+noun;b.classList.toggle('rec',!!rec);
}
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- เก็บข้อมูลในเครื่อง ---------- */
const mem={};
const store={
  get(k,d){try{const v=localStorage.getItem(k);if(v!==null)return JSON.parse(v)}catch(e){} return k in mem?mem[k]:d},
  set(k,v){mem[k]=v;try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},
  del(k){delete mem[k];try{localStorage.removeItem(k)}catch(e){}}
};

/* ---------- ข้อมูลตัวอย่าง ---------- */
const PAL={
  skin:['#f6d6b8','#e9bd96','#d09a6e','#a86f48','#6f4429'],
  shirt:['#2f8f4e','#7bc47f','#1f5c3a','#c9e4a0','#3b7f86','#e8e2c8'],
  hair:['#2b1d16','#5a3a25','#a0702f','#d9b66b','#8a8f94','#3c6a4a']
};
const HATS=[['none','ไม่มี'],['beanie','บีนนี่'],['sprout','ต้นกล้า'],['phones','หูฟัง']];
const cid=(()=>{let v=store.get('qs.cid','');if(!v){v='c'+Math.random().toString(36).slice(2)+Date.now().toString(36);store.set('qs.cid',v)}return v})();
const DEFAULT={name:'ผู้มาใหม่',skin:PAL.skin[0],shirt:PAL.shirt[0],hair:PAL.hair[0],hat:'none',glasses:false};
let profile=Object.assign({},DEFAULT,store.get('qs.profile',{}));
const cfgOf=p=>({skin:p.skin,shirt:p.shirt,hair:p.hair,hat:p.hat,glasses:!!p.glasses});
let rooms=[],currentRoom=null,roomMembers=[],chatLog=[],myPeerId='',lastSig='';
let delArm=null,delT=0;
const net={ws:null,ok:false,tries:0,beat:0};
const send=o=>{if(net.ws&&net.ws.readyState===1){net.ws.send(JSON.stringify(o));return true}return false};
function deleteRoom(id){
  if(!send({t:'delete',room:id})){toast('ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์');return}
  delArm=null;clearTimeout(delT);toast('กำลังลบห้อง…');
}

/* ---------- ตัวละคร 3D ---------- */
function makeAvatar(c){
  const g=new THREE.Group();
  const M=col=>new THREE.MeshLambertMaterial({color:col});
  const add=(geo,col,x,y,z,parent)=>{const m=new THREE.Mesh(geo,M(col));m.position.set(x,y,z);(parent||g).add(m);return m};
  add(new THREE.CylinderGeometry(.4,.48,.95,20),c.shirt,0,1.0,0);
  add(new THREE.CylinderGeometry(.15,.15,.55,12),0x2f4a3c,-.2,.275,0);
  add(new THREE.CylinderGeometry(.15,.15,.55,12),0x2f4a3c,.2,.275,0);
  const aL=add(new THREE.CylinderGeometry(.11,.11,.7,10),c.shirt,-.57,1.05,0);aL.rotation.z=.18;
  const aR=add(new THREE.CylinderGeometry(.11,.11,.7,10),c.shirt,.57,1.05,0);aR.rotation.z=-.18;
  add(new THREE.SphereGeometry(.11,12,10),c.skin,-.65,.66,0);
  add(new THREE.SphereGeometry(.11,12,10),c.skin,.65,.66,0);
  const head=new THREE.Group();head.position.set(0,1.92,0);g.add(head);
  add(new THREE.SphereGeometry(.42,28,20),c.skin,0,0,0,head);
  const eyes=new THREE.Group();head.add(eyes);
  add(new THREE.SphereGeometry(.055,10,8),0x1b1b1b,-.15,.05,.37,eyes);
  add(new THREE.SphereGeometry(.055,10,8),0x1b1b1b,.15,.05,.37,eyes);
  const sm=add(new THREE.TorusGeometry(.09,.014,6,14,Math.PI),0x7a3b2e,0,-.11,.39,head);sm.rotation.z=Math.PI;
  const hair=add(new THREE.SphereGeometry(.45,24,16,0,Math.PI*2,0,Math.PI*.58),c.hair,0,.03,-.02,head);hair.rotation.x=-.35;
  if(c.hat==='beanie'){
    add(new THREE.SphereGeometry(.48,24,14,0,Math.PI*2,0,Math.PI*.5),0x2f6b46,0,.1,0,head);
    add(new THREE.SphereGeometry(.09,12,10),0xe8e2c8,0,.6,0,head);
  }else if(c.hat==='sprout'){
    add(new THREE.CylinderGeometry(.02,.025,.3,8),0x3f9b57,0,.55,0,head);
    [-1,1].forEach(s=>{const l=add(new THREE.SphereGeometry(.15,12,8),0x7bc47f,s*.14,.72,0,head);l.scale.set(1,.35,.6);l.rotation.z=s*.5});
  }else if(c.hat==='phones'){
    add(new THREE.TorusGeometry(.46,.04,8,28,Math.PI),0x24342b,0,0,0,head);
    [-1,1].forEach(s=>{const e=add(new THREE.CylinderGeometry(.12,.12,.1,16),0x2a8a4a,s*.46,0,0,head);e.rotation.z=Math.PI/2});
  }
  if(c.glasses){
    [-1,1].forEach(s=>add(new THREE.TorusGeometry(.1,.012,8,22),0x1d2b22,s*.17,.07,.4,head));
    add(new THREE.CylinderGeometry(.01,.01,.08,6),0x1d2b22,0,.07,.4,head).rotation.z=Math.PI/2;
  }
  g.userData={head,eyes};
  return g;
}
function disposeTree(o){o.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material)n.material.dispose()})}

/* ---------- พื้นหลังห้อง ---------- */
const BG_PRESETS=[
  ['default','ค่าเริ่มต้น',''],
  ['forest','ป่าเขียว','linear-gradient(160deg,#1f5c3a,#0f2a1e)'],
  ['mist','หมอกเช้า','linear-gradient(180deg,#e4f3e6,#a9d6b4)'],
  ['night','ค่ำคืน','linear-gradient(180deg,#0b1f1a,#14403a 60%,#1c5a4a)'],
  ['lake','ทะเลสาบ','linear-gradient(180deg,#bfe8e3,#6fb9b0 55%,#3d8b78)'],
  ['sunrise','รุ่งอรุณ','linear-gradient(180deg,#f3f1c8,#bfe3b0 55%,#6fb683)']
];
const BG_DEFAULT={preset:'default',dim:0,blur:0,image:false};
let bgState=Object.assign({},BG_DEFAULT,store.get('qs.bg',{}));
let bgImage=store.get('qs.bgimg','');
if(!bgImage)bgState.image=false;
const stages=[];
const saveBg=()=>store.set('qs.bg',bgState);
function bgCss(){
  if(bgState.image&&bgImage)return 'url("'+bgImage+'")';
  const p=BG_PRESETS.find(x=>x[0]===bgState.preset);return p?p[2]:'';
}
function applyBg(){
  const css=bgCss();
  stages.forEach(st=>{
    st.bgl.style.backgroundImage=css||'none';
    st.bgl.style.filter=bgState.blur?'blur('+bgState.blur+'px)':'none';
    st.bgd.style.opacity=String(bgState.dim/100);
  });
}

class Stage{
  constructor(host,mode){
    this.host=host;this.mode=mode;this.items=[];this.yaw=0;this.running=false;this.lastSig='';
    this.canvas=document.createElement('canvas');host.prepend(this.canvas);
    this.bgd=document.createElement('div');this.bgd.className='bgd';host.prepend(this.bgd);
    this.bgl=document.createElement('div');this.bgl.className='bgl';host.prepend(this.bgl);
    stages.push(this);applyBg();
    this.labels=document.createElement('div');this.labels.className='labels';host.append(this.labels);
    try{this.r=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true})}
    catch(e){this.failed=true;host.insertAdjacentHTML('beforeend','<p class="nogl">อุปกรณ์หรือเบราว์เซอร์นี้แสดงภาพ 3D ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari รุ่นใหม่</p>');return}
    this.r.setPixelRatio(Math.min(devicePixelRatio||1,2));
    this.scene=new THREE.Scene();
    this.cam=new THREE.PerspectiveCamera(40,1,.1,60);
    this.scene.add(new THREE.HemisphereLight(0xeaffea,0x2c5a3a,.62));
    const dl=new THREE.DirectionalLight(0xffffff,.45);dl.position.set(3,6,5);this.scene.add(dl);
    const room=mode==='room';
    const floor=new THREE.Mesh(new THREE.CircleGeometry(room?5.2:2.1,56),new THREE.MeshLambertMaterial({color:0x4a9a68}));
    floor.rotation.x=-Math.PI/2;this.scene.add(floor);
    const ring=new THREE.Mesh(new THREE.RingGeometry(room?4.6:1.7,room?4.8:1.8,56),new THREE.MeshBasicMaterial({color:0xbfe6c6}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.01;this.scene.add(ring);
    if(room){
      const pot=new THREE.Mesh(new THREE.CylinderGeometry(.34,.26,.4,18),new THREE.MeshLambertMaterial({color:0xb08a62}));
      pot.position.set(0,.2,-.2);this.scene.add(pot);
      [[0,.8,0,.3],[-.2,.62,.05,.22],[.2,.64,-.05,.22]].forEach(([x,y,z,r])=>{
        const l=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),new THREE.MeshLambertMaterial({color:0x3f9b57}));
        l.position.set(x,y,z-.2);l.scale.y=1.3;this.scene.add(l)});
      this.cam.position.set(0,3.4,7.8);this.cam.lookAt(0,1.1,-1.6);
    }else{
      this.cam.position.set(0,1.8,6.4);this.cam.lookAt(0,1.45,0);
    }
    this.people=new THREE.Group();this.scene.add(this.people);
    new ResizeObserver(()=>this.resize()).observe(host);
    if(mode==='studio'){
      let down=false,lx=0;
      this.canvas.addEventListener('pointerdown',e=>{down=true;lx=e.clientX;this.canvas.setPointerCapture(e.pointerId)});
      this.canvas.addEventListener('pointermove',e=>{if(down){this.yaw+=(e.clientX-lx)*.012;lx=e.clientX}});
      const up=()=>{down=false};
      this.canvas.addEventListener('pointerup',up);this.canvas.addEventListener('pointercancel',up);
    }
    this.resize();
  }
  resize(){
    if(this.failed)return;
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    this.w=w;this.h=h;this.r.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix();
  }
  setPeople(list){
    if(this.failed)return;
    this.items.forEach(it=>{this.people.remove(it.g);disposeTree(it.g);it.label.remove()});
    this.items=[];
    const n=list.length;
    list.forEach((p,i)=>{
      const g=makeAvatar(p.cfg);
      if(this.mode==='room'){
        const row=i>=7?1:0, inRow=row?n-7:Math.min(n,7), k=row?i-7:i;
        const rad=3.1+row*1.2;
        const span=inRow>1?Math.min(130,40+inRow*18):0;
        const th=(180-span/2+(inRow>1?span*k/(inRow-1):span/2))*Math.PI/180;
        g.position.set(Math.sin(th)*rad,0,Math.cos(th)*rad);
        g.rotation.y=th+Math.PI;
      }
      this.people.add(g);
      const label=document.createElement('div');label.className='lbl'+(p.me?' me':'');
      label.textContent=p.name+(p.me?' (คุณ)':'');this.labels.append(label);
      this.items.push({g,head:g.userData.head,eyes:g.userData.eyes,label,seed:i*1.7});
    });
  }
  start(){
    if(this.failed||this.running)return;
    this.running=true;this.t0=performance.now();this.resize();
    const loop=()=>{
      if(!this.running)return;
      requestAnimationFrame(loop);
      const t=(performance.now()-this.t0)/1000;
      if(this.mode==='studio'){ if(!reduceMotion)this.yaw+=.003; this.people.rotation.y=this.yaw; }
      const v=new THREE.Vector3();
      this.items.forEach(it=>{
        if(!reduceMotion){
          it.g.position.y=Math.sin(t*1.3+it.seed)*.025;
          it.head.rotation.y=Math.sin(t*.55+it.seed)*.22;
          it.head.rotation.x=Math.sin(t*.8+it.seed)*.04;
        }
        it.eyes.scale.y=((t*.7+it.seed)%4)<.12?.12:1;
        it.g.getWorldPosition(v);v.y+=2.95;v.project(this.cam);
        const x=(v.x*.5+.5)*this.w,y=(-v.y*.5+.5)*this.h;
        it.label.style.transform='translate('+x+'px,'+y+'px) translate(-50%,-100%)';
      });
      this.r.render(this.scene,this.cam);
    };
    loop();
  }
  stop(){this.running=false}
}

/* ---------- สลับหน้า ---------- */
let studioStage=null, roomStage=null;
function show(name){
  ['lobby','studio','room'].forEach(v=>{$('#v-'+v).hidden=v!==name});
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('on',b.dataset.go===name));
  if(studioStage&&name!=='studio')studioStage.stop();
  if(roomStage&&name!=='room')roomStage.stop();
  if(name==='lobby')renderLobby();
  if(name==='studio')openStudio();
  window.scrollTo(0,0);
}
document.addEventListener('click',e=>{
  const go=e.target.closest('[data-go]');
  if(go){ if(currentRoom&&go.dataset.go!=='room')leaveRoom(true); show(go.dataset.go); }
});

function toast(msg){
  const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.id);toast.id=setTimeout(()=>{t.hidden=true},2800);
}

/* ---------- ล็อบบี้ ---------- */
function renderLobby(){
  const el=$('#roomList');
  if(!rooms.length){
    el.innerHTML='<p class="empty">'+(location.protocol==='file:'?'เปิดไฟล์นี้ตรงๆ ไม่ได้ ต้องเปิดผ่านเว็บที่ติดตั้งระบบหลังบ้านแล้ว (ดูวิธีในไฟล์ README)':net.ok?'ยังไม่มีห้องเลย สร้างห้องแรกได้จากแบบฟอร์มทางขวา':'กำลังเชื่อมต่อเซิร์ฟเวอร์…')+'</p>';
    return;
  }
  el.innerHTML=rooms.map(r=>{
    const full=r.count>=r.cap;
    return '<article class="room"><div class="rtop"><h3>'+esc(r.name)+'</h3><span class="chip">'+esc(r.mood)+'</span></div>'
      +'<p class="muted">'+esc(r.desc||'ห้องนี้ไม่มีกติกาพิเศษ')+'</p>'
      +'<div class="rbot"><span class="dots">'+r.dots.map(c=>'<i style="background:'+esc(c)+'"></i>').join('')+'</span>'
      +'<span class="cnt">'+r.count+'/'+r.cap+' คน</span>'
      +'<button class="btn sm" data-enter="'+esc(r.id)+'"'+(full?' disabled':'')+'>'+(full?'เต็ม':'เข้าห้อง')+'</button>'
      +(r.canDelete?'<button class="btn sm '+(delArm===r.id?'danger':'ghost')+'" data-del="'+esc(r.id)+'" aria-label="ลบห้อง '+esc(r.name)+'">'+(delArm===r.id?'ยืนยันลบ?':'ลบ')+'</button>':'')
      +'</div></article>';
  }).join('');
}
function joinRoom(id){ if(!send({t:'join',room:id}))toast('ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ ลองใหม่อีกครั้ง'); }
$('#roomList').addEventListener('click',e=>{
  const d=e.target.closest('[data-del]');
  if(d){
    const id=d.dataset.del;
    if(delArm===id){deleteRoom(id)}
    else{delArm=id;renderLobby();clearTimeout(delT);delT=setTimeout(()=>{delArm=null;renderLobby()},4000)}
    return;
  }
  const b=e.target.closest('[data-enter]');if(!b)return;
  joinRoom(b.dataset.enter);
});
$('#goCreate').addEventListener('click',()=>{$('#cName').focus();$('#createForm').scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'center'})});
$('#createForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=$('#cName').value.trim();if(!name)return;
  if(!send({t:'create',name,desc:$('#cDesc').value.trim(),mood:$('#cMood').value,cap:+$('#cCap').value})){toast('ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ ลองใหม่อีกครั้ง');return}
  e.target.reset();
});

/* ---------- สตูดิโออวตาร ---------- */
let draft=null;
function swatches(el,key,list){
  el.innerHTML=list.map(c=>'<button type="button" role="radio" aria-checked="'+(draft[key]===c)+'" aria-label="'+c+'" data-v="'+c+'" style="background:'+c+'"></button>').join('');
}
function segs(el,key,list){
  el.innerHTML=list.map(([v,l])=>'<button type="button" role="radio" aria-checked="'+(String(draft[key])===String(v))+'" data-v="'+v+'">'+l+'</button>').join('');
}
function paintStudio(){
  swatches($('#swSkin'),'skin',PAL.skin);swatches($('#swShirt'),'shirt',PAL.shirt);swatches($('#swHair'),'hair',PAL.hair);
  segs($('#segHat'),'hat',HATS);segs($('#segGlasses'),'glasses',[[false,'ไม่ใส่'],[true,'ใส่แว่น']]);
  studioStage.setPeople([{name:draft.name||'ฉัน',cfg:draft,me:true}]);
}
function openStudio(){
  draft=Object.assign({},profile);
  if(!studioStage)studioStage=new Stage($('#studioStage'),'studio');
  $('#pName').value=draft.name;
  paintStudio();studioStage.start();
}
[['#swSkin','skin'],['#swShirt','shirt'],['#swHair','hair'],['#segHat','hat'],['#segGlasses','glasses']].forEach(([sel,key])=>{
  $(sel).addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    draft[key]=key==='glasses'?b.dataset.v==='true':b.dataset.v;paintStudio();
  });
});
$('#pName').addEventListener('input',e=>{draft.name=e.target.value;studioStage.setPeople([{name:draft.name||'ฉัน',cfg:draft,me:true}])});
$('#saveAvatar').addEventListener('click',()=>{
  draft.name=($('#pName').value||'').trim()||DEFAULT.name;
  profile=Object.assign({},draft);store.set('qs.profile',profile);send({t:'profile',name:profile.name,cfg:cfgOf(profile)});toast('บันทึกอวตารแล้ว');
});

/* ---------- ห้อง ---------- */
function allMembers(){
  return roomMembers.map(p=>Object.assign({},p)).concat([{id:myPeerId||'me',name:profile.name,cfg:cfgOf(profile),me:true,cam:!!stream,mic:!!micStream}]);
}
function paintRoomHead(){
  if(!currentRoom)return;
  $('#rName').textContent=currentRoom.name;
  $('#rDesc').textContent=(currentRoom.desc?currentRoom.desc+' · ':'')+currentRoom.mood;
  $('#delRoom').hidden=!currentRoom.canDelete;
}
function renderMembers(){
  if(!currentRoom)return;
  $('#members').innerHTML=allMembers().map(m=>'<li><i style="background:'+esc(m.cfg.shirt)+'"></i><span class="mn">'+esc(m.name)+(m.me?' <span class="muted">(คุณ)</span>':'')+'</span>'
    +'<span class="st'+(m.cam?' on':'')+'">กล้อง</span><span class="st'+(m.mic?' on':'')+'">ไมค์</span></li>').join('');
}
function refreshRoom(force){
  if(!currentRoom||!roomStage)return;
  const ms=allMembers();
  const sig=JSON.stringify(ms.map(m=>[m.id,m.name,m.cfg]));
  if(force||sig!==lastSig){lastSig=sig;roomStage.setPeople(ms)}
  renderMembers();
}
function enterRoomUI(){
  const again=!$('#v-room').hidden;
  if(!again)show('room');
  if(!roomStage)roomStage=new Stage($('#roomStage'),'room');
  paintRoomHead();lastSig='';refreshRoom(true);renderChat();roomStage.start();
  if(!again){
    stopTimer();delArm=null;
    const b=$('#delRoom');b.textContent='ลบห้องนี้';b.classList.remove('danger');b.classList.add('ghost');
  }
  closeAllPeers();
  roomMembers.forEach(p=>callPeer(p.id));
  sendState();
}
function leaveRoom(skipShow){
  stopCam();stopMic();stopTimer();stopAllSnd();if(deaf)setDeaf(false);
  closeAllPeers();send({t:'leave'});
  currentRoom=null;roomMembers=[];chatLog=[];lastSig='';
  if(!skipShow)show('lobby');
}
$('#leave').addEventListener('click',()=>leaveRoom());
$('#delRoom').addEventListener('click',()=>{
  if(!currentRoom)return;
  const b=$('#delRoom');
  if(delArm===currentRoom.id){b.textContent='ลบห้องนี้';deleteRoom(currentRoom.id)}
  else{delArm=currentRoom.id;b.textContent='ยืนยันลบห้องนี้?';b.classList.add('danger');b.classList.remove('ghost');clearTimeout(delT);
    delT=setTimeout(()=>{delArm=null;b.textContent='ลบห้องนี้';b.classList.remove('danger');b.classList.add('ghost')},4000)}
});

/* แชต */
function renderChat(){
  if(!currentRoom)return;
  const box=$('#chat');
  box.innerHTML=chatLog.length?chatLog.map(m=>'<div class="msg"><b>'+esc(m.name)+'</b>'+esc(m.text)+'<time>'+esc(new Date(m.ts).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}))+'</time></div>').join('')
    :'<p class="hint">ยังไม่มีข้อความ ห้องนี้เงียบอยู่ ซึ่งก็ดีแล้ว</p>';
  box.scrollTop=box.scrollHeight;
}
$('#chatForm').addEventListener('submit',e=>{
  e.preventDefault();
  const text=$('#chatIn').value.trim();if(!text||!currentRoom)return;
  if(!send({t:'chat',text})){toast('ส่งไม่ได้ ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์');return}
  $('#chatIn').value='';
});

/* กล้อง */
let stream=null;
async function startCam(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    $('#camMsg').textContent='เบราว์เซอร์นี้ไม่รองรับกล้อง';return;
  }
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
    const v=$('#cam');v.srcObject=stream;v.hidden=false;$('#camMsg').hidden=true;
    btnUI('#camBtn',true,'cam','กล้อง',true);
    applyLocal();sendState();renderMembers();
  }catch(err){
    stream=null;
    $('#camMsg').hidden=false;
    $('#camMsg').textContent=err&&err.name==='NotAllowedError'
      ?'ยังไม่ได้อนุญาตให้ใช้กล้อง กดไอคอนกล้องที่แถบที่อยู่แล้วเลือกอนุญาต'
      :'เปิดกล้องไม่ได้ เว็บต้องเปิดผ่าน https หรือ localhost และต้องมีกล้องที่ว่างอยู่';
  }
}
function stopCam(){
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  const v=$('#cam');v.srcObject=null;v.hidden=true;
  $('#camMsg').hidden=false;$('#camMsg').textContent='กล้องปิดอยู่ คนอื่นเห็นแค่อวตารของคุณ';
  btnUI('#camBtn',false,'cam','กล้อง',false);
  applyLocal();sendState();renderMembers();
}
$('#camBtn').addEventListener('click',()=>stream?stopCam():startCam());

/* ไมค์ */
let micStream=null,micCtx=null,micRaf=0;
async function startMic(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    $('#micState').textContent='เบราว์เซอร์นี้ไม่รองรับไมค์';return;
  }
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    const AC=window.AudioContext||window.webkitAudioContext;
    micCtx=new AC();
    const an=micCtx.createAnalyser();an.fftSize=512;
    micCtx.createMediaStreamSource(micStream).connect(an);
    const buf=new Uint8Array(an.fftSize);
    const draw=()=>{
      an.getByteTimeDomainData(buf);
      let peak=0;for(let i=0;i<buf.length;i++){peak=Math.max(peak,Math.abs(buf[i]-128))}
      $('#micLevel').style.width=Math.min(100,peak/128*220)+'%';
      micRaf=requestAnimationFrame(draw);
    };
    draw();
    $('#micState').textContent='ไมค์เปิดอยู่';$('#micRow').classList.add('on');
    btnUI('#micBtn',true,'mic','ไมค์',true);
    applyLocal();sendState();renderMembers();
  }catch(err){
    micStream=null;
    $('#micState').textContent=err&&err.name==='NotAllowedError'
      ?'ยังไม่ได้อนุญาตให้ใช้ไมค์ กดไอคอนที่แถบที่อยู่แล้วเลือกอนุญาต'
      :'เปิดไมค์ไม่ได้ เว็บต้องเปิดผ่าน https หรือ localhost และต้องมีไมค์ที่ว่างอยู่';
  }
}
function stopMic(){
  cancelAnimationFrame(micRaf);
  if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null}
  if(micCtx){micCtx.close();micCtx=null}
  $('#micLevel').style.width='0';$('#micState').textContent='ไมค์ปิดอยู่';$('#micRow').classList.remove('on');
  btnUI('#micBtn',false,'mic','ไมค์',false);
  applyLocal();sendState();renderMembers();
}
$('#micBtn').addEventListener('click',()=>{ if(micStream){stopMic();return} if(deaf)setDeaf(false); startMic(); });

/* ปิดหู: ปิดเสียงทั้งหมดที่ได้ยิน (เสียงแจ้งเตือน และเสียงของทุกคนในห้อง) */
let deaf=false;
function chime(){
  if(deaf)return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;const c=new AC();
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';o.frequency.setValueAtTime(660,c.currentTime);o.frequency.linearRampToValueAtTime(880,c.currentTime+.18);
    g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.08,c.currentTime+.04);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.4);
    o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.42);
    setTimeout(()=>c.close(),700);
  }catch(e){}
}
function setDeaf(v){
  deaf=v;
  document.querySelectorAll('#audios audio').forEach(el=>{el.muted=v});
  applySndMute();
  btnUI('#deafBtn',!v,'head','หูฟัง',v);$('#deafBtn').setAttribute('aria-pressed',String(v));
  if(v){ stopMic(); $('#micState').textContent='ปิดหูฟังอยู่ ไมค์ถูกปิดด้วย'; toast('ปิดหูฟังแล้ว จะไม่ได้ยินเสียงใดๆ'); }
  else { if(!micStream)$('#micState').textContent='ไมค์ปิดอยู่'; toast('เปิดหูฟังแล้ว'); }
}
$('#deafBtn').addEventListener('click',()=>setDeaf(!deaf));

/* ตั้งเวลาโฟกัส */
let tmId=null,tmEnd=0;
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function tick(){
  const s=Math.max(0,Math.round((tmEnd-Date.now())/1000));
  $('#tm').textContent=s?fmt(s):'ครบเวลา';
  if(!s){clearInterval(tmId);tmId=null;toast('ครบเวลาแล้ว พักสายตาสักครู่');chime()}
}
function stopTimer(){clearInterval(tmId);tmId=null;$('#tm').textContent='25:00'}
document.querySelectorAll('[data-tm]').forEach(b=>b.addEventListener('click',()=>{
  const m=+b.dataset.tm;clearInterval(tmId);
  if(!m){stopTimer();return}
  tmEnd=Date.now()+m*60000;tick();tmId=setInterval(tick,500);
}));

/* พื้นหลัง: แผงปรับ */
function renderBgChips(){
  const chips=BG_PRESETS.map(([id,name,css])=>({id,name,css:css||'linear-gradient(var(--stage-a),var(--stage-b))',on:!bgState.image&&bgState.preset===id}));
  if(bgImage)chips.push({id:'image',name:'รูปของฉัน',css:'url("'+bgImage+'")',on:bgState.image});
  $('#bgChips').innerHTML=chips.map(c=>'<button type="button" role="radio" aria-checked="'+c.on+'" data-bg="'+c.id+'" title="'+esc(c.name)+'" aria-label="'+esc(c.name)+'" style="background-image:'+c.css.replace(/"/g,'&quot;')+'"></button>').join('');
}
function syncBgControls(){renderBgChips();$('#bgDim').value=bgState.dim;$('#bgBlur').value=bgState.blur}
$('#bgBtn').addEventListener('click',()=>{
  const p=$('#bgPanel');p.hidden=!p.hidden;$('#bgBtn').setAttribute('aria-expanded',String(!p.hidden));
  if(!p.hidden)syncBgControls();
});
$('#bgChips').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.bg==='image'){bgState.image=true}else{bgState.image=false;bgState.preset=b.dataset.bg}
  saveBg();applyBg();renderBgChips();
});
$('#bgDim').addEventListener('input',e=>{bgState.dim=+e.target.value;saveBg();applyBg()});
$('#bgBlur').addEventListener('input',e=>{bgState.blur=+e.target.value;saveBg();applyBg()});
$('#bgReset').addEventListener('click',()=>{bgState=Object.assign({},BG_DEFAULT);saveBg();applyBg();syncBgControls()});
$('#bgUp').addEventListener('click',()=>$('#bgFile').click());
$('#bgFile').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';
  if(!f)return;
  if(!/^image\//.test(f.type)){toast('เลือกไฟล์รูปภาพเท่านั้น');return}
  if(f.size>15*1024*1024){toast('รูปใหญ่เกิน 15 MB ลองรูปที่เล็กลง');return}
  const url=URL.createObjectURL(f),im=new Image();
  im.onload=()=>{
    const sc=Math.min(1,1600/Math.max(im.width,im.height));
    const c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    URL.revokeObjectURL(url);
    bgImage=c.toDataURL('image/jpeg',.85);bgState.image=true;
    store.set('qs.bgimg',bgImage);saveBg();applyBg();renderBgChips();toast('ตั้งพื้นหลังแล้ว');
  };
  im.onerror=()=>{URL.revokeObjectURL(url);toast('เปิดรูปนี้ไม่ได้ ลองไฟล์ JPG หรือ PNG')};
  im.src=url;
});

/* ---------- เสียงบรรยากาศ (สร้างสดด้วย Web Audio ไม่ต้องดาวน์โหลดไฟล์เสียง) ---------- */
let actx=null,mix=null,nb=null,upN=0;
const sndPref=Object.assign({master:60,levels:{}},store.get('qs.snd',{}));
const saveSnd=()=>store.set('qs.snd',sndPref);
const sndLevel=id=>(sndPref.levels[id]==null?60:sndPref.levels[id]);
const vol=v=>Math.pow(v/100,2);
function makeNoise(c){
  const len=c.sampleRate*4,out={};
  const mk=fn=>{const b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);fn(d);return b};
  out.white=mk(d=>{for(let i=0;i<len;i++)d[i]=Math.random()*2-1});
  out.pink=mk(d=>{let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926}});
  out.brown=mk(d=>{let l=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;l=(l+.02*w)/1.02;d[i]=l*3.5}});
  return out;
}
function aCtx(){
  if(!actx){
    const AC=window.AudioContext||window.webkitAudioContext;
    actx=new AC();
    const comp=actx.createDynamicsCompressor();comp.connect(actx.destination);
    mix=actx.createGain();mix.gain.value=deaf?0:vol(sndPref.master);mix.connect(comp);
    nb=makeNoise(actx);
  }
  if(actx.state==='suspended')actx.resume();
  return actx;
}
const noiseNode=k=>{const n=actx.createBufferSource();n.buffer=nb[k];n.loop=true;n.start(0,Math.random()*3);return n};
const biq=(type,f,q)=>{const n=actx.createBiquadFilter();n.type=type;n.frequency.value=f;if(q)n.Q.value=q;return n};
const gn=v=>{const g=actx.createGain();g.gain.value=v;return g};
const lfo=(f,depth,param,type)=>{const o=actx.createOscillator();o.type=type||'sine';o.frequency.value=f;const g=gn(depth);o.connect(g);g.connect(param);o.start();return o};
const chain=(...n)=>{for(let i=0;i<n.length-1;i++)n[i].connect(n[i+1])};
const quiet=(...ns)=>ns.forEach(x=>{try{x.stop()}catch(_){}});

function mkRain(out){
  const a=noiseNode('pink'),b=noiseNode('white'),g2=gn(.1);
  chain(a,biq('lowpass',7000),gn(.5),out);chain(b,biq('highpass',3500),g2,out);
  const l=lfo(.35,.04,g2.gain);
  return ()=>quiet(a,b,l);
}
function mkStorm(out){
  const stopRain=mkRain(out);
  const th=gn(0),br=noiseNode('brown');chain(br,biq('lowpass',180),th,out);
  let tm;
  const boom=()=>{
    const t=actx.currentTime;
    th.gain.cancelScheduledValues(t);th.gain.setValueAtTime(0,t);
    th.gain.linearRampToValueAtTime(1.6,t+.4+Math.random()*.5);
    th.gain.exponentialRampToValueAtTime(.001,t+4+Math.random()*3);
    tm=setTimeout(boom,9000+Math.random()*16000);
  };
  tm=setTimeout(boom,2500+Math.random()*4000);
  return ()=>{clearTimeout(tm);stopRain();quiet(br)};
}
function mkLeaves(out){
  const a=noiseNode('white'),g=gn(.2),p=noiseNode('pink');
  chain(a,biq('bandpass',4200,.8),g,out);chain(p,biq('lowpass',900),gn(.05),out);
  const l1=lfo(.22,.16,g.gain),l2=lfo(1.7,.05,g.gain);
  return ()=>quiet(a,p,l1,l2);
}
function mkWind(out){
  const a=noiseNode('pink'),f=biq('bandpass',500,1.2),g=gn(.7);
  chain(a,f,g,out);
  const l1=lfo(.06,280,f.frequency),l2=lfo(.09,.25,g.gain);
  return ()=>quiet(a,l1,l2);
}
function mkWaves(out){
  const a=noiseNode('pink'),g=gn(.35),b=noiseNode('brown'),g2=gn(.3);
  chain(a,biq('lowpass',1400),g,out);chain(b,biq('lowpass',500),g2,out);
  const l=lfo(.11,.3,g.gain),l2=lfo(.083,.25,g2.gain);
  return ()=>quiet(a,b,l,l2);
}
function mkStream(out){
  const a=noiseNode('pink'),g=gn(.45),b=noiseNode('white'),g2=gn(.08);
  chain(a,biq('bandpass',1800,.4),g,out);chain(b,biq('highpass',4000),g2,out);
  const l=lfo(9,.03,g2.gain),l2=lfo(.6,.15,g.gain);
  return ()=>quiet(a,b,l,l2);
}
function mkFire(out){
  const a=noiseNode('brown'),w=noiseNode('white'),cg=gn(0);
  chain(a,biq('lowpass',450),gn(.6),out);chain(w,biq('highpass',1800),cg,out);
  let tm;
  const pop=()=>{
    const t=actx.currentTime;
    cg.gain.cancelScheduledValues(t);cg.gain.setValueAtTime(.15+Math.random()*.6,t);
    cg.gain.exponentialRampToValueAtTime(.001,t+.03+Math.random()*.07);
    tm=setTimeout(pop,50+Math.random()*450);
  };
  pop();
  return ()=>{clearTimeout(tm);quiet(a,w)};
}
function mkCrickets(out){
  const stops=[];
  [[4300,24,1.1],[4700,21,.8]].forEach(([fc,fm,fg])=>{
    const o=actx.createOscillator();o.type='sine';o.frequency.value=fc;
    const am=gn(.5),am2=gn(.5);
    chain(o,am,am2,gn(.05),out);o.start();
    stops.push(o,lfo(fm,.5,am.gain,'square'),lfo(fg,.5,am2.gain,'square'));
  });
  return ()=>quiet(...stops);
}
const mkNoise=(kind,level)=>out=>{const a=noiseNode(kind);chain(a,gn(level),out);return ()=>quiet(a)};

const SND=[
  {id:'rain',name:'ฝนตก',grp:'ธรรมชาติ',make:mkRain},
  {id:'storm',name:'ฝนฟ้าร้อง',grp:'ธรรมชาติ',make:mkStorm},
  {id:'leaves',name:'ใบไม้ไหว',grp:'ธรรมชาติ',make:mkLeaves},
  {id:'wind',name:'ลมพัด',grp:'ธรรมชาติ',make:mkWind},
  {id:'waves',name:'คลื่นทะเล',grp:'ธรรมชาติ',make:mkWaves},
  {id:'stream',name:'ลำธาร',grp:'ธรรมชาติ',make:mkStream},
  {id:'fire',name:'เตาผิง',grp:'ธรรมชาติ',make:mkFire},
  {id:'cricket',name:'จิ้งหรีดยามค่ำ',grp:'ธรรมชาติ',make:mkCrickets},
  {id:'white',name:'นอยส์ขาว',grp:'นอยส์ช่วยโฟกัส',make:mkNoise('white',.22)},
  {id:'pink',name:'นอยส์ชมพู',grp:'นอยส์ช่วยโฟกัส',make:mkNoise('pink',.5)},
  {id:'brown',name:'นอยส์น้ำตาล',grp:'นอยส์ช่วยโฟกัส',make:mkNoise('brown',.8)}
];
const SND_PRESETS=[
  ['ฝนในป่า',{rain:55,leaves:35,cricket:25}],
  ['ริมทะเล',{waves:70,wind:25}],
  ['ข้างเตาผิง',{fire:70,rain:30}],
  ['ฝนฟ้าคะนอง',{storm:70}],
  ['โฟกัสลึก',{brown:55}]
];
const sndState={};

function setSnd(id,on){
  const def=SND.find(x=>x.id===id);if(!def)return;
  const st=sndState[id];
  if(on){
    if(st&&st.on)return;
    aCtx();
    const g=actx.createGain();g.gain.value=0;g.connect(mix);
    g.gain.setTargetAtTime(vol(sndLevel(id)),actx.currentTime,.15);
    let stop;
    try{stop=def.upload?def.start(g):def.make(g)}catch(e){try{g.disconnect()}catch(_){}toast('เปิดเสียงนี้ไม่ได้');return}
    sndState[id]={on:true,gain:g,stop};
  }else if(st&&st.on){
    st.on=false;
    st.gain.gain.setTargetAtTime(0,actx.currentTime,.12);
    setTimeout(()=>{try{st.stop()}catch(_){}try{st.gain.disconnect()}catch(_){}},900);
  }
  syncSndUI();
}
function stopAllSnd(){SND.forEach(d=>{if(sndState[d.id]&&sndState[d.id].on)setSnd(d.id,false)})}
function applySndMute(){if(mix)mix.gain.setTargetAtTime(deaf?0:vol(sndPref.master),actx.currentTime,.05)}

function renderSnd(){
  const groups=[];
  SND.forEach(d=>{const g=d.grp;if(!groups.includes(g))groups.push(g)});
  $('#sndList').innerHTML=groups.map(g=>'<div class="sgroup"><h4>'+esc(g)+'</h4><div class="srows">'
    +SND.filter(d=>d.grp===g).map(d=>
      '<div class="srow" data-s="'+esc(d.id)+'"><button type="button" class="stog" role="switch" aria-checked="false" title="'+esc(d.name)+'">'+esc(d.name)+'</button>'
      +'<input type="range" min="0" max="100" value="'+sndLevel(d.id)+'" aria-label="ระดับเสียง '+esc(d.name)+'">'
      +(d.upload?'<button type="button" class="sx" aria-label="เอาไฟล์ '+esc(d.name)+' ออก">×</button>':'')+'</div>').join('')
    +'</div></div>').join('');
  $('#sndPresets').innerHTML=SND_PRESETS.map(([n],i)=>'<button type="button" class="btn ghost sm" data-preset="'+i+'">'+esc(n)+'</button>').join('')
    +'<button type="button" class="btn ghost sm" data-preset="off">ปิดทั้งหมด</button>';
  syncSndUI();
}
function syncSndUI(){
  let n=0;
  document.querySelectorAll('#sndList .srow').forEach(r=>{
    const id=r.dataset.s,on=!!(sndState[id]&&sndState[id].on);if(on)n++;
    r.querySelector('.stog').setAttribute('aria-checked',String(on));
    const rg=r.querySelector('input[type=range]');if(+rg.value!==sndLevel(id))rg.value=sndLevel(id);
  });
  $('#sndBtn').textContent='เสียงบรรยากาศ'+(n?' ('+n+')':'');
  $('#sndMaster').value=sndPref.master;
}
$('#sndBtn').addEventListener('click',()=>{
  const p=$('#sndPanel');p.hidden=!p.hidden;$('#sndBtn').setAttribute('aria-expanded',String(!p.hidden));
});
$('#sndList').addEventListener('click',e=>{
  const row=e.target.closest('.srow');if(!row)return;
  const id=row.dataset.s;
  if(e.target.closest('.sx')){removeUpload(id);return}
  if(e.target.closest('.stog')){
    const on=!(sndState[id]&&sndState[id].on);
    if(on&&deaf)toast('ตอนนี้ปิดหูฟังอยู่ กดเปิดหูฟังเพื่อได้ยินเสียง');
    setSnd(id,on);
  }
});
$('#sndList').addEventListener('input',e=>{
  const row=e.target.closest('.srow');if(!row||e.target.type!=='range')return;
  const id=row.dataset.s;sndPref.levels[id]=+e.target.value;saveSnd();
  const st=sndState[id];if(st&&st.on)st.gain.gain.setTargetAtTime(vol(sndPref.levels[id]),actx.currentTime,.05);
});
$('#sndMaster').addEventListener('input',e=>{sndPref.master=+e.target.value;saveSnd();applySndMute()});
$('#sndPresets').addEventListener('click',e=>{
  const b=e.target.closest('[data-preset]');if(!b)return;
  if(deaf)toast('ตอนนี้ปิดหูฟังอยู่ กดเปิดหูฟังเพื่อได้ยินเสียง');
  const mixSet=b.dataset.preset==='off'?{}:SND_PRESETS[+b.dataset.preset][1];
  SND.forEach(d=>{
    if(d.upload)return;
    if(d.id in mixSet){sndPref.levels[d.id]=mixSet[d.id];setSnd(d.id,true);const st=sndState[d.id];if(st&&st.gain)st.gain.gain.setTargetAtTime(vol(mixSet[d.id]),actx.currentTime,.05)}
    else setSnd(d.id,false);
  });
  saveSnd();syncSndUI();
});

/* อัปโหลดไฟล์เสียงของตัวเอง (เล่นวนในเครื่องคุณเท่านั้น) */
$('#sndUp').addEventListener('click',()=>$('#sndFile').click());
$('#sndFile').addEventListener('change',e=>{
  const files=[...(e.target.files||[])];e.target.value='';
  files.forEach(f=>{
    if(SND.filter(d=>d.upload).length>=5){toast('อัปโหลดได้สูงสุด 5 ไฟล์');return}
    if(!(/^audio\//.test(f.type)||/\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i.test(f.name))){toast('เลือกไฟล์เสียงเท่านั้น เช่น MP3 หรือ WAV');return}
    if(f.size>80*1024*1024){toast('ไฟล์ใหญ่เกิน 80 MB');return}
    aCtx();
    const id='up'+(++upN),url=URL.createObjectURL(f),el=new Audio();
    el.loop=true;el.preload='auto';el.src=url;
    const src=actx.createMediaElementSource(el);
    const def={id,name:f.name.replace(/\.[^.]+$/,'').slice(0,24),grp:'ไฟล์เสียงของฉัน',upload:true,el,src,url,
      start(g){src.connect(g);el.play().catch(()=>toast('เล่นไฟล์นี้ไม่ได้ ลองไฟล์อื่น'));return ()=>{el.pause();try{src.disconnect()}catch(_){}}}};
    el.onerror=()=>{toast('เปิดไฟล์เสียงนี้ไม่ได้ ลองไฟล์อื่น');removeUpload(id)};
    SND.push(def);renderSnd();setSnd(id,true);
  });
  if(files.length)$('#sndPanel').hidden=false;
});
function removeUpload(id){
  const i=SND.findIndex(d=>d.id===id);if(i<0)return;
  const d=SND[i];setSnd(id,false);
  setTimeout(()=>{try{d.el.pause();d.el.removeAttribute('src');d.el.load()}catch(_){}URL.revokeObjectURL(d.url)},1000);
  SND.splice(i,1);delete sndState[id];renderSnd();
}

/* ---------- เชื่อมต่อเซิร์ฟเวอร์ ---------- */
function setNet(st){
  const el=$('#net');el.dataset.s=st;
  el.textContent=st==='on'?'ออนไลน์':st==='wait'?'กำลังเชื่อมต่อ…':'ออฟไลน์';
}
function connect(){
  if(location.protocol==='file:'){setNet('off');renderLobby();return}
  setNet('wait');
  const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
  net.ws=ws;
  ws.onopen=()=>{
    net.tries=0;
    send({t:'hello',cid,name:profile.name,cfg:cfgOf(profile)});
    clearInterval(net.beat);net.beat=setInterval(()=>send({t:'ping'}),25000);
  };
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(_){return}onNet(m)};
  ws.onclose=()=>{
    if(net.ws!==ws)return;
    net.ok=false;clearInterval(net.beat);closeAllPeers();roomMembers=[];
    setNet('wait');
    if(currentRoom)toast('การเชื่อมต่อหลุด กำลังต่อใหม่…');
    if(!$('#v-lobby').hidden)renderLobby();
    setTimeout(connect,Math.min(10000,800*Math.pow(2,net.tries++)));
  };
  ws.onerror=()=>{try{ws.close()}catch(_){}};
}
function onNet(m){
  switch(m.t){
    case 'welcome':
      myPeerId=m.id;net.ok=true;setNet('on');rooms=m.rooms;
      if(!$('#v-lobby').hidden)renderLobby();
      if(currentRoom)send({t:'join',room:currentRoom.id});
      break;
    case 'rooms':{
      rooms=m.rooms;
      if(currentRoom){const r=rooms.find(x=>x.id===currentRoom.id);if(r){currentRoom=r;paintRoomHead()}}
      if(!$('#v-lobby').hidden)renderLobby();
      break;
    }
    case 'created': send({t:'join',room:m.room}); break;
    case 'error': toast(m.msg||'เกิดข้อผิดพลาด'); break;
    case 'joined':{
      currentRoom=rooms.find(x=>x.id===m.room)||{id:m.room,name:'ห้อง',desc:'',mood:'',cap:8,canDelete:false};
      roomMembers=m.members;chatLog=m.chat||[];
      enterRoomUI();
      break;
    }
    case 'peer-joined': roomMembers.push(m.peer);refreshRoom();break;
    case 'peer-left': roomMembers=roomMembers.filter(x=>x.id!==m.id);closePeer(m.id);refreshRoom();break;
    case 'peer-update': roomMembers=roomMembers.map(x=>x.id===m.peer.id?m.peer:x);refreshRoom();updateRemoteTile(m.peer.id);break;
    case 'peer-state':{
      const x=roomMembers.find(y=>y.id===m.id);
      if(x){x.cam=m.cam;x.mic=m.mic;renderMembers();updateRemoteTile(m.id)}
      break;
    }
    case 'chat':
      if(currentRoom&&m.room===currentRoom.id){
        chatLog.push(m.msg);if(chatLog.length>60)chatLog.shift();renderChat();
        if(!String(m.msg.id).startsWith(myPeerId+'-'))chime();
      }
      break;
    case 'room-deleted':
      if(currentRoom&&m.room===currentRoom.id){leaveRoom(true);show('lobby');toast('ห้องนี้ถูกลบแล้ว')}
      break;
    case 'signal': handleSignal(m.from,m.data); break;
  }
}
function sendState(){ if(currentRoom)send({t:'state',cam:!!stream,mic:!!micStream}); }

/* ---------- ส่งภาพและเสียงถึงกัน (WebRTC ต่อตรงระหว่างผู้ใช้) ---------- */
let iceServers=[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}];
if(location.protocol!=='file:'){
  fetch('/api/turn').then(r=>r.ok?r.json():null).then(j=>{if(j&&Array.isArray(j.iceServers)&&j.iceServers.length)iceServers=j.iceServers}).catch(()=>{});
}
const pcs=new Map();
function localTrack(kind){
  const s=kind==='video'?stream:micStream;
  if(!s)return null;
  return (kind==='video'?s.getVideoTracks()[0]:s.getAudioTracks()[0])||null;
}
async function applyTo(p){
  for(const k of ['audio','video']){
    const snd=p.snd[k];
    if(snd){try{await snd.replaceTrack(localTrack(k))}catch(_){}}
  }
}
function applyLocal(){pcs.forEach(p=>{applyTo(p)})}
function makePeer(id){
  const p={id,pc:new RTCPeerConnection({iceServers}),media:new MediaStream(),pend:[],snd:{},initiator:false};
  p.pc.onicecandidate=e=>{if(e.candidate)send({t:'signal',to:id,data:{c:e.candidate}})};
  p.pc.ontrack=e=>{p.media.addTrack(e.track);showRemote(p)};
  p.pc.onconnectionstatechange=()=>{
    if(p.pc.connectionState==='failed')toast('ต่อภาพหรือเสียงกับบางคนไม่ได้ เครือข่ายของเขาอาจไม่รองรับการต่อตรง');
  };
  pcs.set(id,p);
  return p;
}
async function callPeer(id){
  if(pcs.has(id))return;
  const p=makePeer(id);p.initiator=true;
  p.snd.audio=p.pc.addTransceiver('audio',{direction:'sendrecv'}).sender;
  p.snd.video=p.pc.addTransceiver('video',{direction:'sendrecv'}).sender;
  try{
    await applyTo(p);
    await p.pc.setLocalDescription(await p.pc.createOffer());
    send({t:'signal',to:id,data:{d:p.pc.localDescription}});
  }catch(_){}
}
async function handleSignal(from,data){
  if(!currentRoom||!data)return;
  const p=pcs.get(from)||makePeer(from);
  const pc=p.pc;
  try{
    if(data.d){
      await pc.setRemoteDescription(data.d);
      while(p.pend.length)await pc.addIceCandidate(p.pend.shift()).catch(()=>{});
      if(data.d.type==='offer'){
        pc.getTransceivers().forEach(t=>{
          const k=t.receiver.track&&t.receiver.track.kind;
          if(k){t.direction='sendrecv';p.snd[k]=t.sender}
        });
        await applyTo(p);
        await pc.setLocalDescription(await pc.createAnswer());
        send({t:'signal',to:from,data:{d:pc.localDescription}});
      }
    }else if(data.c){
      if(pc.remoteDescription)await pc.addIceCandidate(data.c).catch(()=>{});
      else p.pend.push(data.c);
    }
  }catch(_){}
}
function showRemote(p){
  let au=document.getElementById('au-'+p.id);
  if(!au){au=document.createElement('audio');au.id='au-'+p.id;au.autoplay=true;au.muted=deaf;$('#audios').append(au)}
  if(au.srcObject!==p.media)au.srcObject=p.media;
  if(au.play)au.play().catch(()=>{});
  let t=document.getElementById('rt-'+p.id);
  if(!t){
    t=document.createElement('div');t.id='rt-'+p.id;t.className='rtile';t.hidden=true;
    t.innerHTML='<video autoplay playsinline muted></video><span class="rname"></span>';
    $('#remotes').append(t);t.querySelector('video').srcObject=p.media;
  }
  updateRemoteTile(p.id);
}
function updateRemoteTile(id){
  const t=document.getElementById('rt-'+id);
  if(t){
    const m=roomMembers.find(x=>x.id===id);
    t.hidden=!(m&&m.cam);
    t.querySelector('.rname').textContent=m?m.name:'';
  }
  $('#remotesWrap').hidden=!$('#remotes').querySelector('.rtile:not([hidden])');
}
function closePeer(id){
  const p=pcs.get(id);
  if(p){try{p.pc.close()}catch(_){}pcs.delete(id)}
  const au=document.getElementById('au-'+id);if(au){au.srcObject=null;au.remove()}
  const t=document.getElementById('rt-'+id);if(t)t.remove();
  $('#remotesWrap').hidden=!$('#remotes').querySelector('.rtile:not([hidden])');
}
function closeAllPeers(){[...pcs.keys()].forEach(closePeer)}

addEventListener('pagehide',()=>{stopCam();stopMic()});

btnUI('#camBtn',false,'cam','กล้อง',false);btnUI('#micBtn',false,'mic','ไมค์',false);btnUI('#deafBtn',true,'head','หูฟัง',false);
renderSnd();
renderLobby();
connect();
})();
