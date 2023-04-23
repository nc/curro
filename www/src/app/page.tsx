'use client';
import React, { useCallback } from 'react';
import { useAgent } from './useAgent';
import { useSnapshot } from 'valtio';

const MainStyle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  height: '100vh',
};

const MessageStyle: React.CSSProperties = {
  background: '#2D302F',
  border: '1px solid #2D302F',
  borderRadius: '8px',
  padding: '4px 12px',
  fontSize: 15,
  lineHeight: '28px',
  color: 'rgba(255, 255, 255, 0.9)',
  fontFamily: 'Inter, sans-serif',
};

const OutputStyle: React.CSSProperties = {
  ...MessageStyle,
  background: 'transparent',
  whiteSpace: 'pre-wrap',
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
  flex: 0,
  marginTop: 12,
};

const InputStyle: React.CSSProperties = {
  backgroundColor: '#2D302F',
  color: 'rgba(255, 255, 255, 0.9)',
  fontFamily: 'Inter, sans-serif',
  fontSize: '15px',
  lineHeight: '28px',
  border: 'none',
  padding: '5px 20px',
  marginTop: '12px',
  borderRadius: '8px',
  outline: 'none',
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
    <main style={MainStyle}>
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
      <div>
        <form onSubmit={handleSubmit}>
          <input
            name="query"
            type="text"
            placeholder="Ask anything..."
            style={InputStyle}
            autoComplete="off"
          />
          <button type="submit" style={{ display: 'none' }}>
            Submit
          </button>
        </form>
      </div>
    </main>
  );
}
