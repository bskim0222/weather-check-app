const storedQueryId = process.argv[2] ?? 'ecmwf::forecast::surface::point::timevaluepair';
const latlon = process.argv[3] ?? '37.515,127.0728';
const url = new URL('https://opendata.fmi.fi/wfs');
url.searchParams.set('service', 'WFS');
url.searchParams.set('version', '2.0.0');
url.searchParams.set('request', 'getFeature');
url.searchParams.set('storedquery_id', storedQueryId);
url.searchParams.set('latlon', latlon);

const response = await fetch(url);
const xml = await response.text();
const params = [...xml.matchAll(/param=([^&"]+)/g)].map((match) => decodeURIComponent(match[1]));
const valueCount = (xml.match(/<wml2:value>/g) ?? []).length;
const firstValueIndex = xml.indexOf('<wml2:MeasurementTVP>');

console.log('status', response.status);
console.log('query', storedQueryId);
console.log('latlon', latlon);
console.log('numberMatched', xml.match(/numberMatched="([^"]+)"/)?.[1] ?? 'unknown');
console.log('parameters');
console.log([...new Set(params)].join('\n'));
console.log('valueCount', valueCount);
console.log('firstValueSample');
console.log(xml.slice(firstValueIndex, firstValueIndex + 1400));
