import { PropertyChain } from "./property-chain";
import { Model } from "./model";
import { Type } from "./type";

function createModel(options): Promise<Model> {
	return new Promise((resolve) => {
		let model = new Model(options);
		model.ready(() => {
			resolve(model);
		});
	});
}

describe("PropertyChain", () => {
	it("does something", async () => {
		const model = await createModel({
			Person: {
				Name: {
					type: String,
					length: { min: 2, max: 9 }
				},
				"Group": {
					type: "Group"
				},
				GroupName: {
					type: String,
					get: {
					  dependsOn: "Group.Name",
					  function() { return this.Group.Name; }
					}
				},
				GroupId: {
					type: String,
					get: {
					  dependsOn: "Group.Id",
					  function() { return this.Group.Id; }
					}
				},
				GroupCountry: {
					type: String,
					get: {
					  dependsOn: "Group.Country",
					  function() { return this.Group.Country; }
					}
				},
				GroupLanguage: {
					type: String,
					get: {
					  dependsOn: "Group.Language",
					  function() { return this.Group.Language; }
					}
				},
				GroupXYZ: {
					type: String,
					get: {
					  dependsOn: "Group.XYZ",
					  function() { return this.Group.XYZ; }
					}
				},
				GroupABC: {
					type: String,
					get: {
					  dependsOn: "Group.ABC",
					  function() { return this.Group.XYZ; }
					}
				}

			},
			Group: {
				Name: String,
				Id: String,
				Country: String,
				Language: String,
				ABC: String,
				XYZ: String
			}
		});
		const testConnectionSpy = jest.spyOn(PropertyChain.prototype, "testConnection");

		const Person = model.getJsType("Person");
		const chain = (Person.meta as Type).getPath("Group.Name");

		for (let i = 0; i < 1000; i++) {
			const bryan = new Person({ Name: "Bryan" });
		}

		const Group = model.getJsType("Group");
		const group = new Group({ Name: "Patrick's Group", Id: "XDA-1V9-AM3", Country: "US", Language: "English", XYZ: "XYZ", ABC: "SBC" });

		for (let p of (Person.meta as Type).known()) {
			p.Group = group;
		}

		expect(testConnectionSpy).not.toBeCalled();
	});
});
