import {
    Selector
} from 'testcafe';
import { wait, waitUntil } from 'async-test-util';
import { DEFAULT_LOADING_STATE, getImplementations } from '../src/util';

console.log('open page');

const implementations = getImplementations();

const techs: string[] = [];
implementations.forEach(imp => {
    const name = imp.getName();
    imp.getStorageOptions().forEach(option => {
        const tech = name + ':' + option;
        techs.push(tech);
    });
});

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
fixture `A fixture`;

const rootUrl = 'http://0.0.0.0:8888/';
// const rootUrl = 'https://pubkey.github.io/event-reduce/';

for (const tech of techs) {
    test.page(rootUrl + '?tech=' + tech)
        ('run in both modes (' + tech + ')', async t => {

            async function getLoadingState() {
                const loadingState = await Selector('#loading-state').innerText;
                return loadingState;
            }

            await t.click('#test100EventsButton');
            await wait(100);

            await waitUntil(async () => {
                const state = await getLoadingState();
                return state === DEFAULT_LOADING_STATE;
            });

            await t.click('#test100EventsEventReduceButton');
            await wait(100);

            await waitUntil(async () => {
                const state = await getLoadingState();
                return state === DEFAULT_LOADING_STATE;
            });

            // limit buffer comparison, the first example query has a limit
            await t.click('#testLimitBufferButton');
            await wait(100);

            await waitUntil(async () => {
                const state = await getLoadingState();
                return state === DEFAULT_LOADING_STATE;
            });

            const rows = Selector('#limit-buffer-results .limit-buffer-row');
            await t.expect(rows.count).eql(3);
            const identicalCells = Selector('#limit-buffer-results .identical');
            for (let i = 0; i < 3; i++) {
                await t.expect(identicalCells.nth(i).innerText).eql('yes');
            }
        });
}
