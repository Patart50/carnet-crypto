# Journal des décisions — carnet-crypto

Chaque décision est numérotée et ne se réécrit pas : on en ajoute une nouvelle qui remplace l'ancienne. Statut : ✅ actée · ⚠️ à vérifier · 🔁 remplacée. Dans les échanges entre projets, préfixer : « carnet D-003 ».

## D-001 ✅ Nom, dépôt, licence, outil séparé
`carnet-crypto`, dépôt `Patart50/carnet-crypto`, AGPL-3.0 (choix d'Arnaud, 5 oct. 2026). Outil séparé de pmpa-crypto : un carnet de trades n'est pas un calcul fiscal. Le suivi du staking fera l'objet d'un autre outil, et une version connectée (Python, adresses on-chain via une clé Alchemy de l'utilisateur) d'un autre dépôt.

## D-002 ✅ Les événements sont la source de vérité
Une position est une suite d'événements (ouverture, ajout, réduction, clôture). PMP, quantité, P&L, frais et durée sont recalculés en rejouant la suite : l'édition d'un événement passé reste cohérente.

## D-003 ✅ Interrupteur PMP brut / frais inclus
Chaque événement stocke le prix d'exécution et les frais séparément. Un réglage choisit le PMP affiché : brut (par défaut, comme les plateformes) ou frais inclus (comme pmpa D-009, renfort D-002). Le P&L net et le break-even ne dépendent pas de ce réglage : ils incluent toujours les frais. Les plateformes affichent des conventions différentes : le choix est laissé à l'utilisateur (choix d'Arnaud).

## D-004 ✅ Stockage IndexedDB
Un journal grossit sans limite ; IndexedDB plutôt que localStorage (capacité, écritures atomiques). Sauvegarde JSON versionnée, comme pmpa D-016.

## D-005 ✅ Réductions et garde-fous
Une réduction ne modifie pas le PMP (coût moyen pondéré, pmpa D-014), en Long comme en Short. Réduire au-delà de la quantité détenue est refusé : pas de retournement automatique. Rouvrir après une clôture totale crée une nouvelle position.

## D-006 ✅ Statistiques nettes de frais, winrate jamais seul
Une position fermée est gagnante si son P&L net total est strictement positif ; un gain brut effacé par les frais compte comme une perte. Le winrate est toujours affiché avec le gain moyen, la perte moyenne, le profit factor et l'espérance : un winrate élevé peut cacher une stratégie perdante (choix d'Arnaud : le winrate réel doit inclure les pertes).

## D-007 ✅ Devise de cotation par position
Chaque position porte sa devise de cotation (EUR, USDT, USDC…). Le résumé donne un total par devise, sans conversion ni appel réseau. Conversion en euros envisageable plus tard, en opt-in.

## D-008 ✅ Simulateur de renfort intégré
Version allégée de renfort-crypto sur une position ouverte, Long et Short, au cours ou à un prix limite, avec une ligne d'exposition (principe de renfort D-006) et un lien vers renfort-crypto prérempli. Formules partagées avec renfort via le paquet commun, étendues au Short.

## D-009 ✅ Aucun calcul d'impôt
Une vente au comptant contre euros est une cession imposable, mais la plus-value se calcule sur l'ensemble du portefeuille (art. 150 VH bis) : renvoi vers pmpa-crypto. Levier, liquidation et funding hors périmètre v1.0.

## D-010 ✅ Paquet commun avant le premier code
Quatrième outil du programme : le code commun est extrait en paquet (J0) avant J1, carnet-crypto en est le premier utilisateur (choix d'Arnaud). Forme du paquet à trancher dans PROGRAMME.

## D-011 ✅ Conventions de calcul du moteur (J1)
- Frais en montant absolu, dans la devise de cotation, par événement.
- Frais d'entrée imputés aux sorties au prorata de la quantité sortie : le P&L net d'une réduction déduit ses frais de sortie et cette quote-part.
- Une réduction de toute la quantité clôt la position (équivaut à une clôture).
- Break-even : prix de sortie de toute la quantité restante qui annule le P&L net de la position, réalisé des réductions compris (comme le prix d'équilibre de pmpa D-014). Frais de sortie estimés par un taux facultatif, aussi utilisé pour le latent.
- Événements triés par date puis ordre de saisie ; le calcul s'arrête au premier événement invalide et le signale (prix ≤ 0, quantité ≤ 0, frais < 0, date illisible, premier événement autre qu'une ouverture, deuxième ouverture, événement après la clôture, réduction au-delà du détenu).
- Une position fermée à P&L net nul compte comme perdante : rien n'a été gagné.
- Rendement en % du plus grand capital engagé, disponible pour classer les positions en option.

## D-012 ✅ Simulateur : rejouer l'ajout hypothétique
L'ajout simulé est ajouté comme un événement et rejoué par `computePosition` : PMP brut et frais inclus, break-even et capital engagé sont ceux qu'on obtiendrait en saisissant l'ajout. Frais saisis en taux r du montant (Long : prix effectif p(1 + r) ; Short : p(1 − r)). Les formules de commun-crypto (commun D-008) prenant les frais Long sur le montant décaissé, on leur passe f = r ÷ (1 + r) en Long, f = r en Short ; le test vérifie que le PMP rejoué tombe exactement sur la cible. En mode brut, la cible porte sur le PMP brut et les frais n'entrent pas dans la formule.

## D-013 ✅ Code commun : commun-crypto v1.1.0
Dépendance git épinglée (`git+https://github.com/Patart50/commun-crypto.git#v1.1.0`, commun D-009) : décimal, formatage (montants en USDT), stockage local des réglages (préfixe `carnet-crypto:`), thème, soutien, formules Long/Short, service worker. Aucun code copié.

## D-014 ✅ Réglages et cours dans le localStorage
Les positions vont dans IndexedDB (D-004) ; les réglages (thème, prix moyen affiché, frais de sortie estimés, autorisation Binance) et les cours saisis ou récupérés, petits et indépendants des positions, restent dans le localStorage via `commun-crypto/storage` (préfixe `carnet-crypto:`). Un cours enregistré garde son chemin Binance et sa date.

## D-015 ✅ Import : fusion ou remplacement
Un fichier de sauvegarde est d'abord lu et validé, sans rien modifier ; l'aperçu indique le nombre de positions et celles à corriger. « Fusionner » remplace les positions de même identifiant et garde les autres ; « Remplacer tout » efface d'abord le carnet (confirmation). Les réglages du fichier (prix moyen affiché, frais de sortie) sont repris.

## D-016 ✅ Cours dans la devise de la position
La table Binance est lue directement dans la devise de cotation : paire directe (BTCUSDT), paire inverse, EUR par les chemins de pmpa (commun D-006), USDT ↔ USDC par USDCUSDT, repli par BTC. Pas de conversion vers l'euro pour une position en USDT : le carnet raisonne dans la devise du trade (D-007).

## D-017 ✅ Écriture validée par le moteur
L'interface ne contourne jamais le moteur : création, ajout, modification ou suppression d'un événement construisent la nouvelle suite, la rejouent, et l'enregistrent seulement si elle est valide ; sinon le message du moteur s'affiche sous le formulaire (ex. « Quantité supérieure à la quantité détenue (0,07). »). Supprimer l'ouverture d'une position qui a d'autres événements est donc refusé ; supprimer le seul événement supprime la position, après confirmation. Une position importée invalide reste affichée avec « À corriger » et ses événements bloqués.

## D-018 ✅ Résultats par émotion à l'ouverture
Le résumé regroupe les positions fermées par émotion notée à l'ouverture, par devise : nombre, winrate, réalisé net, de la plus coûteuse à la plus rentable. C'est la raison d'être du champ émotion : voir si le FOMO ou la revanche coûtent plus cher. Une position sans émotion est classée « Non renseignée ».

## D-019 ✅ Simulateur : lien vers renfort-crypto limité au Long en euros
renfort-crypto raisonne en euros et en Long. Le lien « Analyse complète » n'apparaît que pour une position Long cotée en EUR ; il transmet quantité, prix moyen frais inclus (convention de renfort D-002), cours, frais et cible par le fragment `#partage?…` (renfort D-014), jamais envoyé au serveur.

