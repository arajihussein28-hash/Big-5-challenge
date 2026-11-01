# Big-O Quest

A pixel-art game with five small challenges. Each challenge teaches one growth rate by
running a real algorithm and counting its steps.

| Door | Algorithm | Growth | What you count |
|------|-----------|--------|----------------|
| Magic Inventory | Direct array access | O(1) | Array reads |
| Treasure Search | Binary search on sorted chests | O(log n) | Chests checked |
| Dungeon Search | Linear search through rooms | O(n) | Rooms checked |
| Crystal Merge | Merge sort | O(n log n) | Comparisons and writes |
| Coin Selection | Selection sort | O(n²) | Comparisons and swaps |

## Run it

The game uses ES modules, so it must be served over HTTP. Opening `index.html`
directly from disk will not work in most browsers.

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in a browser.

Run the tests (needs Node 18 or newer):

```bash
node --test
```

## How to play

- **Learn mode:** press Start and watch. Pause, press Next step, or change the speed.
- **Challenge mode:** the algorithm runs until it reaches a decision, then waits for you.
  Click the right chest or room, or pick the left or right crystal. Wrong clicks count as
  mistakes, not as algorithm operations.
- **Try a bigger n:** after a run, double the input size and compare the operation counts
  for the same method at n and 2n.

## Project layout

```
index.html          Menu, how-to screen, and game screen
style.css           Pixel styling and the phone layout
js/main.js          Connects the screens, controls, timers, and result panel
js/algorithms.js    The five algorithms. Each returns a list of actions and counts.
js/levels.js        Each level's input generator, text, and comparison data
js/game-state.js    Turns actions into frames (what the screen shows) and saves progress
js/renderer.js      Draws the pixel scene on a canvas and maps clicks to chests
js/challenges.js    Challenge decisions, feedback, and stars
tests/              Unit tests (node:test, no dependencies)
```

## The key design idea: algorithms record actions, the screen replays them

Each algorithm runs once and returns a list of plain objects describing what it did:

```js
[
  { type: "check", index: 3, decision: { kind: "index", answer: 3 } },
  { type: "eliminate", from: 0, to: 3 },
  { type: "check", index: 5, decision: { kind: "index", answer: 5 } },
  { type: "found", index: 5 }
]
```

The rest of the game works from that list:

- **Pause, step, speed, and reset** only move a position in the list. Nothing is recomputed.
- **Drawing** happens in `applyAction` (game-state.js), which turns one action into the next
  frame. The frame holds the values, the marks on each chest, and the counts so far.
- **Challenge mode** uses the same list. An action with a `decision` field is a moment where
  the player must choose. The answer is already in the list, so checking a click is one
  comparison.
- **Counts** come from the algorithm alone. A player's wrong click never changes them,
  so the operation count still shows the algorithm's real complexity.

## Fair comparisons

Each comparison table uses the same inputs for each method:

- Linear and binary search use the same sorted chests, and the key is in the last room
  (the worst case for linear search).
- Selection and merge sort use the same shuffled items, from a fixed random seed.
- Direct access is shown on its own, because it answers a different question.

The table is not a ranking of all five. Searching and sorting solve different problems,
and one lucky search does not show worst-case growth.

## Notes

- Sorting the chests before binary search is not counted. Sorting costs extra work, which
  is a real cost of using binary search.
- Progress and sound settings are saved in the browser. If the browser blocks storage,
  the game still works and the progress lasts for that visit.
- Sprites are drawn in code with small rectangles, so the game needs no image files.
