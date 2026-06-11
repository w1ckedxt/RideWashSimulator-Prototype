# RIDECLEANER.md — Ride Cleaner Simulator
> Source of truth voor dit project.

## STATUS
**Fase: SPEELBAAR — v1 compleet (one-shot build, 11 juni 2026)**

PowerWash Simulator-stijl game: spuit de stalen achtbaan **Steel Comet** schoon
met een hogedrukspuit. Volledig 3D (Three.js), first-person, draait in de browser
zonder build step. Geverifieerd in Chrome: 60 FPS, geen console errors, alle
schoonmaak-mechanics werken.

## SPELEN
```bash
python3 -m http.server 8080    # of: npm run serve
# → open http://localhost:8080
```
Besturing: muis kijken · LMB sprayen · WASD bewegen · Shift sneller ·
Spatie/C omhoog/omlaag · F vuilzoeker-baken · Esc pauze.

## ARCHITECTUUR
Stack: **Three.js 0.170 via CDN import map + vanilla ES modules** (geen bundler).

```
index.html          UI-skelet (HUD, overlays, CSS) + import map
src/config.js       Alle tunables (baan, spray, speler, kleuren)
src/layout.js       Baanontwerp: gesloten centripetal Catmull-Rom + frames.
                    Banking = "gevoelde verticaal" (g + centripetale kracht
                    uit snelheidsprofiel via energiebehoud) → realistisch
                    soepele bochten, gesmoothed, max 65°.
src/track.js        Geometrie: 2 buisrails + ruggengraat + dwarsbalken +
                    steunpilaren (wijken uit met diagonale arm onder de helix).
                    Alles in chunks (~100 samples) voor snelle raycasts.
src/dirt.js         DirtSystem: per oppervlak een RGBA DataTexture-masker
                    (R=vuil, G=blad, B=variatie). Anisotroop elliptisch gummen
                    met cell/wrap-logica; incrementele progressie-telling;
                    secties voltooien automatisch bij 98,5% (geen pixel-jacht).
src/materials.js    MeshStandardMaterial + onBeforeCompile vuil-overlay
                    (één gedeeld GPU-programma, uniforms per materiaal).
src/washer.js       Spuitpistool (procedureel model), raycast-spray (5 rays/
                    frame in kegel), straal- en mist-particles.
src/player.js       Pointer lock FPS-besturing + hoogwerker (vrij vliegen).
src/walkway.js      Lifthill-catwalk: roosterplanken, stringers, leuningen
                    met dubbele handrail + liftketting tussen de rails.
src/environment.js  Lucht, wolken, zon+schaduw, grond, bos (~120 bomen met
                    rejection sampling rond de baan), plaza + wachtrij-hekjes,
                    parkhek, station (perron is schoonmaakbaar), parkbord.
src/audio.js        Procedurele WebAudio (spray-ruis, wind, dingetjes, win).
src/ui.js           HUD: voortgang totaal + per sectie, tijd, waterverbruik.
src/main.js         Bootstrap + game-loop + vuilzoeker-baken (F).
```

### Baanlayout (Steel Comet, ~441 m)
Station → kettinglift (26 m) → eerste drop met bocht rechts → dal →
gebankte turnaround → airtime-heuvel → dalende helix (510°, r=13) →
remstraat → station. Gesloten lus, alle overgangen via centripetal
Catmull-Rom (geen knikken).

### Schoonmaakbare secties (6 dirt-masks)
Linkerrail, Rechterrail, Ruggengraat, Dwarsbalken, Steunpilaren, Perron.
Win-conditie: alle secties klaar → winscherm met tijd + literverbruik.

## ACTIVE WORK
- (geen — v1 af; zie IDEAS)

## IDEAS
- Vuil-detail omhoog (grotere maskers of detail-noise in shader)
- Natte glans-laag die kort nadruipt na sprayen
- Meerdere nozzles (breed/smal) zoals PowerWash Simulator
- Trein op de baan als decor / einde-animatie na winst
- Save-game (masker → localStorage is te groot; cleaned-count per sectie kan wel)

## CONTEXT / BESLISSINGEN
- Geen bundler: file://-CORS blokkeert lokale modules, dus statische server nodig.
- Drie.js r170 gepind via jsdelivr import map.
- Maskers zijn Uint8Array + DataTexture (geen canvas): goedkoop gummen op CPU,
  upload alleen bij wijziging; mips + anisotropy 8 tegen glinster op afstand.
- Raycast-chunks i.p.v. three-mesh-bvh: geen extra dependency nodig op deze schaal.

## ARCHIEF
- **2026-06-11** — One-shot build v1: complete game, in browser geverifieerd
  (60 FPS, mechanics getest via debug-hook `window.__game`).
- **2026-06-11** — v1.1 realisme-upgrade op verzoek: lifthill-walkway met
  handrails + liftketting, ~120 bomen (den + loofboom, kleurvariatie),
  wolken, entreeplaza met wachtrij-hekjes, parkhek, perronhek.
  Opnieuw geverifieerd: 60 FPS, schone console.
