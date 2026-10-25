const NOISE = /* glsl */ `
  varying vec3 vGround;
  varying vec3 vGroundN;
  float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float gNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float gFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int k = 0; k < 4; k++) {
      v += a * gNoise(p);
      p = p * 2.03 + 17.1;
      a *= 0.5;
    }
    return v;
  }
  float gRidge(vec2 p) { return 1.0 - abs(2.0 * gNoise(p) - 1.0); }
  float gFade(float footprint, float freq) { return 1.0 - smoothstep(0.25, 0.7, footprint * freq); }

  vec3 grassDetail(vec3 c, vec2 q, float px) {
    c *= mix(0.84, 1.12, gFbm(q * 0.018));
    c = mix(c, c * vec3(1.2, 1.1, 0.62), smoothstep(0.55, 0.78, gFbm(q * 0.03 + 90.0)) * 0.55);
    c *= mix(0.92, 1.07, gFbm(q * 0.11 + 40.0));
    vec2 s = mat2(0.8, -0.6, 0.6, 0.8) * q;
    c *= 1.0 + (gNoise(vec2(s.x * 2.4, s.y * 0.45)) - 0.5) * 0.22 * gFade(px, 2.4);
    c *= 1.0 - smoothstep(0.7, 0.8, gNoise(q * 0.85 + 7.0)) * 0.16 * gFade(px, 0.85);
    vec2 cell = floor(q * 0.9);
    vec2 inCell = fract(q * 0.9) - 0.5 - (vec2(gHash(cell + 3.1), gHash(cell + 8.4)) - 0.5) * 0.6;
    float flower = step(0.965, gHash(cell)) * (1.0 - smoothstep(0.07, 0.11, length(inCell))) * gFade(px, 6.0);
    vec3 petal = gHash(cell + 1.7) < 0.5 ? vec3(1.0, 0.95, 0.85) : vec3(1.0, 0.78, 0.12);
    return mix(c, petal, flower);
  }

  vec4 gCell(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    float id = 0.0;
    float side = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 r = g + vec2(gHash(i + g), gHash(i + g + 19.3)) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = gHash(i + g + 7.7);
          side = r.x;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    return vec4(sqrt(d1), sqrt(d2), id, side);
  }

  float rockFace(vec2 uv, float px) {
    vec2 bent = vec2(uv.x + (gFbm(uv * 0.01) - 0.5) * 60.0, uv.y);
    vec4 slab = gCell(bent * vec2(0.05, 0.016));
    float tone = 0.86 + 0.22 * slab.z;
    tone *= 1.0 - 0.16 * clamp(slab.w * 1.6, -1.0, 1.0);
    float seam = (1.0 - smoothstep(0.03, 0.14, slab.y - slab.x)) * smoothstep(0.35, 0.6, gNoise(uv * 0.015 + 4.0));
    float gully = smoothstep(0.6, 0.88, gNoise(vec2(bent.x * 0.04, uv.y * 0.004)));
    float streak = gNoise(vec2(bent.x * 0.45, uv.y * 0.04));
    return tone * (1.0 - seam * 0.32 * gFade(px, 0.05)) * (1.0 - gully * 0.2) * (1.0 + (streak - 0.5) * 0.16 * gFade(px, 0.45));
  }

  vec3 rockDetail(vec3 c, vec3 p, vec3 n, float px) {
    float wx = abs(n.x) / (abs(n.x) + abs(n.z) + 1e-4);
    float shade = mix(rockFace(p.xy, px), rockFace(vec2(p.z, p.y) + 57.0, px), smoothstep(0.35, 0.65, wx));
    float layer = floor((p.y + gFbm(p.xz * 0.012) * 30.0) / 14.0);
    shade *= 0.95 + 0.1 * gHash(vec2(layer, 3.7));
    shade *= 1.0 + (gNoise(p.xz * 0.6 + p.y * 0.4) - 0.5) * 0.1 * gFade(px, 0.6);
    vec3 hue = mix(vec3(1.05, 1.0, 0.93), vec3(0.93, 0.97, 1.04), gFbm(p.xz * 0.004 + 3.0));
    return c * shade * hue;
  }
`;

