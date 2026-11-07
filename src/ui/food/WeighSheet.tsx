/**
 * Pesée (SPEC §4.9, « pesée minimale » du J4) : un poids pré-rempli (dernière pesée), ajusté
 * au dixième, enregistré en un geste. Le ton installe l'habitude sans pression : on ne commente
 * jamais la pesée du jour, seule la tendance compte.
 *
 * J3 : une fois la pesée notée, le panneau montre la TENDANCE (valeur lissée, rythme, petite
 * courbe) avec un message tiré dans une liste selon le sens de la tendance, puis, une fois par
 * semaine, propose le tour de taille (même moment, mêmes conditions).
 */
import { useState } from 'preact/hooks';
import { waistDue } from '../../domain/body';
import { dayKey } from '../../domain/days';
import { dailyMessage } from '../../domain/messages';
import { latestWeight, WEIGHT_MAX, WEIGHT_MIN } from '../../domain/nutrition';
import { TREND_DOWN, TREND_STABLE, TREND_START, TREND_UP } from '../../data/messages';
import { track } from '../../data/usage';
import { WaistField, initialWaist } from '../body/WaistSheet';
import { Sheet } from '../components/Sheet';
import { Sparkline } from '../components/SmallCharts';
import { Stepper } from '../components/Stepper';
import { measures, recordWaist, snoozeWaist, summary, trend, waistSnoozedUntil } from '../bodyState';
import { profile, recordWeight, weights } from '../foodState';
import { formatKg, formatSigned } from '../format';

/** Poids proposé quand on n'a encore rien : un point de départ, à ajuster. */
const FALLBACK_KG = 75;

/** Nombre de pesées montrées dans la petite courbe. */
const SPARK_POINTS = 12;

export function WeighSheet({ onClose }: { onClose: () => void }) {
  const last = latestWeight(weights.value);
  const today = dayKey(new Date());
  const [kg, setKg] = useState(last?.kg ?? profile.value?.weightKg ?? FALLBACK_KG);
  const [saved, setSaved] = useState(false);
  // Décidé au moment de la pesée, pour que la question ne disparaisse pas sous les doigts.
  const [askWaist, setAskWaist] = useState(false);
  const [cm, setCm] = useState(initialWaist);
  const replacing = last?.day === today;

  async function save() {
    await recordWeight(kg);
    setAskWaist(waistDue(measures.value, today, waistSnoozedUntil.value));
    setSaved(true);
    track('weigh-result', { direction: summary.value.direction ?? 'unknown' });
  }

  async function saveWaist() {
    await recordWaist(cm);
    onClose();
  }

  async function skipWaist() {
    await snoozeWaist();
    onClose();
  }

  if (saved) {
    const s = summary.value;
    const pool = s.direction === 'down' ? TREND_DOWN : s.direction === 'stable' ? TREND_STABLE : s.direction === 'up' ? TREND_UP : TREND_START;
    const message = dailyMessage(pool, today, `trend-${s.direction ?? 'start'}`);
    return (
      <Sheet
        open
        onClose={onClose}
        title="Pesée notée"
        footer={
          askWaist ? (
            <div class="segmented">
              <button type="button" class="btn" onClick={() => void skipWaist()}>
                Pas cette fois
              </button>
              <button type="button" class="btn btn--solid" onClick={() => void saveWaist()}>
                Noter
              </button>
            </div>
          ) : (
            <button type="button" class="cta cta--compact" onClick={onClose}>
              <span class="cta__title">Fermer</span>
            </button>
          )
        }
      >
        {s.trend !== null && (
          <div class="trend-box">
            <div class="trend-box__text">
              <span class="muted">Ta tendance</span>
              <span class="trend-box__value num">{formatKg(s.trend)}</span>
              {s.rate !== null && (
                <span class={s.direction === 'down' ? 'trend-good' : 'muted'}>{formatSigned(s.rate)} kg par semaine</span>
              )}
            </div>
            <Sparkline values={trend.value.slice(-SPARK_POINTS).map((p) => p.trend)} />
          </div>
        )}
        <p class="sheet__lead">{message}</p>

        {askWaist && (
          <section class="waist-ask" aria-labelledby="waist-ask-title">
            <div class="row" style={{ minHeight: 0 }}>
              <h3 id="waist-ask-title" class="card__title">
                Et le tour de taille ?
              </h3>
              <span class="muted">1 fois par semaine</span>
            </div>
            <WaistField value={cm} onChange={setCm} />
            {measures.value.length === 0 && (
              <p class="muted sheet__lead">Pas encore de mètre ruban ? Un mètre de couture souple suffit (quelques euros).</p>
            )}
          </section>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Pesée"
      footer={
        <button type="button" class="cta cta--compact" onClick={() => void save()}>
          <span class="cta__title">{replacing ? 'Remplacer la pesée du jour' : 'Noter'}</span>
        </button>
      }
    >
      <Stepper
        big
        label="Poids"
        value={kg}
        onChange={setKg}
        step={0.1}
        min={WEIGHT_MIN}
        max={WEIGHT_MAX}
        format={(v) => (
          <>
            {formatKg(v).replace(' kg', '')}
            <span class="stepper__unit"> kg</span>
          </>
        )}
      />
      <div class="segmented">
        <button type="button" class="btn btn--small" onClick={() => setKg(Math.max(WEIGHT_MIN, Math.round((kg - 1) * 10) / 10))}>
          −1 kg
        </button>
        <button type="button" class="btn btn--small" onClick={() => setKg(Math.min(WEIGHT_MAX, Math.round((kg + 1) * 10) / 10))}>
          +1 kg
        </button>
      </div>
      <p class="muted sheet__lead">
        Le meilleur moment : au réveil, après les toilettes, avant de manger ou boire. Le poids varie d’un jour à l’autre
        (eau, sel, repas de la veille) : c’est la tendance sur plusieurs jours qui compte, jamais la pesée du jour.
      </p>
    </Sheet>
  );
}
