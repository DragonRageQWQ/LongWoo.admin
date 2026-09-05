/**
 * Français (fr) : dictionnaire de l’extracteur de couleurs (/sampler)
 * Clés strictement identiques à celles de zh-sampler.ts (103 clés, ni plus ni moins) ;
 * les modèles {token} sont repris tels quels et injectés dynamiquement par fill().
 * Termes conformes au référentiel de traduction LW-I18N (2026-09-04) :
 * tissu de fourrure (faux fur) (毛布), longueur de la fourrure (毛长),
 * extraction de couleur (取色), couleur de référence Pantone (潘通参考色), Δ (écart de couleur),
 * base de données (数据库), bibliothèque (色库), fournisseur (商家).
 * Choix rédactionnels :
 *  - vouvoiement systématique (vous), consignes à l’impératif (« cliquez », « appuyez longuement »…) ;
 *  - apostrophes typographiques U+2019 (’) dans toutes les valeurs, jamais d’apostrophe ASCII,
 *    afin de ne pas casser les chaînes délimitées par des guillemets simples ;
 *  - guillemets français « » pour les citations et étiquettes d’autorisation ;
 *  - marques, codes et unités inchangés : LongWoo, Pantone, Sampler, Top 3, jpg / png / webp / gif,
 *    Δ, px, ×, ainsi que « Sign up » conservé tel quel ;
 *  - nombres inchangés (0.030, 100 %, ≤{max}) ; découpage français en « · » aligné sur EN/ZH.
 */