export function alpineGround(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGround;\nvarying vec3 vGroundN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGroundN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float px = length(fwidth(vGround.xz));
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          float grass = smoothstep(0.04, 0.16, c.g - max(c.r, c.b));
          float snow = smoothstep(0.62, 0.85, lum);
          float rock = (1.0 - grass) * (1.0 - snow) * smoothstep(2.0, 6.0, vGround.y);
          vec3 tinted = mix(c, grassDetail(c, vGround.xz, px), grass);
          tinted = mix(tinted, rockDetail(c, vGround, normalize(vGroundN), px), rock);
          tinted *= 1.0 - snow * 0.06 * gFbm(vGround.xz * 0.05);
          diffuseColor.rgb = tinted;
        }`,
      );
  };
  material.customProgramCacheKey = () => 'alpine-ground';
  return material;
}

const CANYON = /* glsl */ `
  varying float vKind;
  vec3 strata(float id) {
    float h = gHash(vec2(id, 4.1));
    vec3 a = vec3(0.552, 0.091, 0.028);
    vec3 b = vec3(0.716, 0.202, 0.048);
    vec3 c = vec3(0.815, 0.456, 0.202);
    vec3 d = vec3(0.445, 0.068, 0.025);
    vec3 e = vec3(0.879, 0.658, 0.361);
    vec3 f = vec3(0.332, 0.061, 0.032);
    vec3 g = vec3(0.631, 0.144, 0.040);
    return h < 0.2 ? a : h < 0.36 ? b : h < 0.47 ? c : h < 0.62 ? d : h < 0.68 ? e : h < 0.8 ? f : g;
  }

  vec3 canyonRock(vec3 p, vec3 n, float px) {
    float warp = gFbm(p.xz * 0.011) * 14.0 + gFbm(p.xz * 0.05 + 7.0) * 2.5;
    float layer = (p.y + warp) / 4.2;
    float id = floor(layer);
    float band = fract(layer);
    vec3 color = strata(id);
    color *= mix(0.82, 1.05, smoothstep(0.0, 0.35, band));
    color = mix(color, color * 1.18, smoothstep(0.9, 0.97, band) * (1.0 - smoothstep(0.97, 1.0, band)));
    color *= 1.0 - (1.0 - smoothstep(0.0, 0.05, band)) * 0.35;
    float wx = abs(n.x) / (abs(n.x) + abs(n.z) + 1e-4);
    vec2 uvA = vec2(p.x, p.y);
    vec2 uvB = vec2(p.z, p.y);
    vec4 slabA = gCell(uvA * vec2(0.14, 0.05));
    vec4 slabB = gCell(uvB * vec2(0.14, 0.05) + 31.0);
    vec4 slab = wx > 0.5 ? slabB : slabA;
    float seam = 1.0 - smoothstep(0.02, 0.1, slab.y - slab.x);
    color *= (0.9 + 0.18 * slab.z) * (1.0 - 0.14 * clamp(slab.w * 1.6, -1.0, 1.0));
    color *= 1.0 - seam * 0.3 * gFade(px, 0.14);
    float grain = mix(gNoise(uvA * 0.9), gNoise(uvB * 0.9), wx);
    color *= 1.0 + (grain - 0.5) * 0.16 * gFade(px, 0.9);
    float stain = smoothstep(0.55, 0.8, gNoise(vec2((wx > 0.5 ? p.z : p.x) * 0.08, p.y * 0.02)));
    color *= 1.0 - stain * 0.22;
    return color;
  }

  vec3 canyonTop(vec3 c, vec2 q, float px) {
    vec3 dust = vec3(0.687, 0.371, 0.144);
    vec3 color = mix(c, dust, 0.45) * mix(0.9, 1.08, gFbm(q * 0.03));
    color = mix(color, vec3(0.32, 0.36, 0.15), smoothstep(0.62, 0.72, gNoise(q * 0.22 + 5.0)) * 0.55 * gFade(px, 0.22));
    color *= 1.0 - smoothstep(0.74, 0.8, gNoise(q * 0.9 + 2.0)) * 0.18 * gFade(px, 0.9);
    return color;
  }

  vec3 canyonSand(vec3 c, vec2 q, float px) {
    vec3 color = c * mix(0.93, 1.06, gFbm(q * 0.08));
    color *= 1.0 + (sin(q.x * 1.3 + gNoise(q * 0.2) * 4.0) * 0.5 + 0.5 - 0.5) * 0.08 * gFade(px, 1.3);
    color = mix(color, color * 0.72, smoothstep(0.78, 0.84, gNoise(q * 1.4 + 9.0)) * gFade(px, 1.4));
    return color;
  }
`;

export function canyonGround(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nvarying float vKind;\nvarying vec3 vGround;\nvarying vec3 vGroundN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvKind = aKind;\nvGround = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGroundN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}\n${CANYON}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float px = length(fwidth(vGround.xz));
          vec3 n = normalize(vGroundN);
          vec3 rock = canyonRock(vGround, n, px);
          vec3 top = canyonTop(rock, vGround.xz, px);
          vec3 sand = canyonSand(c, vGround.xz, px);
          float steep = 1.0 - smoothstep(0.55, 0.8, n.y);
          vec3 ground = mix(top, rock, steep);
          diffuseColor.rgb = mix(sand, ground, smoothstep(0.2, 0.8, vKind));
        }`,
      );
  };
  material.customProgramCacheKey = () => 'canyon-ground';
  return material;
}
