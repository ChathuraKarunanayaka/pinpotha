// Official Sri Lankan full-moon poya days.
// 2026: Gazette Extraordinary 2438/22. 2027: Central Bank of Sri Lanka holiday list.
// Add next year's list here when it is gazetted; dates can also be edited inside the app.
export const POYA = [
  ['2026-11-24', 'ඉල් පොහොය'],
  ['2026-12-23', 'උඳුවප් පොහොය'],
  ['2027-01-22', 'දුරුතු පොහොය'],
  ['2027-02-20', 'නවම් පොහොය'],
  ['2027-03-22', 'මැදින් පොහොය'],
  ['2027-04-20', 'බක් පොහොය'],
  ['2027-05-19', 'වෙසක් පොහොය'],
  ['2027-06-18', 'පොසොන් පොහොය'],
  ['2027-07-18', 'ඇසළ පොහොය'],
  ['2027-08-16', 'නිකිණි පොහොය'],
  ['2027-09-15', 'බිනර පොහොය'],
  ['2027-10-15', 'වප් පොහොය'],
  ['2027-11-13', 'ඉල් පොහොය'],
  ['2027-12-13', 'උඳුවප් පොහොය'],
];

/** Same date → same id on every device, so two people adding a poya never create two. */
export const poyaId = date => 'poya-' + date;
export const nextPoya = day => POYA.find(([d]) => d >= day) || null;

const SYNODIC = 29.53;
/** SVG moon whose lit part grows as the poya day gets closer. */
export function moonSvg(days) {
  const d = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const lit = (1 + Math.cos((d / SYNODIC) * 2 * Math.PI)) / 2; // 1 = full
  const waxing = d < SYNODIC / 2;
  const r = 46, rx = Math.abs(1 - 2 * lit) * r;
  const outer = waxing ? 1 : 0, inner = lit > 0.5 ? outer : 1 - outer;
  const path = lit > 0.985 ? `<circle cx="50" cy="50" r="${r}" fill="var(--moon)"/>`
    : `<path d="M50 ${50 - r} A${r} ${r} 0 0 ${outer} 50 ${50 + r} A${rx.toFixed(2)} ${r} 0 0 ${inner} 50 ${50 - r}Z" fill="var(--moon)"/>`;
  return `<svg class="moon" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" fill="rgba(255,255,255,.1)"/>${path}</svg>`;
}
