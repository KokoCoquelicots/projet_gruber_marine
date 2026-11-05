import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { User, UserCredentials } from '../models/user';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly users = inject(UserService);
  readonly currentUser = signal<User | null>(null);

  login(credentials: UserCredentials): Observable<User> {
    return this.users.authenticate(credentials).pipe(
      tap((user) => this.currentUser.set(user))
    );
  }

  logout(): void {
    this.currentUser.set(null);
  }
}