export const FR_SAMPLER: Record<string, string> = {
  // ===== Niveau page (serveur, sampler/page.tsx) =====
  'sampler.page.title': 'Extracteur de couleurs — image & tissus de fourrure',
  'sampler.page.backHome': 'Retour à l’accueil',
  'sampler.metaTitle': 'Extracteur de couleurs pour tissus de fourrure | LongWoo Studio',
  'sampler.metaDesc':
    'Importez une planche de personnage pour extraire les couleurs des pixels : elles sont automatiquement rapprochées des couleurs de référence Pantone et de la bibliothèque de tissus de fourrure (faux fur), afin de prévisualiser rapidement vos associations de tissus.',

  // ===== Astuce du haut / barre d’outils =====
  'sampler.hint.clickGuide':
    'Cliquez pour ajouter un point (≤{max}) · maintenez enfoncé pour ouvrir la loupe de pixels · cliquez sur un point déjà posé pour le supprimer',

  // ===== Bouton base de données =====
  'sampler.db.button': 'Base de données',
  'sampler.db.all': 'Tout',
  'sampler.db.custom': 'Personnalisé',
  'sampler.db.loadingSummary': 'Chargement de la base de données…',
  'sampler.db.summary':
    'Base de données · {pantone} références Pantone · {vendor} séries de tissus ({on} activées) : {detail}',
  'sampler.db.kindSummary': '{kind} : {on}/{total} activées',
  'sampler.db.summarySep': ', ',
  'sampler.db.mobileTitle': 'Filtre de la base de données',
  'sampler.db.closePanel': 'Fermer le panneau de la base de données',

  // ===== Panneau Bibliothèque Pantone =====
  'sampler.pantone.title': 'Bibliothèque Pantone',
  'sampler.pantone.sub': 'Bibliothèque standard officielle · {n} références · toujours incluse',

  // ===== Panneau Bibliothèque de tissus de fourrure =====
  'sampler.fabricLib.label': 'Bibliothèque de tissus de fourrure',
  'sampler.fabricLib.kindPrefix': 'Type · {kind}',
  'sampler.fabricLib.vendorOffTitle': 'Cliquez pour activer cette série',
  'sampler.fabricLib.vendorOnTitle': 'Cliquez pour désactiver cette série',
  'sampler.fabricLib.colorCount': '{count} couleurs',
  'sampler.fabricLib.moreKinds': 'Autres types (non activés pour le moment)',
  'sampler.fabricLib.notImported': 'Non importé',
  'sampler.fabricLib.panelNote':
    'Les fournisseurs de tissus de fourrure (faux fur) désactivés sont exclus des résultats de l’extraction de couleurs : gardez au moins un fournisseur de la bibliothèque activé.',

  // ===== Import / glisser-déposer =====
  'sampler.upload.replace': 'Remplacer l’image',
  'sampler.upload.new': 'Importer une image',
  'sampler.drop.title': 'Glissez une image ici ou cliquez pour en choisir une',
  'sampler.drop.sub': 'Traitement local — rien n’est envoyé sur un serveur · formats pris en charge : jpg / png / webp / gif',
  'sampler.img.sourceAlt': 'Image source pour l’extraction de couleurs',

  // ===== Loupe / zoom / barre d’état =====
  'sampler.loupe.release': 'Relâchez pour extraire la couleur',
  'sampler.loupe.press': 'Appuyez longuement pour extraire la couleur…',
  'sampler.statusBar.pressLocked': 'Pixel verrouillé — déplacez la loupe pour la positionner, puis relâchez pour extraire la couleur',
  'sampler.statusBar.pressMove':
    'Maintenez la loupe et faites-la glisser ; continuez d’appuyer pour verrouiller, puis relâchez pour extraire…',
  'sampler.zoom.restore': 'Cliquez pour revenir à 100 %',
  'sampler.statusBar.pointsSelected': '{count} / {max} points sélectionnés',
  'sampler.statusBar.waiting': 'En attente de l’import d’une image',

  // ===== Paramètres à droite =====
  'sampler.params.title': 'Sampler · paramètres de l’extraction de couleurs',
  'sampler.params.clear': 'Tout effacer',
  'sampler.params.emptyNoImage':
    'Les paramètres s’affichent ici une fois l’image importée et une couleur extraite par clic ou appui long',
  'sampler.params.emptyNoPoints':
    'Cliquez ou appuyez longuement sur l’image ci-dessus pour extraire des couleurs (jusqu’à {max} points)',

  // ===== Légende Δ / note de bas de page =====
  'sampler.legend.direct': 'Δ≤0.030 · à utiliser directement',
  'sampler.legend.reference': '0.030<Δ≤0.090 · à titre de référence',
  'sampler.legend.none': 'Δ>0.090 · aucune valeur de référence',
  'sampler.disclaimer':
    'Les couleurs des tissus de fourrure (faux fur) proviennent des cartes de couleurs des fournisseurs (données communautaires ou d’exemple, et non de mesures au spectrophotomètre) ; les correspondances Pantone sont approximatives — vérifiez-les sur la carte de couleurs officielle avant la livraison finale.',

  // ===== Carte d’un point (PointCard) =====
  'sampler.card.deleteAria': 'Supprimer le point {n}',
  'sampler.card.pantoneRef': 'Réf. Pantone ×{n}',
  'sampler.card.expand': 'Détails',
  'sampler.card.collapse': 'Masquer les détails',
  'sampler.card.fabricsTop': 'Top 3 des tissus de fourrure',
  'sampler.card.fabricsLoading': 'Chargement de la bibliothèque de tissus de fourrure…',

  // ===== Ligne tissu / détail =====
  'sampler.fabricRow.collapseTitle': 'Cliquez à nouveau pour replier les détails : {name} ({vendor})',
  'sampler.fabricRow.viewTitle': 'Cliquez pour afficher les détails du tissu de fourrure : {name} ({vendor})',
  'sampler.detail.largeImgFailed': 'L’image n’a pas pu être chargée — l’aperçu agrandi est indisponible',
  'sampler.detail.viewLarge': 'Cliquez pour ouvrir l’aperçu agrandi',
  'sampler.detail.colorFamily': 'Famille de couleurs',
  'sampler.detail.furLength': 'Longueur de la fourrure',
  'sampler.detail.kind': 'Type de tissu de fourrure',
  'sampler.detail.pantone': 'Pantone',
  'sampler.detail.zoomAria': 'Aperçu agrandi de {name} ({vendor})',
  'sampler.detail.closeZoom': 'Fermer l’aperçu agrandi',
  'sampler.detail.overlayHint': 'Cliquez sur le voile pour fermer',

  // ===== Messages d’état (showStatus) =====
  'sampler.status.dbReady':
    'Base de données prête : {pantone} références Pantone · {fabric} couleurs de tissus de fourrure / {vendor} fournisseurs{dataNote} · importez une image puis cliquez ou appuyez longuement pour extraire une couleur',
  'sampler.status.liveData': ' (données réelles)',
  'sampler.status.sampleData': ' (données d’exemple)',
  'sampler.status.imageOnly': 'Seuls les fichiers image sont pris en charge (jpg / png / webp / gif)',
  'sampler.status.imgLoaded':
    'Image chargée · {w} × {h}px · molette ou pincement pour zoomer · cliquez ou appuyez longuement pour extraire une couleur (jusqu’à {max} points)',
  'sampler.status.pointDeleted': 'Point {id} supprimé ({x}, {y})',
  'sampler.status.maxPoints': 'Au maximum {max} points peuvent être sélectionnés — veuillez d’abord en supprimer',
  'sampler.status.pixelAlready': 'Le pixel ({x}, {y}) est déjà sélectionné — veuillez choisir un autre endroit',
  'sampler.status.pointAdded': 'Point {id} sélectionné · pixel ({x}, {y}) · #{hex}',
  'sampler.status.pointRemoved': 'Point {id} supprimé',
  'sampler.status.cleared': 'Tous les points ont été effacés',
  'sampler.status.keepOneVendor': 'Gardez au moins un fournisseur de tissus activé — impossible de tous les désactiver',

  // ===== SamplerDock (dock en haut à droite) =====
  'sampler.switchLangTip': 'Changer de langue',
  'sampler.dock.exportAria': 'Exporter les données',
  'sampler.dock.exportHead': 'Exporter les données',
  'sampler.dock.close': 'Fermer',
  'sampler.dock.pointCount': '{count} pts',
  'sampler.dock.checking': 'Vérification de l’autorisation…',
  'sampler.dock.guestTitle': 'Connectez-vous pour exporter vos données',
  'sampler.dock.guestDesc':
    'Une fois connecté(e), un rôle administrateur avec le tag d’autorisation « Test B » est nécessaire pour exporter vers votre ordinateur',
  'sampler.dock.guestCta': 'Se connecter',
  'sampler.dock.deniedTitle': 'Export non autorisé',
  'sampler.dock.deniedDefault':
    'Ce compte ne dispose pas du tag d’autorisation d’export « Test B » — veuillez contacter un administrateur pour l’obtenir',
  'sampler.dock.checkFailed': 'Échec de la vérification de l’autorisation — veuillez réessayer plus tard',
  'sampler.dock.imgLabel': 'Image · ',
  'sampler.dock.dbLabel': 'Base de données · ',
  'sampler.dock.unnamed': 'Sans titre',
  'sampler.dock.dims': ' ({w} × {h} px)',
  'sampler.dock.dbInfo': '{pantone} références Pantone · {fabric} couleurs de tissus de fourrure / {vendor} fournisseurs',
  'sampler.dock.downloaded': 'Téléchargé',
  'sampler.dock.downloadJson': 'Télécharger le JSON',
  'sampler.dock.copied': 'Copié',
  'sampler.dock.copyText': 'Copier le texte',
  'sampler.dock.emptyHint':
    'Aucune couleur extraite pour le moment — importez une image puis cliquez pour ajouter des points ; vous pourrez ensuite exporter votre palette',
  'sampler.dock.signUp': 'Sign up',
  'sampler.dock.signInSmall': 'Connexion / Inscription',

  // ===== Liste d’export en texte brut (buildExportText) =====
  'sampler.export.title': 'LongWoo · Palette de couleurs de tissus de fourrure',
  'sampler.export.time': 'Généré : {time}',
  'sampler.export.source': 'Image source : {name} ({w} × {h} px)',
  'sampler.export.db':
    'Base de données : {pantone} références Pantone · {fabric} couleurs de tissus de fourrure / {vendor} fournisseurs · {enabled} activés',
  'sampler.export.pantoneLabel': 'Pantone : ',
  'sampler.export.fabricLabel': 'Réf. tissus de fourrure : ',
}
