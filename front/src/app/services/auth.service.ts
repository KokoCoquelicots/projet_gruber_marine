import { Injectable, inject, signal } from '@angular/core';
import { Store } from '@ngxs/store';
import { Observable, tap } from 'rxjs';
import { User, UserCredentials } from '../models/user';
import { Login, Logout } from '../store/auth.actions';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly users = inject(UserService);
  private readonly store = inject(Store, { optional: true });
  readonly currentUser = signal<User | null>(null);

  login(credentials: UserCredentials): Observable<User> {
    return this.users.authenticate(credentials).pipe(
      tap((user) => {
        this.currentUser.set(user);
        this.store?.dispatch(new Login({ email: user.email, nom: user.name }));
      })
    );
  }

  logout(): void {
    this.currentUser.set(null);
    this.store?.dispatch(new Logout());
  }
}
