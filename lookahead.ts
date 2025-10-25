"use strict";

export type LookAhead<T, TReturn = any, TNext = any> = Iterator<T, TReturn, TNext> & {
	done(): boolean;
	back(item: T): void;
	ahead(idx: number): T | undefined;
	behind(idx: number): T | undefined;
	[Symbol.iterator](): Iterator<T, TReturn, TNext>;
};

export function lookahead<T>(iterable: Iterable<T>, size?: number): LookAhead<T, null, null> {
	if (size === undefined) {
		size = 2;
	}
	if (size < 1) {
		throw new RangeError("Size argument must be greater than 0");
	}

	const behindCache: T[] = new Array(size + 1);
	const aheadCache: T[] = [];

	const iterator = iterable[Symbol.iterator]();
	let done = false;

	return {
		ahead(idx: number) {
			if (idx > size) {
				throw new RangeError(`Cannot look ahead of ${idx} position, currently depth is ${size}`);
			}

			if (idx < 1) {
				throw new RangeError("Look ahead index must be greater than 0");
			}

			while (aheadCache.length <= size) {
				let item = iterator.next();
				if (item.done) break;
				aheadCache.push(item.value);
			}

			if (aheadCache.length === 0) {
				return undefined;
			}

			return aheadCache[idx - 1];
		},

		behind(idx: number) {
			if (idx > size) {
				throw new RangeError(`Cannot look behind of ${idx} position, currently depth is ${size}`);
			}

			if (idx < 1) {
				throw new RangeError("Look behind index must be greater than 0");
			}

			if (behindCache.length === 0) {
				return undefined;
			}

			return behindCache[idx];
		},

		[Symbol.iterator]() {
			return this;
		},

		done() {
			return done;
		},

		next(): IteratorResult<T> {
			let item = iterator.next();

			while (!item.done && aheadCache.length <= size) {
				aheadCache.push(item.value);
				item = iterator.next();
			}

			if (!item.done) {
				aheadCache.push(item.value);
			}

			if (item.done && aheadCache.length === 0) {
				done = true;
				return { done: true, value: undefined };
			}

			const value = aheadCache.shift() as T;
			behindCache.unshift(value);
			behindCache.pop();

			return { done: false, value };
		},

		/// Pushes an item back into the lookahead, undoing the last `next()` call.
		back(item: T): void {
			aheadCache.unshift(item);
			behindCache.shift();
			done = false;
		},
	};
}
