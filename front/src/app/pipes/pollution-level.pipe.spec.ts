import { describe, expect, it } from 'vitest';
import { getPollutionDangerIndex, PollutionLevelPipe } from './pollution-level.pipe';

describe('PollutionLevelPipe', () => {
  const pipe = new PollutionLevelPipe();

  it('transforms danger index 0–20 into Faible', () => {
    expect(pipe.transform(0)).toBe('Faible');
    expect(pipe.transform(10)).toBe('Faible');
    expect(pipe.transform(20)).toBe('Faible');
  });

  it('transforms danger index 21–50 into Modérée', () => {
    expect(pipe.transform(21)).toBe('Modérée');
    expect(pipe.transform(35)).toBe('Modérée');
    expect(pipe.transform(50)).toBe('Modérée');
  });

  it('transforms danger index 51–100 into Élevée', () => {
    expect(pipe.transform(51)).toBe('Élevée');
    expect(pipe.transform(75)).toBe('Élevée');
    expect(pipe.transform(100)).toBe('Élevée');
  });

  it('transforms danger index 101+ into Dangereuse', () => {
    expect(pipe.transform(101)).toBe('Dangereuse');
    expect(pipe.transform(150)).toBe('Dangereuse');
  });

  it('computes a numeric danger index from a pollution record', () => {
    expect(getPollutionDangerIndex({ type: 'Autre', title: 'Petit déchet isolé' })).toBeLessThanOrEqual(20);
    expect(getPollutionDangerIndex({ type: 'Plastique', title: 'Bouteilles sur la berge' })).toBeGreaterThanOrEqual(21);
    expect(getPollutionDangerIndex({ type: 'Dépôt sauvage', title: 'Sacs sur le chemin' })).toBeGreaterThanOrEqual(51);
    expect(getPollutionDangerIndex({ type: 'Chimique', title: 'Rejet toxique dans le canal' })).toBeGreaterThanOrEqual(101);
  });
});
