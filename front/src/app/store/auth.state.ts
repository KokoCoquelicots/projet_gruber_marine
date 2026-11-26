import { Injectable } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { Login, Logout } from './auth.actions';
import { AuthStateModel, INITIAL_AUTH_STATE, UserProfile } from './auth.model';

@State<AuthStateModel>({
  name: 'auth',
  defaults: INITIAL_AUTH_STATE
})
@Injectable()
export class AuthState {
  @Selector()
  static user(state: AuthStateModel): UserProfile | null {
    return state.user;
  }

  @Selector()
  static isAuthenticated(state: AuthStateModel): boolean {
    return state.isAuthenticated;
  }

  @Selector()
  static username(state: AuthStateModel): string | null {
    return state.user?.nom ?? null;
  }

  @Action(Login)
  login(ctx: StateContext<AuthStateModel>, action: Login): void {
    const email = action.payload.email.trim().toLowerCase();
    const nom = action.payload.nom.trim() || email.split('@')[0] || 'Observateur';
    const user: UserProfile = {
      id: action.payload.id ?? 1,
      email,
      nom,
      role: action.payload.role ?? 'Observateur'
    };

    ctx.patchState({
      user,
      isAuthenticated: true
    });
  }

  @Action(Logout)
  logout(ctx: StateContext<AuthStateModel>): void {
    ctx.setState(INITIAL_AUTH_STATE);
  }
}
