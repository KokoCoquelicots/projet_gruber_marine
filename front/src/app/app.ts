import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

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
        <a class="topbar-note" routerLink="/">
          <span class="status-dot"></span> Signalements
        </a>
      </header>
      <router-outlet />
      <footer class="page-footer">
        <span>VIGIE <span class="brand-period">.</span></span>
        <span>Observer, signaler, préserver.</span>
      </footer>
    </div>
  `
})
export class App {}
