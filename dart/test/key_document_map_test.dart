// When the key document map is out of sync and does not have a document that is in the results,
// the actions must still find the document in the results, like the JavaScript implementation.

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

class Doc {
  final String id;
  final int age;
  Doc(this.id, this.age);
}

final queryParams = QueryParams<Doc>(
  getDocumentId: (doc) => doc.id,
  queryMatcher: (doc) => true,
  sortComparator:
      (a, b) => a.age != b.age ? a.age - b.age : a.id.compareTo(b.id),
  sortFieldsChanged: (previous, doc) => previous.age != doc.age,
);

void main() {
  final a = Doc('a', 1);
  final b = Doc('b', 2);
  late List<Doc> results;
  late Map<String, Doc> keyDocumentMap;

  setUp(() {
    results = [a, b];
    keyDocumentMap = {'b': b};
  });

  test('removeExisting', () {
    runAction(
      ActionName.removeExisting,
      queryParams,
      ChangeEvent.delete(id: 'a', previous: a),
      results,
      keyDocumentMap,
    );
    expect(results, [b]);
    expect(keyDocumentMap, {'b': b});
  });

  test('replaceExisting', () {
    final changed = Doc('a', 1);
    runAction(
      ActionName.replaceExisting,
      queryParams,
      ChangeEvent.update(id: 'a', doc: changed, previous: a),
      results,
      keyDocumentMap,
    );
    expect(results, [changed, b]);
    expect(keyDocumentMap, {'a': changed, 'b': b});
  });

  test('removeExistingAndInsertAtSortPosition', () {
    final moved = Doc('a', 5);
    runAction(
      ActionName.removeExistingAndInsertAtSortPosition,
      queryParams,
      ChangeEvent.update(id: 'a', doc: moved, previous: a),
      results,
      keyDocumentMap,
    );
    // no duplicate of the document
    expect(results, [b, moved]);
    expect(keyDocumentMap, {'a': moved, 'b': b});
  });
}
