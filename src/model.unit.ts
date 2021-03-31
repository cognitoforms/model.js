import { Model, normalize, ModelConfiguration } from "./model";

describe("normalize", () => {
	it("returns the time portion of the given date if the format is 't'", async () => {
		const ts = new Date(1597757877175);
		expect(ts).toEqual(new Date(Date.UTC(2020, 7, 18, 13, 37, 57, 175)));
		expect(normalize(ts, "t")).toEqual(new Date(1970, 0, 1, 9, 37, 57, 175));
	});

	it("returns the day portion of the given date if the format is 'd'", async () => {
		const ts = new Date(1597757877175);
		expect(ts).toEqual(new Date(Date.UTC(2020, 7, 18, 13, 37, 57, 175)));
		expect(normalize(ts, "d")).toEqual(new Date(2020, 7, 18));
	});
});

describe("settings", () => {
	describe("autogeneratePropertyLabels", () => {
		function createModel(config: ModelConfiguration = {}) {
			return new Model({
				Type: {
					PropertyOne: String
				}
			}, config);
		}

		it("is enabled by default", () => {
			const model = createModel();
			expect(model.settings.autogeneratePropertyLabels).toBe(true);
		});

		it("enabled: causes property labels to be generated", () => {
			const model = createModel({ autogeneratePropertyLabels: true });

			const property = model.types["Type"].properties[0];
			expect(property.label).toBe("Property One");
		});

		it("disabled: does not cause property labels to be generated", () => {
			const model = createModel({ autogeneratePropertyLabels: false });

			const property = model.types["Type"].properties[0];
			expect(property.label).toBeUndefined();
		});
	});
});
