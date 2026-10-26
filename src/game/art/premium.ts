import { INK, makeCanvas, seeded } from './painters';
import { P, dot, drip, gloss, grunge, groundShadow, layer, lin, line, path, piece, rad } from './paint';

/** Painted premium symbol: base layer, animated parts (same frame), and the emissive bits for the glow. */
export interface PaintedSymbol {
  base: HTMLCanvasElement;
  parts: Record<string, HTMLCanvasElement>;
  glow: HTMLCanvasElement;
}

/** Biohazard pictogram, ink outlined (painted as a stamp then dilated for the outline). */
export function biohazard(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: string, ink = 6): void {
  const S = Math.ceil(R * 2.6);
  const [m, mc] = makeCanvas(S, S);
  const o = S / 2;
  mc.fillStyle = '#000';
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    mc.beginPath();
    mc.arc(o + Math.cos(a) * R * 0.42, o + Math.sin(a) * R * 0.42, R * 0.52, 0, Math.PI * 2);
    mc.fill();
  }
  mc.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    mc.beginPath();
    mc.arc(o + Math.cos(a) * R * 0.58, o + Math.sin(a) * R * 0.58, R * 0.36, 0, Math.PI * 2);
    mc.fill();
  }
  mc.beginPath();
  mc.arc(o, o, R * 0.16, 0, Math.PI * 2);
  mc.fill();
  // ring with gaps
  mc.globalCompositeOperation = 'source-over';
  mc.lineWidth = R * 0.13;
  mc.strokeStyle = '#000';
  mc.beginPath();
  mc.arc(o, o, R * 0.5, 0, Math.PI * 2);
  mc.stroke();
  mc.globalCompositeOperation = 'destination-out';
  mc.lineWidth = R * 0.09;
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 2;
    mc.beginPath();
    mc.moveTo(o, o);
    mc.lineTo(o + Math.cos(a) * R, o + Math.sin(a) * R);
    mc.stroke();
  }
  const tint = (col: string) => {
    const [t, tc] = makeCanvas(S, S);
    tc.drawImage(m, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = col;
    tc.fillRect(0, 0, S, S);
    return t;
  };
  const inkC = tint(INK);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.drawImage(inkC, cx - o + Math.cos(a) * ink, cy - o + Math.sin(a) * ink);
  }
  ctx.drawImage(tint(color), cx - o, cy - o);
}

/* ================================================================== POCHE DE SANG */

