# Consignes pour Claude Code — projet « Cran »

**Au démarrage (et après chaque `/clear`)** : lis d'abord `docs/private/SUIVI.md` (état d'avancement, retours en attente, questions à poser, pièges connus), puis `docs/private/SPEC.md` (le besoin complet), et respecte ses principes (§2).
`docs/private/` est une jonction vers le dossier OneDrive privé du projet : elle est ignorée par git et ne doit jamais être versionnée.

**Tenir `docs/private/SUIVI.md` à jour** à chaque fin de jalon, après chaque retour de ma part, et avant que je fasse un `/clear` (je le fais souvent).

## Façon de travailler
- **Par jalons** (SPEC §5). À la fin de chaque jalon : résumé de ce qui a été fait, de ce qui reste et des choix faits, puis **attendre ma validation** avant de passer au suivant.
- Limiter les allers-retours : poser toutes les questions bloquantes **en début de jalon**, en une seule fois.
- **Livraison = delta** : ne présenter que les fichiers modifiés ou ajoutés, jamais tout le projet.
- **Me corriger et proposer** : si un point de la spec est discutable ou améliorable, le dire et argumenter. Viser le meilleur (performance, UX soignée), s'inspirer de l'existant pour l'améliorer.

## Code
- Code **bien documenté et commenté** : je le relis. Commentaires et docs **en français**, identifiants en anglais.
- Logique métier en **fonctions pures** dans `src/domain/`, couverte par **Vitest**.
- Le catalogue d'exercices est une **donnée** éditable, pas du code.
- Schéma IndexedDB **versionné**, chaque changement passe par une migration (`src/data/db.ts`).
- Pas de dépendance lourde sans justification. Versions figées, publiées depuis au moins deux semaines (`node scripts/pick-versions.mjs <paquets>`).
- Avant de livrer : `npm test`, `npm run build`, `npm run e2e` (parcours complet dans Chrome, captures dans `.e2e/` à regarder).

## Confidentialité (dépôt public)
- **Aucune donnée personnelle** dans le code, les commentaires, les tests, les commits ou le README : mensurations, santé, famille, contexte professionnel, lieux, dates de départ. Les valeurs personnelles se saisissent dans l'appli et restent sur le téléphone.
- Ne jamais ajouter `docs/private/` à git.

## Procédures (README, déploiement, commandes)
- Dans toute procédure pas à pas, placer les **avertissements et conseils AVANT la commande** qu'ils concernent, jamais après : j'exécute au fil de la lecture.
