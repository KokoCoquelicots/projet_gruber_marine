import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, UserCredentials, UserRegistration } from '../models/user';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  create(user: UserRegistration): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  authenticate(credentials: UserCredentials): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/authenticate`, credentials);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }
}
