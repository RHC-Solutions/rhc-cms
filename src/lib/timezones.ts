// Comprehensive timezone list
export const TIMEZONES = [
  { value: 'Pacific/Midway', label: '(GMT-11:00) Midway Island, Samoa' },
  { value: 'Pacific/Honolulu', label: '(GMT-10:00) Hawaii' },
  { value: 'America/Anchorage', label: '(GMT-09:00) Alaska' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time (US & Canada)' },
  { value: 'America/Tijuana', label: '(GMT-08:00) Tijuana, Baja California' },
  { value: 'America/Denver', label: '(GMT-07:00) Mountain Time (US & Canada)' },
  { value: 'America/Phoenix', label: '(GMT-07:00) Arizona' },
  { value: 'America/Chihuahua', label: '(GMT-07:00) Chihuahua, La Paz, Mazatlan' },
  { value: 'America/Chicago', label: '(GMT-06:00) Central Time (US & Canada)' },
  { value: 'America/Mexico_City', label: '(GMT-06:00) Mexico City' },
  { value: 'America/Regina', label: '(GMT-06:00) Saskatchewan' },
  { value: 'America/New_York', label: '(GMT-05:00) Eastern Time (US & Canada)' },
  { value: 'America/Bogota', label: '(GMT-05:00) Bogota, Lima, Quito' },
  { value: 'America/Lima', label: '(GMT-05:00) Lima' },
  { value: 'America/Caracas', label: '(GMT-04:00) Caracas' },
  { value: 'America/Halifax', label: '(GMT-04:00) Atlantic Time (Canada)' },
  { value: 'America/Santiago', label: '(GMT-04:00) Santiago' },
  { value: 'America/St_Johns', label: '(GMT-03:30) Newfoundland' },
  { value: 'America/Sao_Paulo', label: '(GMT-03:00) Brasilia' },
  { value: 'America/Argentina/Buenos_Aires', label: '(GMT-03:00) Buenos Aires' },
  { value: 'America/Godthab', label: '(GMT-03:00) Greenland' },
  { value: 'Atlantic/South_Georgia', label: '(GMT-02:00) Mid-Atlantic' },
  { value: 'Atlantic/Azores', label: '(GMT-01:00) Azores' },
  { value: 'Atlantic/Cape_Verde', label: '(GMT-01:00) Cape Verde Islands' },
  { value: 'Europe/London', label: '(GMT+00:00) London, Dublin, Edinburgh' },
  { value: 'Europe/Lisbon', label: '(GMT+00:00) Lisbon' },
  { value: 'Africa/Casablanca', label: '(GMT+00:00) Casablanca' },
  { value: 'UTC', label: '(GMT+00:00) UTC' },
  { value: 'Europe/Paris', label: '(GMT+01:00) Paris, Brussels, Madrid' },
  { value: 'Europe/Berlin', label: '(GMT+01:00) Berlin, Rome, Stockholm' },
  { value: 'Europe/Amsterdam', label: '(GMT+01:00) Amsterdam, Vienna' },
  { value: 'Africa/Lagos', label: '(GMT+01:00) West Central Africa' },
  { value: 'Europe/Athens', label: '(GMT+02:00) Athens, Istanbul, Bucharest' },
  { value: 'Europe/Helsinki', label: '(GMT+02:00) Helsinki, Kiev, Riga' },
  { value: 'Africa/Cairo', label: '(GMT+02:00) Cairo' },
  { value: 'Africa/Johannesburg', label: '(GMT+02:00) Johannesburg' },
  { value: 'Asia/Jerusalem', label: '(GMT+02:00) Jerusalem' },
  { value: 'Europe/Moscow', label: '(GMT+03:00) Moscow, St. Petersburg' },
  { value: 'Asia/Kuwait', label: '(GMT+03:00) Kuwait, Riyadh' },
  { value: 'Africa/Nairobi', label: '(GMT+03:00) Nairobi' },
  { value: 'Asia/Baghdad', label: '(GMT+03:00) Baghdad' },
  { value: 'Asia/Tehran', label: '(GMT+03:30) Tehran' },
  { value: 'Asia/Dubai', label: '(GMT+04:00) Abu Dhabi, Muscat' },
  { value: 'Asia/Baku', label: '(GMT+04:00) Baku, Tbilisi, Yerevan' },
  { value: 'Asia/Kabul', label: '(GMT+04:30) Kabul' },
  { value: 'Asia/Karachi', label: '(GMT+05:00) Islamabad, Karachi, Tashkent' },
  { value: 'Asia/Kolkata', label: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi' },
  { value: 'Asia/Colombo', label: '(GMT+05:30) Sri Jayawardenepura' },
  { value: 'Asia/Kathmandu', label: '(GMT+05:45) Kathmandu' },
  { value: 'Asia/Dhaka', label: '(GMT+06:00) Dhaka' },
  { value: 'Asia/Almaty', label: '(GMT+06:00) Almaty, Novosibirsk' },
  { value: 'Asia/Yangon', label: '(GMT+06:30) Yangon (Rangoon)' },
  { value: 'Asia/Bangkok', label: '(GMT+07:00) Bangkok, Hanoi, Jakarta' },
  { value: 'Asia/Krasnoyarsk', label: '(GMT+07:00) Krasnoyarsk' },
  { value: 'Asia/Shanghai', label: '(GMT+08:00) Beijing, Shanghai, Hong Kong' },
  { value: 'Asia/Singapore', label: '(GMT+08:00) Singapore, Kuala Lumpur' },
  { value: 'Asia/Taipei', label: '(GMT+08:00) Taipei' },
  { value: 'Australia/Perth', label: '(GMT+08:00) Perth' },
  { value: 'Asia/Irkutsk', label: '(GMT+08:00) Irkutsk, Ulaanbaatar' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo, Osaka, Sapporo' },
  { value: 'Asia/Seoul', label: '(GMT+09:00) Seoul' },
  { value: 'Australia/Adelaide', label: '(GMT+09:30) Adelaide' },
  { value: 'Australia/Darwin', label: '(GMT+09:30) Darwin' },
  { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney, Melbourne, Canberra' },
  { value: 'Australia/Brisbane', label: '(GMT+10:00) Brisbane' },
  { value: 'Australia/Hobart', label: '(GMT+10:00) Hobart' },
  { value: 'Asia/Yakutsk', label: '(GMT+10:00) Yakutsk' },
  { value: 'Pacific/Guam', label: '(GMT+10:00) Guam, Port Moresby' },
  { value: 'Asia/Vladivostok', label: '(GMT+11:00) Vladivostok' },
  { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland, Wellington' },
  { value: 'Pacific/Fiji', label: '(GMT+12:00) Fiji, Marshall Islands' },
  { value: 'Asia/Kamchatka', label: '(GMT+12:00) Kamchatka' },
  { value: 'Pacific/Tongatapu', label: '(GMT+13:00) Nuku\'alofa' },
];

// Get user's timezone from browser
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

// Get timezone from IP geolocation (simplified - in production use a real API)
export async function getGeoTimezone(): Promise<string> {
  try {
    // Use a free geolocation API
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      return data.timezone || getBrowserTimezone();
    }
  } catch (error) {
    console.error('Failed to get geo timezone:', error);
  }
  return getBrowserTimezone();
}
