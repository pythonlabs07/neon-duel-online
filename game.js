import * as THREE from '/three.module.js';

export async function createGame({ui,send}){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x8bcdf4);scene.fog=new THREE.Fog(0xa8d9f2,24,58);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,60);camera.rotation.order='YXZ';
  const isMobile=matchMedia('(max-width: 850px), (hover: none)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:!isMobile,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?.85:1.25));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;ui.game.innerHTML='';ui.game.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe7f6ff,0x8b765e,.95));const sun=new THREE.DirectionalLight(0xfff2d4,.72);sun.position.set(-8,14,6);scene.add(sun);

  const TILE=2, MAP=[
    '1111111111111111','1000000000000001','1011011110110101','1001000010000101','1001010010110001','1000010010000001','1011011110101101','1000000000000001','1010110011010101','1000100000010001','1011101111011101','1000001000000001','1001100010110001','1010001000000101','1000000000000001','1111111111111111'];
  const MW=16,MH=16,OX=MW*TILE/2,OZ=MH*TILE/2;
  function world(ix,iz){return{x:(ix+.5)*TILE-OX,z:(iz+.5)*TILE-OZ}}
  function isWall(x,z){const ix=Math.floor((x+OX)/TILE),iz=Math.floor((z+OZ)/TILE);return iz<0||ix<0||iz>=MH||ix>=MW||MAP[iz][ix]==='1'}
  function canStand(x,z,r=.28){return !isWall(x-r,z-r)&&!isWall(x+r,z-r)&&!isWall(x-r,z+r)&&!isWall(x+r,z+r)}
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(MW*TILE,MH*TILE),new THREE.MeshBasicMaterial({color:0x8e8578}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  // Sem teto: o céu diurno fica visível e reduz o peso da cena.
  function makeBrickTexture(){
    const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');
    x.fillStyle='#b86d4b';x.fillRect(0,0,128,128);x.strokeStyle='#e3c0a6';x.lineWidth=3;
    const bw=32,bh=18;for(let row=0,y=0;y<128;row++,y+=bh){const off=row%2?bw/2:0;for(let px=-off;px<128;px+=bw)x.strokeRect(px,y,bw,bh)}
    x.globalAlpha=.16;for(let i=0;i<90;i++){x.fillStyle=i%2?'#6e3c2b':'#f0b28c';x.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*3,1+Math.random()*2)}x.globalAlpha=1;
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;return t;
  }
  const brickTex=makeBrickTexture();
  const wallGeo=new THREE.BoxGeometry(TILE,3.2,TILE),wallMat=new THREE.MeshBasicMaterial({map:brickTex,color:0xffffff});
  const wallCells=[];for(let z=0;z<MH;z++)for(let x=0;x<MW;x++)if(MAP[z][x]==='1')wallCells.push(world(x,z));
  const walls=new THREE.InstancedMesh(wallGeo,wallMat,wallCells.length),dummy=new THREE.Object3D();
  wallCells.forEach((p,i)=>{dummy.position.set(p.x,1.6,p.z);dummy.updateMatrix();walls.setMatrixAt(i,dummy.matrix)});walls.instanceMatrix.needsUpdate=true;scene.add(walls);
  // Rodapé simples dá profundidade sem luzes extras.
  const curbMat=new THREE.MeshBasicMaterial({color:0x5b554d}),curbGeo=new THREE.BoxGeometry(TILE,.12,TILE);
  const curbs=new THREE.InstancedMesh(curbGeo,curbMat,wallCells.length);wallCells.forEach((p,i)=>{dummy.position.set(p.x,.06,p.z);dummy.updateMatrix();curbs.setMatrixAt(i,dummy.matrix)});curbs.instanceMatrix.needsUpdate=true;scene.add(curbs);

  function makeHumanoid(color=0xff584f){const g=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color,emissive:0x000000}),dark=new THREE.MeshLambertMaterial({color:0x202631,emissive:0x000000});const bodyMats=[mat,dark];const head=new THREE.Mesh(new THREE.SphereGeometry(.26,14,10),mat);head.position.y=1.78;g.add(head);const torso=new THREE.Mesh(new THREE.BoxGeometry(.62,.85,.32),mat);torso.position.y=1.18;g.add(torso);for(const sx of [-1,1]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.18,.72,.18),mat);arm.position.set(sx*.43,1.2,-.02);arm.rotation.z=sx*.12;g.add(arm);const leg=new THREE.Mesh(new THREE.BoxGeometry(.22,.72,.24),dark);leg.position.set(sx*.18,.46,0);g.add(leg)}const gun=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.72),new THREE.MeshLambertMaterial({color:0x253347,emissive:0x08387a,emissiveIntensity:.35}));gun.position.set(.42,1.26,-.42);gun.rotation.x=-.05;g.add(gun);g.userData.bodyMats=bodyMats;g.userData.hitUntil=0;return g}
  const enemy=makeHumanoid();enemy.visible=false;scene.add(enemy);enemy.userData.targetPos=new THREE.Vector3();enemy.userData.targetYaw=0;

  const weaponRoot=new THREE.Group();camera.add(weaponRoot);scene.add(camera);const weaponMeshes=[];
  function makeViewWeapon(color,length,width,kind){
    const group=new THREE.Group(),metal=new THREE.MeshLambertMaterial({color:0x25282d}),dark=new THREE.MeshLambertMaterial({color:0x111317}),accent=new THREE.MeshBasicMaterial({color});
    const receiver=new THREE.Mesh(new THREE.BoxGeometry(width,.24,length*.55),metal);receiver.position.set(0,0,-length*.18);group.add(receiver);
    const upper=new THREE.Mesh(new THREE.BoxGeometry(width*.82,.11,length*.44),new THREE.MeshLambertMaterial({color:0x3b4047}));upper.position.set(0,.15,-length*.22);group.add(upper);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(width*.10,width*.12,length*.62,8),dark);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.03,-length*.72);group.add(barrel);
    const shroud=new THREE.Mesh(new THREE.BoxGeometry(width*.68,.17,length*.32),metal);shroud.position.set(0,.03,-length*.55);group.add(shroud);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(width*.34,.38,.18),dark);grip.position.set(-width*.12,-.27,-.05);grip.rotation.x=-.22;group.add(grip);
    const mag=new THREE.Mesh(new THREE.BoxGeometry(width*.32,.34,.22),new THREE.MeshLambertMaterial({color:0x1b1e23}));mag.position.set(width*.10,-.24,-length*.22);mag.rotation.x=.12;group.add(mag);
    const stock=new THREE.Mesh(new THREE.BoxGeometry(width*.72,.19,length*.24),dark);stock.position.set(0,-.01,length*.20);group.add(stock);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(width*.46,.035,length*.34),dark);rail.position.set(0,.23,-length*.18);group.add(rail);
    const frontSight=new THREE.Mesh(new THREE.BoxGeometry(.025,.13,.035),dark);frontSight.position.set(0,.28,-length*.49);group.add(frontSight);
    const rearSight=new THREE.Mesh(new THREE.BoxGeometry(.025,.10,.035),dark);rearSight.position.set(0,.27,-length*.05);group.add(rearSight);
    if(kind==='rapid'){const fore=new THREE.Mesh(new THREE.BoxGeometry(width*.28,.28,.15),dark);fore.position.set(0,-.18,-length*.48);group.add(fore)}
    if(kind==='scatter'){const pump=new THREE.Mesh(new THREE.BoxGeometry(width*.78,.20,length*.22),new THREE.MeshLambertMaterial({color:0x5a402d}));pump.position.set(0,-.03,-length*.52);group.add(pump)}
    const strip=new THREE.Mesh(new THREE.BoxGeometry(width*.5,.025,length*.22),accent);strip.position.set(0,.205,-length*.28);group.add(strip);
    const flashMat=new THREE.MeshBasicMaterial({color:0xffd47a,transparent:true,opacity:.98,depthWrite:false});
    const flash=new THREE.Group();
    const cone1=new THREE.Mesh(new THREE.ConeGeometry(width*.34,.48,6),flashMat);cone1.rotation.x=-Math.PI/2;flash.add(cone1);
    const cone2=new THREE.Mesh(new THREE.ConeGeometry(width*.24,.38,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95,depthWrite:false}));cone2.rotation.x=-Math.PI/2;cone2.rotation.z=Math.PI/4;flash.add(cone2);
    const ring=new THREE.Mesh(new THREE.RingGeometry(width*.12,width*.32,10),new THREE.MeshBasicMaterial({color:0xffb34a,side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));ring.rotation.y=Math.PI/2;flash.add(ring);
    flash.position.set(0,.03,-length*1.04);flash.visible=false;group.add(flash);group.userData.muzzle=flash;return group
  }
  const defs={pulse:{name:'CARABINA',color:0x5fa7ff,clip:12,reserve:60,delay:.28,reload:1050},rapid:{name:'RÁPIDA',color:0x6ce2a4,clip:24,reserve:96,delay:.11,reload:1300},scatter:{name:'DISPERSORA',color:0xe8a25c,clip:6,reserve:30,delay:.62,reload:1500}};
  const keysW=Object.keys(defs);for(const k of keysW){const m=makeViewWeapon(defs[k].color,k==='scatter'?1.12:.98,k==='scatter'?.40:.34,k);m.visible=false;weaponRoot.add(m);weaponMeshes.push(m)}weaponRoot.position.set(.22,-.30,-.46);weaponRoot.rotation.set(-.015,.015,0);

  let mode='none',myId='',room='',hp=100,myScore=0,enemyScore=0,alive=true,yaw=0,pitch=0,weaponKey='pulse',weaponIndex=0,lastShot=0,reloading=false,reloadDone=0,reloadStart=0,lastSend=0,remote=null,started=false,animId=0,prev=performance.now(),botCd=0,lastFrame=0;
  const ammo={pulse:{clip:12,reserve:60},rapid:{clip:24,reserve:96},scatter:{clip:6,reserve:30}};
  const keys={};let joyX=0,joyY=0,lookId=null,lookX=0,lookY=0,fireHeld=false;

  function updateWeapon(){weaponMeshes.forEach((m,i)=>m.visible=i===weaponIndex);ui.weaponName.textContent=defs[weaponKey].name;const a=ammo[weaponKey];ui.ammo.textContent=a.clip+' / '+a.reserve}
  function updateHUD(){ui.hpFill.style.width=Math.max(0,hp)+'%';ui.score.textContent=myScore+' × '+enemyScore;updateWeapon()}
  function msg(t){ui.netmsg.textContent=t}
  function flashHit(){ui.hit.style.opacity=1;setTimeout(()=>ui.hit.style.opacity=0,90)}
  function damageFlash(){ui.damage.style.opacity=.85;setTimeout(()=>ui.damage.style.opacity=0,120)}
  function enemyHitFX(){enemy.userData.hitUntil=performance.now()+130;enemy.userData.bodyMats?.forEach(m=>{m.emissive.setHex(0xffffff);m.emissiveIntensity=.75});enemy.scale.set(1.04,.96,1.04);setTimeout(()=>{enemy.userData.bodyMats?.forEach(m=>{m.emissive.setHex(0x000000);m.emissiveIntensity=1});enemy.scale.set(1,1,1)},130)}
  function tracer(from,to,color){const geo=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.95}));scene.add(line);setTimeout(()=>{scene.remove(line);line.geometry.dispose();line.material.dispose()},85)}
  const sparkGeo=new THREE.SphereGeometry(.022,4,3),sparkMats=new Map();function spark(p,color){let mat=sparkMats.get(color);if(!mat){mat=new THREE.MeshBasicMaterial({color});sparkMats.set(color,mat)}for(let i=0;i<3;i++){const s=new THREE.Mesh(sparkGeo,mat);s.position.copy(p).add(new THREE.Vector3((Math.random()-.5)*.14,(Math.random()-.5)*.14,(Math.random()-.5)*.14));scene.add(s);setTimeout(()=>scene.remove(s),90)}}
  function muzzle(){const m=weaponMeshes[weaponIndex].userData.muzzle;m.visible=true;m.scale.set(1.2,1.2,1.2);weaponRoot.position.z=-.40;weaponRoot.rotation.x=.06;weaponRoot.rotation.z=-.025;setTimeout(()=>{m.scale.set(.75,.75,.75)},28);setTimeout(()=>{m.visible=false;if(!reloading){weaponRoot.position.z=-.46;weaponRoot.rotation.x=-.015;weaponRoot.rotation.z=0}},78)}
  function switchWeapon(){if(reloading)return;weaponIndex=(weaponIndex+1)%keysW.length;weaponKey=keysW[weaponIndex];if(mode==='online')send({type:'switch',weapon:weaponKey});updateWeapon()}
  function reload(){if(!alive||reloading)return;const d=defs[weaponKey],a=ammo[weaponKey];if(a.clip>=d.clip||a.reserve<=0)return;reloading=true;reloadStart=performance.now();reloadDone=reloadStart+d.reload;msg('RECARREGANDO...');if(mode==='online')send({type:'reload',weapon:weaponKey});}
  function completeLocalReload(){const d=defs[weaponKey],a=ammo[weaponKey],need=d.clip-a.clip,take=Math.min(need,a.reserve);a.clip+=take;a.reserve-=take;reloading=false;updateHUD();msg(mode==='training'?'TREINO':'VALENDO!')}
  function shoot(){if(!started||!alive||reloading)return;const d=defs[weaponKey],a=ammo[weaponKey],now=performance.now()/1000;if(now-lastShot<d.delay)return;if(a.clip<=0){reload();return}lastShot=now;muzzle();if(mode==='online'){a.clip--;const from=camera.getWorldPosition(new THREE.Vector3()),dir=camera.getWorldDirection(new THREE.Vector3()),to=from.clone().add(dir.multiplyScalar(18));tracer(from,to,d.color);renderer.render(scene,camera);send({type:'shoot',weapon:weaponKey,yaw,pitch});updateHUD();return}a.clip--;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const objs=[];enemy.traverse(o=>{if(o.isMesh)objs.push(o)});const hits=ray.intersectObjects(objs,false);const from=camera.getWorldPosition(new THREE.Vector3());const dir=camera.getWorldDirection(new THREE.Vector3());let to=from.clone().add(dir.multiplyScalar(18));if(hits.length){to=hits[0].point.clone();remote.hp=Math.max(0,remote.hp-(weaponKey==='scatter'?16:weaponKey==='rapid'?6:10));flashHit();spark(to,d.color);enemyHitFX();if(remote.hp<=0){enemy.visible=false;myScore++;updateHUD();setTimeout(respawnBot,1600)}}tracer(from,to,d.color);updateHUD()}
  function respawnBot(){remote={x:12,z:12,hp:100,alive:true};enemy.position.set(12,0,12);enemy.visible=true}
  function move(dt){if(!alive)return;let f=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0)+joyY,s=(keys.d?1:0)-(keys.a?1:0)+joyX;const turn=(keys.arrowright?1:0)-(keys.arrowleft?1:0);if(turn)yaw-=turn*2.25*dt;const len=Math.hypot(f,s);if(len>1){f/=len;s/=len}const speed=4.3,fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw),dx=(fx*f+rx*s)*speed*dt,dz=(fz*f+rz*s)*speed*dt,nx=camera.position.x+dx,nz=camera.position.z+dz;if(canStand(nx,camera.position.z))camera.position.x=nx;if(canStand(camera.position.x,nz))camera.position.z=nz;camera.rotation.y=yaw;camera.rotation.x=pitch;const nowMs=performance.now();const bob=(Math.abs(f)+Math.abs(s)>.1?Math.sin(nowMs*.012)*.018:0);weaponRoot.position.y=-.30+bob;if(reloading){const d=defs[weaponKey],p=Math.max(0,Math.min(1,(nowMs-reloadStart)/d.reload)),wave=Math.sin(p*Math.PI);weaponRoot.position.y=-.30-.18*wave;weaponRoot.position.x=.22+.13*wave;weaponRoot.rotation.x=-.015+.75*wave;weaponRoot.rotation.z=-.55*wave}else{weaponRoot.position.x=.22;if(!weaponMeshes[weaponIndex].userData.muzzle.visible){weaponRoot.rotation.x=-.015;weaponRoot.rotation.z=0}}if(reloading&&nowMs>=reloadDone&&mode==='training')completeLocalReload();if(fireHeld)shoot()}
  function bot(dt){if(mode!=='training'||!enemy.visible||!alive)return;const dx=camera.position.x-enemy.position.x,dz=camera.position.z-enemy.position.z,dist=Math.hypot(dx,dz),ang=Math.atan2(-dx,-dz);enemy.rotation.y=ang;if(dist>5){const nx=enemy.position.x+dx/dist*.9*dt,nz=enemy.position.z+dz/dist*.9*dt;if(canStand(nx,enemy.position.z))enemy.position.x=nx;if(canStand(enemy.position.x,nz))enemy.position.z=nz}botCd-=dt;if(dist<13&&botCd<=0){botCd=.85+Math.random()*.45;hp=Math.max(0,hp-6);damageFlash();updateHUD();const from=new THREE.Vector3(enemy.position.x,1.35,enemy.position.z),to=camera.position.clone();tracer(from,to,0xff5c65);if(hp<=0){alive=false;ui.dead.classList.add('on');enemyScore++;updateHUD();setTimeout(()=>{camera.position.set(-12,1.62,-12);hp=100;alive=true;ui.dead.classList.remove('on');updateHUD()},1700)}}}
  function smoothEnemy(dt){if(mode!=='online'||!enemy.userData.hasTarget)return;enemy.position.lerp(enemy.userData.targetPos,Math.min(1,dt*12));let d=((enemy.userData.targetYaw-enemy.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;enemy.rotation.y+=d*Math.min(1,dt*12)}
  function tick(t){if(!started)return;if(isMobile&&t-lastFrame<22){animId=requestAnimationFrame(tick);return}lastFrame=t;const dt=Math.min(.04,(t-prev)/1000||.022);prev=t;move(dt);bot(dt);smoothEnemy(dt);if(mode==='online'&&t-lastSend>100){lastSend=t;send({type:'move',x:camera.position.x,z:camera.position.z,yaw,pitch,weapon:weaponKey})}renderer.render(scene,camera);animId=requestAnimationFrame(tick)}
  function startCommon(){if(started)return;started=true;prev=performance.now();updateHUD();animId=requestAnimationFrame(tick)}
  function startOnline(j){mode='online';myId=j.id;room=j.room;camera.position.set(j.spawn.x,1.62,j.spawn.z);yaw=j.yaw||0;pitch=0;Object.assign(ammo,j.ammo||{});enemy.visible=false;msg('AGUARDANDO O OUTRO JOGADOR...');startCommon()}
  function startTraining(){mode='training';camera.position.set(-12,1.62,-12);yaw=0;pitch=0;remote={x:12,z:12,hp:100,alive:true};enemy.position.set(12,0,12);enemy.visible=true;msg('TREINO');startCommon()}
  function handleMessage(m){if(m.type==='matchStart'){enemy.visible=true;msg('VALENDO!');return}if(m.type==='snapshot'){const me=m.players.find(p=>p.id===myId),op=m.players.find(p=>p.id!==myId);if(me){hp=me.hp;myScore=me.score;alive=me.alive;if(me.ammo)for(const k of Object.keys(me.ammo))Object.assign(ammo[k],me.ammo[k]);ui.dead.classList.toggle('on',!alive)}if(op){enemyScore=op.score;enemy.visible=op.alive;enemy.userData.targetPos.set(op.x,0,op.z);enemy.userData.targetYaw=op.yaw||0;enemy.userData.hasTarget=true}updateHUD();return}if(m.type==='shot'){const from=new THREE.Vector3(m.from.x,m.from.y,m.from.z),to=new THREE.Vector3(m.to.x,m.to.y,m.to.z);if(m.shooter!==myId)tracer(from,to,defs[m.weapon]?.color||0xffffff);if(m.hit){spark(to,defs[m.weapon]?.color||0xffffff);if(m.shooter===myId){flashHit();enemyHitFX()}if(m.target===myId)damageFlash()}return}if(m.type==='reloaded'&&m.id===myId){if(m.ammo)Object.assign(ammo[m.weapon],m.ammo);reloading=false;weaponRoot.position.set(.22,-.30,-.46);weaponRoot.rotation.set(-.015,.015,0);updateHUD();msg('VALENDO!');return}if(m.type==='eliminated'){msg(m.killer===myId?'PONTO SEU!':'VOCÊ FOI DERRUBADO');return}if(m.type==='matchEnd'){msg(m.winner===myId?'VOCÊ VENCEU!':'ADVERSÁRIO VENCEU!');return}if(m.type==='peerLeft'){enemy.visible=false;msg('O OUTRO JOGADOR SAIU');return}if(m.type==='error')msg(m.message||'Erro')}
  function onDisconnect(){msg('CONEXÃO ENCERRADA')}

  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?.85:1.25));renderer.setSize(innerWidth,innerHeight)});
  const movementKeys=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']);
  function resetInputs(){for(const k of Object.keys(keys))keys[k]=false;joyX=joyY=0;fireHeld=false;lookId=null;if(typeof stickId!=='undefined')stickId=null;ui.moveKnob.style.transform='translate(0,0)'}
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(movementKeys.has(k)||e.code==='Space')e.preventDefault();keys[k]=true;if(e.code==='Space'&&!e.repeat)shoot();if(k==='r'&&!e.repeat)reload();if(k==='q'&&!e.repeat)switchWeapon()});
  addEventListener('keyup',e=>{const k=e.key.toLowerCase();keys[k]=false;if(movementKeys.has(k)||e.code==='Space')e.preventDefault()});
  addEventListener('blur',resetInputs);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInputs()});
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==renderer.domElement)resetInputs()});
  renderer.domElement.addEventListener('pointerdown',e=>{if(innerWidth<=850)return;if(document.pointerLockElement!==renderer.domElement){renderer.domElement.requestPointerLock().catch(()=>{});return}if(e.button===0){e.preventDefault();shoot()}});
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0025;pitch-=e.movementY*.0022;pitch=Math.max(-1.05,Math.min(1.05,pitch))}});
  let stickId=null;function stickMove(e){if(e.pointerId!==stickId)return;const r=ui.moveStick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,l=Math.hypot(dx,dy),max=r.width*.34,s=Math.min(1,max/(l||1)),x=dx*s,y=dy*s;joyX=x/max;joyY=-y/max;ui.moveKnob.style.transform=`translate(${x}px,${y}px)`}ui.moveStick.addEventListener('pointerdown',e=>{stickId=e.pointerId;ui.moveStick.setPointerCapture(e.pointerId);stickMove(e)});ui.moveStick.addEventListener('pointermove',stickMove);function endStick(e){if(e.pointerId!==stickId)return;stickId=null;joyX=joyY=0;ui.moveKnob.style.transform='translate(0,0)'}ui.moveStick.addEventListener('pointerup',endStick);ui.moveStick.addEventListener('pointercancel',endStick);
  ui.look.addEventListener('pointerdown',e=>{lookId=e.pointerId;lookX=e.clientX;lookY=e.clientY;ui.look.setPointerCapture(e.pointerId)});ui.look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;const dx=e.clientX-lookX,dy=e.clientY-lookY;lookX=e.clientX;lookY=e.clientY;yaw-=dx*.0055;pitch-=dy*.0048;pitch=Math.max(-1.05,Math.min(1.05,pitch))});const endLook=e=>{if(e.pointerId===lookId)lookId=null};ui.look.addEventListener('pointerup',endLook);ui.look.addEventListener('pointercancel',endLook);
  ui.fireBtn.addEventListener('pointerdown',e=>{e.preventDefault();fireHeld=true;shoot();ui.fireBtn.setPointerCapture(e.pointerId)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])ui.fireBtn.addEventListener(ev,e=>{e.preventDefault();fireHeld=false});ui.reloadBtn.addEventListener('pointerdown',e=>{e.preventDefault();reload()});ui.switchBtn.addEventListener('pointerdown',e=>{e.preventDefault();switchWeapon()});

  updateWeapon();
  return {startOnline,startTraining,handleMessage,onDisconnect};
}
