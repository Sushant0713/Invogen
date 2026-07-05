export const DEFAULT_ADDRESS_TITLE = 'Address';

export type AddressFieldKey = 'city' | 'state' | 'postalCode' | 'country';

export type AddressFieldDef = {
  key: AddressFieldKey;
  label: string;
  placeholder: string;
};

export const ADDRESS_DETAIL_FIELDS: AddressFieldDef[] = [
  { key: 'city', label: 'City', placeholder: 'Mumbai' },
  { key: 'state', label: 'State', placeholder: 'Maharashtra' },
  { key: 'postalCode', label: 'Postal code', placeholder: '400001' },
  { key: 'country', label: 'Country', placeholder: 'India' },
];

export type AddressData = {
  title: string;
  lines: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const PROP_KEYS: Record<AddressFieldKey, string> = {
  city: 'addressCity',
  state: 'addressState',
  postalCode: 'addressPostalCode',
  country: 'addressCountry',
};

export const DEFAULT_ADDRESS: AddressData = {
  title: DEFAULT_ADDRESS_TITLE,
  lines: ['123 Business Street'],
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'India',
};

export function formatAddressValue(data: AddressData): string {
  const parts: string[] = [];

  for (const line of data.lines) {
    if (line.trim()) parts.push(line.trim());
  }

  const city = data.city.trim();
  const state = data.state.trim();
  const postal = data.postalCode.trim();

  if (city || state || postal) {
    const cityState = [city, state].filter(Boolean).join(', ');
    if (cityState && postal) {
      parts.push(`${cityState} ${postal}`);
    } else if (cityState) {
      parts.push(cityState);
    } else if (postal) {
      parts.push(postal);
    }
  }

  if (data.country.trim()) {
    parts.push(data.country.trim());
  }

  return parts.join('\n');
}

function hasStructuredAddress(props: Record<string, unknown>): boolean {
  return (
    Array.isArray(props.addressLines)
    || typeof props.addressCity === 'string'
    || typeof props.addressState === 'string'
    || typeof props.addressPostalCode === 'string'
    || typeof props.addressCountry === 'string'
  );
}

function parseLegacyAddressValue(value: string): Partial<AddressData> {
  const parts = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (parts.length === 0) return {};

  if (parts.length === 1) {
    return { lines: [parts[0]] };
  }

  const last = parts[parts.length - 1];
  const cityStateZip = parts.length >= 2 ? parts[parts.length - 2] : '';
  const cityStateZipMatch = cityStateZip.match(/^(.+?),\s*(.+?)\s+(\S+)$/);

  if (cityStateZipMatch && parts.length >= 2) {
    return {
      lines: parts.slice(0, -2),
      city: cityStateZipMatch[1].trim(),
      state: cityStateZipMatch[2].trim(),
      postalCode: cityStateZipMatch[3].trim(),
      country: parts.length >= 3 ? last : '',
    };
  }

  return { lines: parts };
}

export function parseAddressFromProps(props: Record<string, unknown>): AddressData {
  const title =
    (typeof props.addressTitle === 'string' && props.addressTitle.trim()
      ? props.addressTitle.trim()
      : typeof props.label === 'string' && props.label.trim()
        ? props.label.trim()
        : DEFAULT_ADDRESS_TITLE);

  if (hasStructuredAddress(props)) {
    const lines = Array.isArray(props.addressLines)
      ? props.addressLines.map((line) => (typeof line === 'string' ? line : ''))
      : [...DEFAULT_ADDRESS.lines];

    return {
      title,
      lines: lines.length > 0 ? lines : [''],
      city: typeof props.addressCity === 'string' ? props.addressCity : DEFAULT_ADDRESS.city,
      state: typeof props.addressState === 'string' ? props.addressState : DEFAULT_ADDRESS.state,
      postalCode:
        typeof props.addressPostalCode === 'string'
          ? props.addressPostalCode
          : DEFAULT_ADDRESS.postalCode,
      country:
        typeof props.addressCountry === 'string' ? props.addressCountry : DEFAULT_ADDRESS.country,
    };
  }

  const value = typeof props.value === 'string' ? props.value : '';
  const legacy = parseLegacyAddressValue(value);

  return {
    title,
    lines: legacy.lines?.length ? legacy.lines : value.trim() ? [value.trim()] : [''],
    city: legacy.city ?? '',
    state: legacy.state ?? '',
    postalCode: legacy.postalCode ?? '',
    country: legacy.country ?? '',
  };
}

export function buildAddressProps(
  data: AddressData,
  baseProps: Record<string, unknown> = {}
): Record<string, unknown> {
  const title = data.title.trim() || DEFAULT_ADDRESS_TITLE;
  const lines = data.lines.length > 0 ? data.lines : [''];
  const value = formatAddressValue({ ...data, title, lines });

  return {
    ...baseProps,
    label: title,
    addressTitle: title,
    addressLines: lines,
    addressCity: data.city,
    addressState: data.state,
    addressPostalCode: data.postalCode,
    addressCountry: data.country,
    value,
  };
}

export function getDefaultAddressProps(): Record<string, unknown> {
  return {
    ...buildAddressProps(DEFAULT_ADDRESS),
    fontSize: 12,
    color: '#000000',
  };
}

export function addressDetailValue(data: AddressData, key: AddressFieldKey): string {
  return data[key];
}

export function addressPropKey(key: AddressFieldKey): string {
  return PROP_KEYS[key];
}
