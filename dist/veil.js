import {VeilCloth} from './cloth-physics.mjs?v=4';

const stage=document.querySelector('.veil-stage');
const canvas=stage.querySelector('canvas');
const grip=stage.querySelector('.veil-grip');
const toggle=document.querySelector('.veil-toggle');
const hint=document.querySelector('.veil-hint');
const announcement=document.querySelector('.veil-status');
const gatedContent=document.querySelector('.veil-gated-content');
const gateMessage=document.querySelector('.veil-gate-message');
const footer=document.querySelector('.footer');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let cloth,gl,program,buffers,raf=0,last=0,accumulator=0,visible=false,settleFrames=0;
let target=0,pointer=null,ignoreClick=false,width=0,height=0;
const T=window.I18N||{};

const vertexSource=`
precision mediump float;
attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
uniform vec2 size;
varying vec2 fabricUV; varying vec3 clothNormal; varying float depth;
void main(){
  float perspective=1500.0/(1500.0-position.z);
  vec2 point=(position.xy-size*.5)*perspective+size*.5;
  gl_Position=vec4(point.x/size.x*2.0-1.0,1.0-point.y/size.y*2.0,0.0,1.0);
  fabricUV=uv; clothNormal=normal; depth=position.z;
}`;
const fragmentSource=`
precision mediump float;
varying vec2 fabricUV; varying vec3 clothNormal; varying float depth;
uniform vec2 size; uniform float lightTime;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec3 n=normalize(clothNormal);
  float diffuse=abs(dot(n,normalize(vec3(-.55,-.35,.85))));
  float sheen=pow(abs(dot(n,normalize(vec3(.25,-.45,1.0)))),14.0);
  float gleam=pow(abs(dot(n,normalize(vec3(-.35,.30,1.0)))),34.0);
  vec2 threads=fabricUV*size/2.2;
  float warp=pow(.5+.5*sin(threads.x*6.28318),7.0);
  float weft=pow(.5+.5*sin(threads.y*6.28318),7.0);
  float fiber=(warp+weft)*.5;
  float edge=1.0-smoothstep(.0,.009,min(min(fabricUV.x,1.0-fabricUV.x),1.0-fabricUV.y));
  // Embroidery lives in fabric coordinates, so stitches and pearls follow every fold.
  float hemY=(1.0-fabricUV.y)*size.y;
  float repeatX=mod(fabricUV.x*size.x,36.0)-18.0;
  float scallop=5.0+3.0*cos(repeatX*3.14159/18.0);
  float seam=1.0-smoothstep(.65,1.6,abs(hemY-scallop-3.0));
  float arch=1.0-smoothstep(.65,1.7,abs(length(vec2(repeatX,(hemY-17.0)*1.05))-14.0));
  float seamTop=1.0-smoothstep(.45,1.15,abs(hemY-39.0));
  float stitch=(.65+.35*sin(fabricUV.x*size.x*2.8))*seamTop;
  vec2 pearlPoint=vec2(repeatX,hemY-12.0);
  float pearl=1.0-smoothstep(1.1,2.5,length(pearlPoint));
  float embroidery=max(max(seam,arch*.85),stitch*.8);
  float band=1.0-smoothstep(38.0,45.0,hemY);
  // Cool moonlit silver palette so the veil lifts away from the warm page.
  vec3 silver=vec3(.965,.985,1.0);
  vec3 shadow=vec3(.58,.64,.76);
  vec3 color=mix(shadow,silver,.40+.58*diffuse)+fiber*.03;
  // Iridescent sheen: pale opal tint drifting across the highlight.
  vec3 opal=mix(vec3(.82,.90,1.0),vec3(1.0,.94,1.0),.5+.5*sin(n.x*7.0+n.y*5.0+lightTime*.5));
  color+=opal*sheen*.20+vec3(.90,.95,1.0)*gleam*.22;
  // Heavenly light sweep gliding diagonally across the fabric.
  float sweep=pow(.5+.5*sin((fabricUV.x+fabricUV.y*.55)*7.0-lightTime*.65),9.0);
  color+=vec3(.85,.92,1.0)*sweep*(.10+.14*diffuse);
  float grazing=1.0-abs(n.z);
  float alpha=min(1.0,.992+grazing*.008+fiber*.008+band*.008);
  color=mix(color,vec3(.90,.94,1.0),band*.14+embroidery*.48);
  color+=embroidery*(.12+.12*sheen)+pearl*.18;
  float beadIndex=floor(fabricUV.x*size.x/36.0);
  float catchLight=pow(max(0.0,sin(lightTime*.85+beadIndex*2.399+n.x*6.0+n.y*4.0)),16.0);
  float star=exp(-abs(pearlPoint.x)*3.5-abs(pearlPoint.y)*.40)
            +exp(-abs(pearlPoint.y)*3.5-abs(pearlPoint.x)*.40);
  color+=vec3(.95,.98,1.0)*min(1.0,star)*catchLight*.80;
  // Scattered glitter: one tiny sequin per cell, twinkling out of phase.
  vec2 cell=floor(fabricUV*size/11.0);
  vec2 inCell=fract(fabricUV*size/11.0)-.5;
  float seed=hash(cell);
  vec2 sparkPos=inCell-(vec2(hash(cell+7.31),hash(cell+3.17))-.5)*.62;
  float twinkle=pow(max(0.0,sin(lightTime*(1.2+seed*1.8)+seed*44.0+n.x*5.0+n.y*4.0)),18.0);
  float sparkStar=exp(-abs(sparkPos.x)*26.0-abs(sparkPos.y)*6.0)
                 +exp(-abs(sparkPos.y)*26.0-abs(sparkPos.x)*6.0)
                 +exp(-dot(sparkPos,sparkPos)*130.0)*.8;
  float glitter=min(1.0,sparkStar)*twinkle*step(.35,seed)*(.45+.55*diffuse);
  color+=vec3(1.0,1.0,1.0)*glitter*.85;
  alpha*=smoothstep(scallop-1.0,scallop,hemY);
  gl_FragColor=vec4(color*alpha,alpha);
}`;

