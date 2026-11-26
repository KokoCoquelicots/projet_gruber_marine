import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';
import { PollutionLevel, resolvePollutionLevel } from '../pipes/pollution-level.pipe';

export interface PollutionHighlightStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
}

export const POLLUTION_LEVEL_STYLES: Record<PollutionLevel, PollutionHighlightStyle> = {
  // Vert clair si pollution Faible (0–20)
  Faible: {
    backgroundColor: '#dcfce7',
    color: '#1b4d38',
    borderColor: '#a7e8bd'
  },
  // Jaune si pollution Modérée (21–50)
  Modérée: {
    backgroundColor: '#fef9c3',
    color: '#6b5314',
    borderColor: '#f3dc86'
  },
  // Orange si pollution Élevée (51–100)
  Élevée: {
    backgroundColor: '#ffedd5',
    color: '#8a3c16',
    borderColor: '#f7bf8a'
  },
  // Rouge si pollution Dangereuse (101+)
  Dangereuse: {
    backgroundColor: '#fee2e2',
    color: '#881d1d',
    borderColor: '#f5a8a8'
  }
};

function normalizeToLevel(value: PollutionLevel | number | string | null | undefined): PollutionLevel {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLocaleLowerCase('fr');
    if (trimmed === 'faible') return 'Faible';
    if (trimmed === 'modérée' || trimmed === 'moderee') return 'Modérée';
    if (trimmed === 'élevée' || trimmed === 'elevee') return 'Élevée';
    if (trimmed === 'dangereuse') return 'Dangereuse';
  }
  return resolvePollutionLevel(value);
}

/**
 * Directive personnalisée modifiant la couleur de fond d'un élément selon le niveau de pollution :
 * - Vert clair si Faible (0–20)
 * - Jaune si Modérée (21–50)
 * - Orange si Élevée (51–100)
 * - Rouge si Dangereuse (101+)
 */
@Directive({
  selector: '[appHighlightPollution], [highlightPollution]'
})
export class HighlightPollutionDirective {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  readonly appHighlightPollution = input<PollutionLevel | number | string | null | undefined>(undefined);
  readonly highlightPollution = input<PollutionLevel | number | string | null | undefined>(undefined);

  constructor() {
    effect(() => {
      const rawValue = this.appHighlightPollution() !== undefined
        ? this.appHighlightPollution()
        : this.highlightPollution();
      const level = normalizeToLevel(rawValue);
      const style = POLLUTION_LEVEL_STYLES[level];
      const host = this.elementRef.nativeElement;

      this.renderer.setStyle(host, 'backgroundColor', style.backgroundColor);
      this.renderer.setStyle(host, 'color', style.color);
      this.renderer.setStyle(host, 'borderColor', style.borderColor);
      this.renderer.setAttribute(host, 'data-pollution-level', level);
    });
  }
}
