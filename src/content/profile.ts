/**
 * Everything about Dan that the site renders lives here, so updating the site
 * is editing one file rather than hunting through JSX.
 */

export interface SocialLink {
  label: string;
  href: string;
  /** lucide-react icon name, resolved in `src/components/social-links.tsx`. */
  icon: "github" | "linkedin" | "instagram" | "mail" | "graduation-cap";
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

export interface Project {
  name: string;
  org: string;
  blurb: string;
  stack: string[];
  href?: string;
  /** Shown with a live dot on the home page. */
  current?: boolean;
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
  icon: "dumbbell" | "telescope" | "gamepad-2" | "drum" | "blocks";
  note: string;
}

export const profile = {
  name: "Dan Avner",
  fullName: "Louis Dan Avner",
  role: "Software Engineer III",
  org: "NOIRLab / AURA",
  location: "Los Angeles County, CA",
  email: "ldpavner@gmail.com",
  /**
   * Shows where this is the only name in `with` render as a duo rather than a
   * list of one. Player two.
   */
  partner: "Alexis A.",
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
  { label: "Email", href: "mailto:ldpavner@gmail.com", icon: "mail" },
];

export const projects: Project[] = [
  {
    name: "GOATS",
    org: "NOIRLab",
    current: true,
    blurb:
      "The Gemini Observation and Analysis of Targets System - an end-to-end platform for time-domain and multi-messenger astronomy. Astronomers manage targets, trigger Gemini follow-up, and reduce the resulting data without leaving the browser. I am the principal engineer and architect.",
    stack: ["Python", "Django", "JavaScript", "WebSockets", "TOM Toolkit"],
  },
  {
    name: "gpp-client",
    org: "NOIRLab",
    current: true,
    blurb:
      "The asynchronous Python SDK for the Gemini Program Platform. Environment-aware authentication, domain-based resource interfaces, and authenticated GraphQL and REST access, so tools and automation can drive programs and observations directly. Lead engineer and architect.",
    stack: ["Python", "asyncio", "GraphQL", "SDK design"],
  },
  {
    name: "DRAGONS on the web",
    org: "NOIRLab",
    current: true,
    blurb:
      "Moved the DRAGONS data reduction pipeline off the command line and onto a browser-accessible platform - Django for backend services, WebSockets pushing real-time reduction progress to the frontend.",
    stack: ["Python", "Django", "WebSockets", "Data pipelines"],
  },
  {
    name: "SPHEREx pipeline",
    org: "Caltech / IPAC",
    blurb:
      "Production data-processing software for NASA's SPHEREx all-sky infrared survey, built alongside the pipeline architect and science team, with Rubin Observatory Pipelines and Butler integrated into the processing flow.",
    stack: ["Python", "Rubin Pipelines", "Butler", "Jenkins CI"],
  },
  {
    name: "Telemetry & weather displays",
    org: "Steward Observatory",
    blurb:
      "An async Python backend streaming live observatory telemetry over WebSockets to a responsive web dashboard - weather, dome, and instrument state visible from anywhere.",
    stack: ["Python", "FastAPI", "WebSockets", "JavaScript", "Bootstrap"],
  },
  {
    name: "Guidebox & INDI driver",
    org: "Steward Observatory",
    blurb:
      "Debugged and rebuilt the INDI driver and client GUI for the Vatican telescope guidebox, eliminating nearly all of the observing time that had been lost to guidebox faults.",
    stack: ["C", "INDI", "Embedded"],
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
    name: "Weightlifting",
    icon: "dumbbell",
    note: "The one part of my week that gives immediate, honest feedback.",
  },
  {
    name: "Astrophotography",
    icon: "telescope",
    note: "Same sky as the day job, slower pace, much smaller telescope.",
  },
  {
    name: "Video games",
    icon: "gamepad-2",
    note: "A reliable way to think about systems without being responsible for one.",
  },
  {
    name: "Drums",
    icon: "drum",
    note: "Loud, physical, and impossible to do while checking email.",
  },
  {
    name: "Legos",
    icon: "blocks",
    note: "Instructions that always work. A nice change of pace from software.",
  },
];

export const funFact = "Was once ranked 2nd in the state of Florida for bowling.";
