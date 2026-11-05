import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="site-shell">
      <header class="topbar">
        <a class="brand" routerLink="/" aria-label="Vigie, accueil">
          <span class="brand-mark" aria-hidden="true"><span></span></span>
          <span>VIGIE<span class="brand-period">.</span></span>
        </a>
        <nav class="topbar-actions" aria-label="Navigation principale">
          <a class="topbar-note" routerLink="/">
            <span class="status-dot"></span> Signalements
          </a>
          <a class="topbar-note" routerLink="/users">Utilisateurs</a>
          @if (auth.currentUser(); as user) {
            <span class="signed-in">Bonjour, {{ user.name }}</span>
            <button class="text-button" type="button" (click)="auth.logout()">Déconnexion</button>
          } @else {
            <a class="topbar-note" routerLink="/login">Connexion</a>
          }
        </nav>
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
}
