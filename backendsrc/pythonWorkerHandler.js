const { spawn } = require('child_process');
const { Mutex } = require('async-mutex');

class pythonWorkerHandler {

    constructor(inSocket) {
        const pythonServer = spawn('python3', ['./pythonWorker/server.py']);

        pythonServer.stdout.on('data', (data) => {
            console.log(`Python server stdout: ${data}`);
        });

        pythonServer.stderr.on('data', (data) => {
            console.error(`Python server stderr: ${data}`);
        });

        pythonServer.on('exit', (code, signal) => {
            if (code !== 0) {
                console.error(`Python server exited with code: ${code}, signal: ${signal}`);
            }
        });

        this.sock = inSocket;
        this.sock.connect('tcp://127.0.0.1:4242');

        this.processMutex = new Mutex();

    }

    async getEmbedding(inText) {
        let result = null;
        await this.processMutex.runExclusive(async () => {
            await this.sock.send(inText);
            [result] = await this.sock.receive();
        });
        let stringResult = result.toString();
        let JSONObjectResult = JSON.parse(stringResult);
        return JSONObjectResult;
    }

}

module.exports = pythonWorkerHandler;