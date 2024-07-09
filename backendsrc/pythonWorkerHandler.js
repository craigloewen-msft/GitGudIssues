const { spawn } = require('child_process');
const { Mutex } = require('async-mutex');
const zmq = require('zeromq');

class pythonWorkerHandler {

    constructor() {
        this.sock = new zmq.Request;

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

        this.sock.connect('tcp://127.0.0.1:4242');

        this.processMutex = new Mutex();
    }

    async getPrediction(inText) {
        let result = null;
        await this.processMutex.runExclusive(async () => {
            let request = JSON.stringify({ method: 'getPrediction', args: [inText] });
            await this.sock.send(request);
            [result] = await this.sock.receive();
        });
        let stringResult = result.toString();
        let JSONObjectResult = JSON.parse(stringResult);
        return JSONObjectResult;
    }
}

module.exports = pythonWorkerHandler;