import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends signup details to the configured REST endpoint', () => {
    const details = { name: 'Marine', email: 'marine@example.fr', password: 'motdepasse123' };

    service.signup(details).subscribe((response) => {
      expect(response.message).toBe('Compte créé');
    });

    const request = httpTesting.expectOne(`${environment.apiUrl}/auth/signup`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(details);
    request.flush({ message: 'Compte créé' });
  });
});