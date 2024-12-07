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
    XMLHttpRequest.prototype.open = function(...args) {
      this.addEventListener('readystatechange', updateLastActiveTimestamp, true);
      originalXHROpen.apply(this, args);
    };

    // Start the check process
    check();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const runCode = () => {
	console.log('running code');
	//Now this is where it gets really fucking tricky
	const lang = document.querySelector('#codemirror .cm-content').getAttribute('data-language');
	const code = [...document.querySelectorAll('#codemirror .cm-line')].map(x => x.innerText).join('\n');

	console.log('Running ' + code + ' in ' + lang);
	
	// we need to send this to backend
	const request = {lang, code};
}


const checkAddButton = () => {
	//document.querySelector
	let row = document.querySelector('header .items-center .items-center');
	//console.log('row')
	if (row){
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