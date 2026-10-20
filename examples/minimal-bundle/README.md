# event-reduce minimal bundle

A minimal demo that only depends on `event-reduce-js`. It loads the packed BDD and runs a single resolution for one change event. [esbuild](https://esbuild.github.io/) bundles it into one minified file.

```bash
# build the library first (the example links to ../../javascript)
cd ../../javascript && npm install && npm run build && cd -

npm install
npm run build   # -> dist/bundle.min.js
npm start       # build + run the bundle in Node.js
```
