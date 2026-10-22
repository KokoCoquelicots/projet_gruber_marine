import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Pollution, PollutionDeclaration, PollutionType } from '../../models/pollution-declaration';
import { PollutionService } from '../../services/pollution.service';

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
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './pollution-form.html'
})
export class PollutionForm {
  private readonly pollutionService = inject(PollutionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly types = pollutionTypes;
  readonly pollutionId = this.route.snapshot.paramMap.get('id');
  readonly isEditing = this.pollutionId !== null;
  readonly loading = signal(this.isEditing);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly loadFailed = signal(false);

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
    if (this.pollutionId) this.loadPollution(this.pollutionId);
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
      latitude: value.latitude,
      longitude: value.longitude
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

  private loadPollution(id: string): void {
    this.pollutionService.getById(id).subscribe({
      next: (pollution: Pollution) => {
        this.declarationForm.patchValue(pollution);
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
