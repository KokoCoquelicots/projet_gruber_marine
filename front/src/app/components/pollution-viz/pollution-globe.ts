import { DatePipe, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HighlightPollutionDirective } from '../../directives/highlight-pollution.directive';
import { Pollution } from '../../models/pollution-declaration';
import { getPollutionDangerIndex, PollutionLevelPipe } from '../../pipes/pollution-level.pipe';
import { canAnimateLeaves } from '../falling-leaves/falling-leaves';
import type { GlobeScene, GlobeViewMode } from './globe-scene';
import { formatCoordinates, getPollutionTheme } from './pollution-viz-theme';

registerLocaleData(localeFr);

/**
 * Globe Terrestre 3D réaliste et interactif sans cadre :
 * - Passage automatique en vue satellite HD dès que l'utilisateur zoome sur une région.
 * - Zoom logarithmique ultra-précis (molette, boutons +/- ou bouton Précis) et bascule Sat manuelle.
 * - Chaque déclaration de la base de données est représentée par un trait lumineux à ses coordonnées GPS.
 */
@Component({
  selector: 'app-pollution-globe',
  imports: [DatePipe, HighlightPollutionDirective, PollutionLevelPipe, RouterLink],
  template: `
    <div class="globe-shell">
      <div class="globe-top-meta">
        <span class="globe-badge">
          <span class="globe-dot" [style.background]="activePrimary()"></span>
          {{ isSatellite() ? 'VUE SATELLITE HD' : 'GLOBE TERRESTRE 3D' }} · ×{{ zoomFactor() }}
        </span>
        <span class="globe-count">{{ pollutions().length }} signalement(s)</span>
      </div>

      <div class="globe-row">
        <div class="globe-stage">
          <canvas #canvas aria-label="Globe terrestre 3D interactif des pollutions"></canvas>
        </div>

        <div class="globe-side-controls" aria-label="Contrôles du globe">
          <button
            class="globe-ctrl-btn"
            type="button"
            (click)="zoomIn()"
            title="Zoomer avec précision sur le globe"
            aria-label="Zoomer"
          >+</button>
          <button
            class="globe-ctrl-btn"
            type="button"
            (click)="zoomOut()"
            title="Dézoomer"
            aria-label="Dézoomer"
          >−</button>
          <button
            class="globe-ctrl-btn globe-ctrl-text"
            type="button"
            [class.is-active]="isSatellite() || viewMode() === 'satellite'"
            (click)="toggleSatelliteView()"
            title="Basculer entre la vue satellite et la carte"
            aria-label="Vue satellite"
          >
            Sat
          </button>
          @if (activeItem()) {
            <button
              class="globe-ctrl-btn globe-ctrl-text"
              type="button"
              (click)="focusPrecise()"
              title="Zoomer en haute précision sur le signalement actif"
              aria-label="Zoom précis"
            >
              Précis
            </button>
          }
          @if (pollutions().length > 1) {
            <button
              class="globe-ctrl-btn"
              type="button"
              (click)="cyclePollution(-1)"
              title="Signalement précédent"
              aria-label="Signalement précédent"
            >‹</button>
            <button
              class="globe-ctrl-btn"
              type="button"
              (click)="cyclePollution(1)"
              title="Signalement suivant"
              aria-label="Signalement suivant"
            >›</button>
          }
          <button
            class="globe-ctrl-btn globe-ctrl-text"
            type="button"
            (click)="toggleOverview()"
            title="Basculer entre le point sélectionné et la vue globale"
          >
            {{ isOverview() ? 'Centrer' : 'Global' }}
          </button>
        </div>
      </div>

      <p class="globe-caption">
        @if (pickable()) {
          Zoomez pour passer en vue satellite · Cliquez sur le globe pour placer le point
        } @else if (pollutions().length > 0) {
          Molette ou +/- pour zoomer en vue satellite · Cliquez sur un trait pour le détail
        }
      </p>

      <div class="globe-footer">
        @if (activeItem(); as item) {
          <div class="globe-detail-card">
            <div class="globe-detail-top">
              <div class="globe-detail-badges">
                <span class="globe-detail-type">{{ item.type }}</span>
                <span class="globe-danger-badge" [appHighlightPollution]="activeDangerIndex()">
                  Indice {{ activeDangerIndex() }} · {{ activeDangerIndex() | pollutionLevel }}
                </span>
              </div>
              <span class="globe-target-coords">{{ activeCoords() }}</span>
            </div>

            <strong class="globe-target-title">{{ item.title }}</strong>

            <p class="globe-detail-meta">
              <span>{{ item.location }}</span>
              @if (item.observedAt) {
                <span aria-hidden="true">·</span>
                <span>{{ item.observedAt | date:'d MMM y':'':'fr' }}</span>
              }
            </p>

            @if (item.description && showDetailCard()) {
              <p class="globe-detail-desc">{{ item.description }}</p>
            }

            @if (showDetailLink() && item.id !== 'draft-preview') {
              <div class="globe-detail-actions">
                <a class="text-button" [routerLink]="['/pollutions', item.id]">
                  Consulter la fiche <span aria-hidden="true">→</span>
                </a>
              </div>
            }
          </div>
        } @else {
          <p class="globe-hint">
            {{ pickable() ? 'Saisissez une ville dans le formulaire ou cliquez sur le globe.' : 'Aucun signalement à afficher sur le globe.' }}
          </p>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .globe-shell {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .globe-top-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #365347;
    }

    .globe-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }

    .globe-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #39775f;
    }

    .globe-count {
      padding: 3px 9px;
      border-radius: 999px;
      background: rgba(57, 119, 95, 0.1);
      color: #2f5747;
      font-size: 10px;
      letter-spacing: 0.02em;
    }

    .globe-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .globe-stage {
      position: relative;
      flex: 1 1 auto;
      width: 100%;
      aspect-ratio: 1 / 1;
      max-width: 420px;
      margin-inline: auto;
      background: transparent;
      cursor: grab;
    }

    .globe-stage:active {
      cursor: grabbing;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    .globe-side-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .globe-ctrl-btn {
      min-width: 38px;
      height: 32px;
      padding: 0 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #cdd9ce;
      border-radius: 8px;
      background: rgba(255, 255, 252, 0.85);
      color: #244438;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
    }

    .globe-ctrl-btn.globe-ctrl-text {
      font-size: 9px;
      font-weight: 700;
      padding: 0 8px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .globe-ctrl-btn:hover {
      background: #ffffff;
      border-color: #39775f;
      color: #173b34;
      transform: translateY(-1px);
    }

    .globe-ctrl-btn.is-active {
      background: #234d3e;
      border-color: #234d3e;
      color: #ffffff;
    }

    .globe-caption {
      margin: 0;
      color: #63756b;
      font-size: 10px;
      text-align: center;
    }

    .globe-footer {
      padding-top: 6px;
    }

    .globe-detail-card {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 252, 0.72);
      border: 1px solid rgba(210, 222, 212, 0.85);
    }

    .globe-detail-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .globe-detail-badges {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .globe-detail-type,
    .globe-danger-badge {
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid transparent;
      background: #eaf1e8;
      color: #2c5443;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .globe-target-title {
      color: #1c3a31;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.3;
    }

    .globe-detail-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin: 0;
      color: #65756c;
      font-size: 10px;
    }

    .globe-detail-desc {
      display: -webkit-box;
      margin: 2px 0 0;
      overflow: hidden;
      color: #55665d;
      font-size: 11px;
      line-height: 1.5;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .globe-detail-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 2px;
    }

    .globe-target-coords {
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
      font-size: 10px;
      color: #5b6e64;
    }

    .globe-hint {
      margin: 0;
      color: #6b7a72;
      font-size: 11px;
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PollutionGlobe {
  readonly pollutions = input<readonly Pollution[]>([]);
  readonly focusedId = input<string | null>(null);
  readonly pickable = input(false);
  readonly showDetailCard = input(true);
  readonly showDetailLink = input(true);

  readonly pollutionSelected = output<string>();
  readonly coordinatesPicked = output<{ latitude: number; longitude: number }>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private scene: GlobeScene | null = null;

  readonly clickedId = signal<string | null>(null);
  readonly isOverview = signal(false);
  readonly isSatellite = signal(false);
  readonly viewMode = signal<GlobeViewMode>('auto');
  readonly zoomFactor = signal(1);

  readonly effectiveSelectedId = computed(() => {
    const list = this.pollutions();
    const externalId = this.focusedId();
    if (externalId && list.some((item) => String(item.id) === String(externalId))) {
      return String(externalId);
    }
    const internalId = this.clickedId();
    if (internalId && list.some((item) => String(item.id) === String(internalId))) {
      return String(internalId);
    }
    return list[0] ? String(list[0].id) : null;
  });

  readonly activeItem = computed(() => {
    const list = this.pollutions();
    const id = this.effectiveSelectedId();
    return list.find((item) => String(item.id) === String(id)) ?? list[0] ?? null;
  });

  readonly activeTheme = computed(() => getPollutionTheme(this.activeItem()?.type));
  readonly activePrimary = computed(() => this.activeTheme().primaryHex);
  readonly activeDangerIndex = computed(() => getPollutionDangerIndex(this.activeItem()));
  readonly activeCoords = computed(() => {
    const item = this.activeItem();
    return item ? formatCoordinates(item.latitude, item.longitude) : '';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const list = this.pollutions();
      const selectedId = this.effectiveSelectedId();
      this.isOverview.set(false);
      this.scene?.setPollutions(list, selectedId, true);
    });

    afterNextRender(() => {
      if (!canAnimateLeaves(window)) return;

      let destroyed = false;
      void import('./globe-scene')
        .then(({ GlobeScene: SceneClass }) => {
          if (destroyed) return;
          this.scene = new SceneClass(this.canvas().nativeElement, {
            onSelectPollution: (id) => {
              this.clickedId.set(id);
              this.isOverview.set(false);
              this.pollutionSelected.emit(id);
            },
            onPickCoordinates: this.pickable()
              ? (coords) => {
                  this.coordinatesPicked.emit(coords);
                }
              : undefined,
            onViewStateChange: (state) => {
              this.isSatellite.set(state.isSatellite);
              this.zoomFactor.set(state.zoomLevel);
              this.viewMode.set(state.mode);
            }
          });
          this.scene.setPollutions(this.pollutions(), this.effectiveSelectedId(), true);
        })
        .catch((error) => {
          console.warn('Globe 3D désactivé :', error);
        });

      destroyRef.onDestroy(() => {
        destroyed = true;
        this.scene?.dispose();
        this.scene = null;
      });
    });
  }

  cyclePollution(step: 1 | -1): void {
    const list = this.pollutions();
    if (list.length === 0) return;
    const currentId = this.effectiveSelectedId();
    const index = list.findIndex((item) => String(item.id) === String(currentId));
    const nextIndex = (index + step + list.length) % list.length;
    const nextId = String(list[nextIndex].id);
    this.clickedId.set(nextId);
    this.isOverview.set(false);
    this.pollutionSelected.emit(nextId);
  }

  zoomIn(): void {
    this.isOverview.set(false);
    this.scene?.zoomBy(-1);
  }

  zoomOut(): void {
    this.scene?.zoomBy(1);
  }

  toggleSatelliteView(): void {
    if (this.scene) {
      const nextMode = this.scene.toggleSatellite();
      this.viewMode.set(nextMode);
      if (nextMode === 'satellite') {
        this.isSatellite.set(true);
      } else if (nextMode === 'map') {
        this.isSatellite.set(false);
      }
      return;
    }

    // Mode sans WebGL (tests unitaires)
    const nextSat = !this.isSatellite();
    this.isSatellite.set(nextSat);
    this.viewMode.set(nextSat ? 'satellite' : 'map');
  }

  focusPrecise(): void {
    const item = this.activeItem();
    if (!item || !this.scene) return;
    this.isOverview.set(false);
    this.scene.focusSatellitePrecision(item.latitude, item.longitude);
  }

  toggleOverview(): void {
    if (!this.scene) return;
    const item = this.activeItem();
    if (this.isOverview() && item) {
      this.isOverview.set(false);
      this.scene.focusCoordinates(item.latitude, item.longitude, true);
    } else {
      this.isOverview.set(true);
      this.scene.resetOverview();
    }
  }
}
