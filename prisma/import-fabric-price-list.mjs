// One-off: adds the vendor fabric price list (Price List.pdf) as FABRIC products.
//   node prisma/import-fabric-price-list.mjs          (dry run - prints the plan)
//   node prisma/import-fabric-price-list.mjs --apply  (writes it)
// Names are "<ITEM>" or "<ITEM> (<VOLUME / FILE>)" - the volume keeps the same design from two
// files separate. Re-running updates the rate of products that already exist, and renames
// products from the first import ("<ITEM> (<VENDOR>, <VOLUME>)") to this form.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Vendor | Item | Rate | Volume / File
const PRICE_LIST = `
DH|RAINBOW ÉCLAIR SHEER|205|
DH|SPLASH EMBOSS|205|
KF|ARMANI NET|230|Cairo
DH|TIGER|230|
KF|HEAVEN|250|Cairo
GNT|ADINATH|250|Rams File
DH|SPLASH FOIL|265|
GNT|ANAMIKA|265|Rams File
KF|ORGANZA KHADI|275|Sheer World
DH|DAY NIGHT PLAIN|310|
DH|DAY NIGHT EMBOSS|325|
DH|NIGHTOUT EMBOSS|325|
DH|RAINBOW DIGITAL|325|
DH|G.C.M GULMOHAR|325|
GNT|AKKAL|330|Rams File
GNT|ADRISHYA|330|Rams File
KF|BLACKOUT PLAIN|335|Volume 8 (2)
GNT|BLACKOUT EMBOSSED|335|KB
JM|SARA|335|
KF|VINEA|350|Volume 8
KF|DUBAI|350|Volume 8
KF|DUBAI|350|Volume 8 (2)
KF|VIBGYOR PLAIN|350|Sheer World
KF|VIBGYOR LINING|350|Sheer World
KF|VELLORE|350|Sheer World
DH|BEAUTY|350|
GNT|OCEAN|350|KB
KF|FLOSS JHAAD|360|Sheer World
KF|FLOSS TEXTURE|360|Sheer World
DH|DAY NIGHT FOIL|360|
DH|KAVYA|360|
DH|NIGHTOUT FOIL|360|
KF|MICRO|370|Sheer World
KF|ESTONIA|370|Richlook
DH|AURA|370|
DH|MUSLIN KASTURI|370|
JM|BERLIN - MAIN|370|
JM|OSCAR|370|
JM|TWISSTER - SHEER|370|
GNT|PUNCH|375|KB
KF|CRETA FOIL|385|Volume 7
KF|SECQUAVANSH|385|Volume 7
KF|PURE|385|Volume 10
KF|OPAL|385|Sheer World
JM|MAX|385|
JM|ARABIC - MAIN|385|
JM|MOSHA BACKING|385|
GNT|AAKAY|390|Rams File
DH|LOTUS|395|
DH|DELIGHT|395|
DH|G.C.M FOIL DAIRES / SATRDUST|395|
DH|G.C.M OMEGA|395|
DH|G.C.M AURUM|395|
GNT|CELERIO SHEER|395|KB
KF|IPL PLAIN|410|Volume 4
KF|GLANZA|410|Volume 10
KF|GROOVE|410|Volume 14
KF|MACRONI|410|Skyraa File
JM|SAFARI|410|
GNT|VASUKI|415|Rams File
KF|LEDGER|420|Volume 4
KF|LIBSON|420|Volume 13
KF|ADOR|420|Sheer World
KF|BOMBAY MAGIC|420|Sheer World
KF|BRISBANE|420|Zyna File
KF|CLUSTER|420|Zyna File
DH|JASMINE|420|
GNT|AMRIT|420|Rams File
JM|FLORA - MAIN|420|
KF|ROGER|425|Skyraa File
KF|AURA|430|Volume 6
KF|PLUTO|430|Volume 10
KF|GENEVA|430|Rolex File
KF|KOHINOOR|430|Cairo
KF|ANKARA|430|Beller
DH|JAQUAR|430|
DH|LIBERTY|430|
DH|GALAXY|430|
DH|BLUSH|430|
JM|ROYAL|430|
JM|INSPIRE|430|
KF|BSOFT|445|Volume 9
KF|ELEVATE|455|Volume 10
GNT|RUDRAKASH|455|Rams File
GNT|SILK SOFT|455|KB
KF|LAVELLE|470|Skyraa File
DH|JACKPOT|470|
KF|IPL CHECK|480|Volume 4
KF|DLF|480|Volume 4
KF|UNITED|480|Volume 6
DH|ANTHES VOL I|480|
DH|ANTHES VOL II|480|
DH|LILY|480|
JM|HUSK BACKING|480|
JM|RUSSIAN VELVET BACKING|480|
JM|DICE BACKING|480|
JM|KIA BACKING|480|
KF|UNICORN|490|Volume 6
KF|SIBU EMB|490|Volume 12
KF|TORENTO|490|Sheer World
KF|BUBBLES|490|Skyraa File
JM|TWISSTER - MAIN|490|
KF|BELLAZA|505|Beller
KF|SATINA|505|Beller
KF|FOREST|515|Volume 13
KF|TWILL|515|Volume 14
KF|MANILA|515|Rolex File
KF|ROMANIA|515|Suggestions
KF|ETTA|515|Kynar File
KF|ADMIRAL|515|Beller
GNT|TORRONTO MATTY|515|KB
KF|GLACIER|530|Volume 4
KF|ATLANTA|530|Volume 6
KF|OCEAN|530|Volume 14
KF|BRAVO|530|Skyraa File
DH|MUSLIN KORA|540|
KF|KGF|550|Volume 4
KF|BELLA|550|Volume 5
KF|GEO METRICAL|550|Volume 14
KF|ALMATY|550|Rolex File
KF|EDEN|550|Zyna File
KF|LEBANON|550|Beller
KF|BELLY|550|Beller
JM|ROSE|550|
JM|ARABIC - SHEER|550|
GNT|AARMBH|555|Rams File
KF|VICINIA|565|Volume 3
KF|SIMONA|565|Rolex File
GNT|FINLAND|565|KB
KF|COSMO|575|Volume 1
KF|MISSILE|575|Volume 1
KF|SPRING FOIL|575|Volume 12
KF|EDEN SHEER|575|Sheer World
KF|GLAMOUR|575|Suggestions
KF|BENZ|575|Zyna File
DH|EMPIRE 54"|575|
KF|TIME LESS|590|Volume 2
KF|LIVERPOOL|590|Volume 6
KF|ASIAN|590|Volume 13
KF|EARTHEN LILEN|590|Skyraa File
KF|AROMA|590|Suggestions
KF|VERSACE|590|Suggestions
KF|TIFFANY|590|Richlook
KF|HUGO|600|Volume 3
KF|ECLIPSE|600|Volume 3
KF|RADIANCE|600|Volume 5
KF|DECENT|600|Volume 6
JM|MIST|600|
JM|BERLIN - SHEER|600|
GNT|ANANT|610|Rams File
JM|JUPITER|610|
KF|FORD|625|Volume 1
KF|KETO|625|Volume 1
KF|AURA EMB|625|Volume 12
KF|SWIGGY|625|Volume 13
KF|ELANA|625|Kynar File
JM|GLAMOUR|625|
KF|AUSTIN EMB|635|Volume 3
KF|SANTRONI|635|Volume 5
KF|ARIZONA|635|Volume 9
KF|ECHO EMB|635|Volume 12
KF|BELUGA|635|Volume 14
KF|NEW HERITAGE|635|Skyraa File
KF|AULI|635|Kynar File
KF|SPAIN|650|Volume 11
JM|FLORA - SHEER|650|
JM|ORCHID|650|
KF|METALIC|660|Volume 9
KF|EXCELLENCE|660|Volume 11
JM|DELL|660|
JM|TOKYO|665|
KF|BRAZIL|695|Volume 5
KF|SKY LIGHT|695|Volume 5
KF|STANLEY|695|Volume 11
KF|MORGAN|695|Volume 11
KF|DIGITAL FOIL|695|Volume 11
KF|HARMONY EMB|695|Volume 12
KF|SPAIN BLACKOUT|695|Blackout Planet
KF|VAGOS|695|Blackout Planet
KF|PRAHA|695|Blackout Planet
KF|ZURICH|695|Blackout Planet
KF|VENICE|695|Blackout Planet
KF|PARIS|695|Blackout Planet
KF|LEONA|710|Volume 11
KF|CAMEO|720|Volume 1
KF|SUNSHIELD|720|Volume 9
KF|MIDNIGHT|720|Midnight Guard
KF|BLUSH|720|Zyna File
KF|ROME|720|Blackout Planet
KF|GLOSSY|730|Volume 14
KF|MULBERRY|745|Suggestions
JM|MOONLIGHT|745|
KF|LAGOS EMB|770|Volume 3
KF|BOHO 48"|780|Volume 2
KF|SANTRO|780|Volume 9
KF|ALPHA|790|Volume 12
KF|ASPIRE|790|Volume 12
KF|SPARKLE|790|Volume 12
KF|BOHO 54"|815|Volume 2
KF|SONATA EMB|815|Volume 12
KF|CABANA|815|Volume 13
KF|CLUB FOIL|840|Kynar File
KF|PLUSH|850|Richlook
GNT|MELBOURNE|865|KB
GNT|MEDOWS|865|KB
KF|MISHTA|890|Volume 2
KF|PHANTOM|925|Richlook
KF|WILLOW|960|Richlook
KF|GLIMMER FOIL|1020|Volume 9
KF|DELMONTE|1080|Trims
KF|VICTORIS|1080|Trims
KF|MARVIN|1080|Trims
KF|SHAWLIN|1080|Trims
KF|GLORY|1080|Trims
KF|RAJWARA|1080|Trims
KF|SWARASKI|1090|Beller
KF|CORAL|1150|Suggestions
KF|HEXA|1200|Trims
KF|BHGHIRA|1200|Trims
DH|100% BLACKOUT 1500 SERIES|470|
DH|100% BLACKOUT 2500 SERIES|470|
DH|100% BLACKOUT 4000 SERIES|470|
`;

