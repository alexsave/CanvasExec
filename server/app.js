const WebSocket = require('ws');
const readline = require('readline');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const execAsync = util.promisify(exec);

// Get the current OS platform
const platform = os.platform();

const obfuscateFolder = true;

// Define installation command templates for different platforms
const installCommands = {
    darwin: 'brew install {{package}}',
    linux: 'sudo apt-get install -y {{package}}',
    win32: 'choco install {{package}} -y' // Assuming Chocolatey is available on Windows
};

// Set up readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const savedUUIDs = new Set();

// WebSocket server
const server = new WebSocket.Server({ port: 4001, host: '127.0.0.1' });

server.on('connection', (socket, req) => {
    console.log(`Client connected from: ${req.socket.remoteAddress}`);

    socket.on('message', async (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            const uuid = parsedMessage.uuid;

            // Step 1: Receive UUID
            //const { uuid } = parsedMessage;
            if (!uuid) {
                socket.send('Error: Missing UUID');
                return;
            }

            const { code, language, customFolder } = parsedMessage;
            if (!code || !language) {
                socket.send('Error: Missing code or language');
                return;
            }

            if (savedUUIDs.has(uuid)) {
                executeCode(socket, code, language, customFolder);
            } else {
                console.log(`Received UUID from client: ${uuid}`);

                // Present UUID to user for confirmation
                rl.question(`Do you confirm the execution for UUID: ${uuid}? (yes/no): `, (answer) => {
                    if (answer.toLowerCase() === 'yes') {
                        savedUUIDs.add(uuid);
                        executeCode(socket, code, language, customFolder);
                    } else {
                        socket.send('Execution not confirmed by the user.');
                        socket.close();
                        return;
                    }
                });
            }

        } catch (error) {
            socket.send(`Error: ${error.message}`);
        }
    });
});

const executeCode = async (socket, code, language, customFolder) => {
    console.log('executing');
    let tempDir;
    try {
        if (customFolder) {
            if (!fs.existsSync(customFolder)) {
                socket.send(`Error: Custom folder ${customFolder} does not exist`);
                return;
            }
            tempDir = customFolder;
        } else {
            tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-'));
        }

        const fileName = path.join(tempDir, languageHandlers[language][fileName]);
        if (!fileName) {
            socket.send(`Error: Unsupported language ${language}`);
            if (!customFolder) cleanUp(tempDir);
            return;
        }

        fs.writeFileSync(fileName, code);

        // Delegate execution to the respective language handler
        const handler = getLanguageHandler(language);
        if (!handler) {
            socket.send(`Error: No handler found for language ${language}`);
            if (!customFolder) cleanUp(tempDir);
            return;
        }

        try {
            //compile, etc. Don't want this to affect timing
            await handler.preExecute(socket, fileName, tempDir);

            try {
                const startTime = process.hrtime(); // Start timer
                await handler.execute(socket, fileName, tempDir);
                const elapsedTime = process.hrtime(startTime); // End timer

                // Calculate elapsed time in milliseconds
                const elapsedMilliseconds = (elapsedTime[0] * 1000) + (elapsedTime[1] / 1e6);
                socket.send(`t${elapsedMilliseconds.toFixed(2)}ms`);
            } catch (error) {
                socket.send(`eRun failed: ${error.message}`);
            }

        } catch (error) {
            socket.send(`eCompilation failed: ${error.message}`);
        }

    } catch (error) {
        socket.send(`eError: ${error.message}`);
    } finally {
        if (!customFolder) cleanUp(tempDir);
        socket.close();
    }
};

const getInstallCommand = (packageName) => {
    const commandTemplate = installCommands[platform];
    if (!commandTemplate) {
        throw new Error(`Automatic installation not supported for platform: ${platform}`);
    }
    return commandTemplate.replace('{{package}}', packageName);
};

const ensureToolInstalled = async (language, socket) => {
    try {
        const handler = getLanguageHandler(language);
        await execAsync(handler.checkCommand);
    } catch {
        socket.send(`Warning: ${language} not found, attempting to install...`);
        const handler = getLanguageHandler(language);
        if (!handler.installCommand) {
            throw new Error(`Automatic installation not supported for ${language}`);
        }
        try {
            await execAsync(handler.installCommand);
            socket.send(`${language} successfully installed.`);
        } catch {
            throw new Error(`Failed to install ${language}`);
        }
    }
};

