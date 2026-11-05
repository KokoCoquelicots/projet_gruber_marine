import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { User, UserCredentials, UserRegistration } from '../models/user';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let http: HttpTestingController;
  const registration: UserRegistration = {
    name: 'Marine',
    email: 'marine@example.com',
    password: 'motdepasse123'
  };
  const credentials: UserCredentials = {
    email: registration.email,
    password: registration.password
  };
  const user: User = {
    id: 'user-123',
    name: registration.name,
    email: registration.email,
    createdAt: '2026-10-15T12:00:00.000Z'
  };
  const endpoint = `${environment.apiUrl}/users`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UserService, AuthService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and creates users through the API', () => {
    service.getAll().subscribe((users) => expect(users).toEqual([user]));
    http.expectOne(endpoint).flush([user]);

    service.create(registration).subscribe((result) => expect(result).toEqual(user));
    const create = http.expectOne(endpoint);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(registration);
    create.flush(user);
  });

  it('authenticates and deletes users through the API', () => {
    const auth = TestBed.inject(AuthService);
    auth.login(credentials).subscribe((result) => expect(result).toEqual(user));
    const login = http.expectOne(`${endpoint}/authenticate`);
    expect(login.request.method).toBe('POST');
    login.flush(user);
    expect(auth.currentUser()).toEqual(user);

    service.delete(user.id).subscribe();
    const remove = http.expectOne(`${endpoint}/${user.id}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    auth.logout();
    expect(auth.currentUser()).toBeNull();
  });
});
