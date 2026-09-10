// Собирает стиль карты: берём тёмный стиль OpenFreeMap (там уже правильные
// слои, фильтры и шрифты) и перекрашиваем под палитру приложения — примерно
// как тёмные Яндекс.Карты. Запуск: npm run map:style
import fs from "node:fs";

const SRC = "https://tiles.openfreemap.org/styles/dark";
const OUT = "public/map-style.json";

// Палитра: тёмно-синяя земля, синяя вода, зелёные парки, светло-серые дороги.
const P = {
  land: "#1C242F",
  water: "#16283F",
  river: "#2E63A8",
  green: "#1F3227",
  residential: "#212A36",
  building: "#252F3D",
  buildingEdge: "#2C3745",
  roadMinor: "#2C3643",
  roadCasing: "#3E4A5B",
  roadInner: "#343F4E",
  roadSubtle: "#2F3947",
  motorwayCasing: "#4C5A73",
  motorwayInner: "#3F4C62",
  rail: "#2E3847",
  border: "#3A4553",
  label: "#C3CCD8",
  labelHalo: "#111925",
  labelDim: "#8D97A6",
  waterLabel: "#6E9AD0",
};

const PAINT = {
  background:              { "background-color": P.land },
  water:                   { "fill-color": P.water },
  waterway:                { "line-color": P.river },
  landcover_ice_shelf:     { "fill-color": P.land },
  landcover_glacier:       { "fill-color": P.land },
  landuse_residential:     { "fill-color": P.residential },
  landcover_wood:          { "fill-color": P.green },
  landuse_park:            { "fill-color": P.green },
  building:                { "fill-color": P.building, "fill-outline-color": P.buildingEdge },
  aeroway_taxiway:         { "line-color": P.roadMinor },
  "aeroway-taxiway":       { "line-color": P.roadMinor },
  "aeroway-runway-casing": { "line-color": P.roadCasing },
  "aeroway-area":          { "fill-color": P.roadMinor },
  "aeroway-runway":        { "line-color": P.roadInner },
  road_area_pier:          { "fill-color": P.land },
  road_pier:               { "line-color": P.roadMinor },
  highway_path:            { "line-color": P.roadMinor },
  highway_minor:           { "line-color": P.roadMinor },
  highway_major_casing:    { "line-color": P.roadCasing },
  highway_major_inner:     { "line-color": P.roadInner },
  highway_major_subtle:    { "line-color": P.roadSubtle },
  highway_motorway_casing: { "line-color": P.motorwayCasing },
  highway_motorway_inner:  { "line-color": P.motorwayInner },
  highway_motorway_subtle: { "line-color": P.roadSubtle },
  railway_transit:         { "line-color": P.rail },
  railway_transit_dashline:{ "line-color": P.land },
  railway_minor:           { "line-color": P.rail },
  railway_minor_dashline:  { "line-color": P.land },
  railway:                 { "line-color": P.rail },
  railway_dashline:        { "line-color": P.land },
  water_name:              { "text-color": P.waterLabel, "text-halo-color": P.labelHalo },
  highway_name_other:      { "text-color": P.labelDim, "text-halo-color": P.labelHalo },
  highway_name_motorway:   { "text-color": P.labelDim, "text-halo-color": P.labelHalo },
  boundary_state:          { "line-color": P.border },
  "boundary_country_z0-4":  { "line-color": P.border },
  "boundary_country_z5-":   { "line-color": P.border },
};

const PLACE_LABEL = { "text-color": P.label, "text-halo-color": P.labelHalo };

const style = await fetch(SRC).then((r) => {
  if (!r.ok) throw new Error(`${SRC} ответил ${r.status}`);
  return r.json();
});

// растровый рельеф ни одним слоем не используется — выкидываем
delete style.sources.ne2_shaded;

const untouched = [];
for (const layer of style.layers) {
  const patch = PAINT[layer.id] ?? (layer.id.startsWith("place_") ? PLACE_LABEL : null);
  if (!patch) {
    if (layer.paint && Object.keys(layer.paint).some((k) => k.includes("color"))) untouched.push(layer.id);
    continue;
  }
  layer.paint = { ...layer.paint, ...patch };
  // halo пошире: подписи поверх пёстрой карты иначе плохо читаются
  if (layer.type === "symbol") layer.paint["text-halo-width"] = 1.4;
}

style.name = "Наш трекер — тёмная";
style.metadata = {
  ...style.metadata,
  "nt:source": SRC,
  "nt:note": "Сгенерировано scripts/build-map-style.mjs, палитра там же",
};

fs.writeFileSync(OUT, JSON.stringify(style, null, 1));
console.log(`${OUT}: ${style.layers.length} слоёв, перекрашено ${style.layers.length - untouched.length}`);
if (untouched.length) console.log("без палитры (цвет из исходника):", untouched.join(", "));
