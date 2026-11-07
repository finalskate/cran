/**
 * Vue « Corps » du Carnet (J3, SPEC §4.9) : tendance de poids, rythme et projection, courbe,
 * tour de taille, photos de progression, historique des pesées et mesures.
 *
 * Ce qui est affiché et commenté, c'est la tendance lissée, jamais la pesée du jour (elle
 * apparaît seulement en petits points sur la courbe, et dans l'historique).
 */
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { GAP_DAYS, PHOTO_POSES, photoDue } from '../../domain/body';
import { addDays, dayKey, dayToDate, daysBetween } from '../../domain/days';
import { track } from '../../data/usage';
import { PhotoImg } from '../body/PhotoImg';
import { WaistSheet } from '../body/WaistSheet';
import { LineChart, type LinePoint } from '../components/LineChart';
import { WeighSheet } from '../food/WeighSheet';
import { measures, photos, removeMeasure, removeWeight, summary, trend, waists } from '../bodyState';
import { weights } from '../foodState';
import { formatApproxDate, formatCm, formatKg, formatMonthLower, formatShortDate, formatSigned } from '../format';

type Period = 30 | 91 | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 30, label: '1 mois' },
  { value: 91, label: '3 mois' },
  { value: 'all', label: 'Tout' },
];

/** Période choisie, gardée d'une visite à l'autre du Carnet. */
const period = signal<Period>(91);

/** Une courbe couvre au moins deux semaines, même au tout début (sinon trois points remplissent l'écran). */
const MIN_SPAN_DAYS = 13;

/** Tours de taille hebdomadaires : un trou de 3 semaines interrompt la courbe. */
const WAIST_GAP_DAYS = 21;

/** Début de la période affichée : jamais avant la première mesure, au moins MIN_SPAN_DAYS. */
function periodStart(firstDay: string | undefined, today: string, p: Period): string {
  const floor = addDays(today, -MIN_SPAN_DAYS);
  if (!firstDay) return floor;
  const from = p === 'all' ? firstDay : firstDay > addDays(today, -(p - 1)) ? firstDay : addDays(today, -(p - 1));
  return from < floor ? from : floor;
}

