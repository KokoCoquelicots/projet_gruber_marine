/**
 * Shaders des feuilles. Toute l'animation est calculée sur le GPU à partir du temps :
 * le CPU ne met à jour qu'un uniform par image, quel que soit le nombre de feuilles.
 */

export const leafVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uTanHalfFov;
  uniform float uAspect;
  uniform float uCameraZ;
  uniform vec2 uAtlasCell;

  attribute vec4 aMotion;   // x : position horizontale (-1..1), y : profondeur, z : décalage dans le cycle, w : durée de chute (s)
  attribute vec4 aSwing;    // x : amplitude, y : pulsation, z : phase, w : vitesse de rotation (tournoiement)
  attribute vec4 aShape;    // x : taille, y : courbure, z : rotation initiale, w : teinte
  attribute vec2 aUvOffset; // cellule de l'atlas

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vNearness;
  varying float vTint;

  mat3 rotateX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotateY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotateZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

  void main() {
    float depth = aMotion.y;
    float halfHeight = uTanHalfFov * (uCameraZ - depth);
    float halfWidth = halfHeight * uAspect;
    float size = aShape.x;

    // Cycle de chute : de juste au-dessus de l'écran à juste en dessous, puis on recommence.
    float progress = fract(aMotion.z + uTime / aMotion.w);
    float elapsed = progress * aMotion.w;
    float travel = 2.0 * halfHeight + 2.0 * size;

    // Balancement pendulaire : la feuille glisse latéralement et s'incline dans le sens du mouvement.
    float swingAngle = aSwing.y * elapsed + aSwing.z;
    float swing = sin(swingAngle);
    float wind = 0.18 * elapsed + 0.25 * sin(uTime * 0.11 + aSwing.z);

    vec3 offset = vec3(
      aMotion.x * halfWidth + swing * aSwing.x + wind,
      halfHeight + size - progress * travel + 0.08 * aSwing.x * cos(2.0 * swingAngle),
      depth
    );

    // Courbure de la feuille (elle n'est pas parfaitement plate).
    vec3 local = position * size;
    local.z += aShape.y * size * (position.x * position.x * 2.0 - position.y * 0.15);
    vec3 normal = normalize(vec3(-aShape.y * 4.0 * position.x, aShape.y * 0.15, 1.0));

    mat3 rotation = rotateZ(aShape.z + cos(swingAngle) * 0.65)
      * rotateY(elapsed * aSwing.w)
      * rotateX(0.9 + sin(swingAngle * 2.0) * 0.35);

    vec3 world = rotation * local + offset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);

    vUv = (uv * uAtlasCell) + aUvOffset;
    vNormal = rotation * normal;
    vNearness = smoothstep(-7.0, 3.0, depth);
    vTint = aShape.w;
  }
`;

export const leafFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec3 uHaze;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vNearness;
  varying float vTint;

  const vec3 LIGHT = normalize(vec3(-0.4, 0.8, 0.55));

  void main() {
    vec4 texel = texture2D(uMap, vUv); // alpha prémultiplié
    if (texel.a < 0.02) discard;
    vec3 albedo = texel.rgb / texel.a;

    // Légère variation de teinte par feuille (plus rouge ou plus jaune).
    albedo *= mix(vec3(1.0, 0.92, 0.85), vec3(0.95, 1.02, 1.05), vTint);

    // Le revers de la feuille est plus pâle et plus terne.
    vec3 normal = normalize(gl_FrontFacing ? vNormal : -vNormal);
    if (!gl_FrontFacing) albedo = mix(albedo, vec3(dot(albedo, vec3(0.33))), 0.3) * 1.05 + 0.04;

    // Éclairage doux : la feuille s'éclaire et s'assombrit en tournoyant.
    float diffuse = max(dot(normal, LIGHT), 0.0);
    float sheen = pow(max(dot(reflect(-LIGHT, normal), vec3(0.0, 0.0, 1.0)), 0.0), 16.0) * 0.18;
    vec3 color = albedo * (0.6 + 0.45 * diffuse) + sheen;

    // Perspective atmosphérique : les feuilles lointaines se fondent dans le fond du site.
    color = mix(uHaze, color, mix(0.55, 1.0, vNearness));
    float alpha = texel.a * uOpacity * mix(0.5, 1.0, vNearness);

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;
