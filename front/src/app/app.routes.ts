import { Routes } from '@angular/router';
import { PollutionDetail } from './components/pollution-detail/pollution-detail';
import { PollutionForm } from './components/pollution-form/pollution-form';
import { PollutionList } from './components/pollution-list/pollution-list';

export const routes: Routes = [
  { path: '', component: PollutionList },
  { path: 'pollutions/new', component: PollutionForm },
  { path: 'pollutions/:id/edit', component: PollutionForm },
  { path: 'pollutions/:id', component: PollutionDetail },
  { path: '**', redirectTo: '' }
];
