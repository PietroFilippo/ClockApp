// ─── Mapeamento de países para zonas de fuso horário (IANA) ────────────────
const ZONE_COUNTRY = {
    // Africa
    'Africa/Abidjan': 'Ivory Coast', 'Africa/Accra': 'Ghana', 'Africa/Addis_Ababa': 'Ethiopia',
    'Africa/Algiers': 'Algeria', 'Africa/Asmara': 'Eritrea', 'Africa/Bamako': 'Mali',
    'Africa/Bangui': 'Central African Republic', 'Africa/Banjul': 'Gambia',
    'Africa/Bissau': 'Guinea-Bissau', 'Africa/Blantyre': 'Malawi',
    'Africa/Brazzaville': 'Congo', 'Africa/Bujumbura': 'Burundi', 'Africa/Cairo': 'Egypt',
    'Africa/Casablanca': 'Morocco', 'Africa/Ceuta': 'Spain', 'Africa/Conakry': 'Guinea',
    'Africa/Dakar': 'Senegal', 'Africa/Dar_es_Salaam': 'Tanzania', 'Africa/Djibouti': 'Djibouti',
    'Africa/Douala': 'Cameroon', 'Africa/El_Aaiun': 'Western Sahara',
    'Africa/Freetown': 'Sierra Leone', 'Africa/Gaborone': 'Botswana',
    'Africa/Harare': 'Zimbabwe', 'Africa/Johannesburg': 'South Africa',
    'Africa/Juba': 'South Sudan', 'Africa/Kampala': 'Uganda', 'Africa/Khartoum': 'Sudan',
    'Africa/Kigali': 'Rwanda', 'Africa/Kinshasa': 'DR Congo', 'Africa/Lagos': 'Nigeria',
    'Africa/Libreville': 'Gabon', 'Africa/Lome': 'Togo', 'Africa/Luanda': 'Angola',
    'Africa/Lubumbashi': 'DR Congo', 'Africa/Lusaka': 'Zambia',
    'Africa/Malabo': 'Equatorial Guinea', 'Africa/Maputo': 'Mozambique',
    'Africa/Maseru': 'Lesotho', 'Africa/Mbabane': 'Eswatini', 'Africa/Mogadishu': 'Somalia',
    'Africa/Monrovia': 'Liberia', 'Africa/Nairobi': 'Kenya', 'Africa/Ndjamena': 'Chad',
    'Africa/Niamey': 'Niger', 'Africa/Nouakchott': 'Mauritania',
    'Africa/Ouagadougou': 'Burkina Faso', 'Africa/Porto-Novo': 'Benin',
    'Africa/Sao_Tome': 'São Tomé and Príncipe', 'Africa/Tripoli': 'Libya',
    'Africa/Tunis': 'Tunisia', 'Africa/Windhoek': 'Namibia',

    // América — Estados Unidos
    'America/Adak': 'USA', 'America/Anchorage': 'USA', 'America/Boise': 'USA',
    'America/Chicago': 'USA', 'America/Denver': 'USA', 'America/Detroit': 'USA',
    'America/Indiana/Indianapolis': 'USA', 'America/Indiana/Knox': 'USA',
    'America/Indiana/Marengo': 'USA', 'America/Indiana/Petersburg': 'USA',
    'America/Indiana/Tell_City': 'USA', 'America/Indiana/Vevay': 'USA',
    'America/Indiana/Vincennes': 'USA', 'America/Indiana/Winamac': 'USA',
    'America/Juneau': 'USA', 'America/Kentucky/Louisville': 'USA',
    'America/Kentucky/Monticello': 'USA', 'America/Los_Angeles': 'USA',
    'America/Menominee': 'USA', 'America/Metlakatla': 'USA', 'America/New_York': 'USA',
    'America/Nome': 'USA', 'America/North_Dakota/Beulah': 'USA',
    'America/North_Dakota/Center': 'USA', 'America/North_Dakota/New_Salem': 'USA',
    'America/Phoenix': 'USA', 'America/Sitka': 'USA', 'America/Yakutat': 'USA',
    'Pacific/Honolulu': 'USA',

    // América — Canadá
    'America/Atikokan': 'Canada', 'America/Blanc-Sablon': 'Canada',
    'America/Cambridge_Bay': 'Canada', 'America/Creston': 'Canada',
    'America/Dawson': 'Canada', 'America/Dawson_Creek': 'Canada',
    'America/Edmonton': 'Canada', 'America/Fort_Nelson': 'Canada',
    'America/Glace_Bay': 'Canada', 'America/Goose_Bay': 'Canada',
    'America/Halifax': 'Canada', 'America/Inuvik': 'Canada', 'America/Iqaluit': 'Canada',
    'America/Moncton': 'Canada', 'America/Rankin_Inlet': 'Canada',
    'America/Regina': 'Canada', 'America/Resolute': 'Canada',
    'America/St_Johns': 'Canada', 'America/Swift_Current': 'Canada',
    'America/Thunder_Bay': 'Canada', 'America/Toronto': 'Canada',
    'America/Vancouver': 'Canada', 'America/Whitehorse': 'Canada',
    'America/Winnipeg': 'Canada', 'America/Yellowknife': 'Canada',

    // América — Brasil
    'America/Araguaina': 'Brazil', 'America/Bahia': 'Brazil', 'America/Belem': 'Brazil',
    'America/Boa_Vista': 'Brazil', 'America/Campo_Grande': 'Brazil',
    'America/Cuiaba': 'Brazil', 'America/Eirunepe': 'Brazil', 'America/Fortaleza': 'Brazil',
    'America/Maceio': 'Brazil', 'America/Manaus': 'Brazil', 'America/Noronha': 'Brazil',
    'America/Porto_Velho': 'Brazil', 'America/Recife': 'Brazil',
    'America/Rio_Branco': 'Brazil', 'America/Santarem': 'Brazil',
    'America/Sao_Paulo': 'Brazil',

    // América — México
    'America/Bahia_Banderas': 'Mexico', 'America/Cancun': 'Mexico',
    'America/Chihuahua': 'Mexico', 'America/Ciudad_Juarez': 'Mexico',
    'America/Hermosillo': 'Mexico', 'America/Matamoros': 'Mexico',
    'America/Mazatlan': 'Mexico', 'America/Merida': 'Mexico',
    'America/Mexico_City': 'Mexico', 'America/Monterrey': 'Mexico',
    'America/Ojinaga': 'Mexico', 'America/Tijuana': 'Mexico',

    // América — Argentina
    'America/Argentina/Buenos_Aires': 'Argentina', 'America/Argentina/Catamarca': 'Argentina',
    'America/Argentina/Cordoba': 'Argentina', 'America/Argentina/Jujuy': 'Argentina',
    'America/Argentina/La_Rioja': 'Argentina', 'America/Argentina/Mendoza': 'Argentina',
    'America/Argentina/Rio_Gallegos': 'Argentina', 'America/Argentina/Salta': 'Argentina',
    'America/Argentina/San_Juan': 'Argentina', 'America/Argentina/San_Luis': 'Argentina',
    'America/Argentina/Tucuman': 'Argentina', 'America/Argentina/Ushuaia': 'Argentina',

    // América — Outros
    'America/Asuncion': 'Paraguay', 'America/Barbados': 'Barbados',
    'America/Belize': 'Belize', 'America/Bogota': 'Colombia',
    'America/Caracas': 'Venezuela', 'America/Cayenne': 'French Guiana',
    'America/Costa_Rica': 'Costa Rica', 'America/Curacao': 'Curaçao',
    'America/Danmarkshavn': 'Greenland', 'America/El_Salvador': 'El Salvador',
    'America/Grand_Turk': 'Turks and Caicos', 'America/Guatemala': 'Guatemala',
    'America/Guayaquil': 'Ecuador', 'America/Guyana': 'Guyana', 'America/Havana': 'Cuba',
    'America/Jamaica': 'Jamaica', 'America/La_Paz': 'Bolivia', 'America/Lima': 'Peru',
    'America/Managua': 'Nicaragua', 'America/Martinique': 'Martinique',
    'America/Miquelon': 'Saint Pierre and Miquelon', 'America/Montevideo': 'Uruguay',
    'America/Nassau': 'Bahamas', 'America/Nuuk': 'Greenland', 'America/Panama': 'Panama',
    'America/Paramaribo': 'Suriname', 'America/Port-au-Prince': 'Haiti',
    'America/Port_of_Spain': 'Trinidad and Tobago', 'America/Puerto_Rico': 'Puerto Rico',
    'America/Punta_Arenas': 'Chile', 'America/Santiago': 'Chile',
    'America/Santo_Domingo': 'Dominican Republic', 'America/Scoresbysund': 'Greenland',
    'America/Tegucigalpa': 'Honduras', 'America/Thule': 'Greenland',
    'America/Tortola': 'British Virgin Islands',

    // Asia — Russia (Parte asiática)
    'Asia/Anadyr': 'Russia', 'Asia/Barnaul': 'Russia', 'Asia/Chita': 'Russia',
    'Asia/Irkutsk': 'Russia', 'Asia/Kamchatka': 'Russia', 'Asia/Khandyga': 'Russia',
    'Asia/Krasnoyarsk': 'Russia', 'Asia/Magadan': 'Russia',
    'Asia/Novokuznetsk': 'Russia', 'Asia/Novosibirsk': 'Russia', 'Asia/Omsk': 'Russia',
    'Asia/Sakhalin': 'Russia', 'Asia/Srednekolymsk': 'Russia', 'Asia/Tomsk': 'Russia',
    'Asia/Ust-Nera': 'Russia', 'Asia/Vladivostok': 'Russia', 'Asia/Yakutsk': 'Russia',
    'Asia/Yekaterinburg': 'Russia',

    // Asia — Outros
    'Asia/Aden': 'Yemen', 'Asia/Almaty': 'Kazakhstan', 'Asia/Amman': 'Jordan',
    'Asia/Aqtau': 'Kazakhstan', 'Asia/Aqtobe': 'Kazakhstan',
    'Asia/Ashgabat': 'Turkmenistan', 'Asia/Atyrau': 'Kazakhstan',
    'Asia/Baghdad': 'Iraq', 'Asia/Bahrain': 'Bahrain', 'Asia/Baku': 'Azerbaijan',
    'Asia/Bangkok': 'Thailand', 'Asia/Beirut': 'Lebanon', 'Asia/Bishkek': 'Kyrgyzstan',
    'Asia/Brunei': 'Brunei', 'Asia/Choibalsan': 'Mongolia', 'Asia/Colombo': 'Sri Lanka',
    'Asia/Damascus': 'Syria', 'Asia/Dhaka': 'Bangladesh', 'Asia/Dili': 'East Timor',
    'Asia/Dubai': 'UAE', 'Asia/Dushanbe': 'Tajikistan', 'Asia/Famagusta': 'Cyprus',
    'Asia/Gaza': 'Palestine', 'Asia/Hebron': 'Palestine',
    'Asia/Ho_Chi_Minh': 'Vietnam', 'Asia/Hong_Kong': 'China',
    'Asia/Hovd': 'Mongolia', 'Asia/Jakarta': 'Indonesia', 'Asia/Jayapura': 'Indonesia',
    'Asia/Jerusalem': 'Israel', 'Asia/Kabul': 'Afghanistan', 'Asia/Karachi': 'Pakistan',
    'Asia/Kathmandu': 'Nepal', 'Asia/Kolkata': 'India',
    'Asia/Kuala_Lumpur': 'Malaysia', 'Asia/Kuching': 'Malaysia', 'Asia/Kuwait': 'Kuwait',
    'Asia/Macau': 'China', 'Asia/Makassar': 'Indonesia', 'Asia/Manila': 'Philippines',
    'Asia/Muscat': 'Oman', 'Asia/Nicosia': 'Cyprus', 'Asia/Oral': 'Kazakhstan',
    'Asia/Phnom_Penh': 'Cambodia', 'Asia/Pontianak': 'Indonesia',
    'Asia/Pyongyang': 'North Korea', 'Asia/Qatar': 'Qatar',
    'Asia/Qostanay': 'Kazakhstan', 'Asia/Qyzylorda': 'Kazakhstan',
    'Asia/Riyadh': 'Saudi Arabia', 'Asia/Samarkand': 'Uzbekistan',
    'Asia/Seoul': 'South Korea', 'Asia/Shanghai': 'China', 'Asia/Singapore': 'Singapore',
    'Asia/Taipei': 'Taiwan', 'Asia/Tashkent': 'Uzbekistan', 'Asia/Tbilisi': 'Georgia',
    'Asia/Tehran': 'Iran', 'Asia/Thimphu': 'Bhutan', 'Asia/Tokyo': 'Japan',
    'Asia/Ulaanbaatar': 'Mongolia', 'Asia/Urumqi': 'China', 'Asia/Yangon': 'Myanmar',
    'Asia/Yerevan': 'Armenia',

    // Europa — Russia (Parte da europa)
    'Europe/Astrakhan': 'Russia', 'Europe/Kaliningrad': 'Russia', 'Europe/Kirov': 'Russia',
    'Europe/Moscow': 'Russia', 'Europe/Samara': 'Russia', 'Europe/Saratov': 'Russia',
    'Europe/Simferopol': 'Russia', 'Europe/Ulyanovsk': 'Russia',
    'Europe/Volgograd': 'Russia',

    // Europa — Outros
    'Europe/Amsterdam': 'Netherlands', 'Europe/Andorra': 'Andorra',
    'Europe/Athens': 'Greece', 'Europe/Belgrade': 'Serbia', 'Europe/Berlin': 'Germany',
    'Europe/Bratislava': 'Slovakia', 'Europe/Brussels': 'Belgium',
    'Europe/Bucharest': 'Romania', 'Europe/Budapest': 'Hungary',
    'Europe/Busingen': 'Germany', 'Europe/Chisinau': 'Moldova',
    'Europe/Copenhagen': 'Denmark', 'Europe/Dublin': 'Ireland',
    'Europe/Gibraltar': 'Gibraltar', 'Europe/Guernsey': 'Guernsey',
    'Europe/Helsinki': 'Finland', 'Europe/Isle_of_Man': 'Isle of Man',
    'Europe/Istanbul': 'Turkey', 'Europe/Jersey': 'Jersey',
    'Europe/Kiev': 'Ukraine', 'Europe/Kyiv': 'Ukraine',
    'Europe/Lisbon': 'Portugal', 'Europe/Ljubljana': 'Slovenia',
    'Europe/London': 'UK', 'Europe/Luxembourg': 'Luxembourg',
    'Europe/Madrid': 'Spain', 'Europe/Malta': 'Malta', 'Europe/Mariehamn': 'Finland',
    'Europe/Minsk': 'Belarus', 'Europe/Monaco': 'Monaco', 'Europe/Oslo': 'Norway',
    'Europe/Paris': 'France', 'Europe/Podgorica': 'Montenegro',
    'Europe/Prague': 'Czech Republic', 'Europe/Riga': 'Latvia', 'Europe/Rome': 'Italy',
    'Europe/San_Marino': 'San Marino', 'Europe/Sarajevo': 'Bosnia and Herzegovina',
    'Europe/Skopje': 'North Macedonia', 'Europe/Sofia': 'Bulgaria',
    'Europe/Stockholm': 'Sweden', 'Europe/Tallinn': 'Estonia',
    'Europe/Tirane': 'Albania', 'Europe/Vaduz': 'Liechtenstein',
    'Europe/Vatican': 'Vatican City', 'Europe/Vienna': 'Austria',
    'Europe/Vilnius': 'Lithuania', 'Europe/Warsaw': 'Poland',
    'Europe/Zagreb': 'Croatia', 'Europe/Zurich': 'Switzerland',

    // Atlântico
    'Atlantic/Azores': 'Portugal', 'Atlantic/Bermuda': 'Bermuda',
    'Atlantic/Canary': 'Spain', 'Atlantic/Cape_Verde': 'Cape Verde',
    'Atlantic/Faroe': 'Denmark', 'Atlantic/Madeira': 'Portugal',
    'Atlantic/Reykjavik': 'Iceland', 'Atlantic/South_Georgia': 'UK',
    'Atlantic/St_Helena': 'UK', 'Atlantic/Stanley': 'Falkland Islands',

    // Oceano Índico
    'Indian/Antananarivo': 'Madagascar', 'Indian/Chagos': 'UK',
    'Indian/Christmas': 'Australia', 'Indian/Cocos': 'Australia',
    'Indian/Comoro': 'Comoros', 'Indian/Kerguelen': 'France', 'Indian/Mahe': 'Seychelles',
    'Indian/Maldives': 'Maldives', 'Indian/Mauritius': 'Mauritius',
    'Indian/Mayotte': 'France', 'Indian/Reunion': 'France',

    // Austrália
    'Australia/Adelaide': 'Australia', 'Australia/Brisbane': 'Australia',
    'Australia/Broken_Hill': 'Australia', 'Australia/Darwin': 'Australia',
    'Australia/Eucla': 'Australia', 'Australia/Hobart': 'Australia',
    'Australia/Lindeman': 'Australia', 'Australia/Lord_Howe': 'Australia',
    'Australia/Melbourne': 'Australia', 'Australia/Perth': 'Australia',
    'Australia/Sydney': 'Australia',

    // Pacífico
    'Pacific/Apia': 'Samoa', 'Pacific/Auckland': 'New Zealand',
    'Pacific/Bougainville': 'Papua New Guinea', 'Pacific/Chatham': 'New Zealand',
    'Pacific/Chuuk': 'Micronesia', 'Pacific/Easter': 'Chile', 'Pacific/Efate': 'Vanuatu',
    'Pacific/Fakaofo': 'Tokelau', 'Pacific/Fiji': 'Fiji', 'Pacific/Funafuti': 'Tuvalu',
    'Pacific/Galapagos': 'Ecuador', 'Pacific/Gambier': 'French Polynesia',
    'Pacific/Guadalcanal': 'Solomon Islands', 'Pacific/Guam': 'USA',
    'Pacific/Kanton': 'Kiribati', 'Pacific/Kiritimati': 'Kiribati',
    'Pacific/Kosrae': 'Micronesia', 'Pacific/Kwajalein': 'Marshall Islands',
    'Pacific/Majuro': 'Marshall Islands', 'Pacific/Marquesas': 'French Polynesia',
    'Pacific/Midway': 'USA', 'Pacific/Nauru': 'Nauru', 'Pacific/Niue': 'Niue',
    'Pacific/Norfolk': 'Australia', 'Pacific/Noumea': 'New Caledonia',
    'Pacific/Pago_Pago': 'American Samoa', 'Pacific/Palau': 'Palau',
    'Pacific/Pitcairn': 'UK', 'Pacific/Pohnpei': 'Micronesia',
    'Pacific/Port_Moresby': 'Papua New Guinea', 'Pacific/Rarotonga': 'Cook Islands',
    'Pacific/Tahiti': 'French Polynesia', 'Pacific/Tarawa': 'Kiribati',
    'Pacific/Tongatapu': 'Tonga', 'Pacific/Wake': 'USA',
    'Pacific/Wallis': 'Wallis and Futuna',

    // Ártico
    'Arctic/Longyearbyen': 'Norway',
};

