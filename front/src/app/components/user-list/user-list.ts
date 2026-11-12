import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { User } from '../../models/user';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-list',
  imports: [DatePipe, RouterLink],
  templateUrl: './user-list.html'
})
export class UserList {
  private readonly userService = inject(UserService);
  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.loadUsers();
  }

  deleteUser(user: User): void {
    if (!window.confirm(`Supprimer le compte de « ${user.name} » ?`)) return;

    this.error.set('');
    this.userService.delete(user.id).subscribe({
      next: () => this.loadUsers(),
      error: (error: HttpErrorResponse) => this.error.set(
        error.error?.message ?? 'Impossible de supprimer cet utilisateur.'
      )
    });
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.error.set('');
    this.userService.getAll().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Impossible de charger les utilisateurs.');
        this.loading.set(false);
      }
    });
  }
}
