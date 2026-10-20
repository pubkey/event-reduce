package com.github.pubkey.eventreduce

import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/*

The BDD is shared with the JavaScript implementation as a PackedBdd
of the binary-decision-diagram npm package.

String format:
- The first char is the byte width of the entries: '1', '2' or '4'.
- The rest is the standard base64 of the little-endian entries.

Layout of the entries:
- Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
  - level is the index of the state function in orderedStateList
  - ref0 is followed when the state is false, ref1 when it is true
- The node with the id x starts at index 3 * x, the root node has the id 0.
- With n = entries.size / 3, a reference r < n points to the node with the id r,
  r >= n is a leaf with the action index r - n in orderedActionList.

*/

@OptIn(ExperimentalEncodingApi::class)
public fun packedBddFromBase64String(str: String): IntArray {
    val width = str[0] - '0'
    require(width == 1 || width == 2 || width == 4) { "unknown byte width $width of the packed BDD" }
    val bytes = Base64.decode(str.substring(1))
    return IntArray(bytes.size / width) { i ->
        var value = 0
        for (b in 0 until width) {
            value = value or ((bytes[i * width + b].toInt() and 0xFF) shl (8 * b))
        }
        value
    }
}

/** Decoded lazily on the first access. */
public val packedBdd: IntArray by lazy { packedBddFromBase64String(PACKED_BDD_STRING) }

/** Walks the BDD and returns the index of the action in [orderedActionList]. */
public fun <D> resolveInput(input: StateResolveFunctionInput<D>): Int {
    val bdd = packedBdd
    val n = bdd.size / 3
    var i = 0
    while (true) {
        val ref = bdd[if (resolveStateByIndex(bdd[i], input)) i + 2 else i + 1]
        if (ref >= n) {
            return ref - n
        }
        i = ref * 3
    }
}
