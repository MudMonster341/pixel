// Every item in the game. `frame` is the icon's position in assets/items.png, and the position of
// the matching small sprite in assets/held-items.png (both sheets share the same frame order).
// `maxStack` is how many fit in one inventory slot.
const ITEMS = {
  apple: { name: 'Apple', frame: 0, maxStack: 5 },
  sword: { name: 'Old Sword', frame: 1, maxStack: 1 },
  keycard: { name: 'Keycard', frame: 2, maxStack: 1 },
  phone: { name: 'Phone', frame: 3, maxStack: 1 },
  idCard: { name: 'Student ID', frame: 4, maxStack: 1 },
  notebook: { name: 'Notebook', frame: 5, maxStack: 3 },
  laptop: { name: 'Laptop', frame: 6, maxStack: 1 },
  coffee: { name: 'Coffee', frame: 7, maxStack: 1 },
  // The LUG treasure hunt (docs/STORY.md, M3): the 3 keys and the reward box. Icons are blitted from
  // the Kyrise 16x16 RPG Icon Pack (assets/vendor/kyrise-16x16-rpg-icons), not hand-drawn -- see
  // tools/make-assets.js's VENDOR_ITEM_ICONS section.
  keyPhysicsLab: { name: 'Physics Lab Key', frame: 8, maxStack: 1 },
  keyIcvl: { name: 'ICVL Key', frame: 9, maxStack: 1 },
  keyRoom195: { name: 'Room 195 Key', frame: 10, maxStack: 1 },
  lugBox: { name: 'Small Box', frame: 11, maxStack: 1 },
};
