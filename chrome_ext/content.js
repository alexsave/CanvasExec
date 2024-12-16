const uuid = crypto.randomUUID();
const serverUrl = 'ws://localhost:4001';

// definitley split a lot of this out to ui.js
function waitForNetworkIdle(checkInterval = 500) {
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

let errCache = '';

const runFixCode = async () => {
    document.getElementById('my-run-block').style.display = 'none';
    errCache = '';
    console.log(errCache);

    await fetchAndRunCode();

    if (errCache === ''){
        document.getElementById('my-run-block').style.display = 'block';


        return;
    }

    // This is surprisingly critical
    errCache = 'Fix this in canvas:\n' + errCache;

    // note that this completely doesn't work in the case where the canvas has no chat on teh left
    const promptBox = document.querySelector('#prompt-textarea');

    // simulate Ctrl+V
    if (!promptBox) {
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
    waitForNetworkIdleAndDOMStable().then(() => { console.log('done, ready for next phase'), runFixCode() });
    await delay(100);
    // this works better, just simulate enter rather than button
    promptBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));

    // ok this works kinda strangely, I don't know why 
    //button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await delay(1000);

    //runFixCode();
};

const fetchAndRunCode = async _ => {
    console.log('getting code');
    const code = await getCode();
    console.log('got code ' + code)
    // dsiable
    await runCode(code);
    // enabled
    console.log('ran code');
};

const getCode = async () => {
    // the best solution seems to be literally emulate the current workflow of copying to another ide
    // so hit the copy button
    // Perform actions: Click the button
    // ffs they updated the DOM
    const selector = 'header div:nth-of-type(3) >div> span button'
    const button = document.querySelector(selector);
    if (!button) {
        console.log('no  button')
        // Restore if the button is not found
        //navigator.clipboard.write = originalWrite;
        //reject(
        throw new Error(`Button not found for selector: ${selector}`);
    }
    button.click();

    await delay(300);
    try {
        const clipboardText = await navigator.clipboard.readText();
        console.log('Clipboard contents:', clipboardText);
        return clipboardText;
    } catch (err) {
        console.error('Clipboard access failed:', err);
    }
}

const runCode = (code) => {
    return new Promise((resolve, reject) => {
        console.log('running code');
        // interesting note: this won't work if you ask for python code, then switch to C
        const language = document.querySelector('#codemirror .cm-content').getAttribute('data-language');


        // we need to send this to backend
        const request = { language, code, uuid };

        const customDir = document.getElementById("custom-dir")?.value
        if (customDir) request.customDir = customDir;

        const runArgs = document.getElementById("run-args")?.value;
        if (runArgs) request.runArgs = runArgs;

        const compArgs = document.getElementById("comp-args")?.value;
        if (compArgs) request.compArgs = compArgs;

        let [terminalElement, timingElement] = getTerminalAndTiming();

        let socket;

        try {
            socket = new WebSocket(serverUrl);
        } catch (e) {
            // no connection. we should still probably log a message to terminal
            appendOutput(terminalElement, "Connection failed, ensure server is running: node server/app.js.", "#f22c3d")

            resolve();
        }

        setTimeout(() => {
            // If nothing has been returned after 5s, it's likely that they need to confirm uuid
            // 4 because timing element is always there, and so is teh container and also x button
            if (terminalElement.firstChild.children.length === 0) {
                appendOutput(terminalElement, `Check server process to authorize client id: ${uuid}`, '#fff', 'confirm-prompt')
            }
        }, 2000)

        // 30s limit
        setTimeout(() => {
            // ensure socket closed
            if (socket.readyState !== WebSocket.CLOSED) {
                appendOutput(terminalElement, "Execution timed out 30s limit.", "#f22c3d")
                socket.close();
            }
        }, 30000)

        // send code to server
        socket.addEventListener('open', (event) => {
            console.log('WebSocket connection opened:', event);
            console.log(request);
            console.log(JSON.stringify(request));
            socket.send(JSON.stringify(request));
        });

        socket.addEventListener('message', (event) => {
            console.log('Received message from server:', event.data);
            const status = event.data[0];
            const message = event.data.slice(1);
            if (status === 'e')
                errCache += message;
            if (status === 't') {
                // display timing
                timingElement.innerText = message;
            } else if (status === 'e' || status === 'o') {
                appendOutput(terminalElement, message, status === 'e' ? '#f22c3d' : '#fff')
                terminalElement.scrollTop = terminalElement.scrollHeight;

            }
        });

        // WebSocket error handling
        socket.addEventListener('error', (event) => {
            console.log('WebSocket error:', event);
            // probably server not running
            appendOutput(terminalElement, "Connection failed, ensure server is running: node server/app.js", "#f22c3d")
        });

        // WebSocket connection closed event
        socket.addEventListener('close', (event) => {
            console.log('WebSocket connection closed:', event);
            resolve();
        });
    })
}

const handleCloseSetting = () => {
    const div = document.getElementById('my-run-config');
    if (div) div.style.display = "none"
    // don't worry about it if it's closed though
    document.removeEventListener('click', handleCloseSetting);
}

const checkAddButton = () => {
    // header will be there
    // but .items-center won't always
    if (document.getElementById('my-run-block')) {
        clearInterval(checkAddButton);
        return;
    }

    const header = document.querySelector('header');

    // Canvas not opened
    if (!header) 
        return;

    let existingBlock = document.querySelector('header').lastChild;
    // Still Canvas not opened
    if (!existingBlock) 
        return;

    const sampleButton = existingBlock.querySelector('button')

    // Also canvas not opened
    if (!sampleButton) 
        return;

    let runBlock = createRunBlock(existingBlock);
    console.log('adding ' + runBlock + ' before ' + existingBlock);

    header.insertBefore(runBlock, existingBlock);
}

(async _ => {
    await waitForNetworkIdle();
    // I guess we could wait for dom manipulation instead of every .5s

    setInterval(checkAddButton, 500);
})()
