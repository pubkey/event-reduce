package dev.rxdb.eventreduce

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

/** Walks the BDD and returns the index of the action in [orderedActionList]. */
public fun <D> resolveInput(input: StateResolveFunctionInput<D>): Int {
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
