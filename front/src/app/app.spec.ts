import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore, Store } from '@ngxs/store';
import { App } from './app';
import { Login, Logout } from './store/auth.actions';
import { AuthState } from './store/auth.state';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideRouter([]), provideStore([AuthState])],
    }).compileComponents();
  });

  it('shows the glassmorphism header, navigation pill, CTA and outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.brand')).not.toBeNull();
    expect(element.querySelector('.topbar-nav')).not.toBeNull();
    expect(element.querySelector('.topbar-cta')).not.toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
  });

  it('displays the authenticated username from NGXS Store and dispatches Logout', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);
    store.dispatch(new Login({ email: 'marine@vigie.fr', nom: 'Marine' }));
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.signed-in')?.textContent).toContain('Marine');

    fixture.componentInstance.logout();
    fixture.detectChanges();
    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);

    store.dispatch(new Logout());
  });

  it('toggles the compact scrolled state on window scroll', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance.scrolled()).toBe(false);
    Object.defineProperty(window, 'scrollY', { value: 60, configurable: true });
    fixture.componentInstance.onWindowScroll();
    fixture.detectChanges();

    expect(fixture.componentInstance.scrolled()).toBe(true);
    expect(fixture.nativeElement.querySelector('.topbar-shell.topbar-scrolled')).not.toBeNull();
  });
});
