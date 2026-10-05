# TP 02 — Vigie

Application de déclaration de pollution avec un formulaire Angular Reactive Forms et un récapitulatif affiché sans navigation.

## Lancer le front

```bash
cd front
npm install
npm start
```

Le front est disponible sur `http://localhost:4200`. Pour lancer les tests : `npm test -- --watch=false`.

## Lancer l’API

Dans un second terminal :

```bash
cd api
npm install
npm run dev
```

L’API écoute sur `http://localhost:3000`. Elle expose `GET /api/health` et `POST /api/pollutions`. Les déclarations de l’API sont conservées en mémoire et ne sont pas encore reliées au front ni persistées en base de données.