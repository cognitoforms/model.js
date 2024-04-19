import { EventScope, EVENT_SCOPE_DEFAULT_SETTINGS } from "./event-scope";
import "./resource-en";
import { CultureInfo } from "./globalization";
import { createModel } from "./model";

describe("EventScope", () => {
	beforeAll(() => CultureInfo.setup());
	it("creates a new scope when 'perform' is called", () => {
		const scope = EventScope.create(EVENT_SCOPE_DEFAULT_SETTINGS);
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
		const scope = EventScope.create(EVENT_SCOPE_DEFAULT_SETTINGS);
		let counter = 0;
		scope.perform(() => {
		    counter++;
		});
		expect(counter).toBe(1);
	});
	it("invokes 'onExit' when the active scope exits", () => {
		const scope = EventScope.create(EVENT_SCOPE_DEFAULT_SETTINGS);
		let counter = 0;
		scope.perform(() => {
			counter++;
			scope.onExit(() => {
				counter++;
			});
		});
		expect(counter).toBe(2);
	});
	it("exits automatically when an error occurs", () => {
		const scope = EventScope.create(EVENT_SCOPE_DEFAULT_SETTINGS);
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
	it("aborts when the maximum scope nesting count is reached", async () => {
		type Context = {
			SearchText: string;
			MatchedUser: UserRef;
			Users: UserRef[];
		};

		type UserRef = {
			Id: string;
			IsArchived: boolean;
			FirstName: string;
			LastName: string;
			FullName: string;
		};

		const model = await createModel<{ Context: Context, UserRef: UserRef }>({
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

		let eventScopeError: Error | null = null;
		model.eventScope.onError.subscribe(e => { eventScopeError = e.error; e.preventDefault(); });

		const context = new model.$namespace.Context();
		const user1 = new model.$namespace.UserRef({ FirstName: "Dave", LastName: "Smith", Id: "abc123", IsArchived: true });
		context.Users!.push(user1);
		const user2 = new model.$namespace.UserRef({ FirstName: "Bob", LastName: "Smith", Id: "abc123", IsArchived: false });
		context.Users.push(user2);
		context.SearchText = "abc123";
		expect(context.MatchedUser).not.toBeNull();
		expect(context.MatchedUser!.FullName).toBe("Dave Smith");
		context.MatchedUser!.FirstName = "Bob";
		expect(context.SearchText).toBe("abc123");
		expect(model.eventScope.current).toBeNull();
		expect(eventScopeError).not.toBeNull();
		expect(eventScopeError!.message).toBe("Exceeded max scope event transfer.");
	});
	it("aborts when the maximum scope depth is reached", async () => {
		const model = await createModel<{
			User: {
				FirstName: string;
				LastName: string;
				AbbreviateName: boolean;
				FullName: string;
			}
		}>({
			$namespace: {},
			$locale: "en",
			"User": {
				"FirstName": {
					type: String,
					required: true
				},
				"LastName": {
					type: String,
					required: true
				},
				"AbbreviateName": {
					type: Boolean,
					get: {
						dependsOn: "{FullName,FirstName,LastName}",
						function(this: any) {
							return this.FullName === `${this.FirstName.substring(0, 1)}. ${this.LastName}` ? true : this.FullName === this.toString("[FirstName] [LastName]") ? false : null;
						}
					}
				},
				"FullName": {
					type: "String",
					get: {
						dependsOn: "{AbbreviateName,FirstName,LastName}",
						function(this: any) {
							// The "Abbreviated" code path will throw an error if FirstName doesn't have a value
							return this.AbbreviateName ? `${this.FirstName.substring(0, 1)}. ${this.LastName}` : this.toString("[FirstName] [LastName]");
						}
					},
					set(this: any) {
						this.AbbreviateName = undefined;
					}
				}
			}
		}, {
			maxEventScopeDepth: 100
		});

		let eventScopeError: Error | null = null;
		model.eventScope.onError.subscribe(e => { eventScopeError = e.error; e.preventDefault(); });

		const user1 = new model.$namespace.User({ FirstName: "Dave", LastName: "Smith" });
		user1.AbbreviateName = true;
		expect(user1.FullName).toBe("D. Smith");
		expect(user1.meta.conditions.length).toBe(0);
		expect(user1.AbbreviateName).toBe(true);
		expect(eventScopeError).not.toBeNull();
		expect(eventScopeError!.message).toBe("Exceeded max scope depth.");
	});
});
