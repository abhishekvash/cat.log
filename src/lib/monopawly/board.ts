/** Kept in one place so the game can be renamed with a one-line change. */
export const GAME_NAME = "Monopawly";

export const START_FISH = 1500;
export const FOOD_BOWL_PAY = 200;
export const VET_FEE = 50;
export const BANK_BOXES = 32;
export const BANK_HOUSES = 12;

/** Street groups, cheapest first. Colors are soft pastels that sit on the dark board. */
export const GROUPS = [
	{ id: 1, name: "Alley", color: "#b58a6a" },
	{ id: 2, name: "Terraces", color: "#9fd3ea" },
	{ id: 3, name: "Market", color: "#e79ac8" },
	{ id: 4, name: "Waterfront", color: "#f2b27a" },
	{ id: 5, name: "Sunny side", color: "#ef8f8f" },
	{ id: 6, name: "Mews", color: "#f0d67a" },
	{ id: 7, name: "Heights", color: "#8fd3a4" },
	{ id: 8, name: "Velvet quarter", color: "#9aa6f0" },
] as const;

export type GroupId = (typeof GROUPS)[number]["id"];

export interface StreetSpace {
	kind: "street";
	name: string;
	group: GroupId;
	price: number;
	buildCost: number;
	/** Rent with 0 to 4 boxes, then with a cat house. */
	rent: [number, number, number, number, number, number];
}
export interface FlapSpace {
	kind: "flap";
	name: string;
	price: number;
}
export interface UtilitySpace {
	kind: "utility";
	name: string;
	price: number;
}
export type Space =
	| StreetSpace
	| FlapSpace
	| UtilitySpace
	| { kind: "foodBowl"; name: string }
	| { kind: "tax"; name: string; amount: number }
	| { kind: "zoomies"; name: string }
	| { kind: "treatJar"; name: string }
	| { kind: "vet"; name: string }
	| { kind: "napSpot"; name: string }
	| { kind: "caught"; name: string };

export type OwnableSpace = StreetSpace | FlapSpace | UtilitySpace;

const street = (
	name: string,
	group: GroupId,
	price: number,
	buildCost: number,
	rent: StreetSpace["rent"],
): StreetSpace => ({ kind: "street", name, group, price, buildCost, rent });
const flap = (name: string): FlapSpace => ({ kind: "flap", name, price: 200 });
const zoomies = { kind: "zoomies", name: "Zoomies" } as const;
const treatJar = { kind: "treatJar", name: "Treat Jar" } as const;

// Classic layout, prices and rents, in a cat town.
export const BOARD: Space[] = [
	{ kind: "foodBowl", name: "Food Bowl" },
	street("Bin Lane", 1, 60, 50, [2, 10, 30, 90, 160, 250]),
	treatJar,
	street("Alley Cat Row", 1, 60, 50, [4, 20, 60, 180, 320, 450]),
	{ kind: "tax", name: "Vet Bill", amount: 200 },
	flap("North Cat Flap"),
	street("Whisker Street", 2, 100, 50, [6, 30, 90, 270, 400, 550]),
	zoomies,
	street("Tabby Terrace", 2, 100, 50, [6, 30, 90, 270, 400, 550]),
	street("Mouse Hole Road", 2, 120, 50, [8, 40, 100, 300, 450, 600]),
	{ kind: "vet", name: "The Vet" },
	street("Yarn Market", 3, 140, 100, [10, 50, 150, 450, 625, 750]),
	{ kind: "utility", name: "Laser Pointer Co.", price: 150 },
	street("Scratchpost Lane", 3, 140, 100, [10, 50, 150, 450, 625, 750]),
	street("Catnip Close", 3, 160, 100, [12, 60, 180, 500, 700, 900]),
	flap("East Cat Flap"),
	street("Sardine Square", 4, 180, 100, [14, 70, 200, 550, 750, 950]),
	treatJar,
	street("Tuna Wharf", 4, 180, 100, [14, 70, 200, 550, 750, 950]),
	street("Fishmonger's Quay", 4, 200, 100, [16, 80, 220, 600, 800, 1000]),
	{ kind: "napSpot", name: "Nap Spot" },
	street("Sunbeam Avenue", 5, 220, 150, [18, 90, 250, 700, 875, 1050]),
	zoomies,
	street("Windowsill Way", 5, 220, 150, [18, 90, 250, 700, 875, 1050]),
	street("Purr Street", 5, 240, 150, [20, 100, 300, 750, 925, 1100]),
	flap("South Cat Flap"),
	street("Meow Mews", 6, 260, 150, [22, 110, 330, 800, 975, 1150]),
	street("Calico Crescent", 6, 260, 150, [22, 110, 330, 800, 975, 1150]),
	{ kind: "utility", name: "Catnip Works", price: 150 },
	street("Kitten Park", 6, 280, 150, [24, 120, 360, 850, 1025, 1200]),
	{ kind: "caught", name: "Caught on the counter!" },
	street("Siamese Heights", 7, 300, 200, [26, 130, 390, 900, 1100, 1275]),
	street("Maine Coon Boulevard", 7, 300, 200, [26, 130, 390, 900, 1100, 1275]),
	treatJar,
	street("Ragdoll Gardens", 7, 320, 200, [28, 150, 450, 1000, 1200, 1400]),
	flap("West Cat Flap"),
	zoomies,
	street("Persian Place", 8, 350, 200, [35, 175, 500, 1100, 1300, 1500]),
	{ kind: "tax", name: "Groomer Fee", amount: 100 },
	street("Velvet Paw Park", 8, 400, 200, [50, 200, 600, 1400, 1700, 2000]),
];

export const VET_INDEX = 10;
export const NAP_SPOT_INDEX = 20;

export const isOwnable = (space: Space): space is OwnableSpace =>
	space.kind === "street" || space.kind === "flap" || space.kind === "utility";

export const groupSpaces = (group: GroupId) =>
	BOARD.flatMap((space, index) =>
		space.kind === "street" && space.group === group ? [index] : [],
	);

export const groupColor = (group: GroupId) =>
	GROUPS.find((g) => g.id === group)?.color ?? "#ccc";

export const mortgageValue = (space: OwnableSpace) => space.price / 2;
/** Lifting a mortgage costs the loan plus 10%. */
export const unmortgageCost = (space: OwnableSpace) =>
	Math.ceil((space.price / 2) * 1.1);

export const indexOfKind = (kind: Space["kind"]) =>
	BOARD.flatMap((space, index) => (space.kind === kind ? [index] : []));
