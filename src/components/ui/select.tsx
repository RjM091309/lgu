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
}

export function Select({
  options,
  value = null,
  onChange,
  placeholder = 'Select option...',
  isSearchable = true,
}: SelectProps) {
  return (
    <ReactSelect
      options={options}
      value={value}
      onChange={(next: SingleValue<SelectOption>) => onChange(next ?? null)}
      isSearchable={isSearchable}
      placeholder={placeholder}
      classNamePrefix="lgu-select"
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: 40,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: state.isFocused ? 'rgba(27, 36, 142, 0.4)' : 'rgb(228 228 231)',
          boxShadow: state.isFocused ? '0 0 0 1px rgba(27, 36, 142, 0.12)' : 'none',
          '&:hover': {
            borderColor: state.isFocused ? 'rgba(27, 36, 142, 0.4)' : 'rgb(228 228 231)',
          },
          backgroundColor: 'hsl(var(--background))',
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
        }),
        menu: (base) => ({
          ...base,
          zIndex: 60,
        }),
        option: (base, state) => ({
          ...base,
          fontSize: 13,
          backgroundColor: state.isSelected
            ? 'rgba(27, 36, 142, 0.12)'
            : state.isFocused
              ? 'rgba(27, 36, 142, 0.06)'
              : base.backgroundColor,
          color: 'inherit',
        }),
      }}
    />
  );
}
