import * as THREE from 'three';

/**
 * The reel frame as a real 3D model, rendered offline (lab.html?only=frame3d) into
 * egypt/frame.webp: polished gold mouldings with rounded bevels, a black-lacquer bed inlaid
 * with lapis, carnelian and turquoise tiles, fluted gold columns with lotus capitals, faceted
 * rubies in gold bezels, and a winged sun whose layered feathers are extruded in gold and lapis.
 * Lit by an environment map so the gold actually reflects. Output: transparent PNG at 2x of
 * (board + pad + bleed) so it drops in place of the painted frame.
 */
export interface FrameDims {
  boardW: number;
  boardH: number;
  pad: number;
  bleed: number;
}

const S = 2;

function roundedRect(x: number, y: number, w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedHole(x: number, y: number, w: number, h: number, r: number): THREE.Path {
  const p = new THREE.Path();
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

/** A ring between two rounded rectangles, extruded with a rounded bevel. */
function ring(o: [number, number, number, number, number], i: [number, number, number, number, number], depth: number, bevel: number): THREE.ExtrudeGeometry {
  const s = roundedRect(...o);
  s.holes.push(roundedHole(...i));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 5, curveSegments: 10 });
}

export async function renderFrame3D(d: FrameDims): Promise<HTMLCanvasElement> {
  const W = d.boardW + d.pad * 2;
  const H = d.boardH + d.pad * 2;
  const CW = W + d.bleed * 2;
  const CH = H + d.bleed * 2;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(CW * S, CH * S, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // studio for the reflections: a dark room with a few bright softboxes and a warm fire below,
  // so polished gold shows deep contrast instead of flat yellow
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.13, 0.06), side: THREE.BackSide })));
  const box = (w: number, h: number, x: number, y: number, z: number, c: THREE.Color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    studio.add(m);
  };
  box(70, 14, -8, 28, 24, new THREE.Color(3.2, 2.9, 2.5)); // long top softbox
  box(14, 50, 34, 4, 20, new THREE.Color(2.2, 1.9, 1.6)); // right strip
  box(60, 16, 0, -30, 22, new THREE.Color(2.6, 1.0, 0.35)); // warm fire glow below
  box(12, 12, -30, -4, 30, new THREE.Color(4, 3.8, 3.4)); // hot spot
  box(90, 30, 0, 0, 42, new THREE.Color(0.55, 0.42, 0.3)); // soft frontal fill
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, 0.03).texture;

  // y up in three; we build in canvas coordinates (y down) and flip the whole group
  const root = new THREE.Group();
  root.scale.y = -1;
  root.position.set(-CW / 2, CH / 2, 0);
  scene.add(root);
  const ox = d.bleed;
  const oy = d.bleed;

  const camera = new THREE.OrthographicCamera(-CW / 2, CW / 2, CH / 2, -CH / 2, 1, 2000);
  camera.position.set(0, 0, 800);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
  key.position.set(-500, 500, 350);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = -CW / 2;
  sc.right = CW / 2;
  sc.top = CH / 2;
  sc.bottom = -CH / 2;
  sc.near = 1;
  sc.far = 2000;
  key.shadow.bias = -0.001;
  scene.add(key);
  const rimL = new THREE.DirectionalLight(0xff6a40, 0.9);
  rimL.position.set(500, -300, 300);
  scene.add(rimL);
  scene.add(new THREE.AmbientLight(0xffffff, 0.05));

  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffcc66, metalness: 1, roughness: 0.13, envMapIntensity: 1.7 });
  const goldDark = new THREE.MeshPhysicalMaterial({ color: 0xc07a1a, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x140606, metalness: 0.2, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const lapis = new THREE.MeshPhysicalMaterial({ color: 0x0f2a8a, metalness: 0.1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const carnelian = new THREE.MeshPhysicalMaterial({ color: 0x9a1a0a, metalness: 0.1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
  const turq = new THREE.MeshPhysicalMaterial({ color: 0x0f7a76, metalness: 0.1, roughness: 0.2, clearcoat: 1 });
  const ruby = new THREE.MeshPhysicalMaterial({ color: 0xff1020, metalness: 0, roughness: 0.05, transmission: 0.3, thickness: 6, ior: 1.76, clearcoat: 1, emissive: 0x6a0004, emissiveIntensity: 0.8, envMapIntensity: 2 });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, z = 0) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.z = z;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  const win: [number, number, number, number] = [ox + d.pad - 4, oy + d.pad - 4, d.boardW + 8, d.boardH + 8];
  // lacquer bed
  add(ring([ox, oy, W, H, 14], [win[0], win[1], win[2], win[3], 6], 6, 2), lacquer, 0);
  // half-round gold bars: curvature is what makes polished metal read as metal
  const bar = (x0: number, y0: number, x1: number, y1: number, r: number, mat: THREE.Material, z: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const g = new THREE.CylinderGeometry(r, r, len, 32, 1, false, 0, Math.PI);
    g.rotateY(-Math.PI / 2);
    g.rotateZ(-Math.atan2(x1 - x0, y1 - y0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    const m = add(g, mat, z);
    m.scale.z = 0.85;
    return m;
  };
  const loop = (x: number, y: number, w: number, h: number, r: number, mat: THREE.Material, z: number) => {
    bar(x, y, x + w, y, r, mat, z);
    bar(x, y + h, x + w, y + h, r, mat, z);
    bar(x, y, x, y + h, r, mat, z);
    bar(x + w, y, x + w, y + h, r, mat, z);
  };
  // outer moulding: a fat rounded bar and a thin bead inside it
  loop(ox + 5, oy + 5, W - 10, H - 10, 6, gold, 6);
  loop(ox + 14, oy + 14, W - 28, H - 28, 2.2, goldDark, 7);
  // inner bead around the window
  loop(win[0] - 4, win[1] - 4, win[2] + 8, win[3] + 8, 4.5, gold, 6);

  // inlaid tiles on the top and bottom rails
  const tileY = [oy + d.pad / 2 - 4, oy + H - d.pad / 2 - 4];
  const mats = [lapis, gold, carnelian, gold, turq, gold];
  for (const ty of tileY) {
    let k = 0;
    for (let x = ox + 70; x < ox + W - 70; x += 15, k++) {
      const g = new THREE.ExtrudeGeometry(roundedRect(x, ty, 12, 8, 2.5), { depth: 1.5, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.2, bevelSegments: 4 });
      add(g, mats[k % mats.length], 9);
    }
  }
  // fluted columns on the sides with lotus capitals
  for (const cx of [ox + d.pad / 2, ox + W - d.pad / 2]) {
    const h = H - d.pad * 2 - 30;
    const col = new THREE.CylinderGeometry(11, 11, h, 24, 1, false, 0, Math.PI);
    col.rotateY(-Math.PI / 2);
    col.translate(cx, oy + H / 2, 0);
    const m = add(col, gold, 8);
    m.scale.z = 0.8;
    for (let f = -2; f <= 2; f++) {
      const fl = new THREE.BoxGeometry(1.2, h, 2);
      fl.translate(cx + f * 4.2, oy + H / 2, 0);
      add(fl, goldDark, 18);
    }
    for (const [yy, dir] of [[oy + d.pad + 18, 1], [oy + H - d.pad - 18, -1]] as const) {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(new THREE.Vector2(9 + Math.sin(t * Math.PI * 0.5) * 9 + t * 2, t * 22));
      }
      const lotus = new THREE.LatheGeometry(pts, 24, 0, Math.PI);
      lotus.rotateY(-Math.PI / 2);
      if (dir < 0) lotus.rotateZ(Math.PI);
      lotus.translate(cx, yy - dir * 11, 0);
      add(lotus, gold, 10);
    }
  }
  // corner blocks with faceted rubies
  const corners: [number, number][] = [
    [ox + d.pad / 2, oy + d.pad / 2],
    [ox + W - d.pad / 2, oy + d.pad / 2],
    [ox + d.pad / 2, oy + H - d.pad / 2],
    [ox + W - d.pad / 2, oy + H - d.pad / 2],
  ];
  for (const [x, y] of corners) {
    const blk = new THREE.ExtrudeGeometry(roundedRect(x - 22, y - 21, 44, 42, 7), { depth: 6, bevelEnabled: true, bevelThickness: 9, bevelSize: 6, bevelSegments: 10 });
    add(blk, gold, 6);
    const bez = new THREE.TorusGeometry(13, 3, 12, 32);
    bez.translate(x, y, 0);
    add(bez, goldDark, 24);
    const gem = new THREE.IcosahedronGeometry(11, 1);
    gem.scale(1, 1, 0.6);
    gem.translate(x, y, 0);
    add(gem, ruby, 26);
  }

  // winged sun crowning the top rail
  const crown = (cx: number, cy: number, span: number, z: number) => {
    const tiers: [number, THREE.Material, number][] = [
      [1, gold, 0],
      [0.8, lapis, 5],
      [0.6, gold, 10],
    ];
    tiers.forEach(([k, mat, dz], row) => {
      for (const side of [-1, 1]) {
        const len = span * k;
        const n = 11 - row * 2;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const fx = cx + side * (span * 0.1 + t * (len - span * 0.1));
          const fy = cy - 6 - row * 7 - Math.sin(t * Math.PI * 0.9) * span * 0.07 + t * t * span * 0.03;
          const fh = span * (0.1 - row * 0.014) * (1 - t * 0.5);
          const fw = (len - span * 0.1) / (n - 1) + 9;
          const sh = new THREE.Shape();
          sh.moveTo(-fw / 2, fh * 0.35);
          sh.lineTo(fw / 2, fh * 0.35);
          sh.quadraticCurveTo(fw / 2 + side * fw * 0.25, -fh * 0.4, 0, -fh);
          sh.quadraticCurveTo(-fw / 2 - side * fw * 0.1, -fh * 0.4, -fw / 2, fh * 0.35);
          const g = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 5, bevelSize: 3, bevelSegments: 8 });
          g.rotateZ(side * (-0.18 + t * 0.32));
          g.translate(fx, fy, 0);
          add(g, row === 1 ? (i % 2 ? lapis : turq) : mat, z + dz + (n - i) * 0.3);
        }
      }
    });
    const disc = new THREE.CylinderGeometry(span * 0.12, span * 0.12, 8, 48);
    disc.rotateX(Math.PI / 2);
    disc.translate(cx, cy - span * 0.04, 0);
    add(disc, gold, z + 16);
    const bz = new THREE.TorusGeometry(span * 0.085, 3, 12, 40);
    bz.translate(cx, cy - span * 0.04, 0);
    add(bz, goldDark, z + 22);
    const gem = new THREE.IcosahedronGeometry(span * 0.07, 2);
    gem.scale(1, 1, 0.6);
    gem.translate(cx, cy - span * 0.04, 0);
    add(gem, ruby, z + 24);
  };
  crown(ox + W / 2, oy + d.pad / 2 - 2, Math.min(W * 0.3, 380), 14);
  crown(ox + W / 2, oy + H - d.pad / 2 + 2, 120, 14);

  // a soft contact shadow under everything, on an invisible plane
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(CW * 2, CH * 2), new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadowPlane.position.z = -2;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  renderer.render(scene, camera);
  const [out, ctx] = (() => {
    const c = document.createElement('canvas');
    c.width = CW * S;
    c.height = CH * S;
    return [c, c.getContext('2d')!] as const;
  })();
  // drop shadow under the frame, then the render, then punch the window (nothing covers the reels)
  ctx.save();
  ctx.filter = `blur(${20 * S}px)`;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect((ox + 6) * S, (oy + 16) * S, W * S, H * S);
  ctx.restore();
  ctx.drawImage(renderer.domElement, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.roundRect(win[0] * S, win[1] * S, win[2] * S, win[3] * S, 6 * S);
  ctx.fill();
  renderer.dispose();
  return out;
}
