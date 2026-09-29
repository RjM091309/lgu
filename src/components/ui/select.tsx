import ReactSelect, { type SingleValue } from 'react-select';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: SelectOption | null;
  onChange: (option: SelectOption | null) => void;
  placeholder?: string;
  isSearchable?: boolean;
  'aria-label'?: string;
}

export function Select({
  options,
  value = null,
  onChange,
  placeholder = 'Select option...',
  isSearchable = true,
  'aria-label': ariaLabel,
}: SelectProps) {
  return (
    <ReactSelect
      options={options}
      value={value}
      onChange={(next: SingleValue<SelectOption>) => onChange(next ?? null)}
      isSearchable={isSearchable}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      classNamePrefix="lgu-select"
      // Fixed positioning lets the menu escape cards with overflow-hidden instead of being cut off.
      menuPosition="fixed"
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: 40,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: state.isFocused ? 'var(--color-primary)' : 'var(--color-border)',
          boxShadow: state.isFocused ? '0 0 0 1px rgba(27, 36, 142, 0.12)' : 'none',
          '&:hover': {
            borderColor: state.isFocused ? 'var(--color-primary)' : 'var(--color-border)',
          },
          backgroundColor: 'var(--color-surface)',
        }),
        valueContainer: (base) => ({
          ...base,
          padding: '0 12px',
          fontSize: 14,
        }),
        input: (base) => ({
          ...base,
          margin: 0,
          padding: 0,
          color: 'var(--color-text-main)',
        }),
        singleValue: (base) => ({ ...base, color: 'var(--color-text-main)' }),
        placeholder: (base) => ({ ...base, color: 'var(--color-text-muted)' }),
        menu: (base) => ({
          ...base,
          zIndex: 60,
          backgroundColor: 'var(--color-popover)',
          border: '1px solid var(--color-border)',
        }),
        option: (base, state) => ({
          ...base,
          fontSize: 13,
          backgroundColor: state.isSelected
            ? 'color-mix(in srgb, var(--color-primary) 22%, transparent)'
            : state.isFocused
              ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
              : 'transparent',
          color: 'var(--color-text-main)',
        }),
      }}
    />
  );
}
