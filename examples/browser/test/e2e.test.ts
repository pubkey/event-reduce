import {
    Selector
} from 'testcafe';
import AsyncTestUtil, { wait, waitUntil } from 'async-test-util';
import { DEFAULT_LOADING_STATE, getImplementations } from '../src/util';

console.log('open page');

const implementations = getImplementations();


fixture`Example page`
    .page`http://0.0.0.0:8888/`;


const techs: string[] = [];
implementations.forEach(imp => {
    const name = imp.getName();
    imp.getStorageOptions().forEach(option => {
        const tech = name + ':' + option;
        techs.push(tech);
    });
});

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
        });
}
