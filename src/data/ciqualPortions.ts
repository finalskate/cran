/**
 * Portions types des aliments Ciqual (SPEC §4.8 : « poids de portion type ajoutés par
 * catégorie »). La table Ciqual ne donne que des valeurs pour 100 g : ces repères évitent de
 * devoir peser. Ce sont des ordres de grandeur courants (portion de restauration collective,
 * contenant du commerce), pas des mesures : l'ajustement adaptatif absorbe l'écart constant.
 *
 * Donnée éditable : la PREMIÈRE règle qui correspond l'emporte. Les règles par mot-clé passent
 * donc avant les règles par sous-groupe Ciqual (codes à 4 chiffres, ex. « 0105 » = sandwichs).
 * « 100 g » (ou 100 ml) est toujours ajouté à la fin, et « Autre quantité » reste possible.
 *
 * Boissons : Ciqual donne des valeurs pour 100 g, assimilées ici à 100 ml (écart de quelques %).
 */
import type { Portion } from '../domain/nutrition';

export interface PortionRule {
  /** Mot-clé cherché dans le nom normalisé (sans accents, en minuscules). */
  match?: RegExp;
  /** Sous-groupes Ciqual concernés (si absent : tous). */
  groups?: readonly string[];
  portions: readonly Portion[];
}

/** Sous-groupes mesurés en millilitres : laits, eaux, boissons. */
export const LIQUID_GROUPS: readonly string[] = ['0501', '0601', '0602', '0603'];

const p = (label: string, amount: number): Portion => ({ label: `${label} (${amount} g)`, amount });
const ml = (label: string, amount: number): Portion => ({ label: `${label} (${amount} ml)`, amount });

