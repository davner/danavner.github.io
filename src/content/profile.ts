/**
 * Everything about Dan that the site renders lives here, so updating the site
 * is editing one file rather than hunting through JSX.
 */

export interface SocialLink {
  label: string;
  href: string;
  /** lucide-react icon name, resolved in `src/components/social-links.tsx`. */
  icon: "github" | "linkedin" | "instagram" | "youtube" | "graduation-cap";
}

export interface Role {
  title: string;
  org: string;
  location: string;
  period: string;
  /** Sorted newest-first for display; used only for ordering. */
  start: number;
  summary: string;
  highlights: string[];
  stack: string[];
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface Education {
  school: string;
  location: string;
  period: string;
  degree: string;
}

export interface Interest {
  name: string;
  icon:
    | "music"
    | "telescope"
    | "gamepad-2"
    | "swords"
    | "disc"
    | "book-open"
    | "blocks"
    | "dumbbell";
  note: string;
  /** A handle worth sharing, e.g. a gamertag. `href` makes it a link. */
  handle?: { label: string; value: string; href?: string };
  /** Internal route this interest has more of, if there is one. */
  to?: string;
  /** Renders across the full width of the grid. One at most, and first. */
  feature?: boolean;
}

export const profile = {
  name: "Dan Avner",
  fullName: "Louis Dan Avner",
  role: "Software Engineer III",
  org: "NOIRLab / AURA",
  location: "Los Angeles County, CA",
  /**
   * Split so the address is never a single scrapeable string in the bundle or
   * the DOM. Joined at click time by `<EmailReveal />`.
   */
  emailUser: "ldpavner",
  emailDomain: "gmail.com",
  /**
   * Shows where this is the only name in `with` render as a duo rather than a
   * list of one. Player two.
   */
  partner: "Alexis A.",
  /** How she is referred to in prose, as opposed to in a companions list. */
  partnerFirstName: "Alexis",
  /**
   * The kicker between the name and the greeting on the landing page. Split
   * into three so each sentence can wrap as its own unit.
   */
  quest: {
    label: "Main quest",
    main: "Live a life worth remembering.",
    aside: "Side quests encouraged.",
  },
  /** The homepage voice. Kept apart from the blurb so it can be accented. */
  greeting: "Hi, I'm Dan.",
  blurb:
    "This is where I share the things I build, the concerts I never skip, the quiet summer nights at the park with Alexis and our pup, and the adventures we find along the way.",
  /** The career voice, used on the Career page and in its meta description. */
  tagline: "I write production software for telescopes and the people who have to use it at 3 a.m.",
  intro:
    "I have spent about a decade writing the software that sits between a telescope and the astronomer using it. Some of that is the services that run an observation. A lot of it is the interface someone is staring at when the weather turns at 2 a.m. Right now I lead the architecture for GPP Resource, a Gemini Program Platform project at NOIRLab.",
} as const;

export const socials: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/davner", icon: "github" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/danavner/", icon: "linkedin" },
  { label: "Instagram", href: "https://www.instagram.com/aspacemansheavyload/", icon: "instagram" },
  { label: "YouTube", href: "https://www.youtube.com/@danmadespace", icon: "youtube" },
  {
    label: "Google Scholar",
    href: "https://scholar.google.com/citations?user=B0HllkYAAAAJ&hl=en",
    icon: "graduation-cap",
  },
];

export const roles: Role[] = [
  {
    title: "Software Engineer III",
    org: "NOIRLab / AURA",
    location: "Remote",
    period: "2023 - Present",
    start: 2023,
    summary: "Architecture and development of astronomy software for Gemini Observatory.",
    highlights: [
      "Principal software engineer and architect for GOATS, an end-to-end system for time-domain and multi-messenger astronomy aimed at Gemini follow-up observations.",
      "Transitioned the DRAGONS data reduction pipeline to a web-based platform, with Django backend services and real-time frontend communication over WebSockets.",
      "Lead engineer and architect for gpp-client, an async Python SDK for the Gemini Program Platform with environment-aware authentication and authenticated GraphQL/REST access.",
      "Applied continuous integration practices - environment setup, unit and integration testing - using Jenkins and GitHub Actions to keep builds reliable.",
    ],
    stack: ["Python", "Django", "GraphQL", "WebSockets", "Jenkins", "GitHub Actions"],
  },
  {
    title: "Application Developer",
    org: "California Institute of Technology / IPAC",
    location: "Pasadena, CA",
    period: "2021 - 2023",
    start: 2021,
    summary: "Production pipeline development for NASA's SPHEREx mission.",
    highlights: [
      "Developed production-quality data-processing pipeline software in Python for NASA's SPHEREx spacecraft mission.",
      "Collaborated with the pipeline architect and scientific team to develop astrophysics data processing algorithms.",
      "Integrated Rubin Observatory Pipeline and Butler packages into the processing pipeline.",
      "Worked in a Jira and Git workflow with robust pipeline testing and Jenkins CI.",
    ],
    stack: ["Python", "Rubin Pipelines", "Butler", "Jira", "Jenkins"],
  },
  {
    title: "R&D Software Engineer III",
    org: "University of Arizona, Steward Observatory",
    location: "Tucson, AZ",
    period: "2019 - 2021",
    start: 2019,
    summary: "Telescope automation, control software, and operator-facing interfaces.",
    highlights: [
      "Designed, developed, and tested software to automate telescopes for both classical and autonomous observing modes.",
      "Specified, implemented, tested, and integrated software and upgrades for telescopes, instruments, and observatory tools.",
      "Built web GUIs with modern design aimed at functional, foolproof user experiences for observers.",
      "Led projects end to end - embedded firmware through user frontend - for dome shutters, dome control, and mirror covers.",
    ],
    stack: ["Python", "C", "INDI", "FastAPI", "JavaScript", "Embedded"],
  },
];