// ─── Região → Continente mapping ─────────────────────────────
const REGION_CONTINENT = {
    'Africa': 'Africa',
    'America': 'Americas',
    'Asia': 'Asia',
    'Europe': 'Europe',
    'Australia': 'Oceania',
    'Pacific': 'Oceania',
    'Atlantic': 'Europe',
    'Indian': 'Africa',
    'Arctic': 'Europe',
};

// Substituições para zonas onde o continente baseado na região está errado
const CONTINENT_OVERRIDE = {
    'Atlantic/Bermuda': 'Americas',
    'Atlantic/Stanley': 'Americas',
    'Atlantic/Cape_Verde': 'Africa',
    'Atlantic/St_Helena': 'Africa',
    'Indian/Chagos': 'Asia',
    'Indian/Christmas': 'Oceania',
    'Indian/Cocos': 'Oceania',
    'Indian/Maldives': 'Asia',
    'Indian/Mahe': 'Africa',
    'Indian/Mauritius': 'Africa',
    'Indian/Reunion': 'Africa',
    'Indian/Mayotte': 'Africa',
    'Indian/Comoro': 'Africa',
    'Indian/Antananarivo': 'Africa',
    'Indian/Kerguelen': 'Africa',
    'Pacific/Galapagos': 'Americas',
    'Pacific/Easter': 'Americas',
    'Pacific/Honolulu': 'Americas',
    'Pacific/Guam': 'Oceania',
    'Pacific/Midway': 'Oceania',
    'Pacific/Wake': 'Oceania',
};

