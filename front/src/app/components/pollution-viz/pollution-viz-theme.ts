import { PollutionType } from '../../models/pollution-declaration';

export interface PollutionVisualTheme {
  label: string;
  subtitle: string;
  primaryHex: string;
  accentHex: string;
  primaryRgb: [number, number, number];
  accentRgb: [number, number, number];
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function theme(
  label: string,
  subtitle: string,
  primaryHex: string,
  accentHex: string
): PollutionVisualTheme {
  return {
    label,
    subtitle,
    primaryHex,
    accentHex,
    primaryRgb: hexToRgbNormalized(primaryHex),
    accentRgb: hexToRgbNormalized(accentHex)
  };
}

export const DEFAULT_POLLUTION_THEME: PollutionVisualTheme = theme(
  'Observation générale',
  'En attente de classification',
  '#2d6a4f',
  '#95d5b2'
);

export const POLLUTION_THEMES: Record<PollutionType, PollutionVisualTheme> = {
  Plastique: theme(
    'Fragments polymères',
    'Pollution macro et micro-plastique',
    '#d96b43',
    '#ffb685'
  ),
  Chimique: theme(
    'Réaction chimique',
    'Rejet ou substance toxique',
    '#7fb800',
    '#e4ff8a'
  ),
  'Dépôt sauvage': theme(
    'Dépôt illicite',
    'Encombrants et déchets abandonnés',
    '#c97b3d',
    '#ffd29d'
  ),
  Eau: theme(
    'Milieu aquatique',
    'Cours d’eau, nappe ou littoral',
    '#1ca3b8',
    '#90f1ff'
  ),
  Air: theme(
    'Qualité de l’air',
    'Émission, fumée ou particules fines',
    '#4ea8de',
    '#d4f1ff'
  ),
  Autre: theme(
    'Signalement environnemental',
    'Observation de terrain',
    '#40916c',
    '#b7e4c7'
  )
};

export function getPollutionTheme(type: PollutionType | '' | null | undefined): PollutionVisualTheme {
  return type && type in POLLUTION_THEMES ? POLLUTION_THEMES[type] : DEFAULT_POLLUTION_THEME;
}

/**
 * Convertit une latitude (-90..90) et une longitude (-180..180)
 * en coordonnées cartésiennes 3D alignées avec les UV d'une THREE.SphereGeometry.
 */
export function latLngToCartesian(
  latitude: number,
  longitude: number,
  radius: number
): [x: number, y: number, z: number] {
  const lat = Math.max(-90, Math.min(90, Number(latitude)));
  const lon = Math.max(-180, Math.min(180, Number(longitude)));
  const theta = ((90 - lat) * Math.PI) / 180;
  const phi = ((lon + 180) * Math.PI) / 180;
  const sinTheta = Math.sin(theta);

  return [
    -radius * sinTheta * Math.cos(phi),
    radius * Math.cos(theta),
    radius * sinTheta * Math.sin(phi)
  ];
}

/**
 * Convertit un point 3D à la surface de la sphère en (latitude, longitude).
 * Réciproque exacte de latLngToCartesian.
 */
export function cartesianToLatLng(
  x: number,
  y: number,
  z: number
): { latitude: number; longitude: number } {
  const radius = Math.hypot(x, y, z) || 1;
  const latitude = Math.asin(Math.max(-1, Math.min(1, y / radius))) * (180 / Math.PI);
  let phi = Math.atan2(z, -x);
  if (phi < 0) phi += Math.PI * 2;
  const longitude = phi * (180 / Math.PI) - 180;

  return {
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4))
  };
}

/** Formate un couple latitude / longitude en notation lisible (ex. 47.22° N, 1.55° O). */
export function formatCoordinates(latitude: number | null | undefined, longitude: number | null | undefined): string {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return 'Coordonnées GPS en attente';
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return 'Coordonnées GPS en attente';
  }
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

export interface PlaceCoordinate {
  name: string;
  latitude: number;
  longitude: number;
}

