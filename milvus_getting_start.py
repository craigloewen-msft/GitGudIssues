import time

import numpy as np
from pymilvus import (
    connections,
    utility,
    FieldSchema, CollectionSchema, DataType,
    Collection,
)
import random
import string
from sentence_transformers import SentenceTransformer


model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

nouns = ["clown", "dog", "cat", "car", "bicycle", "house", "tree", "book", "phone", "computer"]
verbs = ["walked", "ran", "jumped", "flew", "sang", "read", "swam", "drove", "played", "slept"]
adjectives = ["happy", "sad", "fast", "slow", "loud", "quiet", "bright", "dark", "heavy", "light"]
adverbs = ["quickly", "slowly", "quietly", "loudly", "happily", "sadly", "easily", "hardly", "rarely", "often"]

def generate_random_sentence():
    noun1 = random.choice(nouns)
    noun2 = random.choice(nouns)
    verb = random.choice(verbs)
    adjective1 = random.choice(adjectives)
    adjective2 = random.choice(adjectives)
    adverb = random.choice(adverbs)
    return f"The {adjective1} {noun1} {verb} the {adjective2} {noun2} {adverb}"

fmt = "\n=== {:30} ===\n"
search_latency_fmt = "search latency = {:.4f}s"
num_entities, dim = 3000, 384

print(fmt.format("start connecting to Milvus"))
connections.connect("default", host="standalone", port="19530")

has = utility.has_collection("hello_milvus")

if has:
    utility.drop_collection("hello_milvus")

print(f"Does collection hello_milvus exist in Milvus: {has}")

fields = [
    FieldSchema(name="issueID", dtype=DataType.VARCHAR, is_primary=True, auto_id=False, max_length=100),
    FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=200),
    FieldSchema(name="embeddings", dtype=DataType.FLOAT_VECTOR, dim=dim)
]

schema = CollectionSchema(fields, "hello_milvus is the simplest demo to introduce the APIs")

print(fmt.format("Create collection `hello_milvus`"))
hello_milvus = Collection("hello_milvus", schema, consistency_level="Strong")

print(fmt.format("Start inserting entities"))
rng = np.random.default_rng(seed=19530)
issueIDList = [str(i) for i in range(num_entities)]
titleList = [generate_random_sentence() for i in range(num_entities)]
embeddingsList = model.encode(titleList)
entities = [
    issueIDList,
    titleList,
    embeddingsList    
]

insert_result = hello_milvus.insert(entities)

hello_milvus.flush()
print(f"Number of entities in Milvus: {hello_milvus.num_entities}")  # check the num_entities

################################################################################
# 4. create index
# We are going to create an IVF_FLAT index for hello_milvus collection.
# create_index() can only be applied to `FloatVector` and `BinaryVector` fields.
print(fmt.format("Start Creating index IVF_FLAT"))
index = {
    "index_type": "IVF_FLAT",
    "metric_type": "L2",
    "params": {"nlist": 128},
}

hello_milvus.create_index("embeddings", index)

################################################################################
# 5. search, query, and hybrid search
# After data were inserted into Milvus and indexed, you can perform:
# - search based on vector similarity
# - query based on scalar filtering(boolean, int, etc.)
# - hybrid search based on vector similarity and scalar filtering.
#

# Before conducting a search or a query, you need to load the data in `hello_milvus` into memory.
print(fmt.format("Start loading"))
hello_milvus.load()

# -----------------------------------------------------------------------------
# search based on vector similarity
print(fmt.format("Start searching based on vector similarity"))
input_sentence = "The feline rapidly developed on the laptop"
vectors_to_search = model.encode([input_sentence])
search_params = {
    "metric_type": "L2",
    "params": {"nprobe": 10},
}

start_time = time.time()
result = hello_milvus.search(vectors_to_search, "embeddings", search_params, limit=3, output_fields=["title"])
end_time = time.time()

for hits in result:
    for hit in hits:
        print(f"hit: {hit}, random field: {hit.entity.get('random')}")
print(search_latency_fmt.format(end_time - start_time))

print(fmt.format("Drop collection `hello_milvus`"))
utility.drop_collection("hello_milvus")
