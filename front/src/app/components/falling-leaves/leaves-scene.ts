import {
  CanvasTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearMipmapLinearFilter,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Timer,
  WebGLRenderer
} from 'three';
import { leafFragmentShader, leafVertexShader } from './leaf-shaders';
import { ATLAS_COLUMNS, ATLAS_ROWS, createLeafAtlas } from './leaf-texture';

const CAMERA_Z = 10;
const FIELD_OF_VIEW = 45;
const MAX_PIXEL_RATIO = 1.5;
/**
 * Couleur du fond du site (#edf5ef), vers laquelle se fondent les feuilles lointaines.
 * Le shader travaille directement en sRGB (comme le canvas de la texture) : aucune conversion.
 */
const HAZE_SRGB = [0xed / 255, 0xf5 / 255, 0xef / 255];

/** Nombre de feuilles adapté à la surface de l'écran (moins sur mobile). */
export function leafCountFor(width: number, height: number): number {
  return Math.round(Math.min(36, Math.max(12, (width * height) / 55_000)));
}

/**
 * Scène Three.js des feuilles qui tombent.
 * Une seule géométrie instanciée = un seul appel de dessin pour toutes les feuilles.
 */
export class LeavesScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 50);
  private readonly timer = new Timer();
  private readonly geometry: PlaneGeometry;
  private readonly material: ShaderMaterial;
  private readonly texture: CanvasTexture;
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.z = CAMERA_Z;

    this.texture = new CanvasTexture(createLeafAtlas());
    // Alpha prémultiplié : évite les liserés sombres au bord des feuilles lors du filtrage.
    this.texture.premultiplyAlpha = true;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());

    this.material = new ShaderMaterial({
      vertexShader: leafVertexShader,
      fragmentShader: leafFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTanHalfFov: { value: Math.tan((FIELD_OF_VIEW * Math.PI) / 360) },
        uAspect: { value: 1 },
        uCameraZ: { value: CAMERA_Z },
        uAtlasCell: { value: [1 / ATLAS_COLUMNS, 1 / ATLAS_ROWS] },
        uMap: { value: this.texture },
        uOpacity: { value: 0.88 },
        uHaze: { value: HAZE_SRGB }
      },
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: DoubleSide // On voit aussi le revers des feuilles.
    });

    const count = leafCountFor(window.innerWidth, window.innerHeight);
    this.geometry = createLeafGeometry(count);
    const leaves = new InstancedMesh(this.geometry, this.material, count);
    // Les positions sont calculées dans le shader : le frustum culling de Three.js serait faux.
    leaves.frustumCulled = false;
    this.scene.add(leaves);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    this.timer.connect(document); // Le temps se fige quand l'onglet est masqué.
    this.renderer.setAnimationLoop((timestamp) => this.render(timestamp));
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.renderer.dispose();
  }

  private render(timestamp: number): void {
    this.timer.update(timestamp);
    this.material.uniforms['uTime'].value = this.timer.getElapsed();
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (width === 0 || height === 0) return;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.material.uniforms['uAspect'].value = this.camera.aspect;
  }
}

/** Géométrie d'une feuille légèrement subdivisée (pour la courbure) + attributs aléatoires par instance. */
function createLeafGeometry(count: number): PlaneGeometry {
  const geometry = new PlaneGeometry(1, 1, 4, 4);
  const motion = new Float32Array(count * 4);
  const swing = new Float32Array(count * 4);
  const shape = new Float32Array(count * 4);
  const uvOffset = new Float32Array(count * 2);
  const between = (min: number, max: number) => min + Math.random() * (max - min);

  // Profondeurs triées du plus loin au plus proche : avec la transparence,
  // les instances sont dessinées dans l'ordre, donc les feuilles proches passent bien devant.
  const depths = Array.from({ length: count }, () => between(-7, 3)).sort((a, b) => a - b);

  depths.forEach((depth, i) => {
    const nearness = (depth + 7) / 10;
    motion.set([between(-1.15, 0.95), depth, Math.random(), between(14, 22) * (1.25 - nearness * 0.35)], i * 4);
    swing.set([between(0.35, 0.9), between(0.9, 1.6), between(0, Math.PI * 2), Math.random() < 0.35 ? between(1.5, 3) : between(0.1, 0.6)], i * 4);
    shape.set([between(0.45, 0.8), between(0.08, 0.22), between(0, Math.PI * 2), Math.random()], i * 4);

    const cell = Math.floor(Math.random() * ATLAS_COLUMNS * ATLAS_ROWS);
    const column = cell % ATLAS_COLUMNS;
    const row = Math.floor(cell / ATLAS_COLUMNS);
    // L'atlas est retourné verticalement à l'envoi sur le GPU (flipY) : la ligne 0 est en haut.
    uvOffset.set([column / ATLAS_COLUMNS, (ATLAS_ROWS - 1 - row) / ATLAS_ROWS], i * 2);
  });

  geometry.setAttribute('aMotion', new InstancedBufferAttribute(motion, 4));
  geometry.setAttribute('aSwing', new InstancedBufferAttribute(swing, 4));
  geometry.setAttribute('aShape', new InstancedBufferAttribute(shape, 4));
  geometry.setAttribute('aUvOffset', new InstancedBufferAttribute(uvOffset, 2));
  return geometry;
}
