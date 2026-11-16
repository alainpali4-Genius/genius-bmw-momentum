// Catálogos compartidos por showroom, stock y escáner VIN.
export const BMW_COLORS = [
  // BMW: gama habitual y colores BMW Individual/M.
  {code:"300",name:"Alpine White III",hex:"#F5F5F5",brand:"BMW"},
  {code:"668",name:"Jet Black",hex:"#080808",brand:"BMW"},
  {code:"475",name:"Black Sapphire Metallic",hex:"#1A1A1A",brand:"BMW"},
  {code:"416",name:"Carbon Black Metallic",hex:"#111827",brand:"BMW"},
  {code:"A96",name:"Mineral White Metallic",hex:"#F3F3F1",brand:"BMW"},
  {code:"A83",name:"Glacier Silver Metallic",hex:"#AEB4B8",brand:"BMW"},
  {code:"A90",name:"Sophisto Grey Brilliant Effect",hex:"#55585C",brand:"BMW"},
  {code:"A75",name:"Melbourne Red Metallic",hex:"#8E1824",brand:"BMW"},
  {code:"B39",name:"Mineral Grey Metallic",hex:"#686C70",brand:"BMW"},
  {code:"B45",name:"Estoril Blue Metallic",hex:"#07549A",brand:"BMW"},
  {code:"A52",name:"Space Grey Metallic",hex:"#737A80",brand:"BMW"},
  {code:"A89",name:"Imperial Blue Metallic",hex:"#172D50",brand:"BMW"},
  {code:"C1M",name:"Phytonic Blue Metallic",hex:"#245A91",brand:"BMW"},
  {code:"C1K",name:"Jucaro Beige Metallic",hex:"#A99D88",brand:"BMW"},
  {code:"C1X",name:"Sunset Orange Metallic",hex:"#C65B20",brand:"BMW"},
  {code:"C10",name:"Mediterranean Blue Metallic",hex:"#164B78",brand:"BMW"},
  {code:"C31",name:"Portimao Blue Metallic",hex:"#004D8D",brand:"BMW"},
  {code:"C3Z",name:"Tanzanite Blue II Metallic",hex:"#172C52",brand:"BMW"},
  {code:"C34",name:"San Francisco Red Metallic",hex:"#8E2634",brand:"BMW"},
  {code:"C35",name:"Blue Ridge Mountain Metallic",hex:"#526D83",brand:"BMW"},
  {code:"C36",name:"Dravit Grey Metallic",hex:"#5D5A55",brand:"BMW"},
  {code:"C3D",name:"Manhattan Metallic",hex:"#77766F",brand:"BMW"},
  {code:"C3A",name:"Cashmere Silver Metallic",hex:"#B9B5AA",brand:"BMW"},
  {code:"C3G",name:"Toronto Red Metallic",hex:"#A51E2D",brand:"BMW"},
  {code:"C3N",name:"Storm Bay Metallic",hex:"#687A83",brand:"BMW"},
  {code:"C4E",name:"San Remo Green Metallic",hex:"#526A54",brand:"BMW"},
  {code:"C4F",name:"Arctic Race Blue Metallic",hex:"#2A5C9A",brand:"BMW"},
  {code:"C4G",name:"Isle of Man Green Metallic",hex:"#176044",brand:"BMW"},
  {code:"C4H",name:"Sao Paulo Yellow",hex:"#E3C52D",brand:"BMW"},
  {code:"C4P",name:"Brooklyn Grey Metallic",hex:"#7B7D7E",brand:"BMW"},
  {code:"C4W",name:"Skyscraper Grey Metallic",hex:"#8B8E91",brand:"BMW"},
  {code:"C5Y",name:"Cape York Green Metallic",hex:"#466B5B",brand:"BMW"},
  {code:"C67",name:"Space Silver Metallic",hex:"#BFC3C5",brand:"BMW"},
  {code:"C68",name:"Fire Red Metallic",hex:"#A51D2D",brand:"BMW"},
  {code:"C7A",name:"Dune Grey Metallic",hex:"#B8B2A4",brand:"BMW"},
  {code:"C7R",name:"Night Dusk Blue Metallic",hex:"#35445D",brand:"BMW"},
  {code:"C66",name:"Utah Orange Metallic",hex:"#B86B3D",brand:"BMW"},
  {code:"C5L",name:"Blue Bay Lagoon Metallic",hex:"#4D8292",brand:"BMW"},
  {code:"X1F",name:"Frozen Pure Grey Metallic",hex:"#85898B",brand:"BMW"},
  {code:"X1G",name:"Frozen Tanzanite Blue Metallic",hex:"#263C62",brand:"BMW"},
  // MINI: colores clásicos y actuales. La disponibilidad depende del modelo y año.
  {code:"850",name:"Pepper White",hex:"#F0EEE4",brand:"MINI"},
  {code:"851",name:"Chili Red",hex:"#B51F2A",brand:"MINI"},
  {code:"A94",name:"Midnight Black Metallic",hex:"#17191D",brand:"MINI"},
  {code:"A62",name:"White Silver Metallic",hex:"#BFC4C7",brand:"MINI"},
  {code:"B22",name:"British Racing Green",hex:"#174B36",brand:"MINI"},
  {code:"B26",name:"Oxford Green",hex:"#243D32",brand:"MINI"},
  {code:"B30",name:"Reef Blue",hex:"#28749A",brand:"MINI"},
  {code:"B47",name:"Rooftop Grey",hex:"#85898C",brand:"MINI"},
  {code:"B58",name:"Thunder Grey",hex:"#777C80",brand:"MINI"},
  {code:"B62",name:"Starlight Blue",hex:"#254B78",brand:"MINI"},
  {code:"B70",name:"Volcanic Orange",hex:"#D66B25",brand:"MINI"},
  {code:"B71",name:"Moonwalk Grey",hex:"#92999C",brand:"MINI"},
  {code:"C19",name:"Rebel Green",hex:"#31513C",brand:"MINI"},
  {code:"C1B",name:"Solaris Orange",hex:"#D96B28",brand:"MINI"},
  {code:"C2C",name:"Pure Burgundy",hex:"#592B3C",brand:"MINI"},
  {code:"C2M",name:"Island Blue",hex:"#4B86A8",brand:"MINI"},
  {code:"C3B",name:"British Racing Green IV",hex:"#174B35",brand:"MINI"},
  {code:"C3Y",name:"Enigmatic Black Metallic",hex:"#252A31",brand:"MINI"},
  {code:"C4L",name:"Sage Green",hex:"#9AA58D",brand:"MINI"},
  {code:"C54",name:"Melting Silver II",hex:"#B9BEC1",brand:"MINI"},
  {code:"C5H",name:"Zesty Yellow",hex:"#D8D33C",brand:"MINI"},
  {code:"C6A",name:"Nanuq White",hex:"#E9E8E0",brand:"MINI"},
  {code:"C6B",name:"Melting Silver III",hex:"#AEB5B9",brand:"MINI"},
  {code:"C6D",name:"Resolute Bronze",hex:"#8C7761",brand:"MINI"},
  {code:"C6F",name:"Indigo Sunset Blue",hex:"#344B79",brand:"MINI"},
  {code:"C6K",name:"Blazing Blue",hex:"#1767A5",brand:"MINI"},
  {code:"C6M",name:"Ocean Wave Green",hex:"#347D72",brand:"MINI"},
  {code:"C6N",name:"Sunny Side Yellow",hex:"#E5D34A",brand:"MINI"},
  {code:"C6P",name:"Legend Grey",hex:"#737A80",brand:"MINI"},
  {code:"C70",name:"Slate Blue",hex:"#657F9B",brand:"MINI"},
  {code:"C71",name:"Smokey Green",hex:"#66796B",brand:"MINI"},
  {code:"C72",name:"Rebel Red",hex:"#B32A35",brand:"MINI"},
  {code:"C74",name:"Chili Red II",hex:"#B51F2A",brand:"MINI"},
  {code:"C77",name:"Copper Grey",hex:"#8C8178",brand:"MINI"}
];

