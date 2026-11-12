import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { canAnimateLeaves, FallingLeaves } from './falling-leaves';
import { leafCountFor } from './leaves-scene';

describe('FallingLeaves', () => {
  const viewWithReducedMotion = (reduce: boolean) => ({
    matchMedia: (query: string) => ({ matches: reduce && query.includes('reduce') }) as MediaQueryList
  });

  it('renders a decorative canvas hidden from assistive technologies', async () => {
    const fixture = TestBed.createComponent(FallingLeaves);
    await fixture.whenStable();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('canvas')).not.toBeNull();
  });

  it('respects the reduced motion preference', () => {
    expect(canAnimateLeaves(viewWithReducedMotion(false))).toBe(true);
    expect(canAnimateLeaves(viewWithReducedMotion(true))).toBe(false);
    expect(canAnimateLeaves({} as Window)).toBe(false);
    expect(canAnimateLeaves(undefined)).toBe(false);
  });

  it('adapts the number of leaves to the screen size', () => {
    expect(leafCountFor(390, 844)).toBe(12);
    expect(leafCountFor(1366, 768)).toBe(19);
    expect(leafCountFor(3840, 2160)).toBe(36);
  });
});
