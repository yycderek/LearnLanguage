"use client";

import { Check } from "lucide-react";

export function ReferencePicker({
  label,
  options,
  selected,
  emptyLabel,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  emptyLabel: string;
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="reference-picker wide">
      <legend>{label}</legend>
      {options.length === 0 ? <p>{emptyLabel}</p> : <div>{options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <button
            type="button"
            key={option.id}
            className={active ? "selected" : ""}
            aria-pressed={active}
            onClick={() => onChange(active ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
          >
            {active && <Check size={12} />}
            <span>{option.label}</span>
          </button>
        );
      })}</div>}
    </fieldset>
  );
}

