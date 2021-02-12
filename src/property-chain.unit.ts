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

/*
    Context
    Description from Bug 18635:
    https://cognitoforms.visualstudio.com/Cognito%20Forms/_workitems/edit/18635

    "A customer on Zendesk had noticed considerable delay before their public form can be interacted with on load. We have noticed anywhere from a ~4s-10s delay when reproducing. The form has a lookup field that references a form with > 7000 entries. This, in and of itself, shouldn't be a big issue. But the field also has 9 cascading filters. We believe this combination is the main contributing factor of the slowdown.

    It appears the bulk of the time is spent looping through lookup entry index instances when initializing lookups. I think this can be optimized in the framework to eliminate this unnecessary work, which would reduce the delay considerable, if not altogether. This would have to be reproduced and the fix tested to prove that it would actually address the problem. Also, the same issue affects Vue forms, so it should at least be fixed there."

    The fix for this is a slight optimization for changes to the first property in a property chain. In the fix, we won't unnecessarily loop over pooled entities to see if they are linked to the changed entity via a null property, because testConnection() would only return true if they are the same entity.
*/

describe("PropertyChain", () => {
	it("Doesn't call PropertyChain.testConnection() when not needed", async () => {
		// To simulate the lookup scenario from the bug above, we create a model that has some type (Person).
		// This type has multiple properties (GroupName, GroupId, GroupCountry etc...) that references back to one shared object's (Group) properties
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
				}
			},
			Group: {
				Name: String,
				Id: String,
				Country: String,
				Language: String
			}
		});

		const Person = model.getJsType("Person");

		// Create multiple Persons (will just sit in memory)
		for (let i = 0; i < 1000; i++) {
			const person = new Person({ Name: "Dude Man" });
		}

		// Create new Group
		const Group = model.getJsType("Group");
		const group = new Group({
			Name: "Test Group",
			Id: "XDA-1V9-AM3",
			Country: "US",
			Language: "English"
		});

		// Spy on testConnection()
		const testConnectionSpy = jest.spyOn(PropertyChain.prototype, "testConnection");

		/*
            For all known Persons, initially assign their Group to be the group constructed above

            Before the fix, this assignment would will trigger recalculations for all of the properties on the Person's container object, which would unnecessarily loop over pooled entities to see if they are linked to the changed entity via a null property. This is where the slowdown comes into play.

            With the fix, we would prevent unnecessarily looping over said entities.
        */
		for (let p of (Person.meta as Type).known())
			p.Group = group;

		//	Assure that testConnection() is not called (we are not unnecessarily looping) on initial assignment
		expect(testConnectionSpy).not.toBeCalled();

		/*
            Prior to fix, testConnection() would be called 4,000,000 times
		    4 (number of dependent properties) * 1000 (Persons in memory) * 1000 (iterations)
        */
	});
});
