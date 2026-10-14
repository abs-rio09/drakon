// MOCK DATA — will be replaced by the Go API (delivery_zones and
// delivery_areas tables, edited in Admin > Delivery). The real charge is
// always computed by the server from these tables, never by the browser.

export type DeliveryZone = {
  code: 'INSIDE_DHAKA' | 'OUTSIDE_DHAKA'
  label: string
  chargePaisa: number
}

export const deliveryZones: DeliveryZone[] = [
  { code: 'INSIDE_DHAKA', label: 'Inside Dhaka', chargePaisa: 6000 },
  { code: 'OUTSIDE_DHAKA', label: 'Outside Dhaka', chargePaisa: 10000 },
]

// Inside Dhaka district the buyer picks one of these areas.
export const dhakaAreas = [
  { id: 'city', label: 'Dhaka city', hint: 'Inside Dhaka zone', zone: 'INSIDE_DHAKA' },
  { id: 'outer', label: 'Outside Dhaka city', hint: 'Savar, Keraniganj and others', zone: 'OUTSIDE_DHAKA' },
] as const

// The district that asks the "Dhaka city or outside" question.
export const dhakaDistrict = 'Dhaka'

// All 64 districts of Bangladesh, A to Z.
export const districts = [
  'Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur',
  'Chapai Nawabganj', 'Chattogram', 'Chuadanga', "Cox's Bazar", 'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur',
  'Feni', 'Gaibandha', 'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokati',
  'Jhenaidah', 'Joypurhat', 'Khagrachhari', 'Khulna', 'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur',
  'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj', 'Mymensingh',
  'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona', 'Nilphamari', 'Noakhali',
  'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur',
  'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon',
]
