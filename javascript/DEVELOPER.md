# Developer stuff

## npm run test
Run all tests in nodejs


## Going from Scratch to a finished build

We have to perform several steps to create a fully optimized and tested bdd:

### npm run generate-truth-table

Calculate the initial truth table from the defined events and queries.

### npm run iterative-fuzzing

Randomly generate write events and check if their optimized result matches a full query over the database

### optimize bdd

Optimize the binary decision diagramm to get the one which has the best performance
