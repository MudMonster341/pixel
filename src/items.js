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
};
