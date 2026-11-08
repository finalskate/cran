/**
 * « Mes plans si… alors… » (J4B, SPEC §4.8) : la liste complète, regroupée par déclencheur,
 * modifiable. Les plans de départ (génériques) se personnalisent ici ; les plans servent
 * surtout au moment d'un écart, dans le bilan du soir.
 */
import { useState } from 'preact/hooks';
import { TRIGGER_LABEL } from '../../data/habits';
import { plansFor, TRIGGERS, type IfThenPlan, type Trigger } from '../../domain/habits';
import { Sheet } from '../components/Sheet';
import { plans, savePlans } from '../habitsState';
import { PlanForm, PlanText } from './PlanForm';

export function PlansSheet({ onClose }: { onClose: () => void }) {
  // Plan en cours de modification (id), ou déclencheur choisi pour un nouveau plan.
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<Trigger | 'choose' | null>(null);
  const list = plans.value;

  async function update(id: string, plan: { when: string; then: string }) {
    await savePlans(
      list.map((p) => (p.id === id ? { ...p, ...plan } : p)),
      'edit',
    );
    setEditing(null);
  }

  async function remove(p: IfThenPlan) {
    if (!confirm(`Supprimer le plan « Si ${p.when} » ?`)) return;
    await savePlans(
      list.filter((x) => x.id !== p.id),
      'delete',
    );
  }

  async function add(trigger: Trigger, plan: { when: string; then: string }) {
    await savePlans([...list, { id: crypto.randomUUID(), trigger, ...plan }], 'add');
    setAdding(null);
  }

  return (
    <Sheet open onClose={onClose} title="Mes plans" kicker="Si… alors…">
      <p class="muted sheet__lead">
        Une situation qui fait craquer, et ce que tu fais à la place, décidé à l’avance. Le plan s’affiche quand tu notes un
        écart avec ce déclencheur. Écris-les avec tes mots, au plus près de ta vie.
      </p>

      {TRIGGERS.map((t) => {
        const group = plansFor(list, t);
        if (group.length === 0) return null;
        return (
          <section key={t} class="plan-group" aria-label={TRIGGER_LABEL[t]}>
            <span class="card__label">{TRIGGER_LABEL[t]}</span>
            {group.map((p) =>
              editing === p.id ? (
                <PlanForm
                  key={p.id}
                  idPrefix={`plan-${p.id}`}
                  initial={p}
                  submitLabel="Enregistrer"
                  onSubmit={(next) => void update(p.id, next)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div key={p.id} class="plan-row">
                  <PlanText when={p.when} then={p.then} />
                  <div class="plan-row__actions">
                    <button type="button" class="btn btn--small btn--quiet" onClick={() => setEditing(p.id)}>
                      Modifier
                    </button>
                    <button type="button" class="btn btn--small btn--quiet" onClick={() => void remove(p)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ),
            )}
          </section>
        );
      })}

      {adding === null && (
        <button type="button" class="btn" onClick={() => setAdding('choose')}>
          Ajouter un plan
        </button>
      )}
      {adding === 'choose' && (
        <section class="plan-group" aria-labelledby="plan-new">
          <span id="plan-new" class="card__label">
            Pour quel déclencheur ?
          </span>
          <div class="segmented segmented--grid">
            {TRIGGERS.map((t) => (
              <button key={t} type="button" class="btn btn--small" onClick={() => setAdding(t)}>
                {TRIGGER_LABEL[t]}
              </button>
            ))}
          </div>
        </section>
      )}
      {adding !== null && adding !== 'choose' && (
        <section class="plan-group" aria-label={`Nouveau plan : ${TRIGGER_LABEL[adding]}`}>
          <span class="card__label">{TRIGGER_LABEL[adding]}</span>
          <PlanForm idPrefix="plan-new" submitLabel="Ajouter" onSubmit={(p) => void add(adding, p)} onCancel={() => setAdding(null)} />
        </section>
      )}
    </Sheet>
  );
}
