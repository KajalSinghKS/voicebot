import React, { useState, useEffect, useRef, useCallback } from 'react';

function Bot() {
  const [isRecording, setIsRecording] = useState(false);
  const [latestMessage, setLatestMessage] = useState('');
  const recognitionRef = useRef(null);
  const socketRef = useRef(null);
  const voicesRef = useRef([]);

  // 🔊 Speak bot replies with dynamic language and matching voice
  const speakText = useCallback((text) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const isHindi = /[\u0900-\u097F]/.test(text);
    utterance.lang = isHindi ? 'hi-IN' : 'en-US';

    const matchingVoice = voicesRef.current.find(v => v.lang === utterance.lang);
    utterance.voice = matchingVoice || voicesRef.current.find(v => v.lang.startsWith('en')) || voicesRef.current[0];

    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1][0].transcript;
      setLatestMessage(`🧑 ${lastResult}`);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ text: lastResult }));
      }
    };

    recognitionRef.current.onerror = (e) => {
      console.error('Speech recognition error:', e);
    };
  }, []);

  // 🗣️ Preload voices and store in ref
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesRef.current = voices;
      } else {
        // Retry if voices not loaded yet
        setTimeout(loadVoices, 100);
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  useEffect(() => {
    if (isRecording) {
      socketRef.current = new WebSocket('ws://localhost:8080');

      socketRef.current.onopen = () => {
        console.log('WebSocket opened');
        socketRef.current.send(JSON.stringify({ action: 'start' }));

        socketRef.current.onmessage = (event) => {
          const reply = event.data;
          setLatestMessage(`🤖 ${reply}`);
          speakText(reply);
        };
      };

      socketRef.current.onclose = () => {
        console.log('WebSocket closed');
      };

      recognitionRef.current.start();
    } else {
      window.speechSynthesis.cancel();

      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({ action: 'stop' }));
        socketRef.current.close();
        socketRef.current = null;
      }

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }

    return () => {
      window.speechSynthesis.cancel();

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording, speakText]);

  const handleClick = () => {
    setIsRecording(prev => !prev);
  };

  return (
    <div>
      <button onClick={handleClick}>
        Bot — {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>

      <div style={{ marginTop: '20px' }}>
        <h3>Latest Message:</h3>
        <p>{latestMessage}</p>
      </div>
    </div>
  );
}

export default Bot;