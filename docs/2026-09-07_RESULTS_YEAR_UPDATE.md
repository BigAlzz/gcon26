# Results year update

The qualification and profile forms now share a year-of-results list that begins with the current calendar year and descends through 1990. The list is generated in `source/src/main.jsx` from the current year, so it continues to include a new year automatically while retaining 1990 as the earliest selectable value.

The rendered local qualification checker was verified at `http://127.0.0.1:4173/`: it displayed 37 options for 2026 through 1990, and selecting 1990 updated the control successfully. The browser console remained clear.
