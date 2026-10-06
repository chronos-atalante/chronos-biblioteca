import { useEffect, useRef, useState } from 'react';
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
}

export default function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
}: SelectProps<T>): JSX.Element {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

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
    if (!open) return;
    const active = menuRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openMenu = (index: number): void => {
    setActiveIndex(index);
    setOpen(true);
  };

  const choose = (option: SelectOption<T>): void => {
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (!open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, options.length - 1));
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
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ': {
        const option = options[activeIndex];
        if (option !== undefined) {
          event.preventDefault();
          choose(option);
        }
        break;
      }
      case 'Escape':
        event.stopPropagation();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
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
        onClick={() => (open ? setOpen(false) : openMenu(selectedIndex >= 0 ? selectedIndex : 0))}
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
          {options.map((option, index) => (
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
        </div>
      ) : null}
    </div>
  );
}
