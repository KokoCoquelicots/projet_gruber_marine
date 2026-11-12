import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FallingLeaves } from './components/falling-leaves/falling-leaves';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [FallingLeaves, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="site-shell">
      <div class="nature-backdrop" aria-hidden="true">
        <div class="sun-halo"></div>
      </div>
      <app-falling-leaves />

      <header class="topbar-shell" [class.topbar-scrolled]="scrolled()">
        <div class="topbar">
          <a class="brand" routerLink="/" aria-label="Vigie, accueil">
            <span class="brand-mark" aria-hidden="true"><span></span></span>
            <span class="brand-text">VIGIE<span class="brand-period">.</span></span>
            <span class="brand-tag">Observatoire</span>
          </a>

          <nav class="topbar-nav" aria-label="Navigation principale">
            <a
              class="topbar-note"
              routerLink="/"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              <span class="status-dot" aria-hidden="true"></span>
              <span>Signalements</span>
            </a>
            <a
              class="topbar-note"
              routerLink="/users"
              routerLinkActive="is-active"
            >
              <span>Communauté</span>
            </a>
          </nav>

          <div class="topbar-actions">
            @if (auth.currentUser(); as user) {
              <div class="user-chip" title="{{ user.email }}">
                <span class="user-avatar" aria-hidden="true">{{ user.name.slice(0, 1).toUpperCase() }}</span>
                <span class="signed-in">Bonjour, <strong>{{ user.name }}</strong></span>
              </div>
              <button class="topbar-ghost-btn" type="button" (click)="auth.logout()">
                Déconnexion
              </button>
            } @else {
              <a
                class="topbar-ghost-btn"
                routerLink="/login"
                routerLinkActive="is-active"
              >
                Connexion
              </a>
            }
            <a class="primary-button topbar-cta" routerLink="/pollutions/new">
              <span>+ Signaler</span>
              <span class="button-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </header>

      <router-outlet />

      <footer class="page-footer">
        <span>VIGIE <span class="brand-period">.</span></span>
        <span>Observer, signaler, préserver.</span>
      </footer>
    </div>
  `
})
export class App {
  readonly auth = inject(AuthService);
  readonly scrolled = signal(false);

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled.set(window.scrollY > 24);
  }
}
