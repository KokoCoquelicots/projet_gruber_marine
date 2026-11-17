import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/pollution-list/pollution-list').then((module) => module.PollutionList) },
  { path: 'login', loadComponent: () => import('./components/login/login').then((module) => module.Login) },
  { path: 'users/new', loadComponent: () => import('./components/user-form/user-form').then((module) => module.UserForm) },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () => import('./components/user-list/user-list').then((module) => module.UserList)
  },
  {
    path: 'pollutions/new',
    canActivate: [authGuard],
    loadComponent: () => import('./components/pollution-form/pollution-form').then((module) => module.PollutionForm)
  },
  {
    path: 'pollutions/:id/edit',
    canActivate: [authGuard],
    loadComponent: () => import('./components/pollution-form/pollution-form').then((module) => module.PollutionForm)
  },
  {
    path: 'pollutions/:id',
    loadComponent: () => import('./components/pollution-detail/pollution-detail').then((module) => module.PollutionDetail)
  },
  { path: '**', redirectTo: '' }
];
