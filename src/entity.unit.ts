/* eslint-disable no-new */
import { Model } from "./model";
import { Entity, EntityConstructorForType } from "./entity";
import "./resource-en";
import { CultureInfo } from "./globalization";
import { updateArray } from "./observable-array";

let Types: { [name: string]: EntityConstructorForType<Entity> };

function resetModel() {
	Types = {};
	CultureInfo.setup();
	return new Model({
		$namespace: Types as any,
		$locale: "en",
		$culture: CultureInfo.CurrentCulture,
		Credits: {
			Movie: "Movie",
			CastSize: {
				type: Number,
				get: {
					dependsOn: "Movie.Cast",
					function() {
						return this.Movie.Cast.length;
					}
				}
			}
		},
		LineItem: {
			Label: String,
			Cost: Number
		},
		Budget: {
			LineItems: "LineItem[]"
		},
		Address: {
			Id: {
				identifier: true,
				type: String
			},
			AnotherEntity: "AnotherEntity",
			City: String,
			State: String
		},
		AnotherEntity: {
			Data: String
		},
		Movie: {
			Id: {
				identifier: true,
				type: String
			},
			Title: String,
			Director: {
				type: "Person",
				format: "[FullName] [Salary]"
			},
			ReleaseDate: Date,
			Genres: "String[]",
			Credits: {
				type: "Credits"
			},
			Cast: "Person[]",
			Budget: "Budget"
		},
		Person: {
			Id: {
				identifier: true,
				type: String
			},
			FirstName: String,
			LastName: String,
			FullName: {
				type: String,
				get() {
					return `${this.FirstName} ${this.LastName}`;
				}
			},
			Species: {
				constant: "Homo sapiens",
				type: String
			},
			Movie: "Movie",
			Address: "Address",
			Salary: {
				default: null,
				type: Number,
				format: "C"
			}
		}
	});
}

const Alien = {
	Cast: [],
	Credits: null,
	Budget: null,
	Director: {
		FirstName: "Ridley",
		Id: null,
		LastName: "Scott",
		Movie: null,
		Salary: null,
		Address: null
	},
	Genres: [
		"science fiction",
		"action"
	],
	Id: null,
	ReleaseDate: null,
	Title: "Alien"
};

