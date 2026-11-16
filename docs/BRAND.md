# Bearing identity, version 2

Agreed step by step on 2026-11-16. The working version is the live prototype
`docs/identity/round-10.html`; the reasoning behind the product is in `BRAND-CORE.md`. The app
uses this identity under `apps/web/src/bearing/`; the six earlier directions and the retired
"Slate" mark are still in the repository and are to be removed. The older guide `docs/identity/bearing-identity.html` is out of date (it still shows colour
fades and soft neutrals).

## In one sentence

Black and white, cards one level deep. The only colour on a page belongs to a team, and it appears as flat discs
and dots. Live is the thing that moves.

Not part of it, by decision: a brand accent colour, red for live, shaded or 3D shapes, gradients or
colour fades of any kind, paper or serif styling, rounds shown in a circle, boxes inside boxes, a page with no boxes at all.

## Logo

A ball seated in its ring, always in one colour. Files are in `docs/brand/`:

| File                       | Use                                    |
| -------------------------- | -------------------------------------- |
| `bearing-mark.svg`         | Black mark on light                    |
| `bearing-mark-white.svg`   | White mark on dark                     |
| `bearing-mark-current.svg` | Takes the text colour, for use in code |
| `bearing-icon.svg`         | App icon: white mark on a black square |

Construction, on a 64 grid:

1. A ring: centre 32,32; 10 thick; centre line radius 21.
2. A ball one and a half times as wide as the ring is thick (radius 7.5), centred on the ring's
   centre line at 45°, up and to the right (46.85, 17.15).
3. The ring is cut back by a circle of radius 11 around the ball, leaving an even gap a third of the
   ring's thickness.

Clear space: one ball-width on every side. Smallest size: 16 pixels. Wordmark: "bearing", Gabarito
ExtraBold, lowercase, letter-spacing −0.03em, two-thirds as tall as the mark, a quarter of the
mark's width away.

The logo files use `#0a0b0e` for black; change them to `#000` when the app adopts pure neutrals.

Owed: nobody has checked this mark against existing logos. An open ring with a dot is a common
shape, so that check is needed before any public launch.

## Colour

| Token    | Light        | Dark         |
| -------- | ------------ | ------------ |
| Ground   | `#FFFFFF`    | `#000000`    |
| Surface  | `#FFFFFF`    | `#111111`    |
| Sunk     | `#F1F1F1`    | `#1E1E1E`    |
| Ink      | `#000000`    | `#FFFFFF`    |
| Ink 2    | `#5C5C5C`    | `#A6A6A6`    |
| Ink 3    | `#999999`    | `#6B6B6B`    |
| Hairline | black at 10% | white at 13% |
| Dot edge | black at 18% | white at 20% |

Team colours appear in two forms only, both flat:

1. **A mark or a disc**: a team is shown by its own mark where a source has one, standing free
   with nothing behind it; a mark that would be lost on the ground keeps a plain plate. A
   player's picture fills a disc. Without a picture, a team or player is a flat circle in its
   colour with its short name on it. (Changed by the owner on 2026-11-16; before that, no logos.)
2. **A dot**: one thing won.

Never as text, a button, a background, a tint, a bar or a glow. Sample data must rotate through
several teams so that no colour reads as the brand's.

- Two teams that look alike: the second-named team switches to its second colour; if it has none, it
  takes ink.
- No colours (chess players): ink and the surface colour.
- Many competitors (a Trackmania final): a fixed set of four, in starting order: `#00C978`,
  `#FF8A00`, `#7A5CFF`, `#19A8FF`.

## Type

Gabarito (SIL Open Font License) for everything read; Geist Mono for small technical labels.
Gabarito was chosen for its round bowls and dots, its tabular figures and its unmistakable 1, and
because it is little used (ranked 319 of 1,961 families on Google Fonts in November 2026).

