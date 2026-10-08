import { Component, Input } from '@angular/core';
import { PollutionDeclaration } from '../../models/pollution-declaration';

@Component({
  selector: 'app-pollution-summary',
  templateUrl: './pollution-summary.html',
  styleUrl: './pollution-summary.css'
})
export class PollutionSummary {
  @Input({ required: true }) declaration!: PollutionDeclaration;
}