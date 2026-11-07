/**
 * Profil et cible du jour (SPEC §4.8) : sexe, année de naissance, taille, poids, activité.
 * Le calcul est affiché en clair, étape par étape : la cible n'est pas une boîte noire.
 * Ces valeurs restent sur le téléphone (jamais dans le code ni dans le dépôt).
 */
import { useState } from 'preact/hooks';
import {
  ACTIVITY,
  computeTargets,
  DEFICIT_KCAL,
  latestWeight,
  PROTEIN_PER_KG,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type ActivityLevel,
  type Profile as ProfileData,
  type Sex,
} from '../../domain/nutrition';
import { track } from '../../data/usage';
import { NumberField } from '../food/common';
import { WeighSheet } from '../food/WeighSheet';
import { profile, saveProfile, weights } from '../foodState';
import { formatInt, formatKg, formatLongDate, parseDecimal } from '../format';
import { go } from '../router';

const SEXES: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
];

export function Profile() {
  const p = profile.value;
  const year = new Date().getFullYear();
  const lastWeight = latestWeight(weights.value);

  const [sex, setSex] = useState<Sex>(p?.sex ?? 'male');
  const [birthYear, setBirthYear] = useState(p ? String(p.birthYear) : '');
  const [height, setHeight] = useState(p ? String(p.heightCm) : '');
  const [weight, setWeight] = useState(p ? String(p.weightKg).replace('.', ',') : '');
  const [activity, setActivity] = useState<ActivityLevel>(p?.activity ?? 'active');
  const [weighing, setWeighing] = useState(false);

  const by = parseDecimal(birthYear);
  const h = parseDecimal(height);
  // Déjà pesé : le champ poids est masqué, la pesée sert de poids de départ.
  const w = parseDecimal(weight) ?? lastWeight?.kg;
  const draft: ProfileData | null =
    by && by > year - 100 && by < year - 12 && h && h >= 120 && h <= 230 && w && w >= WEIGHT_MIN && w <= WEIGHT_MAX
      ? { sex, birthYear: Math.round(by), heightCm: Math.round(h), weightKg: w, activity }
      : null;

  // Le calcul utilise la dernière pesée si elle existe (comme la cible du jour).
  const usedWeight = lastWeight?.kg ?? w;
  const t = draft && usedWeight ? computeTargets(draft, usedWeight, year) : null;

  async function save() {
    if (!draft || !t) return;
    await saveProfile(draft);
    track('profile', { kcal: t.kcal, floored: t.floored, activity: draft.activity });
    go('food', true);
  }

  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">Alimentation</span>
        <h1 class="screen-header__title">Ta cible</h1>
      </header>

      <section class="card" aria-label="Profil">
        <div class="segmented" role="radiogroup" aria-label="Sexe">
          {SEXES.map((s) => (
            <button key={s.value} type="button" class="btn" role="radio" aria-checked={sex === s.value} onClick={() => setSex(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <div class="field-pair">
          <NumberField id="pr-year" label="Année de naissance" value={birthYear} onInput={setBirthYear} />
          <NumberField id="pr-height" label="Taille" suffix="cm" value={height} onInput={setHeight} />
        </div>
        {lastWeight ? (
          <div class="row">
            <span>
              Poids : <strong class="num">{formatKg(lastWeight.kg)}</strong>
              <span class="muted"> · pesée du {formatLongDate(new Date(lastWeight.at)).toLowerCase()}</span>
            </span>
            <button type="button" class="btn btn--small" onClick={() => setWeighing(true)}>
              Se peser
            </button>
          </div>
        ) : (
          <NumberField
            id="pr-weight"
            label="Poids"
            suffix="kg"
            value={weight}
            onInput={setWeight}
            hint="Une estimation suffit pour commencer. Pèse-toi demain matin : la cible se recalera."
          />
        )}
      </section>

      <section class="card" aria-labelledby="act-title">
        <span id="act-title" class="card__label">
          Activité de tous les jours
        </span>
        <div class="choice-list" role="radiogroup" aria-labelledby="act-title">
          {(Object.keys(ACTIVITY) as ActivityLevel[]).map((a) => (
            <button key={a} type="button" class="choice choice--stack" role="radio" aria-checked={activity === a} onClick={() => setActivity(a)}>
              <span class="choice__title">{ACTIVITY[a].label}</span>
              <span class="muted choice__hint">{ACTIVITY[a].hint}</span>
            </button>
          ))}
        </div>
      </section>

      {t && (
        <section class="card" aria-label="Calcul de la cible">
          <span class="card__label">Le calcul</span>
          <div class="calc">
            <span>Métabolisme de base (Mifflin-St Jeor)</span>
            <span class="num">{formatInt(t.bmr)} kcal</span>
            <span>× activité ({ACTIVITY[activity].factor.toLocaleString('fr-FR')})</span>
            <span class="num">{formatInt(t.expenditure)} kcal</span>
            <span>− déficit</span>
            <span class="num">{formatInt(DEFICIT_KCAL)} kcal</span>
            <strong>Cible du jour</strong>
            <strong class="num accent">{formatInt(t.kcal)} kcal</strong>
            <strong>Protéines ({PROTEIN_PER_KG.toLocaleString('fr-FR')} g/kg)</strong>
            <strong class="num accent">{t.protein} g</strong>
          </div>
          {t.floored && <p class="muted calc__note">La cible est relevée au plancher : descendre plus bas ferait perdre du muscle.</p>}
          <p class="muted calc__note">
            C’est un point de départ. Après deux semaines de notes et de pesées, l’appli mesurera ta dépense réelle et
            proposera d’ajuster.
          </p>
        </section>
      )}

      <div class="bottom-zone">
        <button type="button" class="cta" disabled={!t} onClick={() => void save()}>
          <span class="cta__title">{p ? 'Enregistrer' : 'Commencer la calibration'}</span>
          {!t && <span class="cta__sub">Remplis année, taille et poids</span>}
        </button>
      </div>

      {weighing && <WeighSheet onClose={() => setWeighing(false)} />}
    </main>
  );
}
