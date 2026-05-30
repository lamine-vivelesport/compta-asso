export const PCG_ACCOUNTS: Record<string, string> = {
  // Classe 1 - Fonds propres
  '101': 'Fonds associatif',
  '102': 'Fonds associatif avec droit de reprise',
  '106': 'Réserves',
  '1061': 'Réserve légale',
  '1068': 'Autres réserves',
  '110': 'Report à nouveau',
  '119': 'Report à nouveau débiteur',
  '120': 'Résultat de l\'exercice (excédent)',
  '129': 'Résultat de l\'exercice (déficit)',
  '131': 'Subventions d\'équipement',
  '138': 'Autres subventions d\'investissement',
  '145': 'Provisions réglementées',
  '151': 'Provisions pour risques',
  '155': 'Provisions pour impôts',
  '158': 'Autres provisions pour charges',
  '161': 'Emprunts obligataires',
  '164': 'Emprunts auprès d\'établissements de crédit',
  '165': 'Dépôts et cautionnements reçus',
  '168': 'Autres emprunts et dettes assimilées',
  '169': 'Primes de remboursement des obligations',

  // Classe 2 - Immobilisations
  '201': 'Frais d\'établissement',
  '203': 'Frais de recherche et développement',
  '205': 'Concessions, brevets, licences',
  '206': 'Droit au bail',
  '207': 'Fonds commercial',
  '208': 'Autres immobilisations incorporelles',
  '211': 'Terrains',
  '212': 'Agencements et aménagements de terrains',
  '213': 'Constructions',
  '214': 'Constructions sur sol d\'autrui',
  '215': 'Installations techniques, matériel et outillage',
  '218': 'Autres immobilisations corporelles',
  '231': 'Immobilisations corporelles en cours',
  '232': 'Immobilisations incorporelles en cours',
  '241': 'Avances sur commandes d\'immobilisations incorporelles',
  '242': 'Avances sur commandes d\'immobilisations corporelles',
  '261': 'Titres de participation',
  '265': 'Parts dans les entreprises liées',
  '271': 'Titres immobilisés autres que titres de participation',
  '274': 'Prêts',
  '275': 'Dépôts et cautionnements versés',
  '281': 'Amortissements des immobilisations incorporelles',
  '282': 'Amortissements des constructions',
  '2815': 'Amortissements installations techniques',
  '2818': 'Amortissements autres immobilisations corporelles',
  '285': 'Amortissements des immobilisations financières',

  // Classe 3 - Stocks
  '310': 'Matières premières',
  '321': 'Matières consommables',
  '322': 'Fournitures consommables',
  '326': 'Emballages',
  '331': 'Produits en cours',
  '335': 'Travaux en cours',
  '340': 'Produits intermédiaires',
  '350': 'Stocks de produits finis',
  '370': 'Stocks de marchandises',
  '380': 'Stocks en voie d\'acheminement',

  // Classe 4 - Tiers
  '401': 'Fournisseurs',
  '403': 'Fournisseurs - Effets à payer',
  '404': 'Fournisseurs d\'immobilisations',
  '405': 'Fournisseurs d\'immobilisations - Effets à payer',
  '408': 'Fournisseurs - Factures non parvenues',
  '409': 'Fournisseurs débiteurs',
  '411': 'Membres et Adhérents',
  '413': 'Clients - Effets à recevoir',
  '416': 'Clients douteux ou litigieux',
  '418': 'Clients - Produits non encore facturés',
  '419': 'Clients créditeurs',
  '421': 'Personnel - Rémunérations dues',
  '422': 'Comités d\'entreprise',
  '423': 'Participation des salariés',
  '424': 'Participation aux résultats',
  '425': 'Personnel - Avances et acomptes',
  '426': 'Personnel - Dépôts',
  '427': 'Personnel - Oppositions',
  '428': 'Personnel - Charges à payer et produits à recevoir',
  '431': 'URSSAF - Sécurité sociale',
  '437': 'Autres organismes sociaux',
  '438': 'Organismes sociaux - Charges à payer',
  '441': 'État - Impôts et taxes',
  '442': 'État - Impôts et versements assimilés',
  '443': 'État - Opérations particulières',
  '444': 'État - Impôts sur les bénéfices',
  '445': 'État - TVA',
  '4452': 'TVA due intracommunautaire',
  '4455': 'TVA à décaisser',
  '4456': 'TVA déductible',
  '4457': 'TVA collectée',
  '4458': 'TVA à régulariser',
  '447': 'Autres impôts, taxes et versements assimilés',
  '448': 'État - Charges à payer et produits à recevoir',
  '451': 'Association mère',
  '455': 'Associés - Comptes courants',
  '456': 'Associés - Opérations sur capital',
  '457': 'Associés - Dividendes à payer',
  '458': 'Associés - Opérations faites en commun',
  '462': 'Créances sur cessions d\'immobilisations',
  '464': 'Dettes sur acquisitions de valeurs mobilières',
  '465': 'Créances sur cessions de valeurs mobilières',
  '467': 'Autres comptes débiteurs ou créditeurs',
  '468': 'Divers - Charges à payer et produits à recevoir',
  '481': 'Charges à répartir sur plusieurs exercices',
  '486': 'Charges constatées d\'avance',
  '487': 'Produits constatés d\'avance',
  '491': 'Provisions pour dépréciation des comptes de membres',
  '496': 'Provisions pour dépréciation des comptes de débiteurs',

  // Classe 5 - Trésorerie
  '501': 'Valeurs mobilières de placement',
  '503': 'Actions',
  '506': 'Obligations',
  '512': 'Banque',
  '514': 'Chèques postaux - CCP',
  '515': 'Caisses des établissements à l\'étranger',
  '516': 'Titres à court terme',
  '517': 'Autres organismes financiers',
  '519': 'Concours bancaires courants',
  '530': 'Caisse',
  '531': 'Caisse en devises',
  '540': 'Régies d\'avances et accréditifs',
  '580': 'Virements internes',

  // Classe 6 - Charges
  '600': 'Achats de matières premières',
  '601': 'Matières premières',
  '602': 'Emballages',
  '603': 'Variation des stocks',
  '604': 'Achats d\'études et prestations de services',
  '605': 'Achats de matériel, équipements et travaux',
  '606': 'Fournitures non stockées',
  '607': 'Achats de marchandises',
  '608': 'Frais accessoires sur achats',
  '609': 'Rabais, remises et ristournes obtenus sur achats',
  '611': 'Sous-traitance générale',
  '612': 'Crédit-bail',
  '613': 'Locations',
  '614': 'Charges locatives et de copropriété',
  '615': 'Entretien et réparations',
  '616': 'Primes d\'assurances',
  '617': 'Études et recherches',
  '618': 'Divers',
  '619': 'Rabais, remises et ristournes obtenus sur services extérieurs',
  '621': 'Personnel extérieur à l\'association',
  '622': 'Rémunérations d\'intermédiaires et honoraires',
  '623': 'Publicité, publications, relations publiques',
  '624': 'Transports de biens et transports collectifs du personnel',
  '625': 'Déplacements, missions et réceptions',
  '626': 'Frais postaux et de télécommunications',
  '627': 'Services bancaires et assimilés',
  '628': 'Divers autres services extérieurs',
  '629': 'Rabais, remises et ristournes obtenus sur autres services extérieurs',
  '631': 'Impôts, taxes et versements assimilés sur rémunérations',
  '632': 'Impôts et taxes non récupérables sur chiffre d\'affaires',
  '633': 'Impôts sur les rémunérations',
  '635': 'Autres impôts, taxes et versements assimilés',
  '637': 'Autres impôts, taxes et versements assimilés',
  '641': 'Rémunérations du personnel',
  '642': 'Rémunérations des dirigeants bénévoles',
  '645': 'Charges de sécurité sociale et de prévoyance',
  '646': 'Cotisations sociales patronales',
  '647': 'Charges retraite complémentaire',
  '648': 'Autres charges sociales',
  '649': 'Remboursements de charges sociales',
  '651': 'Redevances pour concessions, brevets, licences',
  '654': 'Pertes sur créances irrécouvrables',
  '655': 'Quotes-parts de résultat sur opérations faites en commun',
  '658': 'Charges diverses de gestion courante',
  '661': 'Charges d\'intérêts',
  '664': 'Revenus des valeurs mobilières de placement',
  '665': 'Escomptes accordés',
  '666': 'Pertes de change',
  '667': 'Charges nettes sur cessions de VMP',
  '668': 'Autres charges financières',
  '671': 'Charges exceptionnelles sur opérations de gestion',
  '672': 'Charges sur exercices antérieurs',
  '675': 'Valeurs comptables des éléments d\'actif cédés',
  '678': 'Autres charges exceptionnelles',
  '681': 'Dotations aux amortissements - charges d\'exploitation',
  '682': 'Dotations aux provisions - charges d\'exploitation',
  '686': 'Dotations aux amortissements - charges financières',
  '687': 'Dotations aux amortissements - charges exceptionnelles',
  '690': 'Impôts sur les bénéfices',

  // Classe 7 - Produits
  '701': 'Ventes de produits finis',
  '702': 'Ventes de produits intermédiaires',
  '703': 'Ventes de produits résiduels',
  '704': 'Travaux',
  '705': 'Études',
  '706': 'Prestations de services',
  '707': 'Ventes de marchandises',
  '708': 'Produits des activités annexes',
  '709': 'Rabais, remises et ristournes accordés',
  '710': 'Variation des stocks de produits finis et en cours',
  '720': 'Production immobilisée',
  '731': 'Variation des stocks de marchandises',
  '740': 'Subventions d\'exploitation',
  '741': 'Subventions de l\'État',
  '742': 'Subventions des collectivités territoriales',
  '743': 'Subventions des organismes publics',
  '744': 'Subventions d\'investissement virées au compte de résultat',
  '745': 'Autres subventions reçues',
  '746': 'Subventions de fonctionnement',
  '748': 'Autres subventions',
  '750': 'Cotisations des membres',
  '751': 'Dons manuels',
  '752': 'Legs et donations',
  '753': 'Mécénat',
  '754': 'Ressources liées à la collecte de fonds',
  '755': 'Ressources liées aux activités',
  '756': 'Contributions volontaires valorisées',
  '757': 'Contributions en nature',
  '758': 'Autres produits de gestion courante',
  '759': 'Transferts de charges',
  '761': 'Produits de participations',
  '762': 'Produits des autres immobilisations financières',
  '763': 'Revenus des autres créances',
  '764': 'Revenus des valeurs mobilières de placement',
  '765': 'Escomptes obtenus',
  '766': 'Gains de change',
  '767': 'Produits nets sur cessions de VMP',
  '768': 'Autres produits financiers',
  '771': 'Produits exceptionnels sur opérations de gestion',
  '772': 'Produits sur exercices antérieurs',
  '775': 'Produits des cessions d\'éléments d\'actif',
  '777': 'Quote-part des subventions d\'investissement virée au résultat',
  '778': 'Autres produits exceptionnels',
  '781': 'Reprises sur amortissements et provisions - exploitation',
  '786': 'Reprises sur provisions - charges financières',
  '787': 'Reprises sur provisions - charges exceptionnelles',
  '791': 'Transferts de charges d\'exploitation',
  '796': 'Transferts de charges financières',
  '797': 'Transferts de charges exceptionnelles',
}