export function paintBloodBag(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  groundShadow(ctx, 262, 478, 150, 16);

  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(-0.07);
  ctx.translate(-256, -256);
  gctx.setTransform(ctx.getTransform());

  // hanger tab
  const tab = path((p) => p.roundRect(196, 22, 120, 74, 22));
  piece(ctx, tab, {
    fill: lin(ctx, 0, 22, 0, 96, [[0, '#f4f8fa'], [1, '#b9c7cf']]),
    shadow: '#93a3ad',
    shadowOff: [-10, -10],
    ink: 11,
  });
  const hole = path((p) => p.roundRect(226, 40, 60, 24, 12));
  piece(ctx, hole, { fill: '#2a1622', ink: 9 });

  // tubes / ports below the bag (drawn before the body so it overlaps them)
  const portL = path((p) => p.roundRect(186, 404, 40, 66, 10));
  piece(ctx, portL, { fill: lin(ctx, 186, 0, 226, 0, [[0, '#f4f8fa'], [1, '#aab8c0']]), shadow: '#8e9ea8', shadowOff: [-12, 0], ink: 10 });
  const cap = path((p) => p.roundRect(180, 456, 52, 26, 8));
  piece(ctx, cap, { fill: '#5ad1ff', shadow: '#1f8fbf', shadowOff: [-12, -6], ink: 10 });
  const tube = path((p) => {
    p.moveTo(290, 420);
    p.bezierCurveTo(290, 480, 330, 494, 360, 470);
    p.bezierCurveTo(384, 452, 392, 470, 394, 488);
  });
  line(ctx, tube, 34);
  line(ctx, tube, 20, '#c8102a');
  ctx.save();
  ctx.translate(-4, -4);
  line(ctx, tube, 5, 'rgba(255,170,180,0.9)');
  ctx.restore();
  drip(ctx, 394, 486, 10, 18);

  // bag body
  const bag = path((p) => {
    p.moveTo(132, 78);
    p.lineTo(380, 78);
    p.quadraticCurveTo(424, 78, 426, 124);
    p.bezierCurveTo(434, 220, 432, 330, 418, 380);
    p.quadraticCurveTo(404, 432, 348, 434);
    p.lineTo(164, 434);
    p.quadraticCurveTo(108, 432, 94, 380);
    p.bezierCurveTo(80, 330, 78, 220, 86, 124);
    p.quadraticCurveTo(88, 78, 132, 78);
    p.closePath();
  });
  const surface = (p: Path2D) => {
    p.moveTo(70, 196);
    p.bezierCurveTo(140, 168, 200, 206, 262, 192);
    p.bezierCurveTo(320, 178, 370, 160, 450, 186);
  };
  const blood = path((p) => {
    surface(p);
    p.lineTo(450, 470);
    p.lineTo(70, 470);
    p.closePath();
  });

  // plastic (air part)
  piece(ctx, bag, {
    fill: lin(ctx, 0, 78, 0, 300, [[0, '#f6fafc'], [1, '#c7d5dc']]),
    ink: 0,
  });
  // blood inside
  ctx.save();
  ctx.clip(bag);
  piece(ctx, blood, {
    fill: lin(ctx, 0, 170, 0, 440, [[0, '#ff4a5e'], [0.35, '#d8122e'], [1, '#6a0316']]),
    shadow: '#7e0620',
    shadowOff: [-60, -26],
    shadowSoft: 6,
    ink: 0,
    detail: (d) => {
      // subsurface glow, bottom-left
      d.fillStyle = rad(d, 170, 360, 10, 150, [[0, 'rgba(255,120,120,0.55)'], [1, 'rgba(255,60,80,0)']]);
      d.fillRect(0, 0, P, P);
      // infected sludge swirling in the blood
      const rnd = seeded(41);
      for (let i = 0; i < 7; i++) {
        const x = 130 + rnd() * 260;
        const y = 250 + rnd() * 160;
        const r = 8 + rnd() * 16;
        d.fillStyle = 'rgba(40,4,20,0.55)';
        d.beginPath();
        d.ellipse(x, y, r * 1.6, r, rnd() * 3, 0, Math.PI * 2);
        d.fill();
      }
      // black infection veins creeping through the blood
      d.lineCap = 'round';
      for (const v of [
        [96, 300, 170, 280, 200, 330, 250, 318],
        [420, 260, 360, 290, 380, 340, 320, 360],
        [110, 420, 160, 390, 210, 420, 260, 400],
      ]) {
        const vp = new Path2D();
        vp.moveTo(v[0], v[1]);
        vp.bezierCurveTo(v[2], v[3], v[4], v[5], v[6], v[7]);
        d.strokeStyle = 'rgba(255,90,110,0.5)';
        d.lineWidth = 14;
        d.filter = 'blur(4px)';
        d.stroke(vp);
        d.filter = 'none';
        d.strokeStyle = '#2a0614';
        d.lineWidth = 7;
        d.stroke(vp);
      }
      // bubbles
      for (let i = 0; i < 9; i++) {
        const x = 120 + rnd() * 270;
        const y = 220 + rnd() * 190;
        const r = 3 + rnd() * 7;
        d.strokeStyle = 'rgba(255,190,198,0.8)';
        d.lineWidth = 2.5;
        d.beginPath();
        d.arc(x, y, r, 0, Math.PI * 2);
        d.stroke();
        dot(d, x - r * 0.35, y - r * 0.35, r * 0.3, '#fff', 0.9);
      }
    },
  });
  // meniscus line
  line(ctx, path(surface), 8, '#ff7d8c');
  ctx.save();
  ctx.translate(0, 5);
  line(ctx, path(surface), 4, INK);
  ctx.restore();
  // plastic volume: soft shadow crescent on the right, cool reflected light at the far edge
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const [sh, shc] = layer();
  shc.fillStyle = 'rgb(150,140,190)';
  shc.fill(bag);
  shc.globalCompositeOperation = 'destination-out';
  shc.filter = 'blur(14px)';
  shc.translate(-58, -10);
  shc.fill(bag);
  ctx.drawImage(sh, 0, 0);
  ctx.restore();
  ctx.restore();
  ctx.restore();

  // welded seam band
  ctx.save();
  ctx.clip(bag);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 34;
  ctx.stroke(bag);
  ctx.strokeStyle = 'rgba(120,140,160,0.55)';
  ctx.setLineDash([3, 9]);
  ctx.lineWidth = 30;
  ctx.stroke(bag);
  ctx.setLineDash([]);
  ctx.restore();
  // inner seam ink line
  ctx.save();
  ctx.translate(256, 256);
  ctx.scale(0.93, 0.95);
  ctx.translate(-256, -252);
  line(ctx, bag, 4, 'rgba(23,11,20,0.7)');
  ctx.restore();
  line(ctx, bag, 12);

  // label
  const label = path((p) => p.roundRect(160, 236, 192, 132, 16));
  piece(ctx, label, {
    fill: lin(ctx, 0, 236, 0, 368, [[0, '#fff8ec'], [1, '#eadcc4']]),
    shadow: '#cdb998',
    shadowOff: [-12, -10],
    ink: 9,
    detail: (d) => {
      d.fillStyle = '#d4102c';
      d.fillRect(160, 236, 192, 34);
      d.fillStyle = 'rgba(0,0,0,0.25)';
      d.fillRect(160, 266, 192, 4);
      // barcode
      const rnd = seeded(7);
      let x = 270;
      while (x < 338) {
        const w = 2 + Math.floor(rnd() * 4);
        d.fillStyle = INK;
        d.fillRect(x, 318, w, 34);
        x += w + 2 + Math.floor(rnd() * 3);
      }
      grunge(d, 3, { color: '#8a6a4a', count: 30, size: [1, 4], alpha: 0.35 });
    },
  });
  line(ctx, path((p) => { p.moveTo(160, 270); p.lineTo(352, 270); }), 6);
  // label header text
  ctx.save();
  ctx.font = '900 23px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('SANG  INFECTÉ', 256, 254);
  ctx.restore();
  biohazard(ctx, 214, 320, 46, '#e0213a', 4.5);
  // biohazard-ish drop icon on the label
  const drop = path((p) => {
    p.moveTo(306, 280);
    p.bezierCurveTo(296, 296, 290, 302, 290, 308);
    p.arc(306, 308, 16, Math.PI, 0, true);
    p.bezierCurveTo(322, 302, 316, 296, 306, 280);
  });
  piece(ctx, drop, { fill: '#e0213a', shadow: '#8e0f26', shadowOff: [-6, -4], ink: 6 });
  dot(ctx, 300, 306, 3.5, '#fff');

  // plastic highlights
  gloss(ctx, path((p) => { p.moveTo(116, 140); p.bezierCurveTo(106, 220, 108, 300, 124, 372); }), 13, 0.9);
  gloss(ctx, path((p) => { p.moveTo(140, 106); p.lineTo(232, 104); }), 8, 0.85);
  gloss(ctx, path((p) => { p.moveTo(398, 210); p.bezierCurveTo(404, 250, 402, 290, 396, 320); }), 6, 0.5);
  dot(ctx, 386, 128, 7, '#fff', 0.95);
  dot(ctx, 128, 398, 5, '#fff', 0.8);

  ctx.restore();

  // emissive: the blood
  gctx.save();
  gctx.clip(bag);
  gctx.fillStyle = '#ff2a44';
  gctx.fill(blood);
  gctx.restore();
  return { base: c, parts: {}, glow: g };
}


/* ================================================================== MASQUE À GAZ */

/** Cartoon smoke: merged circles with one ink silhouette, cel-shaded. */
export function smoke(ctx: CanvasRenderingContext2D, puffs: [number, number, number][], col: [string, string, string]): void {
  const blob = path((p) => {
    for (const [x, y, r] of puffs) {
      p.moveTo(x + r, y);
      p.arc(x, y, r, 0, Math.PI * 2);
    }
  });
  // silhouette-only outline: a wide ink stroke under the fill hides the inner arcs
  line(ctx, blob, 18);
  piece(ctx, blob, { fill: col[1], shadow: col[2], shadowOff: [-9, -11], light: col[0], lightOff: [7, 8], ink: 0 });
}

function rivetP(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const p = path((q) => q.arc(x, y, r, 0, Math.PI * 2));
  piece(ctx, p, { fill: lin(ctx, x - r, y - r, x + r, y + r, [[0, '#fff2b8'], [0.5, '#e0a63a'], [1, '#8a5a12']]), ink: 4 });
}

