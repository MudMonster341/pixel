# Video cutscene prompts (for the owner to generate)

**Owner plan (2026-09-22):** generate short pixel-style videos externally (Gemini) for the big
cutscene moments, and play them in the game instead of the still illustration with a slow pan.

## Technical requirements (so a clip drops straight in)

| Thing | Value | Why |
|---|---|---|
| Aspect | **16:9** | The game canvas is 960x540 |
| Resolution | **1920x1080 or 960x540** | Scaled to the canvas; more is fine, less looks soft |
| Length | **4-8 seconds** | Cinematic enough, short enough that nobody waits |
| Frame rate | 24 or 30 fps | Either is fine |
| Format | **MP4 (H.264)**, WebM also works | Chromium and the packaged app play both |
| Audio | **None (silent)** | The game owns the sound, so a silent clip can't clash |
| Motion | A slow push or pan; characters may move | Fast cuts look wrong at this scale |
| Style | **Pixel art, chunky pixels, limited palette, no photoreal, no text** | The game types its own dialog over the clip, and text baked into a video can't be fixed |
| Where to put it | `assets/cutscenes/video/<name>.mp4` | The game loads it from there, and falls back to the drawn still if it's missing |

Keep the palette close to the game's: sand `#D9C29A`, beige walls `#E6CBA4`, terracotta trim
`#CF8A6C`, dark glass `#2F3A44`, lawn `#6FAE4A`, clear blue sky.

## Prompt 1 - arrival by bus at the BITS Dubai main gate

> Pixel art animation, 16-bit SNES JRPG style, chunky visible pixels, limited warm palette, 16:9,
> 6 seconds, no text, no logos, silent.
> Wide three-quarter view of a modern university campus gate in Dubai at mid-morning: two tall
> sand-beige stone pillars with terracotta trim carrying a wide horizontal signboard, a red-and-white
> boom barrier, a small glass security booth on the right, date palms on both sides, red-brown brick
> paving, a straight asphalt road leading in, low clipped hedges, clear blue sky with soft gradient
> bands and a warm sun.
> Animation: a cream-and-green city bus drives in from the left and comes to a smooth stop at the
> gate; its door folds open; a young female student in a pink top with long black hair steps down
> onto the pavement with a small backpack; the bus pulls away to the right; she stands looking up at
> the gate while the camera pushes in slowly.
> Pixel-art rules: crisp nearest-neighbour pixels, no motion blur, no film grain, no lens flare,
> dithered shading instead of smooth gradients, consistent 1px dark outlines.

## Prompt 2 - walking up to the Main Block entrance

> Pixel art animation, 16-bit SNES JRPG style, chunky visible pixels, 16:9, 6 seconds, no text, silent.
> Symmetrical front view of a large sand-beige university academic building in Dubai: four storeys of
> recessed dark-glass windows in neat rows, a terracotta cornice band, and a grand central entrance
> under a deep red arch with tall dark glass doors, flanked by pale stone pillars and a wide flight of
> light stone steps, with clipped hedges and date palms either side and red-brown brick paving in
> front. Warm morning light, blue sky.
> Animation: the camera follows a young female student in a pink top with long black hair from behind
> as she walks across the paving and climbs the steps towards the glass doors; the doors slide open
> and warm light spills out; the camera pushes gently into the doorway.
> Pixel-art rules: crisp nearest-neighbour pixels, no motion blur, no photoreal texture, dithered
> shading, 1px dark outlines, palette limited to sand, terracotta, deep red, dark teal glass and green.

## Prompt 3 (optional) - the reward box opening, just before the birthday card

> Pixel art animation, 16-bit JRPG style, chunky pixels, 16:9, 4 seconds, no text, silent.
> Close-up of a small wooden box with brass corners resting on a pair of open hands, warm indoor
> light, soft dark background.
> Animation: the lid creaks open, golden light and a burst of pixel sparkles and confetti rise out of
> it, the light grows until it fills the frame and whites out.
> Pixel-art rules: crisp pixels, dithered glow, no motion blur, no lens flare, no text.

## Notes for wiring these in

- The drawn illustration stays as the fallback whenever a video file is missing, so clips are always
  optional and the game never breaks without them.
- Phaser plays video with `this.add.video(...)`. The packaged .exe ([ADR 0010](../../decisions/0010-ship-as-windows-exe-and-web-build.md))
  bundles whatever is in `assets/`, so clips must either be committed or documented as owner-supplied
  like the birthday card's media.
- Player input stays blocked while a clip plays, Esc skips it, and the game's dialog box types over
  the final frame, exactly as the still cutscenes do now.
