import 'package:event_reduce/event_reduce.dart';

class User {
  final String id;
  final int age;
  const User(this.id, this.age);
}

void main() {
  // SELECT * FROM users WHERE age > 18 ORDER BY age, id LIMIT 10
  final queryParams = QueryParams<User>(
    getDocumentId: (doc) => doc.id,
    limit: 10,
    queryMatcher: (doc) => doc.age > 18,
    // must never return 0 for two different documents,
    // so sort by the primary key last
    sortComparator: (a, b) {
      final byAge = a.age.compareTo(b.age);
      return byAge != 0 ? byAge : a.id.compareTo(b.id);
    },
    // true if one of the sort fields differs between the two versions of a document
    sortFieldsChanged: (previous, doc) => previous.age != doc.age,
  );

  var results = [User('a', 20), User('b', 30)];

  // a change event from the change stream of your database
  const changeEvent = ChangeEvent<User>.insert(id: 'c', doc: User('c', 25));

  final action = calculateActionName(
    StateResolveFunctionInput(
      queryParams: queryParams,
      changeEvent: changeEvent,
      previousResults: results,
    ),
  );

  if (action == ActionName.runFullQueryAgain) {
    // EventReduce could not optimize this event,
    // results = await runQueryOnDatabase();
  } else {
    results = runAction(action, queryParams, changeEvent, results);
  }

  print(results.map((u) => u.id).toList()); // [a, c, b]
}
