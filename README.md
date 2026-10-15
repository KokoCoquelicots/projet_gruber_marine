# TP 02 - Formulaire Angular et inscription

Application Angular de déclaration de pollution. Le formulaire d’inscription illustre la création et l’injection d’un service Angular utilisant `HttpClient` pour envoyer une requête REST. Une API locale de démonstration est fournie pour tester ce parcours.

## Inscription

Le composant `SignupComponent` valide le nom, l’adresse e-mail et le mot de passe, puis appelle `AuthService.signup()`. Le service envoie un `POST` vers `${apiUrl}/auth/signup` avec le JSON `{ "name": "...", "email": "...", "password": "..." }`. Le formulaire affiche ensuite le message de succès fourni par l’API, ou un message d’erreur en cas d’échec.

L’URL de base est définie dans `front/src/environments/environment.ts` pour le développement (`http://localhost:3000/api`). La compilation de production remplace cette configuration par `front/src/environments/environment.production.ts` (`/api`), à adapter à l’hébergement de l’API.

L’API locale expose `POST /api/auth/signup`. Elle valide les champs, refuse les adresses e-mail déjà utilisées durant l’exécution et conserve en mémoire le nom, l’e-mail et un hash `scrypt` du mot de passe. Le terminal de l’API affiche le nom et l’e-mail après une inscription valide, jamais le mot de passe. Les données sont oubliées à l’arrêt du serveur : c’est une API pédagogique, pas une implémentation de production.

## Lancer l’API locale

Dans un second terminal :

```bash
cd api
npm start
```

L’API écoute sur `http://localhost:3000`; le front de développement utilise cette adresse par défaut.

## Lancer le front

```bash
cd front
npm install
npm start
```

Le front est disponible sur `http://localhost:4200`. Pour lancer les tests : `npm test -- --watch=false`.