// 대표팀 엠블럼 색: 그 나라 대표팀 유니폼의 대표 색 [주색, 보조색] (실제 로고가 아니라 색만)
//  목록에 없는 나라는 나라 약자로 정한 색 (nationColors)
export const NATION_COLORS: Record<string, [string, string]> = {
  // 유럽
  ENG: ['#f4f4f2', '#cf142b'], SCO: ['#1b2a5c', '#f4f4f2'], WAL: ['#c8102e', '#f4f4f2'], NIR: ['#00843d', '#f4f4f2'], IRL: ['#169b62', '#f4f4f2'],
  FRA: ['#1d2b5a', '#f4f4f2'], GER: ['#f4f4f2', '#141414'], ESP: ['#c60b1e', '#ffc400'], ITA: ['#0b5fb0', '#f4f4f2'], POR: ['#9b1b30', '#006600'],
  NED: ['#f36c21', '#f4f4f2'], BEL: ['#c8102e', '#141414'], CRO: ['#e30a17', '#f4f4f2'], SRB: ['#c6363c', '#0c4076'], SUI: ['#d52b1e', '#f4f4f2'],
  AUT: ['#ed2939', '#f4f4f2'], DEN: ['#c8102e', '#f4f4f2'], SWE: ['#fecc02', '#006aa7'], NOR: ['#ba0c2f', '#00205b'], FIN: ['#f4f4f2', '#003580'],
  ISL: ['#02529c', '#dc1e35'], POL: ['#f4f4f2', '#dc143c'], CZE: ['#d7141a', '#11457e'], SVK: ['#0b4ea2', '#f4f4f2'], HUN: ['#ce2939', '#477050'],
  ROU: ['#fcd116', '#002b7f'], BUL: ['#f4f4f2', '#00966e'], GRE: ['#0d5eaf', '#f4f4f2'], TUR: ['#e30a17', '#f4f4f2'], UKR: ['#ffd500', '#005bbb'],
  RUS: ['#f4f4f2', '#d52b1e'], SVN: ['#f4f4f2', '#0b5394'], BIH: ['#002395', '#fecb00'], MNE: ['#c40308', '#d4af37'], MKD: ['#d20000', '#ffe600'],
  ALB: ['#e41e20', '#141414'], GEO: ['#f4f4f2', '#ff0000'], ARM: ['#d90012', '#0033a0'], ISR: ['#f4f4f2', '#0038b8'], LUX: ['#ed2939', '#00a1de'],
  CYP: ['#f4f4f2', '#d57800'], LTU: ['#fdb913', '#006a44'], LVA: ['#9e3039', '#f4f4f2'], EST: ['#0072ce', '#141414'], BLR: ['#c8313e', '#4aa657'],
  KAZ: ['#00afca', '#fec50c'], MLT: ['#cf142b', '#f4f4f2'], FRO: ['#f4f4f2', '#0065bd'],
  // 남미
  BRA: ['#fedf00', '#009b3a'], ARG: ['#74acdf', '#f4f4f2'], URU: ['#6cace4', '#141414'], COL: ['#fcd116', '#003893'], CHI: ['#d52b1e', '#0039a6'],
  PER: ['#f4f4f2', '#d91023'], ECU: ['#ffdd00', '#034ea2'], PAR: ['#d52b1e', '#f4f4f2'], VEN: ['#7a1e2c', '#f4f4f2'], BOL: ['#007934', '#f4f4f2'],
  // 북중미
  MEX: ['#006847', '#f4f4f2'], USA: ['#f4f4f2', '#0a3161'], CAN: ['#d80621', '#f4f4f2'], CRC: ['#ce1126', '#002b7f'], PAN: ['#da121a', '#f4f4f2'],
  HON: ['#f4f4f2', '#0073cf'], JAM: ['#fed100', '#009b3a'], TRI: ['#ce1126', '#141414'], HAI: ['#00209f', '#d21034'], SLV: ['#0047ab', '#f4f4f2'], CUB: ['#cf142b', '#002a8f'],
  // 아시아
  KOR: ['#c60c30', '#003478'], JPN: ['#0b2a6f', '#f4f4f2'], CHN: ['#de2910', '#ffde00'], PRK: ['#ed1c27', '#f4f4f2'], AUS: ['#ffcd00', '#00843d'],
  IRN: ['#f4f4f2', '#da0000'], KSA: ['#f4f4f2', '#006c35'], QAT: ['#8a1538', '#f4f4f2'], UAE: ['#f4f4f2', '#00732f'], IRQ: ['#f4f4f2', '#007a3d'],
  UZB: ['#f4f4f2', '#0099b5'], JOR: ['#f4f4f2', '#ce1126'], SYR: ['#f4f4f2', '#ce1126'], OMA: ['#db161b', '#f4f4f2'], BHR: ['#ce1126', '#f4f4f2'],
  KUW: ['#007a3d', '#f4f4f2'], THA: ['#2d2a4a', '#a51931'], VIE: ['#da251d', '#ffff00'], IDN: ['#ce1126', '#f4f4f2'], MAS: ['#ffcc00', '#010066'],
  IND: ['#0b2a6f', '#ff9933'], LBN: ['#ed1c24', '#00a650'], NZL: ['#f4f4f2', '#141414'],
  // 아프리카
  NGA: ['#008751', '#f4f4f2'], GHA: ['#f4f4f2', '#006b3f'], CMR: ['#007a5e', '#ce1126'], CIV: ['#f77f00', '#009e60'], SEN: ['#f4f4f2', '#00853f'],
  MAR: ['#c1272d', '#006233'], ALG: ['#f4f4f2', '#006233'], TUN: ['#e70013', '#f4f4f2'], EGY: ['#ce1126', '#f4f4f2'], RSA: ['#ffb612', '#007749'],
  MLI: ['#14b53a', '#fcd116'], BFA: ['#ef2b2d', '#009e49'], GUI: ['#ce1126', '#fcd116'], TOG: ['#ffce00', '#006a4e'], ANG: ['#cc092f', '#141414'],
  COD: ['#007fff', '#ce1021'], ZAM: ['#198a00', '#ef7d00'], ZIM: ['#ffd200', '#319208'], KEN: ['#bb0000', '#006600'], LBY: ['#e70013', '#141414'],
  BEN: ['#008751', '#fcd116'], GAB: ['#009e60', '#fcd116'], CPV: ['#003893', '#f4f4f2'], GAM: ['#ce1126', '#0c1c8c'], EQG: ['#e32118', '#3e9a00'],
};

/** 목록에 없는 나라: 약자로 정한 색 (같은 나라는 늘 같은 색) */
export function nationColors(code: string): [string, string] {
  const hit = NATION_COLORS[code];
  if (hit) return hit;
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return [hsl(hue, 0.62, 0.4), hsl((hue + 180) % 360, 0.7, 0.88)];
}

/** HSL → #rrggbb (엠블럼 글자색 계산이 #색만 읽으므로) */
function hsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
