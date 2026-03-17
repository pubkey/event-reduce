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

async function printBrowserConsoleMessages(t: TestController) {
    const messages = await t.getBrowserConsoleMessages();
    if (messages.error.length > 0) {
        console.error('--- Browser console errors ---');
        messages.error.forEach(msg => console.error('  ERROR: ' + msg));
    }
    if (messages.warn.length > 0) {
        console.warn('--- Browser console warnings ---');
        messages.warn.forEach(msg => console.warn('  WARN: ' + msg));
    }
    if (messages.log.length > 0) {
        console.log('--- Browser console logs ---');
        messages.log.forEach(msg => console.log('  LOG: ' + msg));
    }
    if (messages.info.length > 0) {
        console.log('--- Browser console info ---');
        messages.info.forEach(msg => console.log('  INFO: ' + msg));
    }
}

/* tslint:disable-next-line */
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

            await printBrowserConsoleMessages(t);
        });
}
