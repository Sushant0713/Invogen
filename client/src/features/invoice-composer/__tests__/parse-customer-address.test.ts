import { describe, expect, it } from 'vitest';
import { parseCustomerAddress } from '../parse-customer-address';

describe('parseCustomerAddress', () => {
  it('parses the common street / city, state / country pin shape', () => {
    expect(
      parseCustomerAddress('Suryanagar, Plot 4\nMumbai, Maharashtra\nIndia 400059')
    ).toEqual({
      street: 'Suryanagar, Plot 4',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      zipCode: '400059',
    });
  });

  it('strips the GST state code suffix', () => {
    const parsed = parseCustomerAddress('Plot 7\nmumbai, Maharashtra (27)\nIndia 400059');
    expect(parsed.state).toBe('Maharashtra');
    expect(parsed.city).toBe('mumbai');
  });

  it('finds the pin code on any line', () => {
    const parsed = parseCustomerAddress('12 MG Road\nPune 411001\nIndia');
    expect(parsed.zipCode).toBe('411001');
    expect(parsed.country).toBe('India');
  });

  it('keeps unclassifiable text in street rather than losing it', () => {
    const parsed = parseCustomerAddress('Some warehouse behind the old mill');
    expect(parsed.street).toBe('Some warehouse behind the old mill');
  });

  it('handles empty input', () => {
    expect(parseCustomerAddress(undefined)).toEqual({});
    expect(parseCustomerAddress('   ')).toEqual({});
  });

  it('never throws on odd input', () => {
    expect(() => parseCustomerAddress(',,,\n\n , ')).not.toThrow();
  });
});