const KNOWN_PLACES: readonly PlaceCoordinate[] = [
  { name: 'Paris', latitude: 48.8566, longitude: 2.3522 },
  { name: 'Marseille', latitude: 43.2965, longitude: 5.3698 },
  { name: 'Lyon', latitude: 45.764, longitude: 4.8357 },
  { name: 'Toulouse', latitude: 43.6047, longitude: 1.4442 },
  { name: 'Nice', latitude: 43.7102, longitude: 7.262 },
  { name: 'Nantes', latitude: 47.2184, longitude: -1.5536 },
  { name: 'Montpellier', latitude: 43.6108, longitude: 3.8767 },
  { name: 'Strasbourg', latitude: 48.5734, longitude: 7.7521 },
  { name: 'Bordeaux', latitude: 44.8378, longitude: -0.5792 },
  { name: 'Lille', latitude: 50.6292, longitude: 3.0573 },
  { name: 'Rennes', latitude: 48.1173, longitude: -1.6778 },
  { name: 'Reims', latitude: 49.2583, longitude: 4.0317 },
  { name: 'Toulon', latitude: 43.1242, longitude: 5.928 },
  { name: 'Saint-Étienne', latitude: 45.4397, longitude: 4.3872 },
  { name: 'Le Havre', latitude: 49.4944, longitude: 0.1079 },
  { name: 'Grenoble', latitude: 45.1885, longitude: 5.7245 },
  { name: 'Dijon', latitude: 47.322, longitude: 5.0415 },
  { name: 'Angers', latitude: 47.4784, longitude: -0.5632 },
  { name: 'Nîmes', latitude: 43.8367, longitude: 4.3601 },
  { name: 'Villeurbanne', latitude: 45.7719, longitude: 4.8902 },
  { name: 'Clermont-Ferrand', latitude: 45.7772, longitude: 3.087 },
  { name: 'Le Mans', latitude: 48.0061, longitude: 0.1996 },
  { name: 'Aix-en-Provence', latitude: 43.5297, longitude: 5.4474 },
  { name: 'Brest', latitude: 48.3904, longitude: -4.4861 },
  { name: 'Tours', latitude: 47.3941, longitude: 0.6848 },
  { name: 'Amiens', latitude: 49.8941, longitude: 2.2958 },
  { name: 'Limoges', latitude: 45.8336, longitude: 1.2611 },
  { name: 'Annecy', latitude: 45.8992, longitude: 6.1294 },
  { name: 'Perpignan', latitude: 42.6887, longitude: 2.8948 },
  { name: 'Metz', latitude: 49.1193, longitude: 6.1757 },
  { name: 'Besançon', latitude: 47.2378, longitude: 6.0241 },
  { name: 'Orléans', latitude: 47.9029, longitude: 1.9093 },
  { name: 'Rouen', latitude: 49.4432, longitude: 1.0999 },
  { name: 'Mulhouse', latitude: 47.7508, longitude: 7.3359 },
  { name: 'Caen', latitude: 49.1829, longitude: -0.3707 },
  { name: 'Nancy', latitude: 48.6921, longitude: 6.1844 },
  { name: 'Avignon', latitude: 43.9493, longitude: 4.8055 },
  { name: 'Poitiers', latitude: 46.5802, longitude: 0.3404 },
  { name: 'La Rochelle', latitude: 46.1603, longitude: -1.1511 },
  { name: 'Calais', latitude: 50.9513, longitude: 1.8587 },
  { name: 'Cannes', latitude: 43.5528, longitude: 7.0174 },
  { name: 'Colmar', latitude: 48.0794, longitude: 7.3585 },
  { name: 'Lorient', latitude: 47.7483, longitude: -3.3702 },
  { name: 'Saint-Nazaire', latitude: 47.2735, longitude: -2.2138 },
  { name: 'Valence', latitude: 44.9334, longitude: 4.8924 },
  { name: 'Chambéry', latitude: 45.5646, longitude: 5.9178 },
  { name: 'Vannes', latitude: 47.6582, longitude: -2.7608 },
  { name: 'Bayonne', latitude: 43.4929, longitude: -1.4748 },
  { name: 'Pau', latitude: 43.2951, longitude: -0.3708 },
  { name: 'Quimper', latitude: 47.996, longitude: -4.0979 },
  { name: 'Troyes', latitude: 48.2973, longitude: 4.0744 },
  { name: 'Cherbourg', latitude: 49.6337, longitude: -1.6221 },
  { name: 'Biarritz', latitude: 43.4832, longitude: -1.5586 },
  { name: 'Ajaccio', latitude: 41.9192, longitude: 8.7386 },
  { name: 'Bastia', latitude: 42.6973, longitude: 9.4509 },
  { name: 'Chartres', latitude: 48.4439, longitude: 1.489 },
  { name: 'Bourges', latitude: 47.081, longitude: 2.3988 },
  { name: 'Arras', latitude: 50.291, longitude: 2.7775 },
  { name: 'Saint-Malo', latitude: 48.6493, longitude: -2.0257 },
  { name: 'Albi', latitude: 43.9298, longitude: 2.148 },
  { name: 'Carcassonne', latitude: 43.213, longitude: 2.3491 },
  { name: 'Béziers', latitude: 43.3442, longitude: 3.2158 },
  { name: 'Sète', latitude: 43.4079, longitude: 3.6966 },
  { name: 'Narbonne', latitude: 43.1843, longitude: 3.0031 },
  { name: 'Blois', latitude: 47.5861, longitude: 1.3359 },
  { name: 'Auxerre', latitude: 47.7982, longitude: 3.5738 },
  { name: 'Mâcon', latitude: 46.3069, longitude: 4.8287 },
  { name: 'Épinal', latitude: 48.1724, longitude: 6.4494 },
  { name: 'Belfort', latitude: 47.6397, longitude: 6.8638 },
  { name: 'Haguenau', latitude: 48.8156, longitude: 7.7906 },
  { name: 'Sélestat', latitude: 48.2594, longitude: 7.4542 },
  { name: 'Londres', latitude: 51.5074, longitude: -0.1278 },
  { name: 'Bruxelles', latitude: 50.8503, longitude: 4.3517 },
  { name: 'Genève', latitude: 46.2044, longitude: 6.1432 },
  { name: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
  { name: 'Rome', latitude: 41.9028, longitude: 12.4964 },
  { name: 'Berlin', latitude: 52.52, longitude: 13.405 },
  { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { name: 'New York', latitude: 40.7128, longitude: -74.006 },
  { name: 'Montréal', latitude: 45.5017, longitude: -73.5673 }
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-'’,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recherche instantanément une ville connue dans le texte saisi (sans appel réseau).
 */
export function findKnownPlace(query: string): PlaceCoordinate | null {
  const normalized = normalizeText(query);
  if (normalized.length < 3) return null;

  // 1. Correspondance exacte du nom de ville
  for (const place of KNOWN_PLACES) {
    if (normalizeText(place.name) === normalized) {
      return place;
    }
  }

  // 2. Correspondance par mot entier dans une adresse (ex. "Quai de la Loire, Nantes")
  const padded = ` ${normalized} `;
  for (const place of KNOWN_PLACES) {
    const target = ` ${normalizeText(place.name)} `;
    if (padded.includes(target)) {
      return place;
    }
  }

  return null;
}

/**
 * Recherche les coordonnées GPS d'un lieu à partir de son nom
 * (dictionnaire local instantané + API ouverte Nominatim OpenStreetMap sans clé).
 */
export async function geocodeLocation(
  query: string
): Promise<{ latitude: number; longitude: number; displayName?: string } | null> {
  const known = findKnownPlace(query);
  if (known) {
    return { latitude: known.latitude, longitude: known.longitude };
  }

  const trimmed = query.trim();
  if (trimmed.length < 3) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    if (!results.length) return null;
    const latitude = Number.parseFloat(results[0].lat);
    const longitude = Number.parseFloat(results[0].lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude: Number(latitude.toFixed(4)),
      longitude: Number(longitude.toFixed(4)),
      displayName: results[0].display_name
    };
  } catch {
    return null;
  }
}
