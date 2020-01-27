# event-reduce


states:
- wasInResult
- wasMatching
- doesMatchNow
- hasSkip
- hasLimit
- wasLimitReached
- wasSortedBeforeFirst
- wasSortedAfterLast
- isSortedBeforeFirst
- isSortedAfterFirst
- sortParamsChanged
- previousStateUnknown
- isDelete
- isInsert
- isUpdate

actions:

- doNothing
- insertFirst
- insertLast
- insertAtSortPosition
- replaceExisting
- removeExisting
- removeExistingAndInsertAtSortPosition
- removeLastItem
- removeFirstItem
- Fallback: runFullQueryAgain
