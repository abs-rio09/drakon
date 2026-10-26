# Data sources

Outside data that ships with DRAKON. Names are used exactly as the source
spells them; nothing is made up. Before adding a source, check its license
and add it here.

## Area / Thana suggestions (`area_suggestions`, migration `00010_area_suggestions.sql`)

The checkout suggests these names in the Area / Thana box. They only help:
the buyer may type anything (for example "Mirpur 10").

| What | Source | Version | License |
|---|---|---|---|
| Upazilas of all 64 districts (489 names; Dhaka district's 5 are used for "Outside Dhaka city") | [nuhil/bangladesh-geocode](https://github.com/nuhil/bangladesh-geocode), files `districts/districts.csv` and `upazilas/upazilas.csv` | commit `5622f68bd07a98e076edcf8100bf0db6a75b9854` (2023-03-17) | MIT, © 2014 Nuhil Mehdy |
| Dhaka city: the 50 Dhaka Metropolitan Police thanas | Wikipedia, ["Dhaka Metropolitan Police"](https://en.wikipedia.org/wiki/Dhaka_Metropolitan_Police), section "Thana list of Dhaka Metropolitan Police" | revision `1378840650` (read 2026-10-26) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

### Changes we made
- District names follow our `delivery_areas` table. Four bangladesh-geocode
  spellings are renamed: Barisal → Barishal, Chapainawabganj → Chapai
  Nawabganj, Coxsbazar → Cox's Bazar, Jhalakathi → Jhalokati. Upazila and
  thana names are not changed (so "Coxsbazar Sadar" stays as written).
- Only bangladesh-geocode's upazilas are used: it has no city-corporation
  thanas, so other cities (Chattogram, Khulna, …) get upazilas only.

### Why Wikipedia for the DMP thanas
The DMP's own page (dmp.gov.bd, "Find your local police", read 2026-10-26)
lists only 48 stations, misses Khilgaon and Hatirjheel, and has typos
("Bsahantek", "Tejgoan"). Abu Bakkar Siddik chose the Wikipedia list.

### Checks
`TestAreaSuggestionsMatchDistricts` (`api/internal/httpapi/area_suggestions_test.go`)
fails if a suggestion names a district we do not have, or if any delivery
area has no suggestions.
