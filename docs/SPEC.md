# Spécification — carnet-crypto v0.1 (J1)

Carnet de trades crypto, 100 % local, en français. Projet frère de [pmpa-crypto](https://github.com/Patart50/pmpa-crypto), [dca-crypto](https://github.com/Patart50/dca-crypto) et [renfort-crypto](https://github.com/Patart50/renfort-crypto). Toute convention de calcul est consignée dans [DECISIONS.md](DECISIONS.md).

Description du dépôt (337 caractères) : « Carnet de trades crypto 100 % local, en français. Suivez vos positions Long et Short : ouverture, renforts, clôtures partielles et totales. Prix moyen pondéré, P&L réalisé et latent nets de frais, winrate, profit factor, simulateur de renfort, notes et émotions. Aucune donnée envoyée, hors ligne, thème clair/sombre. Open source AGPL-3.0. »

## 1. Objectif

Suivre proprement chaque position de son ouverture à sa clôture : prix moyen, quantité, P&L réalisé et latent, frais, durée, notes et émotions ; en tirer des statistiques honnêtes (nettes de frais). L'outil **ne calcule aucun impôt** (D-009).

## 2. Modèle : une position = une suite d'événements (D-002)

| Événement | Champs | Effet |
|---|---|---|
| Ouverture | crypto, devise de cotation, sens (Long/Short), quantité, prix, frais, date, note, émotion | crée la position |
| Ajout | quantité, prix, frais, date, note, émotion | recalcule le PMP |
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

- Cours courant : saisi, ou Binance en opt-in (renfort D-013 : liste complète des cours, la crypto n'est pas envoyée).
- Stockage IndexedDB, sauvegarde JSON versionnée (`app`, `schemaVersion`), comme pmpa D-016 (D-004).
- Export CSV (« ; », virgule décimale, BOM) des positions et des événements ; export JSON.

## 7. Interface (J2)

- **Positions** : liste ouvertes + fermées, filtres (ouvertes, fermées, Long, Short, crypto, devise, émotion).
- **Fiche position** : chiffres clés, fil des événements, ajout/réduction/clôture, simulateur de renfort.
- **Résumé** : statistiques par devise.
- Émotions : liste proposée (FOMO, peur, discipline, revanche, ennui, conviction…), facultative, modifiable.
- Réglages : interrupteur PMP brut / frais inclus, thème, consentement Binance.
- À propos et limites, auteur et soutien, hors ligne, WCAG 2 AA.

## 8. Jalons

- **J0** ✅ commun-crypto v1.0.0 puis v1.1.0 (Short).
- **J1** ✅ Squelette, moteur d'événements (Long/Short), calculs, statistiques, simulateur de renfort, tests ; CI et page d'attente avec aperçu du moteur.
- **J2** Interface complète.
- **J3** v1.0 : À propos et limites, hors ligne vérifié, accessibilité.

## 9. Hors périmètre v1.0

Levier, prix de liquidation, funding, intérêts d'emprunt ; import depuis une plateforme ; conversion entre devises ; calcul d'impôt ; lien avec pmpa-crypto.
