# Suburb data

`suburbs.json` is the Australian locality list used by signup, Edit my details, listing creation, and IM BUYIN distance lookups.

Each row is `[suburb, state, postcode, lat, lng]`.

- `suburb`, `state`, and `postcode` are strings. Postcodes are 4 digits (`08xx` for the Northern Territory).
- `lat` and `lng` are numbers, rounded to 4 decimal places.
- Existing code can keep reading `const [suburb, state, postcode] = row`. The coordinates are extra slots.

Coordinates come from [Elkfox australian-postcode-data](https://github.com/Elkfox/australian-postcode-data) (`au_postcodes.csv`). CSV postcodes are zero-padded to 4 digits and matched on suburb, state, and postcode. Three external territories (Christmas Island, and the Cocos (Keeling) Islands home and west islands) keep their real coordinates, which sit west of longitude 110.
