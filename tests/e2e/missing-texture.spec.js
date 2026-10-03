// FB-0044: some students drew as Phaser's black box with a green diagonal -- the `__MISSING` texture --
// because `npc-ambient-a..f` were generated but never loaded by BootScene's preload (src/main.js).
// The preload list is now derived from the content (src/maplogic.js characterSheets(), checked by
// tests/unit/characters.test.js); this checks the real thing in a real scene.
//
// Written but NOT run this session: docs/QUALITY_LOOP.md's build phase allows unit tests only (no
// Playwright runs). The first real execution is the next full test round.
const { test, expect } = require('@playwright/test');
const { openGame, waitForMap } = require('./helpers');

// Every game object in the world scene's display list that is drawing the missing-texture placeholder
// (Phaser's TextureManager gives a game object `texture.key === '__MISSING'` when its key isn't loaded),
// plus the loaded sheet keys the ambient/NPC sprites were created from, for a useful failure message.
function missingTextures(page) {
  return page.evaluate(() => {
    const world = game.scene.getScene('world');
    const bad = world.children.list
      .filter((obj) => obj.texture && obj.texture.key === '__MISSING')
      .map((obj) => ({ type: obj.type, x: Math.round(obj.x), y: Math.round(obj.y), name: obj.name || null }));
    const ambient = (world.ambientNpcs || []).map((a) => a.def.character);
    return { bad, ambientCharacters: ambient };
  });
}

test.describe('FB-0044: no __MISSING texture on campus or in the Main Block', () => {
  for (const map of ['campus', 'main-block-g', 'main-block-1', 'main-block-3']) {
    test(`FB-0044: no __MISSING texture on ${map}`, async ({ page }) => {
      const { errors } = await openGame(page, { map });
      await waitForMap(page, map);
      // Give createAmbient()/createNpcs() a few frames to put every sprite in the display list.
      await page.waitForTimeout(300);
      const { bad, ambientCharacters } = await missingTextures(page);
      expect(bad, `game objects drawing __MISSING on ${map} (ambient characters here: ${ambientCharacters.join(', ')})`).toEqual([]);
      // Phaser also logs "Texture key already in use"/"Failed to process file" for a load that went wrong.
      expect(errors.filter((e) => /texture|spritesheet|404/i.test(e))).toEqual([]);
    });
  }

  test('FB-0044: no __MISSING texture on campus or in the Main Block (every character sheet is loaded)', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    // Every character sheet the content references is in the TextureManager, not just the ones the
    // current map happens to draw -- the next map's NPCs/ambient students must be ready too.
    const missingKeys = await page.evaluate(() =>
      characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => s.key).filter((key) => !game.textures.exists(key)));
    expect(missingKeys).toEqual([]);
    // ADR 0018: and every animal sheet (derived from src/animals.js the same way).
    const missingAnimals = await page.evaluate(() =>
      animalSheets(ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS).map((s) => s.key).filter((key) => !game.textures.exists(key)));
    expect(missingAnimals).toEqual([]);
  });
});
