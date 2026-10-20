import 'package:event_reduce/event_reduce.dart';

class Human {
  final String id;
  final String name;
  final int age;

  const Human(this.id, this.age, [String? name]) : name = name ?? 'name-$id';

  Human copyWith({int? age, String? name}) =>
      Human(id, age ?? this.age, name ?? this.name);

  @override
  bool operator ==(Object other) =>
      other is Human &&
      other.id == id &&
      other.name == name &&
      other.age == age;

  @override
  int get hashCode => Object.hash(id, name, age);

  @override
  String toString() => 'Human($id, $age, $name)';
}

/// SELECT * FROM humans WHERE age > minAge ORDER BY age, id
QueryParams<Human> queryParams(int minAge, {int? skip, int? limit}) =>
    QueryParams<Human>(
      getDocumentId: (doc) => doc.id,
      skip: skip,
      limit: limit,
      queryMatcher: (doc) => doc.age > minAge,
      sortComparator: (a, b) {
        final byAge = a.age.compareTo(b.age);
        return byAge != 0 ? byAge : a.id.compareTo(b.id);
      },
      sortFieldsChanged: (prev, doc) => prev.age != doc.age,
    );

ChangeEvent<Human> insert(Human doc) =>
    ChangeEvent.insert(id: doc.id, doc: doc);

ChangeEvent<Human> update(Human previous, Human doc) =>
    ChangeEvent.update(id: doc.id, doc: doc, previous: previous);

ChangeEvent<Human> delete(Human previous) =>
    ChangeEvent.delete(id: previous.id, previous: previous);

Map<String, Human> toMap(List<Human> docs) => {for (final d in docs) d.id: d};

List<String> ids(List<Human> docs) => docs.map((d) => d.id).toList();
