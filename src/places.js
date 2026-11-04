// Spawn points around downtown Charleston.
// lat/lon are in degrees (WGS84). `look` is a point you face when you arrive.
// Coordinates are approximate street-level positions; nudge them here if a spot
// lands you on a roof or in a wall. Ground height is found automatically.

export const PLACES = [
	{
		id: 'battery',
		name: 'The Battery',
		blurb: 'High Battery seawall, where East Battery meets Murray Boulevard.',
		lat: 32.77030, lon: - 79.92745,
		look: { lat: 32.77350, lon: - 79.92690 },
	},
	{
		id: 'white-point',
		name: 'White Point Garden',
		blurb: 'Live oaks and cannons at the tip of the peninsula.',
		lat: 32.77005, lon: - 79.93000,
		look: { lat: 32.77150, lon: - 79.93100 },
	},
	{
		id: 'rainbow-row',
		name: 'Rainbow Row',
		blurb: 'The pastel Georgian houses of 79–107 East Bay Street.',
		lat: 32.77670, lon: - 79.92770,
		look: { lat: 32.77670, lon: - 79.92715 },
	},
	{
		id: 'waterfront',
		name: 'Waterfront Park',
		blurb: 'The Pineapple Fountain and the Cooper River piers.',
		lat: 32.77860, lon: - 79.92620,
		look: { lat: 32.77860, lon: - 79.92540 },
	},
	{
		id: 'four-corners',
		name: 'Four Corners of Law',
		blurb: 'Broad and Meeting: St. Michael’s, City Hall, the courthouse and the post office.',
		lat: 32.77665, lon: - 79.93110,
		look: { lat: 32.77620, lon: - 79.93060 },
	},
	{
		id: 'city-market',
		name: 'City Market',
		blurb: 'Market Hall on Meeting Street, with the sheds running east.',
		lat: 32.78065, lon: - 79.93180,
		look: { lat: 32.78070, lon: - 79.93000 },
	},
	{
		id: 'king-street',
		name: 'King Street',
		blurb: 'The shopping street, looking north from Wentworth.',
		lat: 32.78230, lon: - 79.93620,
		look: { lat: 32.78500, lon: - 79.93750 },
	},
	{
		id: 'marion-square',
		name: 'Marion Square',
		blurb: 'The city’s central green on Calhoun Street.',
		lat: 32.78620, lon: - 79.93450,
		look: { lat: 32.78700, lon: - 79.93400 },
	},
];

// The scene origin sits here, so local coordinates stay small and precise.
export const ORIGIN = { lat: 32.7760, lon: - 79.9300 };
