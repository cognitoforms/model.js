/* eslint-disable no-new */
import { Model } from "../src/model";
import { ensureChildProperties } from "./utils";
import { IgnorePropertyConverter } from "./ignore-property-converter";
import { InitializeBackReferencesConverter } from "./initialize-back-references-converter";

require("../src/resource-en");

describe("Back-reference properties", () => {
	describe("from a reference property", () => {
		let refPropModel: Model;
		beforeEach(() => {
			refPropModel = new Model({
				Person: {
					Skill: {
						type: "Skill",
						set: function() { return ensureChildProperties(this, "Skill"); },
						init() {
							return refPropModel.types["Skill"].createIfNotExists({ Name: "Skill 1" });
						}
					}
				},
				Skill: {
					Name: String,
					Code: String,
					Root: {
						type: "Person"
					},
					Metadata: {
						type: "SkillMetadata",
						set: function() { return ensureChildProperties(this, "Metadata"); },
						init() {
							return refPropModel.types["SkillMetadata"].createIfNotExists({});
						}
					}
				},
				SkillMetadata: {
					Code: {
						type: String,
						format: {
							description: "AAA-000",
							expression: /^\s*([A-Z]+)-(\d)\s*$/g,
							message: "Code must be formatted as 'AAA-000'.",
							reformat: "$1-$2"
						},
						default: {
							dependsOn: "Parent.Code",
							function: function() { return this.Root ? this.Root.Skill ? this.Root.Skill.Code : null : null; }
						}
					},
					Root: {
						type: "Person"
					},
					Parent: {
						type: "Skill"
					}
				}
			}, {
				maxEventScopeDepth: 100,
				maxExitingEventScopeTransferCount: 500
			});

			refPropModel.serializer.registerPropertyConverter(new IgnorePropertyConverter("Root"));
			refPropModel.serializer.registerPropertyConverter(new IgnorePropertyConverter("Parent"));
			refPropModel.serializer.registerPropertyConverter(new InitializeBackReferencesConverter("Root", "Parent"));
		});

		it("can be established via property initializers", async () => {
			const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
			const instance = await refPropModel.types.Person.create({}) as any;
			expect(consoleWarn).not.toBeCalled();
			expect(instance.Skill.Name).toBe("Skill 1");
		});
	});

	describe("from a reference list property", () => {
		let refListModel: Model;
		beforeEach(() => {
			refListModel = new Model({
				Person: {
					Skills: {
						type: "Skill[]",
						init() {
							return [{ Owner: this, Name: "Skill 1" }, { Owner: this, Name: "Skill 2" }];
						}
					}
				},
				Skill: {
					Name: String,
					Id: {
						type: String,
						default() {
							return this.meta.id;
						}
					},
					Owner: {
						type: "Person"
					},
					ItemNumber: {
						type: Number,
						default: {
							dependsOn: "Owner.Skills",
							function() {
								return this.Owner ? this.Owner.Skills.indexOf(this) + 1 : -1;
							}
						}
					}
				}
			});

			refListModel.serializer.registerPropertyConverter(new IgnorePropertyConverter("Owner"));
		});

		it("can be established via property initializers", async () => {
			const instance = await refListModel.types.Person.create({ Skills: [{ Name: "Skill 3" }, { Name: "Skill 4" }] }) as any;
			expect(instance.serialize().Skills).toMatchObject([{ Id: "+c1", Name: "Skill 3", ItemNumber: 1 }, { Id: "+c2", Name: "Skill 4", ItemNumber: 2 }]);
		});
	});

	describe("with deeply nested objects", () => {
		let deeplyNestedModel: Model;
		beforeEach(() => {
			const modelOptions = {
				Root: {
					SectionA: {
						type: "SectionA",
						set: function() { return ensureChildProperties(this, "SectionA"); },
						init() {
							return deeplyNestedModel.types["SectionA"].createIfNotExists({});
						}
					}
				},
				SectionA: {
					Text: { type: String, required: true },
					Root: {
						type: "Root"
					},
					SectionB: {
						type: "SectionB",
						set: function() { return ensureChildProperties(this, "SectionB"); },
						init() {
							return deeplyNestedModel.types["SectionB"].createIfNotExists({});
						}
					}
				},
				SectionB: {
					Text: { type: String, required: true },
					Root: {
						type: "Root"
					},
					Parent: {
						type: "SectionA"
					},
					SectionC: {
						type: "SectionC",
						set: function() { return ensureChildProperties(this, "SectionC"); },
						init() {
							return deeplyNestedModel.types["SectionC"].createIfNotExists({});
						}
					}
				},
				SectionC: {
					Text: { type: String, required: true },
					Root: {
						type: "Root"
					},
					Parent: {
						type: "SectionB"
					},
					SectionD: {
						type: "SectionD",
						set: function() { return ensureChildProperties(this, "SectionD"); },
						init() {
							return deeplyNestedModel.types["SectionD"].createIfNotExists({});
						}
					}
				},
				SectionD: {
					Text: { type: String, required: true },
					Root: {
						type: "Root"
					},
					Parent: {
						type: "SectionC"
					}
				}
			};

			function addSection(typeName: string, parentTypeName: string) {
				modelOptions[parentTypeName][typeName] = {
					type: typeName,
					set: function() { return ensureChildProperties(this, typeName); },
					init() {
						return deeplyNestedModel.types[typeName].createIfNotExists({});
					}
				};
				modelOptions[typeName] = {
					Text: { type: String, required: true },
					Root: {
						type: "Root"
					},
					Parent: {
						type: parentTypeName
					}
				};
			}

			addSection("SectionD", "SectionC");
			addSection("SectionE", "SectionD");
			addSection("SectionF", "SectionE");
			addSection("SectionG", "SectionF");
			addSection("SectionH", "SectionG");
			addSection("SectionI", "SectionH");
			addSection("SectionJ", "SectionI");
			addSection("SectionK", "SectionJ");
			addSection("SectionL", "SectionK");
			addSection("SectionM", "SectionL");
			addSection("SectionN", "SectionM");
			addSection("SectionO", "SectionN");
			addSection("SectionP", "SectionO");
			addSection("SectionQ", "SectionP");
			addSection("SectionR", "SectionQ");
			addSection("SectionS", "SectionR");
			addSection("SectionT", "SectionS");
			addSection("SectionU", "SectionT");
			addSection("SectionV", "SectionU");
			addSection("SectionW", "SectionV");
			addSection("SectionX", "SectionW");
			addSection("SectionY", "SectionX");
			addSection("SectionZ", "SectionY");

			deeplyNestedModel = new Model(modelOptions);

			deeplyNestedModel.serializer.registerPropertyConverter(new IgnorePropertyConverter("Root"));
			deeplyNestedModel.serializer.registerPropertyConverter(new IgnorePropertyConverter("Parent"));
			deeplyNestedModel.serializer.registerPropertyConverter(new InitializeBackReferencesConverter("Root", "Parent"));
		});

		it("can be established via property initializers", async () => {
			const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
			const instance = await deeplyNestedModel.types.Root.create({}) as any;
			expect(instance.SectionA.Text).toBe(null);
			expect(consoleWarn).not.toBeCalled();
		});
	});
});