export function paintGasMask(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  groundShadow(ctx, 262, 480, 140, 15);
  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(-0.07);
  ctx.translate(-256, -256);
  gctx.setTransform(ctx.getTransform());

  // straps behind the head
  const strapL = path((p) => { p.moveTo(120, 190); p.bezierCurveTo(80, 170, 50, 176, 22, 196); });
  const strapR = path((p) => { p.moveTo(392, 190); p.bezierCurveTo(432, 170, 462, 176, 490, 196); });
  for (const s of [strapL, strapR]) {
    line(ctx, s, 42);
    line(ctx, s, 28, '#3a2e2a');
    ctx.save();
    ctx.translate(0, -5);
    line(ctx, s, 6, '#5e4c44');
    ctx.restore();
  }
  for (const [x, y] of [[62, 180], [450, 180]] as const) {
    const b = path((p) => p.roundRect(x - 16, y - 20, 32, 40, 6));
    piece(ctx, b, { fill: lin(ctx, x - 16, 0, x + 16, 0, [[0, '#ffe08a'], [1, '#b07a1e']]), shadow: '#8a5a12', shadowOff: [-8, -6], ink: 7 });
    const h = path((p) => p.roundRect(x - 7, y - 11, 14, 22, 4));
    piece(ctx, h, { fill: '#2a1622', ink: 0 });
  }

  // rubber face piece
  const face = path((p) => {
    p.moveTo(256, 62);
    p.bezierCurveTo(364, 62, 424, 128, 420, 220);
    p.bezierCurveTo(418, 300, 384, 362, 330, 402);
    p.bezierCurveTo(298, 426, 214, 426, 182, 402);
    p.bezierCurveTo(128, 362, 94, 300, 92, 220);
    p.bezierCurveTo(88, 128, 148, 62, 256, 62);
    p.closePath();
  });
  piece(ctx, face, {
    fill: rad(ctx, 210, 150, 20, 320, [[0, '#93ab76'], [0.45, '#6a8455'], [1, '#3e5236']]),
    shadow: '#34462e',
    shadowOff: [-34, -26],
    shadowSoft: 3,
    light: '#b9cf98',
    lightOff: [16, 18],
    ao: 0.5,
    ink: 13,
    detail: (d) => {
      grunge(d, 11, { color: '#22301e', count: 70, size: [1.5, 5], alpha: 0.45, scratches: 14 });
      grunge(d, 12, { color: '#c8dca8', count: 30, size: [1, 3], alpha: 0.4, scratches: 10 });
      // moulded brow ridge
      d.strokeStyle = 'rgba(30,45,25,0.6)';
      d.lineWidth = 8;
      d.lineCap = 'round';
      d.beginPath();
      d.moveTo(150, 128);
      d.quadraticCurveTo(256, 92, 362, 128);
      d.stroke();
      d.strokeStyle = 'rgba(200,225,170,0.6)';
      d.lineWidth = 4;
      d.beginPath();
      d.moveTo(152, 120);
      d.quadraticCurveTo(256, 84, 360, 120);
      d.stroke();
      // blood splatter on the forehead
      d.fillStyle = '#b5122f';
      for (const [x, y, r] of [[318, 112, 16], [340, 96, 7], [298, 132, 6], [352, 124, 4], [330, 140, 3]]) {
        d.beginPath();
        d.arc(x, y, r, 0, Math.PI * 2);
        d.fill();
      }
      d.fillStyle = '#ff5a6a';
      d.beginPath();
      d.arc(312, 106, 5, 0, Math.PI * 2);
      d.fill();
    },
  });

  // lenses
  const eyes: Path2D[] = [];
  for (const [cx, cy, cracked] of [[180, 214, false], [332, 214, true]] as const) {
    const rim = path((p) => p.arc(cx, cy, 66, 0, Math.PI * 2));
    piece(ctx, rim, {
      fill: lin(ctx, cx - 66, cy - 66, cx + 66, cy + 66, [[0, '#fff0b0'], [0.35, '#f2b642'], [0.7, '#b07a1e'], [1, '#6e4608']]),
      shadow: '#7a4f0e',
      shadowOff: [-14, -14],
      light: '#fff6cc',
      lightOff: [8, 8],
      ink: 11,
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      rivetP(ctx, cx + Math.cos(a) * 57, cy + Math.sin(a) * 57, 6);
    }
    const glass = path((p) => p.arc(cx, cy, 46, 0, Math.PI * 2));
    piece(ctx, glass, {
      fill: rad(ctx, cx, cy + 10, 5, 60, [[0, '#3a0d1e'], [1, '#0d0510']]),
      ink: 9,
    });
    // glowing infected eye behind the glass
    const dir = cx < 256 ? 1 : -1;
    const eye = path((p) => {
      p.moveTo(cx - 28, cy + 2 - dir * 6);
      p.quadraticCurveTo(cx, cy - 22, cx + 28, cy + 2 + dir * 6);
      p.quadraticCurveTo(cx, cy + 22, cx - 28, cy + 2 - dir * 6);
      p.closePath();
    });
    eyes.push(eye);
    ctx.save();
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = 'rgba(255,40,70,0.8)';
    ctx.fill(eye);
    ctx.restore();
    piece(ctx, eye, { fill: rad(ctx, cx, cy, 2, 30, [[0, '#fff3c4'], [0.35, '#ff8a5a'], [1, '#ff1f45']]), ink: 0 });
    // reflections on the glass
    ctx.save();
    ctx.clip(glass);
    gloss(ctx, path((p) => p.arc(cx, cy, 34, Math.PI * 1.1, Math.PI * 1.55)), 7, 0.85);
    dot(ctx, cx + 22, cy + 24, 5, '#fff', 0.7);
    if (cracked) {
      const cr = path((p) => {
        p.moveTo(cx + 14, cy - 44);
        p.lineTo(cx + 4, cy - 18);
        p.lineTo(cx + 18, cy - 6);
        p.lineTo(cx + 2, cy + 18);
        p.moveTo(cx + 4, cy - 18);
        p.lineTo(cx - 20, cy - 26);
        p.moveTo(cx + 18, cy - 6);
        p.lineTo(cx + 44, cy + 2);
      });
      line(ctx, cr, 5, 'rgba(10,4,10,0.8)');
      line(ctx, cr, 2.5, 'rgba(255,255,255,0.95)');
    }
    ctx.restore();
  }

  // cheek valves
  for (const [x, y] of [[132, 330], [380, 330]] as const) {
    const v = path((p) => p.arc(x, y, 26, 0, Math.PI * 2));
    piece(ctx, v, { fill: lin(ctx, x - 26, y - 26, x + 26, y + 26, [[0, '#d8e0e6'], [1, '#5d6972']]), shadow: '#4a555e', shadowOff: [-8, -8], ink: 9 });
    const vi = path((p) => p.arc(x, y, 12, 0, Math.PI * 2));
    piece(ctx, vi, { fill: '#2b3238', ink: 6 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      dot(ctx, x + Math.cos(a) * 19, y + Math.sin(a) * 19, 2.5, '#2b3238');
    }
  }

  // snout: rubber cone then filter canister
  const snout = path((p) => {
    p.moveTo(186, 318);
    p.bezierCurveTo(196, 296, 316, 296, 326, 318);
    p.lineTo(320, 392);
    p.bezierCurveTo(300, 412, 212, 412, 192, 392);
    p.closePath();
  });
  piece(ctx, snout, {
    fill: lin(ctx, 186, 0, 326, 0, [[0, '#7c9764'], [0.5, '#5b7449'], [1, '#33442c']]),
    shadow: '#2c3a26',
    shadowOff: [-22, 0],
    ink: 11,
    detail: (d) => {
      d.strokeStyle = 'rgba(25,35,20,0.65)';
      d.lineWidth = 5;
      for (const y of [334, 354, 374]) {
        d.beginPath();
        d.moveTo(186, y);
        d.quadraticCurveTo(256, y + 12, 326, y);
        d.stroke();
      }
    },
  });
  // canister side (cylinder depth)
  const can = path((p) => p.roundRect(186, 380, 140, 70, 20));
  piece(ctx, can, {
    fill: lin(ctx, 186, 0, 326, 0, [[0, '#c9d3dc'], [0.35, '#e9eef2'], [0.6, '#8a96a2'], [1, '#4a555e']]),
    ink: 11,
    detail: (d) => {
      // hazard stripes band
      d.save();
      d.beginPath();
      d.rect(186, 404, 140, 22);
      d.clip();
      d.fillStyle = '#ffcf33';
      d.fillRect(186, 404, 140, 22);
      d.fillStyle = INK;
      for (let x = 160; x < 340; x += 22) {
        d.beginPath();
        d.moveTo(x, 426);
        d.lineTo(x + 11, 426);
        d.lineTo(x + 22, 404);
        d.lineTo(x + 11, 404);
        d.closePath();
        d.fill();
      }
      d.restore();
      d.fillStyle = 'rgba(0,0,0,0.35)';
      d.fillRect(186, 426, 140, 3);
    },
  });
  // canister front face
  const front = path((p) => p.ellipse(256, 382, 70, 30, 0, 0, Math.PI * 2));
  piece(ctx, front, {
    fill: lin(ctx, 186, 352, 326, 412, [[0, '#f4f7f9'], [1, '#7d8a95']]),
    ink: 10,
    detail: (d) => {
      d.fillStyle = '#2b3238';
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 8 + r * 4; i++) {
          const a = (i / (8 + r * 4)) * Math.PI * 2;
          const rr = 14 + r * 15;
          d.beginPath();
          d.ellipse(256 + Math.cos(a) * rr, 382 + Math.sin(a) * rr * 0.42, 3.2, 1.8, 0, 0, Math.PI * 2);
          d.fill();
        }
      }
    },
  });
  dot(ctx, 256, 382, 7, INK);
  dot(ctx, 254, 381, 4, '#c9d3dc');
  gloss(ctx, path((p) => { p.moveTo(202, 372); p.quadraticCurveTo(220, 358, 248, 356); }), 5, 0.9);
  gloss(ctx, path((p) => { p.moveTo(206, 392); p.lineTo(206, 440); }), 5, 0.6);

  // highlights on the rubber
  gloss(ctx, path((p) => { p.moveTo(130, 150); p.bezierCurveTo(140, 118, 170, 96, 206, 86); }), 8, 0.55);
  ctx.restore();

  // toxic cartoon smoke leaking from the canister
  const puffs: [number, number, number][] = [[334, 432, 14], [350, 420, 16], [366, 402, 20], [356, 384, 16], [384, 378, 22], [406, 360, 18], [394, 342, 15], [418, 338, 12]];
  smoke(ctx, puffs, ['#d6ffb8', '#8fe36a', '#4fa83a']);
  for (const e of eyes) {
    gctx.fillStyle = '#ff2a44';
    gctx.fill(e);
  }
  gctx.setTransform(1, 0, 0, 1, 0, 0);
  gctx.fillStyle = '#7dff5a';
  for (const [x, y, r] of puffs) {
    gctx.beginPath();
    gctx.arc(x, y, r, 0, Math.PI * 2);
    gctx.fill();
  }
  return { base: c, parts: {}, glow: g };
}

