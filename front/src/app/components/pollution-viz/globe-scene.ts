import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three';
import { Pollution } from '../../models/pollution-declaration';
import { createEarthCanvas } from './earth-texture';
import { cartesianToLatLng, getPollutionTheme, latLngToCartesian } from './pollution-viz-theme';

export const GLOBE_RADIUS = 1.42;
const CAMERA_OVERVIEW_Z = 5.15;
const CAMERA_ZOOMED_Z = 4.45;
const CAMERA_PRECISE_Z = 1.52;
const MIN_ALTITUDE = 0.00152;
const MIN_CAMERA_Z = GLOBE_RADIUS + MIN_ALTITUDE; // ~×2454 max
const MAX_CAMERA_Z = 5.8;
const MAX_PIXEL_RATIO = 2;
const SATELLITE_FADE_START_Z = 3.45;
const SATELLITE_FADE_END_Z = 2.25;
const MAX_TILE_CACHE = 240;
const MAX_TILE_ZOOM = 14;
const MAX_NEW_TILES_PER_FRAME = 3;

export type GlobeViewMode = 'auto' | 'satellite' | 'map';

export interface GlobeViewState {
  isSatellite: boolean;
  zoomLevel: number;
  mode: GlobeViewMode;
}

const earthVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vLocalPos = normalize(position);
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const earthFragmentShader = /* glsl */ `
  uniform sampler2D uEarthMap;
  uniform float uSatelliteMix;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPos;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash31(i);
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise3(p);
      p = p * 2.15 + vec3(13.7, 7.1, 19.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 texColor = texture2D(uEarthMap, vUv).rgb;
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(-0.55, 0.65, 0.95));

    float isOcean = smoothstep(0.0, 0.08, texColor.b - texColor.g * 0.85);
    float isLand = 1.0 - isOcean;

    // Relief satellite procédural (Blue Marble / fallback continu sous les tuiles)
    float relief = fbm(vLocalPos * 16.0);
    float microDetail = fbm(vLocalPos * 68.0);
    float ridge = smoothstep(0.46, 0.78, relief);

    vec3 deepOcean = mix(vec3(0.03, 0.11, 0.20), vec3(0.06, 0.22, 0.34), relief);
    vec3 lushLand = mix(texColor * 0.78, vec3(0.14, 0.32, 0.17), 0.35 + 0.35 * microDetail);
    vec3 rockAndPeak = mix(vec3(0.45, 0.42, 0.34), vec3(0.78, 0.80, 0.79), smoothstep(0.65, 0.92, relief));
    vec3 satLand = mix(lushLand, rockAndPeak, ridge * 0.65);
    satLand *= 0.86 + 0.28 * microDetail;

    vec3 satelliteBase = mix(satLand, deepOcean, isOcean);
    vec3 baseColor = mix(texColor, satelliteBase, uSatelliteMix);

    // Ombrage naturel et micro-relief sur la lumière solaire
    float diffuse = max(dot(normal, lightDir), 0.0);
    float terrainShade = mix(1.0, 0.84 + 0.32 * microDetail, uSatelliteMix * isLand);
    float lighting = (0.60 + 0.45 * diffuse) * terrainShade;

    // Reflet spéculaire subtil sur les océans
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 30.0) * isOcean * mix(0.26, 0.38, uSatelliteMix);

    // Halo atmosphérique Fresnel sur le limbe terrestre
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    vec3 atmosphereColor = mix(vec3(0.36, 0.80, 0.75), vec3(0.35, 0.66, 0.95), uSatelliteMix * 0.55);

    vec3 finalColor = baseColor * lighting + vec3(0.75, 0.93, 0.97) * spec + atmosphereColor * fresnel * 0.48;
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const haloVertexShader = /* glsl */ `
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragmentShader = /* glsl */ `
  varying vec3 vNormal;

  void main() {
    float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.6);
    gl_FragColor = vec4(0.30, 0.78, 0.72, 1.0) * max(intensity, 0.0) * 0.58;
  }
`;

