export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

const INDIA_STATE_CODES: Record<string, string> = {
  'andhra pradesh': '37',
  'arunachal pradesh': '12',
  assam: '18',
  bihar: '10',
  chhattisgarh: '22',
  goa: '30',
  gujarat: '24',
  haryana: '06',
  'himachal pradesh': '02',
  jharkhand: '20',
  karnataka: '29',
  kerala: '32',
  'madhya pradesh': '23',
  maharashtra: '27',
  manipur: '14',
  meghalaya: '17',
  mizoram: '15',
  nagaland: '13',
  odisha: '21',
  orissa: '21',
  punjab: '03',
  rajasthan: '08',
  sikkim: '11',
  'tamil nadu': '33',
  telangana: '36',
  tripura: '16',
  'uttar pradesh': '09',
  uttarakhand: '05',
  'west bengal': '19',
  'andaman and nicobar islands': '35',
  chandigarh: '04',
  'dadra and nagar haveli and daman and diu': '26',
  delhi: '07',
  'jammu and kashmir': '01',
  ladakh: '38',
  lakshadweep: '31',
  puducherry: '34',
};

function normalizedStateName(state: string): string {
  return state
    .trim()
    .replace(/\s*\(\d{1,2}\)\s*$/, '')
    .replace(/\s+/g, ' ');
}

export function getIndianStateCode(state: string): string {
  return INDIA_STATE_CODES[normalizedStateName(state).toLowerCase()] ?? '';
}

export function formatIndianStateWithCode(state: string): string {
  const name = normalizedStateName(state);
  if (!name) return '';
  const code = getIndianStateCode(name);
  return code ? `${name} (${code})` : name;
}

export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
] as const;

export function getStatesForCountry(country: string): readonly string[] | null {
  if (country === 'India') return INDIAN_STATES;
  if (country === 'United States') return US_STATES;
  return null;
}
