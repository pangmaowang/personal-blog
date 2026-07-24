import type { SocialObjects } from "./types";

export const SITE = {
  website: "https://hibernation.dev/",
  author: "Osito Wang",
  desc: "Word Inspire, Code transforms",
  title: "Hibernation",
  ogImage: "hibernation-og.png",
  lightAndDarkMode: true,
  postPerPage: 5,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/maomao6551675",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/ren-wang-081984111/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
];
