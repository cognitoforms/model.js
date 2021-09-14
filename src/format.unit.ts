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

	test("Prefixes are not prepended if there is no value and result", async () => {
		var model = new Model({
			"Form": {
				Name: {
					label: "Name",
					format: "[Prefix] [First] [MiddleInitial] [Last] [Suffix]",
					type: "Name"
				}
			},
			"Name": {
				First: {
				  label: "First",
				  type: String
				},
				Last: {
				  label: "Last",
				  type: String
				},
				MiddleInitial: {
				  label: "Middle Initial",
				  type: String
				},
				Prefix: {
				  label: "Prefix",
				  type: String
				},
				Suffix: {
				  label: "Suffix",
				  type: String
				}
			  }
		});
		let form = await model.types.Form.create({ Name: { First: "John", Last: "Doe" } }) as any;
		expect(form.toString("[Name]")).toBe("John Doe");
	});
});