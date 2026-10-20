import Foundation

// The BDD is shared with the JavaScript implementation as a PackedBdd
// of the binary-decision-diagram npm package.
//
// String format:
// - The first char is the byte width of the entries: '1', '2' or '4'.
// - The rest is the standard base64 of the little-endian entries.
//
// Layout of the entries:
// - Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
//   - level is the index of the state function in orderedStateList
//   - ref0 is followed when the state is false, ref1 when it is true
// - The node with the id x starts at index 3 * x, the root node has the id 0.
// - With n = entries.count / 3, a reference r < n points to the node with the id r,
//   r >= n is a leaf with the action index r - n in orderedActionList.

public func packedBddFromBase64String(_ str: String) -> [Int] {
    guard let width = Int(String(str.prefix(1))), [1, 2, 4].contains(width),
        let data = Data(base64Encoded: String(str.dropFirst()))
    else {
        fatalError("invalid packed BDD string")
    }
    let bytes = [UInt8](data)
    return stride(from: 0, to: bytes.count, by: width).map { start in
        (0..<width).reduce(0) { value, b in value | (Int(bytes[start + b]) << (8 * b)) }
    }
}

/// Decoded lazily on the first access.
public let packedBdd: [Int] = packedBddFromBase64String(packedBddString)

/// Walks the BDD and returns the index of the action in `orderedActionList`.
public func resolveInput<D>(_ input: StateResolveFunctionInput<D>) -> Int {
    let bdd = packedBdd
    let n = bdd.count / 3
    var i = 0
    while true {
        let ref = bdd[resolveStateByIndex(bdd[i], input) ? i + 2 : i + 1]
        if ref >= n {
            return ref - n
        }
        i = ref * 3
    }
}
