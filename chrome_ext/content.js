
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
        // idk
        const timingElement = document.createElement('code');
        timingElement.id = 'my-timing';
        timingElement.style.position = 'fixed';
        timingElement.style.bottom = '0';
        timingElement.style.right = '0';
        timingElement.style.fontFamily = 'inherit';
        timingElement.style.fontSize = '9px';
        //timingElement.innerText = 'some millisecond count';

        terminalElement.appendChild(timingElement);

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
            if (status === 't') {
                // display timing
                document.getElementById('my-timing').innerText = message;
            } else if (status ==='e' || status === 'o') {
                appendOutput(terminalElement, message, status === 'e' ? '#f22c3d' : '#fff')
                terminalElement.scrollTop = terminalElement.scrollHeight;

            }
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

const addToolTip = (div, tip) => {
    const target = div;

    target.addEventListener('mouseenter', () => {
        let box = target.getBoundingClientRect();
        // Create outer wrapper div
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.left = '0px';
        wrapper.style.top = '0px';


        wrapper.style.minWidth = 'max-content';
        wrapper.style.zIndex = '50';
        wrapper.style.willChange = 'transform';

        // Create content div
        const content = document.createElement('div');
        content.className = 'relative z-50 select-none shadow-xs transition-opacity px-3 py-2 rounded-lg border-white/10 dark:border bg-gray-950 max-w-xs';

        // Add tooltip text
        const text = document.createElement('span');
        text.className = 'flex items-center whitespace-pre-wrap font-semibold normal-case text-center text-gray-100 text-sm';
        text.innerText = tip;
        content.appendChild(text);

        // Add arrow
        const arrowWrapper = document.createElement('span');
        arrowWrapper.style.position = 'absolute';
        arrowWrapper.style.top = '0px';
        arrowWrapper.style.transformOrigin = 'center 0px';
        arrowWrapper.style.transform = 'rotate(180deg)';
        arrowWrapper.style.left = `${box.width / 2}px`;

        const arrow = document.createElement('div');
        arrow.className = 'relative top-[-4px] h-2 w-2 rotate-45 transform shadow-xs dark:border-r dark:border-b border-white/10 bg-gray-950';
        arrow.style.display = 'block';
        arrowWrapper.appendChild(arrow);

        content.appendChild(arrowWrapper);

        wrapper.appendChild(content);

        const contentBox = wrapper.getBoundingClientRect();

        wrapper.style.transform = `translate(${box.left - window.scrollX}px, ${box.bottom - window.scrollY}px`;

        wrapper.setAttribute('id', target.id + 'tooltip');
        document.body.appendChild(wrapper);
    });

    target.addEventListener('mouseleave', () => {
        // Remove tooltip
        const tooltip = document.getElementById(target.id + 'tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    });

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

    // I just want styles, let's see what this does
    const runBlock = existingBlock.cloneNode(true);
    runBlock.id = 'my-run-block';
    runBlock.innerHTML = '';

    const runButton = sampleButton.cloneNode(true);
    let svgPath = runButton.querySelector('svg path');
    if (svgPath) {
        svgPath.setAttribute(
            'd',
            'M3 2L21 12L3 22V2Z' // A basic right-pointing play button shape
        );
    }
    runButton.addEventListener('click', runCode);
    runButton.id = 'my-run-button';
    runBlock.prepend(runButton);

    const fixButton = sampleButton.cloneNode(true);
    svgPath = fixButton.querySelector('svg path');
    if (svgPath) {
        svgPath.setAttribute(
            'd',
            //idk
            "M 3 2 L 18 12 L 3 22 V 2 Z M 8 2 L 23 12 L 8 22 Z M 20 9 A 4 4 90 0 1 24 5 A 4 4 90 0 1 20 1 A 4 4 90 0 1 16 5 A 4 4 90 0 1 20 9"
        );
    }

    fixButton.addEventListener('click', runFixCode);
    fixButton.id = 'my-run-fix-button';
    runBlock.prepend(fixButton);

    addToolTip(runButton, 'Run')
    addToolTip(fixButton, 'Fix & Loop')

    header.insertBefore(runBlock, existingBlock);

}


(async _ => {
    await waitForNetworkIdle();
    // I guess we could wait for dom manipulation instead of every .5s
    setInterval(checkAddButton, 500);
})()