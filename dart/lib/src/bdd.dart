import 'dart:convert';
import 'bdd_generated.dart';
import 'states.dart';
import 'types.dart';

export 'bdd_generated.dart' show packedBddString;

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
- With n = entries.length / 3, a reference r < n points to the node with the id r,
  r >= n is a leaf with the action index r - n in orderedActionList.

*/

List<int> packedBddFromBase64String(String str) {
  final width = str.codeUnitAt(0) - 48;
  final bytes = base64Decode(str.substring(1));
  switch (width) {
    case 1:
      return bytes;
    case 2:
      return bytes.buffer.asUint16List(bytes.offsetInBytes, bytes.length ~/ 2);
    case 4:
      return bytes.buffer.asUint32List(bytes.offsetInBytes, bytes.length ~/ 4);
  }
  throw ArgumentError('unknown byte width $width of the packed BDD');
}

/// Decoded lazily on the first access.
final List<int> packedBdd = packedBddFromBase64String(packedBddString);

/// Walks the BDD and returns the index of the action in orderedActionList.
int resolveInput<D>(StateResolveFunctionInput<D> input) {
  final bdd = packedBdd;
  final n = bdd.length ~/ 3;
  var i = 0;
  while (true) {
    final ref = bdd[resolveStateByIndex(bdd[i], input) ? i + 2 : i + 1];
    if (ref >= n) {
      return ref - n;
    }
    i = ref * 3;
  }
}
