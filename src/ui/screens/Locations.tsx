/**
 * Lieux et matériel (SPEC §4.2) : chaque lieu se modifie (matériel, espace, nom),
 * on peut en créer, en dupliquer (ex. le même lieu avec un équipement en plus certains jours)
 * ou en supprimer. Le moteur ne propose que ce qui est faisable sur le lieu choisi.
 *
 * Retouche du 08/11 : « Mes élastiques » (forces en kg), communs à tous les lieux.
 */
import { useState } from 'preact/hooks';
import { track } from '../../data/usage';
import { bandLabels, parseBands } from '../../domain/bands';
import { EQUIPMENT, SPACES } from '../../data/equipment';
import { deleteLocation, saveLocation } from '../../data/repo';
import type { EquipmentTag, Location, SpaceSize } from '../../domain/types';
import { locations, prefs, reloadLocations, setPref } from '../state';

export function Locations() {
  const [open, setOpen] = useState<string | null>(null);
  // Saisie en cours des élastiques (enregistrée en quittant le champ, puis remise au propre).
  const [bandsText, setBandsText] = useState(prefs.value.bands.join(', '));

  async function update(loc: Location) {
    await saveLocation(loc);
    await reloadLocations();
  }

  async function create() {
    const id = `loc-${Date.now().toString(36)}`;
    const order = Math.max(-1, ...locations.value.map((l) => l.order)) + 1;
    await update({ id, name: 'Nouveau lieu', equipment: [], space: 'small', order });
    setOpen(id);
  }

  async function duplicate(loc: Location) {
    const id = `loc-${Date.now().toString(36)}`;
    const order = Math.max(-1, ...locations.value.map((l) => l.order)) + 1;
    await update({ ...loc, id, name: `${loc.name} (copie)`.slice(0, 30), order });
    setOpen(id);
  }

  async function saveBands(text: string) {
    const bands = parseBands(text);
    track('bands', { count: bands.length });
    await setPref('bands', bands);
    setBandsText(bands.join(', '));
  }

  async function remove(loc: Location) {
    if (locations.value.length <= 1) return;
    if (!confirm(`Supprimer « ${loc.name} » ?`)) return;
    await deleteLocation(loc.id);
    await reloadLocations();
    if (prefs.value.lastLocationId === loc.id) await setPref('lastLocationId', locations.value[0]!.id);
    setOpen(null);
  }

  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">Matériel disponible</span>
        <h1 class="screen-header__title">Lieux</h1>
      </header>

      {locations.value.map((loc) => {
        const isOpen = open === loc.id;
        const toggle = (tag: EquipmentTag) =>
          void update({
            ...loc,
            equipment: loc.equipment.includes(tag) ? loc.equipment.filter((t) => t !== tag) : [...loc.equipment, tag],
          });
        return (
          <section key={loc.id} class="card">
            <button type="button" class="row row--button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : loc.id)}>
              <span class="card__title">{loc.name}</span>
              <span class="muted" style={{ fontSize: '13px' }}>
                {loc.equipment.length} équipement{loc.equipment.length > 1 ? 's' : ''} {isOpen ? '▴' : '▾'}
              </span>
            </button>

            {isOpen && (
              <>
                <NameField key={loc.id} name={loc.name} onSave={(name) => void update({ ...loc, name })} />

                <label class="field">
                  <span class="card__label">Espace</span>
                  <select value={loc.space} onChange={(e) => void update({ ...loc, space: e.currentTarget.value as SpaceSize })}>
                    {SPACES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset class="field">
                  <legend class="card__label">Matériel</legend>
                  {EQUIPMENT.map((e) => (
                    <label key={e.tag} class="check">
                      <input type="checkbox" checked={loc.equipment.includes(e.tag)} onChange={() => toggle(e.tag)} />
                      <span>
                        {e.label}
                        {e.hint && <span class="muted check__hint">{e.hint}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>

                <button type="button" class="btn" onClick={() => void duplicate(loc)}>
                  Dupliquer ce lieu
                </button>
                {locations.value.length > 1 && (
                  <button type="button" class="btn btn--danger" onClick={() => void remove(loc)}>
                    Supprimer ce lieu
                  </button>
                )}
              </>
            )}
          </section>
        );
      })}

      <button type="button" class="btn" onClick={() => void create()}>
        + Nouveau lieu
      </button>

      <section class="card" aria-labelledby="bands-title">
        <span id="bands-title" class="card__label">
          Mes élastiques
        </span>
        <label class="field">
          <span class="muted">Forces en kg, séparées par des virgules (écrites sur l’élastique)</span>
          <input
            type="text"
            placeholder="ex. 10, 20, 30"
            value={bandsText}
            onInput={(e) => setBandsText(e.currentTarget.value)}
            // onBlur et non onChange : avec Preact 11, onChange suit chaque frappe (comme React).
            onBlur={(e) => void saveBands(e.currentTarget.value)}
          />
        </label>
        <span class="muted">
          En séance : {bandLabels(prefs.value.bands).join(' · ')}. Au haut de la fourchette, l’appli passe à l’élastique suivant,
          puis au niveau au-dessus.
        </span>
      </section>
    </main>
  );
}

/**
 * Nom d'un lieu : saisi librement, enregistré en quittant le champ. (Avec Preact 11, onChange
 * suit chaque frappe : enregistrer à chaque lettre, nom nettoyé, avalait les espaces.)
 */
function NameField({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  return (
    <label class="field">
      <span class="card__label">Nom</span>
      <input
        type="text"
        value={draft}
        maxLength={30}
        onInput={(e) => setDraft(e.currentTarget.value)}
        onBlur={() => {
          const clean = draft.trim();
          if (clean && clean !== name) onSave(clean);
          else setDraft(name);
        }}
      />
    </label>
  );
}
