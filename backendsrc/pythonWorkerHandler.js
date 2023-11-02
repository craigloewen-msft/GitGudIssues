const { spawn } = require('child_process');

class pythonWorkerHandler {

    constructor(inSocket) {
        const pythonServer = spawn('python3', ['./pythonWorker/server.py']);
        pythonServer.on('exit', (code, signal) => {
            if (code !== 0) {
                console.error(`Python server exited with code: ${code}, signal: ${signal}`);
            }
        });

        this.sock = inSocket;
        this.sock.connect('tcp://127.0.0.1:4242');

    }

    async getEmbedding(inText) {
        await this.sock.send(inText);
        const [result] = await this.sock.receive();
        console.log('Python socket received reply: ', result.toString());
        return result.toString();
    }

}

module.exports = pythonWorkerHandler;