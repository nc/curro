'use client';
import { useCallback, useEffect, useRef } from 'react';
import { proxy } from 'valtio';
import { Message, RemoteEvalResult } from './types';

// import { headers } from 'next/dist/client/components/headers';
// const inter = Inter({ subsets: ['latin'] });
type Store = {
  tasks: Record<
    string,
    {
      id: string;
      question: string;
      output: string;
      answer: string;
    }
  >;
};

export function useAgent() {
  const storeRef = useRef(
    proxy<Store>({
      tasks: {},
    })
  );
  const wsRef = useRef<WebSocket | null>(null);

  const ask = useCallback(
    async (question: string) => {
      const id = Math.random().toString(36).slice(2);
      const message = Message.parse({
        id,
        type: 'question',
        question: question,
      });
      storeRef.current.tasks[id] = { id, question, output: '', answer: '' };
      wsRef.current?.send(JSON.stringify(message));
      return id;
    },
    [storeRef, wsRef]
  );

  useEffect(() => {
    wsRef.current = new WebSocket('ws://localhost:8787');
    const ws = wsRef.current;
    ws.addEventListener('message', (event) => {
      const message = Message.parse(JSON.parse(event.data));
      switch (message.type) {
        case 'answer':
          storeRef.current.tasks[message.id].answer = message.answer;
          break;

        case 'token':
          storeRef.current.tasks[message.id].output += message.token;
          console.log('[token]', message.token);
          break;
        case 'eval':
          let result;
          try {
            const response = Message.parse({
              id: message.id,
              type: 'evalSuccess',
              result: JSON.stringify(eval(message.code)),
            });
            ws.send(JSON.stringify(response));
          } catch (e) {
            const response = Message.parse({
              id: message.id,
              type: 'evalError',
              result: JSON.stringify(e),
            });
            ws.send(JSON.stringify(response));
          }

          break;
      }
    });

    ws.addEventListener('open', () => {
      console.log('[open]');
    });

    ws.addEventListener('close', () => {
      console.log('[close]');
    });

    ws.addEventListener('error', () => {
      console.log('[error]');
    });
  }, []);

  return { store: storeRef.current, actions: { ask } };
}
