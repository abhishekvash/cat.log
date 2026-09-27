export type Deck = "zoomies" | "treatJar";

export type CardEffect =
	| { type: "advance"; to: number }
	| { type: "advanceNearest"; kind: "flap" | "utility" }
	| { type: "back"; spaces: number }
	| { type: "collect"; amount: number }
	| { type: "pay"; amount: number }
	| { type: "collectFromEach"; amount: number }
	| { type: "payEach"; amount: number }
	| { type: "repairs"; perBox: number; perHouse: number }
	| { type: "goToVet" }
	| { type: "getOut" };

export interface Card {
	text: string;
	effect: CardEffect;
}

// Classic Chance.
export const ZOOMIES: Card[] = [
	{
		text: "Sprint all the way to Velvet Paw Park.",
		effect: { type: "advance", to: 39 },
	},
	{
		text: "Dinner bell! Race to the Food Bowl.",
		effect: { type: "advance", to: 0 },
	},
	{
		text: "Chase a moth to Purr Street.",
		effect: { type: "advance", to: 24 },
	},
	{
		text: "Pounce on a leaf all the way to Yarn Market.",
		effect: { type: "advance", to: 11 },
	},
	{
		text: "Bolt through the nearest cat flap. If it's owned, pay double.",
		effect: { type: "advanceNearest", kind: "flap" },
	},
	{
		text: "Bolt through the nearest cat flap. If it's owned, pay double.",
		effect: { type: "advanceNearest", kind: "flap" },
	},
	{
		text: "Dash to the nearest utility. If it's owned, roll and pay ten times the dice.",
		effect: { type: "advanceNearest", kind: "utility" },
	},
	{
		text: "You found a stash of treats. Collect 50 🐟.",
		effect: { type: "collect", amount: 50 },
	},
	{
		text: "Slip out of the Vet for free. Keep this until you need it.",
		effect: { type: "getOut" },
	},
	{
		text: "Startled by a cucumber. Back 3 spaces.",
		effect: { type: "back", spaces: 3 },
	},
	{
		text: "Caught on the counter! Go to the Vet.",
		effect: { type: "goToVet" },
	},
	{
		text: "Scratch repairs: pay 25 🐟 per box and 100 🐟 per cat house.",
		effect: { type: "repairs", perBox: 25, perHouse: 100 },
	},
	{
		text: "You knocked a glass off the table. Pay 15 🐟 for the chaos.",
		effect: { type: "pay", amount: 15 },
	},
	{
		text: "Hop through the North Cat Flap.",
		effect: { type: "advance", to: 5 },
	},
	{
		text: "Elected Top Cat. Pay each player 50 🐟.",
		effect: { type: "payEach", amount: 50 },
	},
	{
		text: "Your hidden fish stash paid off. Collect 150 🐟.",
		effect: { type: "collect", amount: 150 },
	},
];

// Classic Community Chest.
export const TREAT_JAR: Card[] = [
	{
		text: "Breakfast is served. Go to the Food Bowl.",
		effect: { type: "advance", to: 0 },
	},
	{
		text: "The owner dropped a whole tuna. Collect 200 🐟.",
		effect: { type: "collect", amount: 200 },
	},
	{
		text: "Check-up at the Vet. Pay 50 🐟.",
		effect: { type: "pay", amount: 50 },
	},
	{
		text: "You sold a hairball sculpture. Collect 50 🐟.",
		effect: { type: "collect", amount: 50 },
	},
	{
		text: "Slip out of the Vet for free. Keep this until you need it.",
		effect: { type: "getOut" },
	},
	{
		text: "Caught on the counter! Go to the Vet.",
		effect: { type: "goToVet" },
	},
	{
		text: "Holiday leftovers. Collect 100 🐟.",
		effect: { type: "collect", amount: 100 },
	},
	{
		text: "A refund of 20 🐟 from the groomer.",
		effect: { type: "collect", amount: 20 },
	},
	{
		text: "It's your birthday! Collect 10 🐟 from every player.",
		effect: { type: "collectFromEach", amount: 10 },
	},
	{
		text: "Nine lives insurance pays out. Collect 100 🐟.",
		effect: { type: "collect", amount: 100 },
	},
	{
		text: "Emergency vet visit. Pay 100 🐟.",
		effect: { type: "pay", amount: 100 },
	},
	{
		text: "Kitten school fees. Pay 50 🐟.",
		effect: { type: "pay", amount: 50 },
	},
	{
		text: "Paid to nap in an advert. Collect 25 🐟.",
		effect: { type: "collect", amount: 25 },
	},
	{
		text: "Street repairs: pay 40 🐟 per box and 115 🐟 per cat house.",
		effect: { type: "repairs", perBox: 40, perHouse: 115 },
	},
	{
		text: "Second prize in a cuteness contest. Collect 10 🐟.",
		effect: { type: "collect", amount: 10 },
	},
	{
		text: "A rich aunt left you her fish. Collect 100 🐟.",
		effect: { type: "collect", amount: 100 },
	},
];

export const DECKS: Record<Deck, Card[]> = {
	zoomies: ZOOMIES,
	treatJar: TREAT_JAR,
};

export const DECK_NAMES: Record<Deck, string> = {
	zoomies: "Zoomies",
	treatJar: "Treat Jar",
};
