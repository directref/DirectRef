'use client';

import { useEffect, useRef, useState } from 'react';
import { pfx } from '@/app/(app)/settings/tokens';

const inputClass =
  'w-full rounded-[10px] border px-3 py-2.5 text-[13.5px] outline-none transition-colors focus:border-[oklch(0.72_0.13_85)]';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, id, className, ...props }: FieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className="block text-[12.5px] font-medium mb-1.5"
        style={{ color: pfx.inkSecondary }}
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`${inputClass} ${className ?? ''}`}
        style={{ background: pfx.surface, borderColor: pfx.border, color: pfx.ink }}
        {...props}
      />
    </div>
  );
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({ label, id, options, placeholder, className, ...props }: SelectFieldProps) {
  const selectId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="w-full">
      <label
        htmlFor={selectId}
        className="block text-[12.5px] font-medium mb-1.5"
        style={{ color: pfx.inkSecondary }}
      >
        {label}
      </label>
      <select
        id={selectId}
        className={`${inputClass} ${className ?? ''}`}
        style={{ background: pfx.surface, borderColor: pfx.border, color: pfx.ink }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

interface ComboboxFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  id?: string;
  className?: string;
}

/** Text field + filtered dropdown, combined: typing filters the option list
 *  (typeahead), and anything typed that isn't in the list just becomes the
 *  value as free text — no separate "Other" field needed. Also opens on
 *  focus/click, unfiltered when the current value already matches an
 *  option exactly, so the full list is always just as scrollable-and-
 *  clickable as typing to search. */
export function ComboboxField({ label, value, onChange, options, placeholder, id, className }: ComboboxFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // While the current text exactly matches a known option, treat opening as
  // "browse the whole list" rather than "narrow a search" — otherwise
  // clicking into an already-set field would show just the one match.
  const isExactMatch = options.some((o) => o.label === value);
  const query = value.trim();
  const filtered = query && !isExactMatch
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectOption = (opt: { value: string; label: string }) => {
    onChange(opt.value);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { if (open && highlighted >= 0 && filtered[highlighted]) { e.preventDefault(); selectOption(filtered[highlighted]); } }
    else if (e.key === 'Escape') { setOpen(false); setHighlighted(-1); }
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      <label htmlFor={fieldId} className="block text-[12.5px] font-medium mb-1.5" style={{ color: pfx.inkSecondary }}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={fieldId}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        className={`${inputClass} ${className ?? ''}`}
        style={{ background: pfx.surface, borderColor: pfx.border, color: pfx.ink }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-[10px] border shadow-lg"
          style={{ background: pfx.surface, borderColor: pfx.border }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-[13px]" style={{ color: pfx.inkMuted }}>
              No matches — this will be saved as typed
            </li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                // mousedown (not click) fires before the input's blur/outside-click close
                onMouseDown={(e) => { e.preventDefault(); selectOption(o); }}
                onMouseEnter={() => setHighlighted(i)}
                className="px-3 py-2 text-[13.5px] cursor-pointer"
                style={{
                  background: i === highlighted ? pfx.goldSoft : 'transparent',
                  color: pfx.ink,
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
