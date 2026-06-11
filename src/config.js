// Centrale configuratie — alle tunables op één plek.
export const CONFIG = {
  track: {
    sampleSpacing: 0.45,      // meter tussen samples langs de baan
    gauge: 1.15,              // spoorbreedte hart-op-hart
    railRadius: 0.075,        // buisrails (typisch staal ~15cm doorsnee)
    railSegments: 12,         // radiale segmenten railbuis
    spineRadius: 0.34,        // ruggengraatbuis
    spineSegments: 10,
    spineDrop: 0.9,           // ruggengraat onder railvlak
    tieSpacing: 1.3,          // dwarsbalken om de zoveel meter
    chunkSamples: 100,        // samples per raycast-chunk
    maxBankDeg: 65,           // maximale banking
    bankSmoothWindow: 13,     // samples (box blur) voor soepele banking
    bankSmoothPasses: 2,
    energyLossFactor: 0.82,   // globale frictie-benadering voor snelheidsprofiel
    minSpeed: 4,              // m/s ondergrens snelheidsprofiel
  },
  supports: {
    spacing: 7.5,             // gewenste afstand tussen steunen (m)
    minSpineHeight: 1.7,      // geen steunen vlak boven de grond
    radius: 0.28,
    maxCount: 64,             // atlas-cellen
    clearance: 2.6,           // horizontale afstand waarbinnen lager spoor een verticale steun blokkeert
    sideOffset: 3.4,          // uitwijk-offset bij blokkade (m)
    maxHeight: 30,            // normalisatie hoogte voor dirt-uv
  },
  colors: {
    rail: 0xa61e26,           // verweerd dieprood staal
    spine: 0xa61e26,
    tie: 0x33373d,            // donkergrijs
    support: 0xcfc9bb,        // vuilwit
    platform: 0x8d8780,       // beton
    dust: [0.115, 0.095, 0.07],  // basis vuilkleur (donker, smerig bruingrijs)
    leaf: [0.075, 0.105, 0.035], // blad/mos, donker
  },
  spray: {
    range: 15,                // effectieve reikwijdte (m)
    raysPerFrame: 5,
    coneSpreadDeg: 0.9,
    baseRadius: 0.22,         // schoonmaakradius dichtbij (m)
    radiusPerMeter: 0.045,    // radius groeit met afstand
    cleanRate: 9,             // sterkte per ray per seconde (1.0 = vol pixel/sec)
    distanceFalloff: 0.5,     // krachtverlies op max afstand
    flowLitersPerSec: 0.15,   // ~9 L/min, realistische hogedrukspuit
  },
  player: {
    eyeHeight: 1.7,
    walkSpeed: 5.4,
    fastMultiplier: 1.9,
    verticalSpeed: 5.5,       // hoogwerker-modus
    accel: 10,                // smoothing
    gravity: 14,
    jumpSpeed: 5.2,
    stepHeight: 0.55,         // opstapje (perronrand, walkway)
    bounds: { minX: -75, maxX: 145, minZ: -90, maxZ: 40, maxY: 40 },
  },
  dirt: {
    cleanSnapBelow: 14,       // pixelwaarde < dit → knapt naar 0
    sectionDoneRatio: 0.985,  // sectie auto-voltooit (geen pixel-jacht)
  },
  world: {
    gravity: 9.81,
  },
};
