
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

function waitForNetworkIdle2(timeout = 1000, checkInterval = 500) {
    return new Promise((resolve) => {
        let lastActiveTimestamp = Date.now();
        let activeRequests = 0;

        const check = () => {
            const now = Date.now();

            // If there are no active requests and the timeout has elapsed
            if (activeRequests === 0 && now - lastActiveTimestamp >= timeout) {
                resolve();
            } else {
                // Reset the timer and check again after the check interval
                setTimeout(check, checkInterval);
            }
        };

        const updateLastActiveTimestamp = () => {
            lastActiveTimestamp = Date.now();
        };

        const incrementActiveRequests = () => {
            activeRequests++;
            updateLastActiveTimestamp();
        };

        const decrementActiveRequests = () => {
            activeRequests = Math.max(0, activeRequests - 1);
            updateLastActiveTimestamp();
        };

        // Wrap fetch to track activity
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            incrementActiveRequests();
            return originalFetch.apply(this, args).then((response) => {
                decrementActiveRequests();
                return response;
            }).catch((error) => {
                decrementActiveRequests();
                throw error;
            });
        };

        // Wrap XMLHttpRequest to track activity
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (...args) {
            this.addEventListener('loadend', decrementActiveRequests, true);
            incrementActiveRequests();
            originalXHROpen.apply(this, args);
        };

        // Start the check process
        check();
    });
}

function waitForNetworkIdleAndDOMStable(timeout = 1000, checkInterval = 500) {
    return new Promise((resolve) => {
        let lastActiveTimestamp = Date.now();
        let activeRequests = 0;
        let domChangeDetected = false;

        const check = () => {
            const now = Date.now();

            // If no active requests, no DOM changes, and timeout has elapsed
            if (activeRequests === 0 && !domChangeDetected && now - lastActiveTimestamp >= timeout) {
                domObserver.disconnect(); // Stop observing DOM changes
                resolve();
            } else {
                setTimeout(check, checkInterval);
            }
        };

        const updateLastActiveTimestamp = () => {
            lastActiveTimestamp = Date.now();
        };

        const incrementActiveRequests = () => {
            activeRequests++;
            updateLastActiveTimestamp();
        };

        const decrementActiveRequests = () => {
            activeRequests = Math.max(0, activeRequests - 1);
            updateLastActiveTimestamp();
        };

        // Wrap fetch to track activity
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            incrementActiveRequests();
            return originalFetch.apply(this, args).then((response) => {
                decrementActiveRequests();
                return response;
            }).catch((error) => {
                decrementActiveRequests();
                throw error;
            });
        };

        // Wrap XMLHttpRequest to track activity
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (...args) {
            this.addEventListener('loadend', decrementActiveRequests, true);
            incrementActiveRequests();
            originalXHROpen.apply(this, args);
        };

        // Monitor DOM changes
        const domObserver = new MutationObserver(() => {
            domChangeDetected = true;
            updateLastActiveTimestamp();

            // Reset DOM change detection after the timeout
            setTimeout(() => {
                domChangeDetected = false;
            }, checkInterval);
        });

        domObserver.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
        });

        // Start the check process
        check();
    });
}



const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const appendOutput = (terminal, text, color='#fff') => {
    const chunk = document.createElement('code');
    chunk.style.color = color;
    //chunk.textContent = text.replace(/\n/g, '<br>');
    chunk.textContent = text;//.replace(/\n/g, '<br>');
    chunk.style.whiteSpace = 'pre';
    terminal.appendChild(chunk);
}

/*const appendError = (terminal, text) => {
    const line = document.createElement('code');
    line.style.color = '#f22c3d'
    line.textContent = text;
    terminal.appendChild(line);
}*/

let errCache = '';


