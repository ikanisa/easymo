import { addDays, formatISO, subDays } from "@/lib/time-utils";
import type { Bar, Station, User } from "@/lib/schemas";
import {
  createBar,
  createStation,
  createUser,
} from "@/lib/test-utils/factories";

const now = new Date();

export const mockUsers: User[] = [
  createUser({
    id: "11111111-1111-1111-1111-111111111111",
    msisdn: "+250780000001",
    displayName: "Fixture User One",
    locale: "rw-RW",
    roles: ["customer"],
    status: "active",
    createdAt: formatISO(subDays(now, 120)),
    lastSeenAt: formatISO(subDays(now, 1)),
  }),
  createUser({
    id: "22222222-2222-2222-2222-222222222222",
    msisdn: "+35699000002",
    displayName: "Fixture User Two",
    locale: "en-MT",
    roles: ["customer", "station_operator"],
    status: "active",
    createdAt: formatISO(subDays(now, 45)),
    lastSeenAt: formatISO(subDays(now, 3)),
  }),
  createUser({
    id: "33333333-3333-3333-3333-333333333333",
    msisdn: "+250780000003",
    displayName: "Fixture User Three",
    locale: "rw-RW",
    roles: ["customer"],
    status: "blocked",
    createdAt: formatISO(subDays(now, 200)),
    lastSeenAt: null,
  }),
];

export const mockBars: Bar[] = [
  createBar({
    id: "bar-1",
    name: "Chez Lando Rooftop",
    slug: "chez-lando-rooftop",
    location: "Remera, Kigali",
    isActive: true,
    receivingNumbers: 3,
    publishedMenuVersion: "v23",
    lastUpdated: formatISO(subDays(now, 1)),
    createdAt: formatISO(subDays(now, 120)),
    momoCode: "*182*8*1*123456#",
    directChatEnabled: true,
  }),
  createBar({
    id: "bar-2",
    name: "Kigali Jazz Lounge",
    slug: "kigali-jazz-lounge",
    location: "CBD, Kigali",
    isActive: true,
    receivingNumbers: 2,
    publishedMenuVersion: "v11",
    lastUpdated: formatISO(subDays(now, 3)),
    createdAt: formatISO(subDays(now, 90)),
    momoCode: "*182*8*1*654321#",
    directChatEnabled: false,
  }),
  createBar({
    id: "bar-3",
    name: "Bugesera Lakeside",
    slug: "bugesera-lakeside",
    location: "Bugesera",
    isActive: false,
    receivingNumbers: 1,
    publishedMenuVersion: null,
    lastUpdated: formatISO(subDays(now, 15)),
    createdAt: formatISO(subDays(now, 160)),
  }),
];

export const mockStations: Station[] = [
  createStation({
    id: "station-1",
    name: "Engen Kigali Downtown",
    engencode: "ENG-001",
    ownerContact: "+250780000010",
    status: "active",
    location: { lat: -1.9441, lng: 30.0619 },
    updatedAt: formatISO(subDays(now, 5)),
  }),
  createStation({
    id: "station-2",
    name: "Engen Remera",
    engencode: "ENG-002",
    ownerContact: "+250780000011",
    status: "active",
    location: { lat: -1.9638, lng: 30.1202 },
    updatedAt: formatISO(subDays(now, 2)),
  }),
  createStation({
    id: "station-3",
    name: "Engen Bugesera",
    engencode: "ENG-005",
    ownerContact: "+250780000012",
    status: "inactive",
    location: null,
    updatedAt: formatISO(subDays(now, 20)),
  }),
];
