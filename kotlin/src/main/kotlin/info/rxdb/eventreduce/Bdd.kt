package info.rxdb.eventreduce

/*

The BDD is shared with the JavaScript implementation as a PackedBdd
of the binary-decision-diagram npm package, see PACKED_BDD in BddGenerated.kt.

Layout of the entries:
- Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
  - level is the index of the state function in orderedStateList
  - ref0 is followed when the state is false, ref1 when it is true
- The node with the id x starts at index 3 * x, the root node has the id 0.
- With n = entries.size / 3, a reference r < n points to the node with the id r,
  r >= n is a leaf with the action index r - n in orderedActionList.

*/

/** The index of [ActionName.DoNothing] in [orderedActionList]. */
private const val DO_NOTHING_ACTION_INDEX: Int = 0

/**
 * Walks the BDD and returns the index of the action in [orderedActionList].
 *
 * Like in SQL, a query with limit 0 returns no documents: no change event can change
 * its empty results, so the action is always [ActionName.DoNothing].
 * Throws an [EventReduceException] with the code NEG_LIMIT for a negative limit.
 */
public fun <D> resolveInput(input: StateResolveFunctionInput<D>): Int {
    val limit = input.queryParams.limit
    if (limit != null && limit <= 0) {
        if (limit < 0) {
            throw EventReduceException("NEG_LIMIT")
        }
        return DO_NOTHING_ACTION_INDEX
    }
    val n = PACKED_BDD.size / 3
    var i = 0
    while (true) {
        val ref = PACKED_BDD[if (resolveStateByIndex(PACKED_BDD[i], input)) i + 2 else i + 1]
        if (ref >= n) {
            return ref - n
        }
        i = ref * 3
    }
}
