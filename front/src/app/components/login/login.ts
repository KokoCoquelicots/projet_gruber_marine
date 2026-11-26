import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { Login as LoginAction, Logout } from '../../store/auth.actions';
import { AuthState } from '../../store/auth.state';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Login {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isAuthenticated = this.store.selectSignal(AuthState.isAuthenticated);
  readonly username = this.store.selectSignal(AuthState.username);
  readonly user = this.store.selectSignal(AuthState.user);

  readonly simulatedProfiles = [
    { nom: 'Marine Gruber', email: 'marine.gruber@vigie.fr', role: 'Observatrice' },
    { nom: 'Camille Verdier', email: 'camille.verdier@vigie.fr', role: 'Coordinatrice' }
  ] as const;

  readonly loginForm = new FormGroup({
    nom: new FormControl('Marine Gruber', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)]
    }),
    email: new FormControl('marine.gruber@vigie.fr', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    })
  });

  selectProfile(profile: { nom: string; email: string }): void {
    this.loginForm.setValue({
      nom: profile.nom,
      email: profile.email
    });
  }

  submit(): void {
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;

    const { email, nom } = this.loginForm.getRawValue();
    this.store.dispatch(new LoginAction({ email, nom }));

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
    void this.router.navigateByUrl(destination);
  }

  quickLogin(profile: { nom: string; email: string; role?: string } = this.simulatedProfiles[0]): void {
    this.selectProfile(profile);
    this.store.dispatch(new LoginAction({ email: profile.email, nom: profile.nom, role: profile.role }));

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
    void this.router.navigateByUrl(destination);
  }

  logout(): void {
    this.store.dispatch(new Logout());
  }
}