const runFixCode = async () => {
    errCache = '';
    console.log(errCache);

    await runCode();

    if (errCache === '')
        return;

    // This is surprisingly critical
    errCache = 'Fix this:\n' + errCache;

    // note that this completely doesn't work in the case where the canvas has no chat on teh left
    const promptBox = document.querySelector('#prompt-textarea');

    // simulate Ctrl+V
    if (!promptBox){
        console.error("Selector not found: #prompt-textarea");
        return;
    }
    promptBox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    promptBox.focus();

    const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
    pasteEvent.clipboardData.setData('text/plain', errCache);
    promptBox.dispatchEvent(pasteEvent);

    await delay(Math.sin(Math.random()) * 800 + 30);

    // Click the button
    // This also probably won't work when canvas is full full screen
    /*const button = document.querySelector('button[aria-label="Send prompt"]');
    if (!button){
        console.error('Selector not found: button[aria-label="Send prompt"]');
        return;
    }*/
    // we have to do this first to really keep track of the loads
    waitForNetworkIdleAndDOMStable().then(() => {console.log('done, ready for next phase'), runFixCode()});
    await delay(100);
    // this works better, just simulate enter rather than button
    promptBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));

    // ok this works kinda strangely, I don't know why 
    //button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await delay(1000);

    //runFixCode();
};

const runCode = () => {
    return new Promise((resolve, reject) => {
        console.log('running code');
        //Now this is where it gets really fucking tricky
        const language = document.querySelector('#codemirror .cm-content').getAttribute('data-language');
        const code = [...document.querySelectorAll('#codemirror .cm-line')].map(x => x.innerText).join('\n');

        //console.log('Running ' + code + ' in ' + lang);

        // we need to send this to backend
        const request = { language, code };

        const socket = new WebSocket(serverUrl);

        let terminalElement = document.querySelector('#my-terminal');

        if (!document.querySelector('#my-terminal')) {
            terminalElement = document.createElement("footer");
            terminalElement.id = 'my-terminal';

            // add terminal
            terminalElement.style.position = 'fixed';
            terminalElement.style.bottom = '0';
            terminalElement.style.width = '100%';
            terminalElement.style.height = '200px';
            terminalElement.style.backgroundColor = '#0d0d0d';
            terminalElement.style.fontSize = '14px';
            terminalElement.style.overflowY = 'auto';
            terminalElement.style.padding = '1rem';

            // Append the new child to the parent
            document.querySelector('section').appendChild(terminalElement);
        }

        terminalElement.innerHTML = "";

        // send code to server
        socket.addEventListener('open', (event) => {
            console.log('WebSocket connection opened:', event);
            socket.send(JSON.stringify(request));
        });

        socket.addEventListener('message', (event) => {
            console.log('Received message from server:', event.data);
            const status = event.data[0];
            const message = event.data.slice(1);
            if (status === 'e')
                errCache += message
            appendOutput(terminalElement, message, status === 'e' ? '#f22c3d' : '#fff')
            terminalElement.scrollTop = terminalElement.scrollHeight;
        });


        // WebSocket error handling
        socket.addEventListener('error', (event) => {
            console.log('WebSocket error:', event);
            appendOutput(terminalElement, event, '#f22c3d')
        });

        // WebSocket connection closed event
        socket.addEventListener('close', (event) => {
            console.log('WebSocket connection closed:', event);
            resolve();
            // UI
        });


    })

}


const checkAddButton = () => {
    //document.querySelector
    let row = document.querySelector('header .items-center .items-center');
    //console.log('row')
    if (row) {
        //alread added
        if (row.querySelector('#my-run-button') && row.querySelector('#my-run-button')) {
            clearInterval(checkAddButton);
        }

        if (!row.querySelector('#my-run-button')) {


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
        }

        if (!row.querySelector('#my-run-fix-button')) {


            const runButton = row.firstChild.cloneNode(true)
            const svgPath = runButton.querySelector('svg path');
            if (svgPath) {
                svgPath.setAttribute(
                    'd',
                    //idk
                    "M 3 2 L 18 12 L 3 22 V 2 Z M 8 2 L 23 12 L 8 22 Z M 20 9 A 4 4 90 0 1 24 5 A 4 4 90 0 1 20 1 A 4 4 90 0 1 16 5 A 4 4 90 0 1 20 9"
                    //'M3 2L21 12L3 22V2Z ' + // First play button
                    //'M6 4L24 14L6 24V4Z ' + // Second overlaid play button, shifted slightly
                    //'M28 8L30 10L32 8L30 6L28 8Z ' + // Sparkle star: center
                    //'M30 5L30 11M27 8L33 8' // Horizontal and vertical sparkle lines
                );
            }

            //runButton.onClick = runCode;
            runButton.addEventListener('click', runFixCode);
            runButton.id = 'my-run-fix-button';

            row.prepend(runButton);
        }


    }
}


(async _ => {
    await waitForNetworkIdle();
    setInterval(checkAddButton, 500);


})()