/* ================================================================== ANTIDOTE */

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const p = path((q) => {
    q.moveTo(x, y - r);
    q.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
    q.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
    q.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
    q.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
    q.closePath();
  });
  line(ctx, p, 7);
  piece(ctx, p, { fill: color, ink: 0 });
}

export function paintAntidote(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  groundShadow(ctx, 256, 482, 120, 13);
  ctx.save();
  ctx.translate(252, 250);
  ctx.rotate(-0.75);
  ctx.scale(0.96, 0.96);
  ctx.translate(-256, -262);
  gctx.setTransform(ctx.getTransform());
  const steel = (x0: number, x1: number) => lin(ctx, x0, 0, x1, 0, [[0, '#8f9ba6'], [0.25, '#f4f7f9'], [0.55, '#b9c4cc'], [1, '#56616b']]);

  // needle
  const needle = path((p) => {
    p.moveTo(250, 418);
    p.lineTo(262, 418);
    p.lineTo(259, 462);
    p.lineTo(256, 474);
    p.lineTo(253, 462);
    p.closePath();
  });
  piece(ctx, needle, { fill: steel(250, 262), ink: 7 });
  // hub
  const hub = path((p) => {
    p.moveTo(218, 384);
    p.lineTo(294, 384);
    p.lineTo(278, 424);
    p.lineTo(234, 424);
    p.closePath();
  });
  piece(ctx, hub, { fill: steel(218, 294), shadow: '#56616b', shadowOff: [-14, 0], ink: 10 });
  // plunger rod
  const rod = path((p) => p.rect(240, 52, 32, 150));
  piece(ctx, rod, {
    fill: steel(240, 272),
    ink: 9,
    detail: (d) => {
      d.fillStyle = 'rgba(40,50,60,0.45)';
      for (let y = 70; y < 140; y += 14) d.fillRect(240, y, 32, 4);
    },
  });
  const thumb = path((p) => p.roundRect(186, 24, 140, 36, 14));
  piece(ctx, thumb, { fill: steel(186, 326), shadow: '#56616b', shadowOff: [-20, -8], light: '#ffffff', lightOff: [6, 6], ink: 11 });

  // glass barrel (back half)
  const barrel = path((p) => p.roundRect(196, 140, 120, 254, 30));
  piece(ctx, barrel, {
    fill: lin(ctx, 196, 0, 316, 0, [[0, 'rgba(170,220,240,0.55)'], [0.5, 'rgba(230,250,255,0.35)'], [1, 'rgba(90,140,170,0.6)']]),
    ink: 0,
  });
  // liquid
  const liquid = path((p) => p.roundRect(208, 206, 96, 176, 20));
  piece(ctx, liquid, {
    fill: lin(ctx, 208, 0, 304, 0, [[0, '#7ff0ff'], [0.4, '#2fd4ff'], [1, '#0a6f9e']]),
    shadow: '#0b5f8a',
    shadowOff: [-30, 0],
    shadowSoft: 4,
    ink: 0,
    detail: (d) => {
      d.fillStyle = rad(d, 236, 300, 4, 90, [[0, 'rgba(230,255,255,0.75)'], [1, 'rgba(120,240,255,0)']]);
      d.fillRect(0, 0, P, P);
      const rnd = seeded(19);
      for (let i = 0; i < 12; i++) {
        const x = 220 + rnd() * 72;
        const y = 220 + rnd() * 150;
        const r = 2.5 + rnd() * 6;
        d.strokeStyle = 'rgba(220,255,255,0.9)';
        d.lineWidth = 2.5;
        d.beginPath();
        d.arc(x, y, r, 0, Math.PI * 2);
        d.stroke();
        dot(d, x - r * 0.3, y - r * 0.3, r * 0.32, '#fff', 0.95);
      }
    },
  });
  // rubber stopper
  const stopper = path((p) => p.roundRect(206, 188, 100, 26, 8));
  piece(ctx, stopper, {
    fill: lin(ctx, 0, 188, 0, 214, [[0, '#4a5560'], [1, '#1e252c']]),
    ink: 8,
    detail: (d) => {
      d.fillStyle = 'rgba(255,255,255,0.18)';
      d.fillRect(206, 193, 100, 4);
    },
  });
  // label band
  const label = path((p) => p.rect(196, 286, 120, 46));
  piece(ctx, label, {
    fill: lin(ctx, 196, 0, 316, 0, [[0, '#d8ccb4'], [0.3, '#fff8ec'], [1, '#b9a98c']]),
    ink: 8,
    detail: (d) => {
      d.fillStyle = '#1599c2';
      d.fillRect(196, 286, 120, 9);
      d.fillRect(196, 323, 120, 9);
    },
  });
  const cross = path((p) => {
    p.roundRect(248, 296, 16, 26, 3);
    p.roundRect(243, 301, 26, 16, 3);
  });
  piece(ctx, cross, { fill: '#e0213a', ink: 0 });
  // ticks
  const ticks = path((p) => {
    for (let y = 220; y < 380; y += 16) {
      if (y > 280 && y < 338) continue;
      p.moveTo(296, y);
      p.lineTo(y % 32 === 28 ? 278 : 286, y);
    }
  });
  line(ctx, ticks, 4, 'rgba(23,11,20,0.85)');
  // glass front: outline and reflections
  line(ctx, barrel, 11);
  ctx.save();
  ctx.clip(barrel);
  gloss(ctx, path((p) => { p.moveTo(214, 160); p.lineTo(214, 378); }), 10, 0.85);
  gloss(ctx, path((p) => { p.moveTo(300, 170); p.lineTo(300, 250); }), 5, 0.6);
  ctx.restore();
  // finger flange over the barrel top
  const flange = path((p) => p.roundRect(150, 128, 212, 30, 15));
  piece(ctx, flange, { fill: steel(150, 362), shadow: '#56616b', shadowOff: [-24, -6], light: '#ffffff', lightOff: [6, 6], ink: 11 });
  // droplet at the tip
  const dropP = path((p) => {
    p.moveTo(256, 476);
    p.bezierCurveTo(250, 486, 244, 490, 244, 496);
    p.arc(256, 496, 12, Math.PI, 0, true);
    p.bezierCurveTo(268, 490, 262, 486, 256, 476);
  });
  piece(ctx, dropP, { fill: lin(ctx, 244, 0, 268, 0, [[0, '#b8fbff'], [1, '#1599c2']]), ink: 6 });
  ctx.restore();

  for (const [x, y, r] of [[96, 140, 20], [420, 330, 15], [120, 390, 11]] as const) sparkle(ctx, x, y, r, '#c8fbff');

  // emissive
  gctx.fillStyle = '#38dcff';
  gctx.fill(liquid);
  gctx.fill(dropP);
  gctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [x, y, r] of [[96, 140, 20], [420, 330, 15], [120, 390, 11]] as const) {
    gctx.beginPath();
    gctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    gctx.fill();
  }
  return { base: c, parts: {}, glow: g };
}

