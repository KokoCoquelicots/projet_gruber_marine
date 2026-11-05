# TP 04 — Vigie

Application Angular de signalement de pollutions, connectée à une API REST Node.js utilisant Sequelize et PostgreSQL. Elle permet de gérer les signalements et les utilisateurs, avec une authentification pédagogique.

## Lancement

L’API nécessite Node.js 20 ou plus et les variables `DATABASE_URL` (URL PostgreSQL) et `DATABASE_SSL=true` si la base exige SSL. Ne placez pas les identifiants de la base dans Git.

```bash
cd api
npm ci
npm start
```

L’API est disponible sur `http://localhost:3000/api`. Dans un second terminal :

```bash
cd front
npm ci
npm start
```

Le front est disponible sur `http://localhost:4200`. Les URLs d’API pour le développement et la production sont configurées dans `front/src/environments`. Le fichier `render.yaml` configure les services Render et leur base PostgreSQL.

Au premier démarrage, l’API crée la table des utilisateurs et la table `pollution` si elles n’existent pas, puis ajoute les deux signalements d’exemple seulement si cette dernière est vide.

## API

- `GET /api/users` et `POST /api/users` : lister et créer des utilisateurs.
- `DELETE /api/users/:id` : supprimer un utilisateur.
- `POST /api/users/authenticate` : vérifier les identifiants (authentification fictive, sans session ni protection des routes).
- `GET /api/pollutions` et `GET /api/pollutions/:id` : consulter les signalements.
- `POST /api/pollutions`, `PUT /api/pollutions/:id` et `DELETE /api/pollutions/:id` : gérer les signalements.

Les mots de passe sont hachés avec `scrypt` et ne sont jamais renvoyés par l’API. L’authentification est uniquement pédagogique et ne doit pas être utilisée comme contrôle d’accès en production.

## Tests et production

Depuis `front`, exécuter `npm test -- --watch=false` et `npm run build`. Depuis `api`, exécuter `npm test`. Render installe les dépendances avec `npm ci` à partir des lockfiles.