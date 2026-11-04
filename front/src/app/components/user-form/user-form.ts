import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserRegistration } from '../../models/user';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './user-form.html'
})
export class UserForm {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly registrationForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)]
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)]
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)]
    })
  });

  submit(): void {
    this.registrationForm.markAllAsTouched();
    if (this.registrationForm.invalid) return;

    const registration: UserRegistration = this.registrationForm.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.userService.create(registration).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/users']);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Impossible de créer ce compte.');
        this.saving.set(false);
      }
    });
  }
}
