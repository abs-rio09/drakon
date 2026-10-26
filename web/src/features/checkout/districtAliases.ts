// Old English spellings people still type when they search for their
// district. The official names (keys) come from the delivery_areas table.
export const districtAliases: Readonly<Record<string, readonly string[]>> = {
  Barishal: ['Barisal'],
  Bogura: ['Bogra'],
  Chattogram: ['Chittagong'],
  Cumilla: ['Comilla'],
  Jashore: ['Jessore'],
}
