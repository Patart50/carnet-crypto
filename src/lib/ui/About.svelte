<script lang="ts">
  /**
   * Page « À propos et limites » : ce que fait l'outil, ce qu'il garde et envoie, sa méthode et ses limites.
   * Structure reprise de renfort-crypto (About.svelte).
   */
  import { AUTHOR, SPONSORS_URL } from 'commun-crypto/support';
  import Support from 'commun-crypto/ui/Support.svelte';
  import { SUPPORT_INTRO } from './supportIntro';

  const version = __APP_VERSION__;
  const repo = 'https://github.com/Patart50/carnet-crypto';
</script>

<article class="about" aria-labelledby="about-title">
  <header>
    <h1 id="about-title" tabindex="-1">À propos et limites</h1>
    <p class="muted">carnet-crypto {version} · logiciel libre (AGPL-3.0)</p>
  </header>

  <section>
    <h2>Ce que fait l'outil</h2>
    <ul>
      <li>
        Il tient votre <strong>carnet de trades</strong> : chaque position, Long ou Short, est une suite d'événements (ouverture, ajouts, réductions,
        clôture) avec leur prix, leurs frais, une note et une émotion facultative.
      </li>
      <li>
        Il calcule le <strong>prix moyen pondéré</strong>, la quantité restante, le <strong>P&amp;L réalisé</strong> de chaque réduction et le
        <strong>P&amp;L latent</strong> au cours du jour, <strong>nets de frais</strong>, ainsi que le break-even et la durée de la position.
      </li>
      <li>
        Il résume vos résultats par devise : espérance par trade, winrate, profit factor, gain et perte moyens, meilleure et pire position, et vos résultats
        selon l'émotion notée à l'ouverture.
      </li>
      <li>Il simule un renfort : la quantité à ajouter pour viser un prix moyen, ou l'effet d'un ajout donné, au cours ou à un ordre limite.</li>
    </ul>
  </section>

  <section>
    <h2>Vos données</h2>
    <ul>
      <li>
        Tout est calculé et gardé dans ce navigateur, sur cet appareil (IndexedDB). Pas de compte, pas de serveur, pas de mesure d'audience. L'outil marche
        hors ligne une fois chargé.
      </li>
      <li>
        <strong>Vos données ne sont nulle part ailleurs.</strong> Effacer les données du site, changer de navigateur ou d'appareil, c'est repartir de zéro :
        exportez régulièrement une sauvegarde (menu Réglages), que vous pourrez réimporter.
      </li>
      <li>
        <strong>Une seule exception, avec votre accord :</strong> « Mettre à jour les cours » télécharge la liste publique des cours de Binance. L'outil ne
        transmet ni crypto, ni quantité, ni montant ; il cherche les cours dans la réponse. Binance voit votre adresse IP, comme pour toute page web.
        L'autorisation se retire dans les réglages, et les cours se saisissent aussi à la main.
      </li>
    </ul>
  </section>

  <section>
    <h2>Méthode de calcul</h2>
    <p>Notations : q quantité, p prix d'exécution, s = +1 en Long et −1 en Short. Tous les calculs sont faits en décimal exact, sans arrondi intermédiaire.</p>
    <ul>
      <li>
        <strong>Prix moyen brut</strong> : moyenne des prix d'entrée pondérée par les quantités. <strong>Prix moyen frais inclus</strong> : même calcul, avec
        les frais d'entrée restants ajoutés au coût en Long, retranchés du produit en Short. Le réglage choisit celui qui s'affiche ; le P&amp;L et le
        break-even n'en dépendent pas.
      </li>
      <li><strong>Ajout</strong> : le prix moyen est recalculé. <strong>Réduction</strong> : le prix moyen ne change pas (méthode du coût moyen pondéré).</li>
      <li>
        <strong>P&amp;L réalisé d'une réduction</strong> = s × (prix de sortie − prix moyen brut) × q, moins ses frais de sortie, moins la part des frais d'entrée
        correspondant à la quantité sortie.
      </li>
      <li>
        <strong>P&amp;L latent</strong> = s × (cours − prix moyen brut) × quantité restante, moins les frais d'entrée restants et les frais de sortie estimés
        (réglage, en %).
      </li>
      <li>
        <strong>Break-even</strong> : prix de sortie de toute la quantité restante qui ramène le P&amp;L net de la position à zéro, résultats des réductions
        compris.
      </li>
      <li>
        <strong>Statistiques</strong> : sur les positions fermées, par devise, nettes de frais. Une position est gagnante si son P&amp;L net est strictement
        positif ; un gain brut effacé par les frais est une perte. Profit factor = somme des gains ÷ somme des pertes ; espérance = P&amp;L net moyen.
      </li>
      <li>
        <strong>Simulateur</strong> : l'ajout envisagé est rejoué par le même moteur que vos saisies. Pour viser un prix moyen Y au prix effectif Pe (frais
        compris), quantité = Q × (PMP − Y) ÷ (Y − Pe) ; au-delà du prix limite, la cible est inatteignable.
      </li>
    </ul>
  </section>

  <section>
    <h2>Limites connues</h2>
    <ul>
      <li>
        <strong>Le winrate ne dit pas si vous gagnez.</strong> Beaucoup de petits gains et quelques grosses pertes donnent un winrate flatteur et une espérance
        négative. Lisez l'espérance et le profit factor.
      </li>
      <li>
        <strong>Pas de levier, de funding ni de liquidation</strong> : intérêts d'emprunt, frais de financement des perpétuels et prix de liquidation ne sont pas
        calculés. Saisissez-les comme frais si vous voulez les inclure.
      </li>
      <li><strong>Saisie manuelle</strong> : pas d'import depuis une plateforme ni de connexion par clé d'API.</li>
      <li>
        <strong>Frais dans la devise de cotation</strong> : un frais payé en BNB ou dans la crypto achetée se convertit à la main. <strong>Une devise par
        position</strong> : les totaux ne sont jamais additionnés entre devises (USDT et euros restent séparés).
      </li>
      <li>
        <strong>Cours indicatif</strong> : dernier prix Binance dans la devise de la position (paire directe, sinon via USDT, USDC ou BTC), pas le prix que vous
        obtiendrez sur votre plateforme.
      </li>
      <li>
        <strong>Pas de calcul d'impôt.</strong> En France, vendre une crypto contre des euros est une cession imposable, et la plus-value se calcule sur
        l'ensemble de votre portefeuille (art. 150 VH bis du CGI), pas trade par trade. Pour la déclaration, utilisez
        <a href="https://patart50.github.io/pmpa-crypto/" target="_blank" rel="noopener">pmpa-crypto</a>.
      </li>
    </ul>
  </section>

  <section>
    <h2>Avertissement</h2>
    <p>
      Outil de suivi, à but d'information. Ce n'est ni un conseil en investissement ni une recommandation. Les cryptos sont des actifs très volatils, et le
      trading avec effet de levier peut faire perdre plus que la mise : n'engagez que ce que vous pouvez vous permettre de perdre.
    </p>
  </section>

  <section>
    <h2>Contribuer</h2>
    <p>
      Une erreur de calcul, une idée, une question : <a href={`${repo}/issues`} target="_blank" rel="noopener">ouvrez une discussion sur GitHub</a>. Le code
      source est libre (<a href={`${repo}/blob/main/LICENSE`} target="_blank" rel="noopener">AGPL-3.0</a>).
    </p>
  </section>

  <section>
    <h2>Auteur et soutien</h2>
    <p>
      Créé et maintenu par <a href={AUTHOR.url} target="_blank" rel="noopener author">{AUTHOR.name} ({AUTHOR.handle})</a>, sur son temps libre. L'outil est
      gratuit et le restera. Pour le soutenir : <a href={SPONSORS_URL} target="_blank" rel="noopener">GitHub Sponsors</a>, ou en crypto, <Support intro={SUPPORT_INTRO} />.
    </p>
  </section>

  <p><a href="#positions">← Retour au carnet</a></p>
</article>

<style>
  .about {
    display: grid;
    gap: 1.4rem;
    max-width: 46rem;
  }
  header {
    display: grid;
    gap: 0.3rem;
  }
  h1 {
    font-size: clamp(1.6rem, 3.5vw, 2.1rem);
  }
  h1:focus {
    outline: none;
  }
  h2 {
    font-size: 1.2rem;
    margin-bottom: 0.4rem;
  }
  ul {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.45rem;
  }
  section > p + ul {
    margin-top: 0.5rem;
  }
</style>
