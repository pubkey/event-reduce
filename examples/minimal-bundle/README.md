# event-reduce minimal bundle

A tiny demo that depends only on `event-reduce-js` and bundles everything into a single minified file with [esbuild](https://esbuild.github.io/).

It runs 2000 random INSERT/UPDATE/DELETE events against an in-memory store, keeps the query results up to date with EventReduce and checks every result against a full query run.

```bash
# build the library first (the example links to ../../javascript)
cd ../../javascript && npm install && npm run build && cd -

npm install
npm run build   # -> dist/bundle.min.js
npm start       # build + run the bundle in Node.js
```

Open `index.html` in a browser to run the same bundle there.
