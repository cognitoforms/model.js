import { EventScope } from "./event-scope";
import "./resource-en";
import { CultureInfo } from "./globalization";
import { Model } from "./model";

describe("EventScope", () => {
	it("creates a new scope when 'perform' is called", () => {
		const scope = EventScope.create();
		let counter = 0;
		expect(scope.current).toBeNull();
		scope.perform(() => {
			expect(scope.current).not.toBeNull();
		    counter++;
		});
		expect(counter).toBe(1);
		expect(scope.current).toBeNull();
	});
	it("invokes the callback immediately if a scope was not already active", () => {
		const scope = EventScope.create();
		let counter = 0;
		scope.perform(() => {
			expect(counter).toBe(0);
		    counter++;
		});
		expect(counter).toBe(1);
		counter++;
	});
	it("invokes 'onComplete' when the active scope exits", () => {
		const scope = EventScope.create();
		let counter = 0;
		scope.perform(() => {
			expect(counter).toBe(0);
			counter++;
			scope.onExit(() => {
				expect(counter).toBe(1);
			});
		});
		expect(counter).toBe(1);
		counter++;
	});
	it("exits automatically when an error occurs", () => {
		const scope = EventScope.create();
		let counter = 0;
		expect(scope.current).toBeNull();
		try {
			scope.perform(() => {
			counter++;
			throw new Error("Fail!");
		});
		}
		catch (e) {
			// Do nothing
		}
		expect(counter).toBe(1);
		expect(scope.current).toBeNull();
	});
	it("aborts when the maximum scope nesting count is reached", () => {
		CultureInfo.setup();
		const model = new Model({
			$namespace: {},
			$locale: "en",
			"Context": {
				"SearchText": {
					type: String,
					default: {
						dependsOn: "MatchedUser{IsArchived,FullName,Id}",
						function(this: any) {
							if (this.MatchedUser) {
								if (this.MatchedUser.IsArchived) {
									return this.MatchedUser.toString("[FullName]");
								}
								else {
									return this.MatchedUser.toString("[Id]");
								}
							}
						}
					}
				},
				"MatchedUser": {
					type: "UserRef",
					get: {
						dependsOn: "SearchText",
						function(this: any) {
							if (this.SearchText) {
								const usersById = this.Users.filter(u => u.Id === this.SearchText);
								if (usersById.length) {
									return usersById[0];
								}

								const usersByName = this.Users.filter(u => !u.IsArchived && u.FullName.indexOf(this.SearchText) >= 0);
								if (usersByName.length) {
									return usersByName[0];
								}
							}
						}
					},
					set(this: any) {
						if (this.MatchedUser) {
							this.MatchedUser.FirstName += "*";
							if (this.MatchedUser.IsArchived) {
								this.SearchText = this.MatchedUser.toString("[FullName]");
							}
							else {
								this.SearchText = this.MatchedUser.toString("[Id]");
							}
						}
					}
				},
				"Users": {
					type: "UserRef[]"
				}
			},
			"UserRef": {
				$format: "[FullName]",
				"Id": String,
				"IsArchived": Boolean,
				"FirstName": String,
				"LastName": String,
				"FullName": {
					type: "String",
					get: {
						dependsOn: "{FirstName,LastName}",
						function() {
							return this.toString("[FirstName] [LastName]");
						}
					}
				}
			}
		});

		const context = new model.$namespace.Context();
		const user1 = new model.$namespace.UserRef({ FirstName: "Dave", LastName: "Smith", Id: "abc123", IsArchived: true });
		context.Users.push(user1);
		const user2 = new model.$namespace.UserRef({ FirstName: "Bob", LastName: "Smith", Id: "abc123", IsArchived: false });
		context.Users.push(user2);
		context.SearchText = "abc123";
		expect(context.MatchedUser).not.toBeNull();
		expect(context.MatchedUser.FullName).toBe("Dave Smith");
		context.MatchedUser.FirstName = "Bob";
		const maxNesting = 100 - 1;
		const expectedCalculationCount = Math.floor(maxNesting / 4); // Each cycle appears to create 4 scopes, so it can calculate no more than maxNesting/4 times
		expect(context.SearchText).toBe("Bob" + Array.from(new Array(expectedCalculationCount)).map(() => "*").join("") + " Smith");
		expect(model.eventScope.current).toBeNull();
	});
});
