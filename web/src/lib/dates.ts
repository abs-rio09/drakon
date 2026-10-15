// Dates and times are shown in Bangladesh time, whatever the device says.
const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Dhaka',
})

// "16 Oct, 2:15 pm"
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}
