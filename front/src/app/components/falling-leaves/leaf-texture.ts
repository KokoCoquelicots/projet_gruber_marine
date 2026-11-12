/**
 * Génère une fois un atlas 2×2 de feuilles d'automne sur un canvas 2D :
 * aucune image à télécharger, et une seule texture partagée par toutes les feuilles.
 */

export const ATLAS_COLUMNS = 2;
export const ATLAS_ROWS = 2;

interface LeafStyle {
  /** Demi-largeur de la feuille (0 → 1) en fonction de la position le long de la nervure (0 = base, 1 = pointe). */
  profile: (t: number) => number;
  /** Amplitude des dents du bord (0 = bord lisse). */
  serration: number;
  colors: [light: string, dark: string];
  vein: string;
}

const LEAF_STYLES: LeafStyle[] = [
  {
    // Érable orangé : lobes marqués.
    profile: (t) => Math.sin(Math.PI * t) ** 0.7 * (0.75 + 0.25 * Math.abs(Math.cos(t * Math.PI * 2.5))),
    serration: 0.035,
    colors: ['#eb9a52', '#b9512c'],
    vein: 'rgba(255, 214, 160, 0.55)'
  },
  {
    // Hêtre doré : feuille ovale au bord ondulé.
    profile: (t) => Math.sin(Math.PI * t ** 0.85) * 0.78,
    serration: 0.012,
    colors: ['#f0c75e', '#c98a2b'],
    vein: 'rgba(255, 238, 180, 0.6)'
  },
  {
    // Bouleau encore vert : petite feuille dentée.
    profile: (t) => Math.sin(Math.PI * t ** 0.7) ** 1.1 * 0.7,
    serration: 0.025,
    colors: ['#a9c665', '#5f8f45'],
    vein: 'rgba(230, 245, 190, 0.5)'
  },
  {
    // Érable rouge profond.
    profile: (t) => Math.sin(Math.PI * t) ** 0.6 * (0.7 + 0.3 * Math.abs(Math.cos(t * Math.PI * 2))),
    serration: 0.03,
    colors: ['#d4664a', '#8e3426'],
    vein: 'rgba(255, 190, 160, 0.45)'
  }
];

/** Générateur pseudo-aléatoire déterministe : les feuilles sont identiques à chaque chargement. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Contour de la feuille : la base est en bas de la cellule, la pointe en haut. */
function leafOutline(style: LeafStyle, length: number, halfWidth: number): Path2D {
  const path = new Path2D();
  const steps = 90;
  const point = (t: number, side: 1 | -1) => {
    const teeth = style.serration * Math.abs(Math.sin(t * Math.PI * 22));
    const width = Math.max(0, style.profile(t) - teeth * Math.sin(Math.PI * t)) * halfWidth;
    return [side * width, length / 2 - t * length] as const;
  };

  path.moveTo(...point(0, 1));
  for (let i = 1; i <= steps; i++) path.lineTo(...point(i / steps, 1));
  for (let i = steps; i >= 0; i--) path.lineTo(...point(i / steps, -1));
  path.closePath();
  return path;
}

function drawLeaf(context: CanvasRenderingContext2D, style: LeafStyle, size: number, seed: number): void {
  const random = seededRandom(seed);
  const length = size * 0.8;
  const halfWidth = size * 0.36;
  const outline = leafOutline(style, length, halfWidth);

  // Pétiole (tige) dépassant de la base.
  context.strokeStyle = style.colors[1];
  context.lineWidth = size * 0.018;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(0, length / 2 - size * 0.02);
  context.lineTo(size * 0.015, length / 2 + size * 0.08);
  context.stroke();

  context.save();
  context.clip(outline);

  // Couleur de base : dégradé diagonal clair → foncé.
  const gradient = context.createLinearGradient(-halfWidth, -length / 2, halfWidth, length / 2);
  gradient.addColorStop(0, style.colors[0]);
  gradient.addColorStop(1, style.colors[1]);
  context.fillStyle = gradient;
  context.fillRect(-size / 2, -size / 2, size, size);

  // Taches et brunissement irréguliers pour un rendu naturel.
  for (let i = 0; i < 14; i++) {
    const x = (random() - 0.5) * halfWidth * 2;
    const y = (random() - 0.5) * length;
    const radius = size * (0.03 + random() * 0.09);
    const spot = context.createRadialGradient(x, y, 0, x, y, radius);
    spot.addColorStop(0, `rgba(${random() > 0.5 ? '90, 45, 20' : '255, 230, 170'}, ${0.12 + random() * 0.12})`);
    spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = spot;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Nervure centrale et nervures secondaires.
  context.strokeStyle = style.vein;
  context.lineWidth = size * 0.012;
  context.beginPath();
  context.moveTo(0, length / 2);
  context.lineTo(0, -length / 2);
  context.stroke();

  context.lineWidth = size * 0.006;
  for (let i = 1; i <= 6; i++) {
    const t = i / 7.5;
    const y = length / 2 - t * length;
    const reach = style.profile(t) * halfWidth * 0.9;
    for (const side of [1, -1]) {
      context.beginPath();
      context.moveTo(0, y);
      context.quadraticCurveTo(side * reach * 0.5, y - size * 0.02, side * reach, y - size * 0.09);
      context.stroke();
    }
  }

  // Assombrissement léger du bord.
  context.strokeStyle = 'rgba(60, 30, 15, 0.25)';
  context.lineWidth = size * 0.03;
  context.stroke(outline);
  context.restore();
}

/** Dessine l'atlas et le renvoie sous forme de canvas (taille en pixels d'une cellule). */
export function createLeafAtlas(cellSize = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = cellSize * ATLAS_COLUMNS;
  canvas.height = cellSize * ATLAS_ROWS;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponible.');

  LEAF_STYLES.forEach((style, index) => {
    const column = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    context.save();
    context.translate((column + 0.5) * cellSize, (row + 0.5) * cellSize);
    drawLeaf(context, style, cellSize, index + 1);
    context.restore();
  });

  return canvas;
}