/* ================================================================== L'INFECTÉ */

/** Glowing molten crack: dark casing, hot core, white-hot centre. */
function crack(ctx: CanvasRenderingContext2D, p: Path2D, w = 7): void {
  ctx.save();
  ctx.filter = 'blur(5px)';
  line(ctx, p, w * 2.6, 'rgba(255,90,40,0.55)');
  ctx.restore();
  line(ctx, p, w + 4, '#2a0a10');
  line(ctx, p, w, '#ff5a2a');
  line(ctx, p, w * 0.4, '#ffe9a8');
}

const ZERO_CRACKS = [
  'M222 214 L214 236 L226 250',
  'M292 210 L300 232 L288 246',
  'M182 330 L196 342 L188 362',
  'M330 330 L316 342 L324 362',
  'M256 200 L252 222',
];

export function paintInfected(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  const [jawC, jctx] = layer();
  groundShadow(ctx, 256, 494, 170, 12);

  // torso / shoulders
  const torso = path((p) => {
    p.moveTo(30, 512);
    p.bezierCurveTo(36, 420, 96, 372, 170, 352);
    p.lineTo(342, 352);
    p.bezierCurveTo(416, 372, 476, 420, 482, 512);
    p.closePath();
  });
  piece(ctx, torso, {
    fill: lin(ctx, 0, 352, 0, 512, [[0, '#3c4d5c'], [1, '#222c36']]),
    shadow: '#1a222b',
    shadowOff: [-60, -10],
    shadowSoft: 4,
    ink: 13,
    detail: (d) => {
      grunge(d, 21, { color: '#101820', count: 40, size: [1, 4], alpha: 0.4 });
      // red infection splatter on the shoulder
      d.fillStyle = '#b5122f';
      for (const [x, y, r] of [[112, 432, 18], [136, 452, 8], [92, 456, 6], [124, 412, 5]]) {
        d.beginPath();
        d.arc(x, y, r, 0, Math.PI * 2);
        d.fill();
      }
    },
  });

  // spikes tearing through the hood
  for (const [x, y, a, l] of [[330, 108, 0.5, 70], [372, 150, 0.85, 62], [176, 104, -0.45, 54]] as const) {
    const sp = path((p) => {
      p.moveTo(x - 18, y + 8);
      p.quadraticCurveTo(x + Math.sin(a) * l * 0.5 - 6, y - Math.cos(a) * l * 0.5, x + Math.sin(a) * l, y - Math.cos(a) * l);
      p.quadraticCurveTo(x + Math.sin(a) * l * 0.5 + 10, y - Math.cos(a) * l * 0.5 + 6, x + 18, y + 8);
      p.closePath();
    });
    piece(ctx, sp, { fill: lin(ctx, x - 20, y - l, x + 20, y, [[0, '#fff3dc'], [1, '#b8a07a']]), shadow: '#8a7458', shadowOff: [-8, 0], ink: 9 });
  }

  // hood
  const hood = path((p) => {
    p.moveTo(84, 436);
    p.bezierCurveTo(52, 280, 104, 92, 256, 62);
    p.bezierCurveTo(408, 92, 460, 280, 428, 436);
    p.bezierCurveTo(380, 476, 132, 476, 84, 436);
    p.closePath();
  });
  piece(ctx, hood, {
    fill: rad(ctx, 200, 140, 20, 360, [[0, '#56708a'], [0.5, '#3a4c5e'], [1, '#222d38']]),
    shadow: '#1c2530',
    shadowOff: [-46, -20],
    shadowSoft: 4,
    light: '#7d9ab4',
    lightOff: [16, 20],
    ao: 0.4,
    ink: 13,
    detail: (d) => {
      grunge(d, 22, { color: '#0e151c', count: 60, size: [1, 4], alpha: 0.4, scratches: 6 });
      // cloth folds
      d.lineCap = 'round';
      for (const f of [
        [120, 380, 110, 300, 132, 220],
        [394, 380, 404, 300, 380, 220],
        [176, 110, 210, 92, 250, 86],
      ]) {
        const fp = new Path2D();
        fp.moveTo(f[0], f[1]);
        fp.quadraticCurveTo(f[2], f[3], f[4], f[5]);
        d.strokeStyle = 'rgba(14,20,28,0.7)';
        d.lineWidth = 7;
        d.stroke(fp);
        d.save();
        d.translate(5, -3);
        d.strokeStyle = 'rgba(140,170,200,0.45)';
        d.lineWidth = 4;
        d.stroke(fp);
        d.restore();
      }
      // torn hole edge around the spikes
      d.fillStyle = 'rgba(10,6,12,0.6)';
      d.beginPath();
      d.ellipse(336, 112, 22, 10, 0.4, 0, Math.PI * 2);
      d.fill();
    },
  });

  // hood opening (void)
  const opening = path((p) => {
    p.moveTo(140, 422);
    p.bezierCurveTo(114, 300, 146, 166, 256, 148);
    p.bezierCurveTo(366, 166, 398, 300, 372, 422);
    p.bezierCurveTo(322, 450, 190, 450, 140, 422);
    p.closePath();
  });
  piece(ctx, opening, { fill: '#0c0610', ink: 11 });

  // face
  const face = path((p) => {
    p.moveTo(164, 404);
    p.bezierCurveTo(146, 300, 174, 194, 256, 186);
    p.bezierCurveTo(338, 194, 366, 300, 348, 404);
    p.bezierCurveTo(312, 432, 200, 432, 164, 404);
    p.closePath();
  });
  piece(ctx, face, {
    fill: rad(ctx, 230, 300, 10, 170, [[0, '#6a5a72'], [0.6, '#4a3c52'], [1, '#2a2030']]),
    shadow: '#251b2c',
    shadowOff: [-30, -14],
    shadowSoft: 3,
    light: '#8e7e98',
    lightOff: [10, 12],
    ink: 10,
    detail: (d) => {
      // hood casts a shadow on the forehead
      d.fillStyle = lin(d, 0, 186, 0, 250, [[0, 'rgba(8,4,12,0.85)'], [1, 'rgba(8,4,12,0)']]);
      d.fillRect(0, 0, P, P);
      grunge(d, 23, { color: '#1c1422', count: 50, size: [1, 4], alpha: 0.5 });
    },
  });
  // molten cracks
  for (const d of ZERO_CRACKS) crack(ctx, new Path2D(d), 6);

  // eye sockets + burning eyes
  const eyes: Path2D[] = [];
  for (const dir of [-1, 1]) {
    const cx = 256 + dir * 46;
    const socket = path((p) => {
      p.moveTo(cx - dir * 40, 254);
      p.quadraticCurveTo(cx, 226, cx + dir * 34, 276);
      p.quadraticCurveTo(cx, 300, cx - dir * 40, 254);
      p.closePath();
    });
    piece(ctx, socket, { fill: '#120812', ink: 0 });
    const eye = path((p) => {
      p.moveTo(cx - dir * 30, 258);
      p.quadraticCurveTo(cx, 242, cx + dir * 24, 274);
      p.quadraticCurveTo(cx - dir * 2, 288, cx - dir * 30, 258);
      p.closePath();
    });
    eyes.push(eye);
    ctx.save();
    ctx.filter = 'blur(8px)';
    ctx.fillStyle = 'rgba(255,170,40,0.9)';
    ctx.fill(eye);
    ctx.restore();
    piece(ctx, eye, { fill: rad(ctx, cx, 266, 2, 26, [[0, '#ffffff'], [0.3, '#fff09a'], [0.7, '#ffb21a'], [1, '#ff4a1a']]), ink: 0 });
    dot(ctx, cx - dir * 6, 262, 4, '#2a0a10');
  }
  // nose slits
  line(ctx, path((p) => { p.moveTo(246, 300); p.lineTo(250, 312); p.moveTo(266, 300); p.lineTo(262, 312); }), 5);

  // mouth interior (extends below the jaw so opening reveals it)
  const mouth = path((p) => {
    p.moveTo(176, 322);
    p.quadraticCurveTo(256, 356, 336, 322);
    p.bezierCurveTo(334, 384, 312, 430, 256, 434);
    p.bezierCurveTo(200, 430, 178, 384, 176, 322);
    p.closePath();
  });
  piece(ctx, mouth, {
    fill: rad(ctx, 256, 380, 6, 90, [[0, '#ff4a5e'], [0.4, '#9a0a26'], [1, '#2a0410']]),
    ink: 10,
  });
  // tongue
  const tongue = path((p) => p.ellipse(268, 404, 40, 18, -0.1, 0, Math.PI * 2));
  piece(ctx, tongue, { fill: '#e0405a', shadow: '#9a1a36', shadowOff: [-8, -8], ink: 6 });
  // upper teeth
  const teeth = path((p) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const x0 = 182 + t0 * 148;
      const x1 = 182 + t1 * 148;
      const ym = (x: number) => 322 + Math.sin(((x - 176) / 160) * Math.PI) * 16;
      const len = 26 - Math.abs(i - 3.5) * 2.6;
      p.moveTo(x0, ym(x0));
      p.lineTo((x0 + x1) / 2, ym((x0 + x1) / 2) + len);
      p.lineTo(x1, ym(x1));
      p.closePath();
    }
  });
  piece(ctx, teeth, { fill: lin(ctx, 0, 320, 0, 370, [[0, '#fff8ea'], [1, '#d8c4a0']]), ink: 6 });

  // ---- jaw part (chin + lower teeth) on its own layer
  const jaw = path((p) => {
    p.moveTo(184, 390);
    p.quadraticCurveTo(256, 414, 328, 390);
    p.bezierCurveTo(330, 420, 304, 446, 256, 450);
    p.bezierCurveTo(208, 446, 182, 420, 184, 390);
    p.closePath();
  });
  const lower = path((p) => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x0 = 196 + (i / n) * 120;
      const x1 = 196 + ((i + 1) / n) * 120;
      const ym = (x: number) => 392 + Math.sin(((x - 184) / 144) * Math.PI) * 11;
      const len = 20 - Math.abs(i - 2.5) * 2;
      p.moveTo(x0, ym(x0) + 2);
      p.lineTo((x0 + x1) / 2, ym((x0 + x1) / 2) - len);
      p.lineTo(x1, ym(x1) + 2);
      p.closePath();
    }
  });
  piece(jctx, lower, { fill: lin(jctx, 0, 370, 0, 400, [[0, '#fff8ea'], [1, '#d8c4a0']]), ink: 6 });
  piece(jctx, jaw, {
    fill: lin(jctx, 0, 390, 0, 450, [[0, '#5a4a62'], [1, '#2e2236']]),
    shadow: '#251b2c',
    shadowOff: [-22, -8],
    ink: 10,
  });
  crack(jctx, new Path2D('M232 414 L240 428 L234 440'), 5);
  drip(jctx, 318, 400, 22, 13);

  // drawstrings
  for (const x of [204, 308]) {
    const cord = path((p) => { p.moveTo(x, 438); p.quadraticCurveTo(x + (x < 256 ? -8 : 8), 470, x, 496); });
    line(ctx, cord, 14);
    line(ctx, cord, 7, '#d8d0c4');
    const tip = path((p) => p.roundRect(x - 8, 490, 16, 22, 4));
    piece(ctx, tip, { fill: lin(ctx, x - 8, 0, x + 8, 0, [[0, '#e9eef2'], [1, '#6d7983']]), ink: 6 });
  }

  // emissive
  gctx.fillStyle = '#ffb21a';
  for (const e of eyes) gctx.fill(e);
  gctx.strokeStyle = '#ff5a2a';
  gctx.lineWidth = 6;
  gctx.lineCap = 'round';
  for (const d of ZERO_CRACKS) gctx.stroke(new Path2D(d));
  return { base: c, parts: { jaw: jawC }, glow: g };
}

