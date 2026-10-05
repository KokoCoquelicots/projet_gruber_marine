import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('shows required-field errors after an empty submission', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('app-pollution-summary')).toBeNull();
  });

  it('shows the summary after a valid submission', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.declarationForm.setValue({
      title: 'Déchets près de la rivière',
      type: 'Plastique',
      description: 'Plusieurs bouteilles et emballages sur la berge.',
      observedAt: '2026-10-05',
      location: 'Quai de la Loire, Nantes',
      latitude: 47.2184,
      longitude: -1.5536,
      photoUrl: ''
    });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-pollution-summary')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Déchets près de la rivière');
  });

  it('rejects coordinates outside geographic ranges', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.declarationForm.setValue({
      title: 'Déchets près de la rivière',
      type: 'Plastique',
      description: 'Plusieurs bouteilles et emballages sur la berge.',
      observedAt: '2026-10-05',
      location: 'Quai de la Loire, Nantes',
      latitude: 91,
      longitude: -1.5536,
      photoUrl: ''
    });

    expect(app.declarationForm.invalid).toBe(true);
    expect(app.declarationForm.controls.latitude.hasError('coordinateRange')).toBe(true);
  });
});
