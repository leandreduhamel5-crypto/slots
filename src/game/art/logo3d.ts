import * as THREE from 'three';
import opentype from 'opentype.js';
import cinzelUrl from '@fontsource/cinzel/files/cinzel-latin-900-normal.woff?url';
import cinzelDecoUrl from '@fontsource/cinzel-decorative/files/cinzel-decorative-latin-900-normal.woff?url';

/**
 * The title as a real 3D logo, rendered offline (lab.html?only=logo3d) into egypt/logo.webp:
 * Cinzel glyphs turned into extruded, beveled solids of polished gold, an Eye of Horus emblem
 * in relief with a ruby iris, gold rules with diamond studs, lit by a studio environment so the
 * metal catches real highlights. A 2D pass adds the dark enamel outline, a red ember glow and
 * molten veins inside INFECTION. Output 2200×760 (2× the 1100×380 logo space), transparent.
 */
const OUT_W = 2200;
const OUT_H = 760;

async function loadFont(url: string): Promise<opentype.Font> {
  const buf = await (await fetch(url)).arrayBuffer();
  return opentype.parse(buf);
}

/** Glyph outlines of a string as THREE shapes (y up), plus the advance width. */
function textShapes(font: opentype.Font, text: string, size: number, tracking: number): { shapes: THREE.Shape[]; width: number } {
  const shapes: THREE.Shape[] = [];
  let x = 0;
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => {
    const path = g.getPath(x, 0, size);
    const sp = new THREE.ShapePath();
    for (const c of path.commands) {
      if (c.type === 'M') sp.moveTo(c.x, -c.y);
      else if (c.type === 'L') sp.lineTo(c.x, -c.y);
      else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    }
    shapes.push(...sp.toShapes());
    x += (g.advanceWidth ?? 0) * (size / font.unitsPerEm) + (i < glyphs.length - 1 ? tracking : 0);
  });
  return { shapes, width: x };
}

function studio(renderer: THREE.WebGLRenderer): THREE.Texture {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.09, 0.05), side: THREE.BackSide })));
  const box = (w: number, h: number, x: number, y: number, z: number, c: THREE.Color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  box(80, 12, 0, 30, 22, new THREE.Color(3.4, 3.1, 2.6));
  box(16, 44, -36, 4, 18, new THREE.Color(2.2, 1.9, 1.5));
  box(16, 44, 36, 4, 18, new THREE.Color(2.0, 1.7, 1.3));
  box(70, 14, 0, -30, 20, new THREE.Color(2.8, 0.9, 0.3));
  box(10, 10, -22, 16, 34, new THREE.Color(5, 4.6, 4));
  box(90, 30, 0, 0, 44, new THREE.Color(0.32, 0.2, 0.08));
  return new THREE.PMREMGenerator(renderer).fromScene(s, 0.03).texture;
}