interface SpikeHandle {
  id: string;
  holder: Group;
  spikeMesh: Mesh;
  spikeMaterial: MeshBasicMaterial;
  tipMesh: Mesh;
  tipMaterial: MeshBasicMaterial;
  ringMesh: Mesh;
  ringMaterial: MeshBasicMaterial;
  hitMesh: Mesh;
  baseHeight: number;
  phase: number;
  isSelected: boolean;
}

interface SatelliteTileEntry {
  key: string;
  z: number;
  mesh: Mesh;
  geometry: BufferGeometry;
  material: MeshBasicMaterial;
  texture: Texture;
  loaded: boolean;
  failed: boolean;
  fadeAlpha: number;
  lastUsed: number;
}

interface TileCoord {
  key: string;
  z: number;
  x: number;
  y: number;
}

export interface GlobeSceneCallbacks {
  onSelectPollution?: (id: string) => void;
  onHoverPollution?: (id: string | null) => void;
  onPickCoordinates?: (coords: { latitude: number; longitude: number }) => void;
  onViewStateChange?: (state: GlobeViewState) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function normalizeLongitude(lon: number): number {
  let res = ((lon + 180) % 360 + 360) % 360 - 180;
  if (res === -180 && lon > 0) res = 180;
  return res;
}

function lonToTileX(lon: number, zoom: number): number {
  const n = 2 ** zoom;
  return ((Math.floor(((lon + 180) / 360) * n) % n) + n) % n;
}

function latToTileY(lat: number, zoom: number): number {
  const clampedLat = clamp(lat, -85.05112878, 85.05112878);
  const latRad = (clampedLat * Math.PI) / 180;
  const n = 2 ** zoom;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return clamp(y, 0, n - 1);
}

function tileToLon(tileX: number, zoom: number): number {
  return (tileX / 2 ** zoom) * 360 - 180;
}

function tileToLat(tileY: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * tileY) / 2 ** zoom;
  return (Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) * 180) / Math.PI;
}

/**
 * Formule logarithmique continue haute densité : plus l'altitude diminue,
 * plus le niveau de détail Web Mercator (z = 4..14) augmente sans basculer sur z=15.
 */
function altitudeToTileZoom(altitude: number): number {
  const rawZ = Math.round(Math.log2(38 / Math.max(MIN_ALTITUDE, altitude)));
  return clamp(rawZ, 4, MAX_TILE_ZOOM);
}

/**
 * Construit un patch sphérique épousant exactement les coordonnées Web Mercator d'une tuile satellite (z, x, y).
 */
function createSphericalTileGeometry(z: number, x: number, y: number, radius: number, segments = 8): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segments; iy++) {
    const vFrac = iy / segments;
    const lat = tileToLat(y + vFrac, z);
    for (let ix = 0; ix <= segments; ix++) {
      const uFrac = ix / segments;
      const lon = tileToLon(x + uFrac, z);
      const [px, py, pz] = latLngToCartesian(lat, lon, radius);
      positions.push(px, py, pz);
      uvs.push(uFrac, 1 - vFrac);
    }
  }

  const stride = segments + 1;
  for (let iy = 0; iy < segments; iy++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iy * stride + ix;
      const b = (iy + 1) * stride + ix;
      const c = (iy + 1) * stride + ix + 1;
      const d = iy * stride + ix + 1;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Collecte les coordonnées d'une grille autour de (lat, lon) triées du centre vers l'extérieur.
 */
function collectRingTiles(lat: number, lon: number, z: number, rx: number, ry: number): TileCoord[] {
  const centerX = lonToTileX(lon, z);
  const centerY = latToTileY(lat, z);
  const n = 2 ** z;
  const offsets: Array<{ dx: number; dy: number; dist: number }> = [];

  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      offsets.push({ dx, dy, dist: dx * dx + dy * dy });
    }
  }
  offsets.sort((a, b) => a.dist - b.dist);

  const tiles: TileCoord[] = [];
  for (const { dx, dy } of offsets) {
    const ty = centerY + dy;
    if (ty < 0 || ty >= n) continue;
    const tx = ((centerX + dx) % n + n) % n;
    tiles.push({ key: `${z}/${tx}/${ty}`, z, x: tx, y: ty });
  }
  return tiles;
}

/**
 * Globe Terrestre 3D réaliste (Natural Earth 1:50m + pyramide satellite Multi-LOD jusqu'à z=15)
 * avec chargement étalé par frame (0 baisse de FPS) et netteté progressive continue.
 */
