import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { PollutionService } from '../../services/pollution.service';
import { PollutionSummary } from '../pollution-summary/pollution-summary';

@Component({
  selector: 'app-pollution-detail',
  imports: [DatePipe, PollutionSummary, RouterLink],
  templateUrl: './pollution-detail.html'
})
export class PollutionDetail {
  private readonly pollutionService = inject(PollutionService);
  private readonly router = inject(Router);
  private readonly pollutionId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly pollution = toSignal(
    this.pollutionId
      ? this.pollutionService.getById(this.pollutionId).pipe(
          tap(() => this.loading.set(false)),
          catchError((error: HttpErrorResponse) => {
            this.error.set(error.error?.message ?? 'Impossible de charger ce signalement.');
            this.loading.set(false);
            return of(null);
          })
        )
      : of(null),
    { initialValue: null }
  );

  constructor() {
    if (!this.pollutionId) {
      this.error.set('Identifiant de signalement manquant.');
      this.loading.set(false);
    }
  }

  deletePollution(): void {
    const pollution = this.pollution();
    if (!pollution || !window.confirm(`Supprimer le signalement « ${pollution.title} » ?`)) return;

    this.error.set('');
    this.pollutionService.delete(pollution.id).subscribe({
      next: () => void this.router.navigate(['/']),
      error: (error: HttpErrorResponse) => this.error.set(error.error?.message ?? 'Impossible de supprimer ce signalement.')
    });
  }
}
