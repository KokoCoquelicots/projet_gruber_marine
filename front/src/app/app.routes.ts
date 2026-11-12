import { Routes } from '@angular/router';
import { PollutionDetail } from './components/pollution-detail/pollution-detail';
import { PollutionForm } from './components/pollution-form/pollution-form';
import { PollutionList } from './components/pollution-list/pollution-list';
import { Login } from './components/login/login';
import { UserForm } from './components/user-form/user-form';
import { UserList } from './components/user-list/user-list';

export const routes: Routes = [
  { path: '', component: PollutionList },
  { path: 'login', component: Login },
  { path: 'users', component: UserList },
  { path: 'users/new', component: UserForm },
  { path: 'pollutions/new', component: PollutionForm },
  { path: 'pollutions/:id/edit', component: PollutionForm },
  { path: 'pollutions/:id', component: PollutionDetail },
  { path: '**', redirectTo: '' }
];
