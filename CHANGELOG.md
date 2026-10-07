# Notes de version

## Non publié

- Aperçu des liens : un lien vers l'outil partagé sur X, Mastodon, Discord ou une messagerie affiche une carte avec titre, description et image (balises Open Graph, image `og.png` 1200×630). Aucun effet sur le fonctionnement ni sur vos données.

## 1.1.0 — Saisie plus rapide

- Champs des formulaires alignés : plus de champs étirés par le texte d'aide de leurs voisins.
- Listes déroulantes pour la crypto, la devise (aussi dans « Modifier ») et l'émotion : elles s'ouvrent complètes et ne se filtrent que lorsque vous tapez. Les cryptos saisies sont mémorisées et proposées en premier, avant les 20 principales.
- « Cours à cette date » : le prix d'exécution est proposé à partir du cours Binance de la minute (avec votre accord), à l'ouverture comme pour les ajouts, réductions et clôtures.
- Frais calculés automatiquement depuis les taux d'entrée et de sortie des réglages (0,1 % par défaut), modifiables.
- Funding et intérêts à la sortie, payés ou reçus : déduits du P&L, affichés à part.
- Sauvegarde : sur Chrome et Edge, l'import rouvre le dossier de la dernière sauvegarde ; glisser-déposer d'un fichier partout.

## 1.0.0 — Première version stable

- Page « À propos et limites » : ce que fait l'outil, vos données, méthode et formules, limites connues, avertissement, contribuer, auteur et soutien.
- Messages en français jusque dans les nombres (« 0,07 »).
- Hors ligne vérifié : après une première visite, le carnet, la page À propos et les polices s'ouvrent sans réseau.
- Accessibilité : WCAG 2 AA vérifié avec axe-core sur tous les écrans, en clair et en sombre, sur bureau et à 375 px.

## 0.2.0 — Interface

- Positions : cartes avec prix moyen, réalisé et latent nets, durée ; filtres statut, sens, crypto, devise, émotion.
- Ouvrir une position, puis ajouter, réduire (raccourcis 25-50-75 %) ou clôturer ; modifier ou supprimer chaque événement ; toute saisie invalide est refusée avec une explication.
- Fiche : fil des événements, prix moyen brut ou frais inclus, break-even, latent au cours saisi ou récupéré sur Binance (avec accord), simulateur de renfort.
- Résumé par devise : espérance, winrate, profit factor, gains et pertes moyens, meilleure et pire position, résultats par émotion à l'ouverture.
- Sauvegarde JSON (export, import en fusion ou remplacement), exports CSV pour tableur ; données dans le navigateur (IndexedDB).

## 0.1.0 — Moteur

- Moteur d'événements : ouverture, ajout, réduction, clôture, en Long et en Short ; PMP brut et frais inclus, P&L réalisé et latent nets de frais, break-even, durée, validation de chaque événement.
- Statistiques par devise de cotation, nettes de frais : winrate avec gain moyen, perte moyenne, profit factor et espérance ; meilleure et pire position.
- Simulateur de renfort : ajout au cours ou à un prix limite, quantité pour atteindre un PMP visé, capital engagé avant et après.
- Page d'attente avec un aperçu du moteur sur une position fictive ; thème clair/sombre, hors ligne, auteur et soutien.
