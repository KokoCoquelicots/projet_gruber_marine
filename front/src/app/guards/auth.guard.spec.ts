import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideStore, Store } from '@ngxs/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { Login } from '../store/auth.actions';
import { AuthState } from '../store/auth.state';
import { authGuard } from './auth.guard';

describe('authGuard (NGXS)', () => {
  let store: Store;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideStore([AuthState])]
    });
    store = TestBed.inject(Store);
  });

  it('redirects unauthenticated visitors to /login with returnUrl', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/pollutions/new' } as RouterStateSnapshot)
    );

    expect(result).toBeInstanceOf(UrlTree);
    if (result instanceof UrlTree) {
      expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fpollutions%2Fnew');
    }
  });

  it('allows navigation when AuthState.isAuthenticated is true', () => {
    store.dispatch(new Login({ email: 'marine@example.com', nom: 'Marine' }));

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/users' } as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });
});
