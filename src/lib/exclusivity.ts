// Shared copy for the "secure the idea" feature. Reused across the seller
// modals, the public idea page, and the bought-idea view so the wording stays
// consistent. The framing emphasises securing the idea — keeping it away from
// future rivals — not that the idea "becomes yours".
//
// (Internal identifiers still say "exclusivity" to match the DB columns; only
// the user-facing copy below uses "secure".)

export const EXCLUSIVITY_SHORT =
  "Let a buyer pay to secure this idea — pulling it off the market so no future rivals can get it too.";

export const EXCLUSIVITY_FULL =
  "Like the idea? A buyer who already owns it can pay extra to secure it — removing it from the marketplace so no future rivals can buy it too. " +
  "Once secured, the idea is no longer listed, searchable, or recommended, and no new buyers can get it. " +
  "Anyone who already bought it keeps full access; only the public listing goes away.";

export const EXCLUSIVITY_BUYER_NOTE =
  "Like the idea? Buy it at the regular price first, then you can pay to secure it — removing it from the market so no future rivals can get it too. " +
  "Everyone who already bought it keeps access; only the public listing goes away.";
