import zmq
import json
from sentence_transformers import SentenceTransformer


model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

class HelloRPC(object):
    def getEmbedding(self, inputString):
        embeddingArray = model.encode(inputString)
        return embeddingArray.tolist()

    def getMultipleEmbeddings(self, inputStrings):
        embeddingsArray = model.encode(inputStrings)
        return embeddingsArray.tolist()

def main():
    context = zmq.Context()
    socket = context.socket(zmq.REP)
    socket.bind("tcp://*:4242")

    rpc = HelloRPC()

    while True:
        # Wait for next request from client
        message = socket.recv_string()

        # Parse the JSON request
        request = json.loads(message)

        # Get the method name and arguments from the request
        method_name = request.get('method')
        args = request.get('args', [])

        # Get the method from the rpc object
        method = getattr(rpc, method_name)

        # Call the method with the arguments and get the result
        result = method(*args)

        # Convert the result to a JSON string
        result_json = json.dumps(result)

        # Send reply back to client
        socket.send_string(result_json)

if __name__ == "__main__":
    main()