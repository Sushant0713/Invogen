import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import {
  getReportPresetRange,
  REPORT_DATE_PRESETS,
  type ReportDatePreset,
} from '@/features/reports/report-filters';

export type ReportDatePresetSelection = ReportDatePreset | 'custom';

const selectClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

interface ReportDateRangeFiltersProps {
  datePreset: ReportDatePresetSelection;
  fromDate: string;
  toDate: string;
  onPresetChange: (preset: ReportDatePreset) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  fieldClassName?: string;
}

/** Date range preset + From/To calendar pickers for admin report tabs. */
export function ReportDateRangeFilters({
  datePreset,
  fromDate,
  toDate,
  onPresetChange,
  onFromChange,
  onToChange,
  fieldClassName = 'block min-w-[150px] flex-1',
}: ReportDateRangeFiltersProps) {
  return (
    <>
      <label className={fieldClassName}>
        <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <CalendarRange className="h-3.5 w-3.5" />
          Date Range
        </span>
        <select
          className={selectClassName}
          value={datePreset === 'custom' ? 'custom' : datePreset}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'custom') return;
            onPresetChange(value as ReportDatePreset);
          }}
        >
          {REPORT_DATE_PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>

      <label className={fieldClassName}>
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          From
        </span>
        <Input
          type="date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(event) => onFromChange(event.target.value)}
        />
      </label>

      <label className={fieldClassName}>
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          To
        </span>
        <Input
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(event) => onToChange(event.target.value)}
        />
      </label>
    </>
  );
}

export function useReportDateRangeState(initialPreset: ReportDatePreset = 'this_month') {
  const initial = getReportPresetRange(initialPreset);
  const [datePreset, setDatePreset] = useState<ReportDatePresetSelection>(initialPreset);
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);

  const applyPreset = (preset: ReportDatePreset) => {
    const next = getReportPresetRange(preset);
    setDatePreset(preset);
    setFromDate(next.from);
    setToDate(next.to);
  };

  const changeFrom = (next: string) => {
    setFromDate(next);
    setDatePreset('custom');
    if (toDate && next && next > toDate) {
      setToDate(next);
    }
  };

  const changeTo = (next: string) => {
    setToDate(next);
    setDatePreset('custom');
    if (fromDate && next && next < fromDate) {
      setFromDate(next);
    }
  };

  return {
    datePreset,
    fromDate,
    toDate,
    applyPreset,
    changeFrom,
    changeTo,
  };
}
