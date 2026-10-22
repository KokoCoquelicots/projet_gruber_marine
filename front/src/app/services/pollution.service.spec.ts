import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { Pollution, PollutionDeclaration } from '../models/pollution-declaration';
import { PollutionService } from './pollution.service';

describe('PollutionService', () => {
  let service: PollutionService;
  let http: HttpTestingController;
  const declaration: PollutionDeclaration = {
    title: 'Déchets près de la rivière',
    type: 'Plastique',
    description: 'Plusieurs bouteilles sur la berge.',
    observedAt: '2026-10-05',
    location: 'Nantes',
    latitude: 47.2184,
    longitude: -1.5536,
    photoUrl: ''
  };
  const pollution: Pollution = { ...declaration, id: 'abc-123', createdAt: '2026-10-05T12:00:00.000Z' };
  const endpoint = `${environment.apiUrl}/pollutions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PollutionService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PollutionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the list and a pollution detail', () => {
    service.getAll().subscribe((pollutions) => expect(pollutions).toEqual([pollution]));
    http.expectOne(endpoint).flush([pollution]);

    service.getById('abc-123').subscribe((result) => expect(result).toEqual(pollution));
    http.expectOne(`${endpoint}/abc-123`).flush(pollution);
  });

  it('creates, updates and deletes pollutions through the HTTP API', () => {
    service.create(declaration).subscribe((result) => expect(result).toEqual(pollution));
    const create = http.expectOne(endpoint);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(declaration);
    create.flush(pollution);

    service.update(pollution.id, declaration).subscribe((result) => expect(result).toEqual(pollution));
    const update = http.expectOne(`${endpoint}/${pollution.id}`);
    expect(update.request.method).toBe('PUT');
    update.flush(pollution);

    service.delete(pollution.id).subscribe();
    const remove = http.expectOne(`${endpoint}/${pollution.id}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
