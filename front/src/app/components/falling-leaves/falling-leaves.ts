import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';

/** Les animations décoratives sont désactivées si l'utilisateur préfère réduire les mouvements. */
export function canAnimateLeaves(view: Pick<Window, 'matchMedia'> | null | undefined): boolean {
  return typeof view?.matchMedia === 'function' && !view.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Exécute une tâche quand le navigateur est inactif, pour ne pas retarder l'affichage de la page. */
function whenIdle(task: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(task, { timeout: 2000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = setTimeout(task, 300);
  return () => clearTimeout(handle);
}

/**
 * Bandeau décoratif supérieur : feuilles d'automne en Three.js limitées
 * strictement à la zone du header jusqu'au trait sous le titre (.page-hero).
 */
@Component({
  selector: 'app-falling-leaves',
  template: '<canvas #canvas></canvas>',
  styles: `
    :host {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: var(--leaves-band-height, 232px);
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
      -webkit-mask-image: linear-gradient(180deg, #000000 0%, #000000 82%, transparent 100%);
      mask-image: linear-gradient(180deg, #000000 0%, #000000 82%, transparent 100%);
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FallingLeaves {
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      // Calibre la hauteur exacte de la zone des feuilles du haut de la page jusqu'au trait sous .page-hero
      const syncBandHeight = () => {
        const hostEl = this.hostRef.nativeElement;
        const heroEl = document.querySelector<HTMLElement>('.page-hero');
        if (heroEl) {
          const shellRect = hostEl.parentElement?.getBoundingClientRect();
          const heroRect = heroEl.getBoundingClientRect();
          const bottomPx = Math.max(150, Math.round(heroRect.bottom - (shellRect?.top ?? 0)));
          hostEl.style.setProperty('--leaves-band-height', `${bottomPx}px`);
        } else {
          hostEl.style.setProperty('--leaves-band-height', '110px');
        }
      };

      syncBandHeight();
      window.addEventListener('resize', syncBandHeight, { passive: true });
      const mutationObserver = new MutationObserver(() => syncBandHeight());
      mutationObserver.observe(document.body, { childList: true, subtree: true });

      if (!canAnimateLeaves(window)) {
        destroyRef.onDestroy(() => {
          window.removeEventListener('resize', syncBandHeight);
          mutationObserver.disconnect();
        });
        return;
      }

      let dispose: (() => void) | undefined;
      let destroyed = false;
      const cancelIdle = whenIdle(async () => {
        try {
          const { LeavesScene } = await import('./leaves-scene');
          if (destroyed) return;
          syncBandHeight();
          const scene = new LeavesScene(this.canvas().nativeElement);
          dispose = () => scene.dispose();
        } catch (error) {
          console.warn('Animation des feuilles désactivée :', error);
        }
      });

      destroyRef.onDestroy(() => {
        destroyed = true;
        window.removeEventListener('resize', syncBandHeight);
        mutationObserver.disconnect();
        cancelIdle();
        dispose?.();
      });
    });
  }
}
