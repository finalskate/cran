/**
 * Photos de progression (J3, SPEC §4.9) : comparaison de deux mois, pose par pose, et prise
 * des photos du mois. Quand la balance stagne alors que le muscle progresse, c'est ce qui
 * entretient la fierté.
 *
 * Confidentialité : les photos restent dans la base du téléphone (jamais dans la galerie,
 * jamais envoyées), floutées jusqu'au toucher par défaut, hors de l'export sauf demande.
 */
import { useState } from 'preact/hooks';
import { PHOTO_POSES, photoMonths, trendAt, type PhotoPose } from '../../domain/body';
import { daysBetween, dayKey } from '../../domain/days';
import { PhotoCapture } from '../body/PhotoCapture';
import { PhotoImg } from '../body/PhotoImg';
import { photos, removePhotos, trend, waists } from '../bodyState';
import { formatCm, formatKg, formatMonthLower } from '../format';
import type { PhotoRow } from '../../data/db';

const POSE_TAB: Record<PhotoPose, string> = { front: 'Face', side: 'Profil' };

/** Tour de taille mesuré au plus 10 jours avant ou après la photo (sinon on n'en dit rien). */
const WAIST_NEAR_DAYS = 10;

export function Photos() {
  const [pose, setPose] = useState<PhotoPose>('front');
  const [capturing, setCapturing] = useState(false);
  const months = photoMonths(photos.value, pose);
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);
  // Par défaut : la toute première série face à la plus récente.
  const a = pickA && months.includes(pickA) ? pickA : months[0];
  const b = pickB && months.includes(pickB) ? pickB : months.at(-1);
  const photoOf = (month: string | undefined) => photos.value.find((p) => p.month === month && p.pose === pose);

  const today = dayKey(new Date());
  const thisMonth = today.slice(0, 7);
  const doneThisMonth = PHOTO_POSES.every((p) => photos.value.some((x) => x.month === thisMonth && x.pose === p));
  const allMonths = [...new Set(photos.value.map((p) => p.month))].sort().reverse();

  async function remove(month: string) {
    if (confirm(`Supprimer les photos de ${formatMonthLower(month)} ? C’est définitif.`)) await removePhotos(month);
  }

  return (
    <main class="screen screen--calm">
      <header class="screen-header screen-header--row screen-header--back">
        <a class="icon-btn" href="#/corps" aria-label="Retour au carnet">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </a>
        <div class="screen-header__titles">
          <span class="screen-header__kicker">Carnet › Corps</span>
          <h1 class="screen-header__title">Photos</h1>
        </div>
      </header>

      {photos.value.length === 0 ? (
        <section class="card">
          <span class="card__title">Le point de départ est la photo la plus précieuse</span>
          <span class="muted">
            Une série par mois, de face et de profil. Le jour où la balance stagne, la comparaison montre ce que le chiffre ne dit
            pas.
          </span>
        </section>
      ) : (
        <>
          <div class="segmented" role="tablist" aria-label="Pose">
            {PHOTO_POSES.map((p) => (
              <button key={p} type="button" class="btn btn--small" role="tab" aria-selected={pose === p} onClick={() => setPose(p)}>
                {POSE_TAB[p]}
              </button>
            ))}
          </div>

          {months.length === 0 ? (
            <p class="muted empty-note">Pas encore de photo de {POSE_TAB[pose].toLowerCase()}.</p>
          ) : (
            <>
              <div class="compare">
                <Figure photo={photoOf(a)} />
                {months.length > 1 && <Figure photo={photoOf(b)} />}
              </div>
              {months.length > 1 ? (
                <div class="segmented">
                  <MonthSelect label="Avant" value={a!} months={months} onChange={setPickA} />
                  <MonthSelect label="Après" value={b!} months={months} onChange={setPickB} />
                </div>
              ) : (
                <p class="muted empty-note">La comparaison apparaîtra avec la série du mois prochain.</p>
              )}
            </>
          )}
        </>
      )}

      {doneThisMonth ? (
        <button type="button" class="btn" onClick={() => setCapturing(true)}>
          Reprendre les photos de {formatMonthLower(thisMonth)}
        </button>
      ) : (
        <button type="button" class="cta" onClick={() => setCapturing(true)}>
          <span class="cta__title">Photos de {formatMonthLower(thisMonth)}</span>
          <span class="cta__sub">Face puis profil · retardateur</span>
        </button>
      )}

      <section class="card card--quiet">
        <span class="muted">
          Téléphone posé à hauteur de taille, même endroit, même lumière, même tenue. Le contour de la photo précédente s’affiche
          en transparence pour reprendre la même pose.
        </span>
        <span class="muted">
          Les photos restent sur ce téléphone : ni galerie, ni envoi. Elles sont exclues de l’export, sauf si tu coches l’option
          dans Réglages.
        </span>
      </section>

      {allMonths.length > 0 && (
        <details class="card history">
          <summary class="history__summary">Gérer les photos</summary>
          <ul class="history__list">
            {allMonths.map((m) => (
              <li key={m} class="history__row">
                <span>{formatMonthLower(m)}</span>
                <span class="muted">
                  {PHOTO_POSES.filter((p) => photos.value.some((x) => x.month === m && x.pose === p))
                    .map((p) => POSE_TAB[p].toLowerCase())
                    .join(', ')}
                </span>
                <button type="button" class="btn btn--small btn--quiet" onClick={() => void remove(m)}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {capturing && <PhotoCapture onClose={() => setCapturing(false)} />}
    </main>
  );
}

/** Une photo de la comparaison, légendée : mois, tendance de poids et tour de taille du moment. */
function Figure({ photo }: { photo: PhotoRow | undefined }) {
  if (!photo) return null;
  const kg = trendAt(trend.value, photo.day);
  const waist = waists.value
    .filter((w) => Math.abs(daysBetween(w.day, photo.day)) <= WAIST_NEAR_DAYS)
    .sort((x, y) => Math.abs(daysBetween(x.day, photo.day)) - Math.abs(daysBetween(y.day, photo.day)))[0];
  const legend = [kg !== null ? formatKg(kg) : null, waist ? formatCm(waist.value) : null].filter(Boolean).join(' · ');
  return (
    <figure class="compare__item">
      <PhotoImg photo={photo} alt={`Photo ${photo.pose === 'front' ? 'de face' : 'de profil'}, ${formatMonthLower(photo.month)}`} />
      <figcaption class="compare__caption">
        <span>{formatMonthLower(photo.month)}</span>
        {legend && <span class="muted num">{legend}</span>}
      </figcaption>
    </figure>
  );
}

function MonthSelect({ label, value, months, onChange }: { label: string; value: string; months: string[]; onChange: (m: string) => void }) {
  return (
    <label class="select-chip">
      <span class="visually-hidden">{label}</span>
      <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonthLower(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
