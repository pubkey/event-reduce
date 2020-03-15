<br/>

<h1 align="center">Event-Reduce</h1>
<p align="center">
  <strong>An optimisation algorithm to speed up database queries that run multiple times</strong>
</p>

<br/>

* * *

<br/>


<ul>
    <li>You make a query to the database which returns the result in X milliseconds</li>
    <li>A write event happens to the database and changes some data</li>
    <li>To get the new version of the query-results you now have three options:</li>
    <ul>
        <li>Run the query over the database again which takes another X milliseconds</li>
        <li>
            Write complex code that calculates the new result depending on many different states and conditions
        </li>
        <li>
            Use <b>Event-Reduce</b> to calculate the new results without disc-IO <b>nearly instant</b>
        </li>
    </ul>
</ul>

<br/>



<p align="center">
    <img src="./orga/event-reduce.png" width="100%" />
</p>

<br/>

* * *

### Efficiency

### When to use this

### How it works

### Implementations

### When not to use this

### Limitations

- EventReduce only works with queries that have a predictable sort-order for any given documents https://stackoverflow.com/a/11599283

So if you sort by `gender` and `age` and two documents have the same `gender` and `age` the sorting is not predictable. Therefore you could add the primary key as third sort parameter.


### Previous Work




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
- isSortedAfterLast
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
