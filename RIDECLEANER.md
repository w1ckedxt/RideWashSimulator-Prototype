# RIDECLEANER.md — RideWash Simulator
> Source of truth voor dit project.

## STATUS
**Fase: PROTOTYPE-POLISH — v3 "RideWash Simulator" (11 juni 2026, Thomas test)**

PowerWash Simulator-stijl game, volledig 3D (Three.js), first-person, Engels,
browser-based zonder build step (alles lokaal gevendord, itch.io-klaar).
Vijf levels, allemaal direct speelbaar (prototype/free play). PowerWash-grade
vuil (zwart/bruin/groen, druipstrepen), vloeiende spuitstreken, geaard poppetje
met loopdek op beide coasterbanen, inloopbare operator-booths, vieze naamborden,
bergen, hires wolken, vast ochtendlicht (dag/nachtcyclus uitgeschakeld in code).
Branding: PROTOTYPE-badge + credits (x.com/ThomasGeelens, lifthill.studio) +
feedback-CTA (Hello@Lifthill.studio). Geverifieerd ~60 FPS, schone console.

## SPELEN
```bash
python3 -m http.server 8080    # of: npm run serve
# → open http://localhost:8080
```
Controls: mouse look · LMB spray · WASD · Shift sprint · Space/C up/down ·
F dirt finder · Esc pause.

**Logo:** sla Thomas' logo-afbeelding op als `assets/logo.png` — het menu
gebruikt hem automatisch (tekst-fallback als hij ontbreekt).

## LEVELS (volgorde = unlock-volgorde, localStorage `rws_done`)
1. **Carousel** — platform, middenkolom, luifel, paardjes & palen (4 secties)
2. **Swinging Ship** — A-frames, hangarmen, romp, bankjes (4 secties)
3. **Top Spin** — torens, draaiarmen, gondel, vloerplatform (4 secties)
4. **Wooden Coaster "Timber Howl"** — eigen layout (~300m), stalen strips,
   houtstapels L/R, ledgers, trestle-bents, perron (7 secties)
5. **Steel Coaster "Steel Comet"** — rails, ruggengraat, dwarsbalken, steunen
   (incl. betonvoeten), lifthill-catwalk + ketting, perron, stationsdak (8 secties)

Win = alle secties klaar → volgende level unlockt. Eén level per page-load
via `?level=<id>` (geen scene-teardown-bugs).

## ARCHITECTUUR
Stack: **Three.js 0.170 via CDN import map + vanilla ES modules** (geen bundler).

```
index.html            UI-skelet, grimey staal/roest-thema, levelmenu, import map
src/config.js         Tunables (baan, spray, speler, kleuren)
src/layout.js         Herbruikbare baan-wiskunde: centripetal Catmull-Rom +
                      banking via gevoelde verticaal; steelCometPoints() export
src/track.js          Stalen coaster-builder; exporteert buildTubeChunks
                      (met profiel-phase: 4 segs + π/4 = houten balk)
src/walkway.js        Lifthill-catwalk + ketting, schoonmaakbaar (CellAtlas)
src/atlas.js          remapUV + CellAtlas: elk los onderdeel een eigen
                      dirt-cel → alles individueel schoonmaakbaar
src/dirt.js           DirtSystem (RGBA DataTexture-maskers, anisotroop gummen,
                      incrementele progressie, secties auto-klaar bij 98,5%)
src/materials.js      Vuil-overlay via onBeforeCompile (één GPU-programma)
src/washer.js         Spuitpistool, raycast-spray, straal+mist particles
src/player.js         Pointer lock FPS + vrij omhoog/omlaag
src/environment.js    Gedeelde wereld (lucht, wolken, zon, bos met rejection
                      sampling, hekken, plaza, borden, coaster-station)
src/audio.js          Procedurele WebAudio
src/ui.js             HUD + levelmenu + win/next (Engels)
src/levels/index.js   Register + progressie (localStorage)
src/levels/*.js       carousel, ship, topspin, woodie, steelcomet
src/main.js           Bootstrap, level-keuze, PMREM-reflecties, game-loop
```

## ONLINE ZETTEN (statische site, geen server nodig)
- **Vercel** (aanrader): `vercel` in de projectmap (eerst `vercel login`),
  daarna `vercel --prod`. Klaar — publieke URL.
- Alternatieven: Netlify drag&drop (netlify.com/drop), GitHub Pages
  (repo → Settings → Pages), Cloudflare Pages.

## GRAPHICS
- In-engine gedaan: PMREM RoomEnvironment-reflecties (metaal/lak), ACES tone
  mapping, gedempt grimey palet, patchy vuil, schaduwen, mist.
- Betere assets downloaden (gratis): **Poly Haven** (HDRI's + PBR-texturen),
  **ambientCG** (PBR-texturen CC0), **Kenney.nl** (game-assets CC0),
  **Quaternius** (low-poly modellen CC0), **Sketchfab** (CC-licentie filteren).
  GLTF-modellen laden kan met THREE.GLTFLoader (addons staan al in de import map).

## ACTIVE WORK
- Thomas test het prototype; daarna itch.io-release (zip bouwen + uploaden).

## IDEAS
- Echte HDRI-lucht (Poly Haven) i.p.v. gradient
- Natte glans na sprayen; meerdere nozzles; trein/voertuig-decor
- Per-level besttijden (localStorage), totaal-voortgangsscherm
- Mobile/touch support

## CONTEXT / BESLISSINGEN
- file://-CORS blokkeert lokale ES modules → statische server nodig.
- Reload-per-level i.p.v. scene-teardown: simpel en bugvrij.
- Maskers = Uint8Array + DataTexture; raycast-chunks i.p.v. BVH-dependency.
- Logo komt van Thomas (chat-afbeelding) → `assets/logo.png`, met CSS-fallback.

## ARCHIEF
- **2026-06-11** — v3 prototype-polish (vele iteraties op feedback Thomas):
  geaard poppetje (zwaartekracht/springen/V=hoogwerker) + stabiel grond-plakken
  + onzichtbaar loopdek op beide coasterbanen; ESC-pauzemenu met settings;
  free play; PowerWash-grade vuil (max dekking, zwart/bruin/groen, drips,
  smoothstep-randen, streek-interpolatie); per-level polish (carouselpaarden
  in 5 vachtkleuren, schip-drakenkop, Top Spin naar referentiefoto met
  startpositie-gondel/sterren/stippenbanner/contragewicht); geparkeerde treinen;
  stations met trapjes/airgates; inloopbare operator-booths; vieze naamborden;
  bergen + hires wolken + (uitgezette) dag/nachtcyclus; Ride Wash-branding,
  logo-slot, credits en feedback-CTA; three.js lokaal gevendord; GLB-pijplijn
  klaar (src/models.js).
- **2026-06-11** — v1: one-shot build Steel Comet, geverifieerd 60 FPS.
- **2026-06-11** — v1.1: lifthill-walkway, ~120 bomen, wolken, plaza, hekken.
- **2026-06-11** — v2: rebrand "RideWash Simulator" (grimey thema, logo-slot),
  Engelse UI, 5 levels met unlock-progressie (carousel → ship → top spin →
  woodie → steel), alles schoonmaakbaar (walkway, ketting, betonvoeten,
  stationsdak), CellAtlas-systeem, PMREM-reflecties, gedempt gritty palet.
  Alle levels in browser geverifieerd (~60 FPS, schone console).
