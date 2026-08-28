import thaiAddressData from "@riz007/thai-address-data";

export interface AddressOption {
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
}

// ข้อมูลครบประเทศไทยจาก thailand-geography-json (MIT)
// https://github.com/thailand-geography-data/thailand-geography-json
export const thaiAddresses: AddressOption[] = thaiAddressData.map((address) => ({
  province: address.province,
  district: address.district,
  subdistrict: address.subdistrict,
  postalCode: address.zipcode,
}));

export const provinces = [
  ...new Set(thaiAddresses.map((item) => item.province)),
];

const districtsByProvince = new Map<string, Set<string>>();
const subdistrictsByLocation = new Map<string, AddressOption[]>();
const validAddressKeys = new Set<string>();

for (const address of thaiAddresses) {
  const districts = districtsByProvince.get(address.province) ?? new Set<string>();
  districts.add(address.district);
  districtsByProvince.set(address.province, districts);

  const locationKey = `${address.province}\u0000${address.district}`;
  const subdistricts = subdistrictsByLocation.get(locationKey) ?? [];
  subdistricts.push(address);
  subdistrictsByLocation.set(locationKey, subdistricts);

  validAddressKeys.add(
    `${address.province}\u0000${address.district}\u0000${address.subdistrict}\u0000${address.postalCode}`,
  );
}

export function getDistricts(province: string): string[] {
  return [...(districtsByProvince.get(province) ?? [])];
}

export function getSubdistricts(
  province: string,
  district: string,
): AddressOption[] {
  return subdistrictsByLocation.get(`${province}\u0000${district}`) ?? [];
}

export function isValidThaiAddress(address: AddressOption): boolean {
  return validAddressKeys.has(
    `${address.province}\u0000${address.district}\u0000${address.subdistrict}\u0000${address.postalCode}`,
  );
}
