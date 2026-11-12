import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { HighlightPollutionDirective } from '../../directives/highlight-pollution.directive';
import { Pollution, PollutionType } from '../../models/pollution-declaration';
import { getPollutionDangerIndex, PollutionLevelPipe } from '../../pipes/pollution-level.pipe';
import { PollutionService } from '../../services/pollution.service';
import { PollutionGlobe } from '../pollution-viz/pollution-globe';

interface PollutionFilters {
  query: string;
  type: string;
  dateFrom: string;
  dateTo: string;
}

@Component({
  selector: 'app-pollution-list',
  imports: [DatePipe, HighlightPollutionDirective, PollutionGlobe, PollutionLevelPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './pollution-list.html'
})
export class PollutionList {
  private readonly pollutionService = inject(PollutionService);
  private readonly refresh = new Subject<void>();
  readonly types: PollutionType[] = ['Plastique', 'Chimique', 'Dépôt sauvage', 'Eau', 'Air', 'Autre'];
  readonly dangerScale = [
    { sampleIndex: 10, range: '0–20' },
    { sampleIndex: 35, range: '21–50' },
    { sampleIndex: 75, range: '51–100' },
    { sampleIndex: 120, range: '101+' }
  ] as const;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly hoveredPollutionId = signal<string | null>(null);
  readonly pollutions = toSignal(
    this.refresh.pipe(
      startWith(undefined),
      tap(() => {
        this.loading.set(true);
        this.error.set('');
      }),
      switchMap(() => this.pollutionService.getAll().pipe(
        tap(() => this.loading.set(false)),
        catchError((error: HttpErrorResponse) => {
          this.error.set(this.errorMessage(error, 'Impossible de charger les signalements.'));
          this.loading.set(false);
          return of([] as Pollution[]);
        })
      ))
    ),
    { initialValue: [] as Pollution[] }
  );
  readonly filters = signal<PollutionFilters>({ query: '', type: '', dateFrom: '', dateTo: '' });
  readonly filteredPollutions = computed(() => {
    const filters = this.filters();
    const query = filters.query.trim().toLocaleLowerCase('fr');

    return this.pollutions().filter((pollution) =>
      (!query || [pollution.title, pollution.description, pollution.location]
        .some((value) => value.toLocaleLowerCase('fr').includes(query))) &&
      (!filters.type || pollution.type === filters.type) &&
      (!filters.dateFrom || pollution.observedAt >= filters.dateFrom) &&
      (!filters.dateTo || pollution.observedAt <= filters.dateTo)
    );
  });
  readonly activePollutionId = computed(() => {
    const focused = this.hoveredPollutionId();
    const list = this.filteredPollutions();
    if (focused && list.some((item) => item.id === focused)) {
      return focused;
    }
    return list[0]?.id ?? null;
  });
  readonly filterForm = new FormGroup({
    query: new FormControl('', { nonNullable: true }),
    type: new FormControl('', { nonNullable: true }),
    dateFrom: new FormControl('', { nonNullable: true }),
    dateTo: new FormControl('', { nonNullable: true })
  });

  constructor() {
    this.filterForm.valueChanges.subscribe((value) => {
      this.filters.set({
        query: value.query ?? '',
        type: value.type ?? '',
        dateFrom: value.dateFrom ?? '',
        dateTo: value.dateTo ?? ''
      });
    });
  }

  dangerIndex(pollution: Pollution): number {
    return getPollutionDangerIndex(pollution);
  }

  focusPollution(id: string | null): void {
    this.hoveredPollutionId.set(id);
  }

  deletePollution(pollution: Pollution): void {
    if (!window.confirm(`Supprimer le signalement « ${pollution.title} » ?`)) return;

    this.error.set('');
    this.pollutionService.delete(pollution.id).subscribe({
      next: () => this.refresh.next(),
      error: (error: HttpErrorResponse) => this.error.set(this.errorMessage(error, 'Impossible de supprimer ce signalement.'))
    });
  }

  resetFilters(): void {
    this.filterForm.reset();
  }

  private errorMessage(error: HttpErrorResponse, fallback: string): string {
    return error.error?.message ?? fallback;
  }
}
