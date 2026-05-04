import {
  MdHome,
  MdPlayCircleOutline,
  MdLibraryMusic,
  MdSearch,
  MdNotificationsNone,
  MdPerson,
} from "react-icons/md";

export const NAV_ITEMS = [
  { path: "/hub", label: "Hub", icon: MdHome },
  { path: "/feed", label: "Feed", icon: MdPlayCircleOutline },
  { path: "/sets", label: "My Sets", icon: MdLibraryMusic, mobileHidden: true },
  { path: "/search", label: "Search", icon: MdSearch },
  { path: "/notifications", label: "Notifications", icon: MdNotificationsNone },
  { path: "/profile", label: "Profile", icon: MdPerson },
];