/* ================================================================== CODEX */

const brass = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) =>
  lin(ctx, x0, y0, x1, y1, [[0, '#fff1b0'], [0.3, '#f2b642'], [0.7, '#b07a1e'], [1, '#6e4608']]);

/** Eye almond centred on the canvas so the rig's blink (scale.y about the centre) closes it. */
const EYE = { cx: 256, cy: 256, rx: 96, ry: 62 };
const almond = (k = 1) =>
  path((p) => {
    const { cx, cy, rx, ry } = EYE;
    p.moveTo(cx - rx * k, cy);
    p.bezierCurveTo(cx - rx * 0.5 * k, cy - ry * 1.25 * k, cx + rx * 0.5 * k, cy - ry * 1.25 * k, cx + rx * k, cy);
    p.bezierCurveTo(cx + rx * 0.5 * k, cy + ry * 1.25 * k, cx - rx * 0.5 * k, cy + ry * 1.25 * k, cx - rx * k, cy);
    p.closePath();
  });

const CODEX_VEINS = [
  'M220 196 C210 160 228 130 214 92',
  'M300 200 C320 170 330 140 352 110',
  'M346 270 C374 280 378 320 396 344',
  'M290 316 C300 350 288 380 302 418',
  'M210 314 C196 350 214 384 196 420',
  'M162 262 C134 270 128 236 110 220',
  'M168 290 C140 310 140 340 118 360',
];

