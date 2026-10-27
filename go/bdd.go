package eventreduce

import (
	"encoding/base64"
	"fmt"
)

// The BDD is shared with the JavaScript implementation as a PackedBdd
// of the binary-decision-diagram npm package.
//
// String format:
//   - The first char is the byte width of the entries: '1', '2' or '4'.
//   - The rest is the standard base64 of the little-endian entries.
//
// Layout of the entries:
//   - Every non-leaf node takes three consecutive entries: [level, ref0, ref1].
//     level is the index of the state function in OrderedStateList,
//     ref0 is followed when the state is false, ref1 when it is true.
//   - The node with the id x starts at index 3 * x, the root node has the id 0.
//   - With n = len(entries) / 3, a reference r < n points to the node with the id r,
//     r >= n is a leaf with the action index r - n in OrderedActionList.

// PackedBdd has the decoded entries of PackedBddString.
var PackedBdd = mustDecodePackedBdd(PackedBddString)

// PackedBddFromBase64String decodes a packed BDD string.
func PackedBddFromBase64String(packed string) ([]int, error) {
	width := int(packed[0] - '0')
	if width != 1 && width != 2 && width != 4 {
		return nil, fmt.Errorf("unknown byte width %d of the packed BDD", width)
	}
	bytes, err := base64.StdEncoding.DecodeString(packed[1:])
	if err != nil {
		return nil, err
	}
	entries := make([]int, len(bytes)/width)
	for i := range entries {
		value := 0
		for b := 0; b < width; b++ {
			value |= int(bytes[i*width+b]) << (8 * b)
		}
		entries[i] = value
	}
	return entries, nil
}

func mustDecodePackedBdd(packed string) []int {
	entries, err := PackedBddFromBase64String(packed)
	if err != nil {
		panic(err)
	}
	return entries
}

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
