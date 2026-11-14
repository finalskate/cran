/**
 * Matériel d'une séance (« À préparer », dans l'aperçu) : ce qu'il faut avoir sous la main avant de
 * démarrer, dans l'ordre d'utilisation. Et l'inverse : un matériel « pas sous la main » aujourd'hui
 * retire ce tag du lieu pour cette séance seulement, le moteur refait alors le plan sans lui.
 * Tapis de sol (14/11) : demandé pour les exercices au sol ; sans tapis ici, une serviette pliée.
 * Fonctions pures.
 */
import type { BandChoice, EquipmentTag, HandSupport, Location, Variant } from './types';

/** Matériel à mettre en place avant la séance (porte, sangles à suspendre et régler). */
export const SETUP_TAGS: readonly EquipmentTag[] = ['straps', 'anchor'];

/** Un exercice du plan, réduit à ce qui décide du matériel. */
export interface GearUse {
  variant: Variant;
  /** Support des mains réellement prévu (poignées = matériel, poings ou mains à plat = rien). */
  handSupport?: HandSupport;
  /** Élastique prévu. */
  band?: BandChoice;
  /** Charge du sac prévue, en kg (exercices lestés). */
  load?: number;
}

/** Un matériel à préparer. */
export interface GearNeed {
  tag: EquipmentTag;
  /** Noms des exercices qui l'utilisent, dans l'ordre, sans doublon. */
  uses: string[];
  /** À installer avant de commencer (cf. SETUP_TAGS). */
  setup: boolean;
  /** Élastiques prévus (libellés), pour le tag `bands`. */
  bands?: string[];
  /** Charges du sac prévues (kg), pour le tag `backpack` : de quoi le remplir avant de commencer. */
  loads?: number[];
  /** Tag `mat` sur un lieu sans tapis : une serviette pliée le remplace (rien à retirer). */
  towel?: boolean;
}

/**
 * Matériel nécessaire aux exercices, dans l'ordre de première utilisation.
 * Pour une exigence « l'un ou l'autre » (sangles sur ancrage de porte OU sur barre), on retient le
 * premier que le lieu possède : c'est celui qu'on utilisera vraiment.
 */
export function gearNeeds(uses: readonly GearUse[], location: Location): GearNeed[] {
  const out: GearNeed[] = [];
  const add = (tag: EquipmentTag, use: GearUse) => {
    let need = out.find((n) => n.tag === tag);
    if (!need) {
      need = { tag, uses: [], setup: SETUP_TAGS.includes(tag) };
      out.push(need);
    }
    if (!need.uses.includes(use.variant.name)) need.uses.push(use.variant.name);
    if (tag === 'bands' && use.band) {
      need.bands ??= [];
      if (!need.bands.includes(use.band.label)) need.bands.push(use.band.label);
    }
    if (tag === 'backpack' && use.load !== undefined) {
      need.loads ??= [];
      if (!need.loads.includes(use.load)) need.loads.push(use.load);
    }
  };
  for (const use of uses) {
    for (const req of use.variant.needs) {
      const tag = Array.isArray(req) ? (req.find((t) => location.equipment.includes(t)) ?? req[0]) : req;
      if (tag) add(tag, use);
    }
    if (use.handSupport === 'handles') add('pushup-handles', use);
    if (use.variant.floor) add('mat', use);
  }
  const mat = out.find((n) => n.tag === 'mat');
  if (mat && !location.equipment.includes('mat')) mat.towel = true;
  return out;
}

/** Le lieu tel qu'il est aujourd'hui : sans le matériel qui n'est pas sous la main. */
export function withoutEquipment(location: Location, missing: readonly EquipmentTag[]): Location {
  if (missing.length === 0) return location;
  return { ...location, equipment: location.equipment.filter((t) => !missing.includes(t)) };
}

/** Ajoute ou retire un matériel de la liste « pas sous la main ». */
export function toggleMissing(missing: readonly EquipmentTag[], tag: EquipmentTag): EquipmentTag[] {
  return missing.includes(tag) ? missing.filter((t) => t !== tag) : [...missing, tag];
}
