// The BDD is shared with the JavaScript implementation as a PackedBdd
// of the binary-decision-diagram npm package, see `packedBdd` in BddGenerated.swift.
//
// Layout of the entries:
// - Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
//   - level is the index of the state function in orderedStateList
//   - ref0 is followed when the state is false, ref1 when it is true
// - The node with the id x starts at index 3 * x, the root node has the id 0.
// - With n = entries.count / 3, a reference r < n points to the node with the id r,
//   r >= n is a leaf with the action index r - n in orderedActionList.

/// The index of `ActionName.doNothing` in `orderedActionList`.
private let doNothingActionIndex = 0

/// Walks the BDD and returns the index of the action in `orderedActionList`.
///
/// Like in SQL, a query with limit 0 returns no documents: no change event can change
/// its empty results, so the action is always `.doNothing`.
/// A negative limit is a programming error and stops with a precondition failure
/// (`createResultWindowBuffer()` throws `EventReduceError.negativeLimit` for it).
public func resolveInput<D>(_ input: StateResolveFunctionInput<D>) -> Int {
    if let limit = input.queryParams.limit, limit <= 0 {
        precondition(limit == 0, "EventReduce:NEG_LIMIT")
        return doNothingActionIndex
    }
    let n = packedBdd.count / 3
    var i = 0
    while true {
        let ref = packedBdd[resolveStateByIndex(packedBdd[i], input) ? i + 2 : i + 1]
        if ref >= n {
            return ref - n
        }
        i = ref * 3
    }
}
