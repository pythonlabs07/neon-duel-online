const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||8080,ROOT=__dirname,TILE=2;
const MAP=['1111111111111111','1000000000000001','1011011110110101','1001000010000101','1001010010110001','1000010010000001','1011011110101101','1000000000000001','1010110011010101','1000100000010001','1011101111011101','1000001000000001','1001100010110001','1010001000000101','1000000000000001','1111111111111111'];
const MW=16,MH=16,OX=MW*TILE/2,OZ=MH*TILE/2;
const W={pulse:{clip:12,reserve:60,delay:.28,reload:1.05,damage:10,pellets:1,spread:.008},rapid:{clip:24,reserve:96,delay:.11,reload:1.3,damage:6,pellets:1,spread:.022},scatter:{clip:6,reserve:30,delay:.62,reload:1.5,damage:5,pellets:6,spread:.09}};
function cell(x,z){return{x:x*TILE-OX,z:z*TILE-OZ}}const spawns=[cell(1.5,1.5),cell(14.5,14.5)],rooms=new Map();
function isWall(x,z){const ix=Math.floor((x+OX)/TILE),iz=Math.floor((z+OZ)/TILE);return iz<0||ix<0||iz>=MH||ix>=MW||MAP[iz][ix]==='1'}
function canStand(x,z,r=.28){return !isWall(x-r,z-r)&&!isWall(x+r,z-r)&&!isWall(x-r,z+r)&&!isWall(x+r,z+r)}
function code(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<5;i++)s+=a[Math.floor(Math.random()*a.length)];return s}
function ammo(){return{pulse:{clip:12,reserve:60},rapid:{clip:24,reserve:96},scatter:{clip:6,reserve:30}}}
function send(ws,o){if(ws.readyState===1)ws.send(JSON.stringify(o))}function broadcast(r,o){for(const p of r.players)send(p.ws,o)}
function player(ws,i){const s=spawns[i];return{id:Math.random().toString(36).slice(2,9),ws,x:s.x,z:s.z,yaw:i?Math.PI:0,pitch:0,hp:100,score:0,alive:true,weapon:'pulse',ammo:ammo(),lastShot:0,reloadingUntil:0,spawnIndex:i}}
function raySphere(o,d,c,r){const oc={x:o.x-c.x,y:o.y-c.y,z:o.z-c.z},b=oc.x*d.x+oc.y*d.y+oc.z*d.z,c2=oc.x*oc.x+oc.y*oc.y+oc.z*oc.z-r*r,h=b*b-c2;if(h<0)return null;const t=-b-Math.sqrt(h);return t>0?t:null}
function wallDistance(o,d,max=35){for(let t=.08;t<max;t+=.08)if(isWall(o.x+d.x*t,o.z+d.z*t))return t;return max}
function fireRay(shooter,target,yaw,pitch,spread){const yy=yaw+(Math.random()-.5)*spread*2,pp=pitch+(Math.random()-.5)*spread*2,cp=Math.cos(pp),d={x:-Math.sin(yy)*cp,y:Math.sin(pp),z:-Math.cos(yy)*cp},o={x:shooter.x,y:1.58,z:shooter.z};let t1=raySphere(o,d,{x:target.x,y:1.12,z:target.z},.55),t2=raySphere(o,d,{x:target.x,y:1.75,z:target.z},.31),t=Math.min(t1??1e9,t2??1e9),wd=wallDistance(o,d),hit=t<wd&&t<35,dist=hit?t:wd;return{hit,from:o,to:{x:o.x+d.x*dist,y:o.y+d.y*dist,z:o.z+d.z*dist}}}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  const raw=(req.url||'/').split('?')[0];
  if(raw==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:true,rooms:rooms.size,version:'online-v3'}))}
  let file;
  if(raw==='/three.module.js')file=path.join(ROOT,'node_modules','three','build','three.module.js');
  else{const clean=raw==='/'?'index.html':decodeURIComponent(raw).replace(/^\/+/, '');file=path.resolve(ROOT,clean);if(!file.startsWith(path.resolve(ROOT)+path.sep)&&file!==path.resolve(ROOT,'index.html')){res.writeHead(403);return res.end('Forbidden')}}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found: '+raw)}const ext=path.extname(file).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache'});res.end(data)})
});
const wss=new WebSocketServer({server,path:'/ws'});
wss.on('connection',ws=>{
  ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return}
    if(m.type==='create'){let c;do c=code();while(rooms.has(c));const r={code:c,players:[],ended:false};rooms.set(c,r);const p=player(ws,0);r.players.push(p);ws.room=c;ws.pid=p.id;send(ws,{type:'created',room:c});send(ws,{type:'joined',room:c,id:p.id,spawn:spawns[0],yaw:p.yaw,ammo:p.ammo});return}
    if(m.type==='join'){const c=String(m.room||'').toUpperCase(),r=rooms.get(c);if(!r)return send(ws,{type:'error',message:'Sala não encontrada.'});if(r.players.length>=2)return send(ws,{type:'error',message:'Sala cheia.'});const p=player(ws,1);r.players.push(p);ws.room=c;ws.pid=p.id;send(ws,{type:'joined',room:c,id:p.id,spawn:spawns[1],yaw:p.yaw,ammo:p.ammo});broadcast(r,{type:'matchStart'});return}
    const r=rooms.get(ws.room);if(!r)return;const p=r.players.find(x=>x.id===ws.pid);if(!p)return;
    if(m.type==='move'&&p.alive){const nx=Number(m.x),nz=Number(m.z);if(Number.isFinite(nx)&&Number.isFinite(nz)&&canStand(nx,nz)&&Math.hypot(nx-p.x,nz-p.z)<1.3){p.x=nx;p.z=nz}if(Number.isFinite(Number(m.yaw)))p.yaw=Number(m.yaw);if(Number.isFinite(Number(m.pitch)))p.pitch=Math.max(-1.05,Math.min(1.05,Number(m.pitch)));return}
    if(m.type==='switch'&&W[m.weapon]){p.weapon=m.weapon;return}
    if(m.type==='reload'&&W[m.weapon]&&p.alive){const k=m.weapon,d=W[k],a=p.ammo[k],now=Date.now();if(now<p.reloadingUntil||a.clip>=d.clip||a.reserve<=0)return;p.reloadingUntil=now+d.reload*1000;setTimeout(()=>{const rr=rooms.get(ws.room);if(!rr||!rr.players.includes(p))return;const need=d.clip-a.clip,take=Math.min(need,a.reserve);a.clip+=take;a.reserve-=take;p.reloadingUntil=0;send(ws,{type:'reloaded',id:p.id,weapon:k,ammo:a})},d.reload*1000);return}
    if(m.type==='shoot'&&W[m.weapon]&&p.alive&&!r.ended){const k=m.weapon,d=W[k],a=p.ammo[k],now=Date.now()/1000;if(now-p.lastShot<d.delay||Date.now()<p.reloadingUntil||a.clip<=0)return;p.weapon=k;p.lastShot=now;a.clip--;const target=r.players.find(x=>x.id!==p.id&&x.alive);if(!target)return;let total=0,visual=null,firstHit=null;const sy=Number.isFinite(Number(m.yaw))?Number(m.yaw):p.yaw,sp=Number.isFinite(Number(m.pitch))?Number(m.pitch):p.pitch;for(let i=0;i<d.pellets;i++){const result=fireRay(p,target,sy,sp,d.spread);if(!visual)visual=result;if(result.hit){total+=d.damage;if(!firstHit)firstHit=result}}total=Math.min(total,30);const shown=firstHit||visual;if(shown)broadcast(r,{type:'shot',shooter:p.id,target:total?target.id:null,weapon:k,from:shown.from,to:shown.to,hit:!!total});if(total){target.hp=Math.max(0,target.hp-total);if(target.hp<=0){target.alive=false;p.score++;broadcast(r,{type:'eliminated',killer:p.id,target:target.id});if(p.score>=5){r.ended=true;broadcast(r,{type:'matchEnd',winner:p.id});setTimeout(()=>resetMatch(r),4000)}else setTimeout(()=>respawn(r,target),1800)}}return}
  });
  ws.on('close',()=>{const r=rooms.get(ws.room);if(!r)return;r.players=r.players.filter(p=>p.id!==ws.pid);broadcast(r,{type:'peerLeft'});if(!r.players.length)rooms.delete(ws.room)});
});
function respawn(r,p){if(r.ended||!r.players.includes(p))return;const s=spawns[p.spawnIndex];p.x=s.x;p.z=s.z;p.hp=100;p.alive=true;p.ammo=ammo();p.reloadingUntil=0}
function resetMatch(r){if(!rooms.has(r.code))return;r.ended=false;r.players.forEach((p,i)=>{p.score=0;p.spawnIndex=i;respawn(r,p)});broadcast(r,{type:'matchStart'})}
setInterval(()=>{for(const r of rooms.values()){broadcast(r,{type:'snapshot',players:r.players.map(p=>({id:p.id,x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,hp:p.hp,score:p.score,alive:p.alive,weapon:p.weapon,ammo:p.ammo}))})}},66);
setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue}ws.isAlive=false;try{ws.ping()}catch{}}},25000);
server.listen(PORT,'0.0.0.0',()=>console.log(`NEON DUEL ONLINE V3 em http://0.0.0.0:${PORT}`));
