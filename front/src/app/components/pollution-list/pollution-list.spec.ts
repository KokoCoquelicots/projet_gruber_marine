import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pollution } from '../../models/pollution-declaration';
import { PollutionList } from './pollution-list';

describe('PollutionList', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PollutionList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('filters records by text, type and observation date range', () => {
    const fixture = TestBed.createComponent(PollutionList);
    fixture.detectChanges();
    const list = fixture.componentInstance;
    const results: Pollution[] = [
      {
        id: '1',
        title: 'Plastique en rivière',
        type: 'Plastique',
        description: 'Bouteilles sur la berge',
        observedAt: '2026-10-05',
        location: 'Nantes',
        latitude: 47.2,
        longitude: -1.5,
        photoUrl: '',
        createdAt: '2026-10-05T10:00:00.000Z'
      },
      {
        id: '2',
        title: 'Déchets chimiques',
        type: 'Chimique',
        description: 'Odeur étrange',
        observedAt: '2026-10-08',
        location: 'Angers',
        latitude: 47.4,
        longitude: -0.5,
        photoUrl: '',
        createdAt: '2026-10-08T10:00:00.000Z'
      }
    ];
    http.expectOne((request) => request.url.endsWith('/pollutions')).flush(results);

    list.filterForm.setValue({
      query: 'RIVIÈRE',
      type: 'Plastique',
      dateFrom: '2026-10-04',
      dateTo: '2026-10-06'
    });

    expect(list.filteredPollutions().map(({ id }) => id)).toEqual(['1']);
    list.filterForm.controls.dateTo.setValue('2026-10-04');
    expect(list.filteredPollutions()).toEqual([]);
  });
});
