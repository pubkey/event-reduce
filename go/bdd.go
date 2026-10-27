package eventreduce

// The BDD is shared with the JavaScript implementation as a PackedBdd
// of the binary-decision-diagram npm package, bdd_generated.go has its entries.
//
// Layout of the entries:
//   - Every non-leaf node takes three consecutive entries: [level, ref0, ref1].
//     level is the index of the state function in OrderedStateList,
//     ref0 is followed when the state is false, ref1 when it is true.
//   - The node with the id x starts at index 3 * x, the root node has the id 0.
//   - With n = len(entries) / 3, a reference r < n points to the node with the id r,
//     r >= n is a leaf with the action index r - n in OrderedActionList.

// ResolveInput walks the BDD and returns the index of the action in OrderedActionList.
func ResolveInput[D any](input *StateResolveFunctionInput[D]) int {
	bdd := PackedBdd
	n := len(bdd) / 3
	i := 0
	for {
		ref := bdd[i+1]
		if resolveStateByIndex(bdd[i], input) {
			ref = bdd[i+2]
		}
		if ref >= n {
			return ref - n
		}
		i = ref * 3
	}
}
