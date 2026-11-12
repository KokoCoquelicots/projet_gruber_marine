import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
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
const MIN_CAMERA_Z = 1.62;
const MAX_CAMERA_Z = 5.8;
const MAX_PIXEL_RATIO = 2;

const earthVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const earthFragmentShader = /* glsl */ `
  uniform sampler2D uEarthMap;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 texColor = texture2D(uEarthMap, vUv).rgb;
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(-0.55, 0.65, 0.95));

    // Éclairage solaire naturel
    float diffuse = max(dot(normal, lightDir), 0.0);
    float lighting = 0.60 + 0.45 * diffuse;

    // Reflet spéculaire subtil sur les océans
    float isOcean = smoothstep(0.0, 0.08, texColor.b - texColor.g * 0.85);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 30.0) * isOcean * 0.26;

    // Halo atmosphérique Fresnel sur le limbe terrestre
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    vec3 atmosphereColor = vec3(0.36, 0.80, 0.75);

    vec3 finalColor = texColor * lighting + vec3(0.75, 0.93, 0.97) * spec + atmosphereColor * fresnel * 0.48;
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

export interface GlobeSceneCallbacks {
  onSelectPollution?: (id: string) => void;
  onHoverPollution?: (id: string | null) => void;
  onPickCoordinates?: (coords: { latitude: number; longitude: number }) => void;
}

/**
 * Globe Terrestre 3D réaliste (Natural Earth 1:50m) avec traits lumineux (spikes)
 * cliquables par Raycaster et zoom haute précision jusqu'à l'échelle régionale.
 */
export class GlobeScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, 1, 0.02, 30);
  private readonly timer = new Timer();
  private readonly tiltGroup = new Group();
  private readonly spinGroup = new Group();
  private readonly markersGroup = new Group();
  private readonly earthMesh: Mesh;
  private readonly earthTexture: CanvasTexture;
  private readonly earthMaterial: ShaderMaterial;
  private readonly haloMaterial: ShaderMaterial;
  private readonly sharedGeometries: BufferGeometry[] = [];
  private readonly spikeHandles: SpikeHandle[] = [];
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

      // Sensibilité de rotation proportionnelle à la distance de la surface (très précise à fort zoom)
      const surfaceDist = Math.max(0.18, this.currentCameraZ - GLOBE_RADIUS);
      const speed = Math.min(0.0065, Math.max(0.0009, surfaceDist * 0.0023));
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
    const step = event.deltaY * 0.0014;
    this.zoomBy(step);
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: GlobeSceneCallbacks = {}
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, this.currentCameraZ);

    this.spikeGeometry.translate(0, 0.5, 0);
    this.hitGeometry.translate(0, 0.5, 0);
    this.sharedGeometries.push(this.spikeGeometry, this.hitGeometry, this.tipGeometry, this.ringGeometry);

    this.earthTexture = new CanvasTexture(createEarthCanvas());
    this.earthTexture.minFilter = LinearMipmapLinearFilter;
    this.earthTexture.magFilter = LinearFilter;
    this.earthTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const sphereGeometry = new SphereGeometry(GLOBE_RADIUS, 96, 96);
    this.sharedGeometries.push(sphereGeometry);
    this.earthMaterial = new ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
      uniforms: {
        uEarthMap: { value: this.earthTexture }
      }
    });
    this.earthMesh = new Mesh(sphereGeometry, this.earthMaterial);
    this.spinGroup.add(this.earthMesh);

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

    // Suivi des coordonnées pour décaler légèrement les signalements situés exactement au même point
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
  focusCoordinates(latitude: number, longitude: number, zoomIn = true): void {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const latRad = (Math.max(-90, Math.min(90, lat)) * Math.PI) / 180;
    const lonRad = (Math.max(-180, Math.min(180, lon)) * Math.PI) / 180;

    this.targetTiltX = latRad;

    const desiredSpinY = -Math.PI / 2 - lonRad;
    const delta = Math.atan2(Math.sin(desiredSpinY - this.currentSpinY), Math.cos(desiredSpinY - this.currentSpinY));
    this.targetSpinY = this.currentSpinY + delta;

    this.targetCameraZ = zoomIn ? CAMERA_ZOOMED_Z : CAMERA_OVERVIEW_Z;
    this.autoRotate = false;
  }

  /** Ajuste le zoom de la caméra (delta négatif = zoomer plus près, positif = dézoomer). */
  zoomBy(delta: number): void {
    this.autoRotate = false;
    this.targetCameraZ = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, this.targetCameraZ + delta));
  }

  /** Dézoome pour afficher la Terre entière. */
  resetOverview(): void {
    this.targetCameraZ = CAMERA_OVERVIEW_Z;
    this.autoRotate = true;
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.clearMarkers();
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
    const elapsed = this.timer.getElapsed();

    if (this.autoRotate && !this.isDragging) {
      this.targetSpinY += 0.0015;
    }

    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * 0.09;
    this.currentSpinY += (this.targetSpinY - this.currentSpinY) * 0.09;
    this.currentCameraZ += (this.targetCameraZ - this.currentCameraZ) * 0.085;

    this.tiltGroup.rotation.x = this.currentTiltX;
    this.spinGroup.rotation.y = this.currentSpinY;
    this.camera.position.z = this.currentCameraZ;

    // Affine les traits lorsque la caméra zoome très près de la surface pour une précision optimale
    const zoomScale = Math.min(1.1, Math.max(0.26, (this.currentCameraZ - GLOBE_RADIUS) / 1.55));

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
