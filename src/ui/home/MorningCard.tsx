/**
 * Carte du matin (accueil du 21/11) : « Ta nuit ? » et la pesée, réunies parce qu'elles se
 * font au même moment (au réveil). Chaque ligne disparaît une fois faite ; la carte avec la
 * dernière. La nuit se demande de 4 h à 14 h, la pesée de 5 h à 11 h (après, elle se fait depuis
 * Carnet › Corps). Le panneau de pesée appartient à l'écran (`onWeigh`) : la carte disparaît
 * dès la pesée notée, le panneau doit rester ouvert pour montrer la tendance.
 */
import { NIGHT_LABEL, NIGHT_QUALITIES } from '../../domain/sleep';
import { recordNight } from '../sleepState';
import { useHint } from './hints';

/** Créneau de l'invitation à la pesée (heures locales). */
export const WEIGH_FROM = 5;
export const WEIGH_UNTIL = 11;

export function MorningCard({ askNight, askWeigh, onWeigh }: { askNight: boolean; askWeigh: boolean; onWeigh: () => void }) {
  const weighHint = useHint('weigh');
  return (
    <section class="card morning-card" aria-labelledby="morning-title">
      <span class="card__label">Ce matin</span>
      {askNight && (
        <div class="morning-card__night">
          <span id="morning-title" class="card__title">
            Ta nuit ?
          </span>
          <div class="segmented" role="group" aria-label="Ta nuit">
            {NIGHT_QUALITIES.map((q) => (
              <button key={q} type="button" class="btn" onClick={() => void recordNight(q)}>
                {NIGHT_LABEL[q]}
              </button>
            ))}
          </div>
        </div>
      )}
      {askNight && askWeigh && <hr class="day-card__rule" />}
      {askWeigh && (
        <div class="morning-card__weigh">
          <div class="morning-card__weigh-text">
            <span id={askNight ? undefined : 'morning-title'} class={askNight ? 'morning-card__sub' : 'card__title'}>
              Pesée du matin
            </span>
            {weighHint && <span class="muted morning-card__hint">Au réveil, avant de manger. C’est la tendance qui compte.</span>}
          </div>
          <button type="button" class="btn btn--accent-line" onClick={onWeigh}>
            Se peser
          </button>
        </div>
      )}
    </section>
  );
}