function compile(type,source){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)||'Cloth shader unavailable');
  return shader;
}
function initRenderer(){
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'low-power'});
  if(!gl) return false;
  program=gl.createProgram();
  gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'Cloth rendering unavailable');
  gl.useProgram(program);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  buffers={};
  for(const [name,length] of [['position',3],['normal',3],['uv',2]]){
    buffers[name]=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffers[name]);
    const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,length,gl.FLOAT,false,0,0);
  }
  buffers.index=gl.createBuffer();stage.dataset.renderer='webgl';return true;
}

function resize(){
  const rect=stage.getBoundingClientRect();
  if(rect.width<1||rect.height<1) return;
  if(Math.abs(rect.width-width)<1&&Math.abs(rect.height-height)<1) return;
  width=rect.width;height=rect.height;
  const oldOpening=cloth?.opening??target;
  cloth=new VeilCloth(width,height,width<500?32:44,width<500?34:32);
  cloth.opening=oldOpening;cloth.setOpening(target);
  if(oldOpening>.05){cloth.snapOpening(oldOpening);cloth.setOpening(target);}
  const dpr=Math.min(devicePixelRatio||1,1.75);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  if(gl){
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffers.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,cloth.indices,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffers.uv);gl.bufferData(gl.ARRAY_BUFFER,cloth.uv,gl.STATIC_DRAW);
    gl.uniform2f(gl.getUniformLocation(program,'size'),width,height);
  }
  settleFrames=150;wake();
}
function draw(){
  if(!gl||!cloth)return;
  gl.uniform1f(gl.getUniformLocation(program,'lightTime'),reducedMotion.matches?0:performance.now()/1000%120);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffers.position);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cloth.position),gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffers.normal);gl.bufferData(gl.ARRAY_BUFFER,cloth.normals,gl.DYNAMIC_DRAW);
  gl.drawElements(gl.TRIANGLES,cloth.indices.length,gl.UNSIGNED_SHORT,0);
}
function frame(now){
  raf=0;
  if(!visible||document.hidden||!cloth)return;
  accumulator+=Math.min((now-(last||now))/1000,.05);last=now;
  while(accumulator>=1/60){cloth.step(!reducedMotion.matches);accumulator-=1/60;settleFrames--;}
  draw();
  const moving=pointer||Math.abs(cloth.opening-target)>.001||settleFrames>0;
  if(moving||(!reducedMotion.matches&&target<.99))raf=requestAnimationFrame(frame);
}
function wake(){if(!raf&&visible&&!document.hidden){last=0;accumulator=0;raf=requestAnimationFrame(frame);}}
function updateState(open){
  gatedContent.hidden=!open;
  gatedContent.inert=!open;
  gateMessage.hidden=open;
  footer.hidden=!open;
  stage.classList.toggle('is-revealed',open);
  grip.setAttribute('aria-expanded',String(open));
  grip.tabIndex=open?-1:0;
  toggle.textContent=open?(T.veilLower||'Schleier wieder senken'):(T.veilShow||'Ablauf direkt anzeigen');
  hint.textContent=open?(T.veilHintOpen||'Wir freuen uns auf jeden dieser Momente mit euch.'):(T.veilHintClosed||'Den Saum unten greifen und nach oben heben.');
}
function reveal(open,instant=false){
  target=open?1:0;cloth?.setOpening(target);settleFrames=180;updateState(open);
  if(instant&&cloth){cloth.snapOpening(target);draw();}
  announcement.textContent=open?(T.veilRevealed||'Der Tagesablauf ist aufgedeckt.'):(T.veilClosed||'Der Schleier ist wieder geschlossen.');
  wake();
}
function localPoint(event){const r=stage.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
function down(event){
  if(event.button!==0||pointer||target===1)return;
  const point=localPoint(event);
  pointer={id:event.pointerId,startX:point.x,startY:point.y,lastX:point.x,lastY:point.y,start:cloth?.opening??0,moved:false};
  event.currentTarget.setPointerCapture(event.pointerId);
  cloth?.startGrab(point.x,point.y);settleFrames=180;wake();
}
function move(event){
  if(!pointer||event.pointerId!==pointer.id)return;
  const point=localPoint(event),dx=point.x-pointer.startX,dy=point.y-pointer.startY;
  if(!pointer.moved&&Math.abs(dy)<7)return;
  if(!pointer.moved&&Math.abs(dx)>Math.abs(dy)*1.4){end(event,true);return;}
  pointer.moved=true;stage.classList.add('is-dragging');
  target=Math.max(0,Math.min(1,pointer.start-dy/(height*.74)));
  cloth?.setOpening(target);cloth?.moveGrab(Math.min(width+30,Math.max(-30,point.x)),Math.min(height+30,Math.max(-30,point.y)));
  pointer.lastX=point.x;pointer.lastY=point.y;
  if(!gl)stage.querySelector('.veil-fallback').style.transform=`scaleY(${1-target})`;
  wake();
}
function end(event,cancelled=false){
  if(!pointer||event.pointerId!==pointer.id)return;
  const moved=pointer.moved;
  ignoreClick=moved;
  pointer=null;
  if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  cloth?.releaseGrab();stage.classList.remove('is-dragging');
  setTimeout(()=>{ignoreClick=false;},0);
  if(moved){stage.querySelector('.veil-fallback').style.transform='';reveal(!cancelled&&target>.30);}
  else{settleFrames=120;wake();}
}
for(const surface of [grip]){
  surface.addEventListener('pointerdown',down);surface.addEventListener('pointermove',move);
  surface.addEventListener('pointerup',event=>end(event));surface.addEventListener('pointercancel',event=>end(event,true));
  surface.addEventListener('lostpointercapture',event=>{if(pointer)end(event,true);});
}
grip.addEventListener('click',()=>{if(ignoreClick){ignoreClick=false;return;}reveal(true);});
grip.addEventListener('keydown',event=>{
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){
    event.preventDefault();target=Math.max(0,Math.min(1,target+(event.key==='ArrowUp'?.2:-.2)));cloth?.setOpening(target);settleFrames=120;wake();updateState(target===1);
  }
});
toggle.addEventListener('click',()=>reveal(target<.5,true));
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(raf);raf=0;gl=null;stage.dataset.renderer='fallback';});
canvas.addEventListener('webglcontextrestored',()=>{try{initRenderer();width=0;resize();}catch{gl=null;stage.dataset.renderer='fallback';}});
try{initRenderer();}catch(error){gl=null;stage.dataset.renderer='fallback';stage.dataset.rendererError=error.message;}
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(entries=>{
  visible=entries[0].isIntersecting;
  if(visible){resize();wake();}else{cancelAnimationFrame(raf);raf=0;last=0;}
},{rootMargin:'100px'}).observe(stage);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
reducedMotion.addEventListener('change',()=>{settleFrames=90;wake();});
resize();
