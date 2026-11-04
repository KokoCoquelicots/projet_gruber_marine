import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pollution, PollutionDeclaration } from '../models/pollution-declaration';

@Injectable({ providedIn: 'root' })
export class PollutionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/pollutions`;

  getAll(): Observable<Pollution[]> {
    return this.http.get<Pollution[]>(this.apiUrl);
  }

  getById(id: string): Observable<Pollution> {
    return this.http.get<Pollution>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  create(declaration: PollutionDeclaration): Observable<Pollution> {
    return this.http.post<Pollution>(this.apiUrl, declaration);
  }

  update(id: string, declaration: PollutionDeclaration): Observable<Pollution> {
    return this.http.put<Pollution>(`${this.apiUrl}/${encodeURIComponent(id)}`, declaration);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }
}
