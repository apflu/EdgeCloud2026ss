/**
 * Chat UI – handles form submit, fetches conversation history, and renders
 * streamed responses. Messages are newline-delimited JSON from the /chat/ API.
 */

(function () {
  'use strict';

  const conversationEl = document.getElementById('conversation');
  const form = document.getElementById('chat-form');
  const promptInput = document.getElementById('prompt-input');
  const spinner = document.getElementById('spinner');
  const errorEl = document.getElementById('error');

  /**
   * Parse the response body (newline-delimited JSON) into an array of message objects.
   * Each line is one JSON object: { role, timestamp, content }.
   */
  function parseNdJson(text) {
    return text
      .split('\n')
      .filter(function (line) { return line.trim().length > 0; })
      .map(function (line) { return JSON.parse(line); });
  }

  /**
   * Render messages into #conversation. Uses timestamp as a simple id so we can
   * update the same message div when streaming (same timestamp, updated content).
   */
  function renderMessages(messages) {
    messages.forEach(function (msg) {
      var id = 'msg-' + msg.timestamp;
      var div = document.getElementById(id);
      if (!div) {
        div = document.createElement('div');
        div.id = id;
        div.className = 'user';
        if (msg.role === 'model') div.className = 'model';
        div.setAttribute('title', msg.role + ' at ' + msg.timestamp);
        conversationEl.appendChild(div);
      }
      // Support simple Markdown in content (e.g. code, lists).
      div.innerHTML = typeof marked !== 'undefined'
        ? marked.parse(msg.content || '')
        : (msg.content || '').replace(/</g, '&lt;');
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  /**
   * Handle the response from POST /chat/. The body is streamed; we accumulate
   * text and re-parse/ re-render on each chunk so the assistant reply appears
   * progressively.
   */
  function handleStreamResponse(response) {
    if (!response.ok) {
      return response.text().then(function (text) {
        console.error('POST /chat/ failed:', response.status, text);
        errorEl.style.display = 'block';
        spinner.classList.remove('active');
        promptInput.disabled = false;
      });
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function readChunk() {
      return reader.read().then(function (result) {
        if (result.done) {
          spinner.classList.remove('active');
          promptInput.disabled = false;
          promptInput.focus();
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var messages = parseNdJson(buffer);
        if (messages.length > 0) renderMessages(messages);
        return readChunk();
      });
    }

    spinner.classList.add('active');
    promptInput.disabled = true;
    return readChunk();
  }

  // Submit: POST to /chat/ with form data, then process the stream.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = new FormData(form);
    promptInput.value = '';

    fetch('/chat/', { method: 'POST', body: body })
      .then(handleStreamResponse)
      .catch(function (err) {
        console.error(err);
        errorEl.style.display = 'block';
        spinner.classList.remove('active');
        promptInput.disabled = false;
      });
  });

  // On load: fetch existing conversation and render it.
  fetch('/chat/')
    .then(function (r) { return r.text(); })
    .then(function (text) {
      var messages = parseNdJson(text);
      renderMessages(messages);
    })
    .catch(function (err) {
      console.error('Failed to load chat history:', err);
    });
})();
