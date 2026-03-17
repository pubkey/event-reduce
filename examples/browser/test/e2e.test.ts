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

/**
 * Polls browser console messages and prints only ones that
 * have not been printed yet, using index-based deduplication.
 */
async function pollBrowserConsoleMessages(
    t: TestController,
    seenCounts: { log: number; warn: number; error: number; info: number }
) {
    const messages = await t.getBrowserConsoleMessages();

    for (let i = seenCounts.error; i < messages.error.length; i++) {
        console.error('  BROWSER ERROR: ' + messages.error[i]);
    }
    seenCounts.error = messages.error.length;

    for (let i = seenCounts.warn; i < messages.warn.length; i++) {
        console.warn('  BROWSER WARN: ' + messages.warn[i]);
    }
    seenCounts.warn = messages.warn.length;

    for (let i = seenCounts.log; i < messages.log.length; i++) {
        console.log('  BROWSER LOG: ' + messages.log[i]);
    }
    seenCounts.log = messages.log.length;

    for (let i = seenCounts.info; i < messages.info.length; i++) {
        console.log('  BROWSER INFO: ' + messages.info[i]);
    }
    seenCounts.info = messages.info.length;
}

/* tslint:disable-next-line */
fixture `A fixture`;

const rootUrl = 'http://0.0.0.0:8888/';
// const rootUrl = 'https://pubkey.github.io/event-reduce/';

for (const tech of techs) {
    test.page(rootUrl + '?tech=' + tech)
        ('run in both modes (' + tech + ')', async t => {
            const seenCounts = { log: 0, warn: 0, error: 0, info: 0 };

            async function getLoadingState() {
                const loadingState = await Selector('#loading-state').innerText;
                return loadingState;
            }

            await t.click('#test100EventsButton');
            await wait(100);

            await waitUntil(async () => {
                await pollBrowserConsoleMessages(t, seenCounts);
                const state = await getLoadingState();
                return state === DEFAULT_LOADING_STATE;
            });

            await t.click('#test100EventsEventReduceButton');
            await wait(100);

            await waitUntil(async () => {
                await pollBrowserConsoleMessages(t, seenCounts);
                const state = await getLoadingState();
                return state === DEFAULT_LOADING_STATE;
            });

            // Final poll for any remaining messages
            await pollBrowserConsoleMessages(t, seenCounts);
        });
}
