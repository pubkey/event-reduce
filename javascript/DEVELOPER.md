# Developer stuff

## npm run test
Run all tests in nodejs


## Going from Scratch to a finished build

We have to perform several steps to create a fully optimized and tested bdd:

### Generate initial truth table

`npm run generate-truth-table`

Calculate the initial truth table from the defined events and queries.
It takes about 5 minutes and will write the result into `src/truth-table-generator/ouput/`.

### npm run iterative-fuzzing

Randomly generate write events and check if their optimized result matches a full query over the database.
If not, it adapts the truth table to ensure that the errored query now works.

Run this until it no longer logs that it has found errors. I had let this run about one month.

To let it run on a server, use this command so you can exit the terminal and it still runs:
`nohup npm run iterative-fuzzing &> iterative-fuzzing.out &`

### optimize bdd

`npm run optimize-bdd`

Optimize the binary decision diagramm to get the one which has the best performance.
It uses `optimizeOrdering()` of the [binary-decision-diagram](https://github.com/pubkey/binary-decision-diagram) library
to deterministically find the order of the state functions with the lowest expected cpu time per resolve.
The measured runtime of each state function is used as its cost and state sets that occur often in the example queries are weighted higher.
It takes a few seconds and often proves that no better order exists.
If the found bdd is better than the current one, it is written to the generated files.
