import { computed, shallowReactive, ReactiveFlags } from "vue";
import { Model } from "../src/model";
import { Entity, isEntity } from "../src/entity";

describe("vue 3", () => {
	function customReactive(obj: Entity) {
		if (obj["__proxy__"])
			return obj["__proxy__"];

		const proxy = shallowReactive(obj);

		const customProxy = new Proxy(proxy, {
			get(target, prop: string, receiver) {
				const res = Reflect.get(target, prop, receiver);
				if (isEntity(res))
					customReactive(res);
				return res["__proxy__"] || res;
			},
			set(target, prop: string, value) {
				if (value && !value["__v_raw"] && prop !== "__proxy__" && isEntity(value)) {
					customReactive(value);
				}
				return Reflect.set(target, prop, value);
			}
		});

		obj["__proxy__"] = customProxy;

		return customProxy;
	}

	it("can react to property change", async () => {
		const model = new Model({
			Address: {
				Line1: String,
				State: String,
				Zip: String
			},
			Person: {
				Name: String,
				Address: "Address",
				Test: {
					type: String,
					get: {
						dependsOn: "{Name,Address.Line1}",
						function() {
							return `${this["Name"]} is a good person who lives on ${this["Address"]["Line1"]}.`;
						}
					}
				}
			}
		});

		const jim = await model.types.Person.create({ Name: "Jim", Address: { Line1: "1 Drury Lane" } });

		const vueJim = customReactive(jim);
		const computedName = computed(() => vueJim["Name"]);
		const computedTest = computed(() => vueJim["Test"]);

		expect(computedName.value).toBe("Jim");
		expect(computedTest.value).toBe("Jim is a good person who lives on 1 Drury Lane.");

		// vueJim["Name"] = "Jimmy";
		vueJim["Address"]["Line1"] = "2 Drury Lane";

		// expect(computedName.value).toBe("Jimmy");
		expect(computedTest.value).toBe("Jim is a good person who lives on 2 Drury Lane.");
	});
});