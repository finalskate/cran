/**
 * Test pompes du mois (J6b) : le format (maison ou pro), les consignes, puis le résultat noté
 * APRÈS l'effort (pas de compteur à toucher pendant les pompes). Ensuite : record ou non, écart
 * avec le test précédent du même format, chemin vers 50, et l'historique.
 *
 * Règle de pause (choix du 09/11, à ajuster s'il le faut) : souffler bras tendus est permis, une
 * pause au sol ou genoux posés arrête le test.
 */
import { useState } from 'preact/hooks';
import { dayKey, dayToDate } from '../../domain/days';
import { bestTest, PUSHUP_TEST_GOAL, pushupTests, testOutcome } from '../../domain/pushupTest';
import type { PushupFormat, PushupTestActivity } from '../../domain/recovery';
import { formatTinyDate } from '../format';
import { activities, logPushupTest } from '../training';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';

const FORMATS: { value: PushupFormat; title: string; hint: string }[] = [
  { value: 'home', title: 'Maison · poitrine au sol', hint: 'Main à plat, la poitrine touche le sol à chaque répétition. Plus strict que le format pro.' },
  { value: 'pro', title: 'Pro · poitrine sur la cale', hint: 'Main à plat, la poitrine touche la cale à chaque répétition. Record à part.' },
];

const FORMAT_SHORT: Record<PushupFormat, string> = { home: 'maison', pro: 'pro' };

export function PushupTestSheet({ onClose }: { onClose: () => void }) {
  const tests = pushupTests(activities.value);
  const [format, setFormat] = useState<PushupFormat>(tests.at(-1)?.format ?? 'home');
  const [reps, setReps] = useState(bestTest(activities.value, format)?.reps ?? 30);
  const [saved, setSaved] = useState<PushupTestActivity | null>(null);

  function pickFormat(f: PushupFormat) {
    setFormat(f);
    setReps(bestTest(activities.value, f)?.reps ?? 30);
  }

  async function save() {
    const now = new Date();
    const test: PushupTestActivity = { type: 'pushup-test', day: dayKey(now), at: now.toISOString(), format, reps };
    await logPushupTest(test);
    setSaved(test);
  }

  if (saved) return <Result test={saved} onClose={onClose} />;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Test pompes"
      footer={
        <button type="button" class="cta cta--compact" onClick={() => void save()}>
          <span class="cta__title">Noter {reps} pompes</span>
        </button>
      }
    >
      <div class="choice-list" role="radiogroup" aria-label="Format du test">
        {FORMATS.map((f) => (
          <button key={f.value} type="button" class="choice choice--stack" role="radio" aria-checked={format === f.value} onClick={() => pickFormat(f.value)}>
            <span class="choice__title">{f.title}</span>
            <span class="muted choice__hint">{f.hint}</span>
          </button>
        ))}
      </div>
      <div class="row">
        <span>Pompes faites</span>
        <Stepper label="Pompes faites" value={reps} onChange={setReps} step={1} min={1} max={150} big />
      </div>
      <ul class="test-cues">
        <li>Échauffe-toi 5 minutes avant : bras, épaules, quelques pompes faciles.</li>
        <li>Le plus de pompes possible, amplitude complète. Souffler bras tendus est permis ; une pause au sol ou les genoux posés arrêtent le test.</li>
        <li>Main à plat : le poignet prend plus cher qu’avec les poignées, c’est un jour par mois, assumé.</li>
        <li>Note ton résultat une fois fini : rien à toucher pendant l’effort.</li>
      </ul>
    </Sheet>
  );
}

function Result({ test, onClose }: { test: PushupTestActivity; onClose: () => void }) {
  const outcome = testOutcome(test, activities.value);
  const history = pushupTests(activities.value).slice(-6).reverse();
  const left = PUSHUP_TEST_GOAL - test.reps;
  const title = outcome.record ? 'Nouveau record !' : outcome.delta === undefined ? 'Premier test noté' : 'Test noté';
  return (
    <Sheet open onClose={onClose} title={title} kicker={`Test pompes · ${FORMAT_SHORT[test.format]}`} footer={
      <button type="button" class="cta cta--compact" onClick={onClose}>
        <span class="cta__title">Terminer</span>
      </button>
    }>
      <div class={`test-result${outcome.record ? ' test-result--record' : ''}`}>
        <span class="test-result__n num">{test.reps}</span>
        {outcome.delta !== undefined && outcome.delta !== 0 && (
          <span class={outcome.delta > 0 ? 'accent' : 'muted'}>
            {outcome.delta > 0 ? `+${outcome.delta}` : `${outcome.delta}`} depuis le dernier test {FORMAT_SHORT[test.format]}
          </span>
        )}
        {outcome.delta === 0 && <span class="muted">Comme la dernière fois : c’est tenu.</span>}
        {outcome.delta === undefined && <span class="muted">Le point de départ : le prochain se comparera à lui.</span>}
      </div>
      {left > 0 ? (
        <div class="test-goal">
          <span class="card__label">Vers {PUSHUP_TEST_GOAL}</span>
          <span class="test-goal__bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (test.reps / PUSHUP_TEST_GOAL) * 100)}%` }} />
          </span>
          <span class="muted">Encore {left}. Le badge « {PUSHUP_TEST_GOAL} pompes au test » t’attend.</span>
        </div>
      ) : (
        <p style={{ margin: 0 }}>
          {PUSHUP_TEST_GOAL} pompes et plus : <strong>l’exigence est tenue.</strong> Le badge est à toi.
        </p>
      )}
      <div class="import-block">
        <span class="card__label">Tes tests</span>
        {history.map((t) => (
          <div key={t.at} class="row records__row">
            <span>
              {formatTinyDate(t.day)} · {FORMAT_SHORT[t.format]}
            </span>
            <span class="num records__value">{t.reps}</span>
          </div>
        ))}
        <span class="muted card__hint">Un record par format : la cale et le sol ne se comparent pas.</span>
      </div>
      <span class="muted card__hint">Prochain test à partir du 1er du mois prochain. Il compte comme ta série longue de la semaine.</span>
    </Sheet>
  );
}

/** Pour l'accueil : « Dernier : 42 en novembre ». */
export function lastTestText(last: PushupTestActivity | null): string {
  if (!last) return 'Premier test : il donnera ton point de départ.';
  const month = dayToDate(last.day).toLocaleDateString('fr-FR', { month: 'long' });
  return `Dernier : ${last.reps} en ${month} (${FORMAT_SHORT[last.format]}).`;
}
