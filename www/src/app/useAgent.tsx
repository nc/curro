'use client';
import { useEffect, useRef } from 'react';
import { proxy } from 'valtio';

// import { headers } from 'next/dist/client/components/headers';
// const inter = Inter({ subsets: ['latin'] });
export function useAgent() {
  const storeRef = useRef(proxy({}));

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:57715');
    // Now you can send and receive messages like before.
    // ws.send('hello');
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'token':
          console.log('token', data.token);
          break;
        case 'eval':
          let response;
          try {
            response = { status: 'success', result: eval(data.code) };
          } catch (e) {
            response = { status: 'failure', error: e };
          }
          ws.send(JSON.stringify({ type: 'eval', id: data.id, ...response }));
          break;
      }
    });

    ws.addEventListener('open', () => {
      console.log('open');
      ws.send(
        JSON.stringify({
          type: 'question',
          question: 'what is the day tomorrow?',
        })
      );
    });

    ws.addEventListener('close', () => {
      console.log('close');
    });

    ws.addEventListener('error', () => {
      console.log('error');
    });
  }, []);

  return storeRef.current;
}