describe("Entity", () => {
	let model: Model;
	beforeEach(() => {
		model = resetModel();
	});

	describe("23670 - Entity Async", () => {
		it("initExisting event is published for entity A.B before entity A.B.C is fully initialized", async () => {
			// Entity A => Movie
			// Entity B => Director (which is a Person)
			// Entity C => Address
			// Entity D => Another Entity

			model.serializer.registerValueResolver((instance, prop, value) => {
				if (prop.name === "Director" && value === "1") {
					// Async resolved child entity Director (B)
					// Director has a non-identifying, "owned" entity with data 'Address' (C)
					const directorState = {
						...Alien.Director,
						Id: "1",
						Address: {
							AnotherEntity: { Data: "Some Data" },
							City: "Orlando",
							State: "Florida"
						}
					};

					return new Promise(resolve => setTimeout(() => resolve(directorState), 0));
				}
			});

			let addressCity: string = null;
			let addressState: string = null;

			// Subscribe to initExisting event for Entity B
			Types.Person.meta.initExisting.subscribe(({ entity: person }) => {
				addressCity = person.Address.City;
				addressState = person.Address.State;
			});

			// New Entity A
			await Types.Movie.meta.create({ ...Alien, Director: "1" });

			expect(addressCity).not.toBeNull();
			expect(addressState).not.toBeNull();
		});
	});

	describe("construction", () => {
		it("can be extended and constructed", () => {
			const movie = new Types.Movie();

			expect(movie).toBeInstanceOf(Entity);

			expect(movie).toHaveProperty("Title");
			expect(movie).toHaveProperty("Director");
			expect(movie).toHaveProperty("ReleaseDate");
			expect(movie).toHaveProperty("Genres");
		});

		it("can be constructed with provided state", () => {
			const movie = new Types.Movie(Alien) as any;

			expect(movie.Title).toBe(Alien.Title);
			expect(movie.Director.FirstName).toBe(Alien.Director.FirstName);
			expect(movie.Director.LastName).toBe(Alien.Director.LastName);
			// call slice to get rid of observable overrides
			expect(movie.Genres.slice()).toEqual(Alien.Genres);
		});

		it("can be constructed with prebuilt child entities", () => {
			const state = Object.assign({}, Alien, {
				// Instead of a literal object representing the desired state, pass a Person instance
				Director: new Types.Person(Alien.Director)
			});
			const movie = new Types.Movie(state);

			expect(movie.serialize()).toEqual(Alien);
		});

		it("cannot initialize calculated properties", () => {
			const person = new Types.Person({ FirstName: "John", LastName: "Doe", FullName: "Jane Doe" });
			expect(person.FullName).toBe("John Doe");
		});

		it("cannot initialize constant properties", () => {
			const person = new Types.Person({ Species: "Homo erectus" });
			expect(person.Species).toBe("Homo sapiens");
		});

		it("provides a way to wait for initialization to complete", async () => {
			const Budget1 = { LineItems: [{ Label: "L1", Cost: 1000000 }] };
			model.serializer.registerValueResolver((entity, prop, value) => {
				if (prop.name === "Budget" && value === "BUDGET_1")
					return Promise.resolve(Budget1);
			});
			const movie = new Types.Movie({ ...Alien, Budget: "BUDGET_1" });
			const expected = { ...Alien, Budget: Budget1 };
			expect(movie.serialize()).not.toEqual(expected);
			await movie.initialized;
			expect(movie.serialize()).toEqual(expected);
		});
	});

	describe("update", () => {
		it("can be used to update an entity", () => {
			const movie = new Types.Movie();
			movie.update(Alien);
			expect(movie.serialize()).toEqual(Alien);
		});

		it("cannot be used to set calculated properties", () => {
			const person = new Types.Person({ FirstName: "John", LastName: "Doe" });
			person.update({ FullName: "Full Name" });
			expect(person.FullName).toBe("John Doe");
		});

		it("cannot be used to set constant properties", () => {
			const person = new Types.Person();
			person.update({ Species: "Homo erectus" });
			expect(person.Species).toBe("Homo sapiens");
		});

		it("cannot be used to set a value deserialized to undefined", () => {
			const person = new Types.Person(Alien.Director);
			const movieBeforeSet = person.Movie;
			jest.spyOn(person.serializer, "deserialize").mockImplementation(() => undefined);
			person.update({ Movie: Alien });
			expect(person.Movie).toBe(movieBeforeSet);
		});

		it("cannot be used to set a value deserialized to undefined in a list", () => {
			const movie = new Types.Movie({ Cast: [{ FirstName: "John", LastName: "Doe" }] });
			const movieBeforeSet = movie.Cast;
			jest.spyOn(movie.serializer, "deserialize").mockImplementation(() => undefined);
			movie.update({ Cast: [{ FirstName: "Ridley", LastName: "Scott" }, { FirstName: "John", LastName: "Doe" }] });
			expect(movie.Cast).toBe(movieBeforeSet);
		});

		it("allows waiting for asynchronous values to be set", async () => {
			const Budget1 = { LineItems: [{ Label: "L1", Cost: 1000000 }] };

			model.serializer.registerValueResolver((entity, prop, value) => {
				if (prop.name === "Budget" && value === "BUDGET_1")
					return Promise.resolve(Budget1);
			});

			const movie = new Types.Movie(Alien);

			const updateTask = movie.update({ Title: "Alien 2", Budget: "BUDGET_1" });

			expect(movie.Title).toBe("Alien 2");
			expect(movie.Budget).toBeNull();

			await updateTask;

			expect(movie.Budget.serialize()).toEqual(Budget1);
		});

		it("asynchronous property is initialized before initExisting event published ", async () => {
			const Budget1 = { LineItems: [{ Label: "L1", Cost: 1000000 }] };

			model.serializer.registerValueResolver((entity, prop, value) => {
				if (prop.name === "Budget" && value === "BUDGET_1")
					return Promise.resolve(Budget1);
			});

			Types.Movie.meta.initExisting.subscribe(({ entity: movie }) => {
				expect(movie.Budget.serialize()).toEqual(Budget1);
			});

			await Types.Movie.meta.create({ ...Alien, Id: "1", Budget: "BUDGET_1" });
		});

		it("should support circular async value resolution", async () => {
			const model = new Model({
				Entity: {
					Id: { identifier: true, type: String },
					Name: String,
					Sibling: "Entity"
				}
			});

			const entities = {
				a: {
					Id: "a",
					Name: "Entity A",
					Sibling: "b"
				},
				b: {
					Id: "b",
					Name: "Entity B",
					Sibling: "a"
				}
			};

			const siblingResolver = (instance, prop, value) => {
				if (prop.name === "Sibling")
					return new Promise(resolve => setTimeout(() => resolve(entities[value]), 10));
			};

			model.serializer.registerValueResolver(siblingResolver);

			let entity = await model.types.Entity.create(entities.a);
			await entity.update(entities.a);
			expect((entity as any).Sibling.Sibling).toBe(entity);
		});
	});

	describe("events", () => {
		describe("property change is not raised when initializing existing entity", () => {
			test("value property", async () => {
				const changed = jest.fn();
				Types.Person.meta.getProperty("FirstName").changed.subscribe(changed);
				Types.Person.meta.getProperty("LastName").changed.subscribe(changed);
				await Types.Person.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott" });

				expect(changed).not.toBeCalled();
			});

			test("value list property", async () => {
				const changed = jest.fn();
				Types.Movie.meta.getProperty("Genres").changed.subscribe(changed);
				await Types.Movie.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott" });

				expect(changed).not.toBeCalled();
			});
		});

		describe("property change is raised when initializing new entity", () => {
			test("value property", () => {
				const changed = jest.fn();
				Types.Person.meta.getProperty("FirstName").changed.subscribe(changed);
				Types.Person.meta.getProperty("LastName").changed.subscribe(changed);
				new Types.Person(Alien.Director);

				expect(changed).toBeCalledTimes(2);
			});

			test("value list property", () => {
				const changed = jest.fn();
				Types.Movie.meta.getProperty("Genres").changed.subscribe(changed);
				new Types.Movie(Alien);

				expect(changed).toBeCalled();
			});
		});
	});

	it("can be serialized", () => {
		const movie = new Types.Movie(Alien);

		expect(movie.serialize()).toEqual(Alien);
	});

	describe("default value", () => {
		const _default = {
			Title: "Untitled",
			Director: { FirstName: "John", LastName: "Doe" },
			Genres: [] as string[]
		};

		describe("static", () => {
			beforeAll(() => {
				Types.Person.meta.extend({
					FirstName: { default: _default.Director.FirstName },
					LastName: { default: _default.Director.LastName }
				});

				Types.Movie.meta.extend({
					Title: { default: _default.Title }
				});
			});

			it("does not overwrite provided state of new entity", () => {
				const movie = new Types.Movie(Alien);

				expect(movie.serialize()).toEqual(Alien);
			});

			it("does not overwrite provided state of existing entity", async () => {
				const state = { Id: "1", ...Alien };
				const movie = await Types.Movie.meta.create(state);

				expect(movie.serialize()).toEqual(state);
			});
		});

		describe("rule", () => {
			let calculated = jest.fn();
			beforeEach(() => {
				calculated.mockReset();
			});

			beforeAll(() => {
				Types.Person.meta.extend({
					FirstName: { default: () => _default.Director.FirstName },
					LastName: { default: () => _default.Director.LastName }
				});

				Types.Movie.meta.extend({
					Title: { default: () => _default.Title },
					Director: { default: () => new Types.Person() }
				});
			});

			it("does not overwrite initial state of new entity", () => {
				const movie = new Types.Movie(Alien);

				expect(movie.serialize()).toEqual(Alien);
			});

			it("does not overwrite initial state of existing entity", async () => {
				const state = { Id: "1", ...Alien };
				const movie = await Types.Movie.meta.create(state);

				expect(movie.serialize()).toEqual(state);
			});
		});
	});

	describe("list", () => {
		it("can add/remove primitive items", () => {
			const movie = new Types.Movie(Alien) as any;
			const horror = "horror";

			movie.Genres.push(horror);
			expect(movie.Genres.slice()).toEqual([...Alien.Genres, horror]);

			movie.Genres.pop();
			expect(movie.Genres.slice()).toEqual(Alien.Genres);
		});

		it("can add/remove entity items", () => {
			const movie = new Types.Movie(Alien) as any;
			const sigourney = new Types.Person({ FirstName: "Sigourney", LastName: "Weaver" });
			const john = new Types.Person({ FirstName: "John", LastName: "Hurt" });

			movie.Cast.push(sigourney);
			expect(movie.Cast[0]).toBe(sigourney);

			movie.Cast.push(john);
			expect(movie.Cast[1]).toBe(john);

			movie.Cast.pop();
			expect(movie.Cast.slice()).toEqual([sigourney]);
		});

		it("should not publish property change event for no list changes", () => {
			const movie = new Types.Movie(Alien);
			const changehandler = jest.fn();
			movie.meta.type.getProperty("Cast").changed.subscribe(changehandler);
			movie["Cast"].batchUpdate(() => updateArray(movie["Cast"], []));
			expect(changehandler).not.toBeCalled();
		});

		it("can set an empty list", async () => {
			const model = new Model({
				Skill: {
					Name: String,
					Proficiency: {
						default() { return null; },
						type: Number
					}
				},
				Person: {
					Skills: {
						type: "Skill[]",
						default: () => [{
							Name: "Climbing",
							Proficiency: 4
						},
						{
							Name: "Eating",
							Proficiency: 4
						}]
					}
				}
			});
			const instance = await model.types.Person.create({}) as any;
			expect(instance.Skills.length).toBe(2);
			instance.update({ Skills: [] });
			expect(instance.Skills.length).toBe(0);
		});
	});

	describe("formatting", () => {
		it("supports tokens", () => {
			const movie = new Types.Movie(Alien);
			expect(movie.toString("[Title]")).toBe("Alien");
		});

		it("supports tokens with nested paths", () => {
			const movie = new Types.Movie(Alien);
			expect(movie.toString("[Title] - [Director.FirstName] [Director.LastName]")).toBe("Alien - Ridley Scott");
		});

		it("supports token value post processing", () => {
			const movie = new Types.Movie(Alien);
			expect(movie.toString("[Title] - [Director.FirstName] [Director.LastName]", v => `'${v}'`)).toBe("'Alien' - 'Ridley' 'Scott'");
		});

		it("uses format of properties targeted by tokens", () => {
			const movie = new Types.Movie(Alien);
			movie.Director.Salary = 100000;
			expect(movie.toString("[Director]")).toBe("Ridley Scott $100,000.00");
		});
	});

	describe("markPersisted()", () => {
		it("assigning identifier property of entity calls markPersisted", () => {
			const movie = new Types.Movie(Alien);
			const markPersisted = jest.spyOn(movie, "markPersisted");
			movie.Id = "1";
			expect(markPersisted).toBeCalledTimes(1);
		});

		it("nested entity is not considered new when assigned alongside identifier property", () => {
			const movie = new Types.Movie(Alien);
			movie.Director.update({
				Id: "1",
				Address: { City: "Orlando", State: "Florida" }
			});

			expect(movie.Director.meta.isNew).toBeFalsy();
			expect(movie.Director.Address.meta.isNew).toBeFalsy();
		});

		it("asynchronously resolved nested entity is not considered new when assigned alongside identifier property", async () => {
			model.serializer.registerValueResolver((instance, prop, value) => {
				if (value === "test_async_address")
					return Promise.resolve({ City: "Orlando", State: "Florida" });
			});
			const movie = new Types.Movie(Alien);
			await movie.Director.update({
				Id: "1",
				Address: "test_async_address"
			});

			expect(movie.Director.meta.isNew).toBeFalsy();
			expect(movie.Director.Address.meta.isNew).toBeFalsy();
		});

		it("does not affect non-identifying entity", () => {
			const budget = new Types.Budget();	// Budget type has no identifier property
			budget.markPersisted();
			expect(budget.meta.isNew).toBeTruthy();
		});

		describe("identifying entity", () => {
			let movie: Entity;

			beforeEach(() => {
				movie = new Types.Movie(Alien);	// Movie type has an identifier property
				movie.update({
					Budget: {
						LineItems: [
							{ Label: "Item 1", Cost: 100 }
						]
					}
				});
			});

			describe("with no id", () => {
				it("does nothing", () => {
					movie.markPersisted();
					expect(movie.meta.isNew).toBeTruthy();
				});

				it("does not affect nested entities", () => {
					movie.markPersisted();

					expect(movie.Budget.meta.isNew).toBeTruthy();
					for (const lineItem of movie.Budget.LineItems)
						expect(lineItem.meta.isNew).toBeTruthy();
				});
			});

			describe("with id", () => {
				beforeEach(() => {
					movie.Id = "1";
				});

				it("marks nested, non-identifying entities as not new", () => {
					movie.markPersisted();

					expect(movie.Budget.meta.isNew).toBeFalsy();
					for (const lineItem of movie.Budget.LineItems)
						expect(lineItem.meta.isNew).toBeFalsy();
				});

				it("handles circular references", () => {
					movie.update({ Credits: { Movie: movie } });

					movie.markPersisted();

					expect(movie.Credits.meta.isNew).toBeFalsy();
				});

				it("does not affect nested, sovereign entities", () => {
					movie.markPersisted();
					expect(movie.Director.meta.isNew).toBeTruthy();

					movie.Director.update({ Id: "1" });

					// Assigning the Director's id will mark it as not new
					expect(movie.Director.meta.isNew).toBeFalsy();

					movie.Director.update({ Address: { City: "Orlando", State: "Florida" } });

					movie.markPersisted();

					// But the Director's Address (an "owned" entity) should not be marked persisted as a result of persisting the Movie
					expect(movie.Director.Address.meta.isNew).toBeTruthy();
				});
			});
		});
	});
});
