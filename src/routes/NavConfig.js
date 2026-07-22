import {
  MdHome,
  MdPlayCircleOutline,
  MdSearch,
  MdAdd,
  MdNotificationsNone,
  MdPerson,
  MdViewInAr,
  MdMailOutline,
} from "react-icons/md";

// `mobileHidden`  — not shown in the mobile bottom tab bar
// `desktopHidden` — not shown in the desktop sidebar
// `accent`        — rendered as an emphasized (filled) create action on mobile
//
// Mobile tabs:  Home · Feed · Create(+) · Notifications · Profile
// Desktop tabs: Home · Feed · Scene · Search · Notifications · Profile
export const NAV_ITEMS = [
  { path: "/hub", label: "Home", icon: MdHome },
  { path: "/feed", label: "Feed", icon: MdPlayCircleOutline },
  { path: "/create", label: "Create", icon: MdAdd, desktopHidden: true, accent: true },
  { path: "/builder", label: "Scene", icon: MdViewInAr, mobileHidden: true },
  { path: "/search", label: "Search", icon: MdSearch, mobileHidden: true },
  { path: "/messages", label: "Messages", icon: MdMailOutline },
  { path: "/notifications", label: "Notifications", icon: MdNotificationsNone },
  { path: "/profile", label: "Profile", icon: MdPerson },
];
