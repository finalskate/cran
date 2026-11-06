# Cran

Application web installable (PWA) pour le renforcement au poids de corps, la course à pied et le suivi alimentaire.
Elle fonctionne **entièrement hors ligne**, **sans compte ni serveur** : toutes les données restent sur le téléphone.

Adresse : **https://finalskate.github.io/cran/**

---

## 1. Installer l'appli sur le téléphone (Android, Chrome)

1. Ouvre **https://finalskate.github.io/cran/** dans Chrome, avec du réseau.
2. Attends une dizaine de secondes sur la page : l'appli se met en cache pour le hors ligne.
3. Menu **⋮** → **Ajouter à l'écran d'accueil** → **Installer**.
4. Ferme Chrome et ouvre **Cran** depuis son icône.
5. Va dans **Réglages** et vérifie :
   - **Stockage : Protégé**. Android ne pourra pas effacer tes données. Si tu vois « Non protégé », appuie sur **Réessayer**. Chrome accorde généralement la protection une fois l'appli installée.
   - **Mode avion : Prêt**.

### Vérifier le fonctionnement hors ligne
1. Active le **mode avion**.
2. Ferme complètement Cran (balaye-la depuis la liste des applis récentes).
3. Rouvre Cran depuis son icône : elle doit s'afficher normalement.
4. Désactive le mode avion.

### Mises à jour
Quand une nouvelle version est publiée, un bandeau **« Nouvelle version disponible »** apparaît.
Rien n'est appliqué sans ton accord : appuie sur **Mettre à jour** quand tu n'es pas en pleine séance.

---

## 2. Développer sur le PC

Prérequis : **Node.js 22.12 ou plus récent** (`node -v` pour vérifier).

> ⚠️ Le projet doit rester **hors de OneDrive** (par exemple dans un dossier `dev\cran`) : la synchronisation des
> milliers de fichiers de `node_modules` ralentit tout et verrouille des fichiers pendant les builds.

Installer les dépendances (à refaire après chaque changement de `package-lock.json`) :

```sh
npm ci
```

Lancer l'appli en développement. Le service worker est désactivé dans ce mode, pour éviter les caches fantômes :

```sh
npm run dev
```

Lancer les tests (logique métier et base de données) :

```sh
npm test
```

> Le build vérifie aussi les types TypeScript : une erreur de type bloque le build, et donc le déploiement.

Test de bout en bout dans un vrai Chrome, en taille téléphone. Il déroule une séance complète, reprise comprise, et
écrit des captures dans `.e2e/`.

> Il faut Google Chrome installé et un `npm run build` à jour : le test sert le dossier `dist/`.
> Pour simuler un petit écran : `E2E_SIZE=360x640 npm run e2e`.

```sh
npm run e2e
```

Construire la version de production, puis la servir en local pour tester le service worker (adresse : http://localhost:4173/cran/) :

```sh
npm run build
npm run preview
```

---

## 3. Déployer

Chaque `git push` sur la branche `main` déclenche GitHub Actions (`.github/workflows/deploy.yml`) :
tests, puis build, puis publication sur GitHub Pages. Il faut compter environ deux minutes.

> ⚠️ Si un test ou la vérification de types échoue, **rien n'est publié** : la version en ligne reste la précédente.
> Lance donc `npm test` et `npm run build` avant de pousser.

```sh
git push
```

Suivre le déploiement depuis le terminal :

```sh
gh run watch
```

> Configuration unique, déjà faite à la création du dépôt : GitHub Pages est réglé sur la source **« GitHub Actions »**
> (Settings → Pages). Ne la change pas en « Deploy from a branch », sinon le site ne se met plus à jour.

---

## 4. Organisation du code

```
src/
  domain/   logique métier pure, testée par Vitest (moteur, progression, nutrition…)
  data/     base IndexedDB (Dexie) et ses migrations, réglages, catalogue d'exercices (à venir)
  ui/       écrans, composants, thème « Aube »
  pwa/      enregistrement du service worker, mises à jour
public/     icône source (les PNG sont générés au build)
docs/       documentation (docs/private/ est local et n'est jamais versionné)
```

- **Base de données** : le schéma est versionné dans `src/data/db.ts`. Chaque changement de schéma ajoute une
  nouvelle version, avec une migration si besoin. Les règles sont en tête du fichier.
- **Icônes** : une seule source, `public/icon.svg`. Toutes les tailles sont générées au build (`pwa-assets.config.ts`).
- **Dépendances** : versions exactes, publiées depuis au moins deux semaines au moment de leur ajout.

## 5. Confidentialité

Le dépôt est public, mais il ne contient que du code. Aucune donnée personnelle n'y figure : le profil se saisit dans
l'appli et reste sur le téléphone. Une sauvegarde manuelle (export JSON) arrivera dans un prochain jalon.
