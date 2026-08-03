/**
 * Everything about Dan that the site renders lives here, so updating the site
 * is editing one file rather than hunting through JSX.
 */

export interface SocialLink {
  label: string;
  href: string;
  /** lucide-react icon name, resolved in `src/components/social-links.tsx`. */
  icon: "github" | "linkedin" | "instagram" | "graduation-cap";
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
  /** The homepage voice: a person who happens to have a career. */
  blurb:
    "Software engineer by trade, Florida man at heart. I write software for telescopes, point a much smaller one at the same sky, and spend the rest of the week at shows, in record bins, or under a barbell.",
  /** The career voice, used on the Career page and in its meta description. */
  tagline: "I build production software for telescopes, observatories, and astronomers.",
  intro:
    "For the last decade I have worked at the seam between astronomy and software - writing the services, pipelines, and interfaces that turn a night on a mountain into data people can actually use. These days that means leading architecture for Gemini Observatory software at NOIRLab.",
} as const;

export const socials: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/davner", icon: "github" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/danavner/", icon: "linkedin" },
  { label: "Instagram", href: "https://www.instagram.com/aspacemansheavyload/", icon: "instagram" },
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
    note: "I hardly went to shows growing up - too nervous, too timid, always finding a reason not to. That changed in LA, where there is something worth seeing most nights of the week, and now I go to as many as I can. Mostly metalcore, occasionally something completely different. Every one gets logged and rated.",
    to: "/shows",
    feature: true,
  },
  {
    name: "Astrophotography",
    icon: "telescope",
    note: "Mostly just me, a Sony camera, a tripod, and stealing as many photons as I can before sunrise.",
  },
  {
    name: "Video games",
    icon: "gamepad-2",
    note: "Mass Effect is still my favorite game ever made. Lately you will find me on PlayStation, pretending I will finally clear my backlog.",
    handle: {
      label: "PlayStation",
      value: "treslechesplzz",
      href: "https://psnprofiles.com/treslechesplzz",
    },
  },
  {
    name: "Fortnite",
    icon: "swords",
    note: "I have a great squad and an even better duo. Alexis is the perfect sweat to my sweat, and we are always looking for more people to drop in with.",
    handle: {
      label: "Epic",
      value: "danwiththeyams",
      href: "https://fortnitetracker.com/profile/all/danwiththeyams",
    },
  },
  {
    name: "Vinyl",
    icon: "disc",
    note: "Always digging for something new. My favorite record is the Record Store Day 2026 pressing of All We Know Is Falling with the Summer Tic EP - huge thanks to babe for tracking one down after what felt like a nationwide scavenger hunt.",
    handle: { label: "Discogs", value: "dnafam", href: "https://www.discogs.com/user/dnafam" },
  },
  {
    name: "Comic books",
    icon: "book-open",
    note: "Wednesday means new comic day. You will usually find me at the shop with my comic book cuties, Mikey and Kiwi, arguing about what to pull next.",
  },
  {
    name: "Weightlifting",
    icon: "dumbbell",
    note: "The one part of my week that gives immediate, honest feedback. No debugging, no opinions - the bar either moves or it does not.",
  },
  {
    name: "Legos",
    icon: "blocks",
    note: "I still love building sets, especially with my nephew Nathan. Turns out they are just as fun as they were twenty years ago.",
  },
];

export const funFact = "Was once ranked 2nd in the state of Florida for bowling.";
