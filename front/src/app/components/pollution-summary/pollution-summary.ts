import { Component, Input } from '@angular/core';
import { HighlightPollutionDirective } from '../../directives/highlight-pollution.directive';
import { Pollution, PollutionDeclaration } from '../../models/pollution-declaration';
import { getPollutionDangerIndex, PollutionLevelPipe } from '../../pipes/pollution-level.pipe';

@Component({
  selector: 'app-pollution-summary',
  imports: [HighlightPollutionDirective, PollutionLevelPipe],
  templateUrl: './pollution-summary.html',
  styleUrl: './pollution-summary.css'
})
export class PollutionSummary {
  @Input({ required: true }) declaration!: PollutionDeclaration | Pollution;

  get dangerIndex(): number {
    return getPollutionDangerIndex(this.declaration);
  }
}
