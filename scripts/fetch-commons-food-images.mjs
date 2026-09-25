/**
 * Download isolated ingredient photos from Wikimedia Commons (Pixabay for pâtes).
 * Usage: node scripts/fetch-commons-food-images.mjs
 */
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "foods");
const UA = "AssietteLab/0.2 (educational science-fair game)";

/** @type {Record<string, { commons?: string, pixabay?: string }>} */
const FILES = {
  "carottes-rapees": { commons: "File:French grated carrot salad (cropped).jpg" },
  friand: {
    commons:
      "File:Comme à la Maison (Villefranche-sur-Saône) feuilleté au fromage (février 2024).jpg",
  },
  soupe: {
    commons: "File:-2022-02-01 Bowl of spring vegetable soup, Trimingham, Norfolk.JPG",
  },
  poulet: { commons: "File:CHICKEN BREAST.jpg" },
  boeuf: { commons: "File:Hackfleisch-1.jpg" },
  lentilles: { commons: "File:Lens culinaris seeds.jpg" },
  "poisson-pane": { commons: "File:Fishfinger classic fried 1.jpg" },
  saucisses: { commons: "File:Chicken cocktail sausage 02.jpg" },
  pates: {
    pixabay:
      "https://cdn.pixabay.com/photo/2016/06/17/19/09/pasta-1463918_1280.jpg",
    page: "https://pixabay.com/photos/pasta-spaghetti-bundle-raw-food-1463918/",
  },
  riz: { commons: "File:Uncooked rice.jpg" },
  pdt: { commons: "File:Russet potato.jpg" },
  frites: { commons: "File:French Fries.jpg" },
  haricots: { commons: "File:Green beans.jpg" },
  salade: { commons: "File:Iceberg lettuce.jpg" },
  poelee: { commons: "File:Dinner vegetable dish at a party in a silver pan.jpg" },
  yaourt: { commons: "File:Joghurt.jpg" },
  fromage: { commons: "File:Emmentaler.jpg" },
  "creme-caramel": { commons: "File:Crème caramel 2.jpg" },
  pomme: { commons: "File:Red Apple.jpg" },
  banane: { commons: "File:Bananas.jpg" },
  orange: { commons: "File:Orange-Fruit-Pieces.jpg" },
  compote: { commons: "File:Applesauce.jpg" },
  gateau: {
    commons:
      "File:Piece of chocolate cake on a white plate decorated with chocolate sauce.jpg",
  },
  "salade-fruits": { commons: "File:Fruit Salad 4.jpg" },
  pain: { commons: "File:Baguettes.jpg" },
  bonbons: { commons: "File:Dragibus.jpg" },
  chips: { commons: "File:Chips in a bowl at a party.JPG" },
  "petit-beurre": { commons: "File:Petits-beurre 32.jpg" },
};

async function toJpeg(srcPath, destPath) {
  await exec("sips", [
    "-s",
    "format",
    "jpeg",
    "-s",
    "formatOptions",
    "72",
    "-Z",
    "800",
    srcPath,
    "--out",
    destPath,
  ]);
}

async function fetchBin(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "image/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function commonsInfo(title) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata");
  url.searchParams.set("iiurlwidth", "800");
  url.searchParams.set("titles", title);
  const data = await (
    await fetch(url, { headers: { "User-Agent": UA } })
  ).json();
  const page = Object.values(data.query?.pages || {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) throw new Error(`missing ${title}`);
  return {
    src: ii.thumburl || ii.url,
    license: ii.extmetadata?.LicenseShortName?.value || "",
    page: ii.descriptionurl,
  };
}

await mkdir(OUT, { recursive: true });
const credits = [];

for (const [id, spec] of Object.entries(FILES)) {
  process.stdout.write(`${id} … `);
  const tmp = join(OUT, `${id}.src`);
  const dest = join(OUT, `${id}.jpg`);
  try {
    if (spec.pixabay) {
      await writeFile(tmp, await fetchBin(spec.pixabay));
      await toJpeg(tmp, dest);
      await unlink(tmp);
      credits.push({
        id,
        file: `/foods/${id}.jpg`,
        source: "Pixabay",
        license: "Pixabay Content License",
        page: "https://pixabay.com/photos/pasta-spaghetti-bundle-raw-food-1463918/",
      });
      console.log("Pixabay");
    } else {
      const info = await commonsInfo(spec.commons);
      await writeFile(tmp, await fetchBin(info.src));
      await toJpeg(tmp, dest);
      await unlink(tmp);
      credits.push({
        id,
        file: `/foods/${id}.jpg`,
        source: "Wikimedia Commons",
        commons: spec.commons,
        license: info.license,
        page: info.page,
      });
      console.log(info.license);
    }
  } catch (err) {
    console.log("FAIL", err.message);
  }
  await new Promise((r) => setTimeout(r, 250));
}

await writeFile(join(OUT, "credits.json"), JSON.stringify(credits, null, 2) + "\n");
console.log("done", credits.length);
