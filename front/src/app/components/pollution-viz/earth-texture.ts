import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldData from 'world-atlas/countries-50m.json';

interface WorldAtlasTopology extends Topology {
  objects: {
    countries: GeometryCollection;
    land: GeometryCollection;
  };
}

let cachedEarthCanvas: HTMLCanvasElement | null = null;

function projectLon(lon: number, width: number): number {
  return ((lon + 180) / 360) * width;
}

function projectLat(lat: number, height: number): number {
  return ((90 - lat) / 180) * height;
}

/**
 * Trace un anneau de polygone fermé en déroulant (unwrapping) la longitude de façon
 * continue afin d'éliminer tout trait parasite à travers l'Eurasie et l'Afrique
 * lorsqu'un continent franchit l'antiméridien (±180° en Tchoukotka, Fidji, etc.).
 */
function tracePolygonRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  width: number,
  height: number,
  closeSouthPole: boolean
): void {
  if (ring.length < 3) return;

  // Ignore l'anneau interne artificiel du pôle Sud (-89.999°)
  if (ring[0][1] < -88) return;

  const unwrapped: Array<[number, number]> = [[ring[0][0], ring[0][1]]];
  let prevLon = ring[0][0];
  let minLon = prevLon;
  let maxLon = prevLon;

  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const lat = ring[i][1];
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    unwrapped.push([lon, lat]);
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    prevLon = lon;
  }

  // Cas particulier d'un polygone circumpolaire (Antarctique qui fait le tour complet de -180° à +180°)
  if (Math.abs(prevLon - ring[0][0]) > 180) {
    const count = unwrapped.length - 1;
    if (count < 2) return;
    const firstX = projectLon(ring[0][0], width);
    const firstY = projectLat(ring[0][1], height);
    ctx.moveTo(firstX, firstY);
    for (let i = 1; i < count; i++) {
      ctx.lineTo(projectLon(unwrapped[i][0], width), projectLat(unwrapped[i][1], height));
    }
    if (closeSouthPole) {
      const lastLon = unwrapped[count - 1][0];
      const southPoleEndX = lastLon >= ring[0][0] ? width : 0;
      const southPoleStartX = lastLon >= ring[0][0] ? 0 : width;
      ctx.lineTo(southPoleEndX, height);
      ctx.lineTo(southPoleStartX, height);
      ctx.closePath();
    }
    return;
  }

  // Polygone continental ou insulaire standard : tracé continu sans aucun saut moveTo interne
  const offsets = [0];
  if (maxLon > 180) offsets.push(-width);
  if (minLon < -180) offsets.push(width);

  for (const offsetX of offsets) {
    ctx.moveTo(projectLon(unwrapped[0][0], width) + offsetX, projectLat(unwrapped[0][1], height));
    for (let i = 1; i < unwrapped.length; i++) {
      ctx.lineTo(projectLon(unwrapped[i][0], width) + offsetX, projectLat(unwrapped[i][1], height));
    }
    ctx.closePath();
  }
}

/** Trace une ligne ouverte (frontière de pays) sans fermeture de chemin. */
function traceLineString(
  ctx: CanvasRenderingContext2D,
  line: number[][],
  width: number,
  height: number
): void {
  if (line.length < 2) return;
  let prevLon = line[0][0];
  ctx.moveTo(projectLon(prevLon, width), projectLat(line[0][1], height));

  for (let i = 1; i < line.length; i++) {
    const [lon, lat] = line[i];
    const x = projectLon(lon, width);
    const y = projectLat(lat, height);
    if (Math.abs(lon - prevLon) > 170) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    prevLon = lon;
  }
}

function traceGeometry(
  ctx: CanvasRenderingContext2D,
  geometry: GeoJSON.Geometry | null | undefined,
  width: number,
  height: number,
  closeSouthPole = true
): void {
  if (!geometry) return;
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      tracePolygonRing(ctx, ring, width, height, closeSouthPole);
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        tracePolygonRing(ctx, ring, width, height, closeSouthPole);
      }
    }
  } else if (geometry.type === 'MultiLineString') {
    for (const line of geometry.coordinates) {
      traceLineString(ctx, line, width, height);
    }
  } else if (geometry.type === 'LineString') {
    traceLineString(ctx, geometry.coordinates, width, height);
  }
}