export function paintCodex(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  const [irisC, ictx] = layer();
  const [lidC, lctx] = layer();
  groundShadow(ctx, 266, 486, 160, 16);

  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(-0.09);
  ctx.scale(0.93, 0.93);
  ctx.translate(-256, -256);
  gctx.setTransform(ctx.getTransform());
  for (const x of [ictx, lctx]) x.setTransform(ctx.getTransform());

  // back cover + page block (thickness, seen in 3/4)
  const back = path((p) => p.roundRect(126, 70, 316, 412, 22));
  piece(ctx, back, { fill: '#4a0a1e', ink: 13 });
  const pages = path((p) => {
    p.moveTo(400, 66);
    p.lineTo(424, 82);
    p.lineTo(426, 468);
    p.lineTo(132, 470);
    p.lineTo(110, 452);
    p.lineTo(400, 450);
    p.closePath();
  });
  piece(ctx, pages, {
    fill: lin(ctx, 400, 0, 430, 0, [[0, '#fff4dc'], [1, '#d6c19a']]),
    ink: 10,
    detail: (d) => {
      d.strokeStyle = 'rgba(140,110,70,0.6)';
      d.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        d.beginPath();
        d.moveTo(404 + i * 2.4, 84);
        d.lineTo(406 + i * 2.4, 456);
        d.stroke();
        d.beginPath();
        d.moveTo(120, 455 + i * 1.6);
        d.lineTo(410, 455 + i * 1.6);
        d.stroke();
      }
    },
  });

  // front cover
  const cover = path((p) => p.roundRect(84, 44, 320, 412, 24));
  piece(ctx, cover, {
    fill: rad(ctx, 210, 170, 30, 380, [[0, '#d02a52'], [0.45, '#9a1838'], [1, '#4e0920']]),
    shadow: '#5a0b22',
    shadowOff: [-40, -30],
    shadowSoft: 5,
    light: '#e8607e',
    lightOff: [12, 14],
    ao: 0.55,
    ink: 14,
    detail: (d) => {
      grunge(d, 31, { color: '#3a0414', count: 110, size: [1.5, 6], alpha: 0.5, scratches: 22 });
      grunge(d, 32, { color: '#ff8aa0', count: 40, size: [1, 3], alpha: 0.35, scratches: 10 });
      // stitched patch (flesh repaired)
      d.save();
      d.strokeStyle = '#2a0410';
      d.lineWidth = 4;
      d.setLineDash([10, 8]);
      d.beginPath();
      d.moveTo(300, 380);
      d.bezierCurveTo(340, 360, 372, 390, 380, 430);
      d.stroke();
      d.setLineDash([]);
      d.lineWidth = 3.5;
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const x = 304 + t * 74;
        const y = 378 - Math.sin(t * Math.PI) * 6 + t * 46;
        d.beginPath();
        d.moveTo(x - 7, y - 9);
        d.lineTo(x + 7, y + 9);
        d.stroke();
      }
      d.restore();
    },
  });
  // spine on the left
  const spine = path((p) => p.roundRect(84, 44, 52, 412, [24, 0, 0, 24]));
  piece(ctx, spine, {
    fill: lin(ctx, 84, 0, 136, 0, [[0, '#7a1230'], [0.5, '#5a0b22'], [1, '#3a0614']]),
    ink: 10,
  });
  for (const y of [96, 250, 404]) {
    const band = path((p) => p.roundRect(76, y - 14, 68, 28, 10));
    piece(ctx, band, { fill: brass(ctx, 76, y - 14, 144, y + 14), shadow: '#8a5a12', shadowOff: [-10, -8], ink: 8 });
    gloss(ctx, path((p) => { p.moveTo(88, y - 6); p.lineTo(130, y - 6); }), 3, 0.8);
  }
  // embossed brass frame line
  ctx.save();
  ctx.setLineDash([14, 10]);
  line(ctx, path((p) => p.roundRect(158, 74, 222, 352, 16)), 5, 'rgba(242,182,66,0.75)');
  ctx.restore();
  // corner guards
  for (const [x, y, sx, sy] of [[404, 44, -1, 1], [404, 456, -1, -1]] as const) {
    const corner = path((p) => {
      p.moveTo(x, y);
      p.lineTo(x + sx * 82, y);
      p.quadraticCurveTo(x + sx * 40, y + sy * 12, x, y + sy * 82);
      p.closePath();
    });
    piece(ctx, corner, { fill: brass(ctx, x + sx * 80, y, x, y + sy * 80), shadow: '#8a5a12', shadowOff: [sx * 10, -sy * 10], ink: 10 });
    rivetBrass(ctx, x + sx * 22, y + sy * 22, 7);
  }
  // clasp strap over the pages
  const strap = path((p) => p.roundRect(360, 222, 74, 66, 12));
  piece(ctx, strap, {
    fill: lin(ctx, 0, 222, 0, 288, [[0, '#6a3a20'], [1, '#3a1e10']]),
    ink: 10,
    detail: (d) => grunge(d, 33, { color: '#1e0e06', count: 20, size: [1, 3], alpha: 0.5 }),
  });
  const buckle = path((p) => p.roundRect(386, 230, 40, 50, 10));
  piece(ctx, buckle, { fill: brass(ctx, 386, 230, 426, 280), shadow: '#8a5a12', shadowOff: [-8, -8], ink: 9 });
  dot(ctx, 406, 255, 7, INK);

  // glowing veins from the eye
  for (const d of CODEX_VEINS) {
    const v = new Path2D(d);
    ctx.save();
    ctx.filter = 'blur(6px)';
    line(ctx, v, 22, 'rgba(255,40,70,0.45)');
    ctx.restore();
    line(ctx, v, 15);
    line(ctx, v, 8, '#ff3347');
    ctx.save();
    ctx.translate(-2, -2);
    line(ctx, v, 2.5, '#ffb3bd');
    ctx.restore();
  }
  // pustules at vein tips
  for (const [x, y] of [[214, 92], [352, 110], [396, 344], [196, 420], [110, 220]] as const) {
    const pu = path((p) => p.arc(x, y, 11, 0, Math.PI * 2));
    piece(ctx, pu, { fill: rad(ctx, x - 3, y - 3, 1, 12, [[0, '#fff3a0'], [1, '#ffb21a']]), ink: 6 });
  }

  // eye socket (fleshy rim)
  const socket = almond(1.22);
  piece(ctx, socket, {
    fill: rad(ctx, 256, 230, 10, 130, [[0, '#c43656'], [1, '#5a0b22']]),
    shadow: '#4a0718',
    shadowOff: [0, -18],
    ink: 12,
  });
  // sclera
  const sclera = almond(1);
  piece(ctx, sclera, {
    fill: rad(ctx, 256, 268, 10, 110, [[0, '#fffaf0'], [0.7, '#f4dcc8'], [1, '#d89a94']]),
    ink: 0,
    detail: (d) => {
      // lid shadow along the top
      d.fillStyle = lin(d, 0, 186, 0, 240, [[0, 'rgba(90,10,30,0.6)'], [1, 'rgba(90,10,30,0)']]);
      d.fillRect(0, 0, P, P);
      d.strokeStyle = '#e0213a';
      d.lineWidth = 2.5;
      d.lineCap = 'round';
      for (const v of ['M166 256 C180 248 186 262 200 252', 'M346 256 C332 264 326 250 312 260', 'M176 270 C188 276 196 268 206 278', 'M336 240 C324 232 318 244 306 236', 'M190 236 C198 232 204 238 210 232']) {
        d.stroke(new Path2D(v));
      }
    },
  });
  line(ctx, sclera, 9);

  // iris part
  const iris = path((p) => p.arc(256, 256, 50, 0, Math.PI * 2));
  piece(ictx, iris, {
    fill: rad(ictx, 256, 256, 4, 52, [[0, '#ffe08a'], [0.35, '#ff7a2a'], [0.75, '#e0213a'], [1, '#7a0418']]),
    ink: 8,
    detail: (d) => {
      d.strokeStyle = 'rgba(122,4,24,0.6)';
      d.lineWidth = 2;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        d.beginPath();
        d.moveTo(256 + Math.cos(a) * 18, 256 + Math.sin(a) * 18);
        d.lineTo(256 + Math.cos(a) * 46, 256 + Math.sin(a) * 46);
        d.stroke();
      }
    },
  });
  const pupil = path((p) => {
    p.moveTo(256, 216);
    p.quadraticCurveTo(240, 256, 256, 296);
    p.quadraticCurveTo(272, 256, 256, 216);
    p.closePath();
  });
  piece(ictx, pupil, { fill: '#12060c', ink: 0 });
  dot(ictx, 274, 236, 11, '#fff', 0.95);
  dot(ictx, 240, 278, 5, '#fff', 0.8);

  // lid part: closed eyelid covering the almond
  const lid = almond(1.04);
  piece(lctx, lid, {
    fill: lin(lctx, 0, 190, 0, 320, [[0, '#d23a5e'], [0.5, '#9a1838'], [1, '#6a0d27']]),
    light: '#f07a94',
    lightOff: [0, 14],
    ink: 10,
  });
  line(lctx, path((p) => { p.moveTo(164, 256); p.quadraticCurveTo(256, 290, 348, 256); }), 8);
  line(lctx, path((p) => {
    for (const [x, l] of [[190, 16], [222, 20], [256, 22], [290, 20], [322, 16]] as const) {
      const y = 256 + Math.sin(((x - 164) / 184) * Math.PI) * 17;
      p.moveTo(x, y);
      p.lineTo(x + (x - 256) * 0.08, y + l);
    }
  }), 6);

  // blood drips off the bottom edge
  drip(ctx, 196, 450, 30, 20);
  drip(ctx, 300, 452, 18, 15);
  // leather gloss
  gloss(ctx, path((p) => { p.moveTo(154, 70); p.lineTo(250, 66); }), 6, 0.6);
  ctx.restore();

  // emissive
  gctx.lineCap = 'round';
  gctx.strokeStyle = '#ff3347';
  gctx.lineWidth = 9;
  for (const d of CODEX_VEINS) gctx.stroke(new Path2D(d));
  gctx.fillStyle = '#ff3347';
  gctx.fill(iris);
  return { base: c, parts: { iris: irisC, lid: lidC }, glow: g };
}

function rivetBrass(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const p = path((q) => q.arc(x, y, r, 0, Math.PI * 2));
  piece(ctx, p, { fill: lin(ctx, x - r, y - r, x + r, y + r, [[0, '#fff2b8'], [0.5, '#e0a63a'], [1, '#8a5a12']]), ink: 4 });
}

export const PAINTED: Record<string, () => PaintedSymbol> = {
  codex: paintCodex,
  zero: paintInfected,
  antidote: paintAntidote,
  blood: paintBloodBag,
  mask: paintGasMask,
};