// ─── Mostra os nomes das zonas (quando o nome da cidade do IANA não é ideal) ─
const DISPLAY_NAME = {
    'Asia/Kolkata': 'Mumbai / New Delhi',
    'America/Argentina/Buenos_Aires': 'Buenos Aires',
    'America/Argentina/Cordoba': 'Córdoba',
    'America/Indiana/Indianapolis': 'Indianapolis',
    'America/Indiana/Knox': 'Knox, Indiana',
    'America/Indiana/Marengo': 'Marengo, Indiana',
    'America/Indiana/Petersburg': 'Petersburg, Indiana',
    'America/Indiana/Tell_City': 'Tell City, Indiana',
    'America/Indiana/Vevay': 'Vevay, Indiana',
    'America/Indiana/Vincennes': 'Vincennes, Indiana',
    'America/Indiana/Winamac': 'Winamac, Indiana',
    'America/Kentucky/Louisville': 'Louisville',
    'America/Kentucky/Monticello': 'Monticello, Kentucky',
    'America/North_Dakota/Beulah': 'Beulah, North Dakota',
    'America/North_Dakota/Center': 'Center, North Dakota',
    'America/North_Dakota/New_Salem': 'New Salem, North Dakota',
    'America/Sao_Paulo': 'São Paulo',
    'America/Nuuk': 'Nuuk (Godthåb)',
    'Asia/Ho_Chi_Minh': 'Ho Chi Minh City',
    'Atlantic/Reykjavik': 'Reykjavik',
    'Pacific/Pago_Pago': 'Pago Pago',
    'Europe/Kiev': 'Kyiv',
    'Europe/Kyiv': 'Kyiv',
};

