import { Property } from "../src/property";
import { Entity } from "../src/entity";
import { AsyncValueResolver } from "../src/entity-serializer";
import { isEntityType } from "../src/type";

export default function AsyncDataLoader(typeName: string, map: { [id: string]: any }): AsyncValueResolver {
	function loadData(ids: string[]): Promise<any[]> {
		return new Promise(resolve => {
			setTimeout(() => {
				const result: any[] = [];
				for (const id of ids) {
					if (id in map)
						result.push(map[id]);
					else
						throw new Error("Could not load object with id '" + id + "'.");
				}
				resolve(result);
			});
		});
	}

	function asyncDataLoader(instance: Entity, property: Property, value: any): Promise<Entity | Entity[]> | void {
		const isList = Array.isArray(value);
		if (value && isEntityType(property.propertyType) && property.propertyType.meta.fullName === typeName) {
			const ids = isList ? value as any[] : [value];
			const loaded: { [id: string]: Entity | any } = {};

			// determine which objects are already in memory
			for (const id of ids) {
				const obj = property.propertyType.meta.get(id);
				if (obj)
					loaded[id] = obj;
			}

			const unloadedIds = ids.filter(id => !loaded[id]);
			let dataLoaded: Promise<any> = Promise.resolve();

			// load data if necessary
			if (unloadedIds.length)
				dataLoaded = loadData(unloadedIds)
					.then(data => data.forEach(data => (loaded[data.Id] = data)))
					.catch(reason => console.warn("Unable to resolve value:", value, reason));

			// return all objects in order based on provided value
			return dataLoaded
				.then(() => ids.map(id => loaded[id]))
				.then(objs => isList ? objs : objs[0]);
		}

		// return null so the framework knows there is no async resolution for this value
		else
			return null;
	}

	return asyncDataLoader;
}