export const TIPOS_LOGISTICOS = [
  "Stock Expo",
  "Entrega Renting",
  "Entrega Cliente",
  "Demo",
  "Devolucion Renting"
];


// Motorization resolver shared by VIN camera, manual intake, stock and logistics imports.
// Reglas normalizadas sin espacios: admiten "420d", "420 D GC", "420d Gran Coupe", etc.
const MOTOR_RULES: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /^(MINI)?(COOPER)?(ELECTRICO)?(E|SE|J C W E|JCWE)$/i, value: "Eléctrico · MINI Cooper E/SE" },
  { pattern: /ACEMAN.*JCW|JCW.*ACEMAN/i, value: "Eléctrico · MINI JCW Aceman · 190 kW (258 CV)" },
  { pattern: /ACEMAN.*SE/i, value: "Eléctrico · MINI Aceman SE · 160 kW (218 CV)" },
  { pattern: /ACEMAN.*E/i, value: "Eléctrico · MINI Aceman E · 135 kW (184 CV)" },
  { pattern: /COUNTRYMAN.*SE.*ALL4/i, value: "Eléctrico · MINI Countryman SE ALL4 · 230 kW (313 CV)" },
  { pattern: /COUNTRYMAN.*ELECTRICO|COUNTRYMAN.*EDRIVE|COUNTRYMANE$/i, value: "Eléctrico · MINI Countryman E · 150 kW (204 CV)" },
  { pattern: /COUNTRYMAN.*JCW/i, value: "Gasolina · 2.0 turbo · 221 kW (300 CV) · ALL4" },
  { pattern: /COUNTRYMAN.*S.*ALL4/i, value: "Gasolina mild hybrid · 2.0 turbo · 150 kW (204 CV) · ALL4" },
  { pattern: /COUNTRYMAN.*D/i, value: "Diésel · 2.0 turbo · 110 kW (150 CV)" },
  { pattern: /COUNTRYMAN.*C/i, value: "Gasolina mild hybrid · 1.5 turbo · 115 kW (156 CV)" },
  { pattern: /MINI.*COOPER.*(ELECTRICO|ELECTRIC).*SE|COOPER.*ELECTRICO.*SE/i, value: "Eléctrico · MINI Cooper SE · 160 kW (218 CV)" },
  { pattern: /MINI.*COOPER.*JCW|COOPER.*JCW/i, value: "Gasolina · 2.0 turbo · 170 kW (231 CV)" },
  { pattern: /MINI.*COOPER.*S|COOPER.*S/i, value: "Gasolina · 2.0 turbo · 150 kW (204 CV)" },
  { pattern: /MINI.*COOPER.*C|COOPER.*C/i, value: "Gasolina · 1.5 turbo · 115 kW (156 CV)" },
  { pattern: /IX1.*EDRIVE20/i, value: "Eléctrico · eDrive20 · 150 kW (204 CV)" },
  { pattern: /IX1.*XDRIVE30/i, value: "Eléctrico · xDrive30 · 230 kW (313 CV)" },
  { pattern: /IX2.*EDRIVE20/i, value: "Eléctrico · eDrive20 · 150 kW (204 CV)" },
  { pattern: /IX2.*XDRIVE30/i, value: "Eléctrico · xDrive30 · 230 kW (313 CV)" },
  { pattern: /I4.*EDRIVE35/i, value: "Eléctrico · eDrive35 · 210 kW (286 CV)" },
  { pattern: /I4.*EDRIVE40/i, value: "Eléctrico · eDrive40 · 250 kW (340 CV)" },
  { pattern: /I4.*M60/i, value: "Eléctrico · M60 xDrive · 400 kW (544 CV)" },
  { pattern: /I5.*XDRIVE40/i, value: "Eléctrico · xDrive40 · 290 kW (394 CV)" },
  { pattern: /I5.*EDRIVE40/i, value: "Eléctrico · eDrive40 · 250 kW (340 CV)" },
  { pattern: /I5.*M60/i, value: "Eléctrico · M60 xDrive · 442 kW (601 CV)" },
  { pattern: /IX.*XDRIVE60/i, value: "Eléctrico · xDrive60" },
  { pattern: /IX3/i, value: "Eléctrico · iX3" },
  // BMW M y M Performance: reglas específicas antes de las reglas genéricas.
  { pattern: /X2.*M35I/i, value: "Gasolina · 2.0 BMW M TwinPower Turbo · 221 kW (300 CV) · xDrive" },
  { pattern: /X1.*M35I/i, value: "Gasolina · 2.0 BMW M TwinPower Turbo · 221 kW (300 CV) · xDrive" },
  { pattern: /M3.*COMPETITION.*TOURING|M3.*TOURING.*COMPETITION/i, value: "Gasolina · 3.0 BMW M TwinPower Turbo · 390 kW (530 CV) · M xDrive" },
  { pattern: /M3.*COMPETITION.*XDRIVE/i, value: "Gasolina · 3.0 BMW M TwinPower Turbo · 390 kW (530 CV) · M xDrive" },
  { pattern: /M3.*COMPETITION/i, value: "Gasolina · 3.0 BMW M TwinPower Turbo · 375 kW (510 CV)" },
  { pattern: /M3/i, value: "Gasolina · 3.0 BMW M TwinPower Turbo · 353 kW (480 CV)" },
  { pattern: /M4.*COMPETITION.*XDRIVE/i, value: "Gasolina · 3.0 BMW M TwinPower Turbo · 390 kW (530 CV) · M xDrive" },
  { pattern: /M4.*COMPETITION/i, value: "Gasolina · 3.0 BMW M TwinPower Turbo · 375 kW (510 CV)" },
  { pattern: /M4/i, value: "Gasolina · 3.0 BMW M TwinPower Turbo · 353 kW (480 CV)" },
  { pattern: /M2/i, value: "Gasolina · 3.0 BMW M TwinPower Turbo · 353 kW (480 CV)" },
  { pattern: /M5.*TOURING|M5.*BERLINA/i, value: "Híbrido enchufable · 4.4 V8 M TwinPower Turbo + eléctrico · 535 kW (727 CV) · M xDrive" },
  { pattern: /X5.*50E/i, value: "Híbrido enchufable · 3.0 gasolina + eléctrico · xDrive" },
  { pattern: /X3.*30E/i, value: "Híbrido enchufable · 2.0 gasolina + eléctrico · xDrive" },
  { pattern: /330E/i, value: "Híbrido enchufable · 2.0 gasolina + eléctrico · 215 kW (292 CV)" },
  { pattern: /X1.*25E|X1.*30E/i, value: "Híbrido enchufable · 1.5 gasolina + eléctrico · xDrive" },
  { pattern: /225E|230E/i, value: "Híbrido enchufable · 1.5 gasolina + eléctrico · Active Tourer" },
  { pattern: /X3.*M50|M340I|M440I/i, value: "Gasolina · 3.0 M TwinPower Turbo" },
  { pattern: /M3|M4|M2/i, value: "Gasolina · motor BMW M" },
  { pattern: /X5.*40D|X7.*40D|X6.*40D|X3.*40D|M340D/i, value: "Diésel · 3.0 mild hybrid · xDrive" },
  { pattern: /X5.*30D|X6.*30D|X3.*30D|330D|430D|530D|630D|730D/i, value: "Diésel · 3.0" },
  { pattern: /X2.*20D.*XDRIVE|X2.*2[.]0D.*XDRIVE/i, value: "Diésel · 2.0 TwinPower Turbo · 120 kW (163 CV) · xDrive" },
  { pattern: /X2.*20D|X2.*2[.]0D/i, value: "Diésel · 2.0 TwinPower Turbo · 120 kW (163 CV) · sDrive" },
  { pattern: /X2.*18D/i, value: "Diésel · 2.0 TwinPower Turbo · 110 kW (150 CV)" },
  { pattern: /X1.*20D.*XDRIVE|X1.*2[.]0D.*XDRIVE/i, value: "Diésel · 2.0 TwinPower Turbo · 120 kW (163 CV) · xDrive" },
  { pattern: /X1.*20D|X1.*2[.]0D/i, value: "Diésel · 2.0 TwinPower Turbo · 120 kW (163 CV) · sDrive" },
  { pattern: /X1.*18D/i, value: "Diésel · 2.0 TwinPower Turbo · 110 kW (150 CV)" },
  { pattern: /X3.*20D.*XDRIVE/i, value: "Diésel · 2.0 TwinPower Turbo · 140 kW (190 CV) · xDrive" },
  { pattern: /X4.*20D.*XDRIVE/i, value: "Diésel · 2.0 TwinPower Turbo · 140 kW (190 CV) · xDrive" },
  { pattern: /X2.*20I|X1.*20I|X3.*20I|X4.*20I/i, value: "Gasolina · 2.0 TwinPower Turbo" },
  { pattern: /X1.*23I/i, value: "Gasolina · 2.0 TwinPower Turbo · 160 kW (218 CV)" },
  { pattern: /X5.*40I/i, value: "Gasolina · 3.0 TwinPower Turbo · xDrive" },
  { pattern: /X4.*M40D/i, value: "Diésel · 3.0 M Performance · xDrive" },
  { pattern: /X4.*M40I/i, value: "Gasolina · 3.0 M Performance · xDrive" },
  { pattern: /X3.*20D|X3.*30D/i, value: "Diésel · 2.0/3.0 según versión · xDrive" },
  { pattern: /540D/i, value: "Diésel · 3.0 mild hybrid · 223 kW (303 CV)" },
  { pattern: /420D/i, value: "Diésel · 2.0 TwinPower Turbo · 140 kW (190 CV)" },
  { pattern: /SERIE1.*120D|^120D$|120D/i, value: "Diésel · 2.0 TwinPower Turbo · 120 kW (163 CV) · sDrive" },
  { pattern: /^118D$/i, value: "Diésel · 2.0 TwinPower Turbo · 110 kW (150 CV)" },
  { pattern: /^218D$/i, value: "Diésel · 2.0 TwinPower Turbo · 110 kW (150 CV)" },
  { pattern: /^220D$/i, value: "Diésel · 2.0 TwinPower Turbo · 120 kW (163 CV)" },
  { pattern: /320D|520D|318D/i, value: "Diésel · 2.0 TwinPower Turbo · 140 kW (190 CV) en versiones actuales" },
  { pattern: /740D/i, value: "Diésel · 3.0 mild hybrid · potencia según generación" },
  { pattern: /420I|430I|220I|320I|520I|118I|120I|218I|318I/i, value: "Gasolina · TwinPower Turbo" },
 ];
