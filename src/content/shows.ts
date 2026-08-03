/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  PLACEHOLDER DATA — replace every entry below with shows you have    │
 * │  actually been to. These were invented to build and demo the page.   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Adding a show is appending one object. Newest or oldest order does not
 * matter — the page sorts by date and groups by year.
 */

export interface Show {
  /** `YYYY-MM-DD`. */
  date: string;
  headliner: string;
  /** Openers and co-headliners, in running order. */
  support?: string[];
  venue: string;
  city: string;
  /** Tour or festival name, if it had one. */
  tour?: string;
  /** One line about the night. Shown on the entry. */
  note?: string;
  /** Pins it to the top of the page as a standout. */
  standout?: boolean;
}

export const shows: Show[] = [
  {
    date: "2026-06-20",
    headliner: "Knocked Loose",
    support: ["Show Me the Body", "Speed"],
    venue: "Hollywood Palladium",
    city: "Los Angeles, CA",
    standout: true,
    note: "Floor was a single organism for forty minutes. Ears rang until Sunday.",
  },
  {
    date: "2026-04-11",
    headliner: "Spiritbox",
    support: ["Loathe", "Gel"],
    venue: "The Wiltern",
    city: "Los Angeles, CA",
    tour: "Tsunami Sea",
  },
  {
    date: "2026-02-27",
    headliner: "Converge",
    support: ["Zao"],
    venue: "The Belasco",
    city: "Los Angeles, CA",
    note: "Jane Doe front to back. Twenty-plus years old and still the heaviest thing in the room.",
  },
  {
    date: "2025-11-08",
    headliner: "Turnstile",
    support: ["Snail Mail"],
    venue: "Kia Forum",
    city: "Inglewood, CA",
    standout: true,
    note: "Least metalcore show on this list and somehow the best crowd of the year.",
  },
  {
    date: "2025-09-14",
    headliner: "Architects",
    support: ["While She Sleeps", "ERRA"],
    venue: "Shrine Expo Hall",
    city: "Los Angeles, CA",
  },
  {
    date: "2025-07-19",
    headliner: "Silent Planet",
    support: ["Counterparts", "Greyhaven"],
    venue: "The Regent Theater",
    city: "Los Angeles, CA",
    note: "Second time this year. Worth it both times.",
  },
  {
    date: "2025-05-03",
    headliner: "Underoath",
    support: ["The Devil Wears Prada"],
    venue: "The Fonda Theatre",
    city: "Los Angeles, CA",
    tour: "They're Only Chasing Safety 20th",
  },
  {
    date: "2025-03-22",
    headliner: "Code Orange",
    support: ["Vein.fm"],
    venue: "1720",
    city: "Los Angeles, CA",
    note: "Warehouse show. No barricade. Questionable decisions all around.",
  },
  {
    date: "2025-01-25",
    headliner: "Silent Planet",
    support: ["Thornhill"],
    venue: "The Glass House",
    city: "Pomona, CA",
  },
  {
    date: "2024-10-12",
    headliner: "Killswitch Engage",
    support: ["Fit For An Autopsy", "Kublai Khan TX"],
    venue: "The Novo",
    city: "Los Angeles, CA",
  },
  {
    date: "2024-08-17",
    headliner: "Every Time I Die",
    support: ["SeeYouSpaceCowboy"],
    venue: "Teragram Ballroom",
    city: "Los Angeles, CA",
    note: "Sweatiest room I have ever stood in. Ten out of ten.",
  },
  {
    date: "2024-06-01",
    headliner: "Bad Omens",
    support: ["Poppy", "Erra"],
    venue: "The Observatory",
    city: "Santa Ana, CA",
  },
  {
    date: "2024-03-09",
    headliner: "Norma Jean",
    support: ["End"],
    venue: "Chain Reaction",
    city: "Anaheim, CA",
    note: "Tiny room, low ceiling, absolutely no reason for it to be that loud.",
  },
  {
    date: "2024-01-19",
    headliner: "Thy Art Is Murder",
    support: ["Sanguisugabogg"],
    venue: "The Regent Theater",
    city: "Los Angeles, CA",
  },
];
