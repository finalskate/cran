/**
 * Les nuits des deux dernières semaines, dans Carnet › Corps (accueil du 21/11) : une case par
 * jour, la légende et un décompte en clair (la couleur ne porte jamais seule l'information).
 * Si les mauvaises nuits s'accumulent, une phrase sobre suggère d'en parler à un médecin.
 * Rien tant qu'aucune nuit n'est notée : la question se pose le matin sur l'accueil.
 */
import { dayToDate } from '../../domain/days';
import { NIGHT_LABEL, NIGHT_QUALITIES, NIGHT_WINDOW_DAYS, nightsSummary } from '../../domain/sleep';
import { formatShortDate } from '../format';
import { nights } from '../sleepState';

export function NightsCard({ today }: { today: string }) {
  const s = nightsSummary(nights.value, today);
  if (s.answered === 0) return null;
  const described = s.days.map((d) => `${formatShortDate(dayToDate(d.day))} : ${d.quality ? NIGHT_LABEL[d.quality].toLowerCase() : 'pas notée'}`).join(', ');
  return (
    <section class="card" aria-labelledby="nights-title">
      <div class="row" style={{ minHeight: 0 }}>
        <h2 id="nights-title" class="card__title">
          Nuits
        </h2>
        <span class="muted">{NIGHT_WINDOW_DAYS} derniers jours</span>
      </div>
      <div class="nights-strip" role="img" aria-label={described}>
        {s.days.map((d) => (
          <span key={d.day} class={`night night--${d.quality ?? 'none'}`} />
        ))}
      </div>
      <div class="chart-legend muted">
        {NIGHT_QUALITIES.map((q) => (
          <span key={q}>
            <i class={`night night--${q} night--legend`} aria-hidden="true" />
            {NIGHT_LABEL[q].toLowerCase()}
          </span>
        ))}
      </div>
      <span class="muted">
        {s.bad === 0 ? 'Aucune mauvaise nuit' : `${s.bad} mauvaise${s.bad > 1 ? 's' : ''} nuit${s.bad > 1 ? 's' : ''}`} sur {s.answered} notée
        {s.answered > 1 ? 's' : ''}.
      </span>
      {s.adviseDoctor && (
        <p class="notice-line" style={{ margin: 0 }}>
          Beaucoup de nuits difficiles ces deux dernières semaines. Si ça dure, ça vaut le coup d’en parler à un médecin.
        </p>
      )}
    </section>
  );
}
