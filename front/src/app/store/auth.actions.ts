import { LoginPayload } from './auth.model';

export class Login {
  static readonly type = '[Auth] Login';

  constructor(public readonly payload: LoginPayload) {}
}

export class Logout {
  static readonly type = '[Auth] Logout';
}