// ─── Regiões válidas para incluir (pule Etc/*, SystemV/*, etc) ────
const VALID_REGIONS = new Set([
    'Africa', 'America', 'Asia', 'Atlantic', 'Australia',
    'Europe', 'Indian', 'Pacific', 'Arctic'
]);

// ─── Gera a lista completa de zonas ─────────────────────
function generateTimezones() {
    let zones;
    try {
        zones = Intl.supportedValuesOf('timeZone');
    } catch (e) {
        // Fallback
        console.warn('Intl.supportedValuesOf not available, timezone list may be incomplete.');
        return [];
    }

    return zones
        .filter(zone => {
            const region = zone.split('/')[0];
            if (!VALID_REGIONS.has(region)) return false;
            // Pula Antartida (estações de pesquisa)
            if (region === 'Antarctica') return false;
            return true;
        })
        .map(zone => {
            const parts = zone.split('/');
            const region = parts[0];

            // Nome da cidade
            const city = DISPLAY_NAME[zone]
                || parts[parts.length - 1].replace(/_/g, ' ');

            // País
            const country = ZONE_COUNTRY[zone] || region;

            // Continente
            const continent = CONTINENT_OVERRIDE[zone]
                || REGION_CONTINENT[region]
                || 'Other';

            return { city, country, zone, continent };
        })
        .sort((a, b) => a.city.localeCompare(b.city));
}

export const timezones = generateTimezones();
