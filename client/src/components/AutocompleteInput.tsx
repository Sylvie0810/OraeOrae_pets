import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** endpoint returning string[] of past values, e.g. "/api/daily/suggestions/feeding" */
  suggestUrl: string;
  queryKey: string[];
  className?: string;
}

// Native datalist autocomplete fed by the user's past entries.
export function AutocompleteInput({ value, onChange, placeholder, suggestUrl, queryKey, className = "" }: Props) {
  const listId = useId();
  const { data: options } = useQuery({
    queryKey,
    queryFn: () => api<string[]>(suggestUrl),
    staleTime: 60_000,
  });
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 ${className}`}
      />
      <datalist id={listId}>
        {options?.map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}