/**
 * Génère une texture équirectangulaire haute précision (4096×2048) de la Terre
 * à partir des polygones Natural Earth 1:50m (world-atlas) : océans bathymétriques,
 * continents par biomes, côtes nettes au fort zoom et frontières des pays.
 */
export function createEarthCanvas(width = 4096, height = 2048): HTMLCanvasElement {
  if (cachedEarthCanvas) return cachedEarthCanvas;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Fond océanique sobre avec nuance bathymétrique
  const oceanGradient = ctx.createLinearGradient(0, 0, 0, height);
  oceanGradient.addColorStop(0, '#0c2636');
  oceanGradient.addColorStop(0.22, '#103549');
  oceanGradient.addColorStop(0.5, '#134258');
  oceanGradient.addColorStop(0.78, '#103549');
  oceanGradient.addColorStop(1, '#0a202e');
  ctx.fillStyle = oceanGradient;
  ctx.fillRect(0, 0, width, height);

  // Grille géographique fine (tous les 15°) pour le repérage lors d'un zoom précis
  ctx.strokeStyle = 'rgba(135, 204, 212, 0.065)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let lon = -165; lon <= 165; lon += 15) {
    const x = projectLon(lon, width);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = projectLat(lat, height);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  const topology = worldData as unknown as WorldAtlasTopology;
  const landFeature = feature(topology, topology.objects.land);
  const countryBorders = mesh(topology, topology.objects.countries, (a, b) => a !== b);

  // 2. Tracé des terres émergées (continents & îles 1:50m sans artefact d'antiméridien)
  ctx.save();
  ctx.beginPath();
  for (const item of landFeature.features) {
    traceGeometry(ctx, item.geometry, width, height, true);
  }

  // Halo côtier subtil (plateau continental)
  ctx.shadowColor = 'rgba(56, 192, 176, 0.42)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#245844';
  ctx.fill();
  ctx.shadowBlur = 0;

  // Clip sur les continents pour peindre les biomes naturels
  ctx.clip();

  const biomeGradient = ctx.createLinearGradient(0, 0, 0, height);
  biomeGradient.addColorStop(0, '#d8ebe6');     // Arctique
  biomeGradient.addColorStop(0.14, '#4b7a60');  // Taïga / Nord Europe
  biomeGradient.addColorStop(0.24, '#397152');  // Europe tempérée / France
  biomeGradient.addColorStop(0.35, '#6a8654');  // Méditerranée / Subtropical
  biomeGradient.addColorStop(0.43, '#9e8a5b');  // Ceinture aride douce
  biomeGradient.addColorStop(0.5, '#2d6a47');   // Forêt équatoriale
  biomeGradient.addColorStop(0.62, '#878153');  // Savane australe
  biomeGradient.addColorStop(0.76, '#3e7053');  // Tempéré sud
  biomeGradient.addColorStop(0.9, '#d6e8e4');   // Antarctique
  biomeGradient.addColorStop(1, '#e6f2ef');
  ctx.fillStyle = biomeGradient;
  ctx.fillRect(0, 0, width, height);

  // Relief doux sur les masses continentales
  const reliefGlow = ctx.createRadialGradient(
    width * 0.52,
    height * 0.28,
    60,
    width * 0.52,
    height * 0.35,
    width * 0.45
  );
  reliefGlow.addColorStop(0, 'rgba(182, 232, 175, 0.2)');
  reliefGlow.addColorStop(1, 'rgba(20, 50, 38, 0.12)');
  ctx.fillStyle = reliefGlow;
  ctx.fillRect(0, 0, width, height);

  // 3. Frontières des pays à l'intérieur des continents
  ctx.beginPath();
  traceGeometry(ctx, countryBorders, width, height, false);
  ctx.strokeStyle = 'rgba(225, 246, 230, 0.34)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.restore();

  // 4. Trait de côte net et précis
  ctx.beginPath();
  for (const item of landFeature.features) {
    traceGeometry(ctx, item.geometry, width, height, false);
  }
  ctx.strokeStyle = 'rgba(154, 228, 194, 0.76)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  cachedEarthCanvas = canvas;
  return canvas;
}
