/**
 * Particle-brain shaders (GLSL strings for THREE.ShaderMaterial).
 * three injects: position, normal, modelViewMatrix, projectionMatrix, normalMatrix.
 */

export const brainPointsVertex = /* glsl */ `
// ---- Global ---------------------------------------------------------------
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;          // point size in px at distance 1
uniform float uQuality;       // 0 low .. 1 high
uniform float uMotion;        // 0 reduced motion .. 1 full
// ---- Mode + region state (all damped on the CPU, never popped) ------------
uniform vec3  uModeW;         // weights: x anatomy, y functional, z activity
uniform float uSelected;      // exact selected index (-1 none)
uniform float uHovered;       // exact hovered index (-1 none)
uniform float uSelectW[8];
uniform float uHoverW[8];
uniform float uActivity[8];   // 0..1 educational association strength
uniform float uAnySelected;
uniform float uInternalVis;   // visibility of deep structures
uniform float uCortexAlpha;   // cortex opacity multiplier
uniform vec3  uAnatomyColor[8];
uniform vec3  uFuncColor[8];
uniform vec3  uCentroid[8];   // right-side anchors; mirrored with abs(x)
uniform vec3  uViolet;
uniform vec3  uCyan;
uniform vec3  uDim;
// ---- Hero ----------------------------------------------------------------
uniform float uProgress;      // 0 nebula .. 1 converged brain
uniform float uTint;          // violet->cyan gradient amount
uniform vec2  uPointer;       // NDC
uniform float uPointerAmt;

attribute float aRegion;
attribute float aSeed;
attribute float aKind;        // 0 surface, 1 inner volume, 2 deep structure
attribute float aFold;        // 0 sulcus .. 1 gyral crown
attribute vec3  aScatter;

varying vec3  vColor;
varying float vAlpha;

float band(float x, float w) { return smoothstep(0.0, w * 0.35, x) * smoothstep(w, w * 0.35, x); }

void main() {
  int   r   = int(aRegion + 0.5);
  float sel = uSelectW[r];
  float hov = uHoverW[r];
  float act = uActivity[r];
  float t   = uTime;

  // 1. HERO CONVERGENCE: staggered per point, swirling in from the nebula
  float start = aSeed * 0.45;
  float conv  = smoothstep(start, start + 0.55, uProgress);
  float swirl = (1.0 - conv) * (2.4 + t * 0.03 * uMotion);
  float cs = cos(swirl), sn = sin(swirl);
  vec3 sc = vec3(cs * aScatter.x - sn * aScatter.z, aScatter.y, sn * aScatter.x + cs * aScatter.z);
  vec3 p  = mix(sc, position, conv);

  // 2. BREATHING: analytic curl of a sin potential (divergence-free) + slow swell
  float bt = t * mix(0.12, 0.4, uMotion);
  vec3 q = p * 2.3 + aSeed * 0.7;
  vec3 curl = vec3(cos(q.z + bt), cos(q.x + bt * 1.3), cos(q.y + bt * 0.7))
            + 0.5 * vec3(cos(2.0 * q.y - bt), cos(2.0 * q.z - bt * 1.1), cos(2.0 * q.x - bt * 0.9));
  p += curl * (0.005 + (1.0 - conv) * 0.05);
  p *= 1.0 + 0.006 * sin(bt * 1.4);

  // 3. PULSE WAVES travelling across the surface
  float w1 = fract(p.z * 0.35 - t * 0.08 + aFold * 0.04);
  vec3 src = vec3(sin(t * 0.07) * 0.7, 0.45, cos(t * 0.05) * 0.8);
  float w2 = fract(distance(p, src) * 0.6 - t * 0.12);
  float pulse = (band(w1, 0.06) + 0.7 * band(w2, 0.05)) * uMotion;

  // 4. ACTIVITY PULSES: rings expanding from active regions
  vec3 qa = vec3(abs(p.x), p.y, p.z);
  float actPulse = 0.0;
  for (int i = 0; i < 7; i++) {
    float a = uActivity[i];
    if (a < 0.02) continue;
    float ph = fract(t * 0.3 + float(i) * 0.137);
    float d = distance(qa, uCentroid[i]) - ph * 0.95;
    actPulse += a * exp(-d * d * 220.0) * (1.0 - ph);
  }
  actPulse *= uModeW.z * uMotion;

  // 5. COLOUR: blend the three mode palettes by damped weights
  vec3 actHue = mix(uViolet, uCyan, act);
  vec3 actCol = mix(uDim, actHue, smoothstep(0.02, 0.2, act)) * mix(0.35, 1.3, act);
  vec3 col = uAnatomyColor[r] * uModeW.x + uFuncColor[r] * uModeW.y + actCol * uModeW.z;
  col += actHue * actPulse * 0.9;
  vec3 grad = mix(uViolet, uCyan, smoothstep(-0.9, 0.9, p.z + p.y * 0.4)) * 0.6;
  col = mix(col, grad, uTint);

  // 6. VIEW-SPACE TERMS
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = max(-mv.z, 0.001);
  vec3 nV = normalize(normalMatrix * normal);
  float rim = pow(1.0 - abs(dot(nV, normalize(-mv.xyz))), 2.5);   // fresnel-like
  float isSurf  = 1.0 - step(0.5, aKind);
  float isInner = step(0.5, aKind) * (1.0 - step(1.5, aKind));
  float isDeep  = step(1.5, aKind);

  // 7. BRIGHTNESS: folds, rim, pulses, hover, selection
  float b = mix(0.32, 1.0, aFold) * (0.8 + rim * 0.9 * isSurf);
  b += pulse * 0.5;
  b *= 1.0 + hov * 0.8;
  b *= mix(1.0, mix(0.15, 1.5, sel), uAnySelected);
  float exact = 1.0 - step(0.5, abs(aRegion - uSelected));
  b += exact * uMotion * 0.2 * (0.5 + 0.5 * sin(t * 2.5 + aSeed * 40.0));
  b += (1.0 - step(0.5, abs(aRegion - uHovered))) * 0.05;
  vec4 clip = projectionMatrix * mv;
  vec2 dp = clip.xy / clip.w - uPointer;
  b += exp(-dot(dp, dp) * 14.0) * uPointerAmt * 0.45;

  // 8. ALPHA: layer visibility + depth fade + near-camera fade
  float alpha = 0.55 * mix(1.5, 1.0, uQuality);
  alpha *= mix(1.0, uCortexAlpha, isSurf);
  alpha *= mix(1.0, 0.22, isInner);
  float deepVis = clamp(uInternalVis + sel * 1.2 + act * uModeW.z, 0.0, 1.0);
  alpha *= mix(1.0, deepVis * 1.5, isDeep);
  float center = -(modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
  alpha *= 1.0 - 0.6 * smoothstep(-0.4, 1.0, depth - center);
  alpha *= smoothstep(0.04, 0.4, depth);
  alpha *= mix(0.45, 1.0, conv);

  vColor = col * b;
  vAlpha = alpha;
  gl_Position = clip;
  float size = uSize * (0.55 + aSeed * 0.9) * (1.0 + isDeep * 0.3 + hov * 0.25 + sel * uAnySelected * 0.3);
  gl_PointSize = clamp(size * uPixelRatio / depth, 0.0, 48.0);
}
`;

