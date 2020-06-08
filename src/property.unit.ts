/* eslint-disable no-new */
import { Model } from "./model";
import { Entity, EntityConstructorForType } from "./entity";

describe("Property", () => {
	it("can have a constant value", async () => {
		const model = new Model({
			Skill: {
				Name: String,
				Proficiency: Number
			},
			Person: {
				Age: {
					type: "Number[]",
					constant: [50, 100]
				},
				Skills: {
					type: "Skill[]",
					constant: [{
						Name: "Climbing",
						Proficiency: 4
					}]
				}
			}
		});
		// const instance = await model.types.Person.create({});
		const instance = new model.types.Person.jstype();
		expect(instance.serialize()).toEqual({ Skills: [{ Name: "Climbing", Proficiency: 4 }] });
	});
});