import { EventDispatcher, IEvent } from "ste-events";

export class ObservableList<OwnerType, ListType> extends Array<ListType> {

	private readonly owner: OwnerType;

	private readonly changedEvent: EventDispatcher<OwnerType, { added: ListType[], removed: ListType[] }>;

	/**
	 * Creates a new model list with the specified owner.
	 * @param owner
	 */
	constructor(owner: OwnerType, items: ListType[] = null) {
		super(...items);
		this.owner = owner;
	}

	/**
	 * Override push to raise the list changed event.
	 * @param items The item or items to add
	 */
	push(...items: ListType[]): number {
		let result = super.push.call(items);
		this.changedEvent.dispatch(this.owner, { added: items, removed: [] });
		return result;
	}

	/** Override pop to raise the list changed event. */
	pop(): ListType {
		let result = super.pop();
		this.changedEvent.dispatch(this.owner, { added: [], removed: [result] });
		return result;
	}

	/**
	 * Override unshift to raise the list changed event.
	 * @param items The item or items to add
	 */
	unshift(...items: ListType[]): number {
		let result = super.unshift.call(items);
		this.changedEvent.dispatch(this.owner, { added: items, removed: [] });
		return result;
	}

	/**
	 * Override splice to raise the list changed event.
	 * @param items The item or items to add
	 */
	splice(start: number, deleteCount: number, ...itemsToAdd: ListType[]): ListType[] {
		let removed = super.splice.call(start, deleteCount, itemsToAdd);
		this.changedEvent.dispatch(this.owner, { added: itemsToAdd, removed: removed });
		return removed;
	}

	/** Override shift to raise the list changed event. */
	shift(): ListType {
		let result = super.shift();
		this.changedEvent.dispatch(this.owner, { added: [], removed: [result] });
		return result;
	}

	/** Override sort to raise the list changed event. */
	sort(): this {
		super.sort();
		this.changedEvent.dispatch(this.owner, { added: [], removed: [] });
		return this;
	}

	/** Override reverse to raise the list changed event. */
	reverse(): ListType[] {
		let result = super.reverse();
		this.changedEvent.dispatch(this.owner, { added: [], removed: [] });
		return result;
	}

	/**
	 * Removes the specified item from the list.
	 * @param item The item to remove.
	 * @returns True if removed, otherwise false.
	 */
	remove(item: ListType): boolean {
		let index = this.indexOf(item);
		if (index > -1)
			this.splice(index, 1);
		return index > -1;
	}

	/** Expose the changed event */
	get changed(): IEvent<OwnerType, { added: ListType[], removed: ListType[] }> {
		return this.changedEvent.asEvent();
	}

}
