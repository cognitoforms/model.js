import { Model } from "../src/model";
import { ensureChildProperties } from "./utils";
import { IgnorePropertyConverter } from "./ignore-property-converter";
import { InitializeBackReferencesConverter } from "./initialize-back-references-converter";
import AsyncDataLoader from "./async-data-loader";

describe("Async resolver initialization", () => {
	describe("with nested objects", () => {
		let model: Model;
		beforeEach(() => {
			const modelOptions = {
				Root: {
					OuterSection: {
						type: "OuterSection",
						set: function() { return ensureChildProperties(this, "OuterSection"); },
						init() {
							return {};
						}
					},
					State: {
						format: "[State]",
						type: "State"
					}
				},
				OuterSection: {
					InnerSection: {
						type: "InnerSection",
						set: function() { return ensureChildProperties(this, "InnerSection", "Root", "Parent"); },
						init() {
							return {};
						}
					},
					Root: {
						type: "Root"
					}
				},
				InnerSection: {
					Root: {
						type: "Root"
					},
					Parent: {
						type: "OuterSection"
					}
				},
				State: {
					$format: "[State]",
					State: String,
					Id: {
						identifier: true,
						label: "Id",
						type: String
					}
				}
			};

			model = new Model(modelOptions as any);

			model.serializer.registerPropertyConverter(new IgnorePropertyConverter("Root"));
			model.serializer.registerPropertyConverter(new IgnorePropertyConverter("Parent"));
			model.serializer.registerPropertyConverter(new InitializeBackReferencesConverter("Root", "Parent"));
			model.serializer.registerValueResolver(AsyncDataLoader("State", {
				"SC": {
					Id: "SC",
					State: "South Carolina"
				}
			}));
		});

		it("can be established via property initializers", async () => {
			const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
			const instance = await model.types.Root.create({
				"State": "SC",
				"OuterSection": {}
			}) as any;
			expect(consoleWarn).not.toBeCalled();
			expect(instance.OuterSection.InnerSection).not.toBe(null);
			expect(instance.State.State).toBe("South Carolina");
		});
	});
});
