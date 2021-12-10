import { FormatError } from "./format-error";
import { Model } from "./model";
import "./resource-en";

describe("format", () => {
	test("format on type does not cause error when creating model", () => {
		expect(() => new Model({
			$resources: { "en": { "string-format-alphabetic": "zzzzz" } } as any,
			"Form": {
				$format: "[Text]",
				Text: {
					label: "Untitled",
					type: String
				},
				Table: {
					label: "Untitled",
					type: "Form.Table[]"
				}
			},
			"Form.Table": {
				Text: {
					label: "[Text]",
					labelSource: "Form",
					format: {
						reformat: "$&",
						expression: /^([A-Za-z]+)$/,
						message: "string-format-alphabetic",
						description: "Test Format"
					},
					type: String
				},
				Form: {
					label: "Form",
					format: "[Text]",
					type: "Form"
				}
			}
		})).not.toThrow();
	});

	test("Format errors where the label has a token stay updated", async () => {
		let model = new Model({
			Form: {
				Text: {
					label: "Text",
					type: String
				},
				Number: {
					label: "[Text]",
					default: null,
					format: "N0",
					type: Number
				}
			}
		});
		let form = await model.types.Form.create({}) as any;
		form.Text = "label1";
		var val = model.types.Form.jstype.$Number.format.convertBack("test") as FormatError;
		var error = val.createCondition(form, model.types.Form.jstype.$Number);

		expect(error.message).toBe("label1 must be formatted as #,###.");
		form.Text = "label2";
		expect(error.message).toBe("label2 must be formatted as #,###.");
	});

	test("list items are formatted using the list property format", async () => {
		var model = new Model({
			"Form": {
				Table: {
					label: "table",
					type: "Form.Table[]",
					format: "[Text2]",
					default: () => [{
						Text1: "Text1",
						Text2: "Text2"
					},
					{
						Text1: "Text1",
						Text2: "Text2"
					}]
				}
			},
			"Form.Table": {
				Text1: String,
				Text2: String
			}
		});
		let form = await model.types.Form.create({}) as any;
		expect(form.toString("[Table]")).toBe("Text2, Text2");
	});

	test("boolean values are formatted using a two-part boolean property format", async () => {
		var model = new Model({
			"Form": {
				BooleanField: {
					label: "Boolean",
					type: Boolean,
					format: "Yes ;No ",
					default: false
				}
			}
		});
		let form = await model.types.Form.create({}) as any;
		expect(form.toString("[BooleanField]")).toBe("No ");
	});

	test("boolean values can be parsed using the two-part boolean property format", async () => {
		var model = new Model({
			"Form": {
				BooleanField: {
					label: "Boolean",
					type: Boolean,
					format: "Yes ;No ",
					default: false
				}
			}
		});
		let prop = model.types.Form.getProperty("BooleanField");
		expect(prop.format.convertBack("Yes ")).toBe(true);
	});
});