export const brainPointsFragment = /* glsl */ `
varying vec3  vColor;
varying float vAlpha;

void main() {
  if (vAlpha < 0.003) discard;
  // Soft round sprite with a gaussian falloff.
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor, exp(-d * 3.2) * vAlpha);
  #include <colorspace_fragment>
}
`;

/* ---- Neural connection arcs (lines + travelling pulse points) ------------ */
export const connectionVertex = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform float uPixelRatio;
uniform float uPulseSize;
uniform vec3  uModeW;
uniform float uSelectW[8];
uniform float uAnySelected;

attribute float aT;        // 0..1 along the arc
attribute float aOffset;   // per-arc phase
attribute vec2  aPair;     // region indices of both ends

varying float vT;
varying float vVis;
varying float vPulse;

void main() {
  float selVis = max(uSelectW[int(aPair.x + 0.5)], uSelectW[int(aPair.y + 0.5)]);
  // Functional mode shows all arcs; a selection shows only its own.
  vVis = clamp(uModeW.y * mix(1.0, 0.3, uAnySelected) + selVis, 0.0, 1.0);
  float head = fract(uTime * 0.22 + aOffset);
  float dt = aT - head;
  vPulse = exp(-dt * dt * 220.0) * uMotion;
  vT = aT;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPulseSize * uPixelRatio * (0.25 + vPulse) / max(-mv.z, 0.05), 0.0, 32.0);
}
`;

export const connectionLineFragment = /* glsl */ `
uniform vec3 uViolet;
uniform vec3 uCyan;
varying float vT;
varying float vVis;
varying float vPulse;

void main() {
  if (vVis < 0.005) discard;
  float ends = smoothstep(0.0, 0.08, vT) * smoothstep(1.0, 0.92, vT);
  gl_FragColor = vec4(mix(uViolet, uCyan, vT), vVis * (0.22 + vPulse * 0.9) * ends);
  #include <colorspace_fragment>
}
`;

export const connectionPulseFragment = /* glsl */ `
uniform vec3 uViolet;
uniform vec3 uCyan;
varying float vT;
varying float vVis;
varying float vPulse;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0 || vVis * vPulse < 0.01) discard;
  // > 1.0 so only these bright heads cross the bloom threshold.
  gl_FragColor = vec4(mix(uViolet, uCyan, vT) * 1.6, exp(-d * 4.0) * vVis * vPulse);
  #include <colorspace_fragment>
}
`;
