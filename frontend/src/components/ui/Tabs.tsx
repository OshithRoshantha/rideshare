import clsx from "clsx";

interface TabsProps<T extends string> {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Tabs<T extends string>({ tabs, value, onChange }: TabsProps<T>) {
  return (
    <div className="flex gap-6 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            "relative -mb-px border-b-2 px-1 py-3 text-sm font-medium transition-colors",
            value === tab.value ? "border-accent text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
