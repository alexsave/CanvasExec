const WebSocket = require('ws');
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

// WebSocket server
const server = new WebSocket.Server({ port: 4001 });

server.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('message', async (message) => {
        try {
            const { code, language, customFolder } = JSON.parse(message);

            if (!code || !language) {
                socket.send('Error: Missing code or language');
                return;
            }

            let tempDir;
            if (customFolder) {
                if (!fs.existsSync(customFolder)) {
                    socket.send(`Error: Custom folder ${customFolder} does not exist`);
                    return;
                }
                tempDir = customFolder;
            } else {
                tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-'));
            }

            const fileName = getFileName(tempDir, language);
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

            const startTime = process.hrtime(); // Start timer
            await handler.execute(socket, fileName, tempDir);
            const elapsedTime = process.hrtime(startTime); // End timer

            // Calculate elapsed time in milliseconds
            const elapsedMilliseconds = (elapsedTime[0] * 1000) + (elapsedTime[1] / 1e6);
            socket.send(`t${elapsedMilliseconds.toFixed(2)}ms`);

            if (!customFolder) cleanUp(tempDir);
        } catch (error) {
            socket.send(`Error: ${error.message}`);
        } finally {
            socket.close();
        }
    });
});

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
            socket.send('o' + data.toString().replaceAll(tempDir, ''));
        });

        process.stderr.on('data', (data) => {
            socket.send('e' + data.toString().replaceAll(tempDir, ''));
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
    });
};

const getFileName = (dir, language) => {
    switch (language) {
        case 'bash': return path.join(dir, 'script.sh');
        case 'python': return path.join(dir, 'script.py');
        case 'javascript': return path.join(dir, 'script.js');
        case 'java': return path.join(dir, 'Main.java');
        case 'c': return path.join(dir, 'program.c');
        case 'cpp': return path.join(dir, 'program.cpp');
        default: return null;
    }
};

// Language Handlers
const languageHandlers = {
    bash: {
        checkCommand: 'bash --version',
        installCommand: getInstallCommand('bash'),
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('bash', socket);
            await runCommand(socket, 'bash', [fileName], tempDir);
        }
    },
    python: {
        checkCommand: platform === 'win32' ? 'python --version' : 'python3 --version',
        installCommand: getInstallCommand('python3'),
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('python', socket);
            await runCommand(socket, platform === 'win32' ? 'python' : 'python3', [fileName], tempDir);
        }
    },
    javascript: {
        checkCommand: 'node --version',
        installCommand: getInstallCommand('node'),
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('javascript', socket);
            await runCommand(socket, 'node', [fileName], tempDir);
        }
    },
    java: {
        checkCommand: 'javac -version && java -version',
        installCommand: getInstallCommand('openjdk'),
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('java', socket);

            // Compile step
            await runCommand(socket, 'javac', [fileName], tempDir);

            // Run compiled Java program
            await runCommand(socket, 'java', ['-cp', tempDir, 'Main'], tempDir);
        }
    },
    c: {
        checkCommand: 'gcc --version',
        installCommand: getInstallCommand('gcc'),
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('c', socket);

            // Compile step
            const compiledFile = path.join(tempDir, 'program');
            await runCommand(socket, 'gcc', [fileName, '-o', compiledFile], tempDir);

            // Run compiled program
            await runCommand(socket, compiledFile, [], tempDir);
        }
    },
    cpp: {
        checkCommand: 'g++ --version',
        installCommand: getInstallCommand('gcc'), // g++ comes with GCC
        execute: async (socket, fileName, tempDir) => {
            //await ensureToolInstalled('cpp', socket);

            // Compile step
            const compiledFile = path.join(tempDir, 'program');
            await runCommand(socket, 'g++', [fileName, '-o', compiledFile], tempDir);

            // Run compiled program
            await runCommand(socket, compiledFile, [], tempDir);
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
