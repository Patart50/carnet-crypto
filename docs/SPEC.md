# Spécification — carnet-crypto v1.1

Carnet de trades crypto, 100 % local, en français. Projet frère de [pmpa-crypto](https://github.com/Patart50/pmpa-crypto), [dca-crypto](https://github.com/Patart50/dca-crypto) et [renfort-crypto](https://github.com/Patart50/renfort-crypto). Toute convention de calcul est consignée dans [DECISIONS.md](DECISIONS.md).

Description du dépôt (337 caractères) : « Carnet de trades crypto 100 % local, en français. Suivez vos positions Long et Short : ouverture, renforts, clôtures partielles et totales. Prix moyen pondéré, P&L réalisé et latent nets de frais, winrate, profit factor, simulateur de renfort, notes et émotions. Aucune donnée envoyée, hors ligne, thème clair/sombre. Open source AGPL-3.0. »

## 1. Objectif

Suivre proprement chaque position de son ouverture à sa clôture : prix moyen, quantité, P&L réalisé et latent, frais, durée, notes et émotions ; en tirer des statistiques honnêtes (nettes de frais). L'outil **ne calcule aucun impôt** (D-009).

## 2. Modèle : une position = une suite d'événements (D-002)

| Événement | Champs | Effet |
|---|---|---|
| Ouverture | crypto, devise de cotation, sens (Long/Short), quantité, prix, frais, date, note, émotion | crée la position |
| Ajout | quantité, prix, frais, date, note, émotion | recalcule le PMP |
| *(sortie)* | funding et intérêts, signé (payé +, reçu −), facultatif | déduit du P&L net (D-022) |
| Réduction | quantité (< quantité détenue), prix, frais, date, note, émotion | P&L réalisé sur la partie, PMP inchangé |
| Clôture | prix, frais, date, note, émotion | réduction de toute la quantité, position fermée |

Toutes les valeurs dérivées sont recalculées en rejouant les événements : modifier ou supprimer un événement passé reste cohérent. Une suite invalide (quantité négative, événement après la clôture) est refusée avec un message.

Garde-fous (D-005) : réduire au-delà de la quantité détenue est refusé (pas de retournement Long → Short) ; rouvrir après une clôture crée une nouvelle position.

Frais : saisis en devise de cotation (D-011). Un frais payé en BNB ou dans l'actif se convertit à la main en devise de cotation en v1.0.

Code : `src/lib/core/model.ts` (types), `src/lib/core/position.ts` (`computePosition` : rejoue les événements, renvoie l'état, le fil d'étapes et la première erreur).

## 3. Calculs (D-003, D-004, D-006)

Notations : q quantité, p prix d'exécution, f frais, s = +1 (Long) ou −1 (Short).

| Résultat | Formule |
|---|---|
| PMP brut | Σ(q·p) des entrées ÷ Σq des entrées, au coût moyen courant |
| PMP frais inclus | (Σ(q·p) + s·Σf d'entrée) ÷ Σq ; affiché selon l'interrupteur (D-003) |
| P&L réalisé brut d'une réduction | s × (p_sortie − PMP brut) × q |
| P&L réalisé net | brut − frais de sortie − quote-part des frais d'entrée (au prorata de la quantité sortie) |
| P&L latent net | s × (cours − PMP brut) × q restante − frais d'entrée restants − frais de sortie estimés (taux facultatif, D-011) |
| Break-even | prix de sortie de toute la quantité qui annule le P&L net de la position, réalisé compris (D-011) : Long (coût + frais restants − réalisé) ÷ (q(1 − f_v)), Short (coût − frais restants + réalisé) ÷ (q(1 + f_v)) |
| Frais totaux, durée | somme des frais ; de l'ouverture à la clôture (ou à maintenant) |

Une réduction ne modifie jamais le PMP (coût moyen pondéré, comme pmpa D-014).

## 4. Statistiques (D-006)

Code : `src/lib/core/stats.ts` (`computeStats`).

Sur les positions **fermées**, par devise de cotation, P&L **net de frais** :
- nombre de gagnantes (P&L net > 0) et perdantes (≤ 0) ; un trade gagnant en brut mais perdant après frais est une perte ;
- winrate, toujours accompagné du gain moyen, de la perte moyenne, du **profit factor** (Σ gains ÷ Σ pertes) et de l'**espérance** (P&L net moyen) ;
- meilleure et pire position ;
- P&L réalisé total ; P&L latent des positions ouvertes (si un cours est connu).

## 5. Simulateur de renfort intégré (D-008)

Code : `src/lib/core/simulate.ts`. L'ajout simulé est rejoué par le même moteur (D-012).

Sur une position ouverte : « Simuler un ajout » au cours ou à un prix limite → nouveau PMP, nouvelle quantité, nouveau break-even ; mode « PMP visé » → montant nécessaire, ou « inatteignable » avec le prix limite. Une ligne d'exposition (capital engagé avant / après). Long et Short. Lien « Analyse complète dans renfort-crypto » (fragment `#partage?…`, renfort D-014).

## 6. Prix, stockage, export

- **Cours** (`src/lib/prices/quote.ts`, D-016) : saisi dans la fiche, ou « Mettre à jour les cours » via Binance en opt-in (une requête, la liste publique de tous les cours ; renfort D-013). Cours dans la devise de la position : paire directe, inverse, EUR par les chemins de pmpa, USDT ↔ USDC, repli par BTC. Arrondi comme pmpa D-030 ; chemin affiché sous le champ.
- **Stockage** : positions dans IndexedDB (`src/lib/storage/db.ts`, D-004), repli en mémoire signalé ; réglages et cours dans le localStorage (`commun-crypto/storage`, préfixe `carnet-crypto:`, D-014).
- **Sauvegarde JSON** (`src/lib/storage/backup.ts`, D-015) : `app`, `schemaVersion` 1, positions et réglages ; validation stricte (structure invalide → rien n'est importé), positions incohérentes importées et signalées ; import en fusion (par identifiant) ou en remplacement.
- **Exports pour tableur** (`src/lib/export/csv.ts`) : événements et positions, « ; », virgule décimale, BOM (comme dca D-015).

## 7. Interface (J2)

Navigation par ancre : `#positions` (défaut), `#nouvelle`, `#position/<id>`, `#resume`, `#a-propos`. Focus sur le titre à chaque changement d'écran. État : `src/lib/state/app.svelte.ts` ; toute écriture passe par le moteur, une suite invalide est refusée avec son message (D-017).

- **Accueil** (carnet vide) : présentation, « Ouvrir une position », « Charger un exemple ».
- **Positions** (`PositionList.svelte`) : cartes cliquables (actif/devise, sens, statut, quantité, prix moyen, réalisé net, latent net, durée), filtres statut, sens, crypto, devise, émotion ; « Mettre à jour les cours (Binance) » avec encart de consentement.
- **Ouvrir une position** (`NewPosition.svelte`) : crypto et devise de cotation en listes déroulantes (`Combobox.svelte`, D-023 : liste complète à l'ouverture, filtrée seulement à la frappe, saisie libre ; cryptos mémorisées, puis utilisées, puis les 20 principales), sens, ouverture, note de position.
- **Champs d'un événement** (`EventFields.svelte`) : date et heure, quantité, prix avec « Cours à cette date » (bougie d'une minute Binance après accord, D-024), frais calculés automatiquement depuis les taux d'entrée et de sortie des réglages (D-021, modifiables, « Recalculer »), funding et intérêts à la sortie (D-022), émotion en liste déroulante, note. Champs alignés (D-025).
- **Fiche** (`PositionDetail.svelte`) : chiffres clés (quantité, prix moyen selon le réglage et l'autre en rappel, break-even, latent, réalisé, total, frais, capital engagé max), cours actuel modifiable, Ajouter / Réduire (raccourcis 25-50-75 %) / Clôturer (`EventForm.svelte`), fil des événements avec modification et suppression de chaque événement, événements bloqués par une erreur signalés avec « Corriger », modification et suppression de la position.
- **Simulateur** (`Simulator.svelte`, D-008, D-012) : « Viser un prix moyen » ou « Ajouter une quantité », prix d'achat (cours par défaut) et frais ; quantité, montant, frais, prix moyen, break-even et capital engagé avant → après ; cible atteinte ou inatteignable (prix limite) ; lien « Analyse complète dans renfort-crypto » pour une position Long en euros.
- **Résumé** (`Summary.svelte`) : par devise, réalisé et latent nets, espérance, winrate, profit factor, gain et perte moyens, meilleure et pire position, frais ; avertissement si winrate ≥ 50 % avec espérance négative ; tableau par émotion à l'ouverture (D-018).
- **Réglages et sauvegarde** (`Settings.svelte`) : prix moyen affiché (D-003), frais d'entrée et de sortie par défaut (0,1 %), cryptos mémorisées (retrait), retrait de l'autorisation Binance, export et import JSON (sélecteur qui rouvre le dossier des sauvegardes sur Chrome et Edge, glisser-déposer partout, D-026), exports CSV, effacement.
- **À propos et limites** (`About.svelte`, `#a-propos`, D-020) : ce que fait l'outil, vos données, méthode et formules, limites, avertissement, contribuer, auteur et soutien ; lien en pied de page et sur l'accueil.
- Thème, hors ligne, 375 px sans débordement, lien d'évitement, WCAG 2 AA vérifié avec axe-core.

## 8. Jalons

- **J0** ✅ commun-crypto v1.0.0 puis v1.1.0 (Short).
- **J1** ✅ Squelette, moteur d'événements (Long/Short), calculs, statistiques, simulateur de renfort, tests ; CI et page d'attente avec aperçu du moteur.
- **J2** ✅ Interface complète, IndexedDB, sauvegarde, exports, cours du jour.
- **J3** ✅ v1.0 : À propos et limites, hors ligne vérifié, accessibilité (D-020).

## 9. Hors périmètre v1.0

Levier, prix de liquidation, funding, intérêts d'emprunt ; import depuis une plateforme ; conversion entre devises ; calcul d'impôt ; lien avec pmpa-crypto.
