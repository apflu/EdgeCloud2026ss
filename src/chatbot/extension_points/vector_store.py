"""
Extension point: Vector store for RAG (retrieval-augmented generation).

This module is a placeholder. To add a vector store:

1. Add your dependency (e.g. chromadb, qdrant-client) to pyproject.toml
   optional-dependencies or dependencies.
2. Implement a function that:
   - Takes the user message (or a query derived from it).
   - Returns a list of relevant text chunks (or a single context string).
3. Use that context in the agent, e.g. by:
   - Adding it to the system prompt dynamically in an @agent.instructions
     decorator, or
   - Prepending it to the user message, or
   - Using a tool that the model can call to search the vector store.

Example (pseudo-code):

    def retrieve(query: str, top_k: int = 5) -> list[str]:
        collection = get_chromadb_collection()
        results = collection.query(query_texts=[query], n_results=top_k)
        return [doc for doc in results["documents"][0]]

Then in agent.py you could add dynamic instructions that call retrieve()
and inject the result into the context.
"""


def retrieve(_query: str, top_k: int = 5) -> list[str]:
    """
    Placeholder: retrieve relevant chunks for a query.
    Override with your vector store (e.g. ChromaDB, Qdrant) to enable RAG.
    """
    return []