const normalizeColorText = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bmetalizado\b/g, "metallic")
    .replace(/\bmetallic\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export function findBmwColorByName(raw: string) {
  const original = String(raw || "").trim();
  if (!original) return null;

  // Admite códigos escritos solos o incluidos entre paréntesis, guiones o texto adicional.
  const compact = original.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const byExactCode = BMW_COLORS.find(color => compact === color.code.toUpperCase());
  if (byExactCode) return byExactCode;

  const codeMatch = original.toUpperCase().match(/(?:^|[^A-Z0-9])([A-Z0-9]{3})(?=$|[^A-Z0-9])/g);
  if (codeMatch) {
    for (const candidate of codeMatch) {
      const code = candidate.replace(/[^A-Z0-9]/g, "");
      const found = BMW_COLORS.find(color => color.code.toUpperCase() === code);
      if (found) return found;
    }
  }

  const value = normalizeColorText(original);
  if (!value) return null;

  const aliases: Array<[string, string]> = [
    ["sophisto grey", "A90"], ["saphisto grey", "A90"], ["black sapphire", "475"], ["brooklyn grey", "C4P"], ["skyscraper grey", "C4W"], ["cape york green", "C5Y"], ["fire red", "C68"], ["vegas red", "C68"], ["space silver", "C67"], ["dune grey", "C7A"], ["night dusk blue", "C7R"], ["utah orange", "C66"], ["blue bay lagoon", "C5L"],
    ["dravit grey", "C36"], ["arctic race blue", "C4F"], ["portimao blue", "C31"],
    ["alpine white", "300"], ["carbon black", "416"], ["mineral white", "A96"],
    ["san remo green", "C4E"], ["isle of man green", "C4G"], ["estoril blue", "B45"],
    ["phytonic blue", "C1M"], ["tanzanite blue", "C3Z"], ["jet black", "668"],
    ["glacier silver", "A83"], ["melbourne red", "A75"], ["mineral grey", "B39"],
    ["space grey", "A52"], ["imperial blue", "A89"], ["mediterranean blue", "C10"],
    ["toronto red", "C3G"], ["storm bay", "C3N"], ["sunset orange", "C1X"],
    ["blue ridge mountain", "C35"], ["manhattan", "C3D"]
  ];
  const alias = aliases.find(([name]) => value.includes(name));
  if (alias) return BMW_COLORS.find(color => color.code === alias[1]) || null;

  return BMW_COLORS.find(color => {
    const name = normalizeColorText(color.name);
    return value === name || value.includes(name) || name.includes(value);
  }) || null;
}

import { findMasterEngine, formatMasterEngine } from "@/lib/bmw-mini-master-catalog";

export function suggestedMotor(model: string): string {
  // El catálogo maestro tiene prioridad; las reglas heredadas se mantienen
  // como compatibilidad para denominaciones antiguas aún no catalogadas.
  const master = findMasterEngine(model);
  if (master) return formatMasterEngine(master.engine);

  const normalized = String(model || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/BMW|MINI/g, " ").replace(/[^A-Z0-9]+/g, "");
  if (!normalized) return "";
  return MOTOR_RULES.find(rule => rule.pattern.test(normalized))?.value || "";
}
