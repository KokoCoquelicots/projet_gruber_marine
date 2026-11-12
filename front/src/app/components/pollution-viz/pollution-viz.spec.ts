import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { Pollution } from '../../models/pollution-declaration';
import { PollutionForm } from '../pollution-form/pollution-form';
import { PollutionGlobe } from './pollution-globe';
import {
  cartesianToLatLng,
  DEFAULT_POLLUTION_THEME,
  findKnownPlace,
  formatCoordinates,
  geocodeLocation,
  getPollutionTheme,
  latLngToCartesian
} from './pollution-viz-theme';

describe('Pollution 3D globe & automatic city geocoding', () => {
  const samplePollutions: Pollution[] = [
    {
      id: 'p-1',
      title: 'Déchets plastiques sur la berge',
      type: 'Plastique',
      description: 'Bouteilles au bord de la Loire.',
      observedAt: '2026-10-05',
      location: 'Nantes',
      latitude: 47.2184,
      longitude: -1.5536,
      photoUrl: '',
      createdAt: '2026-10-05T10:00:00.000Z'
    },
    {
      id: 'p-2',
      title: 'Rejet chimique dans le canal',
      type: 'Chimique',
      description: 'Mousse suspecte.',
      observedAt: '2026-10-12',
      location: 'Lyon',
      latitude: 45.764,
      longitude: 4.8357,
      photoUrl: '',
      createdAt: '2026-10-12T09:00:00.000Z'
    }
  ];

  it('projects latitude/longitude onto the 3D sphere and inverts back accurately', () => {
    const [x, y, z] = latLngToCartesian(47.2184, -1.5536, 1.42);
    const inverted = cartesianToLatLng(x, y, z);

    expect(inverted.latitude).toBeCloseTo(47.2184, 3);
    expect(inverted.longitude).toBeCloseTo(-1.5536, 3);

    const [, yNorth] = latLngToCartesian(90, 0, 2);
    expect(yNorth).toBeCloseTo(2);
  });

  it('formats GPS coordinates, resolves French cities and selects themes per pollution type', async () => {
    expect(formatCoordinates(47.2184, -1.5536)).toBe('47.22° N, 1.55° O');
    expect(formatCoordinates(-12.5, 45.2)).toBe('12.50° S, 45.20° E');
    expect(formatCoordinates(null, null)).toBe('Coordonnées GPS en attente');

    expect(getPollutionTheme('Chimique').label).toBe('Réaction chimique');
    expect(getPollutionTheme('Eau').label).toBe('Milieu aquatique');
    expect(getPollutionTheme('')).toEqual(DEFAULT_POLLUTION_THEME);

    expect(findKnownPlace('Strasbourg')).toEqual({
      name: 'Strasbourg',
      latitude: 48.5734,
      longitude: 7.7521
    });

    const nantes = await geocodeLocation('Quai de la Loire, Nantes');
    expect(nantes).toEqual({ latitude: 47.2184, longitude: -1.5536 });
  });

  it('displays the most recent pollution detail on the 3D globe and cycles through spikes', () => {
    TestBed.configureTestingModule({
      imports: [PollutionGlobe],
      providers: [provideRouter([])]
    });

    const fixture = TestBed.createComponent(PollutionGlobe);
    fixture.componentRef.setInput('pollutions', samplePollutions);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.globe-count')?.textContent).toContain('2 signalement(s)');
    expect(host.querySelector('.globe-target-title')?.textContent).toContain('Déchets plastiques sur la berge');
    expect(host.querySelector('.globe-detail-desc')?.textContent).toContain('Bouteilles au bord de la Loire.');

    fixture.componentInstance.cyclePollution(1);
    fixture.detectChanges();
    expect(host.querySelector('.globe-target-title')?.textContent).toContain('Rejet chimique dans le canal');
  });

  it('automatically inserts latitude and longitude when typing a city in PollutionForm', () => {
    TestBed.configureTestingModule({
      imports: [PollutionForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });

    const fixture = TestBed.createComponent(PollutionForm);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.declarationForm.controls.location.setValue('Nantes');
    fixture.detectChanges();

    expect(component.declarationForm.controls.latitude.value).toBe(47.2184);
    expect(component.declarationForm.controls.longitude.value).toBe(-1.5536);
    expect(component.draftPollutions().length).toBe(1);
    expect(component.draftPollutions()[0].latitude).toBe(47.2184);
    expect(component.draftPollutions()[0].longitude).toBe(-1.5536);
  });
});
