/**
 * Interrupteur on/off accessible (role="switch"), toute la ligne est cliquable.
 */
import type { ComponentChildren } from 'preact';

interface Props {
  label: string;
  hint?: ComponentChildren;
  checked: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ label, hint, checked, onChange }: Props) {
  return (
    <button type="button" role="switch" aria-checked={checked} class="toggle" onClick={() => onChange(!checked)}>
      <span class="toggle__text">
        <span>{label}</span>
        {hint && <span class="muted toggle__hint">{hint}</span>}
      </span>
      <span class="toggle__track" aria-hidden="true">
        <span class="toggle__thumb" />
      </span>
    </button>
  );
}
