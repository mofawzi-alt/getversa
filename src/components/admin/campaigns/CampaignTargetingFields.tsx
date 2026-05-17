import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export interface CampaignTargeting {
  gender: '' | 'male' | 'female';
  ageRanges: string[];
  countries: string; // comma separated
  cities: string; // comma separated
}

export const emptyTargeting = (): CampaignTargeting => ({
  gender: '',
  ageRanges: [],
  countries: '',
  cities: '',
});

const AGE_RANGES = ['18-24', '25-34', '35-44', '45+'];

interface Props {
  value: CampaignTargeting;
  onChange: (v: CampaignTargeting) => void;
}

export default function CampaignTargetingFields({ value, onChange }: Props) {
  const toggleAge = (a: string) => {
    const set = new Set(value.ageRanges);
    set.has(a) ? set.delete(a) : set.add(a);
    onChange({ ...value, ageRanges: Array.from(set) });
  };

  return (
    <div className="rounded-xl border border-border p-3 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Notify these users when launched</Label>
        <span className="text-[10px] text-muted-foreground">Leave empty = notify everyone</span>
      </div>

      <div>
        <Label className="text-xs">Gender</Label>
        <div className="flex gap-2 mt-1">
          {(['', 'male', 'female'] as const).map((g) => (
            <button
              key={g || 'all'}
              type="button"
              onClick={() => onChange({ ...value, gender: g })}
              className={`px-3 py-1.5 rounded-lg text-xs border ${
                value.gender === g ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background'
              }`}
            >
              {g === '' ? 'All' : g === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">Age ranges</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {AGE_RANGES.map((a) => {
            const on = value.ageRanges.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAge(a)}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  on ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background'
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Countries (comma separated)</Label>
          <Input
            value={value.countries}
            onChange={(e) => onChange({ ...value, countries: e.target.value })}
            placeholder="Egypt, UAE"
          />
        </div>
        <div>
          <Label className="text-xs">Cities (comma separated)</Label>
          <Input
            value={value.cities}
            onChange={(e) => onChange({ ...value, cities: e.target.value })}
            placeholder="Cairo, Alexandria"
          />
        </div>
      </div>
    </div>
  );
}

export function targetingToPayload(t: CampaignTargeting) {
  const splitCsv = (s: string) =>
    s.split(',').map((x) => x.trim()).filter(Boolean);
  return {
    target_gender: t.gender || null,
    target_age_ranges: t.ageRanges.length ? t.ageRanges : null,
    target_countries: t.countries.trim() ? splitCsv(t.countries) : null,
    target_cities: t.cities.trim() ? splitCsv(t.cities) : null,
  };
}
