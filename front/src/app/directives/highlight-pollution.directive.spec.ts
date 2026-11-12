import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PollutionLevelPipe } from '../pipes/pollution-level.pipe';
import { HighlightPollutionDirective } from './highlight-pollution.directive';

@Component({
  imports: [HighlightPollutionDirective, PollutionLevelPipe],
  template: `
    <span id="by-index" [appHighlightPollution]="index()">
      {{ index() | pollutionLevel }}
    </span>
    <span id="by-level" [appHighlightPollution]="index() | pollutionLevel">
      {{ index() | pollutionLevel }}
    </span>
  `
})
class HostTestComponent {
  readonly index = signal(10);
}

describe('HighlightPollutionDirective', () => {
  it('updates background color for Faible, Modérée, Élevée and Dangereuse levels', () => {
    TestBed.configureTestingModule({
      imports: [HostTestComponent]
    });

    const fixture = TestBed.createComponent(HostTestComponent);
    const host = fixture.nativeElement as HTMLElement;
    const byIndex = host.querySelector('#by-index') as HTMLElement;
    const byLevel = host.querySelector('#by-level') as HTMLElement;

    // 0–20 → Faible (Vert clair : #dcfce7 / rgb(220, 252, 231))
    fixture.detectChanges();
    expect(byIndex.getAttribute('data-pollution-level')).toBe('Faible');
    expect(byIndex.style.backgroundColor).toBe('rgb(220, 252, 231)');
    expect(byLevel.style.backgroundColor).toBe('rgb(220, 252, 231)');

    // 21–50 → Modérée (Jaune : #fef9c3 / rgb(254, 249, 195))
    fixture.componentInstance.index.set(35);
    fixture.detectChanges();
    expect(byIndex.getAttribute('data-pollution-level')).toBe('Modérée');
    expect(byIndex.style.backgroundColor).toBe('rgb(254, 249, 195)');
    expect(byLevel.style.backgroundColor).toBe('rgb(254, 249, 195)');

    // 51–100 → Élevée (Orange : #ffedd5 / rgb(255, 237, 213))
    fixture.componentInstance.index.set(75);
    fixture.detectChanges();
    expect(byIndex.getAttribute('data-pollution-level')).toBe('Élevée');
    expect(byIndex.style.backgroundColor).toBe('rgb(255, 237, 213)');
    expect(byLevel.style.backgroundColor).toBe('rgb(255, 237, 213)');

    // 101+ → Dangereuse (Rouge : #fee2e2 / rgb(254, 226, 226))
    fixture.componentInstance.index.set(125);
    fixture.detectChanges();
    expect(byIndex.getAttribute('data-pollution-level')).toBe('Dangereuse');
    expect(byIndex.style.backgroundColor).toBe('rgb(254, 226, 226)');
    expect(byLevel.style.backgroundColor).toBe('rgb(254, 226, 226)');
  });
});
