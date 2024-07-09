import zmq
import json
import onnxruntime_genai as og
import argparse
import time
import onnxruntime_genai as og
import os
import stat

class AutoLabeler:
    def __init__(self, model_path):
        print("Opening up model")
        # Print out the contents of the model_path folder
        print(os.listdir(model_path))

        self.model = og.Model(model_path)
        self.tokenizer = og.Tokenizer(self.model)
        self.tokenizer_stream = self.tokenizer.create_stream()
        self.chat_template = '<|user|>\n{input} <|end|>\n<|assistant|>'
        self.search_options = { 'do_sample' : False, 'max_length' : 1024 }

    def predict(self, inputString):
        formattedPrompt = f'{self.chat_template.format(input=inputString)}'
        input_tokens = self.tokenizer.encode(formattedPrompt)

        params = og.GeneratorParams(self.model)
        params.set_search_options(**(self.search_options))
        params.input_ids = input_tokens
        generator = og.Generator(self.model, params)

        returnString = ""

        while not generator.is_done():
            generator.compute_logits()
            generator.generate_next_token()

            new_token = generator.get_next_tokens()[0]
            tokenString = self.tokenizer_stream.decode(new_token)
            returnString += tokenString

            print(returnString)

        del generator

        return returnString

class HelloRPC(object):
    def __init__(self, model_path):
        self.autoLabeler = AutoLabeler(model_path)

    def getPrediction(self, inputString):
        prediction = self.autoLabeler.predict(inputString)
        return prediction

def main():
    context = zmq.Context()
    socket = context.socket(zmq.REP)
    socket.bind("tcp://*:4242")

    rpc = HelloRPC("./onnxModel")

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