export async function renderLogo3D(): Promise<HTMLCanvasElement> {
  const [deco, cinzel] = await Promise.all([loadFont(cinzelDecoUrl), loadFont(cinzelUrl)]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(OUT_W, OUT_H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(-400, 600, 500);
  scene.add(key);
  const under = new THREE.DirectionalLight(0xff5020, 1.2);
  under.position.set(200, -500, 300);
  scene.add(under);

  // gentle perspective, looking slightly up at the title
  const camera = new THREE.PerspectiveCamera(22, OUT_W / OUT_H, 10, 10000);
  camera.position.set(0, -60, 2950);
  camera.lookAt(0, 0, 0);

  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc860, metalness: 1, roughness: 0.14, envMapIntensity: 1.7 });
  const goldSide = new THREE.MeshPhysicalMaterial({ color: 0xd08a28, metalness: 1, roughness: 0.28, envMapIntensity: 1.3 });
  const darkGold = new THREE.MeshPhysicalMaterial({ color: 0xa0661a, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 });
  const ruby = new THREE.MeshPhysicalMaterial({ color: 0xff1020, roughness: 0.05, transmission: 0.25, thickness: 8, ior: 1.76, clearcoat: 1, emissive: 0x6a0004, emissiveIntensity: 1, envMapIntensity: 2.2 });
  const lapis = new THREE.MeshPhysicalMaterial({ color: 0x14308c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });

  const extrude = (shapes: THREE.Shape[], depth: number, bevel: number) =>
    new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 8, curveSegments: 12 });
  /** Polished-gold grading across a line of text: pale gold top, a bright band, deep copper base. */
  const grade = (g: THREE.BufferGeometry, y0: number, y1: number) => {
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const stops: [number, [number, number, number]][] = [
      [0, [1.0, 0.86, 0.42]],
      [0.3, [1.0, 0.7, 0.18]],
      [0.44, [1.0, 0.96, 0.72]],
      [0.52, [0.98, 0.58, 0.1]],
      [0.8, [0.55, 0.24, 0.03]],
      [1, [0.88, 0.5, 0.12]],
    ];
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, Math.min(1, (y1 - pos.getY(i)) / (y1 - y0)));
      let k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [ta, ca] = stops[k];
      const [tb, cb] = stops[k + 1];
      const u = (t - ta) / (tb - ta);
      for (let c = 0; c < 3; c++) col[i * 3 + c] = ca[c] + (cb[c] - ca[c]) * u;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  };
  const goldGraded = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 1, roughness: 0.2, envMapIntensity: 1.5 });

  // ---- INFECTION
  const inf = textShapes(cinzel, 'INFECTION', 300, 22);
  const infGeo = extrude(inf.shapes, 26, 14);
  infGeo.translate(-inf.width / 2, -250, 0);
  grade(infGeo, -250, -250 + 212);
  scene.add(new THREE.Mesh(infGeo, [goldGraded, goldSide]));

  // ---- cartouche behind INFECTION: red-black lacquer, gold rim, gem studs and gold wings
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x140103, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0, emissive: 0x4a0408, emissiveIntensity: 0.6 });
  const wingGold = gold.clone();
  wingGold.side = THREE.DoubleSide;
  const wingLapis = lapis.clone();
  wingLapis.side = THREE.DoubleSide;
  const pw = inf.width + 290;
  const ph = 270;
  const plate = (w: number, h: number) => {
    const r = h / 2;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -h / 2);
    sh.lineTo(w / 2 - r, -h / 2);
    sh.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    sh.lineTo(-w / 2 + r, h / 2);
    sh.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return sh;
  };
  const plateY = -250 + 100;
  const rim = new THREE.ExtrudeGeometry(plate(pw + 26, ph + 26), { depth: 8, bevelEnabled: true, bevelThickness: 7, bevelSize: 5, bevelSegments: 6, curveSegments: 48 });
  rim.translate(0, plateY, -60);
  scene.add(new THREE.Mesh(rim, gold));
  const bed = new THREE.ExtrudeGeometry(plate(pw, ph), { depth: 10, bevelEnabled: true, bevelThickness: 4, bevelSize: 3, bevelSegments: 4, curveSegments: 48 });
  bed.translate(0, plateY, -48);
  scene.add(new THREE.Mesh(bed, lacquer));
  for (const side of [-1, 1]) {
    // gem at each rounded end
    const g = new THREE.SphereGeometry(26, 40, 20);
    g.scale(1, 1, 0.5);
    g.translate(side * (pw / 2 - 78), plateY, -20);
    scene.add(new THREE.Mesh(g, ruby));
    const bz = new THREE.TorusGeometry(28, 5, 12, 40);
    bz.translate(side * (pw / 2 - 78), plateY, -20);
    scene.add(new THREE.Mesh(bz, gold));
    // gold wings sweeping out of the cartouche
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const len = 230 - i * 22;
      const fh = 30 - i * 2.5;
      const fs = new THREE.Shape();
      const sx = side;
      fs.moveTo(0, -fh / 2);
      fs.quadraticCurveTo(sx * len * 0.6, -fh * 0.9, sx * len, -fh * 0.15);
      fs.quadraticCurveTo(sx * len * 0.55, fh * 0.55, 0, fh / 2);
      fs.lineTo(0, -fh / 2);
      const fg = new THREE.ExtrudeGeometry(fs, { depth: 2, bevelEnabled: true, bevelThickness: 4, bevelSize: 2.5, bevelSegments: 6 });
      fg.rotateZ(sx * (0.42 - t * 0.85));
      fg.translate(side * (pw / 2 + 2), plateY + 70 - i * 24, -70 + i * 2);
      scene.add(new THREE.Mesh(fg, i % 2 ? wingLapis : wingGold));
    }
  }

  // ---- BOOK OF, between gold rules with diamond studs
  const book = textShapes(deco, 'BOOK OF', 110, 30);
  const bookGeo = extrude(book.shapes, 12, 6);
  bookGeo.translate(-book.width / 2, 58, 10);
  grade(bookGeo, 58, 58 + 78);
  scene.add(new THREE.Mesh(bookGeo, [goldGraded, goldSide]));
  for (const side of [-1, 1]) {
    const len = 330;
    const x0 = side * (book.width / 2 + 40);
    const bar = new THREE.CylinderGeometry(4, 4, len, 16);
    bar.rotateZ(Math.PI / 2);
    bar.translate(x0 + side * len / 2, 98, 6);
    scene.add(new THREE.Mesh(bar, darkGold));
    const stud = new THREE.OctahedronGeometry(13);
    stud.scale(1, 1, 0.5);
    stud.translate(x0 + side * (len + 14), 98, 8);
    scene.add(new THREE.Mesh(stud, gold));
    const gem = new THREE.OctahedronGeometry(9);
    gem.scale(1, 1, 0.6);
    gem.translate(x0, 98, 10);
    scene.add(new THREE.Mesh(gem, ruby));
  }

  // ---- Eye of Horus emblem
  const eye = new THREE.Group();
  const stroke = (pts: [number, number][], w: number, mat: THREE.Material, z = 0) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, z)));
    const tube = new THREE.TubeGeometry(curve, 64, w, 12, false);
    const m = new THREE.Mesh(tube, mat);
    m.scale.z = 0.7;
    eye.add(m);
  };
  // brow
  stroke([[-120, 70], [-60, 92], [0, 98], [60, 92], [120, 72]], 10, gold);
  // almond outline and the long kohl tail
  const almondTop: [number, number][] = [[-110, 20], [-55, 52], [0, 60], [55, 50], [105, 22]];
  const almondBot: [number, number][] = [[-110, 20], [-50, -6], [0, -12], [50, -6], [105, 22]];
  stroke(almondTop, 9, gold);
  stroke(almondBot, 9, gold);
  stroke([[105, 22], [150, 24], [190, 20]], 8, gold);
  // the falcon markings
  stroke([[-30, -12], [-44, -48], [-56, -86]], 8, gold);
  stroke([[20, -10], [28, -50], [52, -78], [82, -76], [86, -54], [64, -46]], 8, gold);
  // lapis-enamelled eye white and the ruby iris
  const white = new THREE.Shape();
  white.moveTo(-104, 22);
  white.quadraticCurveTo(0, 74, 100, 24);
  white.quadraticCurveTo(0, -24, -104, 22);
  const wGeo = new THREE.ExtrudeGeometry(white, { depth: 4, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.5, bevelSegments: 3 });
  wGeo.translate(0, 0, -6);
  eye.add(new THREE.Mesh(wGeo, lapis));
  const iris = new THREE.SphereGeometry(30, 48, 24);
  iris.scale(1, 1, 0.55);
  iris.translate(0, 24, 4);
  eye.add(new THREE.Mesh(iris, ruby));
  const bez = new THREE.TorusGeometry(31, 4, 12, 48);
  bez.translate(0, 24, 4);
  eye.add(new THREE.Mesh(bez, gold));
  eye.position.set(0, 268, 0);
  eye.scale.set(1.05, 1.05, 1.05);
  scene.add(eye);

  renderer.render(scene, camera);

  // ---- 2D finishing: enamel outline, ember glow, molten veins in INFECTION
  const out = document.createElement('canvas');
  out.width = OUT_W;
  out.height = OUT_H;
  const ctx = out.getContext('2d')!;
  const src = renderer.domElement;
  const dil = (r: number, color: string) => {
    const c = document.createElement('canvas');
    c.width = OUT_W;
    c.height = OUT_H;
    const x = c.getContext('2d')!;
    const n = Math.max(16, Math.round(r * 2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
    }
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, OUT_W, OUT_H);
    return c;
  };
  // red ember glow
  ctx.save();
  ctx.filter = 'blur(26px)';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(dil(14, '#c81808'), 0, 0);
  ctx.restore();
  // drop shadow and the dark enamel rim that separates gold from any background
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(dil(10, '#000'), 0, 14);
  ctx.restore();
  ctx.drawImage(dil(7, '#1a0604'), 0, 0);
  ctx.drawImage(dil(3.5, '#7a4a10'), 0, 0);
  ctx.drawImage(src, 0, 0);
  renderer.dispose();
  return out;
}
