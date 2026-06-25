// Dados geográficos piloto (até bairro). Cada bairro traz lat/lng para o codec.
// Talatona usa o PONTO VALIDADO do AfroLoc (-8.93295, 13.18248).

export type Bairro = { n: string; mun: string; zona: string; lat: number; lng: number };
export type Country = {
  cc: string; country: string; flag: string; curr: string;
  langs: string[]; city: string; prov: string; bairros: Bairro[];
};

export const PLACES: Country[] = [
  { cc: "AO", country: "Angola", flag: "🇦🇴", curr: "AKZ",
    langs: ["Português", "Umbundu", "Kimbundu", "Kikongo", "Chokwe"],
    city: "Luanda", prov: "LUA",
    bairros: [
      { n: "Talatona", mun: "TAL", zona: "TAL", lat: -8.93295, lng: 13.18248 },
      { n: "Maianga", mun: "LUA", zona: "MAI", lat: -8.823, lng: 13.224 },
      { n: "Ingombota", mun: "LUA", zona: "ING", lat: -8.813, lng: 13.235 },
      { n: "Viana", mun: "VIA", zona: "VIA", lat: -8.904, lng: 13.371 },
      { n: "Cazenga", mun: "CAZ", zona: "CAZ", lat: -8.847, lng: 13.290 },
    ] },
  { cc: "MZ", country: "Moçambique", flag: "🇲🇿", curr: "MZN",
    langs: ["Português", "Changana", "Macua", "Sena"],
    city: "Maputo", prov: "MAP",
    bairros: [
      { n: "Baixa", mun: "MAP", zona: "BAI", lat: -25.969, lng: 32.573 },
      { n: "Polana", mun: "MAP", zona: "POL", lat: -25.961, lng: 32.601 },
      { n: "Mafalala", mun: "MAP", zona: "MAF", lat: -25.946, lng: 32.566 },
    ] },
  { cc: "GH", country: "Gana", flag: "🇬🇭", curr: "GHS",
    langs: ["English", "Twi", "Ewe", "Ga", "Hausa"],
    city: "Acra", prov: "ACC",
    bairros: [
      { n: "Osu", mun: "ACC", zona: "OSU", lat: 5.557, lng: -0.182 },
      { n: "Makola", mun: "ACC", zona: "MAK", lat: 5.547, lng: -0.207 },
      { n: "Jamestown", mun: "ACC", zona: "JAM", lat: 5.531, lng: -0.213 },
    ] },
  { cc: "CV", country: "Cabo Verde", flag: "🇨🇻", curr: "CVE",
    langs: ["Português", "Kabuverdianu"],
    city: "Praia", prov: "PRA",
    bairros: [
      { n: "Plateau", mun: "PRA", zona: "PLA", lat: 14.917, lng: -23.509 },
      { n: "Achada Santo António", mun: "PRA", zona: "ACH", lat: 14.911, lng: -23.521 },
      { n: "Sucupira", mun: "PRA", zona: "SUC", lat: 14.916, lng: -23.515 },
    ] },
  { cc: "KE", country: "Quénia", flag: "🇰🇪", curr: "KES",
    langs: ["Kiswahili", "English", "Kikuyu", "Luo"],
    city: "Nairobi", prov: "NAI",
    bairros: [
      { n: "CBD", mun: "NAI", zona: "CBD", lat: -1.286, lng: 36.822 },
      { n: "Gikomba", mun: "NAI", zona: "GIK", lat: -1.282, lng: 36.835 },
      { n: "Eastleigh", mun: "NAI", zona: "EAS", lat: -1.273, lng: 36.846 },
    ] },
];

export type Place = {
  cc: string; country: string; flag: string; curr: string; langs: string[];
  city: string; prov: string; bairro: string; mun: string; zona: string;
  lat: number; lng: number; ci: number; bi: number;
};

export function makePlace(ci: number, bi: number): Place {
  const c = PLACES[ci], b = c.bairros[bi];
  return {
    cc: c.cc, country: c.country, flag: c.flag, curr: c.curr, langs: c.langs,
    city: c.city, prov: c.prov, bairro: b.n, mun: b.mun, zona: b.zona,
    lat: b.lat, lng: b.lng, ci, bi,
  };
}

export const DEFAULT_PLACE = makePlace(0, 0); // Angola › Luanda › Talatona
