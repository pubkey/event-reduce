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
Because there are 2^13 permutations or the bdd order, we just generate a random order and test it.
As soon as we find a better bdd, it is written to the generated files.
Run this until it no longer finds a better bdd. I had let this run about one week.

To let it run on a server, use this command so you can exit the terminal and it still runs:
`nohup npm run optimize-bdd &> optimize-bdd.out &`
