import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { Pollution, PollutionDeclaration, PollutionType } from '../../models/pollution-declaration';
import { PollutionService } from '../../services/pollution.service';
import { PollutionGlobe } from '../pollution-viz/pollution-globe';
import { findKnownPlace, geocodeLocation } from '../pollution-viz/pollution-viz-theme';

const validDate: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string;
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { invalidDate: true };

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? null
    : { invalidDate: true };
};

const coordinateRange = (minimum: number, maximum: number): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === '') return null;

  return Number.isFinite(Number(value)) && Number(value) >= minimum && Number(value) <= maximum
    ? null
    : { coordinateRange: true };
};

const pollutionTypes: PollutionType[] = ['Plastique', 'Chimique', 'Dépôt sauvage', 'Eau', 'Air', 'Autre'];

@Component({
  selector: 'app-pollution-form',
  imports: [PollutionGlobe, ReactiveFormsModule, RouterLink],
  templateUrl: './pollution-form.html'
})
export class PollutionForm {
  private readonly pollutionService = inject(PollutionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly types = pollutionTypes;
  readonly pollutionId = this.route.snapshot.paramMap.get('id');
  readonly isEditing = this.pollutionId !== null;
  readonly loading = signal(this.isEditing);
  readonly saving = signal(false);
  readonly locating = signal(false);
  readonly geoNotice = signal('');
  readonly error = signal('');
  readonly loadFailed = signal(false);

  private suppressAutoGeocode = false;
  private lastAutoQuery = '';

  readonly previewTitle = signal('');
  readonly previewLocation = signal('');
  readonly previewType = signal<PollutionType | ''>('');
  readonly previewLatitude = signal<number | null>(null);
  readonly previewLongitude = signal<number | null>(null);

  /** Aperçu temps réel sous forme de trait sur le globe dès que latitude & longitude sont renseignées. */
  readonly draftPollutions = computed<Pollution[]>(() => {
    const lat = this.previewLatitude();
    const lon = this.previewLongitude();
    if (lat === null || lon === null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return [];
    }
    return [
      {
        id: 'draft-preview',
        title: this.previewTitle().trim() || 'Nouveau signalement sur le globe',
        type: (this.previewType() || 'Autre') as PollutionType,
        description: '',
        observedAt: '',
        location: this.previewLocation().trim() || 'Point sélectionné sur le globe',
        latitude: Number(lat),
        longitude: Number(lon),
        photoUrl: '',
        createdAt: ''
      }
    ];
  });

  readonly declarationForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    type: new FormControl<PollutionType | ''>('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    observedAt: new FormControl('', { nonNullable: true, validators: [Validators.required, validDate] }),
    location: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    latitude: new FormControl<number | null>(null, { validators: [Validators.required, coordinateRange(-90, 90)] }),
    longitude: new FormControl<number | null>(null, { validators: [Validators.required, coordinateRange(-180, 180)] }),
    photoUrl: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^$|^https?:\/\/.+/i)] })
  });

  constructor() {
    this.declarationForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.previewTitle.set(value.title ?? '');
        this.previewLocation.set(value.location ?? '');
        this.previewType.set(value.type ?? '');
        this.previewLatitude.set(value.latitude ?? null);
        this.previewLongitude.set(value.longitude ?? null);
      });

    // Insertion immédiate dès qu'une ville connue est saisie dans le champ Lieu
    this.declarationForm.controls.location.valueChanges
      .pipe(
        filter(() => !this.suppressAutoGeocode),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rawLocation) => {
        const known = findKnownPlace(rawLocation);
        if (known) {
          this.lastAutoQuery = rawLocation.trim();
          this.applyCoordinates(
            { latitude: known.latitude, longitude: known.longitude },
            `Coordonnées insérées automatiquement pour ${known.name} (${known.latitude}°, ${known.longitude}°).`
          );
        }
      });

    // Recherche automatique différée (Nominatim) pour toute autre ville ou adresse saisie
    this.declarationForm.controls.location.valueChanges
      .pipe(
        filter(() => !this.suppressAutoGeocode),
        debounceTime(450),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rawLocation) => {
        const query = rawLocation.trim();
        if (query.length < 3 || findKnownPlace(query) || query === this.lastAutoQuery) {
          return;
        }
        this.lastAutoQuery = query;
        void this.autoGeocodeQuery(query);
      });

    if (this.pollutionId) this.loadPollution(this.pollutionId);
  }

  /** Appelé lorsque l'utilisateur clique sur la Terre 3D ou lorsqu'une ville est reconnue. */
  applyCoordinates(coords: { latitude: number; longitude: number }, customNotice?: string): void {
    this.declarationForm.patchValue({
      latitude: coords.latitude,
      longitude: coords.longitude
    });
    this.declarationForm.controls.latitude.markAsDirty();
    this.declarationForm.controls.longitude.markAsDirty();
    this.geoNotice.set(customNotice ?? `Point placé sur le globe (${coords.latitude}°, ${coords.longitude}°).`);
  }

  /** Recherche les coordonnées GPS à partir du champ « Lieu » et place le trait sur le globe. */
  async locateFromPlaceName(): Promise<void> {
    const query = this.declarationForm.controls.location.value.trim();
    if (!query) {
      this.geoNotice.set('Saisissez un lieu (ex. Nantes, Lyon, Marseille) ou cliquez sur le globe.');
      return;
    }

    this.locating.set(true);
    this.geoNotice.set('');
    const result = await geocodeLocation(query);
    this.locating.set(false);

    if (!result) {
      this.geoNotice.set('Lieu non trouvé automatiquement : cliquez sur le globe ou saisissez les coordonnées.');
      return;
    }

    this.applyCoordinates(
      { latitude: result.latitude, longitude: result.longitude },
      `Coordonnées insérées (${result.latitude}°, ${result.longitude}°).`
    );
  }

  /** Capte la position GPS de l'appareil via l'API Geolocation du navigateur. */
  useCurrentGeolocation(): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.geoNotice.set('La géolocalisation n’est pas disponible sur ce navigateur.');
      return;
    }

    this.locating.set(true);
    this.geoNotice.set('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locating.set(false);
        this.applyCoordinates({
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4))
        });
      },
      () => {
        this.locating.set(false);
        this.geoNotice.set('Impossible de capter votre position GPS. Cliquez directement sur le globe.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  submitDeclaration(): void {
    this.declarationForm.markAllAsTouched();
    if (this.declarationForm.invalid) return;

    const value = this.declarationForm.getRawValue();
    const type = value.type;
    if (value.latitude === null || value.longitude === null || type === '') return;

    const declaration: PollutionDeclaration = {
      ...value,
      type,
      latitude: Number(value.latitude),
      longitude: Number(value.longitude)
    };

    this.saving.set(true);
    this.error.set('');
    const request = this.pollutionId
      ? this.pollutionService.update(this.pollutionId, declaration)
      : this.pollutionService.create(declaration);
    request.subscribe({
      next: (pollution) => {
        this.saving.set(false);
        void this.router.navigate(['/pollutions', pollution.id]);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Impossible d’enregistrer ce signalement.');
        this.saving.set(false);
      }
    });
  }

  private async autoGeocodeQuery(query: string): Promise<void> {
    this.locating.set(true);
    const result = await geocodeLocation(query);
    this.locating.set(false);

    if (!result) return;
    if (this.declarationForm.controls.location.value.trim() !== query) return;

    this.applyCoordinates(
      { latitude: result.latitude, longitude: result.longitude },
      `Coordonnées insérées automatiquement (${result.latitude}°, ${result.longitude}°).`
    );
  }

  private loadPollution(id: string): void {
    this.pollutionService.getById(id).subscribe({
      next: (pollution: Pollution) => {
        this.suppressAutoGeocode = true;
        this.declarationForm.patchValue({
          ...pollution,
          latitude: Number(pollution.latitude),
          longitude: Number(pollution.longitude)
        });
        this.suppressAutoGeocode = false;
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Impossible de charger ce signalement.');
        this.loadFailed.set(true);
        this.loading.set(false);
      }
    });
  }
}
