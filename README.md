# TP 03 — Vigie

Application Angular de signalement de pollutions, connectée à une API REST simulée en Node.js. Elle permet de créer, consulter, modifier et supprimer les signalements, ainsi que de filtrer la liste par recherche textuelle, type et plage de dates.

## Lancement en local

Dans un premier terminal :

```bash
cd api
npm start
```

Dans un second terminal :

```bash
cd front
npm install
npm start
```

Le front est disponible sur `http://localhost:4200` et l’API sur `http://localhost:3000/api`. L’API utilise les modules natifs de Node.js, conserve les données en mémoire et recharge ses données d’exemple à chaque redémarrage.

## Tests et production

Depuis `front`, exécuter `npm test -- --watch=false` et `npm run build`. Depuis `api`, exécuter `npm test`.

Les URLs de l’API sont configurées dans `front/src/environments`. Le fichier `render.yaml` déclare les services front et API pour Render.