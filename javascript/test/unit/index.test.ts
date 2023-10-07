console.log('### starting unit-tests ###');
import './minimongo.test.js';
import './actions.test.js';
import './states.test.js';
import './binary-state.test.js';
import './queries.test.js';
import './fuzzing.test.js';
import './calculate-bdd-quality.test.js';
import './truth-table-generator.test.js';

// should be last
import './generated-stuff.test.js';
