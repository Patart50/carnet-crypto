# carnet-crypto

Carnet de trades crypto **100 % local**, en français. Suivez vos positions Long et Short : ouverture, renforts, clôtures partielles et totales. Prix moyen pondéré, P&L réalisé et latent **nets de frais**, winrate avec profit factor et espérance, simulateur de renfort, notes et émotions. Aucune donnée envoyée, hors ligne, thème clair/sombre.

Site : https://patart50.github.io/carnet-crypto/ (en construction : le moteur est prêt, l'interface arrive).

## Principes

- **Vos données restent chez vous** : aucun compte, aucun serveur, aucune donnée envoyée.
- **Statistiques honnêtes** : un gain brut effacé par les frais compte comme une perte, et le winrate n'est jamais affiché seul.
- **Une devise de cotation par position** (EUR, USDT, USDC…) : les totaux sont donnés par devise, jamais additionnés entre devises.
- **Pas de calcul d'impôt** : la plus-value imposable se calcule sur l'ensemble du portefeuille (art. 150 VH bis), avec [pmpa-crypto](https://patart50.github.io/pmpa-crypto/).

Spécification : [docs/SPEC.md](docs/SPEC.md). Décisions : [docs/DECISIONS.md](docs/DECISIONS.md).

## Développement

```sh
npm install
npm run dev     # serveur de développement
npm run check   # types
npm test        # tests (Vitest)
npm run build   # site statique dans dist/
```

Stack : Svelte 5, Vite, TypeScript, decimal.js. Code commun du programme : [commun-crypto](https://github.com/Patart50/commun-crypto).

## Auteur et soutien

Créé par [Arnaud (Patart50)](https://github.com/Patart50). L'outil est gratuit, sans publicité ni compte, et le restera. Pour le soutenir : [GitHub Sponsors](https://github.com/sponsors/Patart50), ou en crypto depuis la fenêtre « Soutenir le projet » en pied de page du site.

## Licence

[AGPL-3.0](LICENSE).
