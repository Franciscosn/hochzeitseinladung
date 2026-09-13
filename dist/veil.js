import {VeilCloth} from './cloth-physics.mjs?v=4';

const stage=document.querySelector('.veil-stage');
const canvas=stage.querySelector('canvas');
const grip=stage.querySelector('.veil-grip');
const toggle=document.querySelector('.veil-toggle');
const hint=document.querySelector('.veil-hint');
const announcement=document.querySelector('.veil-status');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let cloth,gl,program,buffers,raf=0,last=0,accumulator=0,visible=false,settleFrames=0;
let target=0,pointer=null,ignoreClick=false,width=0,height=0;

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
uniform vec2 size;
void main(){
  vec3 n=normalize(clothNormal);
  float diffuse=abs(dot(n,normalize(vec3(-.55,-.35,.85))));
  float sheen=pow(abs(dot(n,normalize(vec3(.25,-.45,1.0)))),14.0);
  vec2 threads=fabricUV*size/2.2;
  float warp=pow(.5+.5*sin(threads.x*6.28318),7.0);
  float weft=pow(.5+.5*sin(threads.y*6.28318),7.0);
  float fiber=(warp+weft)*.5;
  float edge=1.0-smoothstep(.0,.009,min(min(fabricUV.x,1.0-fabricUV.x),1.0-fabricUV.y));
  float hem=.5+.5*sin(fabricUV.y*290.0);
  vec3 ivory=vec3(.995,.975,.93);
  vec3 shadow=vec3(.68,.62,.53);
  vec3 color=mix(shadow,ivory,.42+.56*diffuse)+sheen*.10+fiber*.025;
  float grazing=1.0-abs(n.z);
  float alpha=min(.98,.85+grazing*.10+fiber*.035+edge*.04);
  color=mix(color,vec3(.89,.84,.73),edge*.17*hem);
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
  stage.classList.toggle('is-revealed',open);
  grip.setAttribute('aria-expanded',String(open));
  grip.tabIndex=open?-1:0;
  toggle.textContent=open?'Schleier wieder senken':'Ablauf direkt anzeigen';
  hint.textContent=open?'Wir freuen uns auf jeden dieser Momente mit euch.':'Den Saum unten greifen und nach oben heben.';
}
function reveal(open,instant=false){
  target=open?1:0;cloth?.setOpening(target);settleFrames=180;updateState(open);
  if(instant&&cloth){cloth.snapOpening(target);draw();}
  announcement.textContent=open?'Der Tagesablauf ist aufgedeckt.':'Der Schleier ist wieder geschlossen.';
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
    event.preventDefault();target=Math.max(0,Math.min(1,target+(event.key==='ArrowUp'?.2:-.2)));cloth?.setOpening(target);settleFrames=120;wake();if(target===1)updateState(true);
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
