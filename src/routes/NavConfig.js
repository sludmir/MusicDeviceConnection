import {
  MdHome,
  MdPlayCircleOutline,
  MdLibraryMusic,
  MdSearch,
  MdAdd,
  MdNotificationsNone,
  MdPerson,
} from "react-icons/md";

// `mobileHidden`  — not shown in the mobile bottom tab bar
// `desktopHidden` — not shown in the desktop sidebar
// `accent`        — rendered as an emphasized (filled) create action on mobile
//
// Mobile tabs:  Home · Feed · Create(+) · Notifications · Profile
// Desktop tabs: Home · Feed · My Sets · Search · Notifications · Profile
export const NAV_ITEMS = [
  { path: "/hub", label: "Home", icon: MdHome },
  { path: "/feed", label: "Feed", icon: MdPlayCircleOutline },
  { path: "/create", label: "Create", icon: MdAdd, desktopHidden: true, accent: true },
  { path: "/sets", label: "My Sets", icon: MdLibraryMusic, mobileHidden: true },
  { path: "/search", label: "Search", icon: MdSearch, mobileHidden: true },
  { path: "/notifications", label: "Notifications", icon: MdNotificationsNone },
  { path: "/profile", label: "Profile", icon: MdPerson },
];
