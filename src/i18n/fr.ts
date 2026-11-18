// Tous les textes de l'interface, en français.

export const t = {
  app: {
    name: 'QSL',
    tabTitle: 'QSL — chasse aux stations lointaines',
    tabTitleListening: 'QSL — station inconnue',
    mediaTitle: 'Station inconnue',
  },
  radio: {
    powerOn: 'Allumer le poste',
    searching: 'Recherche d’une station…',
    captured: 'Station captée',
    next: 'Autre station',
    stop: 'Éteindre',
    unreachable: 'Impossible de joindre l’annuaire des stations. Vérifiez votre connexion.',
    noStation: 'Aucune station n’a pu être captée. Réessayez.',
  },
  map: {
    attribution: 'Fond : Natural Earth',
    placePin: 'Cliquez sur la carte pour planter votre punaise.',
    movePin: 'Punaise plantée. Vous pouvez la déplacer, puis envoyer votre rapport.',
  },
  round: {
    submit: 'Envoyer le rapport d’écoute',
    next: 'Manche suivante',
    distance: 'Distance',
    points: 'Points',
    stationWas: 'La station émettait depuis',
  },
  debug: {
    title: 'Banc d’essai — une manche',
    attempts: (n: number) => `${n} flux essayé${n > 1 ? 's' : ''}`,
  },
} as const;
