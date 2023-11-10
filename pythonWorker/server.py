import zmq
import json
from sentence_transformers import SentenceTransformer


model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

class HelloRPC(object):
    '''pass the method a name, it replies "Hello name!"'''
    def getEmbedding(self, inputString):
        embeddingArray = model.encode(inputString)
        return embeddingArray

def main():
    context = zmq.Context()
    socket = context.socket(zmq.REP)
    socket.bind("tcp://*:4242")

    rpc = HelloRPC()

    while True:
        # Wait for next request from client
        message = socket.recv_string()

        # Call the RPC method and get the result
        result = rpc.getEmbedding(message)

        # Convert the result to a JSON string
        result_json = json.dumps(result.tolist())

        # Send reply back to client
        socket.send_string(result_json)

if __name__ == "__main__":
    main()