/**
 * Returns the best label for a PCG account code.
 * Strategy:
 *   1. Exact match (ex: '641' → found)
 *   2. Strip progressively (ex: '641000' → '64100' → '6410' → '641' → found)
 *   3. Prefix search (ex: '74' → finds '740' → "Subventions d'exploitation")
 *   4. Fallback: return the code itself
 */
export function getPcgLabel(compte: string): string {
  if (!compte) return compte

  // 1. Exact match
  if (PCG_ACCOUNTS[compte]) return PCG_ACCOUNTS[compte]

  // 2. Strip trailing characters progressively
  for (let len = compte.length - 1; len >= 2; len--) {
    const prefix = compte.slice(0, len)
    if (PCG_ACCOUNTS[prefix]) return PCG_ACCOUNTS[prefix]
  }

  // 3. Forward prefix search: find first key that starts with the code
  const keys = Object.keys(PCG_ACCOUNTS)
  const match = keys.find(k => k.startsWith(compte))
  if (match) return PCG_ACCOUNTS[match]

  return compte
}

/**
 * Searches through PCG accounts and returns top 5 matches based on text similarity
 */
export function detectAccount(text: string): { numero: string; libelle: string }[] {
  if (!text || text.trim().length < 2) return []

  const query = text.trim().toLowerCase()

  // Score each account
  const scored = Object.entries(PCG_ACCOUNTS).map(([numero, libelle]) => {
    const labelLower = libelle.toLowerCase()
    const numLower = numero.toLowerCase()
    let score = 0

    // Exact number match
    if (numLower === query) score += 100
    // Number starts with query
    else if (numLower.startsWith(query)) score += 80
    // Label exact match
    else if (labelLower === query) score += 90
    // Label starts with query
    else if (labelLower.startsWith(query)) score += 60
    // Number contains query
    else if (numLower.includes(query)) score += 40
    // Label contains query word
    else {
      const queryWords = query.split(/\s+/)
      for (const word of queryWords) {
        if (word.length > 2 && labelLower.includes(word)) {
          score += 20
        }
      }
    }

    return { numero, libelle, score }
  })

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ numero, libelle }) => ({ numero, libelle }))
}