export class GlobeScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, 1, 0.0004, 30);
  private readonly timer = new Timer();
  private readonly tiltGroup = new Group();
  private readonly spinGroup = new Group();
  private readonly satelliteGroup = new Group();
  private readonly markersGroup = new Group();
  private readonly earthMesh: Mesh;
  private readonly earthTexture: CanvasTexture;
  private readonly earthMaterial: ShaderMaterial;
  private readonly haloMaterial: ShaderMaterial;
  private readonly sharedGeometries: BufferGeometry[] = [];
  private readonly spikeHandles: SpikeHandle[] = [];
  private readonly satelliteTiles = new Map<string, SatelliteTileEntry>();
  private readonly tileLoader = new TextureLoader();
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly resizeObserver: ResizeObserver;

  // Géométries partagées des traits (spikes)
  private readonly spikeGeometry = new CylinderGeometry(0.0055, 0.018, 1, 10);
  private readonly hitGeometry = new CylinderGeometry(0.055, 0.055, 1, 8);
  private readonly tipGeometry = new SphereGeometry(0.026, 14, 14);
  private readonly ringGeometry = new RingGeometry(0.028, 0.056, 28);

  // Orientation centrée par défaut sur la France / Europe (~46.6° N, 2° E)
  private targetTiltX = (46.6 * Math.PI) / 180;
  private targetSpinY = -Math.PI / 2 - (2.0 * Math.PI) / 180;
  private currentTiltX = this.targetTiltX;
  private currentSpinY = this.targetSpinY;
  private targetCameraZ = CAMERA_OVERVIEW_Z;
  private currentCameraZ = CAMERA_OVERVIEW_Z;

  private viewMode: GlobeViewMode = 'auto';
  private lastReportedSatellite = false;
  private lastReportedZoom = 1;
  private lastReportedMode: GlobeViewMode = 'auto';
  private frameCounter = 0;
  private disposed = false;

  private autoRotate = false;
  private isDragging = false;
  private pointerMoved = false;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;

  private readonly onPointerDown = (event: PointerEvent) => {
    this.isDragging = true;
    this.pointerMoved = false;
    this.autoRotate = false;
    this.downX = event.clientX;
    this.downY = event.clientY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.isDragging) {
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;

      if (Math.hypot(event.clientX - this.downX, event.clientY - this.downY) > 4) {
        this.pointerMoved = true;
      }

      // Sensibilité logarithmique proportionnelle à l'altitude pour un contrôle fluide jusqu'au niveau rue
      const surfaceDist = Math.max(MIN_ALTITUDE, this.currentCameraZ - GLOBE_RADIUS);
      const speed = Math.min(0.0065, Math.max(0.000015, surfaceDist * 0.0022));
      this.targetSpinY += dx * speed;
      this.targetTiltX = Math.max(-1.42, Math.min(1.42, this.targetTiltX + dy * speed));
      return;
    }

    const hitId = this.raycastSpike(event);
    this.canvas.style.cursor = hitId ? 'pointer' : this.callbacks.onPickCoordinates ? 'crosshair' : 'grab';
    this.callbacks.onHoverPollution?.(hitId);
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const wasClick = this.isDragging && !this.pointerMoved;
    this.isDragging = false;

    if (!wasClick) return;

    const hitId = this.raycastSpike(event);
    if (hitId) {
      this.callbacks.onSelectPollution?.(hitId);
      return;
    }

    if (this.callbacks.onPickCoordinates) {
      const coords = this.raycastEarthSurface(event);
      if (coords) {
        this.callbacks.onPickCoordinates(coords);
      }
    }
  };

  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.autoRotate = false;
    const altitude = Math.max(MIN_ALTITUDE, this.targetCameraZ - GLOBE_RADIUS);
    const nextAltitude = clamp(
      altitude * Math.exp(event.deltaY * 0.0012),
      MIN_ALTITUDE,
      MAX_CAMERA_Z - GLOBE_RADIUS
    );
    this.targetCameraZ = GLOBE_RADIUS + nextAltitude;
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: GlobeSceneCallbacks = {}
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, this.currentCameraZ);
    this.tileLoader.setCrossOrigin('anonymous');

    this.spikeGeometry.translate(0, 0.5, 0);
    this.hitGeometry.translate(0, 0.5, 0);
    this.sharedGeometries.push(this.spikeGeometry, this.hitGeometry, this.tipGeometry, this.ringGeometry);

    this.earthTexture = new CanvasTexture(createEarthCanvas());
    this.earthTexture.minFilter = LinearMipmapLinearFilter;
    this.earthTexture.magFilter = LinearFilter;
    this.earthTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const sphereGeometry = new SphereGeometry(GLOBE_RADIUS, 128, 128);
    this.sharedGeometries.push(sphereGeometry);
    this.earthMaterial = new ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
      uniforms: {
        uEarthMap: { value: this.earthTexture },
        uSatelliteMix: { value: 0 }
      }
    });
    this.earthMesh = new Mesh(sphereGeometry, this.earthMaterial);
    this.spinGroup.add(this.earthMesh);

    this.satelliteGroup.visible = false;
    this.spinGroup.add(this.satelliteGroup);

    const haloGeometry = new SphereGeometry(GLOBE_RADIUS * 1.12, 48, 48);
    this.sharedGeometries.push(haloGeometry);
    this.haloMaterial = new ShaderMaterial({
      vertexShader: haloVertexShader,
      fragmentShader: haloFragmentShader,
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    this.scene.add(new Mesh(haloGeometry, this.haloMaterial));

    this.spinGroup.add(this.markersGroup);
    this.tiltGroup.add(this.spinGroup);
    this.scene.add(this.tiltGroup);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    this.timer.connect(document);
    this.renderer.setAnimationLoop((timestamp) => this.render(timestamp));
  }

  /**
   * Affiche chaque pollution de la base de données sous forme de trait lumineux (spike)
   * sur le globe, sélectionne la pollution active et zoome dessus.
   */
  setPollutions(pollutions: readonly Pollution[], selectedId: string | null = null, zoomOnSelected = true): void {
    this.clearMarkers();

    const seenCoords = new Map<string, number>();

    pollutions.forEach((pollution, index) => {
      if (pollution.latitude === null || pollution.longitude === null) return;
      const rawLat = Number(pollution.latitude);
      const rawLon = Number(pollution.longitude);
      if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) return;

      const coordKey = `${rawLat.toFixed(2)},${rawLon.toFixed(2)}`;
      const duplicateCount = seenCoords.get(coordKey) ?? 0;
      seenCoords.set(coordKey, duplicateCount + 1);

      let lat = rawLat;
      let lon = rawLon;
      if (duplicateCount > 0) {
        const angle = duplicateCount * 2.39996;
        const radiusOffset = 0.045 * Math.sqrt(duplicateCount);
        lat = Math.max(-89.5, Math.min(89.5, rawLat + Math.sin(angle) * radiusOffset));
        lon = rawLon + Math.cos(angle) * radiusOffset;
      }

      const isSelected = String(pollution.id) === String(selectedId);
      const theme = getPollutionTheme(pollution.type);
      const [x, y, z] = latLngToCartesian(lat, lon, GLOBE_RADIUS);
      const surfacePos = new Vector3(x, y, z);
      const normal = surfacePos.clone().normalize();

      const holder = new Group();
      holder.position.copy(surfacePos);
      holder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normal);

      const baseHeight = isSelected ? 0.32 : 0.2;

      const spikeMaterial = new MeshBasicMaterial({
        color: new Color(isSelected ? theme.accentHex : theme.primaryHex),
        transparent: true,
        opacity: isSelected ? 1 : 0.88
      });
      const spikeMesh = new Mesh(this.spikeGeometry, spikeMaterial);
      spikeMesh.scale.set(isSelected ? 1.35 : 1, baseHeight, isSelected ? 1.35 : 1);
      holder.add(spikeMesh);

      const tipMaterial = new MeshBasicMaterial({
        color: new Color(isSelected ? '#ffffff' : theme.accentHex)
      });
      const tipMesh = new Mesh(this.tipGeometry, tipMaterial);
      tipMesh.position.y = baseHeight;
      tipMesh.scale.setScalar(isSelected ? 1.25 : 0.9);
      holder.add(tipMesh);

      const ringMaterial = new MeshBasicMaterial({
        color: new Color(theme.accentHex),
        side: DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.88 : 0,
        depthWrite: false
      });
      const ringMesh = new Mesh(this.ringGeometry, ringMaterial);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.004;
      ringMesh.visible = isSelected;
      holder.add(ringMesh);

      const hitMaterial = new MeshBasicMaterial({ visible: false });
      const hitMesh = new Mesh(this.hitGeometry, hitMaterial);
      hitMesh.scale.set(1, baseHeight + 0.08, 1);
      const idStr = String(pollution.id);
      hitMesh.userData['pollutionId'] = idStr;
      tipMesh.userData['pollutionId'] = idStr;
      spikeMesh.userData['pollutionId'] = idStr;
      holder.add(hitMesh);

      this.markersGroup.add(holder);
      this.spikeHandles.push({
        id: idStr,
        holder,
        spikeMesh,
        spikeMaterial,
        tipMesh,
        tipMaterial,
        ringMesh,
        ringMaterial,
        hitMesh,
        baseHeight,
        phase: index * 0.85,
        isSelected
      });
    });

    const target = selectedId
      ? pollutions.find((item) => String(item.id) === String(selectedId))
      : pollutions[0];

    if (target && target.latitude !== null && target.longitude !== null) {
      const targetLat = Number(target.latitude);
      const targetLon = Number(target.longitude);
      if (Number.isFinite(targetLat) && Number.isFinite(targetLon)) {
        this.focusCoordinates(targetLat, targetLon, zoomOnSelected && Boolean(selectedId));
        return;
      }
    }

    this.targetCameraZ = CAMERA_OVERVIEW_Z;
    this.autoRotate = pollutions.length === 0;
  }

  /**
   * Oriente le globe pour placer (latitude, longitude) face à la caméra
   * et ajuste le niveau de zoom.
   */
  focusCoordinates(latitude: number, longitude: number, zoomIn = true, targetZ = CAMERA_ZOOMED_Z): void {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const latRad = (Math.max(-90, Math.min(90, lat)) * Math.PI) / 180;
    const lonRad = (Math.max(-180, Math.min(180, lon)) * Math.PI) / 180;

    this.targetTiltX = latRad;

    const desiredSpinY = -Math.PI / 2 - lonRad;
    const delta = Math.atan2(Math.sin(desiredSpinY - this.currentSpinY), Math.cos(desiredSpinY - this.currentSpinY));
    this.targetSpinY = this.currentSpinY + delta;

    this.targetCameraZ = zoomIn ? clamp(targetZ, MIN_CAMERA_Z, MAX_CAMERA_Z) : CAMERA_OVERVIEW_Z;
    this.autoRotate = false;
  }

  /** Zoom précis directement en vue satellite locale sur des coordonnées. */
  focusSatellitePrecision(latitude: number, longitude: number): void {
    this.focusCoordinates(latitude, longitude, true, CAMERA_PRECISE_Z);
  }

  /** Ajuste le zoom de la caméra de façon logarithmique sur l'altitude (delta < 0 = zoomer). */
  zoomBy(delta: number): void {
    this.autoRotate = false;
    const altitude = Math.max(MIN_ALTITUDE, this.targetCameraZ - GLOBE_RADIUS);
    const factor = delta < 0 ? 0.6 : 1.5;
    const nextAltitude = clamp(altitude * factor, MIN_ALTITUDE, MAX_CAMERA_Z - GLOBE_RADIUS);
    this.targetCameraZ = GLOBE_RADIUS + nextAltitude;
  }

  /** Bascule entre le mode automatique, satellite forcé ou carte vectorielle. */
  setViewMode(mode: GlobeViewMode): void {
    this.viewMode = mode;
  }

  /** Bascule rapidement la vue satellite et retourne le nouveau mode. */
  toggleSatellite(): GlobeViewMode {
    const satActive = this.computeSatelliteMix() > 0.35;
    if (this.viewMode === 'satellite') {
      this.viewMode = 'auto';
    } else if (this.viewMode === 'map') {
      this.viewMode = 'satellite';
    } else {
      this.viewMode = satActive ? 'map' : 'satellite';
    }
    return this.viewMode;
  }

  /** Dézoome pour afficher la Terre entière. */
  resetOverview(): void {
    this.targetCameraZ = CAMERA_OVERVIEW_Z;
    this.autoRotate = true;
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.clearMarkers();
    this.clearSatelliteTiles();
    this.sharedGeometries.forEach((geometry) => geometry.dispose());
    this.earthTexture.dispose();
    this.earthMaterial.dispose();
    this.haloMaterial.dispose();
    this.timer.dispose();
    this.renderer.dispose();
  }

  private clearMarkers(): void {
    this.spikeHandles.forEach((handle) => {
      handle.spikeMaterial.dispose();
      handle.tipMaterial.dispose();
      handle.ringMaterial.dispose();
      (handle.hitMesh.material as MeshBasicMaterial).dispose();
    });
    this.spikeHandles.length = 0;
    this.markersGroup.clear();
  }

  private clearSatelliteTiles(): void {
    this.satelliteTiles.forEach((entry) => {
      entry.geometry.dispose();
      entry.material.dispose();
      entry.texture.dispose();
    });
    this.satelliteTiles.clear();
    this.satelliteGroup.clear();
  }

  private computeSatelliteMix(): number {
    if (this.viewMode === 'satellite') return 1;
    if (this.viewMode === 'map') return 0;
    return smoothstep(SATELLITE_FADE_START_Z, SATELLITE_FADE_END_Z, this.currentCameraZ);
  }

  /**
   * Pyramide Multi-LOD concentrique :
   * Calcule les niveaux directement depuis la cible (pas de téléchargement inutile des niveaux traversés),
   * empile 3 anneaux (zBase large, zMid régional, targetZ haute définition au centre) et étale les créations
   * à 3 tuiles maximum par frame pour garantir 60 FPS sans saccade à l'arrivée.
   */
  private updateSatelliteTiles(satMix: number, dt: number): void {
    const shouldShowTiles =
      satMix > 0.03 && (this.viewMode === 'satellite' || this.currentCameraZ < SATELLITE_FADE_START_Z);
    if (!shouldShowTiles) {
      this.satelliteGroup.visible = false;
      return;
    }

    this.satelliteGroup.visible = true;

    const targetAltitude = Math.max(MIN_ALTITUDE, this.targetCameraZ - GLOBE_RADIUS);
    const targetZ = altitudeToTileZoom(targetAltitude);
    const zMid = Math.max(4, targetZ - 1);
    const zBase = Math.max(4, targetZ - 3);

    const targetLat = clamp((this.targetTiltX * 180) / Math.PI, -82, 82);
    const targetLon = normalizeLongitude(((-this.targetSpinY - Math.PI / 2) * 180) / Math.PI);
    const centerLat = clamp((this.currentTiltX * 180) / Math.PI, -82, 82);
    const centerLon = normalizeLongitude(((-this.currentSpinY - Math.PI / 2) * 180) / Math.PI);

    // Ordre de priorité : centre HD (targetZ) d'abord, puis zMid, puis couverture large zBase
    const orderedDesired: TileCoord[] = [];
    const desiredKeys = new Set<string>();

    const appendRing = (coords: TileCoord[]) => {
      for (const coord of coords) {
        if (!desiredKeys.has(coord.key)) {
          desiredKeys.add(coord.key);
          orderedDesired.push(coord);
        }
      }
    };

    appendRing(collectRingTiles(targetLat, targetLon, targetZ, 1, 1));
    if (zMid !== targetZ) {
      appendRing(collectRingTiles(targetLat, targetLon, zMid, 1, 1));
    }
    if (zBase !== zMid) {
      appendRing(collectRingTiles(centerLat, centerLon, zBase, zBase <= 5 ? 2 : 1, 1));
    }

    // Crée au plus MAX_NEW_TILES_PER_FRAME nouvelles tuiles par frame pour éliminer tout pic CPU/réseau
    let createdThisFrame = 0;
    let focalReady = true;

    for (const coord of orderedDesired) {
      let entry = this.satelliteTiles.get(coord.key);
      if (!entry && createdThisFrame < MAX_NEW_TILES_PER_FRAME) {
        entry = this.createSatelliteTile(coord.z, coord.x, coord.y, coord.key);
        this.satelliteTiles.set(coord.key, entry);
        this.satelliteGroup.add(entry.mesh);
        createdThisFrame++;
      }

      if (entry) {
        entry.lastUsed = this.frameCounter;
        if (entry.loaded) {
          entry.fadeAlpha = Math.min(1, entry.fadeAlpha + dt * 5.0);
          entry.mesh.visible = true;
          entry.material.opacity = entry.fadeAlpha * satMix;
          if (coord.z === targetZ && entry.fadeAlpha < 0.98) {
            focalReady = false;
          }
        } else {
          entry.mesh.visible = false;
          if (coord.z === targetZ && !entry.failed) {
            focalReady = false;
          }
        }
      } else if (coord.z === targetZ) {
        focalReady = false;
      }
    }

    // Garde les tuiles déjà chargées d'anciens niveaux visibles en dessous si l'anneau focal charge encore
    this.satelliteTiles.forEach((entry, key) => {
      if (desiredKeys.has(key)) return;

      if (!focalReady && entry.loaded && entry.z <= targetZ) {
        entry.mesh.visible = true;
        entry.material.opacity = satMix;
      } else {
        entry.mesh.visible = false;
      }
    });

    this.evictOldTiles(desiredKeys);
  }

  private createSatelliteTile(z: number, x: number, y: number, key: string): SatelliteTileEntry {
    const tileRadius = GLOBE_RADIUS * 1.0004 + (z - 4) * 0.00005;
    const geometry = createSphericalTileGeometry(z, x, y, tileRadius, 8);
    const material = new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -z,
      polygonOffsetUnits: -1
    });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = z;
    mesh.visible = false;

    const entry: SatelliteTileEntry = {
      key,
      z,
      mesh,
      geometry,
      material,
      texture: new Texture(),
      loaded: false,
      failed: false,
      fadeAlpha: 0,
      lastUsed: this.frameCounter
    };

    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    this.tileLoader.load(
      url,
      (loadedTexture) => {
        if (this.disposed) {
          loadedTexture.dispose();
          return;
        }
        // Désactive generateMipmaps pour éviter tout blocage GPU à l'arrivée des tuiles
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.generateMipmaps = false;
        loadedTexture.minFilter = LinearFilter;
        loadedTexture.magFilter = LinearFilter;
        entry.texture.dispose();
        entry.texture = loadedTexture;
        entry.material.map = loadedTexture;
        entry.material.needsUpdate = true;
        entry.loaded = true;
      },
      undefined,
      () => {
        entry.failed = true;
        entry.loaded = false;
      }
    );

    return entry;
  }

  private evictOldTiles(keepKeys: Set<string>): void {
    if (this.satelliteTiles.size <= MAX_TILE_CACHE) return;

    const candidates = Array.from(this.satelliteTiles.values())
      .filter((entry) => !keepKeys.has(entry.key))
      .sort((a, b) => a.lastUsed - b.lastUsed);

    while (this.satelliteTiles.size > MAX_TILE_CACHE && candidates.length > 0) {
      const oldest = candidates.shift();
      if (!oldest) break;
      this.satelliteGroup.remove(oldest.mesh);
      oldest.geometry.dispose();
      oldest.material.dispose();
      oldest.texture.dispose();
      this.satelliteTiles.delete(oldest.key);
    }
  }

  private updatePointerNdc(event: PointerEvent): boolean {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }

  private raycastSpike(event: PointerEvent): string | null {
    if (this.spikeHandles.length === 0 || !this.updatePointerNdc(event)) return null;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const targets: Object3D[] = [];
    for (const handle of this.spikeHandles) {
      targets.push(handle.hitMesh, handle.tipMesh, handle.spikeMesh);
    }
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;
    return (hits[0].object.userData['pollutionId'] as string) ?? null;
  }

  private raycastEarthSurface(event: PointerEvent): { latitude: number; longitude: number } | null {
    if (!this.updatePointerNdc(event)) return null;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObject(this.earthMesh, false);
    if (hits.length === 0) return null;
    const localPoint = this.spinGroup.worldToLocal(hits[0].point.clone());
    return cartesianToLatLng(localPoint.x, localPoint.y, localPoint.z);
  }

  private render(timestamp: number): void {
    this.timer.update(timestamp);
    this.frameCounter++;
    const dt = Math.min(0.05, Math.max(0.001, this.timer.getDelta()));
    const elapsed = this.timer.getElapsed();

    if (this.autoRotate && !this.isDragging) {
      this.targetSpinY += 0.08 * dt;
    }

    // Damping réactif indépendant du framerate + interpolation logarithmique sans traîne lente
    const rotAlpha = 1 - Math.exp(-11 * dt);
    const zoomAlpha = 1 - Math.exp(-12.5 * dt);

    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * rotAlpha;
    this.currentSpinY += (this.targetSpinY - this.currentSpinY) * rotAlpha;

    const currAlt = Math.max(MIN_ALTITUDE, this.currentCameraZ - GLOBE_RADIUS);
    const targAlt = Math.max(MIN_ALTITUDE, this.targetCameraZ - GLOBE_RADIUS);
    let nextAlt = Math.exp(Math.log(currAlt) + (Math.log(targAlt) - Math.log(currAlt)) * zoomAlpha);
    if (Math.abs(nextAlt - targAlt) / targAlt < 0.002) {
      nextAlt = targAlt;
    }
    this.currentCameraZ = GLOBE_RADIUS + nextAlt;

    this.tiltGroup.rotation.x = this.currentTiltX;
    this.spinGroup.rotation.y = this.currentSpinY;
    this.camera.position.z = this.currentCameraZ;

    // Mise à jour fluide du mode satellite Multi-LOD
    const satMix = this.computeSatelliteMix();
    this.earthMaterial.uniforms['uSatelliteMix'].value = satMix;
    this.updateSatelliteTiles(satMix, dt);

    const altitude = Math.max(MIN_ALTITUDE, this.currentCameraZ - GLOBE_RADIUS);
    const baseAltitude = CAMERA_OVERVIEW_Z - GLOBE_RADIUS;
    const zoomLevel = Number((baseAltitude / altitude).toFixed(1));
    const isSatellite = satMix > 0.35;

    if (
      isSatellite !== this.lastReportedSatellite ||
      Math.abs(zoomLevel - this.lastReportedZoom) >= 0.2 ||
      this.viewMode !== this.lastReportedMode
    ) {
      this.lastReportedSatellite = isSatellite;
      this.lastReportedZoom = zoomLevel;
      this.lastReportedMode = this.viewMode;
      this.callbacks.onViewStateChange?.({
        isSatellite,
        zoomLevel,
        mode: this.viewMode
      });
    }

    // Affine progressivement les traits jusqu'aux très faibles altitudes
    const zoomScale = Math.min(1.1, Math.max(0.015, altitude / 1.55));

    for (const handle of this.spikeHandles) {
      if (handle.isSelected) {
        const pulse = 1 + 0.12 * Math.sin(elapsed * 3.0 + handle.phase);
        const h = handle.baseHeight * pulse * zoomScale;
        const thickness = 1.32 * zoomScale;

        handle.spikeMesh.scale.set(thickness, h, thickness);
        handle.tipMesh.position.y = h;
        handle.tipMesh.scale.setScalar(1.2 * zoomScale);
        handle.hitMesh.scale.set(zoomScale, h + 0.06 * zoomScale, zoomScale);

        handle.ringMesh.visible = true;
        const cycle = (elapsed + handle.phase) % 1;
        const ringScale = (1 + cycle * 3.1) * zoomScale;
        handle.ringMesh.scale.setScalar(ringScale);
        handle.ringMaterial.opacity = (1 - cycle) * 0.9;
      } else {
        const h = handle.baseHeight * zoomScale;
        const thickness = 0.95 * zoomScale;

        handle.spikeMesh.scale.set(thickness, h, thickness);
        handle.tipMesh.position.y = h;
        handle.tipMesh.scale.setScalar(0.85 * zoomScale);
        handle.hitMesh.scale.set(zoomScale, h + 0.06 * zoomScale, zoomScale);
        handle.ringMesh.visible = false;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (width === 0 || height === 0) return;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
