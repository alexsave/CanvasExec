
const serverUrl = 'ws://localhost:4001';

function waitForNetworkIdle(timeout = 1000, checkInterval = 500) {
    return new Promise((resolve) => {
        let lastActiveTimestamp = Date.now();

        const check = () => {
            const now = Date.now();

            // If there are no new requests in the last check interval
            if (now - lastActiveTimestamp >= checkInterval) {
                resolve();
            } else {
                // Reset the timer and check again after the check interval
                setTimeout(check, checkInterval);
            }
        };

        const updateLastActiveTimestamp = () => {
            lastActiveTimestamp = Date.now();
        };

        // Listen to network activity
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            updateLastActiveTimestamp();
            return originalFetch.apply(this, args);
        };

        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (...args) {
            this.addEventListener('readystatechange', updateLastActiveTimestamp, true);
            originalXHROpen.apply(this, args);
        };

        // Start the check process
        check();

    });
}



const runCode = () => {
    console.log('running code');
    //Now this is where it gets really fucking tricky
    const language = document.querySelector('#codemirror .cm-content').getAttribute('data-language');
    const code = [...document.querySelectorAll('#codemirror .cm-line')].map(x => x.innerText).join('\n');

    //console.log('Running ' + code + ' in ' + lang);

    // we need to send this to backend
    const request = { language, code };

    const socket = new WebSocket(serverUrl);

    const terminalElement = document.createElement("footer");
    terminalElement.id = 'my-terminal';

    // send code to server
    socket.addEventListener('open', (event) => {
        console.log('WebSocket connection opened:', event);
        socket.send(JSON.stringify(request));
    });

    socket.addEventListener('message', (event) => {
        console.log('Received message from server:', event.data);
        // UI
    });


    // WebSocket error handling
    socket.addEventListener('error', (event) => {
        console.log('WebSocket error:', event);
    });

    // WebSocket connection closed event
    socket.addEventListener('close', (event) => {
        console.log('WebSocket connection closed:', event);
        // UI
    });


    if (!document.querySelector('#my-terminal')) {

        // add terminal
        //terminalElement.style.all = 'unset';
        terminalElement.style.position = 'fixed';
        terminalElement.style.bottom = '0';
        terminalElement.style.left = '0';
        terminalElement.style.width = '100%';
        terminalElement.style.height = '200px';
        terminalElement.style.backgroundColor = '#0d0d0d';
        terminalElement.style.color = 'limegreen';
        //terminalElement.style.fontFamily = "'Courier New', Courier, monospace";
        //terminalElement.style.fontFamily = 'unset';
        terminalElement.style.fontFamily = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace !important",
        terminalElement.style.fontWeight = '400';
        terminalElement.style.fontSize = '14px';
        terminalElement.style.overflowY = 'auto';
        terminalElement.style.borderTop = '2px solid #333';
        terminalElement.style.padding = '1rem';
        terminalElement.style.boxSizing = 'border-box';

        const line = document.createElement('code');
        line.textContent = `Line 1: This is a sample log message`;
        terminalElement.appendChild(line);

        //terminalElement.textContent = "This is the new child\nnewline";

        // Append the new child to the parent
        document.querySelector('section').appendChild(terminalElement);
    }
}


const checkAddButton = () => {
    //document.querySelector
    let row = document.querySelector('header .items-center .items-center');
    //console.log('row')
    if (row) {
        //alread added
        if (row.querySelector('#my-run-button'))
            return;

        const runButton = row.firstChild.cloneNode(true)
        const svgPath = runButton.querySelector('svg path');
        if (svgPath) {
            svgPath.setAttribute(
                'd',
                'M3 2L21 12L3 22V2Z' // A basic right-pointing play button shape
            );
        }

        //runButton.onClick = runCode;
        runButton.addEventListener('click', runCode);
        runButton.id = 'my-run-button';

        row.prepend(runButton);
        clearInterval(checkAddButton);
    }
}


(async _ => {
    await waitForNetworkIdle();
    setInterval(checkAddButton, 500);


})()