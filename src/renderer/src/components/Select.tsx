import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useMessages } from '@zero/renderer/i18n';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  color?: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
}

/** Normaliza para o filtro: sem acento e em minúsculas. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  searchable = false,
}: SelectProps<T>): JSX.Element {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!searchable || term === '') return options;
    return options.filter((option) => normalize(option.label).includes(term));
  }, [options, query, searchable]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      const root = rootRef.current;
      if (root !== null && !root.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const active = menuRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openMenu = (index: number): void => {
    setQuery('');
    setActiveIndex(index);
    setOpen(true);
  };

  const closeMenu = (): void => {
    setQuery('');
    setOpen(false);
  };

  const choose = (option: SelectOption<T>): void => {
    onChange(option.value);
    closeMenu();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

    if (!open) {
      if (!typing && event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(filtered.length - 1);
        break;
      case 'Enter': {
        const option = filtered[activeIndex];
        if (option !== undefined) {
          event.preventDefault();
          choose(option);
        }
        break;
      }
      case ' ': {
        // Com a busca aberta o espaço faz parte do texto digitado.
        if (typing) return;
        const option = filtered[activeIndex];
        if (option !== undefined) {
          event.preventDefault();
          choose(option);
        }
        break;
      }
      case 'Escape':
        event.stopPropagation();
        closeMenu();
        break;
      case 'Tab':
        closeMenu();
        break;
      default:
        break;
    }
  };

  return (
    <div className="select-root" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closeMenu() : openMenu(selectedIndex >= 0 ? selectedIndex : 0))}
      >
        {selected !== undefined ? (
          <span className="select-value">
            {selected.color !== undefined ? (
              <span className="select-dot" style={{ background: selected.color }} />
            ) : null}
            {selected.label}
          </span>
        ) : (
          <span className="select-placeholder">{placeholder ?? m.common.select}</span>
        )}
        <i className="fa-solid fa-chevron-down select-chevron" />
      </button>

      {open ? (
        <div className="select-menu" role="listbox" ref={menuRef}>
          {searchable ? (
            <div className="select-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              <input
                type="text"
                value={query}
                placeholder={m.common.searchOptions}
                aria-label={m.common.searchOptions}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
              />
              {query !== '' ? (
                <button
                  type="button"
                  className="select-search-clear"
                  title={m.common.clearSearch}
                  aria-label={m.common.clearSearch}
                  onClick={() => setQuery('')}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              ) : null}
            </div>
          ) : null}
          {filtered.map((option, index) => (
            <div
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex ? 'true' : undefined}
              className={`select-option${option.value === value ? ' selected' : ''}${
                index === activeIndex ? ' active' : ''
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              {option.color !== undefined ? (
                <span className="select-dot" style={{ background: option.color }} />
              ) : null}
              <span className="select-option-label">{option.label}</span>
              <i className="fa-solid fa-check select-check" />
            </div>
          ))}
          {filtered.length === 0 ? (
            <div className="select-empty">{m.common.noOptionsFound}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
