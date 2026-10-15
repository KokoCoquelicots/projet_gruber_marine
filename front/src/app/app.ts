import { Component, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { PollutionDeclaration, PollutionType } from './models/pollution-declaration';
import { PollutionSummary } from './components/pollution-summary/pollution-summary';

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

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, PollutionSummary],
  templateUrl: './pollution-form.html',
  styleUrl: './app.css'
})
export class App {
  readonly submittedDeclaration = signal<PollutionDeclaration | null>(null);

  readonly declarationForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    observedAt: new FormControl('', { nonNullable: true, validators: [Validators.required, validDate] }),
    location: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    latitude: new FormControl<number | null>(null, { validators: [Validators.required, coordinateRange(-90, 90)] }),
    longitude: new FormControl<number | null>(null, { validators: [Validators.required, coordinateRange(-180, 180)] }),
    photoUrl: new FormControl('', { nonNullable: true })
  });

  submitDeclaration(): void {
    this.declarationForm.markAllAsTouched();
    if (this.declarationForm.invalid) return;

    const value = this.declarationForm.getRawValue();
    if (value.latitude === null || value.longitude === null) return;

    this.submittedDeclaration.set({
      ...value,
      type: value.type as PollutionType,
      latitude: value.latitude,
      longitude: value.longitude
    });
  }

  startNewDeclaration(): void {
    this.submittedDeclaration.set(null);
    this.declarationForm.reset();
  }
}
