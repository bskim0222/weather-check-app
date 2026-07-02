const response = await fetch('https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=listStoredQueries');
const xml = await response.text();
const rows = [...xml.matchAll(/<StoredQuery id="([^"]+)">\s*<Title>([^<]+)/g)].map((match) => ({
  id: match[1],
  title: match[2],
}));

rows
  .filter((row) => /forecast/i.test(`${row.id} ${row.title}`))
  .filter((row) => /(point|surface|ecmwf|global|multipoint|coverage)/i.test(`${row.id} ${row.title}`))
  .forEach((row) => {
    console.log(`${row.id} | ${row.title}`);
  });
