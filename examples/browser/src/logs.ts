
export function formatMilliseconds(value: any) {
    return Math.ceil(value) + ' ms';
}

export const logKeyExplanation: {
    [k: string]: {
        title: string;
        description: string;
        format: (value: any) => string
    }
} = {
    totalTimeInMs: {
        title: 'Total Time',
        description: 'The total amount of time that was spend saving the events ' +
            'and calculating the new results',
        format: formatMilliseconds
    },
    totalWriteTime: {
        title: 'Time spend Writing',
        description: 'The amount of time that was spend writing the changes to the database',
        format: formatMilliseconds
    },
    queryTime: {
        title: 'Query Time',
        description: 'The amount of time spend waiting for queries to be processed ' +
            'by the database',
        format: formatMilliseconds
    },
    optimizedEventsCount: {
        title: 'Optimized Events',
        description: 'Percent of events that have been optimized by EventReduce ' +
            'and so did not require a query over the database to get the new results',
        format: (i: any) => i + ' %'

    }
};


export function appendToLog(title: string, data?: any) {
    const logPlaceholder = document.getElementById('logs-placeholder');
    if (logPlaceholder) {
        logPlaceholder.remove();
    }

    const logDiv = document.getElementById('log') as any;
    const newLog = document.createElement('div');
    newLog.classList.add('single-log');

    const titleDiv = document.createElement('h4');
    titleDiv.innerHTML = title;
    newLog.appendChild(titleDiv);

    const dateDiv = document.createElement('h5');
    dateDiv.innerHTML = new Date().toLocaleTimeString();
    newLog.appendChild(dateDiv);


    if (data) {
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content');

        Object.entries(data).forEach(([key, value], index) => {
            const explanation = logKeyExplanation[key];
            if (index > 0) {
                const hrDiv = document.createElement('hr');
                contentDiv.appendChild(hrDiv);
            }

            const entryDiv = document.createElement('div');
            entryDiv.classList.add('list-item');

            const keyDiv = document.createElement('div');
            keyDiv.classList.add('key');
            keyDiv.innerHTML = explanation.title;
            entryDiv.appendChild(keyDiv);

            const descriptionDiv = document.createElement('span');
            descriptionDiv.classList.add('info-icon');
            descriptionDiv.innerHTML = ' &#9432;';
            descriptionDiv.title = explanation.description;
            keyDiv.appendChild(descriptionDiv);

            const valueDiv = document.createElement('div');
            valueDiv.classList.add('value');
            valueDiv.innerHTML = explanation.format(value);
            entryDiv.appendChild(valueDiv);

            contentDiv.appendChild(entryDiv);
        });
        newLog.appendChild(contentDiv);
    }

    logDiv.prepend(newLog);
}
