import type { ReactNode } from "react";

type IconName =
  | "home" | "compass" | "list-music" | "users" | "search" | "plus" | "chevron-right"
  | "chevron-left" | "arrow-up-right" | "more-horizontal" | "music" | "disc" | "clock"
  | "check" | "copy" | "external" | "x" | "arrow-up" | "arrow-down" | "trash"
  | "play" | "pause" | "settings" | "user" | "logout" | "refresh" | "link" | "radio"
  | "history" | "sparkles" | "headphones" | "menu" | "share" | "edit" | "lock" | "eye"
  | "send" | "alert" | "info" | "more";

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z"/></>,
  "list-music": <><path d="M4 6h12M4 11h12M4 16h7"/><path d="M16 16V5l5-1v11"/><circle cx="14" cy="18" r="2"/><circle cx="19" cy="16" r="2"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  "chevron-right": <path d="m9 18 6-6-6-6"/>,
  "chevron-left": <path d="m15 18-6-6 6-6"/>,
  "arrow-up-right": <><path d="M7 17 17 7M7 7h10v10"/></>,
  "more-horizontal": <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  music: <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
  disc: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v2M21 12h-2M12 21v-2M3 12h2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></>,
  x: <><path d="m6 6 12 12M18 6 6 18"/></>,
  "arrow-up": <><path d="m6 14 6-6 6 6"/></>,
  "arrow-down": <><path d="m6 10 6 6 6-6"/></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"/></>,
  play: <path d="m8 5 12 7-12 7V5Z"/>,
  pause: <><path d="M8 5v14M16 5v14"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1 1.9-1.8 1.8-1.9-1.1-.1-.1a7.9 7.9 0 0 1-2 .8l-.1.1-.3 2.2h-2.6l-.3-2.2-.1-.1a7.9 7.9 0 0 1-2-.8l-.1.1-1.9 1.1-1.8-1.8 1.1-1.9.1-.1a7.9 7.9 0 0 1-.8-2l-.1-.1L3 12.6V10l2.2-.3.1-.1a7.9 7.9 0 0 1 .8-2L6 7.5 4.9 5.6l1.8-1.8 1.9 1.1.1.1a7.9 7.9 0 0 1 2-.8l.1-.1.3-2.2h2.6l.3 2.2.1.1a7.9 7.9 0 0 1 2 .8l.1-.1 1.9-1.1 1.8 1.8-1.1 1.9-.1.1a7.9 7.9 0 0 1 .8 2l.1.1 2.2.3v2.6l-2.2.3-.1.1a7.9 7.9 0 0 1-.8 2Z"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.7-2L20 12M4 12l2.8 5a7 7 0 0 0 11.7-2"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7"/></>,
  radio: <><path d="M3 11a9 9 0 0 1 18 0M6 14a6 6 0 0 1 12 0M10 17a2 2 0 0 1 4 0"/><path d="M12 19v2"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  sparkles: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
  headphones: <><path d="M3 13v-1a9 9 0 0 1 18 0v1"/><path d="M3 13h4v7H5a2 2 0 0 1-2-2v-5ZM21 13h-4v7h2a2 2 0 0 0 2-2v-5Z"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></>,
  edit: <><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></>,
  alert: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>
};

export function Icon({ name, size = 18, strokeWidth = 1.8, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
