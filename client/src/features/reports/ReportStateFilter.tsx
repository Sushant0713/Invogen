import { useMemo } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { INDIAN_STATES } from '@/lib/location-data';

const ALL_STATES_LABEL = 'All States';

type ReportStateFilterProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ReportStateFilter({ value, onChange }: ReportStateFilterProps) {
  const options = useMemo(() => [ALL_STATES_LABEL, ...INDIAN_STATES], []);
  const displayValue = value === 'all' ? ALL_STATES_LABEL : value;

  return (
    <SearchableSelect
      value={displayValue}
      onChange={(selected) => onChange(selected === ALL_STATES_LABEL ? 'all' : selected)}
      options={options}
      placeholder={ALL_STATES_LABEL}
      searchPlaceholder="Search states..."
      emptyMessage="No matching states"
    />
  );
}
