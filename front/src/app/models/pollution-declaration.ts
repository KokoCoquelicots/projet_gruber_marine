export type PollutionType = 'Plastique' | 'Chimique' | 'Dépôt sauvage' | 'Eau' | 'Air' | 'Autre';

export interface PollutionDeclaration {
  title: string;
  type: PollutionType;
  description: string;
  observedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  photoUrl: string;
}