export const PORTION_RULES: readonly PortionRule[] = [
  // ─── Restauration rapide et sandwichs ───
  { match: /double cheeseburger/, portions: [p('1 burger', 170)] },
  { match: /burger|hamburger/, groups: ['0105'], portions: [p('1 burger', 120), p('1 grand burger', 220)] },
  { match: /^wrap/, portions: [p('1 wrap', 180)] },
  { match: /kebab/, groups: ['0105'], portions: [p('1 sandwich', 350)] },
  { match: /^frites|frites de pommes de terre/, portions: [p('Petite frite', 80), p('Frite moyenne', 115), p('Grande frite', 150), p('1 assiette', 200)] },
  { match: /nugget/, portions: [p('4 pièces', 70), p('6 pièces', 100), p('9 pièces', 150)] },
  { match: /milkshake/, portions: [ml('1 gobelet', 300)] },
  { groups: ['0105'], portions: [p('1 sandwich', 200), p('½ baguette garnie', 250)] },

  // ─── Plats ───
  { match: /pizza/, portions: [p('1 part', 120), p('½ pizza', 200), p('1 pizza', 400)] },
  { match: /quiche|tarte|tourte/, groups: ['0104'], portions: [p('1 part', 150)] },
  { match: /crepe|galette/, groups: ['0104'], portions: [p('1 crêpe garnie', 150)] },
  { groups: ['0101'], portions: [p('1 assiette', 250), p('1 ramequin d’entrée', 120)] },
  { groups: ['0102'], portions: [p('1 bol', 250), p('1 assiette creuse', 350)] },
  { groups: ['0103'], portions: [p('1 assiette', 300), p('1 barquette', 350)] },
  { groups: ['0106'], portions: [p('1 pièce', 100)] },

  // ─── Fruits et légumes ───
  { match: /sec|seche|deshydrat/, groups: ['0204'], portions: [p('1 poignée', 30)] },
  { match: /banane/, groups: ['0204'], portions: [p('1 banane', 120)] },
  { match: /clementine|mandarine|kiwi|abricot|prune/, groups: ['0204'], portions: [p('1 fruit', 70)] },
  { match: /compote/, groups: ['0204'], portions: [p('1 gourde ou 1 pot', 100)] },
  { groups: ['0204'], portions: [p('1 fruit', 150), p('1 bol', 200)] },
  { groups: ['0201'], portions: [p('1 portion', 150), p('1 assiette', 250)] },
  { groups: ['0202'], portions: [p('1 portion', 200)] },
  { groups: ['0203'], portions: [p('1 portion cuite', 150)] },
  { groups: ['0205'], portions: [p('1 poignée', 30)] },

  // ─── Féculents et pain ───
  { match: /\bcru|\bsec\b|non cuit/, groups: ['0301'], portions: [p('1 portion crue', 80)] },
  { groups: ['0301'], portions: [p('1 portion cuite', 200), p('1 grosse assiette', 300)] },
  { match: /baguette/, groups: ['0302'], portions: [p('1 morceau', 40), p('¼ de baguette', 60), p('½ baguette', 125)] },
  { match: /pain de mie/, groups: ['0302'], portions: [p('1 tranche', 25)] },
  { match: /bun|burger/, groups: ['0302'], portions: [p('1 pain', 60)] },
  { match: /biscotte|galette|cracotte/, groups: ['0302'], portions: [p('1 pièce', 10)] },
  { groups: ['0302'], portions: [p('1 tranche', 40), p('1 morceau', 60)] },
  { groups: ['0303'], portions: [p('1 poignée', 30), p('½ paquet', 75)] },

  // ─── Viandes, poissons, œufs ───
  { match: /oeuf/, groups: ['0410'], portions: [p('1 œuf', 50), p('2 œufs', 100)] },
  { match: /jambon/, groups: ['0403'], portions: [p('1 tranche', 45)] },
  { match: /saucisson|chorizo|salami/, groups: ['0403'], portions: [p('5 rondelles', 25)] },
  { match: /saucisse|merguez|chipolata/, portions: [p('1 saucisse', 70)] },
  { match: /lardon/, portions: [p('1 poignée', 50)] },
  { groups: ['0403'], portions: [p('1 tranche', 30), p('1 portion', 60)] },
  { match: /steak hache/, portions: [p('1 steak', 100)] },
  { groups: ['0401', '0402', '0404', '0405', '0406', '0411'], portions: [p('1 portion', 120)] },
  { groups: ['0407', '0408', '0409'], portions: [p('1 portion', 100)] },

  // ─── Produits laitiers ───
  { groups: ['0501'], portions: [ml('1 verre', 200), ml('1 bol', 300)] },
  { match: /fromage blanc|faisselle/, groups: ['0502'], portions: [p('1 pot', 100), p('1 bol', 200)] },
  { groups: ['0502'], portions: [p('1 pot', 125)] },
  { groups: ['0503'], portions: [p('1 portion', 30), p('1 grosse part', 60)] },
  { groups: ['0504'], portions: [p('1 cuillère à soupe', 15)] },

  // ─── Boissons ───
  { match: /biere|panache/, groups: ['0603'], portions: [ml('1 demi', 250), ml('1 canette', 330), ml('1 pinte', 500)] },
  { match: /vin|cidre|champagne|mousseux|sangria/, groups: ['0603'], portions: [ml('1 verre', 125)] },
  { groups: ['0603'], portions: [ml('1 verre de cocktail', 150), ml('1 dose', 40)] },
  { match: /poudre|instantane|lyophilis/, groups: ['0602'], portions: [p('1 cuillère', 10)] },
  { match: /\bcafe|\bthe\b|infusion|chicoree/, groups: ['0602'], portions: [ml('1 tasse', 150), ml('1 mug', 250)] },
  { groups: ['0601', '0602'], portions: [ml('1 verre', 200), ml('1 canette', 330), ml('1 bouteille', 500)] },

  // ─── Produits sucrés ───
  { match: /tablette/, groups: ['0702'], portions: [p('1 carré', 5), p('1 rangée', 20), p('½ tablette', 50)] },
  { match: /barre/, groups: ['0702', '0708'], portions: [p('1 barre', 45)] },
  { match: /pate a tartiner/, portions: [p('1 cuillère', 15)] },
  { groups: ['0702'], portions: [p('1 pièce', 10), p('1 poignée', 30)] },
  { groups: ['0703'], portions: [p('1 poignée', 30)] },
  { groups: ['0701', '0704'], portions: [p('1 cuillère', 15), p('1 morceau ou 1 cuillère à café', 5)] },
  { match: /croissant|pain au chocolat|chocolatine/, groups: ['0705'], portions: [p('1 viennoiserie', 60)] },
  { groups: ['0705'], portions: [p('1 pièce', 80)] },
  { groups: ['0706'], portions: [p('1 biscuit', 10), p('4 biscuits', 40), p('½ paquet', 100)] },
  { groups: ['0707'], portions: [p('1 bol', 40)] },
  { groups: ['0708'], portions: [p('1 barre', 25)] },
  { groups: ['0709'], portions: [p('1 part', 80), p('1 grosse part', 120)] },

  // ─── Glaces ───
  { match: /cone|baton|esquimau/, groups: ['0801', '0802', '0803'], portions: [p('1 glace', 70)] },
  { groups: ['0801', '0802', '0803'], portions: [p('1 boule', 50), p('2 boules', 100)] },

  // ─── Matières grasses, sauces, condiments ───
  { match: /huile/, groups: ['0902', '0904'], portions: [p('1 cuillère à soupe', 10)] },
  { groups: ['0901', '0903', '0905'], portions: [p('1 noisette', 10), p('1 cuillère à soupe', 15)] },
  { match: /mayonnaise|ketchup|moutarde/, groups: ['1001', '1002'], portions: [p('1 dosette', 15)] },
  { groups: ['1001'], portions: [p('1 cuillère à soupe', 15), p('1 portion de sauce', 50)] },
  { groups: ['1002', '1003'], portions: [p('1 cuillère à café', 5)] },
];
