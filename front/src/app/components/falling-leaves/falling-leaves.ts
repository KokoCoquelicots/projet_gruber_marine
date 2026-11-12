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
 * Fond décoratif : feuilles d'automne en Three.js qui tombent derrière le contenu.
 * Three.js est chargé à la demande (chunk séparé) une fois la page affichée.
 */
@Component({
  selector: 'app-falling-leaves',
  template: '<canvas #canvas></canvas>',
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
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
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (!canAnimateLeaves(window)) return;

      let dispose: (() => void) | undefined;
      let destroyed = false;
      const cancelIdle = whenIdle(async () => {
        try {
          const { LeavesScene } = await import('./leaves-scene');
          if (destroyed) return;
          const scene = new LeavesScene(this.canvas().nativeElement);
          dispose = () => scene.dispose();
        } catch (error) {
          // WebGL indisponible : le site reste parfaitement utilisable, sans animation.
          console.warn('Animation des feuilles désactivée :', error);
        }
      });

      destroyRef.onDestroy(() => {
        destroyed = true;
        cancelIdle();
        dispose?.();
      });
    });
  }
}
