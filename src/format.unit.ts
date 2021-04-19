import { Model } from "./model";
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
});