import { HttpErrorResponse } from '@angular/common/http';
import { Component, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class SignupComponent {
  readonly backToReport = output<void>();
  readonly submitting = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  readonly signupForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] })
  });

  constructor(private readonly authService: AuthService) {}

  submitSignup(): void {
    this.signupForm.markAllAsTouched();
    if (this.signupForm.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const signupData = this.signupForm.getRawValue();
    this.authService.signup(signupData).subscribe({
      next: (response) => {
        if (!environment.production) {
          console.info('Adresse confirmée par l’API :', signupData.email);
        }
        this.successMessage.set(response.message || 'Votre compte a bien été créé.');
        this.signupForm.reset();
      },
      error: (error: HttpErrorResponse) => {
        const serverMessage = error.error?.message;
        this.errorMessage.set(typeof serverMessage === 'string'
          ? serverMessage
          : error.status === 0
            ? 'Le serveur est injoignable. Vérifiez la configuration de l’API.'
            : 'La création du compte a échoué. Vérifiez les informations saisies.');
        this.submitting.set(false);
      },
      complete: () => this.submitting.set(false)
    });
  }
}