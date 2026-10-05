# API Vigie

API Express indépendante du front Angular.

## Démarrage

```bash
npm install
npm run dev
```

Le serveur écoute sur `http://localhost:3000`. L’origine autorisée par défaut est `http://localhost:4200` ; elle peut être remplacée avec `FRONT_ORIGIN`.

## Routes

- `GET /api/health` vérifie que l’API répond.
- `POST /api/pollutions` valide une déclaration et la conserve en mémoire jusqu’à l’arrêt du serveur.

Les données ne sont pas persistées : une base de données pourra être branchée ultérieurement.