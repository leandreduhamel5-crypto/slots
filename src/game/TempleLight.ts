import { Container, Geometry, Mesh, Shader, Texture } from 'pixi.js';
import { TH as H, TW as W } from './art/templeHD';

const vertex = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

/**
 * The picture is a render: the camera below is the one of tools/render_temple.py, and the two maps
 * hold what it saw at each pixel. So each point of the hall is known in space, and a light can be
 * moved through it for real: columns turn from it, gold answers it, and a wave of light reaches the
 * near columns after the far ones.
 */
const fragment = `
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uMapA;
uniform sampler2D uMapB;
uniform vec3 uWarm;
uniform vec3 uWarmAt;
uniform vec3 uGate;
uniform vec3 uGateAt;
uniform vec3 uFlash;
uniform vec3 uFlashDir;
uniform vec3 uWave;
uniform vec2 uFront;
uniform float uBody;

const vec3 CAM = vec3(0.0, 2.4, 0.0);
const float LOG_FAR = 6.8024;

vec3 lit(vec3 n, vec3 v, vec3 l, vec3 alb, float shine) {
  vec3 h = normalize(l - v);
  float gloss = pow(max(dot(n, h), 0.0), 36.0);
  return alb * max(dot(n, l), 0.0) + vec3(1.0, 0.82, 0.55) * gloss * shine;
}

void main() {
  vec4 a = texture(uMapA, vUV);
  if (a.b > 0.99) {
    finalColor = vec4(0.0);
    return;
  }
  vec3 alb = texture(uMapB, vUV).rgb;
  alb *= alb;
  vec3 v = normalize(vec3((vUV.x * 2560.0 - 1280.0) / 1400.0, (880.0 - vUV.y * 1440.0) / 1400.0, 1.0));
  float t = exp(a.b * LOG_FAR);
  vec3 p = CAM + v * t;
  vec2 nn = a.rg * 2.0 - 1.0;
  vec3 n = vec3(nn, -sqrt(max(0.0, 1.0 - dot(nn, nn))));
  // gold takes a highlight, and the polished floor even more
  float gold = smoothstep(0.03, 0.2, alb.r - alb.b);
  float shine = gold * 1.3 + smoothstep(0.9, 0.98, n.y) * 0.5;

  vec3 w = uWarmAt - p;
  float d = length(w);
  vec3 c = uWarm * lit(n, v, w / d, alb, shine) / (1.0 + d * d / 680.0);

  w = uGateAt - p;
  d = length(w);
  c += uGate * lit(n, v, w / d, alb, shine) / (1.0 + d * d / 1900.0);

  c += uFlash * lit(n, v, uFlashDir, alb, shine);

  float front = (t - uFront.x) / uFront.y;
  c += uWave * exp(-front * front) * (gold * (0.5 + alb) + alb * uBody) * (0.35 + 0.65 * max(dot(n, -v), 0.0));

  finalColor = vec4(c, 0.0);
}`;

const NIGHT = [1, 0.72, 0.42];
const RED = [1, 0.14, 0.06];
/** where the two scenes have their door, and how far a wave starts */
const SCENES = {
  hall: { at: [0, 7, 120], far: 132 },
  pyramid: { at: [0, 5, 31], far: 150 },
};

const rgb = (hex: number) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

interface Wave {
  at: number;
  speed: number;
  width: number;
  colour: number[];
  strength: number;
  body: number;
}

/** Live light in the hall of the temple. Nothing moves in the picture: only the light does. */
export class TempleLight extends Container {
  private u: Record<string, Float32Array | number[] | number>;
  private t = 0;
  private flow: Wave | null = null;
  private nextWave = 7;
  private shader: Shader;
  private maps: Record<keyof typeof SCENES, [Texture, Texture]>;
  private far = SCENES.hall.far;
  /** the door of the scene is lit: 0 shut, 1 wide open */
  doorLight = 0;

