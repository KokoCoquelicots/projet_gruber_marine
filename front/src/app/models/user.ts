export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface UserCredentials {
  email: string;
  password: string;
}

export interface UserRegistration extends UserCredentials {
  name: string;
}
