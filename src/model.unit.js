import { normalize } from "./model";

describe("normalize", () => {
	it("returns the time portion of the given date if the format is 't'", async () => {
		const ts = new Date(1597757877175);
		expect(ts).toEqual(new Date(2020, 7, 18, 9, 37, 57, 175));
		expect(normalize(ts, "t")).toEqual(new Date(1970, 0, 1, 9, 37, 57, 175));
	});

	it("returns the day portion of the given date if the format is 'd'", async () => {
		const ts = new Date(1597757877175);
		expect(ts).toEqual(new Date(2020, 7, 18, 9, 37, 57, 175));
		expect(normalize(ts, "d")).toEqual(new Date(2020, 7, 18));
	});
});
