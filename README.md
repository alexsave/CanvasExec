ChatGPT 4o with Canvas Executor

Steps:

- `brew install npm`
- `node server/app.js`
- Go to `chrome://extensions/`
- Load unpacked
- Point to CanvasExec/chrome_ext
- Open any chat with canvas and enjoy!

On the first run from a new tab, you'll have to confirm that you want to run.
This is for security purposes, becuase otherwise it's possible another process connects to this and runs arbitrary code.

To support running various languages, run these as needed
- `brew install python`
- `brew install gcc`
- `brew install npm`

Todo ext:
- fix hover css
- save config to localstorage or wtvr
- remove info timeouts if necessary
Todo server:
- allow for input from terminal.
- remove output file from custom dir
- split into files