  constructor(hall: HTMLImageElement[], pyramid: HTMLImageElement[]) {
    super();
    const load = (i: HTMLImageElement) => {
      const t = Texture.from(i);
      t.source.autoGenerateMipmaps = false;
      return t;
    };
    this.maps = { hall: [load(hall[0]), load(hall[1])], pyramid: [load(pyramid[0]), load(pyramid[1])] };
    const [a, b] = this.maps.hall;
    const geometry = new Geometry({
      attributes: {
        aPosition: [-W / 2, -H / 2, W / 2, -H / 2, W / 2, H / 2, -W / 2, H / 2],
        aUV: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    const vec3 = (x = 0, y = 0, z = 0) => ({ value: new Float32Array([x, y, z]), type: 'vec3<f32>' as const });
    const shader = Shader.from({
      gl: { vertex, fragment },
      resources: {
        uMapA: a.source,
        uMapB: b.source,
        lights: {
          uWarm: vec3(),
          uWarmAt: vec3(0, 9, 8),
          uGate: vec3(),
          uGateAt: vec3(0, 7, 120),
          uFlash: vec3(),
          uFlashDir: vec3(0, 1, 0),
          uWave: vec3(),
          uFront: { value: new Float32Array([0, 10]), type: 'vec2<f32>' as const },
          uBody: { value: 0, type: 'f32' as const },
        },
      },
    });
    this.shader = shader;
    this.u = shader.resources.lights.uniforms;
    const mesh = new Mesh({ geometry, shader });
    mesh.blendMode = 'add';
    this.addChild(mesh);
  }

  /** Which of the two rendered places is on screen. */
  useScene(name: keyof typeof SCENES): void {
    const [a, b] = this.maps[name];
    this.shader.resources.uMapA = a.source;
    this.shader.resources.uMapB = b.source;
    this.set('uGateAt', ...(SCENES[name].at as [number, number, number]));
    this.far = SCENES[name].far;
    this.gateBase = name === 'hall' ? 0.14 : 0;
    this.reach = name === 'hall' ? 0.6 : 0.07;
  }

  private gateBase = 0.14;
  /** the pictures are painted with their own light: what is added stays well under it, above all in the dark of the bonus */
  private reach = 0.6;

  /** A wave of light runs through the hall: from the far end to the viewer, or (from the slot) away down the nave. */
  wave(colour: number, strength: number, away = false, speed = 90, body = 0.4): void {
    this.flow = { at: away ? 4 : this.far, speed: away ? speed : -speed, width: 11, colour: rgb(colour), strength, body };
  }

  private set(name: string, x: number, y: number, z: number): void {
    const v = this.u[name] as Float32Array;
    v[0] = x;
    v[1] = y;
    v[2] = z;
  }

  /** feature 0..1, flare: the last win, bolt: lightning, side: where it falls. */
  update(dt: number, feature: number, flare: number, bolt: number, side: number): void {
    this.t += dt;
    const t = this.t;
    const mix = (k: number) => NIGHT[k] + (RED[k] - NIGHT[k]) * feature;
    // the slot lights the hall: it breathes, it sways a little, and it blazes on a win
    const slot = (0.13 + 0.035 * Math.sin(t * 0.7) + flare * 1.1) * this.reach;
    this.set('uWarm', mix(0) * slot, mix(1) * slot, mix(2) * slot);
    this.set('uWarmAt', Math.sin(t * 0.23) * 3.4, 9 + Math.sin(t * 0.31) * 1.3, 8 + Math.sin(t * 0.17) * 2.2);
    const beat = Math.pow(Math.max(0, Math.sin(t * 2.2)), 8);
    const gate = this.gateBase + 0.05 * Math.sin(t * 1.3) * (this.gateBase > 0 ? 1 : feature) + feature * (0.14 + beat * 0.22) * this.reach;
    // what comes out of the pyramid is red, whatever the hour
    const door = this.doorLight * 0.16;
    this.set('uGate', mix(0) * gate + RED[0] * door, mix(1) * gate + RED[1] * door, mix(2) * gate + RED[2] * door);
    const boltC = feature > 0.5 ? [1, 0.3, 0.2] : [0.62, 0.72, 1];
    this.set('uFlash', boltC[0] * bolt * 0.55, boltC[1] * bolt * 0.55, boltC[2] * bolt * 0.55);
    this.set('uFlashDir', 0.46 * side, 0.82, -0.34);

    this.nextWave -= dt;
    if (this.nextWave <= 0 && !this.flow) {
      this.nextWave = feature > 0.5 ? 2.6 : 11 + Math.random() * 6;
      if (feature > 0.5) this.wave(0xff2a14, 0.4, false, 80, 0.03);
      else this.wave(0xffd890, 0.32, false, 46, 0.03);
    }
    const f = this.flow;
    if (f) {
      f.at += f.speed * dt;
      const k = f.strength * Math.min(1, (this.far + 8 - Math.abs(f.at - (f.speed < 0 ? 0 : this.far))) / 30);
      this.set('uWave', f.colour[0] * k, f.colour[1] * k, f.colour[2] * k);
      const front = this.u.uFront as Float32Array;
      front[0] = f.at;
      front[1] = f.width;
      this.u.uBody = f.body;
      if (f.at < -10 || f.at > this.far + 10) {
        this.flow = null;
        this.set('uWave', 0, 0, 0);
      }
    }
  }
}
