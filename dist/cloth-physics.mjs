// Position-based cloth dynamics. Rest lengths resist stretching; diagonal and
// two-hop constraints provide shear and bending resistance. All time steps are fixed.
export class VeilCloth {
  constructor(width, height, columns = 44, rows = 32) {
    this.width = width; this.height = height;
    this.columns = columns; this.rows = rows;
    this.count = (columns + 1) * (rows + 1);
    this.position = new Float64Array(this.count * 3);
    this.previous = new Float64Array(this.count * 3);
    this.normals = new Float32Array(this.count * 3);
    this.uv = new Float32Array(this.count * 2);
    this.constraints = [];
    this.opening = 0; this.target = 0; this.speed = 0; this.time = 0;
    this.grab = null;
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      const i = y * (columns + 1) + x, u = x / columns, v = y / rows;
      this.position[i * 3] = u * (width + 22) - 11;
      this.position[i * 3 + 1] = v * (height + 20) - 8;
      this.position[i * 3 + 2] = Math.cos(u * Math.PI * 12) * 8;
      this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    }
    this.previous.set(this.position);
    const link = (a, b, stiffness) => {
      const p = this.position, ai = a * 3, bi = b * 3;
      this.constraints.push([ai, bi, Math.hypot(p[ai] - p[bi], p[ai+1] - p[bi+1], p[ai+2] - p[bi+2]), stiffness]);
    };
    const indices = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      const a = y * (columns + 1) + x;
      if (x < columns) link(a, a + 1, .94);
      if (y < rows) link(a, a + columns + 1, .94);
      if (x < columns && y < rows) {
        link(a, a + columns + 2, .28); link(a + 1, a + columns + 1, .28);
        indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
      }
      if (x < columns - 1) link(a, a + 2, .07);
      if (y < rows - 1) link(a, a + 2 * (columns + 1), .10);
    }
    this.indices = new Uint16Array(indices);
    this.updateNormals();
  }

  setOpening(value) { this.target = Math.max(0, Math.min(1, value)); }

  snapOpening(value) {
    this.setOpening(value); this.opening=this.target; this.speed=0;this.grab=null;
    for(let i=0;i<this.count;i++){
      const u=this.uv[i*2],v=this.uv[i*2+1],j=i*3;
      this.position[j]=this.opening*this.width*.935+u*(this.width*(1-this.opening*.94)+22)-11;
      this.position[j+1]=v*(this.height+20)-8;
      this.position[j+2]=Math.cos(u*Math.PI*12+v*.5)*(8+this.opening*36)*(.8+v*.2);
    }
    this.previous.set(this.position);
    for(let i=0;i<12;i++)this.step(false);
    this.previous.set(this.position);
  }

  startGrab(x, y) {
    let nearest = -1, best = Infinity;
    for (let i = this.columns + 1; i < this.count; i++) {
      const d = Math.hypot(this.position[i*3] - x, this.position[i*3+1] - y);
      if (d < best) { best = d; nearest = i; }
    }
    if (best > this.width * .45) return;
    const points = [], center = nearest * 3, radius = Math.max(42, this.width * .09);
    for (let i = this.columns + 1; i < this.count; i++) {
      const j = i * 3, dx = this.position[j] - this.position[center], dy = this.position[j+1] - this.position[center+1];
      const distance = Math.hypot(dx, dy);
      if (distance < radius) points.push({j, dx: this.position[j] - x, dy: this.position[j+1] - y, weight: (1-distance/radius) ** 2});
    }
    this.grab = {x, y, points};
  }
  moveGrab(x, y) { if (this.grab) { this.grab.x = x; this.grab.y = y; } }
  releaseGrab() { this.grab = null; }

  pinRail() {
    for (let x = 0; x <= this.columns; x++) {
      const i = x * 3, u = x / this.columns;
      this.position[i] = this.opening * this.width * .935 + u * (this.width * (1 - this.opening * .94) + 22) - 11;
      this.position[i+1] = -8;
      this.position[i+2] = Math.cos(u * Math.PI * 12) * (8 + this.opening * 30);
    }
  }

  step(breeze = true) {
    const dt = 1/60, dt2 = dt*dt, p = this.position, old = this.previous;
    this.time += dt;
    this.speed = (this.speed + (this.target-this.opening)*.075)*.76;
    this.opening = Math.max(0, Math.min(1, this.opening + this.speed));
    for (let i = this.columns + 1; i < this.count; i++) {
      const j = i*3, u = this.uv[i*2], v = this.uv[i*2+1];
      const gatherX = this.opening*this.width*.935 + u*(this.width*(1-this.opening*.94)+22)-11;
      const foldZ = Math.cos(u*Math.PI*12 + v*.5) * (8+this.opening*36) * (.8+v*.2);
      const air = breeze ? Math.sin(this.time*1.3+v*4+u*5)*13*v : 0;
      const fx = (gatherX-p[j])*24;
      const fy = 330 + (v*(this.height+20)-8-p[j+1])*2;
      const fz = (foldZ-p[j+2])*15 + air;
      const forces = [fx,fy,fz];
      for (let k=0;k<3;k++) {
        const current = p[j+k];
        p[j+k] += (current-old[j+k])*.965 + forces[k]*dt2;
        old[j+k] = current;
      }
    }
    for (let iteration=0;iteration<7;iteration++) {
      this.pinRail();
      for (const [a,b,rest,stiffness] of this.constraints) {
        const dx=p[b]-p[a], dy=p[b+1]-p[a+1], dz=p[b+2]-p[a+2];
        const distance=Math.hypot(dx,dy,dz) || .00001;
        const correction=(distance-rest)/distance*.5*stiffness;
        p[a]+=dx*correction; p[a+1]+=dy*correction; p[a+2]+=dz*correction;
        p[b]-=dx*correction; p[b+1]-=dy*correction; p[b+2]-=dz*correction;
      }
      if (this.grab) for (const point of this.grab.points) {
        const {j,dx,dy,weight}=point;
        p[j]+=(this.grab.x+dx-p[j])*.55*weight;
        p[j+1]+=(this.grab.y+dy-p[j+1])*.55*weight;
        p[j+2]+=(35-p[j+2])*.15*weight;
      }
    }
    this.pinRail();
    this.updateNormals();
  }

  updateNormals() {
    const p=this.position, n=this.normals, stride=this.columns+1;
    for(let y=0;y<=this.rows;y++) for(let x=0;x<=this.columns;x++) {
      const i=y*stride+x, l=(y*stride+Math.max(0,x-1))*3, r=(y*stride+Math.min(this.columns,x+1))*3;
      const t=(Math.max(0,y-1)*stride+x)*3, b=(Math.min(this.rows,y+1)*stride+x)*3;
      const ax=p[r]-p[l], ay=p[r+1]-p[l+1], az=p[r+2]-p[l+2];
      const bx=p[b]-p[t], by=p[b+1]-p[t+1], bz=p[b+2]-p[t+2];
      const nx=ay*bz-az*by, ny=az*bx-ax*bz, nz=ax*by-ay*bx;
      const length=Math.hypot(nx,ny,nz)||1;
      n[i*3]=nx/length;n[i*3+1]=ny/length;n[i*3+2]=nz/length;
    }
  }
}
