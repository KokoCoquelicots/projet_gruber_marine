import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { User } from '../models/user';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const currentUser = signal<User | null>(null);

  beforeEach(() => {
    currentUser.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser } }
      ]
    });
  });

  it('redirects anonymous visitors to login with the requested URL', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/pollutions/new' } as RouterStateSnapshot)
    );

    expect(result).toBeInstanceOf(UrlTree);
    if (result instanceof UrlTree) {
      expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fpollutions%2Fnew');
    }
  });

  it('allows authenticated visitors', () => {
    currentUser.set({
      id: 'user-123',
      name: 'Marine',
      email: 'marine@example.com',
      createdAt: '2026-10-15T12:00:00.000Z'
    });

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/users' } as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });
});