export const observing = {
  nights: "150+",
  telescopes: ["Kuiper 61″", "Bok 90″", "1.8 m Perkins", "0.6 m LONEOS", "4.3 m LDT"],
} as const;

export const skills: SkillGroup[] = [
  {
    label: "Languages",
    items: ["Python", "JavaScript", "TypeScript", "C", "C++", "HTML5 / CSS3", "Shell", "MATLAB"],
  },
  {
    label: "Frameworks",
    items: [
      "Django",
      "FastAPI",
      "Flask",
      "React",
      "Astropy",
      "INDI",
      "IRAF",
      "PyQt",
      "Tkinter",
      "Bootstrap",
    ],
  },
  {
    label: "Tools",
    items: ["Docker", "Git & GitHub", "Jenkins", "Jira", "Jupyter", "SExtractor", "SCAMP"],
  },
  {
    label: "Platforms",
    items: ["Linux (Ubuntu, RHEL, CentOS)", "macOS", "Windows", "Raspberry Pi OS"],
  },
];

export const education: Education[] = [
  {
    school: "Northern Arizona University",
    location: "Flagstaff, AZ",
    period: "2015 - 2017",
    degree: "M.S. Applied Physics",
  },
  {
    school: "University of Florida",
    location: "Gainesville, FL",
    period: "2009 - 2013",
    degree: "B.A. Astronomy",
  },
];

export const interests: Interest[] = [
  {
    name: "Live music",
    icon: "music",
    note: "I barely went to shows growing up. I was too nervous, and there was always a reason not to go. Then I moved to LA, where there is something worth seeing most nights, and I ran out of reasons. Mostly metalcore, emo, and pop punk, occasionally something completely different. Check out my ratings.",
    to: "/shows",
    feature: true,
  },
  {
    name: "Astrophotography",
    icon: "telescope",
    note: "Just a Sony camera on a tripod, no telescope. Los Angeles is far too bright for it, so it only really happens when I can get out to a dark sky, which is not as often as I would like.",
  },
  {
    name: "Video games",
    icon: "gamepad-2",
    note: "Mass Effect is the best game ever made and I will not be taking questions. These days I am mostly on PlayStation, playing Fortnite. I still have not finished Expedition 33.",
    handle: {
      label: "PlayStation",
      value: "treslechesplzz",
      href: "https://profile.playstation.com/treslechesplzz",
    },
  },
  {
    name: "Fortnite",
    icon: "swords",
    note: "The squad is good and the duo is better, because the duo is Alexis. There is always room for one more.",
    handle: {
      label: "Epic",
      value: "danwiththeyams",
      href: "https://store.epicgames.com/u/c8d91b5d775c424faaca60ccb06765b6",
    },
  },
  {
    name: "Vinyl",
    icon: "disc",
    note: "My favorite record is the Record Store Day 2026 pressing of All We Know Is Falling with the Summer Tic EP. Babe tracked one down after what turned into a nationwide scavenger hunt. Still digging for the next one.",
    handle: { label: "Discogs", value: "dnafam", href: "https://www.discogs.com/user/dnafam" },
  },
  {
    name: "Comic books",
    icon: "book-open",
    note: "New comic day is Wednesday. I am usually at the shop with Mikey and Kiwi, my comic book cuties, discussing what to pull next.",
    handle: { label: "League of Comic Geeks", value: "aspacemansheavyload", href: "https://leagueofcomicgeeks.com/profile/aspacemansheavyload" }
  },
  {
    name: "Weightlifting",
    icon: "dumbbell",
    note: "Weirdly, my bowling coach in high school was a football player at Notre Dame. He taught me how to lift, and I have been doing it on and off ever since. Sometimes I'm strong, and sometimes I'm squishy.",
  },
  {
    name: "Legos",
    icon: "blocks",
    note: "Still building sets, mostly with my nephew Nathan. Thirty-one years on, I have not gotten bored of them, and I do not expect to.",
  },
];

export const funFact = "Was once ranked 2nd in the state of Florida for bowling.";
