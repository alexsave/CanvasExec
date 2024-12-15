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

const appendOutput = (terminal, text, color = '#fff', id = '') => {
    if (id !== 'confirm-prompt'){
        document.getElementById('confirm-prompt')?.remove();
    }
    const chunk = document.createElement('code');
    chunk.id = id;
    chunk.style.color = color;
    //chunk.textContent = text.replace(/\n/g, '<br>');
    chunk.textContent = text;//.replace(/\n/g, '<br>');
    chunk.style.whiteSpace = 'pre';
    terminal.appendChild(chunk);
}

let errCache = '';

const runFixCode = async () => {
    errCache = '';
    console.log(errCache);

    await fetchAndRunCode();

    if (errCache === '')
        return;

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
    await runCode(code);
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

        let socket;

        try {
            socket = new WebSocket(serverUrl);
        } catch (e) {
            // no connection. we should still probably log a message to terminal
            appendOutput(terminalElement, "Connection failed, ensure server is running: node server/app.js.", "#f22c3d")

            resolve();
        }

        // idk
        const timingElement = document.createElement('code');
        timingElement.id = 'my-timing';
        timingElement.style.position = 'fixed';
        timingElement.style.bottom = '0';
        timingElement.style.right = '0';
        timingElement.style.fontFamily = 'inherit';
        timingElement.style.fontSize = '9px';

        terminalElement.appendChild(timingElement);

        setTimeout(() => {
            // If nothing has been returned after 5s, it's likely that they need to confirm uuid
            // 2 because timing element is always there
            if (terminalElement.children.length < 2) {
                appendOutput(terminalElement, "Check server process to confirm request.", '#fff', 'confirm-prompt')
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
                errCache += message
            if (status === 't') {
                // display timing
                document.getElementById('my-timing').innerText = message;
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

const toggleSettings = (e) => {
    e.stopPropagation();
    // create a popup menu with CLI args and custom dir
    let settingsPop = document.getElementById('my-run-config');
    if (!settingsPop) {
        // in this scenario, it's definitely "closed" so it's ok to open
        settingsPop = document.createElement("div");
        settingsPop.id = 'my-run-config';
        settingsPop.style.position = "absolute";
        settingsPop.style.backgroundColor = "#0d0d0d";
        settingsPop.style.width = '320px';
        settingsPop.style.border = "1px solid #313131";
        settingsPop.className = 'relative z-50 select-none shadow-xs transition-opacity px-3 py-2 rounded-lg border-white/10 dark:border bg-gray-950';// max-w-xs';

        // Function to create a labeled textarea
        const createLabeledTextarea = (labelText, placeholderText, id) => {
            const container = document.createElement("div");
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.marginBottom = "5px";

            const label = document.createElement("label");
            label.textContent = labelText;
            //label.style.marginRight = "10px";
            label.style.color = "#bbbbbb";
            label.style.width = "120px";
            label.style.textAlign = "right";
            label.style.fontSize = "12px";
            container.appendChild(label);

            const textarea = document.createElement("textarea");
            textarea.id = id;
            textarea.className = "resize-none bg-gray-900 p-2 rounded focus:ring "
            container.appendChild(label);
            textarea.placeholder = placeholderText;
            textarea.style.whiteSpace = "nowrap";
            label.style.fontSize = "12px";
            textarea.style.lineHeight = "25px";
            textarea.style.height = "25px";
            textarea.style.padding = "0";
            textarea.style.width = "200px";
            textarea.style.overflowY = "scroll";
            textarea.style.scrollbarWidth = "none"; // Firefox
            textarea.style.msOverflowStyle = "none"; // IE 10+
            textarea.style.webkitScrollbar = "none"; // WebKit browsers

            container.appendChild(textarea);

            settingsPop.appendChild(container);
            return textarea;
        };

        // Add labeled textareas
        createLabeledTextarea("Compiler Args:", "Enter compiler args", "comp-args");
        createLabeledTextarea("Runtime Args:", "Enter runtime args", "run-args");
        createLabeledTextarea("Working Directory:", "Defaults to tmp dir", "custom-dir");


        document.body.appendChild(settingsPop);
    } else {
        // in this scenario, it might be open so we should close it
        if (settingsPop.style.display === 'block') {
            settingsPop.style.display = "none";
            return

        }

    }
    // we could probably do this every time, in case the page width changes or somethign
    let configBox = document.getElementById('my-run-config-button').getBoundingClientRect();
    settingsPop.style.left = `${configBox.left}px`;
    settingsPop.style.top = `${configBox.bottom}px`;
    settingsPop.style.display = "block";

    // add it while the settings box is open
    document.addEventListener('click', handleCloseSetting);

    settingsPop.addEventListener('click', e => e.stopPropagation());


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
    // ok sometimes these just don't show up after first reload
    // these should probably be hidden during execution or GPT code edits
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
    runButton.addEventListener('click', fetchAndRunCode);
    runButton.id = 'my-run-button';
    runBlock.prepend(runButton);

    const fixButton = sampleButton.cloneNode(true);
    svgPath = fixButton.querySelector('svg path');
    if (svgPath) {
        svgPath.setAttribute(
            'd',
            "M 3 2 L 18 12 L 3 22 V 2 Z M 8 2 L 23 12 L 8 22 Z M 20 9 A 4 4 90 0 1 24 5 A 4 4 90 0 1 20 1 A 4 4 90 0 1 16 5 A 4 4 90 0 1 20 9"
        );
    }

    fixButton.addEventListener('click', runFixCode);
    fixButton.id = 'my-run-fix-button';
    runBlock.prepend(fixButton);

    const settingsButton = sampleButton.cloneNode(true);
    svgPath = settingsButton.querySelector('svg path');
    if (svgPath) {
        svgPath.setAttribute(
            'd',
            "M8.5 12c0-2 1.5-3.5 3.5-3.5S15.5 10 15.5 12 14 15.5 12 15.5 8.5 14 8.5 12ZM9 3 8.2 4.4c-.2.3-.5.5-.9.5H5.7c-1 0-2 .5-2.6 1.5l-.4.7c-.5 1-.5 2.1 0 3l.8 1.4c.2.3.2.7 0 1l-.8 1.4c-.5.9-.5 2 0 3l.4.7c.6 1 1.6 1.5 2.6 1.5H7.3c.4 0 .7.2.9.5L9 21c.5.9 1.5 1.5 2.6 1.5h.8c1.1 0 2.1-.6 2.6-1.5l.8-1.4c.2-.3.5-.5.9-.5h1.6c1.1 0 2-.5 2.6-1.5l.4-.7c.5-1 .5-2.1 0-3l-.8-1.4c-.2-.3-.2-.7 0-1l.8-1.4c.5-.9.5-2 0-3l-.4-.7c-.6-1-1.5-1.5-2.6-1.5H16.7c-.4 0-.7-.2-.9-.5L15 3c-.5-.9-1.5-1.5-2.6-1.5h-.8C10.5 1.5 9.5 2.1 9 3ZL8.2 4.4Z"
        );
    }

    settingsButton.addEventListener('click', e => toggleSettings(e));
    settingsButton.id = 'my-run-config-button';
    runBlock.prepend(settingsButton);

    addToolTip(runButton, 'Run')
    addToolTip(fixButton, 'Fix & Loop')
    addToolTip(settingsButton, 'Run Config')

    header.insertBefore(runBlock, existingBlock);
}

(async _ => {
    await waitForNetworkIdle();
    // I guess we could wait for dom manipulation instead of every .5s

    setInterval(checkAddButton, 500);
})()