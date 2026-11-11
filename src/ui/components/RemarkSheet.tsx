/**
 * Remarques d'usage (retouche du 11/11) : le bouton « Signaler » des écrans et le panneau de
 * saisie. Le contexte (écran, version, séance en cours) est relevé tout seul à l'ouverture ;
 * l'utilisateur écrit (ou dicte), coche une étiquette s'il veut, et peut joindre une capture
 * prise avec Android. La remarque reste sur le téléphone et part avec le prochain export.
 */
import { useState } from 'preact/hooks';
import { canSaveRemark, REMARK_TAGS, type RemarkContext, type RemarkTag } from '../../domain/remarks';
import type { RouteName } from '../../domain/route';
import { readCapture } from '../device/capture';
import { closeRemark, openRemark, remarkDraft, saveRemark } from '../remarksState';
import { Sheet } from './Sheet';

export const REMARK_TAG_LABEL: Record<RemarkTag, string> = {
  bug: 'Bug',
  unclear: 'Pas clair',
  unfit: 'Pas adapté',
  idea: 'Idée',
};

/** Nom des écrans tel que l'utilisateur les connaît. */
export const SCREEN_LABEL: Record<RouteName, string> = {
  today: 'Aujourd’hui',
  settings: 'Réglages',
  journal: 'Carnet',
  levels: 'Carnet › Niveaux',
  body: 'Carnet › Corps',
  photos: 'Photos',
  locations: 'Lieux',
  knee: 'Genou avant la séance',
  preview: 'Aperçu de la séance',
  session: 'Séance',
  summary: 'Bilan de séance',
  'week-review': 'Bilan de la semaine',
  food: 'Assiette',
  profile: 'Profil',
  figures: 'Mannequin',
};

/** Ce qui a été relevé, en une ligne (pour que l'utilisateur sache qu'il n'a pas à le décrire). */
export function contextLine(context: RemarkContext): string {
  const s = context.session;
  if (s) return `${s.variantName} · série ${s.set} sur ${s.sets}${s.phase === 'rest' ? ' (repos)' : ''}`;
  if (context.origin === 'shortcut') {
    return context.lastScreen ? `Dernier écran vu : ${SCREEN_LABEL[context.lastScreen.name as RouteName] ?? context.lastScreen.name}` : 'Depuis le raccourci';
  }
  return SCREEN_LABEL[context.screen as RouteName] ?? context.screen;
}

/** Bulle de dialogue au trait (icône du bouton « Signaler »). */
export function RemarkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M12 8.5v3M12 13.6v.1" />
    </svg>
  );
}

/** Bouton discret en haut à droite d'un écran. */
export function RemarkButton() {
  return (
    <button type="button" class="icon-btn icon-btn--round remark-btn" aria-label="Signaler quelque chose" onClick={() => void openRemark('screen')}>
      <RemarkIcon />
    </button>
  );
}

/** Panneau monté une fois dans App ; il s'ouvre dès qu'une remarque est demandée. */
export function RemarkSheet() {
  const draft = remarkDraft.value;
  // Clé : un nouveau panneau repart d'une saisie vide.
  return draft ? <RemarkForm key={`${draft.origin}:${draft.screen}:${draft.session?.variantId ?? ''}`} context={draft} /> : null;
}

function RemarkForm({ context }: { context: RemarkContext }) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState<RemarkTag[]>([]);
  const [capture, setCapture] = useState<string | undefined>();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggle(tag: RemarkTag) {
    setTags((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));
  }

  async function pick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ''; // la même image pourra être choisie de nouveau
    if (!file) return;
    setError('');
    setReading(true);
    try {
      setCapture(await readCapture(file));
    } catch {
      setError('Image illisible : essaie une autre capture.');
    } finally {
      setReading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await saveRemark({ at: Date.now(), text: text.trim(), tags, context, ...(capture ? { capture } : {}) });
      setSaved(true);
    } catch (e) {
      setError(`Pas pu l’enregistrer : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  // « Noter » (puis « Fermer ») reste dans le pied du panneau : visible même clavier ouvert.
  const footer = saved ? (
    <button type="button" class="btn btn--accent" onClick={closeRemark}>
      Fermer
    </button>
  ) : (
    <button type="button" class="btn btn--accent" disabled={saving || reading || !canSaveRemark(text, capture)} onClick={() => void save()}>
      {saving ? 'Enregistrement…' : 'Noter'}
    </button>
  );

  return (
    <Sheet open onClose={closeRemark} title="Signaler" kicker="Ce qui ne va pas" footer={footer}>
      {saved ? (
        <div class="remark-form">
          <p class="remark-done">Noté ✓</p>
          <p class="muted remark-hint">Elle partira avec ton prochain export. Tu la retrouves dans Réglages → Mes remarques.</p>
        </div>
      ) : (
        <div class="remark-form">
          <p class="muted remark-hint">
            <span class="remark-context">{contextLine(context)}</span> : écran, heure et version sont notés tout seuls.
          </p>
          <div class="field">
            <label for="remark-text">Ce qui ne va pas</label>
            <textarea
              id="remark-text"
              rows={4}
              placeholder="Ce qui gêne, ce qui n’est pas clair, une idée… (la dictée du clavier marche)"
              value={text}
              onInput={(e) => setText(e.currentTarget.value)}
            />
          </div>
          <div class="segmented segmented--grid" role="group" aria-label="Étiquettes (facultatif)">
            {REMARK_TAGS.map((t) => (
              <button key={t} type="button" class="btn btn--small" role="checkbox" aria-checked={tags.includes(t)} onClick={() => toggle(t)}>
                {REMARK_TAG_LABEL[t]}
              </button>
            ))}
          </div>
          {capture ? (
            <div class="remark-capture">
              <img src={capture} alt="Capture jointe" />
              <button type="button" class="btn btn--small btn--quiet" onClick={() => setCapture(undefined)}>
                Retirer la capture
              </button>
            </div>
          ) : (
            <>
              <label class="btn btn--quiet file-btn">
                {reading ? 'Lecture…' : 'Joindre une capture'}
                <input type="file" accept="image/*" class="visually-hidden" onChange={(e) => void pick(e.currentTarget)} />
              </label>
              <p class="muted remark-hint">Prends-la avec Android avant d’ouvrir ce panneau (marche + volume bas), puis choisis-la ici.</p>
            </>
          )}
          {error && (
            <p class="notice-line" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
