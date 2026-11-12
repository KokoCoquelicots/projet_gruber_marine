import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PollutionForm } from './pollution-form';

describe('PollutionForm', () => {
  it('rejects coordinates outside geographic ranges', async () => {
    await TestBed.configureTestingModule({
      imports: [PollutionForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(PollutionForm);
    const form = fixture.componentInstance.declarationForm;
    form.setValue({
      title: 'Déchets près de la rivière',
      type: 'Plastique',
      description: 'Plusieurs bouteilles et emballages sur la berge.',
      observedAt: '2026-10-05',
      location: 'Quai de la Loire, Nantes',
      latitude: 91,
      longitude: -1.5536,
      photoUrl: ''
    });

    expect(form.invalid).toBe(true);
    expect(form.controls.latitude.hasError('coordinateRange')).toBe(true);
  });

  it('populates coordinates and updates the 3D globe preview when clicking the globe or locating a place', async () => {
    await TestBed.configureTestingModule({
      imports: [PollutionForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(PollutionForm);
    const component = fixture.componentInstance;

    component.applyCoordinates({ latitude: 47.2184, longitude: -1.5536 });
    expect(component.declarationForm.controls.latitude.value).toBe(47.2184);
    expect(component.declarationForm.controls.longitude.value).toBe(-1.5536);
    expect(component.draftPollutions().length).toBe(1);

    component.declarationForm.controls.location.setValue('Parc de la Tête d’Or, Lyon');
    await component.locateFromPlaceName();
    expect(component.declarationForm.controls.latitude.value).toBe(45.764);
    expect(component.declarationForm.controls.longitude.value).toBe(4.8357);
  });
});