| Role    | Size | Weight   | Notes                          |
| ------- | ---- | -------- | ------------------------------ |
| Display | 50   | 800      | −0.03em; names in a header     |
| Title   | 26   | 800      | −0.03em; page titles           |
| Heading | 19   | 800      | −0.02em                        |
| Body    | 13   | 400, 600 |                                |
| Small   | 11   | 600      | Ink 2                          |
| Label   | 10   | 500 mono | Uppercase, +0.08em, Ink 2 or 3 |

- Weight carries meaning: who is playing is ExtraBold; the score is Regular at the same size.
- Scores and times always use tabular figures.

## Layout: cards, one level deep

Chosen after comparing three layouts in the prototype: cards won over a fully open page and over a
mix of the two, on condition that they are used with care and never as box in box in box.

1. A box holds one thing or one list: the live match, what is next, earlier results, the maps of a
   series. Never a mixture.
2. Boxes never nest. No card inside a card, and no tinted panel behind a group of cards. Every box
   sits directly on the page.
3. Inside a box there are only hairlines and space. Rows are separated by a hairline. No inner
   boxes, and no chips with their own background: a status is plain text with the live dot.
4. Headings stay outside. The page title, the small section labels and the big score on a match
   page lie on the page. A box never has its own title bar.
5. One shape. Every box has the same hairline border, the same single soft shadow and a radius
   of 24. Only the live match is larger, with a radius of 28.
6. Controls are not boxes. The navigation, the search field and the selected day keep their own
   shapes and never sit inside a card.

Measures: card padding 14 to 16; 12 between cards; a section label sits 8 above its card, in Label
type and Ink 2; 20 between sections.

Navigation: a small floating capsule at the bottom with four Lucide icons and no labels (Today,
Schedule, Following, Search), and a marker that slides to the selected one. Icons everywhere are
Lucide, the set already installed in the app.

## The dot

One thing won, in the colour of whoever won it, in the order it happened. Always flat, always on a
line.

| State        | Drawing                                         |
| ------------ | ----------------------------------------------- |
| Won          | Filled with the winner's colour                 |
| Being played | An ink outline that breathes; one per match     |
| To come      | A pale outline; left out once the match is over |

How a match is drawn depends on the room it has:

| Game              | Small: a card                                             | Full: the match page                                              |
| ----------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Counter-Strike 2  | Every round of the live map, in two rows of twelve        | The same per map, plus rounds above and below a line for momentum |
| League of Legends | One dot per game; kills and the clock as numbers          | Objectives on the game clock, above and below a line, by size     |
| Rocket League     | Goals of the live game as the score; one dot per game     | Goals on the five-minute clock; earlier games with goals in order |
| Chess             | One dot per game; a draw is shared                        | A row per player; the move count of the game in progress          |
| Trackmania        | One dot per round, in the colour of the driver who won it | A row per driver; the places the followed driver took             |

In a wide header the series is a line of stops. Each stop is a map or a game, filled with the colour
of whoever won it, and the one being played opens into its detail (rounds, or events on a clock).

## Live and motion

Nothing is red. A live match is first on the page, with a pinging dot and one open dot.

| Motion             | Timing                                 | Where                  |
| ------------------ | -------------------------------------- | ---------------------- |
| Live ping          | 1.8 s, ease-out, repeats               | Only on something live |
| A dot lands        | 0.34 s, overshoot (`0.2, 1.5, 0.4, 1`) | When something is won  |
| The score ticks    | 0.26 s, rises into place               | When the score changes |
| Next steps forward | 0.5 s, ease-out (`0.2, 0.8, 0.2, 1`)   | When a match ends      |
| Marker slides      | 0.34 s, slight overshoot               | Navigation             |

With reduced motion every loop stops and changes happen at once. Nothing depends on motion to be
understood.

## Still open

- The exact test for "two teams look alike".
- Screens not yet drawn: team, player, tournament and bracket pages.
- Trade mark and logo-similarity checks before public launch.
