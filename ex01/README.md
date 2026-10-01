# Ex01

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.24.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Déploiement sur Render

Le fichier `render.yaml`, situé à la racine du dépôt, configure le déploiement du site Angular comme site statique.

1. Poussez le dépôt sur GitHub.
2. Dans Render, choisissez **New > Blueprint** et connectez ce dépôt.
3. Render lit `render.yaml`, installe les dépendances dans `ex01/`, lance le build de production et publie `ex01/dist/ex01/browser`.

Le Blueprint configure aussi une réécriture vers `index.html` pour que les routes Angular fonctionnent après un rechargement de page. Chaque nouveau push sur la branche déployée déclenchera ensuite un nouveau déploiement.

Pour créer le site manuellement plutôt qu’avec le Blueprint, utilisez ces paramètres dans Render :

- **Root Directory** : laisser vide
- **Build Command** : `cd ex01 && npm ci && npm run build`
- **Publish Directory** : `ex01/dist/ex01/browser`
- **Rewrite Rule** : source `/*`, destination `/index.html`

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
