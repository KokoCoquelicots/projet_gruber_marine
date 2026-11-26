export interface UserProfile {
  id: number;
  email: string;
  nom: string;
  role: string;
}

export interface AuthStateModel {
  user: UserProfile | null;
  isAuthenticated: boolean;
}

export interface LoginPayload {
  email: string;
  nom: string;
  id?: number;
  role?: string;
}

export const INITIAL_AUTH_STATE: AuthStateModel = {
  user: null,
  isAuthenticated: false
};
