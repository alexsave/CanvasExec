const textColor = '#fff';

const appendOutput = (terminal, text, color = textColor, id = '') => {
    if (id !== 'confirm-prompt') {
        document.getElementById('confirm-prompt')?.remove();
    }
    const chunk = document.createElement('code');
    chunk.id = id;
    chunk.style.color = color;
    //chunk.textContent = text.replace(/\n/g, '<br>');
    chunk.textContent = text;//.replace(/\n/g, '<br>');
    chunk.style.whiteSpace = 'pre';
    // first child is text box
    terminal.firstChild.appendChild(chunk);
};


const getTerminalAndTiming = () => {
    let terminalElement = document.querySelector('#my-terminal');
    if (!document.querySelector('#my-terminal')) {
        terminalElement = document.createElement("footer");
        terminalElement.id = 'my-terminal';

        // add terminal
        terminalElement.style.position = 'relative';
        terminalElement.style.bottom = '0';
        terminalElement.style.width = '100%';
        //terminalElement.style.height = '200px';
        terminalElement.style.backgroundColor = '#0d0d0d';
        terminalElement.style.fontSize = '14px';
        terminalElement.style.padding = '1rem 0 1rem 1rem';

        let textContainer = document.createElement('div');
        textContainer.style.height = '300px'
        textContainer.style.overflowY = 'auto';

        terminalElement.appendChild(textContainer);
        /*
        <code id="my-timing" style="position: absolute; top: 0px; right: 0px; padding:.5rem;font-family: inherit; font-size: 24px;">X
</code>
        */

        let closeButton = document.createElement('button');
        closeButton.style.position = 'absolute';
        closeButton.style.top = '0';
        closeButton.style.right = '0';
        closeButton.style.padding = '0.5rem';
        closeButton.style.fontSize = '24px'
        closeButton.textContent = 'X';
        closeButton.addEventListener('click', () => {
            terminalElement.style.display = 'none';
        });


        terminalElement.appendChild(closeButton);

        // Append the new child to the parent
        document.querySelector('section').appendChild(terminalElement);
    }

    terminalElement.style.display = 'block';
    terminalElement.firstChild.innerHTML = "";
    //terminalElement.removeChild(terminalElement.lastChild);

    let timingElement = document.getElementById('my-timing');
    if (!timingElement) {
        timingElement = document.createElement('code');
        timingElement.id = 'my-timing';
        timingElement.style.position = 'fixed';
        timingElement.style.bottom = '0';
        timingElement.style.right = '0';
        timingElement.style.fontFamily = 'inherit';
        timingElement.style.fontSize = '9px';

        terminalElement.appendChild(timingElement);
    }

    return [terminalElement, timingElement];
};

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

    return container;
};

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


        // Add labeled textareas
        settingsPop.appendChild(createLabeledTextarea("Compiler Args:", "Enter compiler args", "comp-args"));
        settingsPop.appendChild(createLabeledTextarea("Runtime Args:", "Enter runtime args", "run-args"));
        settingsPop.appendChild(createLabeledTextarea("Working Directory:", "Defaults to tmp dir", "custom-dir"));


        document.body.appendChild(settingsPop);
    } else {
        // in this scenario, it might be open so we should close it
        if (settingsPop.style.display === 'block') {
            settingsPop.style.display = "none";
            return 1;
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
};

const addHoverTip = (div, tip) => {
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

        //const contentBox = wrapper.getBoundingClientRect();

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
};

const withHideRunBlock = task => async () => {
    document.getElementById('my-run-block').style.display = 'none';
    await task();
    document.getElementById('my-run-block').style.display = 'block';
}

const createRunBlock = (existingBlock) => {
    const sampleButton = existingBlock.querySelector('button')
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
    runButton.addEventListener('click', withHideRunBlock(fetchAndRunCode));
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

    addHoverTip(runButton, 'Run')
    addHoverTip(fixButton, 'Fix & Loop')
    addHoverTip(settingsButton, 'Run Config')

    return runBlock;
};
