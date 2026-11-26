import { TestBed } from '@angular/core/testing';
import { provideStore, Store } from '@ngxs/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { Login, Logout } from './auth.actions';
import { AuthState } from './auth.state';

describe('AuthState (NGXS)', () => {
  let store: Store;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStore([AuthState])]
    });
    store = TestBed.inject(Store);
  });

  it('starts with an anonymous default state', () => {
    expect(store.selectSnapshot(AuthState.user)).toBeNull();
    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);
    expect(store.selectSnapshot(AuthState.username)).toBeNull();
  });

  it('handles [Auth] Login and updates user, isAuthenticated and username selectors', () => {
    expect(Login.type).toBe('[Auth] Login');

    store.dispatch(new Login({ email: 'marine.gruber@vigie.fr', nom: 'Marine Gruber' }));

    const user = store.selectSnapshot(AuthState.user);
    expect(user).toEqual({
      id: 1,
      email: 'marine.gruber@vigie.fr',
      nom: 'Marine Gruber',
      role: 'Observateur'
    });
    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(true);
    expect(store.selectSnapshot(AuthState.username)).toBe('Marine Gruber');
  });

  it('handles [Auth] Logout and resets the state to initial values', () => {
    expect(Logout.type).toBe('[Auth] Logout');

    store.dispatch(new Login({ email: 'marine.gruber@vigie.fr', nom: 'Marine Gruber' }));
    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(true);

    store.dispatch(new Logout());
    expect(store.selectSnapshot(AuthState.user)).toBeNull();
    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);
    expect(store.selectSnapshot(AuthState.username)).toBeNull();
  });
});