const fabrics = PRICE_LIST.trim().split("\n").map(line => {
    const [vendor, item, rate, volume] = line.split("|").map(s => s.trim());
    return {
        name: volume ? `${item} (${volume})` : item,
        oldName: `${item} (${[vendor, volume].filter(Boolean).join(", ")})`, // first import put the vendor in the name
        rate: Number(rate),
    };
});

const names = fabrics.map(f => f.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate names: ${dupes.join(", ")}`);
if (fabrics.some(f => !(f.rate > 0))) throw new Error("A row has no rate");

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();
try {
    // Rename products from the first import, unless the new name is already taken
    const taken = new Set((await prisma.product.findMany({ where: { name: { in: names } }, select: { name: true } })).map(p => p.name));
    const oldOnes = await prisma.product.findMany({ where: { name: { in: fabrics.map(f => f.oldName) } }, select: { id: true, name: true } });
    let renamed = 0;
    for (const p of oldOnes) {
        const f = fabrics.find(x => x.oldName === p.name);
        if (taken.has(f.name)) { console.log(`skip rename ${p.name}: "${f.name}" already exists`); continue; }
        if (apply) await prisma.product.update({ where: { id: p.id }, data: { name: f.name } });
        renamed++;
    }
    if (renamed) console.log(`${renamed} product(s) ${apply ? "renamed" : "would be renamed"} without the vendor.`);
    if (!apply) for (const p of oldOnes) taken.add(fabrics.find(x => x.oldName === p.name).name);

    const existing = new Map((await prisma.product.findMany({ where: { name: { in: names } }, select: { name: true, rate: true } })).map(p => [p.name, p]));
    if (!apply) for (const n of taken) if (!existing.has(n)) existing.set(n, { name: n, rate: fabrics.find(f => f.name === n).rate });
    let created = 0, updated = 0;
    for (const f of fabrics) {
        const old = existing.get(f.name);
        if (old) {
            if (old.rate !== f.rate) console.log(`update  ${f.name}: ${old.rate} -> ${f.rate}`);
            updated++;
        } else {
            created++;
        }
        if (apply) {
            await prisma.product.upsert({
                where: { name: f.name },
                update: { rate: f.rate, category: "Fabric", stockKind: "FABRIC" },
                create: { name: f.name, rate: f.rate, category: "Fabric", stockKind: "FABRIC" },
            });
        }
    }
    console.log(`${fabrics.length} fabrics: ${created} new, ${updated} already there. ${apply ? "Written." : "Dry run - run with --apply to write."}`);
} finally {
    await prisma.$disconnect();
}
