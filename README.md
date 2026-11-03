# IM DRIVN

IM DRIVN is a free Australian car marketplace prototype. Browse Daily, Performance, and Supercar listings, save cars, or list one for sale. Every vehicle and seller is demo data — nothing is really submitted.

Open `index.html` in a browser, or visit the published site once GitHub Pages has deployed it. There is no build step: the site is plain HTML, CSS, and vanilla JavaScript.

## Suburb list

`data/suburbs.json` is the locality list for the listing location step. Each row is `[suburb, state, postcode]`. It is built from the [Elkfox Australian Postcode Data](https://github.com/Elkfox/australian-postcode-data) file `au_postcodes.csv`, which is licensed under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/). Elkfox reformatted the [GeoNames](https://www.geonames.org/) Australia postal-code extract. Mail-centre and PO Box style names (BC, DC, MC, MSC, GPO, mail centres) were removed, duplicates were dropped, and names are title case.