const runCommand = (socket, cmd, args, tempDir) => {
    return new Promise((resolve, reject) => {
        const process = spawn(cmd, args);

        process.stdout.on('data', (data) => {
            console.log('stdout data ' + data.toString());
            socket.send('o' + data.toString().replaceAll(tempDir, ''));
        });

        process.stderr.on('data', (data) => {
            console.log('stderr data ' + data.toString());
            socket.send('e' + data.toString().replaceAll(tempDir, ''));
        });

        process.on('disconnect', idk => {
            console.log('disconnect', idk);
        });

        process.on('close', (cod, signal) => {
            console.log('close ' + cod);
            //if (signal === 'SIGSEGV') {
            //reject(new Error(`Command terminated due to a segmentation fault (signal: ${signal})`));
            //} else 
            if (cod === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${cod} (signal: ${signal})`));
            }
        });

        process.on('exit', (cod, signal) => {
            console.log(`Process exited with code: ${cod}, signal: ${signal}`);
        });

        process.on('error', (err) => {
            console.log('error ' + err);
            reject(new Error(`Failed to start process: ${err.message}`));
        });
    });
};

// Language Handlers
const languageHandlers = {
    bash: {
        checkCommand: 'bash --version',
        installCommand: getInstallCommand('bash'),
        fileName: 'script.sh',
        preExecute: _ => { },
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('bash', socket);
            await runCommand(socket, 'bash', [fileName], tempDir);
        }
    },
    python: {
        checkCommand: platform === 'win32' ? 'python --version' : 'python3 --version',
        installCommand: getInstallCommand('python3'),
        fileName: 'script.py',
        preExecute: _ => { },
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('python', socket);
            await runCommand(socket, platform === 'win32' ? 'python' : 'python3', [fileName], tempDir);
        }
    },
    javascript: {
        checkCommand: 'node --version',
        installCommand: getInstallCommand('node'),
        fileName: 'script.js',
        preExecute: _ => { },
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('javascript', socket);
            await runCommand(socket, 'node', [fileName], tempDir);
        }
    },
    java: {
        checkCommand: 'javac -version && java -version',
        installCommand: getInstallCommand('openjdk'),
        fileName: 'Main.java',
        preExecute: async (socket, fileName, tempDir) => {
            // Compile step
            //await ensureToolInstalled('java', socket);
            await runCommand(socket, 'javac', [fileName], tempDir);
        },
        execute: async (socket, fileName, tempDir) => {
            // Run compiled Java program
            await runCommand(socket, 'java', ['-cp', tempDir, 'Main'], tempDir);
        }
    },
    c: {
        checkCommand: 'gcc --version',
        installCommand: getInstallCommand('gcc'),
        fileName: 'program.c',
        preExecute: async (socket, fileName, tempDir) => {
            // Compile step
            //await ensureToolInstalled('c', socket);
            const compiledFile = path.join(tempDir, 'program');
            await runCommand(socket, 'gcc', [fileName, '-o', compiledFile], tempDir);
        },
        execute: async (socket, fileName, tempDir) => {
            // Run compiled program
            // timing should go here
            await runCommand(socket, path.join(tempDir, 'program'), [], tempDir);
        }
    },
    cpp: {
        checkCommand: 'g++ --version',
        installCommand: getInstallCommand('gcc'), // g++ comes with GCC
        fileName: dir => 'program.cpp',
        preExecute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('cpp', socket);

            // Compile step
            const compiledFile = path.join(tempDir, 'program');
            await runCommand(socket, 'g++', [fileName, '-o', compiledFile], tempDir);
        },
        execute: async (socket, fileName, tempDir) => {

            // Run compiled program
            await runCommand(socket, path.join(tempDir, 'program'), [], tempDir);
        }
    }
};

// Utility Functions

const getLanguageHandler = (language) => languageHandlers[language];

const cleanUp = (dir) => {
    fs.rmSync(dir, { recursive: true, force: true });
};

// Start the server
console.log('WebSocket server is running on ws://localhost:4001');