const kgTick = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function BodyView() {
  const today = dayKey(new Date());
  const s = summary.value;
  const series = trend.value;
  const [weighing, setWeighing] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  const from = periodStart(series[0]?.day, today, period.value);
  const points: LinePoint[] = series.map((p) => ({ day: p.day, value: p.kg, line: p.trend, gapBefore: p.gapBefore }));

  const w = waists.value;
  const waistPoints: LinePoint[] = w.map((m, i) => ({
    day: m.day,
    value: m.value,
    gapBefore: i > 0 && daysBetween(w[i - 1]!.day, m.day) > WAIST_GAP_DAYS,
  }));
  const waistFrom = periodStart(w[0]?.day, today, 'all');

  // Photos : la série la plus récente, une vignette par pose.
  const lastMonth = photos.value.at(-1)?.month;
  const latest = PHOTO_POSES.map((pose) => photos.value.find((p) => p.month === lastMonth && p.pose === pose)).filter((p) => !!p);
  const due = photoDue(photos.value, today);

  return (
    <>
      <section class="card" aria-labelledby="trend-title">
        <div class="row" style={{ minHeight: 0 }}>
          <span id="trend-title" class="card__label">
            Tendance
          </span>
          {s.count > 0 && (
            <span class="muted">
              {s.count} pesée{s.count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {s.trend === null ? (
          <>
            <span class="card__title">Ta courbe commence à la première pesée</span>
            <span class="muted">Au réveil, avant de manger. Même espacées, les pesées suffisent : la tendance s’adapte.</span>
          </>
        ) : (
          <>
            <div class="trend-head">
              <span class="trend-head__value num">{formatKg(s.trend)}</span>
              {s.rate !== null && (
                <span class={`trend-head__rate num ${s.direction === 'down' ? 'trend-good' : 'muted'}`}>{formatSigned(s.rate)} kg / sem.</span>
              )}
            </div>
            <TrendText />
          </>
        )}
        <button type="button" class="btn btn--small" onClick={() => setWeighing(true)}>
          Se peser
        </button>
      </section>

      {series.length > 0 && (
        <section class="card" aria-labelledby="weight-chart-title">
          <div class="row" style={{ minHeight: 0 }}>
            <h2 id="weight-chart-title" class="card__title">
              Poids
            </h2>
            <div class="segmented segmented--tight" role="radiogroup" aria-label="Période">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  class="btn btn--small"
                  role="radio"
                  aria-checked={period.value === p.value}
                  onClick={() => {
                    period.value = p.value;
                    track('chart', { period: p.value });
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <LineChart
            points={points}
            from={from}
            to={today}
            minRange={2}
            tick={kgTick}
            label={`Courbe de poids : tendance ${formatKg(s.trend!)}${s.rate !== null ? `, ${formatSigned(s.rate)} kg par semaine` : ''}`}
            describe={(p) => `${formatShortDate(dayToDate(p.day))} · pesée ${formatKg(p.value)} · tendance ${formatKg(p.line!)}`}
            onSelect={() => track('chart', { touch: 'weight' })}
          />
          <div class="chart-legend muted">
            <span>
              <i class="chart-legend__dot" aria-hidden="true" />
              pesées
            </span>
            <span>
              <i class="chart-legend__line" aria-hidden="true" />
              tendance
            </span>
            {series.some((p) => p.gapBefore) && <span>pointillés : plus de {GAP_DAYS} jours sans pesée</span>}
          </div>
        </section>
      )}

      <section class="card" aria-labelledby="waist-title">
        <div class="row" style={{ minHeight: 0 }}>
          <h2 id="waist-title" class="card__title">
            Tour de taille
          </h2>
          {w.length > 0 && <span class="num">{formatCm(w.at(-1)!.value)}</span>}
        </div>
        {w.length === 0 && (
          <span class="muted">
            Une fois par semaine, proposé après une pesée. Il te faut un mètre ruban souple : la taille s’affine souvent avant que la
            balance ne bouge.
          </span>
        )}
        {w.length > 1 && (
          <>
            <span class={w.at(-1)!.value < w[0]!.value ? 'trend-good' : 'muted'}>
              {formatSigned(w.at(-1)!.value - w[0]!.value)} cm depuis le {formatShortDate(dayToDate(w[0]!.day))}
            </span>
            <LineChart
              points={waistPoints}
              from={waistFrom}
              to={today}
              minRange={4}
              tick={kgTick}
              tone="accent-2"
              height={130}
              label={`Courbe du tour de taille : ${formatCm(w.at(-1)!.value)}`}
              describe={(p) => `${formatShortDate(dayToDate(p.day))} · ${formatCm(p.value)}`}
              onSelect={() => track('chart', { touch: 'waist' })}
            />
          </>
        )}
        <button type="button" class="btn btn--small" onClick={() => setMeasuring(true)}>
          Noter un tour de taille
        </button>
      </section>

      <a class="card card--link" href="#/photos" aria-labelledby="photos-title">
        <div class="row" style={{ minHeight: 0 }}>
          <span id="photos-title" class="card__title">
            Photos
          </span>
          <span class="muted">{photos.value.length > 0 ? 'Comparer →' : 'Commencer →'}</span>
        </div>
        {latest.length > 0 ? (
          <div class="photo-strip">
            {latest.map((p) => (
              <PhotoImg key={p.id} photo={p} alt={`Photo ${p.pose === 'front' ? 'de face' : 'de profil'}, ${formatMonthLower(p.month)}`} thumb />
            ))}
          </div>
        ) : (
          <span class="muted">Une série par mois, de face et de profil. Elles restent sur ce téléphone.</span>
        )}
        {due && photos.value.length > 0 && <span class="notice-line">C’est le moment des photos de ce mois-ci.</span>}
      </a>

      {(weights.value.length > 0 || measures.value.length > 0) && <History />}

      {weighing && <WeighSheet onClose={() => setWeighing(false)} />}
      {measuring && <WaistSheet onClose={() => setMeasuring(false)} />}
    </>
  );
}

/** Phrase sous la tendance : progression depuis le début, projection, ou ce qui manque. */
function TrendText() {
  const s = summary.value;
  const today = dayKey(new Date());
  const parts: string[] = [];
  if (s.count > 1 && s.sinceStart !== null && Math.abs(s.sinceStart) >= 0.1) parts.push(`${formatSigned(s.sinceStart)} kg depuis le début.`);
  if (s.projection) parts.push(`À ce rythme, ${formatKg(s.projection.goal)} vers ${formatApproxDate(s.projection.day, today)}.`);
  else if (s.missing && (s.missing.weighIns > 0 || s.missing.spanDays > 0)) {
    parts.push(
      s.missing.weighIns > 0
        ? `Le rythme apparaîtra après ${s.missing.weighIns} pesée${s.missing.weighIns > 1 ? 's' : ''} de plus, sur une dizaine de jours.`
        : `Le rythme apparaîtra dans ${s.missing.spanDays} jour${s.missing.spanDays > 1 ? 's' : ''}, avec une pesée de plus.`,
    );
  } else if (s.rate === null && s.lastDay) {
    parts.push(`Dernière pesée il y a ${daysBetween(s.lastDay, today)} jours : une nouvelle pesée relancera la courbe.`);
  } else if (s.goal !== null) parts.push(`Objectif : ${formatKg(s.goal)}.`);

  return (
    <p class="trend-text">
      {parts.join(' ')}
      {s.goal === null && s.trend !== null && (
        <>
          {' '}
          <a href="#/profil">Fixer un objectif</a>
        </>
      )}
    </p>
  );
}

/** Historique repliable des pesées et des tours de taille, pour corriger une faute de frappe. */
function History() {
  const rows = [
    ...weights.value.map((w) => ({ key: `w:${w.day}`, day: w.day, text: formatKg(w.kg), remove: () => removeWeight(w.day) })),
    ...measures.value.map((m) => ({ key: m.id, day: m.day, text: `taille ${formatCm(m.value)}`, remove: () => removeMeasure(m.id) })),
  ].sort((a, b) => b.day.localeCompare(a.day) || a.key.localeCompare(b.key));

  return (
    <details class="card history">
      <summary class="history__summary">Pesées et mesures</summary>
      <ul class="history__list">
        {rows.map((r) => (
          <li key={r.key} class="history__row">
            <span>{formatShortDate(dayToDate(r.day))}</span>
            <span class="num">{r.text}</span>
            <button
              type="button"
              class="btn btn--small btn--quiet"
              aria-label={`Supprimer ${r.text} du ${formatShortDate(dayToDate(r.day))}`}
              onClick={() => {
                if (confirm(`Supprimer ${r.text} du ${formatShortDate(dayToDate(r.day))} ?`)) void r.remove();
              }}
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
