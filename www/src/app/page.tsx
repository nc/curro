'use client';
import React, { useCallback } from 'react';
import { useAgent } from './useAgent';
import { useSnapshot } from 'valtio';

const MessageStyle: React.CSSProperties = {
  background: '#2D302F',
  border: '1px solid #2D302F',
  borderRadius: '8px',
  padding: '4px 12px',
  fontSize: 14,
  lineHeight: '28px',
  color: 'white',
  fontFamily: 'Inter, sans-serif',
};

const OutputStyle: React.CSSProperties = {
  ...MessageStyle,
  background: 'transparent',
};

const AnswerStyle: React.CSSProperties = {
  ...MessageStyle,
  background: 'transparent',
};

const MessageListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: 0,
  gap: 12,
};

const InputStyle: React.CSSProperties = {
  background: '#2D302F',
  color: 'white',
  fontFamily: 'Inter, sans-serif',
  fontSize: '14px',
  lineHeight: '18px',
  border: 'none',
  padding: '12px 20px',
  marginBottom: '32px',
  borderRadius: 100,
  width: 'calc(100% - 40px)',
};

const CursorStyle: React.CSSProperties = {
  width: '1ch',
  height: '1em',
  background: 'white',
  display: 'inline-block',
};

export default function Home() {
  const { store, actions } = useAgent();
  const { tasks } = useSnapshot(store);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const query = e.currentTarget.query.value;
      actions.ask(query);
      e.currentTarget.value = '';
    },
    [actions]
  );

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', padding: 24 }}>
      <div>
        <form onSubmit={handleSubmit}>
          <input name="query" type="text" placeholder="Ask anything..." style={InputStyle} />
          <button type="submit" style={{ display: 'none' }}>
            Submit
          </button>
        </form>
      </div>
      {tasks &&
        Object.keys(tasks).map((id) => {
          return (
            <div key={id} style={MessageListStyle}>
              <div style={MessageStyle}>{tasks[id].question}</div>
              <div style={OutputStyle}>
                {tasks[id].output}
                {tasks[id].done ? null : <div style={CursorStyle} />}
              </div>
              {tasks[id].done ? <div style={AnswerStyle}>{tasks[id].answer}</div> : null}
            </div>
          );
        })}
    </main>
  );
}
