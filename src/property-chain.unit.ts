import { PropertyChain } from "./property-chain";
import { Model, ModelOptions } from "./model";
import { TEntityConstructor } from "./entity";

function createModel(options: ModelOptions): Promise<Model> {
	return new Promise((resolve) => {
		let model = new Model(options);
		model.ready(() => {
			resolve(model);
		});
	});
}

describe("PropertyChain", () => {
	it("Doesn't call PropertyChain.testConnection() when not needed", async () => {
		// To simulate a scenario where calling testConnection would cause a significant performance impact
		// we create a model that has some type (Person).This type has multiple properties (GroupName, GroupId, GroupCountry etc...)
		// that references back to one shared object's (Group) properties

		type Namespace = {
			Person: Person;
			Group: Group;
		};

		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		type Person = {
			Name: string;
			Group: Group;
			GroupName: string;
			GroupId: string;
			GroupCountry: string;
			GroupLanguage: string;
		};

		type Group = {
			Name: string;
			Id: string;
			Country: string;
			Language: string;
		};

		await createModel({
			$namespace: Types as any,
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
					  function(this: Person) { return this.Group.Name; }
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
				}
			},
			Group: {
				Name: String,
				Id: String,
				Country: String,
				Language: String
			}
		});

		// Create multiple Persons (will just sit in memory)
		// The effect is more pronounced when there are a large number of objects in memory.
		for (let i = 0; i < 1000; i++) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const person = new Types.Person({ Name: "Dude Man" });
		}

		// Create new Group
		const group = new Types.Group({
			Name: "Test Group",
			Id: "XDA-1V9-AM3",
			Country: "US",
			Language: "English"
		});

		// Spy on testConnection()
		const testConnectionSpy = jest.spyOn(PropertyChain.prototype, "testConnection");

		// For all known Persons, initially assign their Group to be the group constructed above
		// Before the fix, this assignment would will trigger recalculations for all of the properties
		// on the Person's container object, which would unnecessarily loop over pooled entities to
		// see if they are linked to the changed entity via a null property. This is where the slowdown comes into play.
		// With the fix, we would prevent unnecessarily looping over said entities.
		for (let p of Types.Person.meta.known())
			p.Group = group;

		//	Assure that testConnection() is not called (we are not unnecessarily looping) on initial assignment
		//  Prior to fix, testConnection() would be called 4,000,000 times
		//  4 (number of dependent properties) * 1000 (Persons in memory) * 1000 (iterations)
		expect(testConnectionSpy).not.toBeCalled();
	});
});
